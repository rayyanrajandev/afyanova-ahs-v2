# 1. Executive Summary

This report reverse-engineers the implementation of the Clinical Note feature from source code only. No recommendations, comparisons, or assumptions are included.

**What exists in code:**

- A `MedicalRecord` module (hexagonal/DDD layered: Domain / Application / Infrastructure / Presentation) that stores the actual note content — `subjective`, `objective`, `assessment`, `plan`, `diagnosis_code` — against one of 7 `record_type` values, with a 4-state lifecycle (`draft`, `finalized`, `amended`, `archived`), per-write versioning (`medical_record_versions`), an append-only audit log (`medical_record_audit_logs`), and a separate signer-attestation table (`medical_record_signer_attestations`).
- An `Encounter` module representing the clinical visit, with its own 7-state status field (`opened`, `in_progress`, `ready_for_sign`, `signed`, `closed`, `amended`, `cancelled`), its own audit log, and a file-attachment sub-resource (`EncounterClinicalDocument`, 2 states: `active`/`archived`) that is independent of the note text.
- A cross-module `EncounterLifecycleService` that keeps the Encounter's status synchronized with the MedicalRecord's status whenever the note is saved or its status changes (`MedicalRecord/Application/UseCases/UpdateMedicalRecordUseCase.php`, `UpdateMedicalRecordStatusUseCase.php` call into `Encounter/Application/Services/EncounterLifecycleService.php`).
- A single monolithic frontend page, `resources/js/pages/encounters/Workspace.vue` (10,151 lines), that hosts the note composer, hand-rolls autosave (1.5s debounce / 15s max-wait / flush-on-blur-hide-unload), hand-rolls optimistic-concurrency conflict handling, and orchestrates lab/pharmacy/radiology/theatre order panels and a close-readiness checklist — all via a custom `fetch`-based `apiRequest` helper rather than Inertia's `useForm`.
- A `GetEncounterCloseReadinessUseCase` that computes a 4-item checklist (note signed, diagnosis documented, pending orders, unbilled services) gating whether an encounter can be closed, with one blocking item (note signed) and three warning items that can be overridden with an acknowledgement + reason.
- Direct, non-transactional, cross-module Eloquent model queries from the Encounter module into Laboratory/Pharmacy/Radiology/TheatreProcedure order tables (keyed by a shared `encounter_id` column), and a direct Application-layer dependency from Encounter into Billing's `ListBillingChargeCaptureCandidatesUseCase`.

**Key implementation facts that are not obvious from a feature-list description:**

- "Finalizing" a note is not always a transition to a `finalized` status: if the note was previously signed, re-finalizing it is silently rewritten in code to store `amended` instead (`UpdateMedicalRecordStatusUseCase.php`, see [04](04-clinical-note-lifecycle.md)).
- "Amending" a note is implemented as a transition to `draft`, not to a literal `amended` row value, at the point the status change is requested (same file) — `amended` as a stored value is only reached via the finalize-after-sign override above, or via `syncFromMedicalRecordStatus` on the Encounter side.
- Content editing is blocked entirely once a note leaves `draft` status (`MedicalRecordContentLockedException`), but the *status* itself can still change (finalize→amend→archive) independent of content edits.
- There is no `locked_at`, `finalized_at`, or soft-delete column anywhere in the `medical_records` or `encounters` schema.
- No DB transaction wraps a full "write record + write version + write audit log" sequence at the Application layer; only the record-update-with-optimistic-lock and the version-number-allocation each have their own independent `DB::transaction()` one layer down, in the repository.

See the linked documents for full citations.
