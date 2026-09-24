# Learning guide: understand this codebase before your interview

This is written for **you**, not for the repo. Goal: after reading this, you should be able to
whiteboard the system from memory and answer "why did you do X" for every non-obvious decision.
Read [PRD.md](PRD.md) alongside this for the "what," and this file for the "where is it in the
code" and "what will they probably ask."

## 1. The one-paragraph pitch

A warehouse manager snapshots expected stock into an "audit session," a staff member counts the
physical stock and submits it as one batch, and when the manager approves, a background worker
(not the request itself) reconciles the counts against live stock, applies the difference, and
writes an audit log — in a way that's safe even if the approval is retried or the worker crashes
partway through.

## 2. Follow one request through the whole stack

Trace `POST /audit-sessions/:id/approve` end to end — this is the most likely thing you'll be
asked to explain live.

1. **Browser** → `stock-opname-fe/app/pages/manager/sessions/[id].vue`, `onApprove()` calls
   `api.post('/audit-sessions/.../approve')`.
2. `useApi()` ([app/composables/useApi.js](../stock-opname-fe/app/composables/useApi.js)) calls
   `useRequestFetch()('/api/audit-sessions/.../approve')` — a **same-origin** call to Nuxt's own
   server, not directly to Express. This matters: the browser never sees the JWT.
3. **Nuxt server route**
   [server/api/audit-sessions/[id]/approve.post.ts](../stock-opname-fe/server/api/audit-sessions/%5Bid%5D/approve.post.ts)
   reads the `id` param and calls `apiFetch()`.
4. [server/utils/apiFetch.ts](../stock-opname-fe/server/utils/apiFetch.ts) pulls the JWT out of
   the httpOnly cookie and forwards the request to Express with `Authorization: Bearer <token>`.
   This whole `server/api/**` layer is the **BFF (backend-for-frontend)** — its only job is to
   hold the cookie and reshape errors; it has no business logic.
5. **Express**: `routes/v1/auditSessionRoute.js` → `requireRole('manager')` middleware → calls
   `auditSessionService.approveSession()`.
6. [services/auditSessionService.js](../stock-opname-be/services/auditSessionService.js) does
   the actual state-machine work in one DB transaction (see PRD §5), commits, and — critically —
   returns the HTTP response **before** any stock math happens.
7. `nudgeWorker()` ([jobs/reconciliationWorker.js](../stock-opname-be/jobs/reconciliationWorker.js))
   schedules the real work via `setImmediate`, fire-and-forget.
8. [services/reconciliationService.js](../stock-opname-be/services/reconciliationService.js)
   does the actual reconciliation — this is the part that's "asynchronous" in the assessment
   title. It runs either from that nudge, or independently from the standalone worker process's
   poll loop (`npm run worker`), whichever gets there first.
9. Frontend polls `GET /audit-sessions/:id` every 1.5s while status is `APPROVING`, stops when it
   flips to `APPROVED`.

**Why split step 6 and step 8 into two different files/processes at all?** Because the brief
requires the approval endpoint to stay fast regardless of session size, and requires heavy work
not to block it. If reconciliation ran inline inside `approveSession`, a session with 500 items
would make the manager's browser hang for as long as that loop takes.

## 3. The state machine (memorize this)

```
OPEN → SUBMITTED → APPROVING → APPROVED
              └──→ REJECTED
```

Every transition is guarded in `auditSessionService.js` by checking the *current* status inside
a transaction with a row lock (`SELECT ... FOR UPDATE`) before changing it — that row lock is
what makes concurrent requests (two approve clicks, approve-vs-reject race) resolve safely
instead of racing.

## 4. Idempotency — the part most likely to get follow-up questions

There are actually **three independent layers**, each catching a different failure mode. Be
able to name why each exists on its own — an interviewer may ask "wouldn't one be enough?":

| Layer | Where | Protects against |
|---|---|---|
| Unique constraint on `reconciliation_jobs.audit_session_id` | migration + model | Two `approve` calls creating two jobs |
| `applied_at` on each `audit_session_items` row | `reconciliationService.reconcileOneJob` | A crash mid-job re-applying an already-adjusted item on retry |
| Unique constraint on `stock_adjustment_logs.audit_session_item_id` | migration + model | A bug (not a crash) somehow calling the adjustment logic twice for one item |

The honest answer to "wouldn't one be enough?" is no — the job-level constraint stops duplicate
*jobs*, not a partially-applied *single* job retrying; the item-level `applied_at` stops that,
but is an application-level check that a bug could bypass; the DB unique constraint is the
backstop that doesn't depend on the application code being correct.

