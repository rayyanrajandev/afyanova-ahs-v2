# 5. Saving Behaviour

## 5.1 Overview of save operations

| Operation | Trigger | Endpoint | UseCase |
|---|---|---|---|
| Draft create (first save) | Autosave or manual retry, when no draft exists yet | `POST /api/v1/medical-records` | `CreateMedicalRecordUseCase` |
| Draft update (subsequent saves) | Autosave debounce/max-wait/flush events, or manual retry | `PATCH /api/v1/medical-records/{id}` | `UpdateMedicalRecordUseCase` |
| Status change (finalize/amend/archive) | Explicit user action + confirmation dialog | `PATCH /api/v1/medical-records/{id}/status` | `UpdateMedicalRecordStatusUseCase` |
| Signer attestation | Explicit user action | `POST /api/v1/medical-records/{id}/signer-attestations` | `CreateMedicalRecordSignerAttestationUseCase` |
| Encounter status change (incl. close) | Explicit user action + checklist dialog | `PATCH /api/v1/encounters/{id}/status` | `UpdateEncounterStatusUseCase` |

There is no separate "manual save" vs. "auto save" endpoint on the backend — both go through the same create/update endpoints; the distinction (`intent: 'autosave'` vs `intent: 'save'`) exists only as a frontend-side parameter to `syncCreateDraftToServer()` controlling whether errors are shown silently or surfaced to the user (`Workspace.vue:1612-1728`).

## 5.2 Autosave (frontend, `Workspace.vue`)

Confirmed mechanism — not a simple fixed interval:
- **Debounce**: a `watch()` over all `createForm` note/linkage fields calls `scheduleMedicalRecordCreateDraftAutosave()` on every change, which (re)arms a `window.setTimeout` for **1500ms** before syncing.
- **Max-wait**: a second, independently-armed `window.setTimeout` for **15000ms** forces a save even if the user keeps typing continuously (the 1500ms debounce alone would otherwise never fire).
- **Guard conditions** (checked before scheduling and before flushing): must be on the `'new'` composer tab; not already loading/hydrating/bootstrapping; sync state must not already be `'conflict'` or `'saving'`; must have pending changes; and `shouldAutosaveCreateDraft()` must return true — this requires a patient to be selected, and (for non-appointment-linked drafts) requires actual clinical content to exist (`hasClinicalCreateDraftPayload()`).
- **Flush-on-event**: in addition to the timers, a save is force-flushed on `visibilitychange` (tab hidden), `pagehide`, window `blur`, regained `online` connectivity, and component `onBeforeUnmount`. Page-teardown flushes pass `keepalive: true` to the underlying `fetch` call so the request can complete after the page starts unloading.
- **Local persistence / recovery**: a `localStorage` key (`MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY`) and a recovery flow (`createDraftRecoveryAvailable`/`createDraftRecovered`, `initializeMedicalRecordCreateDraftRecovery`) exist for restoring an unsynced local draft after e.g. a crash; the exact `localStorage.setItem` write call was **not found in code** in the audited excerpts (only clear/read paths were located).
- A `BroadcastChannel` is also initialized/torn down around the draft lifecycle (`initializeCreateDraftBroadcastChannel`/`teardownCreateDraftBroadcastChannel`) — presumed cross-tab coordination; internal behavior **not further traced**.

## 5.3 Manual save / retry

`retryCreateDraftSave()` calls `syncCreateDraftToServer({ intent: 'save', allowCreate: true, silent: false })`. Requires `createForm.patientId` to already be set client-side, else shows an error toast without calling the API (`notifyError('Select the patient context before retrying chart save.')`).

## 5.4 `syncCreateDraftToServer()` logic (the single function backing both autosave and manual save)

1. If `createDraftRecord.value` already exists (i.e., a draft row has been created server-side), sends `PATCH /medical-records/{id}` with the current form payload.
2. Otherwise sends `POST /medical-records` to create the draft.
3. **422 retry-as-update**: if creation returns 422 for an appointment-linked consultation note, the frontend calls `GET /medical-records?...status=draft...` to look for an existing draft for that appointment (`findExistingCreateEncounterDraft()`), and if found, retries the save as a `PATCH` update instead of failing outright.
4. **409 conflict handling**: if the response is 409 with `payload.code === 'MEDICAL_RECORD_DRAFT_CONFLICT'`, sets `createDraftSyncState.value = 'conflict'` (rather than throwing, when the sync is `silent`) — this is the client-side reaction to the backend's optimistic-concurrency check (see 5.6).

## 5.5 Content update — backend validation, transaction, and DB writes

`UpdateMedicalRecordRequest`:
- Content fields (`subjective`/`objective`/`assessment`/`plan`/`diagnosisCode`/`recordType`/linkage ids) are all `sometimes` (optional per-request), but at least one field from a defined `ALLOWED_FIELDS` list must be present, else a validation error on a synthetic `payload` field.
- `status`, `statusReason`, `reason`, `signedByUserId`, `signedAt` are explicitly `prohibited` — this endpoint cannot be used to change lifecycle/signature fields.
- Also accepts `expectedUpdatedAt` (nullable date) and `forceDraftSave` (nullable boolean) — the optimistic-concurrency control inputs.

