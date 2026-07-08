# 3. Workflow Reconstruction

Each step below is supported directly by code; steps or transitions not found in code are marked explicitly.

## 3.1 Appointment → Encounter resolution

Entry points (backend): `GET v1/encounters/by-appointment/{appointmentId}` → `EncounterController::resolveForAppointment` → `ResolveEncounterForAppointmentUseCase`.

`ResolveEncounterForAppointmentUseCase::execute($appointmentId, $actorId, $includeWorkspace)`:
1. Looks up the appointment via `AppointmentLookupServiceInterface`; returns `null` if not found.
2. Requires the appointment to have a `patient_id`, else throws `AppointmentNotEligibleForMedicalRecordException('Appointment must be linked to a patient before opening an encounter.')`.
3. Calls `EncounterResolverService::findOrCreateForVisit(patientId, appointmentId, admissionId: null, actorId)`.
4. If `$includeWorkspace` is true, returns the full workspace payload (via `GetEncounterWorkspaceUseCase`); otherwise returns a minimal shape with only `encounter` and `appointment` populated — `primaryMedicalRecord`, `laboratoryOrders`, `pharmacyOrders`, `radiologyOrders`, `theatreProcedures` are hardcoded empty/null placeholders in that branch.

`EncounterResolverService::findOrCreateForVisit(...)` (the actual resolution algorithm):
1. If a specific `requestedEncounterId` was passed, loads and validates it belongs to the same patient/appointment/admission context; if valid, returns it as-is (no creation).
2. Otherwise requires at least one of `appointmentId`/`admissionId`.
3. Searches for an existing encounter for that patient scoped by `appointment_id` (preferred) or `admission_id`, most-recently-updated first; reuses it if found — **no new encounter is created** in this branch.
4. Otherwise creates a new `EncounterModel` row: generates `encounter_number` (`ENC{Ymd}{RANDOM6}`, retried up to 10 times for uniqueness), sets `tenant_id`/`facility_id` from platform scope context, `patient_id`, `appointment_id`, `admission_id`, `primary_clinician_user_id = actorId`, `status = OPENED`, `opened_at = now()`. Writes audit log entry `encounter.opened`.

Frontend: `resources/js/pages/encounters/Show.vue` and the `encounters/by-appointment` route lead into `Workspace.vue`, which calls the same resolve endpoint via `apiRequest` to bootstrap the workspace (`encounterWorkspaceBootstrapping` flag).

## 3.2 Consultation begins / Note creation

Frontend `Workspace.vue` holds a `createForm` reactive object (fields: `patientId`, `encounterId`, `appointmentId`, `admissionId`, `appointmentReferralId`, `theatreProcedureId`, `encounterAt`, `recordType`, `diagnosisCode`, `subjective`, `objective`, `assessment`, `plan`). There is no separate "New Note" page — the composer lives inline on the `'new'` tab of the same Workspace page (`medicalRecordTab.value === 'new'`).

Note-type selection is driven by `MEDICAL_RECORD_NOTE_TYPE_OPTIONS` (7 entries: consultation_note, admission_note, progress_note, discharge_note, referral_note, nursing_note, procedure_note — `resources/js/pages/medical-records/noteTypes.ts:3-39`), each rendering type-specific section labels/placeholders (`MEDICAL_RECORD_NOTE_TYPE_SECTION_UI`, `noteTypes.ts:145-355`) but no type-specific required-field rules beyond what the backend enforces.

