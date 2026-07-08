# 11. Integration Points

## 11.1 Appointment

- `MedicalRecord\Infrastructure\Services\AppointmentLookupService` implements `AppointmentLookupServiceInterface`, wrapping `Appointment\Domain\Repositories\AppointmentRepositoryInterface`. Methods: `findById()`, `isValidForPatient()` (compares `patient_id`).
- `CreateMedicalRecordUseCase`/`UpdateMedicalRecordUseCase` call `findById()` when `appointment_id` is present and throw `AppointmentNotEligibleForMedicalRecordException` on not-found or patient mismatch.
- Consultation-ownership check: if the appointment's `status` is `in_consultation`, the acting user must match the appointment's owner (`consultation_owner_user_id`, fallback `clinician_user_id`), else `ConsultationOwnerConflictForMedicalRecordException` — checked at create, update, and status-update time.
- `MedicalRecord\Infrastructure\Services\AppointmentReferralLookupService` wraps `AppointmentReferralRepositoryInterface::findByAppointmentAndId()`, used to validate `appointment_referral_id` against the linked appointment for `referral_note` records.
- `Encounter\Application\Services\EncounterResolverService::findOrCreateForVisit()` accepts `appointmentId`, resolves/creates an `EncounterModel` keyed by `patient_id + appointment_id`.
- `GetEncounterWorkspaceUseCase` embeds the linked appointment (via `AppointmentLookupServiceInterface::findById()` + `AppointmentResponseTransformer`) in the workspace payload.
- **Mechanism**: Domain interface/port (hexagonal boundary) in both directions of use.

## 11.2 Laboratory

- `GetEncounterWorkspaceUseCase::loadLaboratoryOrders()` queries `Laboratory\Infrastructure\Models\LaboratoryOrderModel` **directly** (cross-module Eloquent import, not a port) filtered by `encounter_id` and `entry_state = ACTIVE`, limited to 6, most-recent first.
- `GetEncounterCloseReadinessUseCase::countPendingLaboratoryOrders()` queries the same model, excluding `entered_in_error_at` rows and statuses in `[completed, cancelled]`; feeds the `pending_orders` checklist item.
- Reverse direction: `LaboratoryOrderModel` and its repository/controller/transformer reference an `encounter_id` column, but contain no reference to `EncounterModel`/`MedicalRecordModel` classes — the coupling is one-directional (Encounter reads Laboratory), tied together only by the shared foreign key.
- **Mechanism**: direct Eloquent model cross-import, no interface/port, keyed by shared `encounter_id` column.

## 11.3 Radiology

- Identical pattern to Laboratory: `GetEncounterWorkspaceUseCase::loadRadiologyOrders()` and `GetEncounterCloseReadinessUseCase::countPendingRadiologyOrders()` query `RadiologyOrderModel` directly by `encounter_id`/`entry_state`, excluding terminal statuses `[completed, cancelled]`.
- **Mechanism**: direct Eloquent model cross-import, keyed by `encounter_id`.

## 11.4 Pharmacy

- `GetEncounterWorkspaceUseCase::loadPharmacyOrders()` / `GetEncounterCloseReadinessUseCase::countPendingPharmacyOrders()` query `PharmacyOrderModel` directly by `encounter_id`/`entry_state`, excluding terminal statuses `[dispensed, cancelled, reconciliation_completed, reconciliation_exception]`.
- Frontend `EncounterMedicationSafetyPanel.vue` accepts patient/visit/medication props (`patientId`, `appointmentId`, `admissionId`, `approvedMedicineCatalogItemId`, `medicationCode`, `medicationName`, `dosageInstruction`, `clinicalIndication`, `quantityPrescribed`) for a medication-safety check — the exact API it calls was not located (**Not found in code** beyond the prop contract).
- No prescription-creation call was found originating from MedicalRecord/Encounter Application-layer code — see [03-workflow-reconstruction.md](03-workflow-reconstruction.md) §3.6.
- **Mechanism**: direct Eloquent model cross-import, keyed by `encounter_id`.

## 11.5 Billing

- `GetEncounterCloseReadinessUseCase` imports `Billing\Application\UseCases\ListBillingChargeCaptureCandidatesUseCase` directly and calls it with `patientId, encounterId, appointmentId, admissionId, includeInvoiced: false, limit: 200`, reading `meta.pending/alreadyInvoiced/total/currencyCode` to build the `billingSummary` that drives the `unbilled_services` checklist item.
- Frontend `EncounterBillingPanel.vue` consumes `readiness.billingSummary` and has an "Open billing invoice" action.
- **Mechanism**: direct Application-layer UseCase class import (no interface/port) — the only integration point in this feature where a concrete class from another module's Application layer is depended on directly rather than through a Domain interface.

