# Clinical Notes System — Implementation Plan

**Document type**: Implementation plan, synthesized from 19 prior reports (`reports/clinical-note-audit/00`–`15`, `reports/encounter-state-machine-design/00`–`03`). This document does not introduce new research — every claim below traces to one of those reports, cited inline. Where the prior reports disagree, are silent, or have since been overtaken by events, that is flagged explicitly rather than resolved by assumption.

---

## 0. Framing correction (read first)

A plan titled "implementation plan for a modern clinical notes feature/system" invites a greenfield reading. **That reading is wrong for this project, and the distinction matters enough to state before anything else.**

The audit (`clinical-note-audit/00-INDEX.md` through `15`) establishes that a complete, production, multi-module clinical notes system **already exists and is live**: the `MedicalRecord` and `Encounter` modules, a hexagonal/DDD-layered Laravel 12 backend, a 10,000+ line Vue/Inertia workspace composer with working autosave, optimistic concurrency, and cross-module order/billing integration. It has real patients, real encounters, real audit logs.

Separately, a **conceptual overlay** — the Canonical Encounter State Machine — was designed (`encounter-state-machine-design/00`, `01`) and then **partially implemented** as a read-only Shadow Mode evaluator (`app/Support/CanonicalEncounterState/*`, verified in `encounter-state-machine-design/03`), currently disabled by default and not yet validated in staging (`encounter-state-machine-design/02`).

This plan therefore treats the work as **brownfield remediation and evolution of a live system**, not net-new construction. Every "requirement" below is either (a) a "must keep working" constraint inherited from the existing system, (b) a fix for a defect the audit already found, or (c) new capability building on the canonical overlay already designed. Nothing here proposes rebuilding the clinical note or encounter modules from scratch.

### 0.1 Status update — implemented in this pass

Following this plan's own §6 next steps, a subsequent pass implemented the items that were pure code fixes or documentation, while deliberately **not** implementing the items requiring a product/business decision (per explicit scope agreement — see each item below):

- **C-1 fixed**: `UpdateMedicalRecordStatusUseCase` now validates the status transition and builds its update payload against the record as read under a row lock (`MedicalRecordRepositoryInterface::updateWithLock()`), not a value read before any lock was taken. 5 new regression tests (`tests/Feature/MedicalRecord/MedicalRecordStatusRaceConditionTest.php`), all passing.
- **C-16 fixed, narrower than originally scoped**: the duplicate-draft guard now covers `consultation_note`, `admission_note`, and `discharge_note` for both appointment- and admission-based encounters (previously appointment-linked `consultation_note` only). It was **deliberately not** extended to `progress_note`, `nursing_note`, `referral_note`, or `procedure_note` — testing during implementation proved those types legitimately need multiple simultaneous per-encounter drafts (e.g. two referral notes to two different specialties), so a blanket guard would have been a real regression, not a fix. 6 new tests (`tests/Feature/MedicalRecord/MedicalRecordDuplicateDraftGuardTest.php`), all passing.
- **C-13 resolved as "not a bug"**: traced `EncounterMedicationSafetyPanel.vue` end-to-end to `GetPatientMedicationSafetySummaryUseCase` and confirmed it is a real, substantial, fully-wired allergy/interaction/lab-signal/duplicate-order safety system, not an unwired stub. No code change needed; the original "unverified" flag was an incomplete trace, not a defect.
- **C-8, C-9, C-10, C-12 — options documented, not implemented**: each requires a product/clinical-workflow decision an engineer shouldn't make unilaterally on a live clinical system (e.g., C-9 asks whether single-owner conflict locking is even the right model for multi-day inpatient care). See `clinical-note-audit/16-remediation-options-c8-c9-c10-c12.md` for concrete options and a recommendation per finding.
- **Design-doc amendment notes added** to `encounter-state-machine-design/00` and `01`, closing the §5.3 contradiction below.
- **`.env.example` documents** `CANONICAL_ENCOUNTER_SHADOW_MODE_ENABLED` (previously missing).
- **A fresh compliance assessment was written** (`reports/compliance/clinical-notes-compliance-assessment.md`) — explicitly an engineering-perspective readiness inventory, not a legal certification, per explicit instruction not to restore or rely on the previously-deleted Tanzania compliance document.
- **Explicitly left blocked, not attempted**: staging execution (no staging access), the offline-support product decision, and the alerting-destination choice — these need a human stakeholder or infrastructure this pass does not have, per explicit agreement rather than an oversight.

