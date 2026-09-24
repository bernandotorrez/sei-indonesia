# Stock Opname & Async Inventory Reconciliation

Take-home technical assessment submission. See [docs/PRD.md](docs/PRD.md) for the full product
spec and design rationale, [NOTES.md](NOTES.md) for the required implementation notes, and
**[RUNNING-GUIDE.md](RUNNING-GUIDE.md) for a step-by-step guide to running the app** (this file
covers the same ground more briefly).

## Stack

- **Backend** (`stock-opname-be/`): Node.js, Express, PostgreSQL, Sequelize, JWT auth, Joi
  validation, Jest + Supertest.
- **Frontend** (`stock-opname-fe/`): Nuxt 4, `@nuxt/ui` (Tailwind-based), Pinia, with Nuxt
  server routes acting as a BFF (backend-for-frontend) proxy to the Express API.
- **Async reconciliation**: a Postgres-backed job table (`reconciliation_jobs`) polled by a
  worker process — no Redis/BullMQ needed to run this locally. See PRD §5 for why.

The brief's core ask is covered end to end (see [docs/PRD.md](docs/PRD.md) §1–§8). On top of
that, five things were added afterwards, on request. They're summarized here and explained in
full in the section right below; the "why" behind each design choice lives in
[docs/PRD.md](docs/PRD.md) §9 and the deep-dive walkthrough is in
[docs/ONBOARDING.md](docs/ONBOARDING.md) §5–§6.

## Additional features (beyond the original brief)

### 1. General audit log

