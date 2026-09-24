# PRD — Stock Opname & Async Inventory Reconciliation

Status: Draft v1
Source brief: `Take-Home Technical Assessment_ Stock Opname & Async Reconciliation Service V3 (1).pdf`

## 1. Goal

Build a minimal but correct web app + API that runs the full Stock Opname (physical stock
count) lifecycle: a manager snapshots expected stock, staff submit physical counts, and a
manager's approval triggers an **asynchronous, idempotent** reconciliation that updates
official stock and writes a durable audit trail — without blocking the approval request.

Stack: Express.js + PostgreSQL (Sequelize) for the API, Nuxt.js for the frontend.

## 2. Roles

| Role | Can do |
|---|---|
| **Warehouse Staff** | View audit sessions assigned to them; submit physical counts for an assigned session in one batch action. |
| **Warehouse Manager** | Manage products; initiate audit sessions (pick products + assign a staff member); review submitted counts and variances; approve or reject a session; view the audit log. |
| **Admin** (added post-brief, see §11) | Manage user accounts (create, change role, activate/deactivate, unlock a locked account); view the audit log. Deliberately does **not** overlap with the manager's product/session duties - it's a separate concern (identity/access administration) from warehouse operations. |

Both roles authenticate with the same login; the UI and allowed actions differ per role.

## 3. Domain model

```
users                  id, name, email (unique), password_hash, role[staff|manager], is_active, timestamps
products               id, sku (unique), name, on_hand_qty, is_active, timestamps
audit_sessions         id, code, status, assigned_staff_id, created_by, submitted_at,
                       reviewed_by, reviewed_at, review_note, timestamps
audit_session_items    id, audit_session_id, product_id, expected_qty, counted_qty,
                       discrepancy_qty, counted_at, applied_at, timestamps
                       unique(audit_session_id, product_id)
reconciliation_jobs    id, audit_session_id (unique), status[pending|processing|completed|failed],
                       attempts, last_error, requested_by, completed_at, timestamps
stock_adjustment_logs  id, product_id, audit_session_id, audit_session_item_id,
                       previous_qty, change_qty, new_qty, created_by, created_at
audit_logs             id, actor_id, actor_email, action, entity_type, entity_id,
                       metadata(jsonb), ip_address, user_agent, created_at
```

`stock_adjustment_logs` and `audit_logs` are deliberately two separate tables, not one:
`stock_adjustment_logs` is the narrow, numeric-diff audit trail the brief explicitly requires
for inventory changes (previous/change/new quantity, one row per reconciled item). `audit_logs`
is a general, system-wide activity log — logins (success **and** failure, with a reason),
product master-data changes (with a before/after snapshot), and every audit-session lifecycle
transition (initiated, counts submitted, approval requested, approved, rejected). `entity_type`
+ `entity_id` is a polymorphic reference (no FK, since it points at different tables depending
on the row) so the same log can point at a `User`, a `Product`, or an `AuditSession`. Fetching a
session's detail includes its slice of `audit_logs` as an activity timeline; a manager-only
`GET /v1/audit-logs` endpoint exposes the whole log with basic filtering (`action`,
`entityType`, `entityId`, `actorId`).

`expected_qty` is a **snapshot** of `product.on_hand_qty` taken at initiation time — it never
changes after that, even if the product's live stock moves for unrelated reasons before the
session is approved.

## 4. Lifecycle / state machine

```
OPEN ──(staff submits full batch of counts)──> SUBMITTED
SUBMITTED ──(manager rejects)──> REJECTED                 [terminal]
SUBMITTED ──(manager approves)──> APPROVING ──(worker finishes)──> APPROVED   [terminal]
```

- **OPEN**: session created by a manager with a product snapshot and an assigned staff user.
  Only that staff member may submit counts.
- **SUBMITTED**: staff has submitted counted quantities for every item in the session, as one
  batch, in one request. No further edits from staff. Stock is **not** touched yet.
- **APPROVING**: manager clicked Approve. The API responds immediately after (a) validating
  the session is `SUBMITTED` and (b) enqueuing exactly one reconciliation job — it does not
  wait for stock to actually update. This is the "fast + async" requirement from the brief.