Full regression evidence: `php artisan test tests/Feature/MedicalRecord/ tests/Feature/Encounter/ tests/Feature/CanonicalEncounterState/` → 108 passed, 5 failed — all 5 failures independently verified (via scoped `git stash`, before/after comparison) to be pre-existing and unrelated to any change in this pass.

---

## 1. Overview

### 1.1 Goal

Move the existing clinical notes system from its current state — a working but under-guarded note/encounter lifecycle with sixteen identified integrity risks (`clinical-note-audit/15`) — toward one where:

1. The sixteen identified risks are remediated, prioritized by the severity already assigned in the audit.
2. A single, trustworthy answer to "what state is this clinical case actually in" exists (the canonical overlay), first as an internal diagnostic signal (Shadow Mode), then — pending validation — as user-visible advisory information, and only much later, if ever, as an enforced gate.

### 1.2 Scope

**In scope**: the `MedicalRecord` module (note content/lifecycle), the `Encounter` module (visit lifecycle, close-readiness, clinical-document uploads), the canonical overlay (`app/Support/CanonicalEncounterState`), and the read-only integration points into Laboratory, Radiology, Pharmacy, Billing, Appointment, Admission, TheatreProcedure, and the Platform diagnosis catalog, exactly as inventoried in `clinical-note-audit/02` and `11`.

**Out of scope** (either because prior reports never touched them, or because they are explicitly owned elsewhere): the internal implementation of Laboratory/Radiology/Pharmacy/Billing order-creation logic (only their *read* surface was audited); prescription/medication-safety logic beyond the unverified `EncounterMedicationSafetyPanel.vue` prop contract (`clinical-note-audit/06` §6.9, `11` §11.4); any ServiceRequest integration (confirmed absent, `clinical-note-audit/11` §11.10); Mode D (enforcement) design, which `encounter-state-machine-design/01` §6 explicitly defers.

---

## 2. Requirements

### 2.1 Functional requirements

**Baseline — must continue working exactly as documented** (this is the "do not break" contract, not new work; source: `clinical-note-audit/03`, `04`, `05`, and `encounter-state-machine-design/01` §8):

- Note creation/draft-save/autosave (1.5s debounce, 15s max-wait, flush-on-hide/blur/unload) exactly as `clinical-note-audit/05` §5.2 documents.
- Note status lifecycle (`draft → finalized/archived`, with the finalize-after-sign→`amended` override and the amend-request→`draft` override — see §5.1 below, this is a functional requirement to *preserve*, not necessarily to *like*).
- Encounter lifecycle (`opened → in_progress → ready_for_sign/signed/amended → closed`, plus `reopen`) and its close-readiness checklist, unchanged.
- Encounter creation via `EncounterResolverService::findOrCreateForVisit()`, order-module independence, and Billing-module independence (`encounter-state-machine-design/01` §8, items 1, 3, 4).

**New functional requirements** (this is the actual new work):

- Canonical case-status computation (8 states + `INDETERMINATE`), already specified in `encounter-state-machine-design/00` §1 and implemented in `CanonicalEncounterStateResolver`.
- Ten named conflict detectors (CONFLICT-01–10), already specified and implemented (`encounter-state-machine-design/00` §4, `03` §1.4).
- Shadow-mode logging of canonical evaluations, separate from clinical audit trails (already implemented, `encounter-state-machine-design/01` §4.1, `03` §1.5).
- **Not yet built**: divergence debounce and alert routing (`encounter-state-machine-design/01` §4.3–§4.4) — see §5.8.
- **Not yet built**: Mode C advisory UI surfacing (`encounter-state-machine-design/01` §3) — no frontend work has been done; only the backend resolver exists.
- **Remediation work for findings NOT covered by the canonical overlay at all** — see §5.2; C-1 and C-16 are now fixed (§0.1), C-8/C-9/C-10/C-12 await a decision (`clinical-note-audit/16`).

### 2.2 Non-functional requirements