Separate from `stock_adjustment_logs` (the brief's required inventory ledger), a system-wide
`audit_logs` table answers "who did what, when" for the whole app: every login attempt
(success **and** failure, with a reason), every product created or edited (with a before/after
snapshot of what changed), every user-management action, and every step an audit session moves
through (initiated → counts submitted → approval requested → approved/rejected). It shows up in
two places in the UI:
- **`/audit-log`** — the full log, filterable by action, open to managers and admins.
- **The "Activity" panel** on a session's detail page — just that session's slice of the log,
  as a timeline.

`entity_type` + `entity_id` on each row is a polymorphic pointer (it can reference a `User`, a
`Product`, or an `AuditSession` from the same table) instead of needing a separate log table per
entity type.

### 2. Login rate limiting

`POST /v1/auth/login` is throttled per client IP — by default, 10 attempts per 15-minute window,
after which further attempts get an immediate `429 Too Many Requests` without even touching the
database. This is aimed at one specific attack shape: someone spraying many different email
addresses from one source, trying to find *any* valid account. It's intentionally independent
from the account lockout below, which covers the opposite shape (many passwords, one account).
Both limits are configurable via `.env` (`LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MS`)
and are relaxed automatically in test mode so the test suite's own many logins don't trip it.

### 3. Account lockout (3 strikes)

Independent of the IP-based rate limit above, each **account** tracks its own failed-login
count. After 3 wrong passwords in a row (`ACCOUNT_LOCKOUT_MAX_ATTEMPTS`), that account is locked
for 15 minutes (`ACCOUNT_LOCKOUT_MINUTES`) — even if the correct password is entered while
locked, or if the attempts are coming from ten different IP addresses. The API returns a
distinct `423 Locked` status (not the generic 401) and tells the caller when the lock clears, so
a legitimate employee who mistyped their password isn't left guessing what happened. A manager
can't clear this — only an **admin** can, via the Users page or `POST /users/:id/unlock`, which
resets the counter immediately.

### 4. Admin role & user management

A fourth role, `admin`, was added specifically to manage *accounts* — it does not gain any of
the manager's product/session capabilities, since "who can administer user accounts" is a
different concern from "who runs warehouse operations." From `/admin/users` an admin can:
- Create a new user (name, email, password, role).
- Change anyone's role, or activate/deactivate their account.
- Unlock an account that's currently locked out.

One safeguard worth calling out: an admin **cannot** change their own role or deactivate their
own account (enforced on the server, not just hidden in the UI) — otherwise a single mistaken
click could lock every admin out of the system with nobody left able to fix it.

### 5. Google reCAPTCHA v3

The login form is wired up for reCAPTCHA v3, end to end, but it's **inert by default** — both
the backend check (`utils/recaptcha.js`) and the frontend widget (`useRecaptcha.js`) silently
skip verification when no key is configured, which is why it doesn't get in the way of local
development or the automated tests. Dropping a real site key and secret key into the two `.env`
files (see "Enabling reCAPTCHA v3" below) turns it on with **no code changes**: the frontend
starts generating a token on every login attempt, and the backend starts checking that token
against Google's API and rejecting anything below the configured score threshold
(`RECAPTCHA_MIN_SCORE`, default 0.5).

## Prerequisites

- Docker — for **Option A** (everything containerized), or just for Postgres if you use Option B
- Node.js 18+ — only needed for **Option B** (running the apps directly)

There are two ways to run this. Pick one — they bind the same host ports (3000, 4000, 5432), so
don't run both at once.

## Option A: everything in Docker (fastest to try)

One command starts Postgres, runs migrations + the seeder, and starts the API, the
reconciliation worker, and the frontend — no local Node.js install needed at all.

```bash
cp .env.example .env       # optional: fill in JWT_SECRET / reCAPTCHA keys, see below
docker compose up --build
```

Then open **http://localhost:3000** and log in with any account from the table below. Re-running
`docker compose up` against the same volume is safe — migrations and the seeder are both
idempotent (re-running the seeder skips inserting demo data that's already there instead of
erroring).

To stop everything: `docker compose down` (add `-v` to also wipe the database volume). Logs for
a single service: `docker compose logs -f backend` (or `worker` / `frontend` / `postgres`).

## Option B: run each app directly with npm (more control, faster iteration)

### 1. Backend

```bash
cd stock-opname-be
cp .env.example .env
npm install
docker compose up -d      # starts just Postgres, on localhost:5432
npm run migrate
npm run seed               # creates demo users + products
npm run dev                 # API on http://localhost:4000
```

In a **second terminal**, start the reconciliation worker:

```bash
cd stock-opname-be
npm run worker:dev
```

The API also nudges the worker immediately after every approval (best-effort, non-blocking),
so in practice reconciliation happens within milliseconds — the standalone worker's polling
loop is what guarantees it eventually runs even if that nudge is missed (a crash, restart,
etc).

Run the backend test suite:

```bash
npm test
```

### 2. Frontend

```bash
cd stock-opname-fe
cp .env.example .env       # points at http://localhost:4000/v1 by default
npm install
npm run dev                 # app on http://localhost:3000
```

### Demo accounts (from the seeder — same for both options)

| Role | Email | Password |
|---|---|---|
| Admin | admin@stockopname.test | password123 |
| Manager | manager@stockopname.test | password123 |
| Staff | staff1@stockopname.test | password123 |
| Staff | staff2@stockopname.test | password123 |

Log in with any of them. Each role lands somewhere different (admin → user management, manager
→ sessions dashboard, staff → assigned-sessions list) with visibly different navigation and
capabilities.

## Enabling reCAPTCHA v3 (optional, either option)

Login works fine without this — it's a no-op on both ends until configured. To turn it on, get
a v3 site/secret key pair at https://www.google.com/recaptcha/admin, then set:

**Option A (Docker):** in the root `.env` —
```bash
RECAPTCHA_SECRET_KEY=your-secret-key
NUXT_PUBLIC_RECAPTCHA_SITE_KEY=your-site-key
```
then `docker compose up --build` again (the frontend needs a rebuild since its `.env` values are
baked into the image at build time; the backend picks up its own `.env` change on a plain
restart, no rebuild needed).

**Option B (npm):**
```bash
# stock-opname-be/.env
RECAPTCHA_SECRET_KEY=your-secret-key

# stock-opname-fe/.env
NUXT_PUBLIC_RECAPTCHA_SITE_KEY=your-site-key
```
then restart both dev servers.

Either way, no code changes are needed — the backend starts verifying the token Google's API
returns, and the frontend starts loading the widget and attaching a token to every login
request.

### Login security knobs (all optional, all have sane defaults)

| Env var (backend) | Default | What it controls |
|---|---|---|
| `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_MS` | 10 / 15 min | Per-IP login attempts before a 429 |
| `ACCOUNT_LOCKOUT_MAX_ATTEMPTS` | 3 | Wrong passwords in a row before an account locks |
| `ACCOUNT_LOCKOUT_MINUTES` | 15 | How long a lockout lasts (or until an admin unlocks it) |
| `RECAPTCHA_MIN_SCORE` | 0.5 | Minimum v3 score to accept (only relevant once a key is set) |

## Project layout

```
docker-compose.yml    Option A: the whole stack (Postgres + API + worker + frontend)
stock-opname-be/    Express API, migrations, jobs/worker, tests, its own Dockerfile
stock-opname-fe/     Nuxt app (app/) + BFF server routes (server/api/), its own Dockerfile
docs/PRD.md           Product spec, data model, lifecycle, API surface, assumptions
docs/TASKS.md         Build task list this was implemented against
docs/ONBOARDING.md    Deep-dive walkthrough + likely interview questions, written for you to study
NOTES.md              Required implementation notes (see brief §4)
```

## A note on this repository

`fe/` and `be/` (if present alongside this README) are **unrelated reference projects** used
only to match an existing team's code style during development — they are not part of this
submission and should not be published. Same for the assessment PDF itself; it's excluded via
`.gitignore` since it isn't mine to redistribute publicly.
