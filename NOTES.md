> **Draft — rewrite this in your own words before submitting.** The brief is explicit that this
> file must not be AI-generated and that recruiters may ask about it directly. Everything below
> is factually accurate to the implementation, but it's written as talking points for you to
> read, verify against the actual code, and then re-write yourself in your own voice. Delete
> this note once you've done that.
>
> Update: after this draft was written, a general `audit_logs` system was added (login
> success/failure, product master-data changes, session lifecycle timeline — see
> [docs/ONBOARDING.md](docs/ONBOARDING.md) §5), and then login security hardening on top of that
> (rate limiting, 3-strikes account lockout, reCAPTCHA v3, an `admin` role for user management —
> see ONBOARDING §6). Either of those is a strong alternative answer for question 4 — your call
> which one you'd rather talk about; you don't need to mention all three.

## 1. From "Approve" click to stock update

1. Manager clicks Approve on a `SUBMITTED` session → frontend calls
   `POST /v1/audit-sessions/:id/approve`.
2. The route hands off to `auditSessionService.approveSession`
   ([services/auditSessionService.js](stock-opname-be/services/auditSessionService.js)), which
   opens one DB transaction: locks the session row (`SELECT ... FOR UPDATE`), checks its status
   is `SUBMITTED`, inserts one `reconciliation_jobs` row, flips the session to `APPROVING`, and
   commits. That's the entire synchronous path — no per-item math happens here, which is what
   keeps the endpoint fast regardless of how many items are in the session.
3. The response goes back to the manager immediately (202, session now `APPROVING`). Separately,
   a fire-and-forget `nudgeWorker()` call is made — it doesn't block the response.
4. The actual reconciliation runs in `reconciliationService.processPendingJobs` — either because
   the nudge triggered it in the same process, or because the standalone worker process
   (`npm run worker`) polled and found the pending job. It claims the job with
   `SELECT ... FOR UPDATE SKIP LOCKED` (so two workers can't grab the same job), then in one
   transaction: for every item that hasn't been applied yet (`applied_at IS NULL`), computes
   `counted_qty - expected_qty`, adds that delta to the **current** `product.on_hand_qty`,
   writes a `stock_adjustment_logs` row, marks the item applied, then flips the session to
   `APPROVED` and the job to `completed`.
5. The frontend polls the session every 1.5s while it's `APPROVING` and shows "Reconciled" once
   it flips.

What could go wrong, and what I did about it, at each step:

- **Manager double-clicks Approve, or the request times out and the client retries.** Handled at
  step 2: if the session is already `APPROVING` or `APPROVED`, `approveSession` returns the
  current state instead of erroring or creating a second job. The `reconciliation_jobs` table
  also has a unique constraint on `audit_session_id`, so even a race between two concurrent
  requests can't create two jobs — whichever loses the race just falls through to the idempotent
  path.
- **The worker crashes mid-reconciliation (some items applied, some not).** Because the whole
  reconcile step is one transaction, a crash before commit rolls back everything from that
  attempt — no half-applied session is ever visible. On retry, `applied_at IS NULL` means only
  the not-yet-applied items are touched again.
- **The worker crashes between claiming the job (marking it `processing`) and finishing it,** so
  the transaction that would have flipped it back never runs. That would leave a job stuck in
  `processing` forever. `requeueStaleJobs()` sweeps jobs stuck in `processing` for over a minute
  back to `pending` (or to `failed` after 5 attempts, so a permanently broken job doesn't retry
  forever and silently spin).
- **A bug somehow calls the reconcile logic twice for the same item anyway.** The
  `stock_adjustment_logs` table has a unique constraint on `audit_session_item_id`, so a second
  insert attempt for the same item fails and is caught/ignored rather than double-adjusting
  stock. This is a deliberate second layer under the `applied_at` check, not a replacement for
  it.
- **The referenced session or product disappears between claiming and processing the job (it
  shouldn't, given the FK constraints, but).** The job is marked `failed` with the error message
  recorded in `last_error` rather than crashing the whole worker loop.

## 2. An assumption I made

The brief says staff "submit physical counts for the items in an audit session as a single
batch" but doesn't say whether every item needs a count to submit, or whether a partial batch is
allowed. I assumed **full coverage is required** — you can't submit until every item in the
session has a counted quantity — and the API returns a 400 listing exactly which SKUs are
missing if you try. My reasoning: a stock opname where some items were silently never counted is
a data integrity problem for a warehouse audit, and it's easy for a manager to misread "3 of 5
items counted" as "the audit is done." I'd rather force an explicit decision (count everything,
or don't submit yet) than guess at partial data. This is documented in
[docs/PRD.md](docs/PRD.md) §8 along with a few other assumptions I made the same way.

## 3. Edge cases I thought about

- Duplicate `productId` entries in the same count-submission batch → rejected with a 400 rather
  than silently taking the last value (ambiguous client input shouldn't be resolved silently on
  the server).
- A staff member trying to submit counts for a session assigned to someone else → 403, checked
  against `assigned_staff_id`, not just "any staff role."
- Submitting counts twice, or after the session already moved past `OPEN` → 409, since counts
  can only be submitted while `OPEN`.
- Approving/rejecting a session that isn't `SUBMITTED` → 409 (except the idempotent
  already-approved/approving case described above).
- Calling Approve concurrently from two tabs (tested explicitly in
  [tests/auditSession.flow.test.js](stock-opname-be/tests/auditSession.flow.test.js)) → exactly
  one job, one set of stock adjustments.
- Stock moving between snapshot and approval for an unrelated reason → reconciliation adds a
  *delta* to whatever the current stock is, instead of overwriting it with the counted value, so
  it doesn't clobber an unrelated change that happened in between.

## 4. One thing I added that I think matters

The per-item `applied_at` idempotency marker on `audit_session_items`, on top of (not instead
of) the job-level status machine. It would have been easy to make the job itself the only unit
of retry-safety ("has this job run before? then don't run it again"), but that only protects
against re-running a *completed* job — it doesn't protect against a *partially applied* job being
retried after a crash, which is the failure mode that actually matters for an operation that
touches N rows in a loop. Making each item independently idempotent means the reconciliation is
safe to retry at any granularity, not just "whole job succeeded or whole job never started."
