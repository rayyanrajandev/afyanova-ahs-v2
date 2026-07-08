# Canonical Encounter State — Validation & Rollout Execution Plan

**Document type**: Execution plan (not design theory). Every step below is either already executed with recorded results (this session), or a concrete, runnable next action.
**Status as of this document**: Shadow Mode is **disabled** (`shadow_mode_enabled` defaults to `false`). It was not enabled at any point while producing this plan. No production code was modified in this session — only test files were added, and one earlier session's readiness-report findings are carried forward as fact, not re-asserted from design intent.

---

## 0. Critical finding from this session — read before anything else

While building the multi-order validation test (§1.2), direct measurement showed:

> Calling `GetEncounterCloseReadinessUseCase::execute()` alone, against an encounter with 48 completed clinical orders, issued **~91 SQL queries** — traced to `ListBillingChargeCaptureCandidatesUseCase` (Billing module), including a repeated `pg_catalog`/`information_schema`-style column-introspection query pattern against `billing_service_catalog_items`. This is **pre-existing behavior**, not something introduced by the Canonical resolver — it already runs once per real production workspace page load today, with or without Shadow Mode, because `GetEncounterWorkspaceUseCase` already calls this same use case.
>
> The Canonical resolver adds a **measured ~7 additional queries** on top of that baseline (verified in §1.2). That incremental cost is small and bounded regardless of order volume.
>
> **Consequence for rollout**: enabling Shadow Mode on the workspace endpoint means this ~91-query cost is paid **a second time** in the same request (once by the existing `GetEncounterWorkspaceUseCase`, once more by the Canonical resolver's own call to the same use case), for any encounter with meaningful order volume. This is the single most important fact this validation phase produced, and it must directly inform the rollout sequencing in §3 and the rollback triggers in §3.4.

This finding is carried into every later section rather than restated as a caveat.

---

## 1. Minimal validation suite — status: implemented and passing

All three requested categories are now real, executable Pest tests. No production code was touched to build them. Current result, run in this session:

```
Tests\Feature\CanonicalEncounterState\CanonicalEncounterStateResolverTest            5 passed
Tests\Feature\CanonicalEncounterState\CanonicalEncounterStateValidationSuiteTest      9 passed
Tests\Feature\Encounter\EncounterWorkspacePageTest                                   4 passed  (regression check)
Tests\Feature\Encounter\EncounterClinicalDocumentApiTest                             3 passed  (regression check)
Total: 21 passed, 86 assertions, 0 failures
```

Command to reproduce: `php artisan test tests/Feature/Encounter/ tests/Feature/CanonicalEncounterState/`

### 1.1 CONFLICT-09 correctness with real audit-log patterns

File: `tests/Feature/CanonicalEncounterState/CanonicalEncounterStateValidationSuiteTest.php`

- `it detects CONFLICT-09 when the latest audit entry was driven only by the note-sync side channel` — seeds a real `encounter_audit_logs` row via `EncounterAuditLogRepositoryInterface::write()` with `metadata.source = 'medical_record_status'`, asserts the code fires.
- `it does not flag CONFLICT-09 when the latest audit entry was an explicit user-initiated action` — same setup, `metadata.source = 'explicit_user_action'`, asserts it does **not** fire.
- `it does not flag CONFLICT-09 for legacy statuses outside the signed/amended/in_progress set` — confirms the status-scoping guard.

**Known residual gap, disclosed, not fixed here**: only two `metadata.source` values have been exercised (`medical_record_status`, `explicit_user_action`). Real production audit logs may contain other `source` values not yet enumerated by this resolver's authors — this test does not prove exhaustive coverage of every real-world source string, only the two the resolver's own code explicitly checks for.

### 1.2 Multi-order encounter correctness (high-volume simulation)

- `it resolves a high-volume multi-module order encounter correctly within a bounded query count` — 25 lab + 15 radiology + 10 pharmacy (incl. one `reconciliation_exception`) + 8 theatre = 58 order rows on one encounter. Asserts: `ordersDimension === EXCEPTION` (correct priority), `CONFLICT-08` fires, and — per the finding in §0 — asserts the resolver's own **incremental** query count (full run minus an isolated `GetEncounterCloseReadinessUseCase`-alone run) is `≤ 15`. Measured actual delta: ~7.
- `it resolves a high-volume encounter with zero pending orders as RESULTED (not PENDING/EXCEPTION)` — 30 completed lab orders, asserts `ordersDimension === RESULTED` and the matched rule is one of `RULE-7`/`RULE-8` (deliberately not asserting which, since that depends on Billing's own determination, out of this resolver's scope).

### 1.3 Multi-note encounter correctness (CONFLICT-03 scenarios)

- `it detects CONFLICT-03 when some but not all consultation notes for an encounter are signed` — one finalized + one draft note → fires.
- `it does not flag CONFLICT-03 when every consultation note for the encounter is signed` — one finalized + one amended → does not fire.
- `it does not flag CONFLICT-03 when every consultation note for the encounter is still draft` — two drafts → does not fire.
- `it ignores archived notes when evaluating CONFLICT-03` — one finalized + one archived → does not fire (archived notes excluded from the set entirely, matching the mapping layer's definition).

---

## 2. Production-like staging simulation plan

### 2.1 What already exists vs. what does not (stated explicitly, per constraint)

- **No seeder, factory set, or synthetic-data-generation command exists in this codebase for Encounter/MedicalRecord/order volume simulation.** Confirmed: `database/factories/` contains only a `UserFactory`; no `EncounterFactory`, `MedicalRecordFactory`, or order-model factories were found. Every test in this codebase (including the ones written in §1) constructs fixtures via direct `Model::query()->create([...])` calls.
- **No percentage-based or canary feature-flag system exists.** `config/canonical_encounter_state.php` exposes exactly one boolean. There is no infrastructure here for "enable for 5% of requests" — that would have to be built, and building it is out of scope for this plan (validation + rollout safety only, no new systems).
- **No APM/query-tracing tool integration was found or assumed.** The performance evidence in §0/§1.2 was produced with Laravel's own `DB::enableQueryLog()`, which works in any environment without additional tooling.

Given the above, the simulation plan below uses only tools already proven to work in this session: direct Eloquent fixture construction and `DB::enableQueryLog()`/wall-clock timing.

### 2.2 Minimal staging dataset generation approach

Because no seeder exists, the **minimal, no-redesign** approach is a one-off script — structurally identical to the throwaway diagnostic scripts used in this session (`storage/app/_*.php`, created, run via `php artisan tinker --execute="require base_path(...)"`, and deleted immediately after) — run **only in staging**, never committed as a permanent file:

1. Create N patients (`PatientModel::query()->create([...])`, same shape as `validationSuitePatient()` in the test file).
2. For each patient, create 1 encounter (`EncounterModel::query()->create([...])`).
3. For a defined mix of encounters, attach: 1 consultation note (some `draft`, some `finalized`, a small percentage with 2+ notes to exercise CONFLICT-03 organically), and a realistic order distribution across Laboratory/Radiology/Pharmacy/Theatre (including a small percentage of `reconciliation_exception` pharmacy rows).
4. Record every generated encounter's ID to a flat file for later targeted testing (§3.2 sampling).

This is explicitly a **throwaway data-generation script**, not a new permanent artisan command — consistent with "no redesign."

### 2.3 Dataset size required to trust results

Recommended minimum, based on what this session's testing already covered and what it did not:

| Dimension | Minimum for a trustworthy signal | Why |
|---|---|---|
| Distinct encounters exercised | **≥ 200** | Large enough to see CONFLICT rates that are rare-but-real (e.g., CONFLICT-05 duplicate encounters, CONFLICT-09) rather than only the common ones already proven in §1 |
| Encounters with > 20 total orders | **≥ 20** of the above 200 | This session only measured the query-cost finding (§0) at exactly one order-volume point (48 orders on one encounter); staging should confirm the pattern holds (or find it doesn't) across a spread, e.g. 10, 30, 60, 100 orders |
| Encounters with 2+ consultation notes | **≥ 10** of the above 200 | To see CONFLICT-03/CONFLICT-07 rates on organically-created (not hand-crafted) data |
| Encounters in `closed` status with orders/billing state varied | **≥ 20** of the above 200 | To observe real CONFLICT-01/CONFLICT-06 rates, which the earlier critical-integrity review predicted should exist in real data |
| Observation window once Shadow Mode is on (§3) | **≥ 3 business days** or **≥ 500 workspace-endpoint hits**, whichever comes first | Long enough to catch anything time-dependent (e.g., day-boundary log rotation, end-of-shift close-out batches) without being an open-ended commitment |

These numbers are proposed defaults for you to confirm or adjust against your own staging traffic patterns — they are not derived from any measured staging data, since none has been generated yet.

---

## 3. Safe Shadow Mode rollout steps — locked sequence, staging only

**Do not execute any step below yet.** This is the sequence to follow when you decide to proceed; no step in this section has been performed.

### 3.1 Pre-activation checklist (must all be true before Step 1)

- [ ] All 21 tests in §1 still pass on the exact commit about to be deployed to staging (re-run, don't assume yesterday's result holds).
- [ ] `.env` (or equivalent staging config) confirmed to **not** set `CANONICAL_ENCOUNTER_SHADOW_MODE_ENABLED` yet — i.e., staging starts this sequence in Mode A, same as production.
- [ ] Confirm `storage/logs/` is writable and has rotation/retention configured consistently with the `canonical_encounter_shadow` channel's `days` setting (`config/logging.php`) so the log doesn't grow unbounded.
- [ ] Confirm who will manually review the log file during the observation window (this plan assumes manual review — no alerting exists yet, per §2.1).

### 3.2 Step-by-step activation

1. **Deploy code with the flag still `false`.** Confirm via `php artisan tinker --execute="echo config('canonical_encounter_state.shadow_mode_enabled') ? 'ON' : 'OFF';"` that staging reports `OFF` immediately after deploy. This isolates "did the deploy work" from "did enabling the flag work" as two separate, individually-verifiable events.
2. **Generate the staging dataset** per §2.2, recording encounter IDs to a file (e.g., `staging_canonical_state_encounter_ids.txt`).
3. **Targeted dry run before broad enablement**: with the flag still `false`, manually call `CanonicalEncounterStateResolver::resolve()` (via `tinker`, looping over the recorded ID file) against every generated encounter, logging each snapshot to a **local file, not the shadow channel** (e.g., redirect to a temp path) — this validates the resolver against the full staging dataset with zero request-path exposure at all, before the flag is ever flipped. Review this output for any `INDETERMINATE` results or unexpected `partialFailures` entries.
4. **Enable the flag in staging only**: set `CANONICAL_ENCOUNTER_SHADOW_MODE_ENABLED=true` in the staging environment's config, and confirm via the same `tinker` one-liner from Step 1 that it now reports `ON`.
5. **Sampling strategy given no percentage-rollout mechanism exists** (per §2.1, this is a real constraint, not an oversight): since the flag is a single boolean with no per-request sampling, "sampling" at this stage means controlling *traffic*, not *code*, in one of two ways — pick one explicitly before proceeding:
   - **(a) Natural-traffic sampling**: leave it enabled in staging and let whatever QA/synthetic/real staging traffic already exists hit the workspace endpoint naturally. Simplest, but exposes every staging request to the extra cost from §0 for the full window.
   - **(b) Targeted-traffic sampling**: instead of leaving it on continuously, run a scheduled script that calls `GET /api/v1/encounters/{id}?view=workspace` only for the recorded ID list from Step 2, at a controlled rate (e.g., 1 request/second), during defined windows — bounding exposure to a known, curated set of encounters rather than all staging traffic.

   Recommendation: **(b)** first, for at least the first 24 hours, before moving to **(a)** for the remainder of the observation window — this lets you see the cost/behavior on data you already inspected in Step 3 before exposing it to unpredictable staging traffic.
6. **Observe** for the duration set in §2.3, reviewing the log per §3.3.
7. **Decide**: proceed to §4 (trust definition) only after the full observation window completes without triggering any condition in §3.4.

### 3.3 What to check in the log during the observation window

Concrete, tool-agnostic checks against `storage/logs/canonical_encounter_shadow-*.log` (daily-rotated, per `config/logging.php`):

- Count of `canonical_encounter_state.shadow_evaluation_failed` entries (from `CanonicalEncounterShadowLogger::logFailure()`) — **any non-zero count is worth investigating immediately**, since the resolver is designed to degrade dimensions to `UNKNOWN` internally rather than reach this path; reaching it means something failed even the resolver's own fail-closed handling.
- Distribution of `canonical_state` values across all logged entries — sanity-check against what you'd expect from the dataset generated in §2.2 (e.g., if you seeded zero `cancelled`-status encounters but see `CANCELLED` in the log, that's unexpected and worth investigating).
- Distribution of `detected_conflicts[].code` values — compare against the rates you observed in the local dry-run file from Step 3. A significant divergence between the dry-run (no request-path pressure) and the live-request numbers would suggest something request-context-dependent is affecting results, which the design does not anticipate.
- Any `partial_failures` entries — same urgency as the failure-log count above; this indicates a dimension degraded to `UNKNOWN` for a real request, which should not happen against a healthy staging database.

### 3.4 Rollback conditions — exact triggers to disable the flag

Disable immediately (`CANONICAL_ENCOUNTER_SHADOW_MODE_ENABLED=false`, redeploy/restart config cache) if **any** of the following is observed:

1. **Any entry in `canonical_encounter_shadow-*.log` with level `warning`** (i.e., any `shadow_evaluation_failed` entry) — this path should never be reached per the resolver's own fail-closed design; if it is, treat it as a signal the isolation guarantee itself may be compromised.
2. **Any application-level error log entry (outside the shadow channel) whose stack trace includes `App\Support\CanonicalEncounterState`** — the controller's try/catch should prevent this entirely; its occurrence means the isolation boundary failed.
3. **Measured p95 latency on `GET /api/v1/encounters/{id}?view=workspace` increases by more than 100% (2x) or by more than 500ms absolute, whichever is smaller, compared to a same-day baseline measured with the flag off.** This threshold is set deliberately low given the §0 finding (a second ~91-query Billing lookup is a real, expected latency cost — the question this trigger answers is whether that cost is *tolerable*, not whether it exists at all). Measure via simple repeated timed requests (e.g., `Measure-Command` in PowerShell or `time curl ...`) against the same encounter ID with the flag toggled, since no APM was found to already provide this.
4. **Any change in the JSON response body of the workspace endpoint** between flag-off and flag-on for the same encounter ID (byte-for-byte diff). This should be structurally impossible per the code (§0 of the readiness report confirmed the hook's return value is discarded), but is cheap to verify and should be checked at least once per staging session as a canary — any diff at all is an immediate rollback trigger and a signal the isolation contract itself is broken, not just underperforming.
5. **Database connection saturation or a measurable increase in DB error/timeout rate** in staging during the observation window, correlated with workspace-endpoint traffic.
6. **Log file growth rate makes `storage/logs/` disk usage a concern** before the configured 14-day rotation would naturally reclaim space (a purely operational trigger, independent of correctness).

Any one of these is sufficient on its own — do not wait for multiple conditions to co-occur before disabling.

---

## 4. Definition of "READY FOR MODE B TRUST"

"Trust" here means: confident enough in Shadow Mode's output to treat it as a reliable *manually-reviewed* signal (not yet an automated one — §2.1 confirmed no alerting pipeline exists, so "trust" cannot yet mean "trust an automated alert," only "trust what a human reads in the log"). All of the following must be true simultaneously — this is a conjunction, not a checklist to partially satisfy:

1. **All 21 tests in §1 pass**, on the commit actually deployed, immediately before and after the staging window.
2. **The full staging dataset from §2.3 has been generated and exercised**, both in the local dry-run (§3.2 Step 3) and via live requests (§3.2 Steps 5-6), with results compared between the two and no unexplained divergence.
3. **Zero rollback-trigger events** (§3.4) occurred during the entire observation window. If any occurred and were subsequently fixed, the window restarts from zero after the fix — a clean window is required, not a window with an explained exception in it.
4. **Every distinct CONFLICT code that fired during the window has been manually reviewed by an engineer** and attributed to one of: (a) a confirmed, expected instance of a real legacy condition already predicted by the earlier critical-integrity review (i.e., "this is the system doing exactly what we suspected it does"), or (b) a resolver logic question requiring further investigation before proceeding (in which case trust is **not** yet achieved). A code firing at a rate that looks like "every single encounter" (as anticipated for CONFLICT-09 in the earlier readiness report) is acceptable *only if* explicitly reviewed and consciously accepted as expected noise, not silently ignored.
5. **The §0 query-cost finding has been explicitly measured in staging** (not just in this local session) and a latency number is in hand — even if the decision is "this cost is acceptable," that decision must be made with a real staging-measured number, not the single local data point from this session.
6. **No `partial_failures` or `shadow_evaluation_failed` entries appear anywhere in the full observation window's logs** — zero, not "rare."
7. **A named person has read through a representative sample of the raw log output by hand** (not just aggregate counts) at least once, to catch anything a purely statistical check would miss.

Only once all seven hold simultaneously should Mode C (Advisory/UI visibility) or any further phase be considered — and that is a separate decision, out of scope for this plan, which covers validation and Shadow Mode rollout safety only.