## 11.6 Patient

- `MedicalRecord\Infrastructure\Services\PatientLookupService` implements `PatientLookupServiceInterface`, wrapping `Patient\Domain\Repositories\PatientRepositoryInterface::findById()`. Used by `CreateMedicalRecordUseCase`/`UpdateMedicalRecordUseCase` (`patientExists()`) — throws `PatientNotEligibleForMedicalRecordException` if the patient doesn't exist.
- **Mechanism**: Domain interface/port.

## 11.7 Admission

- `MedicalRecord\Infrastructure\Services\AdmissionLookupService` implements `AdmissionLookupServiceInterface`, wrapping `Admission\Domain\Repositories\AdmissionRepositoryInterface::findById()`. `isValidForPatient()` checked at create/update time — throws `AdmissionNotEligibleForMedicalRecordException` on mismatch.
- `EncounterResolverService::findOrCreateForVisit()` also accepts/stores `admissionId` directly on `EncounterModel`.
- `GetEncounterCloseReadinessUseCase` passes `$encounter->admission_id` straight through into the Billing use case call (plain column passthrough, no validation at that call site).
- **Mechanism**: Domain interface/port (MedicalRecord↔Admission validation); plain column passthrough (Encounter↔Billing).

## 11.8 TheatreProcedure

- `MedicalRecord\Infrastructure\Services\TheatreProcedureLookupService` implements `TheatreProcedureLookupServiceInterface`, wrapping `TheatreProcedureRepositoryInterface::findById()`. `CreateMedicalRecordUseCase::applyTheatreProcedureValidationBaseline()` only allows `theatre_procedure_id` linkage when `record_type = procedure_note`, and validates the procedure's `patient_id` matches — throws `TheatreProcedureNotEligibleForMedicalRecordException` otherwise.
- `GetEncounterWorkspaceUseCase`/`GetEncounterCloseReadinessUseCase` query `TheatreProcedureModel` directly by `encounter_id`, excluding `entered_in_error_at`, terminal statuses `[completed, cancelled]`.
- **Mechanism**: Domain interface/port for creation-time validation; direct Eloquent model cross-import for workspace display/readiness.

## 11.9 Platform (diagnosis catalog)

- `DiagnosisTerminologyLookupService` wraps `Platform\Domain\Repositories\ClinicalCatalogItemRepositoryInterface` filtered to `ClinicalCatalogType::DIAGNOSIS_CODE`. Used by both Create/UpdateMedicalRecordUseCase for diagnosis-code catalog validation (see [10-configuration-inventory.md](10-configuration-inventory.md) §10.2).
- **Mechanism**: Domain interface/port.

## 11.10 ServiceRequest

- **Not found in code** — no reference to the `ServiceRequest` module namespace exists in either `app/Modules/MedicalRecord` or `app/Modules/Encounter` (confirmed via direct namespace search of both directory trees).

## 11.11 Summary table

| Module | Direction | Mechanism | Data exchanged |
|---|---|---|---|
| Appointment | MedicalRecord/Encounter → Appointment | Domain interface/port | Appointment record (`patient_id`, `status`, consultation owner); referral record |
| Laboratory | Encounter → Laboratory | Direct Eloquent model import, shared `encounter_id` FK | Order rows filtered by `entry_state`/`status` |
| Radiology | Encounter → Radiology | Direct Eloquent model import, shared `encounter_id` FK | Order rows filtered by `entry_state`/`status` |
| Pharmacy | Encounter → Pharmacy | Direct Eloquent model import, shared `encounter_id` FK | Order rows filtered by `entry_state`/`status`; frontend medication-safety props |
| Billing | Encounter → Billing | Direct Application UseCase import | Pending/invoiced charge-capture candidate counts, currency code |
| Patient | MedicalRecord → Patient | Domain interface/port | Patient existence check |
| Admission | MedicalRecord → Admission; Encounter → Billing (passthrough) | Domain interface/port; plain column passthrough | Admission validity vs. patient; `admission_id` value |
| TheatreProcedure | MedicalRecord → TheatreProcedure (validation); Encounter → TheatreProcedure (display) | Domain interface/port; direct Eloquent model import | Procedure record (`patient_id`); procedure rows for workspace/readiness |
| Platform (diagnosis catalog) | MedicalRecord → Platform | Domain interface/port | Active ICD-10-style catalog entries |
| ServiceRequest | — | None found | Not found in code |