- **APPROVED**: the background worker has computed discrepancies, applied stock deltas, and
  written the audit log for every item. Terminal.
- **REJECTED**: manager rejected the batch (with a required note). No stock change. Terminal —
  a new session must be initiated for a re-count (see Assumptions).

## 5. Async reconciliation design

Chosen approach: **DB-backed job table + polling worker** (no Redis/BullMQ), because it keeps
the whole system to a single Postgres dependency, which matters for a take-home reviewer who
has to `docker compose up` this in a few minutes, while still exercising the same concepts
(decoupled execution, retry-safety, horizontal-safe locking) a Redis queue would.

- `POST /audit-sessions/:id/approve` runs one DB transaction:
  1. `SELECT ... FOR UPDATE` the session row, verify status is `SUBMITTED`. If it's already
     `APPROVING`/`APPROVED`, return the current session state with 200 instead of erroring —
     this is what makes the endpoint **safe to call twice** (network retry after a timeout,
     double-click, etc.) without creating a second job.
  2. Insert one row into `reconciliation_jobs` (unique constraint on `audit_session_id` is the
     hard backstop against a duplicate job even under a race).
  3. Flip session status to `APPROVING`.
  4. Commit and respond. Total work here is a few indexed writes — no per-item math, no loop.
- A worker (`jobs/reconciliationWorker.js`) polls for `pending` jobs every ~2s using
  `SELECT ... FOR UPDATE SKIP LOCKED`, so running more than one worker process is safe (each
  claims a different job, none block each other).
- Per-item idempotency: each `audit_session_items` row has an `applied_at` timestamp. The
  worker only reconciles items where `applied_at IS NULL`. If the process crashes mid-session
  (some items applied, some not) and the job is retried, already-applied items are skipped —
  so a crash never double-applies a stock delta, even though the job itself is retried at the
  job granularity, not (only) the item granularity.
- Stock is updated as `product.on_hand_qty += (counted_qty - expected_qty)` against the
  **current** row (not overwritten to `counted_qty`), because other approved sessions or
  manual adjustments could have moved stock between snapshot and approval — see Assumptions.
- Every applied item writes one `stock_adjustment_logs` row (previous/new qty, delta, actor,
  linked session) — this is the durable audit log the brief asks for, and it is append-only.
- On any error mid-job, the job is marked `failed` with `last_error`, `attempts` increments,
  and it becomes eligible for a manual/automatic retry without re-applying already-`applied_at`
  items.

## 6. API surface (v1)

Envelope for every response: `{ code, success, message, data }`.

```
POST   /v1/auth/login                       -> { token, user }
GET    /v1/auth/me                          -> current user

GET    /v1/products                         -> list (manager: all; staff: read-only, for context)
POST   /v1/products                         -> create product                         [manager]
PATCH  /v1/products/:id                     -> edit name/sku (not stock directly)     [manager]
GET    /v1/users/staff                      -> list active staff, for the "assign to" picker [manager]

GET    /v1/users                            -> list all users                                [admin]
POST   /v1/users                            -> create user: { name, email, password, role }  [admin]
PATCH  /v1/users/:id                        -> edit name/role/isActive/password               [admin]
POST   /v1/users/:id/unlock                 -> clear a lockout                                [admin]

POST   /v1/audit-sessions                   -> initiate: { productIds[], assignedStaffId } [manager]
GET    /v1/audit-sessions                   -> list (scoped: staff sees only assigned ones)
GET    /v1/audit-sessions/:id               -> detail incl. items + variances
POST   /v1/audit-sessions/:id/counts        -> staff batch submit: { items: [{productId, countedQty}] } [staff, owner only]
POST   /v1/audit-sessions/:id/approve       -> [manager] fast, async — see §5
POST   /v1/audit-sessions/:id/reject        -> { note } [manager]

GET    /v1/audit-logs                       -> system-wide activity log, filterable by
                                                action/entityType/entityId/actorId  [manager, admin]
```

## 7. Frontend

