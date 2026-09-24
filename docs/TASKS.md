# Task Plan

Reference: [PRD.md](./PRD.md). Folders: `stock-opname-be/`, `stock-opname-fe/` (siblings of
`be/`/`fe/` reference, which stay untouched).

## Phase 0 — Docs
- [x] PRD.md
- [x] TASKS.md
- [x] ONBOARDING.md

## Phase 1 — Backend scaffold
- [x] `package.json`, `.env.example`, ESLint config, Sequelize config (Postgres dialect)
- [x] `docker-compose.yml` with just a `postgres` service (so the reviewer needs zero manual DB setup)
- [x] Error classes (`ClientError` hierarchy) + central error middleware + response envelope helper
- [x] Logger (winston, matching reference style but trimmed)

## Phase 2 — Data layer
- [x] Migrations: users, products, audit_sessions, audit_session_items, reconciliation_jobs,
      stock_adjustment_logs, session_events
- [x] Sequelize models + associations
- [x] Seeder: 1 manager, 2 staff, 8 demo products

## Phase 3 — Auth
- [x] JWT issue/verify util, bcrypt password hashing
- [x] `POST /v1/auth/login`, `GET /v1/auth/me`
- [x] `requireAuth` / `requireRole` middleware

## Phase 4 — Products
- [x] Product repository + validators
- [x] `GET /v1/products`, `POST /v1/products`, `PATCH /v1/products/:id`
- [x] `GET /v1/users/staff` (added mid-build: the "assign to" picker needs it)

## Phase 5 — Audit session core (the heart of the assessment)
- [x] Initiate: snapshot expected_qty for chosen products, assign staff
- [x] List (role-scoped) + detail (with items/variances)
- [x] Count submission: transactional batch upsert, full-coverage + duplicate validation
- [x] Approve: transactional fast-path enqueue (state check + idempotent retry + unique job)
- [x] Reject: note required, terminal state
- [x] Reconciliation worker: polling loop, `FOR UPDATE SKIP LOCKED`, per-item `applied_at`
      idempotency, stock delta application, audit log rows, failure handling, stale-job requeue
- [x] Session event log writes on each lifecycle transition

## Phase 6 — Backend tests
- [x] Integration (supertest): login → initiate → submit counts → approve → poll until APPROVED → assert stock + audit log
- [x] Test: calling approve twice concurrently only ever produces one job / one set of adjustments
- [x] Test: duplicate product id in a batch rejected, missing coverage rejected, wrong-staff forbidden
- [x] `npm test` green (5/5)

## Phase 7 — Frontend scaffold
- [x] Nuxt app, Tailwind/@nuxt/ui, Pinia, ESLint config
- [x] `server/api/**` BFF routes mirroring the backend surface, cookie-based token relay
- [x] Auth store + route middleware (role-based redirect/guard)

## Phase 8 — Frontend screens
- [x] `/login`
- [x] Staff: sessions list, session detail with single-batch count form
- [x] Manager: products CRUD, sessions list + create-session flow, session detail with variance
      table + approve/reject actions
- [x] Shared: status badges, toasts/error handling, loading/empty states

## Phase 9 — End-to-end verification
- [x] Ran both apps together in a real browser, walked the full happy path (initiate → count →
      approve with a discrepancy → auto-poll to APPROVED → stock confirmed updated)
- [x] Walked the retry-safety path: fired two concurrent approve requests, confirmed one job /
      one adjustment (both via Jest and manually)
- [x] Walked the rejection path (submit exact counts → reject with a note → stock unchanged)
- [x] Checked mobile viewport (375px) — layout holds up

## Phase 10 — Submission docs
- [x] Root `README.md`: stacks used, how to run (docker-compose for DB, migrate/seed, dev
      servers for both apps), demo credentials
- [x] `NOTES.md` — drafted as talking points only; **rewrite this in your own words** before
      submitting, since the brief explicitly requires it not be AI-generated and a recruiter may
      ask about it directly
- [x] `docs/ONBOARDING.md` — walkthrough for the user to actually understand the flow end to end

## Phase 11 — General audit log (added after the initial submission was already working)
- [x] `audit_logs` table: polymorphic (`entity_type`/`entity_id`), superseding the earlier
      session-only `session_events` table
- [x] `services/auditLogService.js`: `record` (participates in a transaction) vs `recordSafely`
      (standalone, swallows its own errors so logging can never break the feature it observes)
