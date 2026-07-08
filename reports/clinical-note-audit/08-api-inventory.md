# 8. API Inventory

All routes below (except the Inertia/web ones at the bottom) are under the `v1` prefix and the shared middleware group described in [07-backend-behaviour.md](07-backend-behaviour.md) §7.1.

## 8.1 MedicalRecord endpoints

| Method | URI | Name | Controller@action | Permission |
|---|---|---|---|---|
| GET | `medical-records` | medical-records.index | `MedicalRecordController@index` | `can:medical.records.read` |
| GET | `medical-records/status-counts` | medical-records.status-counts | `MedicalRecordController@statusCounts` | `can:medical.records.read` |
| POST | `medical-records` | medical-records.store | `MedicalRecordController@store` | `can:medical.records.create` |
| GET | `medical-records/{id}` | medical-records.show | `MedicalRecordController@show` | `can:medical.records.read` |
| PATCH | `medical-records/{id}` | medical-records.update | `MedicalRecordController@update` | `can:medical-records.update-draft,id` (route) + object-scoped re-check in `FormRequest::authorize()` |
| PATCH | `medical-records/{id}/status` | medical-records.update-status | `MedicalRecordController@updateStatus` | enforced only inside `UpdateMedicalRecordStatusRequest::authorize()` (status-specific: finalize/amend/archive) |
| GET | `medical-records/{id}/audit-logs/export` | medical-records.audit-logs.export | `MedicalRecordController@exportAuditLogsCsv` | `can:medical-records.view-audit-logs` |
| GET | `medical-records/{id}/audit-logs` | medical-records.audit-logs | `MedicalRecordController@auditLogs` | `can:medical-records.view-audit-logs` |
| GET | `medical-records/{id}/versions` | medical-records.versions.index | `MedicalRecordController@versions` | `can:medical.records.read` |
| GET | `medical-records/{id}/versions/{versionId}/diff` | medical-records.versions.diff | `MedicalRecordController@versionDiff` | route-level `can:medical.records.read` only (FormRequest `authorize()` just checks the user is authenticated) |
| GET | `medical-records/{id}/signer-attestations` | medical-records.signer-attestations.index | `MedicalRecordController@signerAttestations` | `can:medical.records.read` |
| POST | `medical-records/{id}/signer-attestations` | medical-records.signer-attestations.store | `MedicalRecordController@storeSignerAttestation` | `medical.records.read` + `medical.records.attest` (both in FormRequest) |

## 8.2 Encounter endpoints

| Method | URI | Name | Controller@action | Permission |
|---|---|---|---|---|
| GET | `encounters/by-appointment/{appointmentId}` | encounters.by-appointment.resolve | `EncounterController@resolveForAppointment` | `can:medical.records.read` |
| GET | `encounters/{id}` | encounters.show | `EncounterController@show` | `can:medical.records.read` |
| PATCH | `encounters/{id}/status` | encounters.update-status | `EncounterController@updateStatus` | enforced only inside `UpdateEncounterStatusRequest::authorize()` |
| GET | `encounters/{id}/audit-logs/export` | encounters.audit-logs.export | `EncounterController@exportAuditLogsCsv` | `can:medical-records.view-audit-logs` |
| GET | `encounters/{id}/audit-logs` | encounters.audit-logs | `EncounterController@auditLogs` | `can:medical-records.view-audit-logs` |
| GET | `encounters/{id}/clinical-documents` | encounters.clinical-documents.index | `EncounterClinicalAttachmentController@index` | `can:medical.records.read` |
| POST | `encounters/{id}/clinical-documents` | encounters.clinical-documents.store | `EncounterClinicalAttachmentController@store` | `can:medical.records.create` (route); FormRequest `authorize()` allows any authenticated user |
| GET | `encounters/{id}/clinical-documents/{documentId}` | encounters.clinical-documents.show | `EncounterClinicalAttachmentController@show` | `can:medical.records.read` |
| PATCH | `encounters/{id}/clinical-documents/{documentId}` | encounters.clinical-documents.update | `EncounterClinicalAttachmentController@update` | `can:medical.records.update` (route); FormRequest allows any authenticated user |
| PATCH | `encounters/{id}/clinical-documents/{documentId}/status` | encounters.clinical-documents.update-status | `EncounterClinicalAttachmentController@updateStatus` | `can:medical.records.update` (route); FormRequest allows any authenticated user |
| GET | `encounters/{id}/clinical-documents/{documentId}/download` | encounters.clinical-documents.download | `EncounterClinicalAttachmentController@download` | `can:medical.records.read` |

## 8.3 Web (Inertia) routes

| Method | URI | Name | Handler | Middleware |
|---|---|---|---|---|
| GET | `encounters/{encounterId}` | encounters.show | closure → Inertia `encounters/Show` | `auth, verified, can:medical.records.read, can:medical.records.create, facility.entitlement:medical_records.core` |
| GET | `encounters/by-appointment/{appointmentId}` | encounters.by-appointment | closure → Inertia `encounters/Show` | same |
| GET | `medical-records` | medical-records.page | closure → Inertia `medical-records/Index` | `auth, verified, can:medical.records.read, facility.entitlement:medical_records.core` |
| GET | `medical-records/{id}/print` | medical-records.print.page | `MedicalRecordDocumentController@show` | same |
| GET | `medical-records/{id}/pdf` | medical-records.pdf.download | `MedicalRecordDocumentController@downloadPdf` | same |
| GET | `encounters/{id}/print` | encounters.print.page | `EncounterDocumentController@show` | same |
| GET | `encounters/{id}/pdf` | encounters.pdf.download | `EncounterDocumentController@downloadPdf` | same |