- `/login` — single form, redirects by role.
- Staff: `/staff/sessions` (assigned sessions list) → `/staff/sessions/:id` (one form, every
  item's expected qty shown alongside a counted-qty input, single "Submit Counts" action —
  matches the "one action" requirement literally).
- Manager: `/manager/products` (CRUD), `/manager/sessions` (list + "New session" to pick
  products & staff), `/manager/sessions/:id` (variance table: expected vs counted vs
  discrepancy, Approve/Reject with a note field for rejection).
- Auth/session handled via Nuxt server routes (`server/api/**`) acting as a BFF: they hold the
  JWT in an httpOnly cookie and forward it as `Authorization: Bearer` to Express, mirroring the
  reference project's proxy pattern without exposing the token to client JS.

## 8. Explicit assumptions (gaps left open by the brief)

1. **Full-coverage submission.** Staff must submit a counted quantity for every item in the
   session to submit the batch (no partial submission). Rationale: a stock opname with silently
   skipped items is a data-integrity risk in a warehouse audit; partial states are surfaced as a
   validation error listing the missing SKUs rather than allowed silently.
2. **Duplicate product IDs in a submitted batch are rejected (400)**, not last-write-wins —
   ambiguous input from the client should not be silently resolved on the server.
3. **Rejection is terminal.** A rejected session does not reopen for re-counting; the manager
   initiates a fresh session. Simpler state machine, and it keeps a clean audit trail per
   attempt instead of mutating history.
4. **Reconciliation adds a delta to current stock**, not an overwrite to the counted value —
   protects against lost updates if stock moved for another reason between snapshot and
   approval.
5. **One staff assignee per session** (not a pool) — matches "assigned to them" in the brief
   and keeps the ownership check on count-submission simple.
6. Auth uses a single JWT (no refresh-token flow) with an 8h expiry, sized for a work shift —
   token rotation is flagged as an out-of-scope hardening item in NOTES.md.

## 9. Security hardening (added after the initial submission was already working)

- **Per-IP login rate limiting** (`express-rate-limit`, `LOGIN_RATE_LIMIT_MAX` per
  `LOGIN_RATE_LIMIT_WINDOW_MS`, default 10 per 15 min) — guards against one attacker spraying
  many different emails from one source.
- **Per-account lockout**: after `ACCOUNT_LOCKOUT_MAX_ATTEMPTS` (default 3) wrong passwords in a
  row, the account is locked for `ACCOUNT_LOCKOUT_MINUTES` (default 15) regardless of which IP
  is attempting — this is the complementary case rate limiting alone doesn't cover (many
  passwords against one account, possibly spread across many IPs). The lockout state (locked
  vs. not, and until when) is deliberately surfaced to the caller ("Account temporarily locked
  until...") rather than hidden behind a generic error — a small information leak (confirms the
  email exists) traded for a much better experience for the legitimate employee who got locked
  out, on an internal tool that isn't consumer-facing.
- **Google reCAPTCHA v3** on login. Ships wired up end-to-end but inert: `verifyRecaptcha()`
  (backend) and `useRecaptcha()` (frontend) both no-op when `RECAPTCHA_SECRET_KEY` /
  `NUXT_PUBLIC_RECAPTCHA_SITE_KEY` aren't set, so local dev and the test suite are unaffected
  until real keys are dropped into `.env` — at which point verification (score threshold via
  `RECAPTCHA_MIN_SCORE`, default 0.5) activates automatically, no code change needed.
- **Admin role + user management.** A user can be created, have its role/active-status changed,
  have its password reset, or be unlocked, all admin-only. An admin cannot demote or deactivate
  their *own* account (checked server-side, not just hidden in the UI) — a deliberate guard
  against an admin locking themselves out with no other admin left to fix it.

## 10. Bonus (time-permitting, after MVP is solid)

- CSV bulk upload for staff counts (explicitly suggested in the brief) as an alternative to the
  manual form.

## 11. Out of scope

Multi-warehouse/location support, barcode scanning, Docker/nginx/SSL/PM2 production
deployment tooling (present in the reference projects but irrelevant to a take-home), refresh
tokens, email notifications, self-service password reset (an admin resets it for now).
