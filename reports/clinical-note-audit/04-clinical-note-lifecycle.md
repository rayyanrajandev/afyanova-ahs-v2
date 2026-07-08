# 4. Clinical Note & Encounter Lifecycle

Two independent but synchronized lifecycles exist in code: the `MedicalRecord.status` (the note) and the `Encounter.status` (the visit). There is also a two-state `EncounterClinicalDocument.status` for uploaded file attachments.

## 4.1 MedicalRecord status values (as coded)

`MedicalRecordStatus` enum (`app/Modules/MedicalRecord/Domain/ValueObjects/MedicalRecordStatus.php:7-10`), verbatim: `DRAFT='draft'`, `FINALIZED='finalized'`, `AMENDED='amended'`, `ARCHIVED='archived'`. No `signed`, `locked`, `reopened`, or `in_progress` state exists on this enum — those words apply to the Encounter status, not the MedicalRecord status.

### Entry/exit conditions

- **draft** — entered on creation (`CreateMedicalRecordUseCase` always sets `status=draft`, `Application/UseCases/CreateMedicalRecordUseCase.php`). Re-entered when an `amended` status change is requested (see override below). While in `draft`, content edits via `UpdateMedicalRecordUseCase` are allowed. Exited via a status-update request to `finalized` or `archived`.
- **finalized** — entered only via `PATCH .../status` with `status=finalized`, and only if the current status is `draft` (`UpdateMedicalRecordStatusUseCase.php`, transition rule `→ finalized` allowed only from `draft`). **Exception**: if the record was previously signed (`existing['signed_at'] !== null`), the requested `finalized` transition is silently overridden in code to store `amended` instead, while still setting `signed_by_user_id`/`signed_at` to the new actor/timestamp. Content becomes locked (any subsequent `UpdateMedicalRecordUseCase` call throws `MedicalRecordContentLockedException`).
- **amended** — as a *requested* status-update value, is overridden in code to actually store `draft` (`UpdateMedicalRecordStatusUseCase.php`: "if requested status is amended, statusUpdatePayload['status'] is overwritten to DRAFT"). As a *stored* value, `amended` is only actually persisted via the finalize-after-sign override described above. The transition rule table itself states `→ amended` is "allowed only from `finalized`" — this rule governs the request, even though the persisted value ends up being `draft` (see caveat noted by the auditing fork; this is a code-level nuance, not a simplification).
- **archived** — entered via `PATCH .../status` with `status=archived`, allowed only when current status is `draft`, `finalized`, or `amended`. A `reason` is required by both the backend rule (`reasonRequired` computed from the *requested* status) and the `UpdateMedicalRecordStatusRequest` validation (`required_if:status,amended,archived`).
- **Same-status request** (`from === to`) is always allowed as a no-op.
- Any transition not covered above throws `InvalidMedicalRecordStatusTransitionException($from, $to)`.

### Content lock

`MedicalRecordContentLockedException` is thrown exclusively from `UpdateMedicalRecordUseCase::execute()` when `existing['status'] !== DRAFT` — i.e., only `draft` records can have their SOAP content edited through the standard update endpoint. Status changes (finalize/amend/archive) do not touch content fields.

### Versioning tied to status

Every content update that changes a tracked field, and every status update that changes a tracked lifecycle field (`status`, `status_reason`, `signed_by_user_id`, `signed_at`), creates a new row in `medical_record_versions` with a sequential `version_number` (allocated under `lockForUpdate()` inside a `DB::transaction()`).

## 4.2 Encounter status values (as coded)

`EncounterStatus` enum (`app/Modules/Encounter/Domain/ValueObjects/EncounterStatus.php:7-13`), verbatim: `OPENED='opened'`, `IN_PROGRESS='in_progress'`, `READY_FOR_SIGN='ready_for_sign'`, `SIGNED='signed'`, `CLOSED='closed'`, `AMENDED='amended'`, `CANCELLED='cancelled'`. (`CANCELLED` exists on the enum; no code path that sets it was found in the audited Application-layer files — **Not found in code** for how/where `CANCELLED` is ever assigned.)

### Full transition table (from `EncounterLifecycleService`)

