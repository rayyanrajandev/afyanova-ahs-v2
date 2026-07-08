# 10. Configuration Inventory

Only configurable behaviors verified in code are listed. No feature-flag system (e.g. Laravel Pennant, a `feature_flags` table, or `config('features.*')` reads) was found referenced anywhere in the audited MedicalRecord/Encounter files.

## 10.1 Required fields (validation-level configuration)

Defined as literal `rules()` arrays in FormRequest classes (see [08-api-inventory.md](08-api-inventory.md) §8.4 for full verbatim rules) — these are hardcoded, not sourced from a config file or database:
- Note creation requires `patientId`, `encounterAt`, `recordType`.
- Diagnosis code, when supplied, must match the hardcoded regex `/^[A-Za-z][0-9]{2}(?:\.[A-Za-z0-9]{1,4})?$/` (Store) / `/^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$/` (Application-layer re-check, uses same pattern post-normalization).
- A `reason` is required only when a status-change request targets `amended` or `archived` (MedicalRecord) or `reopened` (Encounter) — encoded as `required_if` rules, not configurable at runtime.

## 10.2 Diagnosis-catalog enforcement — the one genuinely data-driven rule

`DiagnosisTerminologyLookupService::hasAnyActiveDiagnosisCodes()` queries the `ClinicalCatalogItemRepositoryInterface` (Platform module) for active entries of type `DIAGNOSIS_CODE`. Catalog match is **only enforced if at least one active diagnosis code exists in that catalog** — if the catalog is empty, any regex-valid code is accepted. This makes diagnosis-code strictness effectively a data-configuration (whatever is seeded/administered into the Platform clinical-catalog admin UI), not a static application setting. Lookup is capped at the first 100 active results per page (`isActiveDiagnosisCode()`), so a catalog with more than 100 active codes could miss matches beyond the first page — this is an implementation limit, not a configured value.

## 10.3 Note types (fixed, not admin-configurable)

The 7 `MedicalRecordNoteType` values and their per-type UI copy (headings, section placeholders/labels) are hardcoded PHP enum cases and a hardcoded TypeScript metadata file (`resources/js/pages/medical-records/noteTypes.ts`) — no database table or admin screen drives these; adding a note type requires a code change in both places.

## 10.4 Status transition rules (hardcoded)

The MedicalRecord and Encounter status transition tables (see [04](04-clinical-note-lifecycle.md)) are hardcoded `match`/`switch`/array-lookup logic inside `UpdateMedicalRecordStatusUseCase::isTransitionAllowed()` and `EncounterLifecycleService`'s individual methods — not sourced from configuration.

## 10.5 Permissions (data-driven, but registration source out of scope)

Every authorization check is a literal permission-string (`medical.records.read`, `.create`, `.update`, `.finalize`, `.amend`, `.archive`, `.attest`, `medical-records.update-draft`, `medical-records.view-audit-logs`). These strings are checked via `$user->can(...)`, implying a Spatie-permissions-style role/permission assignment system exists and is configurable per-role — but the actual registration/seeding of these permission strings (e.g. a seeder or permission-registration provider) was **not inspected** in this audit. **Not found in code** within the audited file set.

## 10.6 File upload limits (encounter clinical documents)

Hardcoded in `StoreEncounterClinicalDocumentRequest::rules()`: max file size 20480 KB (20MB); allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`. The FormRequest's `messages()` method additionally computes a human-readable upload-limit label from PHP's own `upload_max_filesize`/`post_max_size` ini settings for the error message shown when a file exceeds the *server's* limit (distinct from and potentially lower than the 20MB application-level rule) — this is the one place server `php.ini` configuration feeds into user-facing behavior.

## 10.7 Autosave timing (hardcoded frontend constants)

Debounce interval **1500ms** and max-wait interval **15000ms** are literal numeric constants in `Workspace.vue` (`scheduleMedicalRecordCreateDraftAutosave()`), not sourced from any config/env value.

## 10.8 Pagination limits (hardcoded per use case)

- List/search use cases (`ListMedicalRecordsUseCase`, `ListMedicalRecordAuditLogsUseCase`, `ListMedicalRecordSignerAttestationsUseCase`, `ListMedicalRecordVersionsUseCase`, `ListEncounterClinicalDocumentsUseCase`, `ListEncounterAuditLogsUseCase`): `perPage` clamped to the range 1–100, default 15 (records list) or unspecified default for others.
- CSV audit-log export (`MedicalRecordController::exportAuditLogsCsv`, `EncounterController::exportAuditLogsCsv`): fixed internal page size of 100 per page while streaming.
- `GetEncounterWorkspaceUseCase`: caps laboratory/pharmacy/radiology/theatre-procedure lists to the 6 most recent rows each (`CARE_ARTIFACT_LIMIT = 6`).
- `GetEncounterCloseReadinessUseCase`'s billing-candidate check: `limit: 200` passed to `ListBillingChargeCaptureCandidatesUseCase`.

None of these numeric limits were found sourced from a config file — all are literal constants in the PHP/TS source.

## 10.9 Tenant/facility scoping

`CurrentPlatformScopeContextInterface` and `TenantIsolationWriteGuardInterface` are consulted on every write path (`assertTenantScopeForWrite()`), and `tenant_id`/`facility_id` are stamped onto new `medical_records`/`encounters` rows from the current platform scope context. This is an enforced-on-every-write behavior, not an optional/configurable toggle at the level audited (the underlying `EnforceTenantIsolationWhenEnabled` middleware name suggests a global on/off switch exists at the platform level, but its configuration source was **not inspected** — out of scope).

## 10.10 Not found in code

- Any feature-flag mechanism gating clinical-note behavior.
- A configurable/admin-editable "required fields" or "completion rules" setting (all such rules are hardcoded in FormRequests/UseCases as described above).
- A configurable autosave interval (hardcoded, see 10.7).
- A configurable file-locking/content-locking toggle (locking is unconditional once status leaves `draft`).
- The source of permission-string registration/seeding.