- [x] Instrumented: login success/failure (with a reason, and the attempted email even when the
      account doesn't exist), product create/update (with a before/after snapshot), and every
      audit-session lifecycle transition
- [x] `GET /v1/audit-logs` (manager-only, filterable by action/entityType/entityId/actorId)
- [x] Audit session detail response includes its own slice of the log as `auditLogs`
- [x] Frontend: manager nav bar (was missing entirely - Products and Audit Log had no way to
      navigate to them before this), `/manager/audit-log` list + filter, activity timeline
      component reused on both the manager and staff session detail pages
- [x] 6 new backend tests covering login audit, product audit, the session activity trail, and
      the manager-only access control on the new endpoint (11/11 total passing)

## Phase 12 — Login security & admin role (added after Phase 11)
- [x] `express-rate-limit` on `POST /auth/login` (per-IP), test-mode default relaxed so the
      suite itself doesn't trip it — fixed one real bug where the `.env` value always won over
      the test override due to `||` precedence
- [x] Per-account lockout: `failed_login_attempts` + `locked_until` on `users`, atomic
      `increment()` + reload, 3 wrong passwords → locked (both configurable via env)
- [x] `LockedError` (423) distinct from generic 401, with the lockout window disclosed to the
      caller (`docs/PRD.md` §9 explains the information-leak trade-off behind that choice)
- [x] `admin` role added to the Postgres enum via `ALTER TYPE ... ADD VALUE`
- [x] `utils/recaptcha.js` (backend) / `useRecaptcha.js` (frontend): Google reCAPTCHA v3, both
      sides no-op until real keys are set, verified via the test suite passing with no key
      configured
- [x] Admin user management: `GET/POST /users`, `PATCH /users/:id`, `POST /users/:id/unlock`,
      with a server-side guard stopping an admin from demoting/deactivating their own account
- [x] `GET /audit-logs` opened up to `admin` as well as `manager`
- [x] Frontend: `/admin/users` (create/list/change role/toggle active/unlock), admin nav,
      `/audit-log` relocated to a role-neutral path so both managers and admins can reach it
      without fighting the `/manager`-prefix route guard
- [x] 7 new backend tests (lockout → unlock → relogin, counter reset on success, admin CRUD,
      non-admin forbidden, self-demotion blocked, recaptcha bypass) — 18/18 total passing
- [x] Manually verified via curl: 3-strikes lockout, admin unlock, and the rate limiter actually
      returning 429 once its quota is spent

## Phase 13 — Full containerization (added after Phase 12)
- [x] `stock-opname-be/Dockerfile` (single image reused for the API, the worker, and a one-shot
      `migrate` service via different `command:` overrides - not three separate images)
- [x] `stock-opname-fe/Dockerfile` (multi-stage: `npm run build` in a build stage, only
      `.output/` copied into the runtime stage)
- [x] Root `docker-compose.yml`: Postgres (with a healthcheck) → `migrate` (runs migrations +
      seeder, must exit 0 before anything else starts) → `backend` + `worker` + `frontend`
- [x] Frontend container is configured via Nuxt's own runtime-env-override convention
      (`NUXT_API_BASE_URL`, `NUXT_PUBLIC_RECAPTCHA_SITE_KEY`) so the same built image can point
      at a different backend without a rebuild
- [x] Found & fixed two real bugs while testing this end to end:
      1. The demo-data seeder wasn't idempotent - sequelize-cli doesn't track which seeders
         already ran the way it tracks migrations, so re-running `docker compose up` against an
         already-seeded volume threw a unique-constraint error. Fixed by checking for the admin
         user before inserting anything.
      2. The test suite assumed `RECAPTCHA_SECRET_KEY` would always be empty in `.env`, which
         broke the moment a real key was added for local dev convenience. Fixed
         `utils/recaptcha.js` to always bypass in `NODE_ENV=test`, regardless of what's in the
         (shared) `.env` file - tests shouldn't depend on a live call to Google's API either way.
- [x] Full stack manually verified running end to end purely via `docker compose up --build`:
      login through the containerized frontend → containerized backend → containerized Postgres,
      and a second `up` cycle against the same volume confirmed idempotent

## Bonus (not done — flagged, not forgotten)
- [ ] CSV bulk upload for staff counts (explicitly suggested in the brief; the count-submission
      endpoint already accepts the exact shape a parsed CSV would produce, so this is additive,
      not a rework)
- [ ] Manager-facing "retry reconciliation" action for a permanently-`failed` job
