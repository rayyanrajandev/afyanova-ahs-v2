# 14. Unknown or Missing Information ("Not found in code")

This document consolidates every point across the report where the implementation could not be verified within the audited file set. Absence here means "not located during this audit," not necessarily "does not exist anywhere in the codebase" — some items are simply outside the files this audit targeted (noted per item).

## 14.1 Database / Domain

- No `locked_at`/`finalized_at` timestamp column on `medical_records` or `encounters`.
- No soft-delete (`deleted_at`) column on any of the seven audited tables.
- No Eloquent model events, observers, or `booted()` overrides on any of the seven audited models.
- No accessors/mutators/scopes on any of the seven audited models.
- No `EncounterRepositoryInterface` domain-repository abstraction for the `EncounterModel` aggregate.
- No `CANCELLED` (Encounter status enum value) assignment site — the enum case exists but no code path setting it was located in the audited Application-layer files.

## 14.2 Application layer

- No enforcement that a signer attestation must exist before a note can be finalized — attestation creation and the `signed_at`/`signed_by_user_id` fields are set by two entirely independent code paths.
- No explicit caller of `EncounterLifecycleService::markReadyForSign()` was located within the audited Application-layer UseCases (it exists and has full guard logic, but its trigger site — presumably an order-results-review workflow — is outside the audited scope).
- No DB transaction wraps a full "primary write + audit-log write + version write" sequence at the Application layer in either module — each repository call manages its own (or no) transaction independently (see [07](07-backend-behaviour.md) §7.5 for the exact per-path breakdown).
- `DiagnosisTerminologyLookupService::isActiveDiagnosisCode()` only searches the first 100 active catalog entries — behavior for catalogs with more than 100 active codes was not traced further (this is a code-level limitation observed, not confirmed as a bug or intentional).
- The source of prescription/pharmacy-order *creation* triggered from the clinical workflow was not found within `app/Modules/MedicalRecord` or `app/Modules/Encounter` — such creation, if it exists, lives entirely in the Pharmacy module's own Application layer, which was outside this audit's inspected file list (only Pharmacy's read/display path via `PharmacyOrderModel` was confirmed).

## 14.3 Presentation / API layer

- No `MedicalRecordPolicy` or `EncounterPolicy` class file was found; no `Gate::define(` registration for the permission strings used (`medical.records.*`, `medical-records.*`) was found — only `->can()` consumption sites were located. The source of permission-string registration/seeding was not inspected (out of this audit's targeted file list).
- Internals of `AuditLogPresenter::enrich()`, `Controller::streamAuditLogCsvExport()`/`safeExportIdentifier()`, and the Laboratory/Pharmacy/Radiology/TheatreProcedure/Appointment response transformers embedded inside `EncounterWorkspaceResponseTransformer` were not inspected (out of scope — these belong to other modules or a shared base controller).

## 14.4 Frontend

- No Pinia/Vuex store, and no composable file under `resources/js/composables/` matching `encounter`/`clinical`/`medicalRecord`, was found for this feature — all state is local component `ref`/`reactive`/`computed` in `Workspace.vue`.
- No Inertia `useForm()` usage was found for the note composer — it uses a hand-rolled `apiRequest()` fetch wrapper instead.
- The `localStorage.setItem` write path for the autosave-recovery draft key (`MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY`) was not located — only its clear/read usages were found in the audited excerpts of `Workspace.vue`.
- No native `window.onbeforeunload`/`addEventListener('beforeunload', ...)` handler was found (the autosave flush-on-blur/pagehide/visibilitychange/unmount behavior appears to substitute for it, but this is an observation, not confirmation of intent).
- The internal behavior of the `BroadcastChannel` used around the autosave draft lifecycle (`initializeCreateDraftBroadcastChannel`/`teardownCreateDraftBroadcastChannel`) was not traced beyond its initialization/teardown call sites.
- The exact API endpoint called by `EncounterMedicationSafetyPanel.vue` for medication-safety checks was not located — only its prop contract was confirmed.
- Full template wiring and complete contents of the following files were not read in full during this audit (only imports, line counts, or targeted grep hits were examined): `resources/js/pages/encounters/Show.vue`, `EncounterWorkspaceNavBar.vue`, `EncounterWorkspaceMobileTabs.vue`, `EncounterWorkspacePaneHeader.vue`, `EncounterWorkspacePaneToolbar.vue`, `EncounterReturnBanner.vue`, `ClinicalLifecycleActionDialog.vue`, `EncounterOrdersCommandCenter.vue` (props/API wiring specifically), `EncounterOrderProgress.vue`, `EncounterTriageVitalsPanel.vue`, `EncounterDocumentsPanel.vue`, `EncounterGovernancePanel.vue`, `EncounterWorkflowCareStreams.vue`.
- The exact template markup binding the `printDocument()` function to a button element in `Print.vue` was not located (only the function definition was confirmed).
- Full status-filter dropdown markup in `medical-records/Index.vue` (only the reactive wiring behind it was traced).
- The behavior/parent handler that actually calls the encounter-close API in response to `EncounterCloseChecklistDialog`'s `confirm` event was not traced inside `Workspace.vue` (the dialog itself only emits the event).

## 14.5 Lifecycle states explicitly requested by the review template but not found as literal MedicalRecord status values

Per the review instructions, only states verified in code are reported elsewhere in this report. For completeness, the following template-suggested labels do **not** exist as literal `MedicalRecordStatus` enum values: `New` (initial state is `draft`), `In Progress` (this is an `Encounter` status, not a `MedicalRecord` status), `Signed` (no stored status literally equals `signed` — there are `signed_at`/`signed_by_user_id` fields instead, and `signed` is an `Encounter` status value), `Locked` (locking is an exception-thrown side-effect of non-draft edit attempts, not a stored state), `Reopened` (exists only for `Encounter`, not `MedicalRecord`).

## 14.6 Configuration

- No feature-flag mechanism (Laravel Pennant, a `feature_flags` table, or `config('features.*')` reads) was found referenced anywhere in the audited files.
- The source/registration of the permission strings consumed throughout (seeder, provider, or admin UI) was not inspected.
- The runtime configuration source (if any) behind the `EnforceTenantIsolationWhenEnabled` middleware's on/off behavior was not inspected — only that it is applied unconditionally to this feature's routes was confirmed.

## 14.7 Integrations

- No reference to the `ServiceRequest` module exists in either `app/Modules/MedicalRecord` or `app/Modules/Encounter` — confirmed absent via direct namespace search of both directory trees.