Backend creation: `POST v1/medical-records` → `MedicalRecordController::store` → `StoreMedicalRecordRequest` (validates `patientId` required uuid, `encounterAt` required date, `recordType` required + must be in `MedicalRecordNoteType::values()`, `diagnosisCode` optional ICD-10-style regex, free-text SOAP fields optional strings) → `CreateMedicalRecordUseCase::execute()`:
1. Tenant-scope write guard.
2. Patient existence check.
3. If `appointment_id` present: validates appointment exists and belongs to the patient; checks consultation ownership (if the appointment is `in_consultation` and owned by a different user, throws `ConsultationOwnerConflictForMedicalRecordException`).
4. If `admission_id` present: validates it belongs to the patient.
5. Validates `record_type` is a recognized value.
6. If `appointment_referral_id` present: only allowed when `record_type = referral_note`; validates the referral exists against the appointment.
7. If `theatre_procedure_id` present: only allowed when `record_type = procedure_note`; validates the procedure belongs to the patient and matches the supplied appointment/admission context.
8. Resolves/creates the `Encounter` via `EncounterResolverService::findOrCreateForVisit()` if any visit-context id is present; otherwise `encounter_id` is left null.
9. Duplicate-draft guard: if `appointment_id` is set and `record_type = consultation_note`, checks for an existing draft for that appointment via `findLatestDraftForAppointment()`; throws `DuplicateEncounterDraftMedicalRecordException` if one exists.
10. Validates `diagnosis_code` (ICD-10-style regex; catalog match only enforced if the catalog has at least one active code).
11. Sets `status = draft`, generates a unique `record_number` (`MR{Ymd}{RANDOM6}`), sets `tenant_id`/`facility_id`, sets `author_user_id` to the actor.
12. Inserts the `MedicalRecordModel` row.
13. Writes an audit log entry `medical-record.created`.
14. Unconditionally creates a `MedicalRecordVersionModel` snapshot (version 1) of all tracked fields.

## 3.3 Editing / Saving (draft)

See [05-saving-mechanism.md](05-saving-mechanism.md) for full detail on autosave/manual save. In summary: while `status = draft`, `PATCH v1/medical-records/{id}` (`UpdateMedicalRecordUseCase`) is the only way to change content; it is blocked entirely (`MedicalRecordContentLockedException`) once status leaves `draft`. Each successful content update that changes at least one tracked field creates a new version row and an audit log entry, and calls `EncounterLifecycleService::markInProgress()` on the linked encounter (transitions `OPENED → IN_PROGRESS`, no-op otherwise).

## 3.4 Ordering labs / imaging / procedures

These are not initiated from within the MedicalRecord or Encounter Application-layer code audited here — order creation lives in the Laboratory/Radiology/Pharmacy/TheatreProcedure modules' own UseCases (out of this report's inspected scope beyond their read/display path). What is confirmed:
- Once created (in those other modules) with a matching `encounter_id`, orders become visible in the Encounter workspace: `GetEncounterWorkspaceUseCase` queries `LaboratoryOrderModel`/`PharmacyOrderModel`/`RadiologyOrderModel`/`TheatreProcedureModel` directly by `encounter_id` (limited to 6 most-recent active rows each) and includes them in the `encounters/{id}?view=workspace` response.
- Frontend renders these via `EncounterOrdersCommandCenter.vue`, `encounter-orders/EncounterInlineOrderPanel.vue`, `EncounterOrderProgress.vue`, `EncounterMedicationSafetyPanel.vue` inside `Workspace.vue`.
- Pending (non-terminal-status) orders count directly into the encounter close-readiness checklist (see [04](04-clinical-note-lifecycle.md) and [11](11-integration-points.md)).
- **Not found in code**: any call from `CreateMedicalRecordUseCase`/`UpdateMedicalRecordUseCase` that itself creates a lab/imaging/pharmacy order as a side-effect of saving a note — ordering is a separate, parallel action in the workspace UI, not a note-save side-effect.

## 3.5 Diagnosis

`diagnosis_code` is a single field on the `MedicalRecordModel` (not a separate diagnoses table). Validated in both create and update use cases: normalized to uppercase/trimmed, must match `/^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$/`, and — only if the diagnosis-terminology catalog has at least one active entry — must exactly match an active catalog code (`DiagnosisTerminologyLookupService`, backed by `ClinicalCatalogItemRepositoryInterface` filtered to `ClinicalCatalogType::DIAGNOSIS_CODE`). The close-readiness checklist's `diagnosis_documented` item passes if either `diagnosis_code` or `assessment` is non-empty on the resolved primary note.

