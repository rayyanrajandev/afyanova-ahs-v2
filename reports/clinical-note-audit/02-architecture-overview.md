# 2. Architecture Overview

## 2.1 Layering pattern

Both `app/Modules/MedicalRecord` and `app/Modules/Encounter` follow the same four-layer structure:

```
Presentation/   Http/Controllers, Http/Requests (FormRequests), Http/Transformers
Application/    UseCases (one class per operation), Services, Exceptions
Domain/         ValueObjects (status enums), Repositories (interfaces only), Services (lookup interfaces)
Infrastructure/ Models (Eloquent), Repositories (Eloquent implementations), Services (lookup implementations)
```

This is a hexagonal/ports-and-adapters style: `Domain/Repositories/*Interface.php` and `Domain/Services/*Interface.php` define contracts; `Infrastructure/Repositories` and `Infrastructure/Services` provide the Eloquent-backed implementations; `Application/UseCases` depend only on the interfaces (constructor-injected).

## 2.2 Main modules involved

| Module | Responsibility |
|---|---|
| `MedicalRecord` | The note itself: content fields, status lifecycle, versioning, audit log, signer attestations |
| `Encounter` | The visit/episode aggregate: status lifecycle, close-readiness computation, clinical-document (file) uploads, encounter-scoped audit log, workspace data assembly |
| `Appointment` | Source of `appointment_id`/`patient_id`/consultation-ownership context consumed by MedicalRecord and Encounter |
| `Admission`, `TheatreProcedure`, `AppointmentReferral` | Additional optional linkage contexts validated against a MedicalRecord at create/update time |
| `Laboratory`, `Pharmacy`, `Radiology` | Order modules whose rows are read directly (cross-module Eloquent model import) by Encounter for workspace display and close-readiness, keyed by shared `encounter_id` column |
| `Billing` | Its `ListBillingChargeCaptureCandidatesUseCase` is called directly by Encounter's close-readiness use case |
| `Platform` | Supplies `DiagnosisTerminologyLookupServiceInterface` (ICD-10-style catalog) consumed by MedicalRecord for diagnosis-code validation |

## 2.3 Design patterns observed in code

- **Use-case-per-operation**: every distinct backend operation (create, update, update-status, list, get-version-diff, etc.) is its own single-purpose class under `Application/UseCases`, each with one public `execute()` method (evidenced across ~24 use case classes in the two modules).
- **Repository interfaces (Domain) / Eloquent repositories (Infrastructure)**: e.g. `MedicalRecordRepositoryInterface` ↔ `EloquentMedicalRecordRepository`. Confirmed the `EncounterModel` aggregate itself has **no** repository interface — only its `EncounterClinicalDocument` and `EncounterAuditLog` sub-resources do (see [09](09-database-structure.md)); direct Eloquent (`EncounterModel::query()`) calls are used elsewhere for the Encounter aggregate itself (e.g. `EncounterLifecycleService`, `EncounterResolverService`, `UpdateMedicalRecordUseCase::validatedEncounterId()`).
- **Lookup-service ports**: MedicalRecord depends on six small interfaces (`PatientLookupServiceInterface`, `AppointmentLookupServiceInterface`, `AppointmentReferralLookupServiceInterface`, `AdmissionLookupServiceInterface`, `TheatreProcedureLookupServiceInterface`, `DiagnosisTerminologyLookupServiceInterface`) to validate cross-module linkage without a hard class dependency on those modules' internals — each Infrastructure implementation simply wraps that other module's own repository interface.
- **Value-object status enums**: `MedicalRecordStatus`, `MedicalRecordNoteType`, `EncounterStatus`, `EncounterClinicalDocumentStatus` are PHP enums exposing only a `values()` helper (and, for `MedicalRecordNoteType`, `normalize()`/`isValid()`). None of these enum classes contain transition-validation logic themselves — that logic lives in the Application-layer use cases/services instead (`UpdateMedicalRecordStatusUseCase::isTransitionAllowed()`, `EncounterLifecycleService`'s per-method status checks).
- **Response transformers**: every Presentation controller response is shaped by a dedicated `*ResponseTransformer::transform()` static/method call, keeping the wire format decoupled from the Eloquent model's raw attributes.
- **Optimistic concurrency**: `MedicalRecordRepositoryInterface::updateWithOptimisticLock()` compares a client-supplied `expectedUpdatedAt` against the DB row's actual `updated_at` inside a `DB::transaction()` + `lockForUpdate()`, returning an `updated|conflict|missing` outcome tri-state rather than throwing directly from the repository (`EloquentMedicalRecordRepository.php:102-157`).

## 2.4 Service interactions (who calls whom)

```
Frontend (Workspace.vue)
   │  fetch() via apiRequest()  →  /api/v1/medical-records...  /api/v1/encounters/{id}...
   ▼
Presentation (Controllers + FormRequests)
   │  authorize() via ->can('permission.string')
   ▼
Application (UseCases)
   │  MedicalRecord UseCases ──────► Domain lookup interfaces ──► Infrastructure lookup services ──► other modules' repository interfaces
   │  MedicalRecord UseCases ──────► EncounterLifecycleService (Encounter module)   [status sync side-effect]
   │  Encounter UseCases ──────────► MedicalRecordRepositoryInterface               [primary-note resolution]
   │  Encounter UseCases ──────────► LaboratoryOrderModel / PharmacyOrderModel /
   │                                  RadiologyOrderModel / TheatreProcedureModel   [direct Eloquent cross-import]
   │  Encounter UseCases ──────────► Billing\ListBillingChargeCaptureCandidatesUseCase [direct Application-layer import]
   ▼
Infrastructure (Eloquent Repositories / Models)
   ▼
Database (medical_records, medical_record_versions, medical_record_audit_logs,
          medical_record_signer_attestations, encounters, encounter_clinical_documents,
          encounter_audit_logs)
```

## 2.5 Dependencies confirmed by direct code inspection

- MedicalRecord → Appointment, Patient, Admission, TheatreProcedure, AppointmentReferral, Platform(diagnosis catalog) — via Domain interface/port (hexagonal boundary), each Infrastructure adapter delegating to that module's own repository interface.
- MedicalRecord → Encounter — via `EncounterResolverService` (find-or-create) and `EncounterLifecycleService` (status sync); also a direct `EncounterModel::query()->find()` call inside `UpdateMedicalRecordUseCase::validatedEncounterId()` (bypassing any interface).
- Encounter → MedicalRecord — via `MedicalRecordRepositoryInterface` (interface/port) for resolving the "primary medical record" shown in the workspace and used in close-readiness.
- Encounter → Laboratory/Pharmacy/Radiology/TheatreProcedure — via direct Eloquent model cross-import (no interface/port), scoped by the shared `encounter_id` foreign key.
- Encounter → Billing — via a direct Application-layer UseCase class import (no interface/port).
- Encounter → ServiceRequest — **Not found in code** (no references either direction).

Full detail with citations: [11-integration-points.md](11-integration-points.md).