`UpdateMedicalRecordUseCase::execute()`:
1. Tenant-scope write guard.
2. Loads existing record; `null` if missing.
3. **Content-lock check**: throws `MedicalRecordContentLockedException` if `existing.status !== draft`.
4. Re-validates patient/appointment/admission/encounter/record-type/referral/theatre-procedure/diagnosis-code linkage exactly as at create time (using existing values as fallback for any field omitted from the payload).
5. **DB write**: `MedicalRecordRepositoryInterface::updateWithOptimisticLock($id, $payload, $expectedUpdatedAt, $forceDraftSave)`.
   - Implementation (`EloquentMedicalRecordRepository.php:102-157`) wraps the read-compare-write sequence in `DB::transaction()`, locks the row with `lockForUpdate()`, and — unless `forceDraftSave` is true — compares the row's actual `updated_at` to `$expectedUpdatedAt`; mismatch returns outcome `conflict` (carrying the current server row); missing row returns `missing`; otherwise performs the update and returns `updated`.
   - `conflict` outcome → `UpdateMedicalRecordUseCase` throws `MedicalRecordDraftConflictException($currentRecord)`, which the controller maps to HTTP 409 with `code: MEDICAL_RECORD_DRAFT_CONFLICT` and the server's current copy of the record in the response body.
   - `missing` outcome → use case returns `null` → controller 404s.
6. Computes `changes` as a diff over a fixed tracked-field list; **only if non-empty**: writes `medical-record.updated` audit log entry, and creates a new `medical_record_versions` row (`changedFields` = the changed keys only — unlike create, which always versions every tracked field).
7. If the updated record has a non-blank `encounter_id`, calls `EncounterLifecycleService::markInProgress()`.
8. Returns the updated record.

No shared `DB::transaction()` wraps steps 5–7 together at the Application layer — only step 5's read-compare-write is transactional (one layer down, in the repository); the subsequent audit-log write and version-row creation (which has its own separate `DB::transaction()` for sequential version-number allocation) are independent calls.

## 5.6 Optimistic concurrency / draft conflict — exact mechanics

- Client tracks the `updatedAt` timestamp of the record it last synced and sends it back as `expectedUpdatedAt` on the next save (exact client-side variable not traced beyond its presence in the request).
- If `forceDraftSave` is not true and the server's current `updated_at` no longer matches, the repository returns `conflict`, and the use case throws `MedicalRecordDraftConflictException` carrying the current server-side record.
- The controller returns HTTP 409 with `code: MEDICAL_RECORD_DRAFT_CONFLICT` and `context.currentRecord`.
- Frontend sets `createDraftSyncState = 'conflict'`, which (per §5.2) also forces `createDraftHasPendingChanges` to `true` regardless of the field-diff comparison, and blocks further autosave scheduling until resolved.
- `forceDraftSave=true` bypasses the timestamp comparison entirely (an explicit overwrite path) — the exact frontend UI action that sets this flag was **not located** in the audited excerpts (**Not found in code**).

## 5.7 Status/finalize save — validation, transaction, error handling

`UpdateMedicalRecordStatusRequest`: `status` required, must be one of `MedicalRecordStatus::values()`; `reason` required when the *requested* status is `amended` or `archived` (max 255 chars). Authorization requires `medical.records.read` plus a status-specific permission (`medical.records.finalize` / `.amend` / `.archive`).

`UpdateMedicalRecordStatusUseCase::execute()`:
1. Tenant-scope write guard.
2. Loads existing record; `null` if missing.
3. Consultation-owner conflict guard (same rule as create/update).
4. Transition-allowed check (see [04](04-clinical-note-lifecycle.md)); throws `InvalidMedicalRecordStatusTransitionException` if not allowed.
5. Builds the update payload, applying the `amended→draft` and `finalized-after-sign→amended` overrides described in [04](04-clinical-note-lifecycle.md); sets `signed_by_user_id`/`signed_at` whenever the requested status is `finalized`.
6. **DB write**: plain `MedicalRecordRepositoryInterface::update($id, $payload)` — **no optimistic lock and no explicit transaction** at this call site (unlike the content-update path).
7. Writes `medical-record.status.updated` audit log entry (always, recording `transition.from`/`transition.to` using the actual stored values, i.e. reflecting any override).
8. If the tracked lifecycle fields changed, creates a new version row.
9. Calls `EncounterLifecycleService::syncFromMedicalRecordStatus()` with the actual stored status.

Frontend: `updateRecordStatus()` sends `PATCH .../status` with `{status, reason}`, gated by a client-side `canApplyMedicalRecordStatusAction()` permission check. `submitRecordStatusDialog()` requires a non-blank reason for `amended`/`archived` before allowing submission (client-side mirror of the server's `required_if` rule).

## 5.8 Error handling summary

| Condition | Backend exception | HTTP status | Frontend reaction |
|---|---|---|---|
| Non-draft content edit attempt | `MedicalRecordContentLockedException` | 422 (field `payload`) | Not explicitly traced beyond generic error toast |
| Optimistic-lock mismatch on save | `MedicalRecordDraftConflictException` | 409, `code: MEDICAL_RECORD_DRAFT_CONFLICT` | `createDraftSyncState = 'conflict'`; dirty flag forced true |
| Duplicate draft for same appointment | `DuplicateEncounterDraftMedicalRecordException` | 422/409 (exact code per controller mapping) | Frontend retries as update after a 422 on create (§5.4) |
| Invalid status transition | `InvalidMedicalRecordStatusTransitionException` | 422 (field `status`) | Error surfaced via `notifyError`/dialog error state |
| Encounter close blocked | `EncounterCloseBlockedException` | 422, `code: ENCOUNTER_CLOSE_BLOCKED`, body includes `data.closeReadiness` | `EncounterCloseChecklistDialog` renders blocking/warning items; confirm button disabled until resolved |
| Any thrown error during document upload | — | file is deleted from storage before returning/rethrowing (`EncounterClinicalAttachmentController::store`) | — |

All user-facing error/success messages are surfaced via `vue-sonner` toasts through `resources/js/lib/notify.ts` (`notifySuccess`/`notifyError`/`notifyWarning`/`notifyInfo`), with error/warning toasts given a longer 12s display duration than the 7s default.