| Category | Status per prior reports | Assessment |
|---|---|---|
| **Compliance (HIPAA / local health-data regulation)** | Not addressed by any of the original 19 reports; a fresh engineering-perspective starting document now exists. | Still the single largest gap overall — see §5.4. A fresh assessment was written (`reports/compliance/clinical-notes-compliance-assessment.md`) per explicit instruction to write new material rather than restore the previously-deleted `documents/01-COMPLIANCE_TANZANIA_HEALTHCARE_2026.md`. Real legal/compliance counsel engagement remains unstarted. |
| **Performance** | Partially addressed, and one prior assumption was **empirically overturned**. `encounter-state-machine-design/01` §2.2 assumed shadow computation would carry negligible overhead, "matching the idiom the current system already uses." `encounter-state-machine-design/02` §0 then measured ~91 SQL queries for a single `GetEncounterCloseReadinessUseCase::execute()` call at realistic order volume (48 orders), traced to the Billing module's charge-capture-candidate lookup — a **pre-existing** cost, not introduced by the new resolver, but one the original design doc did not anticipate. No production-measured latency number exists yet (`encounter-state-machine-design/02` §4 item 5 names this as a precondition for trust, still open). |
| **Concurrency / data integrity** | Documented as a live defect, not yet fixed. `clinical-note-audit/15` C-1 (race condition between autosave and finalize, no optimistic lock on the status-update path) and C-7 (no shared transaction across record write + audit log + version write + encounter sync) are both open. |
| **Offline support** | **Zero existing capability, zero design coverage.** The frontend audit (`clinical-note-audit/06` §6.4) found only a crash-recovery `localStorage` draft key (write path unconfirmed) — this is *not* offline operation, it is autosave-loss mitigation for an always-online client. If offline support is a real product requirement, no prior report provides any foundation for it. Flagged as a from-scratch scoping exercise in §5.5. |
| **Auditability** | Strong for clinical actions (`medical_record_audit_logs`, `encounter_audit_logs`, both append-only with actor/action/changes/metadata — `clinical-note-audit/09` §9.3, §9.7), deliberately kept separate from the new system-diagnostic `canonical_encounter_shadow` log channel (`encounter-state-machine-design/01` §4.1, verified built `03` §1.5). No gap here. |
| **Authorization** | Functionally present (permission-string checks via `->can()`, `clinical-note-audit/08` §8.6) but architecturally thin — no `Policy` classes, no `Gate::define()` registrations were found; permission-string *registration* source was never located. Not a defect, but a maintainability/auditability gap worth a decision. |

---

## 3. Architecture

### 3.1 Existing stack (unchanged by this plan)