## 8.4 Request validation rules (verbatim, key endpoints)

**`StoreMedicalRecordRequest`**: `patientId` required uuid; `encounterId`/`admissionId`/`appointmentId`/`appointmentReferralId`/`theatreProcedureId` nullable uuid; `authorUserId` nullable integer `exists:users,id`; `encounterAt` required date; `recordType` required string max:100, `Rule::in(MedicalRecordNoteType::values())`; `subjective`/`objective`/`assessment`/`plan` nullable string; `diagnosisCode` nullable string max:50, regex `/^[A-Za-z][0-9]{2}(?:\.[A-Za-z0-9]{1,4})?$/`. `prepareForValidation()` uppercases/trims `diagnosisCode` and normalizes `recordType`.

**`UpdateMedicalRecordRequest`**: same content fields as store but `sometimes`; plus `expectedUpdatedAt` nullable date, `forceDraftSave` sometimes boolean; `status`/`statusReason`/`reason`/`signedByUserId`/`signedAt` explicitly `prohibited`. Requires at least one `ALLOWED_FIELDS` key present.

**`UpdateMedicalRecordStatusRequest`**: `status` required, `Rule::in(MedicalRecordStatus::values())`; `reason` nullable string max:255, `required_if:status,amended,archived`.

**`ShowMedicalRecordVersionDiffRequest`**: `againstVersionId` nullable uuid.

**`StoreMedicalRecordSignerAttestationRequest`**: `attestationNote` required string max:2000 (trimmed in `prepareForValidation`).

**`UpdateEncounterStatusRequest`**: `status` required, `Rule::in([closed, reopened, in_progress])`; `reason` nullable string max:255, `required_if:status,reopened`; `acknowledgeCloseGaps` nullable boolean.

**`StoreEncounterClinicalDocumentRequest`**: `documentType` required string max:60; `title` required string max:255; `description` nullable string max:2000; `file` required file max:20480 KB, `mimetypes:application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain`.

**`UpdateEncounterClinicalDocumentRequest`**: `documentType`/`title`/`description` all `sometimes`; `status`/`reason`/`statusReason` explicitly `prohibited`. Requires at least one allowed field present.

**`UpdateEncounterClinicalDocumentStatusRequest`**: `status` required string `Rule::in(EncounterClinicalDocumentStatus::values())`; `reason` nullable string max:255, required when status is `archived`.

## 8.5 Response shapes (transformers)

- **`MedicalRecordResponseTransformer`**: `id, recordNumber, patientId, encounterId, admissionId, appointmentId, appointmentReferralId, theatreProcedureId, authorUserId, encounterAt, recordType, subjective, objective, assessment, plan, diagnosisCode, status, statusReason, signedByUserId, signedByUserName, authorUserName, signedAt, createdAt, updatedAt`.
- **`MedicalRecordAuditLogResponseTransformer`**: `id, medicalRecordId, actorId, action, changes, metadata, createdAt` (+ label enrichment via `AuditLogPresenter::enrich`, internals not inspected).
- **`MedicalRecordSignerAttestationResponseTransformer`**: `id, medicalRecordId, attestedByUserId, attestedByUserName, attestationNote, attestedAt, createdAt, updatedAt`.
- **`MedicalRecordVersionResponseTransformer`**: `id, medicalRecordId, versionNumber, snapshot, changedFields, createdByUserId, createdAt`.
- **`MedicalRecordVersionDiffResponseTransformer`**: `targetVersion, baseVersion, diff[] {field, before, after}, summary.changedFieldCount`.
- **`EncounterResponseTransformer`**: `id, encounterNumber, patientId, appointmentId, admissionId, primaryClinicianUserId, status, statusReason, openedAt, closedAt, createdAt, updatedAt`.
- **`EncounterWorkspaceResponseTransformer`**: `encounter, appointment, primaryMedicalRecord, laboratoryOrders[], pharmacyOrders[], radiologyOrders[], theatreProcedures[], closeReadiness`.
- **`EncounterClinicalDocumentResponseTransformer`**: `id, encounterId, patientId, tenantId, facilityId, documentType, title, description, originalFilename, mimeType, fileSizeBytes, checksumSha256, status, statusReason, uploadedByUserId, createdAt, updatedAt`.
- **`EncounterAuditLogResponseTransformer`**: same base shape as medical-record audit log, with a 9-entry action→label map (opened, status.updated, closed, reopened, document.pdf.downloaded, clinical-document.uploaded/updated/status.updated/downloaded).
- **`EncounterCloseReadinessResponseTransformer`**: `canClose, requiresAcknowledgement, blockingCount, warningCount, items[] {id, label, severity, status, message, count}, billingSummary {pendingCandidates, alreadyInvoiced, totalCandidates, currencyCode}`.

## 8.6 Authorization mechanism

No `MedicalRecordPolicy`/`EncounterPolicy` class and no `Gate::define(` registration were found — authorization is done exclusively via `$user->can('permission.string', ...)` checks (Spatie-style permission strings), applied either as route middleware (`can:`) or inside `FormRequest::authorize()`. The source of permission-string registration (seeder/config) was not inspected in this audit — **Not found in code** within the audited scope.

Notably, several write endpoints (`medical-records.update-status`, `encounters.update-status`, `encounters.clinical-documents.store/update/update-status`) have **no** `can:` middleware at the route level — their only authorization gate is inside the corresponding `FormRequest::authorize()` method (or, for the three clinical-document mutation endpoints, the route-level `can:medical.records.create`/`.update` — their own FormRequests' `authorize()` allow any authenticated user).
