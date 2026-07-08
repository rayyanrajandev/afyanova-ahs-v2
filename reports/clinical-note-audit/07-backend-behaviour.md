# 7. Backend Behaviour — Request Trace

## 7.1 Route-group middleware (applies to every `v1` API route below)

`routes/api.php:61` — group middleware: `['web', 'auth', ResolvePlatformScopeContext::class, EnforceTenantIsolationWhenEnabled::class, EnsureMappedFacilitySubscriptionEntitlement::class]`, prefix `v1`. Individual routes add `can:<permission>` middleware on top, as listed in [08-api-inventory.md](08-api-inventory.md).

Web (Inertia) routes run under `Route::middleware(['user.has-role'])` (`routes/web.php:42`) plus route-specific `auth`, `verified`, `can:`, and `facility.entitlement:medical_records.core` middleware.

## 7.2 Generic trace — content save (`PATCH /api/v1/medical-records/{id}`)

```
Request (PATCH, JSON body: subjective/objective/assessment/plan/diagnosisCode/recordType/
         linkage ids/expectedUpdatedAt/forceDraftSave)
   │
   ▼
Route middleware: web, auth, ResolvePlatformScopeContext, EnforceTenantIsolationWhenEnabled,
                   EnsureMappedFacilitySubscriptionEntitlement, can:medical-records.update-draft
   │
   ▼
Controller: MedicalRecordController::update()
   │
   ▼
Validation: UpdateMedicalRecordRequest
   - authorize(): $user->can('medical-records.update-draft', route('id'))  [object-scoped check,
     duplicated from route middleware]
   - rules(): content fields `sometimes`; status/statusReason/reason/signedByUserId/signedAt
     `prohibited`; expectedUpdatedAt nullable date; forceDraftSave nullable boolean
   - withValidator(): requires at least one ALLOWED_FIELDS key present, else error on `payload`
   │
   ▼
Use Case: UpdateMedicalRecordUseCase::execute($id, $payload, $actorId, $expectedUpdatedAt, $forceDraftSave)
   - tenant scope guard
   - load existing record (404 if missing)
   - content-lock check (422 MedicalRecordContentLockedException if status != draft)
   - re-validate patient/appointment/admission/encounter/record-type/referral/theatre-procedure/
     diagnosis-code linkage (various 422/403/409 domain exceptions)
   │
   ▼
Domain Service / Repository: MedicalRecordRepositoryInterface::updateWithOptimisticLock(...)
   │
   ▼
Infrastructure: EloquentMedicalRecordRepository::updateWithOptimisticLock()
   - DB::transaction() { lockForUpdate(); compare updated_at unless forceDraftSave; update or
     return conflict/missing }
   │
   ▼
Database: UPDATE medical_records ... (single row, by primary key)
   │
   ▼
   (back in UseCase) if changes non-empty:
     - EloquentMedicalRecordAuditLogRepository::write()  → INSERT medical_record_audit_logs
     - EloquentMedicalRecordVersionRepository::create()  → DB::transaction() { lockForUpdate()
       on latest version row; INSERT medical_record_versions with next version_number }
   - if encounter_id present: EncounterLifecycleService::markInProgress($encounterId, $actorId)
     → (conditionally) UPDATE encounters SET status='in_progress' ... + INSERT encounter_audit_logs
   │
   ▼
Controller: catches domain exceptions → maps to specific HTTP status + error `code` + context;
            on success returns MedicalRecordResponseTransformer::transform($record)
   │
   ▼
Response: 200 { data: { id, recordNumber, patientId, encounterId, ..., status, statusReason,
                signedByUserId, signedByUserName, authorUserName, signedAt, createdAt, updatedAt } }
          or 409 { code: 'MEDICAL_RECORD_DRAFT_CONFLICT', context: { currentRecord } }
          or 422 { errors: { payload: [...] } } / { errors: { status: [...] } }
```

## 7.3 Generic trace — status change (`PATCH /api/v1/medical-records/{id}/status`)