## 3.6 Prescriptions

**Not found in code** within `app/Modules/MedicalRecord` or `app/Modules/Encounter` — no reference to a "prescription" concept or Pharmacy order creation originates from these two modules' Application layers. Pharmacy orders are only *read* (by `encounter_id`) for workspace display and close-readiness counting, as described in 3.4. The `EncounterMedicationSafetyPanel.vue` component accepts medication-related props (`approvedMedicineCatalogItemId`, `medicationCode`, `medicationName`, `dosageInstruction`, `clinicalIndication`, `quantityPrescribed`) suggesting a prescribing UI exists in the workspace, but the API endpoint it calls was not located within the audited files — **Not found in code** beyond the prop contract.

## 3.7 Completion / Finalization

Backend: `PATCH v1/medical-records/{id}/status` → `UpdateMedicalRecordStatusRequest` (status-specific permission: `finalize`/`amend`/`archive`) → `UpdateMedicalRecordStatusUseCase`. See [04](04-clinical-note-lifecycle.md) for the full transition table, including the finalize-after-sign→amended override and the amend-request→draft override.

On successful status update:
- Writes audit log `medical-record.status.updated`.
- Creates a new version row if any tracked status-lifecycle field changed.
- Calls `EncounterLifecycleService::syncFromMedicalRecordStatus()` on the linked encounter, which maps `finalized→SIGNED` (or `IN_PROGRESS` if the encounter was still `OPENED`), `amended→AMENDED`, `draft→IN_PROGRESS` (or preserves `READY_FOR_SIGN` if that was the current encounter status).

Frontend: `updateRecordStatus()` in `Workspace.vue` calls this endpoint; a confirmation dialog (`submitRecordStatusDialog`) requires a non-empty reason when the action is `amended` or `archived`. After a successful `finalized` action, `openFinalizeFollowUp()` is invoked (behavior not further traced in this report).

## 3.8 Encounter close

Separate from note finalization: `PATCH v1/encounters/{id}/status` with `status=closed` → `UpdateEncounterStatusUseCase` → `EncounterLifecycleService::close()`. Requires the current encounter status to be one of `OPENED, SIGNED, AMENDED, IN_PROGRESS, READY_FOR_SIGN`, then evaluates `GetEncounterCloseReadinessUseCase` and enforces the checklist (blocking item must pass; warning items can be overridden with `acknowledgeCloseGaps=true` + a non-empty `reason`). On success, sets `status=CLOSED`, `closed_at=now()`, writes audit log `encounter.closed`. Frontend surfaces this via `EncounterCloseChecklistDialog.vue`, which disables the confirm button unless `readiness.canClose` is true and, if `requiresAcknowledgement`, requires a reason of at least 3 characters (`canConfirm` computed, `EncounterCloseChecklistDialog.vue:43-53`).

## 3.9 Signer attestation (separate from status finalize)

`POST v1/medical-records/{id}/signer-attestations` → `CreateMedicalRecordSignerAttestationUseCase`: requires an authenticated actor, requires the record's status to already be `finalized` or `amended`, requires a non-blank `attestationNote`. Writes a row to `medical_record_signer_attestations` and an audit log entry `medical-record.signer-attested`. **This does not itself change the record's `status`, `signed_by_user_id`, or `signed_at`** — those fields are set only by `UpdateMedicalRecordStatusUseCase` when `status=finalized` is requested (see [04](04-clinical-note-lifecycle.md)). **Not found in code**: any enforcement that a signer attestation is required before a note can be finalized — attestation and the `signed_at`/`signed_by_user_id` fields are set independently of each other.
