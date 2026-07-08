# 9. Database Structure

## 9.1 Table: `medical_records`

Origin migration: `database/migrations/2026_02_25_000008_create_medical_records_table.php`, extended by `..._000028` (tenant/facility columns), `2026_03_16_000117` (signer/signed_at), `2026_04_18_000601` (appointment_referral_id), `2026_04_18_000602` (theatre_procedure_id), `2026_05_21_000002` (encounter_id).

| Column | Type | Nullable/Default |
|---|---|---|
| id | uuid (PK) | — |
| record_number | string | unique |
| tenant_id | uuid | nullable |
| facility_id | uuid | nullable |
| patient_id | uuid | not null |
| admission_id | uuid | nullable |
| appointment_id | uuid | nullable |
| encounter_id | uuid | nullable |
| appointment_referral_id | uuid | nullable |
| theatre_procedure_id | uuid | nullable |
| author_user_id | unsigned bigint (foreignId) | nullable |
| encounter_at | timestamp | not null |
| record_type | string | not null |
| subjective / objective / assessment / plan | text | nullable |
| diagnosis_code | string(50) | nullable |
| status | string(20) | default `'draft'` |
| status_reason | string | nullable |
| signed_by_user_id | foreignId | nullable |
| signed_at | timestamp | nullable, indexed |
| created_at / updated_at | timestamp | via `$table->timestamps()` |

Foreign keys: `patient_id`→`patients` (cascadeOnDelete); `admission_id`→`admissions` (nullOnDelete); `appointment_id`→`appointments` (nullOnDelete); `tenant_id`→`tenants` (nullOnDelete); `facility_id`→`facilities` (nullOnDelete); `signed_by_user_id`→`users` (nullOnDelete); `appointment_referral_id`→`appointment_referrals` (nullOnDelete); `theatre_procedure_id`→`theatre_procedures` (nullOnDelete); `encounter_id`→`encounters` (nullOnDelete).

Indexes: `[patient_id, encounter_at]`, `[status, encounter_at]`, `record_type`, `[tenant_id, encounter_at]`, `[facility_id, encounter_at]`, `signed_at`, `appointment_referral_id`, `theatre_procedure_id`, `encounter_id`.

No `locked_at`/`finalized_at` column. No soft-delete column.

## 9.2 Table: `medical_record_versions`

Migration `2026_03_16_000118`. `id` uuid PK; `medical_record_id` uuid; `version_number` unsigned int; `snapshot` json; `changed_fields` json nullable; `created_by_user_id` foreignId nullable; `created_at` only (`$timestamps = false` on the model).

Unique constraint `[medical_record_id, version_number]`. Index `[medical_record_id, created_at]`. FK `medical_record_id`→`medical_records` (cascadeOnDelete); `created_by_user_id`→`users` (nullOnDelete).

## 9.3 Table: `medical_record_audit_logs`

Migration `2026_02_25_000009`. `id` uuid PK; `medical_record_id` uuid; `actor_id` unsigned bigint nullable; `action` string; `changes` json nullable; `metadata` json nullable; `created_at` only.

Indexes `[medical_record_id, created_at]`, `[action, created_at]`. FK `medical_record_id`→`medical_records` (cascadeOnDelete). No relationship to `users` defined on the model for `actor_id`.

## 9.4 Table: `medical_record_signer_attestations`

Migration `2026_03_16_000119`. `id` uuid PK; `medical_record_id` uuid; `attested_by_user_id` foreignId nullable; `attestation_note` text not null; `attested_at` timestamp not null; plus standard `$table->timestamps()`.

Index `[medical_record_id, attested_at]`. FK `medical_record_id`→`medical_records` (cascadeOnDelete); `attested_by_user_id`→`users` (nullOnDelete). Model relationship: `attestedByUser()` belongsTo `User`.

## 9.5 Table: `encounters`

Migration `2026_05_21_000001`. `id` uuid PK; `encounter_number` string unique; `tenant_id`/`facility_id` uuid nullable; `patient_id` uuid not null; `appointment_id`/`admission_id` uuid nullable; `primary_clinician_user_id` foreignId nullable; `status` string(40) default `'opened'`; `opened_at`/`closed_at` timestamp nullable; `status_reason` string nullable; `$table->timestamps()`.

FKs: `tenant_id`→`tenants` (nullOnDelete); `facility_id`→`facilities` (nullOnDelete); `patient_id`→`patients` (cascadeOnDelete); `appointment_id`→`appointments` (nullOnDelete); `admission_id`→`admissions` (nullOnDelete).

Indexes: `[tenant_id, opened_at]`, `[facility_id, opened_at]`, `[patient_id, opened_at]`, `[appointment_id, status]`, `[admission_id, status]`, `[status, opened_at]`.

No `locked_at` column, no soft-delete column. **No `EncounterRepositoryInterface` domain repository abstraction exists** for this aggregate (unlike `MedicalRecordModel`) — code accesses `EncounterModel` directly via Eloquent from `EncounterLifecycleService`, `EncounterResolverService`, and `UpdateMedicalRecordUseCase::validatedEncounterId()`.

A cross-cutting migration, `2026_05_21_000002_add_encounter_id_to_clinical_artifacts.php`, adds a nullable, indexed `encounter_id` FK (→`encounters`, nullOnDelete) to `medical_records`, `laboratory_orders`, `pharmacy_orders`, `radiology_orders`, `theatre_procedures`, and `billing_invoices` — this shared column is the mechanism by which the encounter aggregates its related clinical/financial artifacts.

## 9.6 Table: `encounter_clinical_documents`