| From | To | Trigger method | Condition |
|---|---|---|---|
| OPENED | IN_PROGRESS | `markInProgress()` | Called whenever a linked note's content is updated |
| any non-CLOSED | SIGNED | `syncFromMedicalRecordStatus()` | MedicalRecord status became `finalized` (except: if current encounter status is `OPENED`, target is downgraded to `IN_PROGRESS` instead) |
| any non-CLOSED | AMENDED | `syncFromMedicalRecordStatus()` | MedicalRecord status became `amended` |
| any non-CLOSED | IN_PROGRESS | `syncFromMedicalRecordStatus()` | MedicalRecord status became `draft` (except: if current encounter status is `READY_FOR_SIGN`, it is preserved instead — code comment: "doctor re-editing, results still available for review") |
| IN_PROGRESS / OPENED / SIGNED / AMENDED | READY_FOR_SIGN | `markReadyForSign()` | Explicit call (source: order-results-review-ready); any other current status throws `InvalidEncounterStatusTransitionException` |
| OPENED / SIGNED / AMENDED / IN_PROGRESS / READY_FOR_SIGN | CLOSED | `close()` | Must pass close-readiness gate (see 4.3); any other current status throws |
| CLOSED | IN_PROGRESS | `reopen()` | Explicit call via `PATCH .../status` with `status=reopened` or `status=in_progress`; any other current status throws (reopen always targets `IN_PROGRESS`, never a different status) |
| CLOSED | (no-op) | any method | All lifecycle methods short-circuit and return the encounter unchanged once `status=CLOSED` |

No explicit caller of `markReadyForSign()` was located within the audited Application-layer UseCases — it is presumed to be invoked from an order-results workflow outside this report's scope (**Not found in code** for the exact trigger site).

`UpdateEncounterStatusUseCase` (the only Presentation-reachable dispatcher) only routes `closed` → `close()` and `reopened`/`in_progress` → `reopen()`; `markInProgress`, `markReadyForSign`, and `syncFromMedicalRecordStatus` are not reachable through the public status-update API — they are invoked programmatically from within the MedicalRecord use cases or (for `markReadyForSign`) an unlocated caller.

## 4.3 Encounter close-readiness checklist

Computed by `GetEncounterCloseReadinessUseCase::execute()`. Four items, each `{id, label, severity, status, message, count}`:

| id | severity | Pass condition |
|---|---|---|
| `note_signed` | **block** | Resolved primary medical record's status is `finalized` or `amended` |
| `diagnosis_documented` | warn | Primary record's `diagnosis_code` or `assessment` is non-empty |
| `pending_orders` | warn | Zero pending (non-terminal-status, not-entered-in-error) laboratory + pharmacy + radiology + theatre-procedure rows for the encounter |
| `unbilled_services` | warn | Zero pending billing charge-capture candidates (via `Billing\ListBillingChargeCaptureCandidatesUseCase`) |

Aggregate: `blockingCount` = failed items with `severity=block` (only `note_signed` can ever contribute); `warningCount` = failed items with `severity=warn`; `canClose = blockingCount === 0`; `requiresAcknowledgement = blockingCount === 0 AND warningCount > 0`.

`EncounterLifecycleService::close()` enforces, in order: (1) throws `EncounterCloseBlockedException` if `!canClose`; (2) throws if `requiresAcknowledgement` and the caller didn't pass `acknowledgeCloseGaps=true`; (3) throws if acknowledging but no non-empty `reason` was supplied.

**Note on primary-record resolution divergence**: `GetEncounterWorkspaceUseCase::resolvePrimaryMedicalRecord()` only checks `FINALIZED` then `AMENDED` (returns `null` if neither exists — draft notes are never shown as the workspace's "primary" record). `GetEncounterCloseReadinessUseCase::resolvePrimaryMedicalRecord()` additionally falls back to `DRAFT` as a third option — so the close-readiness check can find a draft note (which would fail `note_signed`) even when the workspace UI shows no primary record at all.

## 4.4 EncounterClinicalDocument status (file attachments)

`EncounterClinicalDocumentStatus` enum (`Domain/ValueObjects/EncounterClinicalDocumentStatus.php:7-9`): `ACTIVE='active'`, `ARCHIVED='archived'`. Default `active` on upload. `UpdateEncounterClinicalDocumentStatusUseCase` allows setting either value; `status_reason` is persisted only when transitioning to `ARCHIVED` (forced to `null` for `ACTIVE`), and a reason is required by `UpdateEncounterClinicalDocumentStatusRequest` when the target is `ARCHIVED`. No enforced transition table beyond the two allowed enum values themselves — either value can be set from either value (no `InvalidEncounterStatusTransitionException`-equivalent guard was found for this sub-resource).

## 4.5 States requested by the review template that do not exist in code

Per the review instructions, only states that actually exist are reported. Explicitly **not found in code** as MedicalRecord or Encounter status values: `New` (as a literal status — `draft` is the initial state instead), `In Progress` as a MedicalRecord status (it is an Encounter status only), `Signed` as a MedicalRecord status (there is a `signed_at`/`signed_by_user_id` pair of fields, but no stored status value literally equal to `signed` — that word is an Encounter status), `Locked` (no literal status value; locking is implemented as a side-effect exception on non-draft edit attempts, not a stored state), `Reopened` as a MedicalRecord status (reopening exists only for Encounter, targeting `IN_PROGRESS`).