## 5. The general audit log (added after the core lifecycle was already working)

This is a separate concept from `stock_adjustment_logs` (the inventory-specific ledger the
brief requires). `audit_logs` is a system-wide "who did what, when" trail:

- **Login, success and failure.** A failed attempt records *why* (`unknown_email`,
  `inactive_user`, `wrong_password`) even though the client only ever sees a generic "Invalid
  email or password" — the detail is for operators, not attackers probing which part was wrong.
- **Product master-data changes**, with a before/after snapshot in `metadata` so an edit is
  reviewable, not just visible.
- **Every audit-session lifecycle transition** (initiated → counts submitted → approval
  requested → approved/rejected). This is also what powers the "Activity" timeline on a
  session's detail page in the frontend.

Two write paths in [services/auditLogService.js](../stock-opname-be/services/auditLogService.js),
and the distinction matters:
- `record(...)` takes a `transaction` and is used wherever the audit entry must live or die with
  the business change it documents (e.g. approving a session and recording that it happened are
  one atomic unit).
- `recordSafely(...)` has no transaction and swallows its own errors — used for standalone
  events like login, where a logging failure must never be allowed to break the login itself.

`entity_type` + `entity_id` is a polymorphic reference (no foreign key — it points at different
tables depending on the row), which is also how `AuditSession.hasMany(AuditLog, { scope: {
entity_type: 'AuditSession' } })` pulls in just the relevant slice for a session's timeline.

## 6. Login security & the admin role (added after the audit log)

Three independent mechanisms, each answering a different threat, layered on top of each other -
be ready to explain why one alone wouldn't be enough:

- **Per-IP rate limiting** (`middleware/rateLimit.js`, `express-rate-limit`) - stops one source
  from hammering the login endpoint across *many different accounts*. Doesn't help if the
  attacker is patient and spreads requests across many IPs, or is targeting one specific account
  slowly - that's what the next mechanism is for.
