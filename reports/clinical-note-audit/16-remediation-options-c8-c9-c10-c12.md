# Remediation Options — C-8, C-9, C-10, C-12

**Document type**: Decision options, not a design spec and not implemented code. Each of these four findings (from `15-critical-system-integrity-review.md`) requires a product or clinical-workflow judgment call before any code should be written — implementing any option below unilaterally would mean an engineer inventing a UX or clinical-safety policy on a live system handling real patient data. This document lays out the real options and a recommendation; it does not decide.

For context: C-1 and C-16 were fixed directly in this pass because they were unambiguous bug fixes (a race condition and a missing guard, each with one clearly-correct answer). These four are different in kind — each has multiple defensible answers with real tradeoffs.

---

## C-8: Order-list display cap hides stale pending orders

**Current behavior**: `GetEncounterWorkspaceUseCase::CARE_ARTIFACT_LIMIT = 6` caps each order-type panel to the 6 most-recent rows, ordered newest-first. If more than 6 orders of one type exist for an encounter, older ones — which are exactly the ones most overdue for follow-up — silently drop off the visible panel while still counting toward the opaque close-readiness "N pending" badge.

| Option | What it does | Effort | Tradeoff |
|---|---|---|---|
| **A. Raise the cap** (e.g. 6 → 20) | One-line constant change | Trivial | Delays the problem, doesn't fix it — a sufficiently high-volume encounter still hits the wall |
| **B. Reorder by pending-first, not recency-first** | Show the 6 oldest/most-urgent *pending* orders before any completed ones fill the remaining slots | Small (change one query's ORDER BY / add a status-based sort key) | Directly targets the actual risk (invisible pending work) without a UI rebuild; completed orders become less visible, which is likely fine since they need no action |
| **C. Add a "+N more pending" count and a real "view all" affordance (pagination)** | Backend returns a total count alongside the capped list; frontend adds an expand/paginate control | Moderate (backend: expose count; frontend: new UI element + likely a new endpoint for the full list) | Most complete fix; the only one that actually lets a clinician see everything, not just guess there's more |
| **D. B + a lightweight count badge (no full pagination)** | Combine B's reordering with a simple "X more pending" text, no expand/paginate UI | Small–Moderate | Best cost/impact ratio: closes the "invisible stale order" risk without committing to a pagination feature |

**Recommendation**: **D**. It directly addresses the failure mode named in the original finding (an old, unresulted order silently invisible) at a fraction of the cost of full pagination (C), and is a strict improvement over just raising the cap (A).

**Status: Done (Option D implemented).** `GetEncounterWorkspaceUseCase` now sorts each order-type panel pending-first (via the same terminal-status lists `GetEncounterCloseReadinessUseCase` already uses, promoted to `public const` rather than duplicated) and exposes an uncapped `{type}OrdersPendingCount` alongside each capped list. The count is additive to the response; the frontend "+N more pending" affordance itself is not built (deferred, consistent with this codebase's backend-first pattern for this kind of work).

---

## C-9: No ownership/conflict check for admission-only encounters

**Current behavior**: `assertConsultationOwnershipForEncounterWrite()` only runs when `appointment_id` is present, checking the appointment's `consultation_owner_user_id`/`clinician_user_id` against the acting user while the appointment is `in_consultation`. Encounters resolved from an admission (no appointment at all) have no equivalent check anywhere in the create/update/status-update use cases.

| Option | What it does | Effort | Tradeoff |
|---|---|---|---|
| **A. Mirror the appointment check onto Admission** | Add a similar "owner" concept using `AdmissionModel::attending_clinician_user_id` (already exists) | Small–Moderate | Wrong shape for inpatient care: an admission spans days and legitimately has multiple clinicians (attending, residents, nurses) writing notes — locking to one "owner" the way a single consultation is locked would likely block legitimate concurrent care rather than protect it |
| **B. Check `EncounterModel::primary_clinician_user_id` instead of reaching into Appointment/Admission fields** | Use the encounter's own clinician field as the ownership signal, uniformly for both appointment- and admission-based visits | Small (one new lookup, reusable across both contexts) | More consistent architecture (Encounter already exists as the shared abstraction), but still carries the same "is a single-owner lock even the right model for multi-day inpatient care" question as option A |
| **C. Explicitly decide this check does not apply to admission-based encounters, and document why** | No code change; record the decision that inpatient care's multi-clinician nature makes a single-owner conflict check clinically inappropriate, not merely unimplemented | None | Correct if the current gap is actually a deliberate scope boundary rather than an oversight — but only defensible if someone with clinical-workflow authority confirms it, not assumed by an engineer |

**Recommendation**: this one **cannot be resolved by engineering judgment alone**. The real question is clinical, not technical: *should two clinicians be able to write on the same admitted patient's note concurrently without a conflict warning?* If the answer is "no, inpatient care should still get a warning, just not a hard single-owner lock," option B is the technical answer. If the answer is "yes, that's normal inpatient workflow and always has been," option C is correct and no code should change. This needs a clinical/product stakeholder decision before either A or B is built.

---

## C-10: Diagnosis catalog validation silently permissive when empty

**Current behavior**: if the diagnosis-terminology catalog has zero active entries, any regex-shaped ICD-10-style code is accepted with no real-terminology check. Catalog matching only activates once the catalog is populated.

| Option | What it does | Effort | Tradeoff |
|---|---|---|---|
| **A. Configurable strict mode** (e.g. `medical_records.require_diagnosis_catalog_match`) | When enabled, reject *all* diagnosis codes (even regex-valid ones) if the catalog is empty — fail closed instead of fail open | Small (one config flag + one new exception path) | Could block note finalization entirely for a new tenant/facility before their catalog is loaded — real onboarding-friction risk |
| **B. Make the fallback visible, not silent** | Keep current accept-when-empty behavior, but surface a warning (UI banner and/or audit-log entry) whenever a code is accepted without catalog verification | Small | Doesn't prevent bad data, but stops it from being invisible — cheapest option that improves the status quo without changing acceptance behavior |
| **C. Operational monitoring, not a validation change** | A scheduled check alerting operations if any active tenant/facility has an empty diagnosis catalog, treating it as a misconfiguration to fix at the source | Small–Moderate (needs an alerting destination, itself an open item in the implementation plan) | Doesn't change per-request behavior at all; only catches the root cause (empty catalog) before it produces bad data over time |

**Recommendation**: **B now, A later, C alongside either.** B is safe to build immediately regardless of what else is decided — it costs little and turns a silent gap into a visible one. A is the right long-term default once every tenant/facility is expected to have a populated catalog, but flipping it on before that's true would break legitimate onboarding. C is a good complement to either.

---

## C-12: No linkage between note content and structured orders

**Current behavior**: nothing cross-validates the free-text "Plan" section against what was actually placed as structured orders (labs, imaging, pharmacy). They are two independent write paths sharing only `encounter_id`.

| Option | What it does | Effort | Tradeoff |
|---|---|---|---|
| **A. Structured plan-to-order linkage** | Rework the Plan section into a structured (or hybrid structured+free-text) builder where each planned action can create/link a real order directly | Large — this is a new feature, effectively re-architecting how the Plan section works, not a bug fix | Actually closes the gap, but is a substantial product feature with its own design process, UX work, and migration considerations |
| **B. Lightweight presence heuristic** | On finalize, check only whether *any* order exists at all for the encounter; if a note is finalized with zero orders of any kind, show a non-blocking warning | Small | Cheap, but only catches "forgot to order anything at all" — does not verify content actually matches what was ordered |
| **C. Accept as an intentional design boundary** | Document that narrative documentation and structured orders are deliberately independent, consistent with how many EHR systems separate these concerns, and that cross-validation is left to clinical judgment | None | Correct if there's no real incident motivating this; wrong if clinicians have actually experienced "documented a plan, forgot the order" as a recurring problem |

**Recommendation**: this is the most product-judgment-dependent of the four. Option A is a genuine new feature, not a fix, and shouldn't be scoped as "finishing" C-12 without a real product decision to build it. I'd start with **C** (document as an accepted boundary) unless there is a specific, named clinical incident motivating at least the cheap heuristic in **B** — in which case build B first and treat A as a separate, larger future initiative, not part of this remediation pass.

---

## Summary for decision-makers

| Finding | Needs | Recommended starting point |
|---|---|---|
| C-8 | Engineering effort estimate, no stakeholder decision required | Option D (pending-first ordering + count badge) |
| C-9 | **Clinical/product decision required** — is single-owner locking even appropriate for inpatient care? | Cannot recommend a default; decide the clinical model first |
| C-10 | Product decision on onboarding-friction vs. data-quality tradeoff | Option B now (visibility), revisit A later |
| C-12 | **Product decision required** — is this a real recurring problem or a deliberate design boundary? | Option C unless a specific incident says otherwise |
