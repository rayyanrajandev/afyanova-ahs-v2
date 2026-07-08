# 6. Frontend Behaviour

## 6.1 Page/component hierarchy

`resources/js/pages/encounters/Workspace.vue` (10,151 lines) is the primary page — a single monolithic component, not decomposed into a deep tree for the note composer itself (most composer markup is inline in its template). It imports and renders: `EncounterBillingPanel`, `EncounterCloseChecklistDialog`, `EncounterDocumentsPanel`, `EncounterGovernancePanel`, `EncounterLifecycleDialog`, `EncounterNoteComposerShell`, `EncounterOrdersCommandCenter`, `EncounterOrdersFocusSkeleton`, `EncounterTriageVitalsPanel`, `EncounterWorkflowCareStreams`, `EncounterWorkspaceHeader`, `EncounterWorkspaceNavBar`, `EncounterWorkspacePaneHeader`.

- `EncounterWorkspaceHeader.vue` (273 lines) — purely presentational, receives props (`loading`, `hasPatient`, `patientSummary`, `statusPrimaryLabel`, `statusPrimaryVariant`, `draftHeaderAlert`, etc.), emits a single `back` event. Renders a full skeleton (`Skeleton` placeholders, `aria-busy`) when `loading` is true.
- `EncounterNoteComposerShell.vue` (79 lines) — a layout/scroll wrapper only: uses a `ResizeObserver` on the note pane to position a fixed footer action rail; has no clinical-content awareness of its own.
- `resources/js/pages/encounters/Show.vue` — 15 lines; a thin entry stub (full contents not read).
- `resources/js/pages/medical-records/Index.vue` (6,126 lines) — the note list/search page; does **not** itself host a note editor. Its "continue draft" action navigates into the Workspace page rather than editing in place.
- `resources/js/pages/medical-records/Print.vue` (1,018 lines) — read-only print/PDF view (see 6.7).
- `EncounterCloseChecklistDialog.vue` (152 lines) — renders the close-readiness checklist (see 6.6).

No Pinia/Vuex store was found for this feature; no composable files under `resources/js/composables/` matching `encounter`/`clinical`/`medicalRecord` were found.

## 6.2 Reactive state (Workspace.vue)

All Composition API (`<script setup>`), plain `ref`/`reactive`/`computed` — no external state library. Key state:

- `createForm` — reactive form object holding the note fields (`patientId`, `encounterId`, `appointmentId`, `admissionId`, `appointmentReferralId`, `theatreProcedureId`, `encounterAt`, `recordType`, `diagnosisCode`, `subjective`, `objective`, `assessment`, `plan`).
- `createDraftRecord` — the server-persisted draft once created.
- `createDraftSyncState` — one of `'saving'`, `'conflict'`, `'error'` (or presumably an idle/unset default).
- `createDraftSyncError` — last sync error message string.
- `createDraftHasPendingChanges` (computed) — the dirty flag (see 6.3).
- `hasUnsavedCreateClinicalContent` (computed) — true if any SOAP field has content.
- `hasPersistableCreateDraft` (computed) — true if any persistable field (including linkage ids) is set.
- `createLoading`, `createDraftHydratingExisting`, `encounterWorkspaceBootstrapping`, `createLeaveConfirmOpen`, `createFinalizeConfirmOpen` — booleans gating UI/autosave state.
- ~19 permission booleans (`canReadMedicalRecords`, `canCreateMedicalRecords`, `canUpdateMedicalRecords`, `canFinalizeMedicalRecords`, `canAmendMedicalRecords`, `canArchiveMedicalRecords`, `canAttestMedicalRecords`, plus read/create flags for laboratory/pharmacy/radiology/theatre/billing order panels), populated from a client-side permission-name set check (e.g. `canUpdateMedicalRecords.value = names.has('medical.records.update')`).

## 6.3 Form handling and dirty-state detection

Not Inertia `useForm()` — no such usage was found for the note composer. `createForm` is a plain reactive object; submission goes through a hand-rolled `apiRequest()` fetch wrapper, not Inertia's form helper.