Laravel 12 / PHP 8.2+, hexagonal/DDD module layout (`Domain` / `Application` / `Infrastructure` / `Presentation` per module — `clinical-note-audit/02` §2.1), Inertia + Vue 3 + TypeScript frontend, Eloquent ORM. Production/staging database driver is PostgreSQL (confirmed indirectly via `pg_catalog`/`information_schema` introspection queries observed in `encounter-state-machine-design/02` §0's diagnostic run); the automated test suite runs against SQLite in-memory (`encounter-state-machine-design/03` test evidence) — **this driver mismatch between test and production environments is itself worth flagging**: a query-cost or SQL-dialect-specific defect (such as the one found in §0) may not be reproducible or may behave differently under the test suite's SQLite driver versus the real PostgreSQL target, so passing tests are necessary but not sufficient evidence of production performance behavior.

### 3.2 Data model (unchanged by this plan)

Seven core tables per `clinical-note-audit/09`: `medical_records`, `medical_record_versions`, `medical_record_audit_logs`, `medical_record_signer_attestations`, `encounters`, `encounter_clinical_documents`, `encounter_audit_logs`. No new column, table, or migration is introduced anywhere in the canonical-overlay work (`encounter-state-machine-design/01` §8 item 5, verified `03`).

### 3.3 New component: the canonical overlay

Positioned as a cross-cutting, read-only Application-layer query service (`encounter-state-machine-design/01` §1), living at `app/Support/CanonicalEncounterState/*`, depending only on existing repository interfaces and use cases (`EncounterResolverService::findById()`, `MedicalRecordRepositoryInterface::search()`, `GetEncounterCloseReadinessUseCase::execute()`, `EncounterAuditLogRepositoryInterface::listByEncounterId()`) plus four direct read-only order-model queries. Currently wired into exactly one integration point: the `GET /api/v1/encounters/{id}?view=workspace` read endpoint, config-gated off by default (`03` §1.6).

### 3.4 Integration points (unchanged, inventoried not modified)

Per `clinical-note-audit/11` and `encounter-state-machine-design/01` §1.3: Appointment (port/interface, both directions), Laboratory/Radiology/Pharmacy (direct Eloquent read, one direction — Encounter reads, order modules never reference Encounter/MedicalRecord classes), Billing (direct Application-layer UseCase dependency — the one non-hexagonal coupling in the whole system), Admission and TheatreProcedure (port for validation, direct read for display), Platform diagnosis catalog (port). ServiceRequest: no integration exists.

---

## 4. Implementation phases

Effort estimates below are **rough, order-of-magnitude placeholders** — no team velocity data exists anywhere in the 19 reports, so treat these as a starting point for your own estimation, not a commitment.

| Phase | Content | Status | Rough effort |
|---|---|---|---|
| **Phase 0 — Baseline** | The 15-document reverse-engineering audit + critical integrity review | **Done** | (spent) |
| **Phase 1 — Shadow resolver build** | `CanonicalEncounterStateResolver`, dimension enums, conflict codes, shadow logger, feature flag, controller hook, 21 passing tests | **Done** | (spent) |
| **Phase 1.5 — Validation & rollout planning** | Query-cost finding, CONFLICT-09/high-volume/CONFLICT-03 test coverage, locked staging rollout sequence | **Done (plan); staging execution not started** | (spent for planning; ~1–2 weeks for staging execution per `encounter-state-machine-design/02` §2.3) |
| **Phase 2 — Critical-finding remediation (NEW — not scheduled anywhere in prior reports)** | The 7 audit findings the canonical overlay does *not* cover: C-1, C-8, C-9, C-10, C-12, C-13, C-16 | **C-1 and C-16 fixed and tested; C-13 investigated and resolved as not-a-bug; C-8/C-9/C-10/C-12 have documented options awaiting a product decision** (`clinical-note-audit/16`) | C-1/C-16/C-13: spent. C-8/C-9/C-10/C-12: 1–3 days each once a decision is made — effort depends entirely on which option is chosen per finding |
| **Phase 3 — Staging soak (Shadow Mode)** | Execute `encounter-state-machine-design/02` §3 rollout sequence; reach the seven-condition "READY FOR MODE B TRUST" bar (`02` §4) | Not started | 1–2 weeks elapsed (mostly observation time, not engineering effort) |
| **Phase 4 — Debounce + alerting** | Build the "what is ignored" / "what triggers alerts" logic named but not implemented (`encounter-state-machine-design/01` §4.3–§4.4) | Not started | 3–5 days |
| **Phase 5 — Mode C (Advisory UI)** | Additive response field + non-blocking, clearly-labeled frontend badge; no gating of any existing action (`encounter-state-machine-design/01` §3) | Not started, no design work done beyond the constraint list | ~1 week backend + ~1 week frontend |
| **Phase 6 — Mode D (Enforcement)** | Explicitly deferred; requires its own design pass | Not started, not designed | Not estimated |
| **Parallel/unscoped — Compliance review** | HIPAA / local regulatory assessment | Not started, no source material | Unknown — requires a compliance stakeholder before it can even be sized |
| **Parallel/unscoped — Offline support** | If required, a from-scratch architecture exercise | Not started, no source material | Unknown — requires a product decision before it can be sized |

---

## 5. Risks & open questions

### 5.1 Confirmed defects (from `clinical-note-audit/15`)

- **3 Critical**: ~~C-1 (race condition, autosave vs. finalize — no lock on the status-update path)~~ **fixed, see §0.1**. C-2 (close-readiness only checks *a* signed note, not *all* notes) — still open. C-3 (amend request stores `draft` while stale `signed_at` persists; unclear whether the single-record print path re-checks status) — still open.
- **4 High**: C-4 (duplicate-encounter race), C-5 (close permitted with pending orders/unbilled services on a 3-character acknowledgement), C-6 (two use cases resolve "primary note" differently), C-7 (no shared transaction across record/audit/version/encounter-sync writes) — all still open.
- The remaining Medium/Medium-High/Low-Medium findings are listed in full in `clinical-note-audit/15`'s severity roll-up. Of these, **C-16 is now fixed** (see §0.1); **C-13 is resolved as not-a-bug**; C-8, C-9, C-10, C-12 have documented options (`clinical-note-audit/16`) awaiting a decision; C-11, C-14, C-15 remain untouched by this pass.

### 5.2 The canonical overlay still does not cover roughly half the known defects — status per finding

Cross-referencing `encounter-state-machine-design/00` §4's ten conflict codes against `clinical-note-audit/15`'s sixteen findings, **C-1, C-8, C-9, C-10, C-12, C-13, and C-16 have no corresponding CONFLICT rule** — this remains true regardless of the fixes in §0.1, since fixing a defect directly in code doesn't retroactively give the canonical overlay a detector for it (nor does it need one, once the underlying defect is gone). Updated status: C-1 and C-16 are now fixed at the source; C-13 was never actually a defect; C-8/C-9/C-10/C-12 remain open pending the product decisions in `clinical-note-audit/16`. **Decision needed**: for C-8/C-9/C-10/C-12, pick an option from that document (or explicitly accept current behavior) — engineering cannot resolve these unilaterally.

### 5.3 Design-doc constraints have been amended to match reality

~~`encounter-state-machine-design/00` and `01` both open with a governing constraint of "no code changes, conceptual overlay only"... still read as if no code exists~~ **Resolved**: both documents now carry an amendment note pointing to `03-implementation-readiness-audit.md` and this plan, so the "no code exists" framing no longer contradicts what's actually in the repository.

### 5.4 Compliance — a starting document now exists, but real legal review is still unstarted

A fresh, engineering-perspective compliance readiness assessment now exists (`reports/compliance/clinical-notes-compliance-assessment.md`), per explicit instruction not to restore the previously-deleted Tanzania compliance document but to write new material instead. **This does not close the gap** — it only gives a real compliance/legal reviewer a concrete starting point instead of a blank page. The document explicitly disclaims itself as non-legal-advice and flags that the actual deployment jurisdiction needs confirming before anything else in it can be acted on. Engaging qualified counsel remains entirely unstarted and is still the single highest-priority open item.

### 5.5 Gap: offline support has zero foundation

If offline support is a genuine, committed requirement (rather than an aspirational item on a feature-request list), no part of the existing architecture — autosave, optimistic concurrency, the API-first Inertia frontend — was designed with offline operation in mind. This would be new architecture, not an extension, and should be scoped as such before being placed on any phased timeline.

### 5.6 Open question: is CONFLICT-09 useful signal or noise?

`encounter-state-machine-design/00`'s own discussion (carried into `01` §7.4) predicted CONFLICT-09 ("status advanced only via the note-sync side channel") would fire for nearly every `signed`/`amended`/sync-driven `in_progress` encounter under the current system's real behavior, because that side channel is, today, the *only* path to those values. This was implemented faithfully rather than suppressed (`03` §1.4), and real-data testing (`02` §1.1) confirmed the mechanism works — but whether it produces a useful per-encounter signal or just constant background noise **has not been evaluated against real staging data**, since staging validation (Phase 3) has not started. Decide during Phase 3 whether this rule needs redefinition before Mode C.

### 5.7 Open question: should the legacy status-override behavior itself eventually be fixed?

The root cause behind C-3/CONFLICT-04 (a "finalized" request on an already-signed note silently becomes `amended`; an "amended" request silently becomes `draft`) is legacy `MedicalRecordStatus` transition logic, not the canonical overlay. The overlay's design was explicitly constrained to *observe* this behavior, not *change* it. Nothing in the 19 reports blocks a separate initiative to correct the underlying legacy logic — but nothing schedules one either. This is a product/engineering decision, not something the reports resolve.

### 5.8 Open question: alerting destination

`encounter-state-machine-design/01` §4.4 specifies that Critical/High conflicts should route to "an engineering/operations alert channel," without naming one. No Slack/PagerDuty/email integration was found or assumed anywhere in the audited code. Phase 4 cannot be fully scoped until this is decided.

---

## 6. Next steps (immediate action items)

**Done in this pass** (see §0.1 for detail): C-1 fixed and tested; C-16 fixed and tested (narrower scope than originally planned, for good reason); C-13 investigated and closed as not-a-bug; options documented for C-8/C-9/C-10/C-12; design-doc amendment notes added; `.env.example` updated; a fresh compliance readiness document written.

**Still open, in priority order**:

1. **Resolve the compliance blind spot.** The fresh assessment (`reports/compliance/clinical-notes-compliance-assessment.md`) is a starting point, not a resolution — get qualified legal/compliance counsel to confirm the actual deployment jurisdiction and perform a real review. This still blocks meaningfully sizing any compliance-driven work.
2. **Make the product/clinical-workflow decisions for C-8, C-9, C-10, and C-12** (`clinical-note-audit/16`) — engineering has laid out the options; someone with product or clinical authority needs to pick.
3. **Assign an owner and schedule Phase 3 (staging soak)** per the locked sequence in `encounter-state-machine-design/02` §3 — the dataset-generation script and rollback triggers are already fully specified; this needs a person and a staging window, not more design.
4. **Get a product decision on offline support** before it appears on any roadmap — right now it is an unscoped, unestimated idea with zero architectural groundwork.
5. **Decide the alerting destination** (§5.8) so Phase 4 can actually be estimated.
6. **Re-run the query-cost finding's measurement (`encounter-state-machine-design/02` §0) directly against a PostgreSQL-backed staging environment**, not just the SQLite test suite, before trusting the ~91-query number as representative of production behavior (§3.1's driver-mismatch caveat).
7. **Address the remaining unfixed critical findings** — C-2 through C-7 (excluding C-1, now fixed) remain open and are not addressed by anything in this pass; they were out of this pass's agreed scope, not resolved.