```
Request (PATCH, JSON: { status, reason })
   ▼
Route: no can: middleware at route level — permission enforced inside the FormRequest
   ▼
Controller: MedicalRecordController::updateStatus()
   ▼
Validation: UpdateMedicalRecordStatusRequest
   - authorize(): medical.records.read + status-specific permission
     (finalize/amend/archive, or any-of-three for unrecognized status values)
   - rules(): status required + in(MedicalRecordStatus::values()); reason required_if
     status in [amended, archived], max:255
   ▼
Use Case: UpdateMedicalRecordStatusUseCase::execute($id, $status, $reason, $actorId)
   - tenant scope guard
   - load existing record (404 if missing)
   - consultation-owner conflict guard (409 ConsultationOwnerConflictForMedicalRecordException)
   - transition-allowed check (422 InvalidMedicalRecordStatusTransitionException if not)
   - build payload, apply amended→draft / finalized-after-sign→amended overrides,
     set signed_by_user_id/signed_at if requested status is finalized
   ▼
Repository: MedicalRecordRepositoryInterface::update($id, $payload)  — plain update, no lock,
            no explicit transaction
   ▼
Database: UPDATE medical_records SET status=..., status_reason=..., signed_by_user_id=...,
          signed_at=... WHERE id=...
   ▼
   (back in UseCase) always: INSERT medical_record_audit_logs (action: medical-record.status.updated)
                     if lifecycle fields changed: INSERT medical_record_versions
                     if encounter_id present: EncounterLifecycleService::syncFromMedicalRecordStatus()
                       → UPDATE encounters SET status=... + INSERT encounter_audit_logs
   ▼
Controller: returns MedicalRecordResponseTransformer::transform($updated), or maps
            InvalidMedicalRecordStatusTransitionException to 422 on field `status`
   ▼
Response: 200 { data: {...} }
```

## 7.4 Generic trace — encounter close (`PATCH /api/v1/encounters/{id}/status`, status=closed)

```
Request (PATCH, JSON: { status: 'closed', reason?, acknowledgeCloseGaps? })
   ▼
Controller: EncounterController::updateStatus()
   ▼
Validation: UpdateEncounterStatusRequest
   - authorize(): medical.records.read + (closed→finalize, reopened/in_progress→amend,
     other→finalize-or-amend)
   - rules(): status required + in([closed, reopened, in_progress]); reason nullable,
     required_if status=reopened; acknowledgeCloseGaps nullable boolean
   ▼
Use Case: UpdateEncounterStatusUseCase::execute()
   - tenant scope guard
   - match(status): 'closed' → EncounterLifecycleService::close(id, reason, actorId,
     acknowledgeCloseGaps); other recognized values → reopen(); unrecognized → no-op (null)
   ▼
Service: EncounterLifecycleService::close()
   - load encounter; no-op if already closed; else validate current status is one of the
     5 closable statuses, else throw InvalidEncounterStatusTransitionException
   - GetEncounterCloseReadinessUseCase::execute($encounterId)
       - resolve primary medical record (finalized→amended→draft fallback)
       - compute noteSigned / diagnosisDocumented / pendingOrderCount (cross-module queries
         into LaboratoryOrderModel/PharmacyOrderModel/RadiologyOrderModel/TheatreProcedureModel)
       - resolveBillingSummary() → Billing\ListBillingChargeCaptureCandidatesUseCase::execute()
       - build 4-item checklist + canClose/requiresAcknowledgement/blockingCount/warningCount
   - guard chain: !canClose → throw EncounterCloseBlockedException;
     requiresAcknowledgement && !acknowledgeCloseGaps → throw;
     requiresAcknowledgement && acknowledgeCloseGaps && blank reason → throw
   - on success: UPDATE encounters SET status='closed', closed_at=now(), status_reason=...
     (backfills primary_clinician_user_id if unset) + INSERT encounter_audit_logs
     (action: encounter.closed, metadata includes blocking_count/warning_count)
   ▼
Controller: on EncounterCloseBlockedException → 422, code: ENCOUNTER_CLOSE_BLOCKED,
            data.closeReadiness = exception's readiness(); on
            InvalidEncounterStatusTransitionException → 422 on field `status`; on success →
            EncounterResponseTransformer::transform($encounter)
   ▼
Response: 200 { data: {...} } or 422 { code: 'ENCOUNTER_CLOSE_BLOCKED', data: { closeReadiness } }
```

## 7.5 Transaction summary (confirmed by direct inspection of repository implementations)

| Write path | Wrapped in `DB::transaction()`? | Row locking? |
|---|---|---|
| `CreateMedicalRecordUseCase` → record insert | No | No |
| `UpdateMedicalRecordUseCase` → record update | **Yes** (inside `updateWithOptimisticLock`) | **Yes** (`lockForUpdate()`) |
| `UpdateMedicalRecordStatusUseCase` → record update | No | No |
| Any medical-record-version insert | **Yes** (own transaction, for sequential `version_number` allocation) | **Yes** (`lockForUpdate()` on latest version row) |
| Any medical-record-audit-log insert | No | No |
| `EncounterLifecycleService` (`markInProgress`/`syncFromMedicalRecordStatus`/`markReadyForSign`/`close`/`reopen`) → encounter update + its own audit-log insert | No — each is a separate, sequential call | No |
| `EncounterResolverService::findOrCreateForVisit` → encounter insert + audit-log insert | No | No |
| Encounter clinical-document create/update/status-update + their audit-log inserts | No | No |

No Application-layer use case in either module wraps its full "primary write + audit-log write + version write" sequence in a single shared transaction — each repository call manages its own (or no) transaction independently.