`createDraftHasPendingChanges` (the dirty flag) logic:
- Returns `true` immediately if `createDraftSyncState === 'conflict'`.
- If currently syncing or errored, returns `true` if there is persistable content or an existing draft record.
- Otherwise compares a computed server-signature (`buildCreateDraftServerSignature()`) against the last-saved signature (`createDraftSavedSignature`) — a diff-based dirty check rather than a raw form-touched flag.

UI reactions to dirtiness:
- A global Inertia `router.on('before', …)` navigation interceptor blocks navigation and opens a confirmation dialog (`createLeaveConfirmOpen`) when the user is on the `'new'` composer tab with pending changes, unless explicitly bypassed for a given pending visit.
- Autosave scheduling itself is gated on this same pending-changes flag.

## 6.4 Autosave, validation, loading indicators, error handling, navigation

Covered in full in [05-saving-mechanism.md](05-saving-mechanism.md) (autosave timing/guards) and below:

- **Client-side validation** found: `hasClinicalCreateDraftPayload()` (note-type-aware — non-consultation note types are treated as having content regardless of field values; consultation notes require at least one SOAP/diagnosis field non-blank); `hasPersistableCreateDraftPayload()` (broader, includes linkage ids); `retryCreateDraftSave()` requires `patientId` set; the status dialog requires a non-blank reason for `amended`/`archived`. No other field-level validation (required-section enforcement, max length, etc.) was found in the composer beyond what the backend enforces.
- **Loading indicators**: numerous granular booleans (`pageLoading`, `listLoading`, `createLoading`, `encounterWorkspaceBootstrapping`, `createProviderSessionSubmitting`, `createEncounterCloseSubmitting`, `createEncounterReopenSubmitting`, `detailsAuditLoading`, `detailsVersionsLoading`, `detailsAttestationSubmitting`, `encounterLifecycleSubmitting`, per-row `actionLoadingId`). `EncounterWorkspaceHeader` shows a full skeleton via `v-if="loading"`.
- **Error handling**: all errors surface via `vue-sonner` toasts through `resources/js/lib/notify.ts` (`notifySuccess`/`notifyError`/`notifyWarning`/`notifyInfo`), with a `browserFallback` custom-event dispatch if the toast library itself throws. `messageFromUnknown()` extracts a display message from thrown errors. Dialog-specific errors (e.g. `statusDialogError`, the close-checklist dialog's `error` prop) are additionally rendered inline within their dialog.
- **Navigation**: besides the leave-confirmation guard, no native `beforeunload` handler was found — the autosave flush-on-`blur`/`pagehide`/`visibilitychange`/`onBeforeUnmount` behavior substitutes for it. Post-action navigation uses Inertia's `router.visit(...)` (e.g., to jump to a record's encounter workspace, or to a patient's chart filtered to the records tab).

## 6.5 Note-type-driven UI (no backend equivalent)

`resources/js/pages/medical-records/noteTypes.ts` (435 lines) defines purely presentational metadata per `record_type` value, with **no** validation-rule implications:
- 7 options (`consultation_note`, `admission_note`, `progress_note`, `discharge_note`, `referral_note`, `nursing_note`, `procedure_note`), each `{value, label, helperText}`.
- `DEFAULT_MEDICAL_RECORD_NOTE_TYPE = 'consultation_note'`; `sanitizeMedicalRecordNoteType()` normalizes/falls back silently, never throws.
- Per-type narrative headings, section descriptions/placeholders/helper text overrides for 6 of the 7 types (`consultation_note` uses the defaults unmodified).
- Only `procedure_note` overrides the section *labels* themselves: Subjective→"Indication", Objective→"Procedure details", Assessment→"Outcome", Plan→"Recovery plan"; every other type shows the default Subjective/Objective/Assessment/Plan labels.
- `Print.vue` reuses these same helpers so the printed document's headings match the composer.

## 6.6 EncounterCloseChecklistDialog.vue

Props mirror the backend's readiness contract: `open`, `readiness: EncounterCloseReadiness | null`, `reason`, `submitting?`, `error?`. Emits `update:open`, `update:reason`, `confirm`.

- Renders a destructive `Alert` banner ("Close blocked") if any blocking item is present.
- Renders every `readiness.items[]` entry as a row with a status icon (check/x/triangle-alert depending on `pass`/`block-fail`/`warn-fail`), a label, a status badge ("Ready"/"Required"/"Warning"), and an optional count badge.
- If there are warning items **and** `readiness.canClose` is true, shows a required `Textarea` for a "Close-out reason" (helper text: "Required when acknowledging billing, diagnosis, or pending-order warnings").
- `canConfirm` computed: false if `!readiness.canClose`; true if `canClose` and `!requiresAcknowledgement`; otherwise requires `reason.trim().length >= 3`.
- Confirm button label switches between "Acknowledge and close" (when `requiresAcknowledgement`) and "Close encounter".
- The dialog itself does not call the close API directly — it only emits `confirm`; the actual `PATCH .../status` call is made by the parent (`Workspace.vue`, not traced further in this pass).

## 6.7 medical-records/Print.vue

Purely presentational/read-only: receives fully server-resolved props (`record`, `patient`, `appointment`, `admission`, `appointmentReferral`, `theatreProcedure`, `author`, `signer`, `diagnosis`, `attestations[]`, `versionSummary`, `encounterResources`, `canViewEncounterOrders`, `documentBranding`, `generatedAt`, optional `encounterSummary`/`chartPacketMode`). No form inputs, no API/mutation calls.

- Signed/finalized display is a pure server-data readout: `Signer: signer?.name || 'Not signed'`, `Signed At: formatDateTime(record.signedAt)` — the page does **not** itself gate on `record.status`; that gate is enforced server-side in `EncounterDocumentController::resolveSignedPrimaryRecord` (403 unless `finalized`/`amended`) before the page is ever rendered for an encounter-level "signed chart packet."
- `printDocument()` is a one-line `window.print()` call.

## 6.8 medical-records/Index.vue (list page)

- Status filter (`searchForm.status`) and record-type filter (`searchForm.recordType`, options from `MEDICAL_RECORD_NOTE_TYPE_OPTIONS`) drive `loadRecords()` (calls the list endpoint with `status`, `recordType`, `from`/`to`, `page`) and a parallel `loadRecordStatusCounts()`.
- Clicking a status-count summary tile calls `applyRecordSummaryFilter(statusKey)`, toggling the filter and re-fetching.
- `continueDraftMedicalRecord(record)`: guarded by the `canCreateMedicalRecords` permission and by `isDraftRecord(record)` (else error toasts). If the record has an `encounterId` or `appointmentId`, navigates into the Encounter Workspace page via `router.visit`. If neither linkage exists, shows an error and does **not** navigate — there is no in-place "create a new unlinked note" flow from this page; new notes are always started from an appointment (`consultationEntryAppointmentsHref()` links out to the Appointments page as the documented entry point).
- Separate loading/API-call plumbing exists for a details sheet (versions, version-diff, signer attestations, audit logs) scoped to a currently-selected record.

## 6.9 Not found in code (frontend)

- Pinia/Vuex store, or a dedicated composable, for the note composer or workspace.
- Inertia `useForm()` usage anywhere in this feature.
- The `localStorage.setItem` write path for the autosave-recovery draft key (only clear/read calls were located).
- A native `beforeunload` handler.
- Exact template wiring/full contents of `EncounterWorkspaceNavBar.vue`, `EncounterWorkspaceMobileTabs.vue`, `EncounterWorkspacePaneHeader.vue`, `EncounterWorkspacePaneToolbar.vue`, `EncounterReturnBanner.vue`, `ClinicalLifecycleActionDialog.vue`, and `Show.vue` beyond their imports/line counts.
- The specific API endpoint called by `EncounterMedicationSafetyPanel.vue` for medication-safety checks (only its prop contract was confirmed).