Migration `2026_05_21_000004`. Stores uploaded **file attachments** (not note text): `id` uuid PK; `encounter_id`/`patient_id` uuid; `tenant_id`/`facility_id` uuid nullable; `document_type` string(60); `title` string(255); `description` text nullable; `file_path` string(500); `original_filename` string(255); `mime_type` string(120); `file_size_bytes` unsigned bigint; `checksum_sha256` string(64); `status` string(20) default `'active'`; `status_reason` string(255) nullable; `uploaded_by_user_id` unsigned bigint nullable; `$table->timestamps()`.

Indexes: `[encounter_id, created_at]`, `[encounter_id, status]`, `[patient_id, created_at]`, `[tenant_id, created_at]`. FKs: `encounter_id`→`encounters` (cascadeOnDelete); `patient_id`→`patients` (cascadeOnDelete); `tenant_id`→`tenants` (nullOnDelete); `uploaded_by_user_id`→`users` (nullOnDelete).

## 9.7 Table: `encounter_audit_logs`

Migration `2026_05_21_000003`. `id` uuid PK; `encounter_id` uuid; `actor_id` unsigned bigint nullable; `action` string; `changes`/`metadata` json nullable; `created_at` only.

Indexes `[encounter_id, created_at]`, `[action, created_at]`. FK `encounter_id`→`encounters` (cascadeOnDelete).

## 9.8 Eloquent models — summary

| Model | Key type | Fillable highlights | Casts | Relationships |
|---|---|---|---|---|
| `MedicalRecordModel` | uuid, string, non-incrementing (`HasUuids`) | all content/linkage/status fields | `encounter_at`, `signed_at`, `created_at`, `updated_at` → datetime | `signedByUser()`, `authorUser()` → belongsTo `User` |
| `MedicalRecordVersionModel` | uuid | `medical_record_id`, `version_number`, `snapshot`, `changed_fields`, `created_by_user_id`, `created_at` | `snapshot`/`changed_fields` → array, `created_at` → datetime | none |
| `MedicalRecordAuditLogModel` | uuid | `medical_record_id`, `action`, `actor_id`, `changes`, `metadata`, `created_at` | `changes`/`metadata` → array | none |
| `MedicalRecordSignerAttestationModel` | uuid | `medical_record_id`, `attested_by_user_id`, `attestation_note`, `attested_at` | `attested_at`/`created_at`/`updated_at` → datetime | `attestedByUser()` → belongsTo `User` |
| `EncounterModel` | uuid, string, non-incrementing (`HasUuids`) | `encounter_number`, `tenant_id`, `facility_id`, `patient_id`, `appointment_id`, `admission_id`, `primary_clinician_user_id`, `status`, `opened_at`, `closed_at`, `status_reason` | `opened_at`, `closed_at`, `created_at`, `updated_at` → datetime | `primaryClinician()` → belongsTo `User` |
| `EncounterClinicalDocumentModel` | uuid | file/document fields listed above | `file_size_bytes`/`uploaded_by_user_id` → integer; timestamps → datetime | none |
| `EncounterAuditLogModel` | uuid | same shape as MedicalRecord audit log | `changes`/`metadata` → array | none |

No accessors, mutators, scopes, or Eloquent model events/observers were found on any of these seven models.

## 9.9 Domain repository interfaces (method signatures)

- **`MedicalRecordRepositoryInterface`**: `create`, `findById`, `findLatestDraftForAppointment`, `hasDraftConsultationNoteForAppointment`, `hasSignedConsultationNoteForAppointment`, `update`, `updateWithOptimisticLock` (outcome `updated|conflict|missing`), `existsByRecordNumber`, `search`, `statusCounts`.
- **`MedicalRecordVersionRepositoryInterface`**: `create`, `listByMedicalRecordId`, `findById`, `findLatestByMedicalRecordId`, `findByMedicalRecordAndVersionNumber`.
- **`MedicalRecordSignerAttestationRepositoryInterface`**: `create`, `listByMedicalRecordId`.
- **`MedicalRecordAuditLogRepositoryInterface`**: `write`, `listByMedicalRecordId`.
- **`EncounterClinicalDocumentRepositoryInterface`**: `create`, `findById`, `findByIdForEncounter`, `update`, `searchByEncounterId`.
- **`EncounterAuditLogRepositoryInterface`**: `write`, `listByEncounterId`.
- **No `EncounterRepositoryInterface`** exists for the `EncounterModel` aggregate itself (confirmed absent).

## 9.10 Value-object enums (source of all status columns)

- `MedicalRecordStatus`: `draft`, `finalized`, `amended`, `archived`.
- `MedicalRecordNoteType`: `consultation_note`, `admission_note`, `progress_note`, `discharge_note`, `referral_note`, `nursing_note`, `procedure_note`.
- `EncounterStatus`: `opened`, `in_progress`, `ready_for_sign`, `signed`, `closed`, `amended`, `cancelled`.
- `EncounterClinicalDocumentStatus`: `active`, `archived`.

None of these four enum classes contain transition-validation logic themselves (only `values()`, and for `MedicalRecordNoteType`, `normalize()`/`isValid()`) — transition rules live in the Application layer.

## 9.11 Not found in code

- `locked_at` / `finalized_at` timestamp column on `medical_records` or `encounters`.
- Soft-delete (`deleted_at`) column on any of the seven tables/models.
- Eloquent model events, observers, or `booted()` overrides on any of the seven models.
- Accessors/mutators/scopes on any of the seven models.
- A domain repository interface for the `EncounterModel` aggregate itself.
