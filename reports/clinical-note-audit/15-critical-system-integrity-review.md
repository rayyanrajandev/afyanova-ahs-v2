# 15. Critical System Integrity Review

Scope: risks only — cross-module state inconsistency, broken/missing transitions, race conditions, encounter/note/order misalignment, "completed but not clinically complete" states, and violations of expected EHR logic. This is a synthesis over facts already established in documents 01–14; no new code exploration was performed beyond re-tracing the cited logic. **No fixes are proposed.** Every item cites the source finding it derives from.

---

## C-1. Race condition between concurrent autosave and status-finalize with no locking on the status path

**Where it happens**: `UpdateMedicalRecordUseCase::execute()` writes content via `updateWithOptimisticLock()` (transactional, row-locked via `lockForUpdate()`). `UpdateMedicalRecordStatusUseCase::execute()` writes status via a plain `MedicalRecordRepositoryInterface::update()` call — **no transaction, no optimistic lock, no `expectedUpdatedAt` check**. (`05-saving-mechanism.md` §5.5, §5.7; `07-backend-behaviour.md` §7.5.)

**Why it is dangerous in a hospital context**: The autosave loop fires every 1.5–15 seconds while a clinician types (`05-saving-mechanism.md` §5.2). A "Finalize" click can be submitted by the same or a different session while an autosave PATCH is still in flight or about to fire. Because the status-update path has no version/timestamp check, it can commit based on a stale read of the record while a concurrent content save is applied before or after it, with no application-level detection of the interleaving.

**Real-world clinical risk**: A note can be marked `finalized`/`signed` without reflecting the clinician's actual last-typed content (e.g., a corrected medication dose or an added critical finding typed seconds before signing could be silently dropped or applied after the record is already locked, orphaning that edit). Downstream staff acting on the "final" note would be acting on an incomplete or superseded version of the clinical picture.

**Severity: Critical**

---

## C-2. Close-readiness "note signed" check verifies *a* note, not *all* notes tied to the encounter

**Where it happens**: `GetEncounterCloseReadinessUseCase::resolvePrimaryMedicalRecord()` searches for the single most-recently-updated consultation note matching `status = FINALIZED`, then falls back to `AMENDED`, then `DRAFT` — it returns the **first record found in `FINALIZED` status**, not the most recently updated note overall, and not a check that every consultation note under the encounter is finalized. (`04-clinical-note-lifecycle.md` §4.3; `03-workflow-reconstruction.md` §3.5, §3.9.)