- **Per-account lockout** (`services/authService.js`) - after 3 wrong passwords *for the same
  account* (tracked via `failed_login_attempts` on `users`, incremented atomically with
  `user.increment()` so concurrent attempts can't race past the counter), the account locks for
  15 minutes regardless of which IP is trying. This is the one that actually stops someone
  guessing passwords against one target account. A `423 Locked` response (not a generic 401)
  discloses the lock and when it clears - a deliberate small trade-off (confirms the email
  exists) for a much less confusing experience for the legitimate employee who got locked out.
  An admin can clear it early via `POST /users/:id/unlock`.
- **reCAPTCHA v3** (`utils/recaptcha.js` / `useRecaptcha.js`) - a bot/automation signal
  independent of both of the above. Ships wired up but genuinely inert (both sides skip
  verification, with a one-time log warning) until `RECAPTCHA_SECRET_KEY` /
  `NUXT_PUBLIC_RECAPTCHA_SITE_KEY` are set - so this doesn't block local dev or the test suite,
  and turning it on later needs zero code changes.

**The admin role** was added as a fourth role scoped narrowly to identity/access administration
(user CRUD, role changes, unlock) - deliberately *not* given manager's product/session
capabilities, since "who can manage user accounts" and "who runs warehouse operations" are
different concerns that happen to both be more-privileged-than-staff. One server-side guard
worth remembering: an admin cannot change their own role or deactivate their own account
(checked in the route handler, not just hidden in the UI) - otherwise a single careless click
could lock every admin out with no one left to fix it.

## 7. Where things live

```
stock-opname-be/
  models/                 Sequelize models (one file per table)
  migrations/             Schema, in the order they were created
  services/
    auditSessionService.js     the state machine (initiate/submit/approve/reject)
    reconciliationService.js   the actual reconciliation math + worker claim logic
    auditLogService.js         record() / recordSafely() - see §5
    authService.js             login, lockout, reCAPTCHA - see §6
  jobs/reconciliationWorker.js the poll loop + the fire-and-forget nudge
  middleware/rateLimit.js      per-IP login throttle
  utils/recaptcha.js           Google reCAPTCHA v3 verification (no-op until configured)
  routes/v1/                   thin HTTP layer, no business logic
    auditLogRoute.js           GET /audit-logs (manager or admin)
    userRoute.js                /users/staff (manager) + full user CRUD (admin)
  validators/                  Joi schemas, called directly (not as middleware)
  exceptions/                  ClientError hierarchy → one central error handler
                                (LockedError = 423, for a locked account)
  tests/auditSession.flow.test.js  the lifecycle + idempotency tests
  tests/auditLog.test.js           login/product/session audit trail tests
  tests/security.test.js           lockout, admin CRUD, self-protection, recaptcha bypass

stock-opname-fe/
  app/pages/staff/...           one-batch count entry form
  app/pages/manager/...         product CRUD, session creation, review/approve/reject
  app/pages/admin/users/        create/list/change role/toggle active/unlock
  app/pages/audit-log/          system-wide log with a filter (manager + admin)
  app/composables/useRecaptcha.js
  app/components/ActivityTimeline.vue  reused on both staff & manager session detail pages
  app/stores/auth.js            Pinia store, holds the logged-in user (not the token)
  server/api/**                 the BFF layer described above
```

## 8. Questions you should be able to answer unprompted

- **"Why not just update stock synchronously in the approve request?"** → because a large
  session would make the endpoint slow, and the brief explicitly asks for background processing
  that doesn't block approval.
- **"Why Postgres polling instead of Redis/BullMQ?"** → one less moving part to run and explain
  for a take-home reviewer, while still genuinely exercising async processing, retry-safety, and
  safe concurrent workers via `SKIP LOCKED`. Trade-off: polling has a small latency floor (the
  poll interval) and doesn't scale to high job volume the way a real queue would — fine here,
  wouldn't be at production scale.
- **"What happens if the worker process is just... not running?"** → jobs sit `pending`
  forever, and the session stays `APPROVING`. There's no automatic paging/alerting on this in the
  MVP — that's a known gap, not an oversight (see PRD "Out of scope").
- **"Why does reconciliation add a delta instead of setting stock to the counted value?"** →
  because `expected_qty` is a snapshot from initiation time; if something else changed the
  product's stock between snapshot and approval, overwriting with the counted value would
  silently discard that other change.
- **"Why full-coverage-required for count submission instead of partial?"** → my call, documented
  as an assumption in PRD §8 — a stock opname with silently-skipped items is a bigger risk than
  the inconvenience of requiring everything counted.
- **"Why two separate audit tables instead of one?"** → `stock_adjustment_logs` has a strict,
  narrow shape (previous/change/new quantity) required by the brief for inventory changes
  specifically; `audit_logs` is a general activity log for everything else (logins, master-data
  edits, lifecycle transitions). Merging them would mean either bloating the inventory ledger
  with unrelated columns, or losing the numeric-diff guarantee on the one table the brief
  actually asks for.
- **"Why lock the account for 15 minutes instead of forever, or just rate-limiting?"** →
  time-boxed lockout is self-healing (no admin needed for the common "forgot my password and
  fat-fingered it 3 times" case) while still meaningfully slowing down a real attacker; an admin
  can still shorten it via unlock for the case where it *is* the legitimate user and they don't
  want to wait.
- **"Walk me through a bug you actually hit while building this."** → good one to have ready:
  the login rate limiter's test-mode override (`NODE_ENV === 'test' ? 1000 : ...`) looked right
  but never fired, because it was written as `Number(process.env.LOGIN_RATE_LIMIT_MAX) ||
  DEFAULT_MAX` - and `.env` always sets `LOGIN_RATE_LIMIT_MAX=10` for dev, so that explicit value
  won the `||` every time regardless of `NODE_ENV`. The test suite started tripping its own rate
  limiter around test #7. Fix: check `NODE_ENV` *first*, before ever consulting the configured
  value, in `middleware/rateLimit.js`. Small bug, but a good example of `||`-chain precedence
  silently defeating an environment override.
- **"Have you containerized this?"** → yes, root `docker-compose.yml` runs the whole stack
  (Postgres → a one-shot `migrate` service that runs migrations + the seeder → the API, the
  worker, and the frontend). Two more real bugs surfaced only by actually running this
  end-to-end in Docker, worth having ready as a second "bug I found" story: (1) the demo seeder
  wasn't idempotent - sequelize-cli tracks *migrations* as applied but does **not** track
  *seeders* the same way, so re-running `docker compose up` against an already-seeded volume hit
  a unique-constraint error on the admin user's email; fixed by checking for that row first. (2)
  The reCAPTCHA test assumed `.env`'s secret key would always be empty, which broke the moment a
  real key got added there for local dev - fixed by making `NODE_ENV=test` always bypass
  verification regardless of what's actually in the (shared) `.env` file.

## 9. If you want to extend it live in an interview

Cheapest, most impressive next additions, roughly in order of effort:
1. CSV bulk upload for staff counts (explicitly suggested in the brief) — parse into the same
   `{ items: [{ productId, countedQty }] }` shape the API already accepts.
2. A manager-facing "retry reconciliation" action for a session whose job is `failed`.
3. Pagination/filtering on the sessions list once there are enough of them to matter.