**Why it is dangerous in a hospital context**: An encounter can have more than one `MedicalRecord` row of type `consultation_note` (e.g., an addendum, a co-signing physician's separate note, a corrected re-entry after an error). If any one of them is `finalized`, the blocking `note_signed` checklist item passes — even if a separate, more recent draft note for the same encounter is still unsigned and sitting open.

**Real-world clinical risk**: An encounter can be closed while a second, unfinished note (potentially containing the addendum, correction, or a different provider's assessment) remains permanently in draft, unsigned, and with no further system pressure to complete it — since the readiness check that would normally force attention to it has already been satisfied by an unrelated note.

**Severity: Critical**

---

## C-3. Amend request stores the note back to `draft` while stale `signed_at`/signer identity persist, and the single-record print path does not gate on status

**Where it happens**: `UpdateMedicalRecordStatusUseCase` — a requested `amended` transition is coded to overwrite the stored `status` to `DRAFT`, not `AMENDED` (`04-clinical-note-lifecycle.md` §4.1, §12.2). The `signed_by_user_id`/`signed_at` fields are only ever cleared or set by the `finalized` branch — they are left untouched by the amend override. `MedicalRecordDocumentController` (the per-record `/medical-records/{id}/print` and `/pdf` routes) was not found to carry the same `status in [finalized, amended]` gate that `EncounterDocumentController::resolveSignedPrimaryRecord` explicitly enforces for the encounter-level "signed chart packet" (`08-api-inventory.md` §8.3; frontend fork detail on `Print.vue` showing `Signer: signer?.name || 'Not signed'` and `Signed At: formatDateTime(record.signedAt)` rendered unconditionally from server-supplied fields, with no `record.status` check in the page itself).

**Why it is dangerous in a hospital context**: A note that a user has just requested to "amend" is, at the database level, indistinguishable from a fresh, never-signed draft (`status = draft`) — except that it still carries a `signed_at` timestamp and signer name from its prior finalization. If the per-record print/PDF path renders those fields without re-checking current status, it can display a note that is actively open for editing as "Signed by Dr. X at [timestamp]."

**Real-world clinical risk**: A printed or exported document could misrepresent an in-progress, unlocked, being-edited note as an officially signed clinical record — a direct falsification-by-omission risk if that document is placed in a physical chart, faxed to another provider, or attached to a referral/insurance packet before the amendment is completed and re-finalized.

**Severity: Critical**

---

## C-4. Encounter resolution has no concurrency control — duplicate encounters can be created for the same visit

**Where it happens**: `EncounterResolverService::findOrCreateForVisit()` — check-then-create logic (search for an existing encounter by `patient_id` + `appointment_id`/`admission_id`; if none found, insert a new row) with no unique DB constraint tying one appointment to one encounter and no locking around the read-then-write sequence (`03-workflow-reconstruction.md` §3.1; `09-database-structure.md` §9.5).

**Why it is dangerous in a hospital context**: Two near-simultaneous requests for the same appointment (e.g., a page double-load, a retried request after a slow network response, or two staff members opening the same patient's encounter workspace within the same moment) can each fail to find an existing encounter and each create their own new `EncounterModel` row for the same visit.

**Real-world clinical risk**: Subsequent orders, notes, or documents created against whichever `encounter_id` happens to be resolved by each session get split across two parallel encounter records for the same physical visit. A clinician viewing "the" encounter may see only half the picture — e.g., lab orders placed under the sibling encounter would not appear in the workspace, would not count toward that encounter's close-readiness, and could be overlooked entirely if only one of the two encounters is ever revisited.

**Severity: High**

---

## C-5. Encounter close permits outstanding lab/imaging/pharmacy orders and unbilled services with only a trivial acknowledgement

**Where it happens**: `GetEncounterCloseReadinessUseCase` — only the `note_signed` item has `severity = block`; `diagnosis_documented`, `pending_orders`, and `unbilled_services` are all `severity = warn`. `EncounterLifecycleService::close()` allows closing once `canClose` is true (i.e., only the note-signed condition is satisfied) provided the caller sets `acknowledgeCloseGaps = true` and supplies a `reason`. `EncounterCloseChecklistDialog.vue`'s own `canConfirm` computed accepts a reason of `reason.trim().length >= 3` — three characters (`04-clinical-note-lifecycle.md` §4.3; `06-frontend-behaviour.md` §6.6).

**Why it is dangerous in a hospital context**: The system's only hard stop before closing a visit is whether a note has been signed — it does not require pending lab, radiology, pharmacy, or theatre orders to be resolved, and does not require a documented diagnosis. A three-character string ("n/a", "ok/") clears the acknowledgement requirement.

**Real-world clinical risk**: A visit can be marked closed while lab or imaging results are still pending. Once closed, there is nothing in the audited close-readiness/lifecycle logic that continues to surface those outstanding orders for follow-up specifically because the encounter is closed — the encounter that would normally serve as the anchor for "does this patient have anything outstanding from this visit" is now in a terminal state. This is a canonical "completed does not mean clinically complete" condition: `encounter.status = closed` while diagnostically or therapeutically the visit's workup is unfinished.

**Severity: High**

**Update — decided (2026-07-08).** Block/warn split confirmed correct, no policy change: `note_signed`/`disposition_documented` remain the only hard blocks; `diagnosis_documented`/`pending_orders`/`unbilled_services` remain warn-only. Investigation found the original finding's assumed harm doesn't hold — closing an encounter never cascades to order records, and every lab/pharmacy/radiology worklist filters by the order's own status, not the parent encounter's, so a pending order on a closed encounter is exactly as visible to the team that would act on it as one on an open encounter; billing charge-capture candidates are equally unaffected by encounter status. A hard block on pending orders would also fight normal outpatient workflow, where visits routinely close while labs are still processing. What *was* genuinely weak — the 3-character reason floor and count-only (not itemized) acknowledgement — is fixed, without changing the non-blocking policy: `EncounterLifecycleService::close()` now requires a real reason (minimum length + a placeholder denylist), `GetEncounterCloseReadinessUseCase`'s `pending_orders`/`unbilled_services` items carry an itemized `details` list alongside the count, and the close audit log records the specific outstanding item IDs, not just counts.

---

## C-6. Two different use cases resolve "the primary medical record" for the same encounter differently

**Where it happens**: `GetEncounterWorkspaceUseCase::resolvePrimaryMedicalRecord()` checks only `FINALIZED` then `AMENDED` (returns `null` if neither exists). `GetEncounterCloseReadinessUseCase::resolvePrimaryMedicalRecord()` additionally falls back to `DRAFT` as a third option. Both are independently implemented, not shared code (`04-clinical-note-lifecycle.md` §4.3, callout box).

**Why it is dangerous in a hospital context**: The same encounter, at the same moment, can report "no primary note" to the workspace UI (because only a draft exists) while the close-readiness computation for that same encounter finds and evaluates that draft note. This means a clinician looking at the workspace could see a blank/absent note panel — appearing as though documentation was lost or never started — while the system's own close logic is quietly aware a draft exists and is correctly blocking closure on it. The inverse confusion (workspace shows a note as "primary" that a different resolution path would have skipped) is also structurally possible depending on which status wins the respective search order.

**Real-world clinical risk**: Apparent loss of documentation from the clinician's point of view, potentially prompting a duplicate note to be started for the same encounter (compounding the C-2 multiple-notes problem), or eroding trust in the system's chart continuity during a live encounter.

**Severity: High**

---

## C-7. No shared transaction across MedicalRecord write, audit log, version snapshot, and Encounter status sync

**Where it happens**: Both `UpdateMedicalRecordUseCase` and `UpdateMedicalRecordStatusUseCase` perform their primary write, their audit-log write, their version-row write, and their call into `EncounterLifecycleService` as four independently-committed operations with no enclosing `DB::transaction()` at the Application layer (`07-backend-behaviour.md` §7.5).

**Why it is dangerous in a hospital context**: If the process fails, times out, or throws between steps (e.g., after the `MedicalRecord.status` row is committed as `finalized` but before `EncounterLifecycleService::syncFromMedicalRecordStatus()` executes or commits), there is no compensating transaction, retry, or reconciliation job identified anywhere in the audited code to detect or correct the resulting mismatch.

**Real-world clinical risk**: The note-of-record can show `finalized`/signed while the encounter it belongs to remains stuck at `opened`/`in_progress` (or vice versa after a status revert), so anything that keys off encounter status (e.g., a downstream dashboard, a billing trigger, or the close-readiness gate itself) can act on a stale, unsynchronized encounter state indefinitely, with no visible error to alert staff that the two aggregates disagree.

**Severity: High**

---

## C-8. Workspace order display is capped at 6 most-recent rows per order type; older pending orders remain invisible in the UI

**Where it happens**: `GetEncounterWorkspaceUseCase::CARE_ARTIFACT_LIMIT = 6` caps each of the laboratory/pharmacy/radiology/theatre-procedure lists shown to the clinician, ordered most-recent-first. `GetEncounterCloseReadinessUseCase`'s pending-order *count* query for the same order types was not documented as sharing this cap (`11-integration-points.md` §11.2–§11.4, §10.8).

**Why it is dangerous in a hospital context**: If more than six active orders of a given type accumulate against one encounter, the oldest ones — which, by definition of "oldest still-active," are the ones most overdue for a result — drop off the visible panel while still being counted (as an opaque number) in the close-readiness badge.

**Real-world clinical risk**: A clinician can see a "3 pending" badge with no way, from the workspace's visible order list, to identify which specific order is the stale one requiring follow-up, since the panel only shows the six newest. An old, easily-overlooked result-pending order (e.g., a culture with a multi-day turnaround) is exactly the kind of item this cap would push out of view.

**Severity: Medium-High**

---

## C-9. Consultation-ownership/conflict check only applies when an appointment is linked

**Where it happens**: `ConsultationOwnerConflictForMedicalRecordException` is only evaluated when `appointment_id` is present and the appointment's status is `in_consultation` (`11-integration-points.md` §11.1; `03-workflow-reconstruction.md` §3.2). Encounters/notes created through an admission-only context (no appointment linkage) have no equivalent ownership check anywhere in the audited create/update/status use cases.

**Why it is dangerous in a hospital context**: For inpatient (admission-based) documentation, nothing in the audited code detects or prevents two different clinicians from concurrently editing the same draft note believing they are the sole author, beyond the record-level optimistic lock on content saves (which only fires on the exact save timing, not on session/authorship).

**Real-world clinical risk**: Concurrent, uncoordinated editing of the same inpatient note by more than one clinician, with only a timestamp-conflict (not an authorship-conflict) as the detection mechanism — increasing the chance one clinician's clinical input is silently overwritten by another's save without either being aware of the collision's clinical content, not just its timing.

**Severity: Medium**

**Update — decided, no code change (2026-07-08, see `16-remediation-options-c8-c9-c10-c12.md`).** Consultation-ownership locking stays scoped to appointment-based outpatient consultations, where one clinician owning a time-bound session is the correct model. Admission-based encounters are intentionally multi-clinician — different clinicians creating different note types, or contributing to the same admission over its course, is expected inpatient workflow, reinforced by C-16's own duplicate-guard design (`progress_note`/`nursing_note` explicitly exempted as repeating per shift/day) and `InpatientWard`'s acknowledgement-based (not ownership-based) round-note model. The actual data-loss risk — two people clobbering the same edit — is already covered per-record by `updateWithOptimisticLock()`/`MedicalRecordDraftConflictException`, uniformly for admission- and appointment-linked notes. Revisit only on a real (not theoretical) incident.

---

## C-10. Diagnosis-terminology catalog validation is silently disabled when the catalog is empty

**Where it happens**: `DiagnosisTerminologyLookupService::hasAnyActiveDiagnosisCodes()` gates whether catalog-matching is enforced at all; if zero active codes exist in the Platform catalog, any regex-shaped string (`/^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$/`) is accepted as a valid diagnosis code with no real-terminology backing (`10-configuration-inventory.md` §10.2).

**Why it is dangerous in a hospital context**: This is a data-dependent safeguard, not a code-level guarantee — its protection is only as strong as whatever an administrator has populated into the clinical catalog for that tenant/facility. A new tenant, a catalog data-load failure, or a catalog that is emptied by mistake would silently and invisibly drop diagnosis-code validation to "regex-shape only" with no error or warning surfaced anywhere in the audited flow.

**Real-world clinical risk**: Diagnosis codes with no correspondence to a real clinical vocabulary can be recorded and then flow into billing, quality-reporting, or any downstream system that trusts `diagnosis_code` as coded terminology — producing clinically meaningless or misleading diagnosis data without any signal that validation was effectively bypassed.

**Severity: Medium**

**Update — fixed (2026-07-08, see `16-remediation-options-c8-c9-c10-c12.md`).** Create/update audit-log entries now carry `metadata.diagnosis_code_catalog_verified = false` whenever a code is accepted with an empty catalog, and a new `EmptyDiagnosisCatalogAuditor` (`medical-records:audit-empty-diagnosis-catalogs`) flags any facility with zero active diagnosis-terminology entries, writing to `catalog_integrity_audit_findings`. Run against the dev database on 2026-07-08: all 5 current facilities were flagged — a live, real gap, not hypothetical.

---

## C-11. Pharmacy `reconciliation_exception` is treated as a terminal (non-pending) status

**Where it happens**: `GetEncounterCloseReadinessUseCase`'s `PHARMACY_TERMINAL_STATUSES = [dispensed, cancelled, reconciliation_completed, reconciliation_exception]` — an order in the `reconciliation_exception` state is excluded from the "pending" count exactly the same as a cleanly `dispensed` or `cancelled` order (`11-integration-points.md` §11.4).

**Why it is dangerous in a hospital context**: "Reconciliation exception" is, by its name, an unresolved problem state (e.g., a medication reconciliation mismatch flagged for review) — not a completed, safe end-state. Grouping it with `dispensed`/`cancelled` for the purposes of "is anything still outstanding" means an unresolved medication-safety flag stops contributing to the encounter's pending-orders warning the moment it enters that exception state.

**Real-world clinical risk**: A flagged medication-reconciliation discrepancy — potentially indicating a dosing conflict, duplicate therapy, or an unreconciled home-medication list — can silently stop generating any close-readiness signal, removing the one system-level nudge that might otherwise prompt pharmacy or clinical staff to resolve it before the visit is considered closed.

**Severity: Medium-High**

---

## C-12. No linkage or cross-validation between note content (diagnosis/assessment/plan) and actual pharmacy/lab/order records

**Where it happens**: No code path was found in `CreateMedicalRecordUseCase`/`UpdateMedicalRecordUseCase` that creates, or cross-checks against, a lab/imaging/pharmacy order as a consequence of note content; the note and the orders are two entirely independent write paths that only share a common `encounter_id` for display/counting purposes (`03-workflow-reconstruction.md` §3.4, §3.6; `11-integration-points.md`).

**Why it is dangerous in a hospital context**: What a clinician documents in the "Plan" section of a note (e.g., "start amoxicillin," "order chest X-ray") has no enforced correspondence to what is actually entered as a structured order elsewhere in the system. Nothing in the audited code reconciles the two.

**Real-world clinical risk**: A documented treatment plan can diverge from what was actually ordered — either because the clinician forgot to place the structured order after writing the plan, or because an order was placed that doesn't match what was written — with no system-level cross-check to catch the discrepancy. This is a classic source of care-plan/order mismatch in EHR systems generally, and this codebase has no mechanism identified that narrows that gap.

**Severity: Medium**

**Update — decided, no code change (2026-07-08, see `16-remediation-options-c8-c9-c10-c12.md`).** No specific clinical incident motivates closing this gap — the finding was audit-derived, not incident-derived. Narrative clinical documentation and structured orders remain deliberately independent workflows, consistent with how many EHR systems separate these concerns. Revisit only if real clinical incidents show missing orders after documentation are actually causing problems.

---

## C-13. Medication-safety panel's backend wiring could not be confirmed

**Where it happens**: `EncounterMedicationSafetyPanel.vue` accepts a full set of medication-context props (patient, appointment, admission, catalog item, code, name, dosage instruction, clinical indication, quantity) suggestive of a drug-interaction/allergy/safety-check feature, but the specific API endpoint it calls was not located in the audited frontend code (`11-integration-points.md` §11.4; `14-unknown-missing-information.md` §14.4).

**Why it is dangerous in a hospital context**: If this panel's safety-check call is not reliably wired to a live backend validation (or fails silently/is bypassable), clinicians and reviewers may believe a medication-safety check has occurred simply because the panel is present in the UI, when in fact its actual verification behavior is unconfirmed.

**Real-world clinical risk**: A false sense of safety-net coverage around prescribing — this is flagged as an **unverified risk** rather than a confirmed defect, precisely because the audit could not establish what the panel actually does at runtime.

**Severity: Medium (unverified — confidence lower than other items in this report)**

**Update — verified, not a defect**: `EncounterInlineOrderPanel.vue` imports `EncounterMedicationSafetyPanel` from `resources/js/components/domain/clinical/EncounterMedicationSafetyPanel.vue` (present on disk) and calls `fetchPatientMedicationSafetySummary()` (`resources/js/lib/encounterInlineOrders.ts:209`), which hits `GET /patients/{id}/medication-safety-summary`. That route is wired to `PatientMedicationSafetyController::medicationSafetySummary()` → `GetPatientMedicationSafetySummaryUseCase`, which returns real allergy conflicts, drug-interaction conflicts, laboratory signals, and dosing-sanity rules (including pediatric weight-based dosing, high-dose alerts, and route/form mismatch checks), with over 30 scenario tests in `tests/Feature/Patient/PatientApiTest.php`. The panel is reliably wired to a live, substantive safety check — this finding is closed as verified-safe, no code change required.

---

## C-14. Encounter status can change through an unguarded side-channel with weaker validation than the explicit status API

**Where it happens**: `EncounterLifecycleService::syncFromMedicalRecordStatus()` — triggered automatically whenever a linked note's content or status changes — has no `InvalidEncounterStatusTransitionException` guard at all (aside from two special-cased overrides for `OPENED` and `READY_FOR_SIGN`). By contrast, `markReadyForSign()`, `close()`, and `reopen()` — the methods reachable through the explicit `PATCH /encounters/{id}/status` API — all validate the current status against an allow-list before transitioning and throw on violation (`04-clinical-note-lifecycle.md` §4.2, §12.3).

**Why it is dangerous in a hospital context**: Two different code paths govern the same `status` column with materially different rigor: one (API-driven) is a validated state machine; the other (note-driven, automatic) is essentially unconstrained pass-through logic layered with only two special cases.

**Real-world clinical risk**: The encounter's status — which the close-readiness and workspace-display logic both treat as meaningful signal — can be moved between most of its values purely as a side effect of note edits, without going through the same scrutiny as an explicit, user-initiated status change. This weakens the reliability of `encounter.status` as an indicator of the visit's true state, since it can be pushed around implicitly and silently.

**Severity: Medium**

---

## C-15. `CANCELLED` encounter status is enumerated but has no governed transition path

**Where it happens**: `EncounterStatus::CANCELLED` exists as a value on the enum, but no code path within the audited `EncounterLifecycleService`/`UpdateEncounterStatusUseCase` was found that ever assigns it (`04-clinical-note-lifecycle.md` §4.2; `14-unknown-missing-information.md` §14.1).

**Why it is dangerous in a hospital context**: A status value that exists in the domain model but has no first-party, audited, guard-checked assignment path implies that if anything outside this audited code (a script, an admin tool, a raw DB update, or an unaudited code path) ever sets it, that transition would bypass every guard and audit-log write that governs every other encounter transition in this system.

**Real-world clinical risk**: An encounter could enter a state (`cancelled`) with no confirmed rule for what that means for its linked orders, notes, or billing, and no audit trail proving how or why it got there, since the only transition logic this audit could verify never produces that value.

**Severity: Low-Medium (contingent — depends on unaudited code that may or may not exist)**

**Update — confirmed, no action taken**: a repo-wide search for `EncounterStatus::CANCELLED` found zero references outside the enum declaration itself. `EncounterLifecycleService`'s every status-writing method (`close()`, `reopen()`, `markReadyForSign()`, `syncFromMedicalRecordStatus()`) has an explicit allow-list that excludes it, and `UpdateEncounterStatusRequest::rules()` whitelists only `closed`/`reopened`/`in_progress` at the API boundary — a request for `status: cancelled` is rejected by validation before reaching any use case. This is no longer contingent: within application code, the case is confirmed unreachable. Reviewed with the product owner, who chose to leave it as-is (reserved-but-unbuilt, not cruft to delete, not a feature to build now) — revisit only if a cancel-encounter feature is actually requested.

---

## C-16. No duplicate-submission protection outside the appointment-linked consultation-note path

**Where it happens**: `DuplicateEncounterDraftMedicalRecordException` is only raised when `appointment_id` is set **and** `record_type = consultation_note` (`03-workflow-reconstruction.md` §3.2, step 9). Every other note type, and every note not linked to an appointment, has no equivalent guard against a retried/duplicated create request.

**Why it is dangerous in a hospital context**: A network retry, a double-click, or a client-side retry-after-422 flow (the frontend itself implements a retry-as-update pattern for exactly this scenario, but only for the appointment/consultation-note case — `05-saving-mechanism.md` §5.4) has no server-side backstop for progress notes, nursing notes, discharge notes, admission notes, referral notes, or procedure notes.

**Real-world clinical risk**: Documentation can fragment into multiple parallel draft rows for what was intended to be a single note, for every note type other than the one case the system explicitly guards — splitting a clinician's documentation across records that the rest of the system (workspace primary-record resolution, close-readiness) is not designed to reconcile or merge.

**Severity: Medium**

---

## Summary by requested category

| Category | Findings |
|---|---|
| Cross-module state inconsistencies | C-3, C-6, C-7, C-14 |
| Broken or missing state transitions | C-2, C-3, C-14, C-15 |
| Race conditions / concurrency risks | C-1, C-4, C-9, C-16 |
| Misalignment between encounter, note, and orders | C-2, C-6, C-8, C-12 |
| "Completed" ≠ clinically complete | C-2, C-5, C-8, C-11 |
| Violations of expected EHR logic | C-2, C-5, C-10, C-12 |

## Severity roll-up

| Severity | Count | Findings |
|---|---|---|
| Critical | 3 | C-1, C-2, C-3 |
| High | 4 | C-4, C-5, C-6, C-7 |
| Medium-High | 2 | C-8, C-11 |
| Medium | 6 | C-9, C-10, C-12, C-13, C-14, C-16 |
| Low-Medium | 1 | C-15 |
