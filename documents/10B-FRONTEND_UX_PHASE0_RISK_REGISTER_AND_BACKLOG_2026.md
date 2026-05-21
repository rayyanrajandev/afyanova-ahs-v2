# Afyanova AHS v2 - Frontend UX Phase 0 Risk Register and Backlog 2026

**Document status:** Phase 0 execution deliverable  
**Last updated:** 2026-05-14  
**Parent plan:** `10-FRONTEND_UX_PRODUCT_COMPLETION_PLAN_2026.md`  
**Companion matrix:** `10A-FRONTEND_UX_PHASE0_MODULE_COMPLETION_MATRIX_2026.md`  
**Prepared from perspective:** Principal healthcare software architect, distributed systems engineer, Laravel enterprise consultant

---

## 1. Purpose

This document converts the Phase 0 findings into an actionable build backlog.

The goal is to protect patient safety, reduce frontend maintenance risk, and create a controlled path toward modern production UX without a frontend rewrite.

---

## 2. Phase 0 Risk Register

| ID | Risk | Severity | Evidence | Impact | Mitigation | Phase |
|---|---|---:|---|---|---|---|
| UX-R001 | Oversized single-file workbenches | Critical | Pharmacy, billing, inventory, medical records, lab, admissions, patients, appointments, radiology, theatre pages exceed 6000 lines in several cases | High regression risk, slow onboarding, difficult testing | Extract workflow components and composables incrementally | Phase 1-4 |
| UX-R002 | Inconsistent frontend API layer | Critical | Many pages/components still define local `apiRequest` helpers; `window.axios` usage was removed from appointments on 2026-05-12 | Inconsistent auth/session, errors, retries, validation, and entitlement UX | Migrate all feature calls to `resources/js/lib/apiClient.ts` | Phase 1 |
| UX-R003 | PHI may be stored in plain browser storage | Partially mitigated | Patient, medical-record, clinical order, billing, inventory, lookup-recent, and audit-handoff persistence was reduced on 2026-05-12 | Privacy and compliance risk, especially on shared workstations | Continue storage audit; define secure encrypted draft policy before offline work | Phase 1-2 |
| UX-R004 | Manual UUID/user ID entry in staff workflows | High | Patient/admission/context lookup fallbacks; clinician user ID fields in appointments, emergency, theatre | Staff confusion, wrong-context actions, patient safety risk | Replace normal flows with searchable domain selectors | Phase 1-3 |
| UX-R005 | No visible frontend E2E test framework | Critical | No Playwright/Cypress/Dusk config or scripts visible | Cannot prove workflow completion before release | Add Playwright smoke and journey tests | Phase 1-5 |
| UX-R006 | Generated backup/recovery files inside frontend source tree | Mitigated | `Dashboard.recovered.js` and inpatient ward backup files were under `resources/js/pages`; now quarantined under `documents/archive/frontend-recovery` | Build confusion, stale code risk, reviewer confusion | Keep generated backups out of frontend source paths with `.gitignore` rules | Phase 1 |
| UX-R007 | Documentation drift | High | Current docs and code have diverged in areas such as POS support | Wrong planning decisions and missed production gaps | Keep matrix updated after each workflow change | Phase 0-5 |
| UX-R008 | Accessibility not proven | High | No visible WCAG 2.2 AA audit or automated accessibility checks | Exclusion risk, poor keyboard use in clinical settings | Add axe checks with Playwright and manual keyboard review | Phase 4 |
| UX-R009 | Performance risk on large pages | High | Largest workbenches exceed 9000-15000 lines; production build reports chunks larger than 500 kB | Slow render and high memory use on hospital devices | Lazy-load heavy panels and split by workflow | Phase 2-4 |
| UX-R010 | Inconsistent loading/error/empty/permission states | High | Local API helper pattern spreads behavior per module | Users receive inconsistent recovery guidance | Create shared page-state and mutation-state patterns | Phase 1-2 |
| UX-R011 | Duplicate submission and retry safety not visible across all critical forms | High | Large pages with many custom mutations | Duplicate bills, orders, stock movements, or clinical records | Add idempotency keys and duplicate-submit UX for critical writes | Phase 2-3 |
| UX-R012 | Patient/facility/visit context not governed across every critical workbench | High | Large independent pages, manual context link sources | Wrong-patient or wrong-facility actions | Add standard patient/facility/context banner and workflow context picker | Phase 1-3 |
| UX-R013 | Offline work could be started too early | High | Online UX and tests are not yet stable | Sync would preserve bad workflows and multiply data risks | Defer broad offline until P0 online journeys are signed off | Phase 0-5 |
| UX-R014 | Clinical UAT evidence missing | Critical | Code scan cannot prove clinical correctness | Patient safety and adoption risk | Create UAT scripts and sign-off gates for P0 journeys | Phase 2-5 |

---

## 3. Priority Backlog

### P0.1 - Keep the module completion matrix alive

**Goal:** Maintain a single source of truth for product completion.

Tasks:

- Update `10A-FRONTEND_UX_PHASE0_MODULE_COMPLETION_MATRIX_2026.md` whenever a module changes.
- Mark workflows complete only after tests and UAT.
- Add evidence links to tests, screenshots, or release notes.

Acceptance:

- Every P0 module has status, risk, next action, and owner.

### P0.2 - Standardize frontend API access

**Goal:** Make API behavior predictable across the application.

Tasks:

- Extend `resources/js/lib/apiClient.ts` if needed for idempotency keys, request IDs, validation mapping, and auth/session handling.
- Replace local `apiRequest` helpers module by module.
- Remove `window.axios` usage from appointments.
- Add a small migration guide for feature pages.

Acceptance:

- New feature work uses only the shared API client.
- P0 pages have no local generic API helper unless there is a documented exception.

Status:

- Started 2026-05-12.
- Removed remaining `window.axios` usage from `resources/js/pages/appointments/Index.vue`.
- Converted the appointments local API wrapper to delegate to `resources/js/lib/apiClient.ts`; the wrapper remains only as a transition layer for existing call sites.
- Remaining work: migrate local `apiRequest` helpers to `resources/js/lib/apiClient.ts` module by module.

### P0.3 - Stop PHI in plain browser storage

**Goal:** Remove unsafe local draft behavior before offline expansion.

Tasks:

- Audit patient, medical records, lookup recents, and handoff storage payloads.
- Classify each storage key as safe UI preference, sensitive, or unknown.
- Disable or server-side-save sensitive drafts until encrypted offline storage is approved.
- Add a shared storage policy helper to prevent accidental PHI persistence.

Acceptance:

- Patient and clinical drafts no longer write PHI to plain `localStorage`.

Status:

- Started 2026-05-12.
- Added `resources/js/lib/browserStoragePolicy.ts` as the shared sensitive-storage policy helper.
- Patient registration draft reads/writes now purge the legacy key instead of saving PHI in plain browser storage.
- Medical-record create draft reads/writes now purge the legacy key instead of saving clinical notes in plain browser storage.
- Medical-record leave-warning copy now tells users unsaved notes are not locally stored.
- Patient and admission lookup recents now stay in memory only and purge legacy `localStorage` keys.
- `useWorkflowDraftPersistence` now disables plain browser storage by default unless a future workflow explicitly opts in with `allowPlainBrowserStorage`.
- App startup now purges known sensitive legacy browser-storage keys through `purgeKnownSensitiveBrowserStorage()`.
- Lab, pharmacy, billing, radiology, theatre, and inventory create drafts no longer persist through plain `localStorage` because they use the shared draft policy without opt-in.
- Lab, pharmacy, and billing audit-export retry handoff resource IDs now stay in memory and purge legacy `sessionStorage` handoff keys; non-PHI retry telemetry counters remain in `sessionStorage`.
- Remaining work: finish global browser-storage classification for dashboard preferences, generic UI preferences, and any module-specific storage added after this audit.

### P0.4 - Replace manual clinician and record IDs in normal flows

**Goal:** Make workflows safe for hospital users.

Tasks:

- Create or standardize clinician picker using staff clinical directory APIs.
- Standardize patient and admission pickers.
- Replace clinician user ID fields in appointments, emergency triage, and theatre.
- Restrict UUID fallback fields to admin/support contexts.

Acceptance:

- Normal staff can complete P0 clinical journeys without typing raw IDs.

Status:

- Started 2026-05-13.
- Appointment preferred clinician and referral target clinician fields now use the active clinician directory when available.
- Emergency transfer accepting clinician field now uses the active clinician directory when available.
- Theatre operating clinician and anesthetist fields now use staff directory selectors when available.
- Normal fallback states now show directory-access guidance instead of raw user ID inputs.
- Added `resources/js/components/domain/clinical/ClinicianPicker.vue` as the shared domain selector wrapper on 2026-05-13 and wired it into appointments, emergency transfer, and theatre assignment flows.
- Patient, admission, and linked appointment/admission context lookup components now disable manual UUID fallback by default; support/admin-only escape hatches must explicitly opt in with `allowManualIdFallback`.
- Remaining work: add E2E coverage, identify any legitimate support/admin screens that need explicit manual-ID fallback, and continue replacing facility/specialty UUID fallbacks.

### P0.5 - Add Playwright E2E foundation

**Goal:** Prove critical journeys before claiming completion.

Tasks:

- Add Playwright dependency and scripts.
- Add authenticated test helper.
- Add smoke tests for login/dashboard and one P0 workflow.
- Add accessibility checks with axe after base E2E is stable.

Acceptance:

- CI can run at least one browser smoke test.
- The test strategy supports P0 journey expansion.

Status:

- Started 2026-05-13.
- Added `@playwright/test` and `axe-core` dev dependencies.
- Added Playwright scripts: `test:e2e`, `test:e2e:install`, `test:e2e:list`, `test:e2e:smoke`, and `test:e2e:ui`.
- Added `playwright.config.ts` with Chromium project, `data-test` selector support, retained failure traces/screenshots/videos, and optional `PLAYWRIGHT_START_SERVER=1` Laravel server startup.
- Added login smoke coverage with critical/serious axe checks.
- Added unauthenticated access-control smoke coverage for dashboard, patients, appointments, emergency triage, medical records, laboratory, pharmacy, admissions, and billing invoices.
- Added authenticated selector-policy guard for appointments, emergency triage, and theatre; it skips until `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` are configured.
- Verified `npm run test:e2e:list` passes and lists 11 tests.
- Installed the local Playwright Chromium runtime with `npm run test:e2e:install`.
- Added a dedicated `e2e-smoke` CI job in `.github/workflows/tests.yml` that prepares SQLite, builds assets, installs Chromium, starts Laravel through Playwright, and uploads Playwright artifacts.
- Live smoke execution is blocked in this sandbox because `php artisan serve` cannot bind locally and browser access to the configured tunnel URL returns `ERR_NETWORK_ACCESS_DENIED`; run the smoke suite from a normal local server or CI runner with `PLAYWRIGHT_BASE_URL` set.

### P0.6 - Quarantine generated backup files

**Goal:** Keep source tree clean and reduce stale-code risk.

Tasks:

- Move or remove generated backup/recovery files from `resources/js/pages`.
- Add ignore rules or recovery workflow documentation if needed.
- Confirm build still passes.

Acceptance:

- No `.bak`, `.pre_*`, `.recovered.js`, or recovery-wrapper files remain in frontend source paths.

Status:

- Completed 2026-05-12 for the known tracked recovery files.
- Archived snapshots now live in `documents/archive/frontend-recovery`.
- `.gitignore` now blocks future frontend backup/recovery artifacts from entering `resources/js`.
- Verified with `cmd /c npm run build` on 2026-05-12.

### P0.7 - Add standard patient/facility/context banner

**Goal:** Reduce wrong-patient and wrong-facility actions.

Tasks:

- Define shared context component contract.
- Use patient, MRN, age/sex where appropriate, facility, visit/admission context, and status.
- Add to patients, chart, triage, medical records, lab, pharmacy, admissions, inpatient, and billing where context applies.

Acceptance:

- P0 clinical workbenches always display active patient/facility/context before write actions.

Status:

- Started 2026-05-13.
- Added `resources/js/components/domain/clinical/ClinicalContextBanner.vue` as the shared patient/facility/workflow context banner contract.
- The banner supports patient identity/meta, facility and tenant scope, workflow context, status badge, action slot, and detail slot so pages can adopt it without a rewrite.
- Wired the banner into appointment scheduling when a patient is locked from a source context.
- Wired the banner into emergency triage intake while preserving appointment/admission handoff details and the context editor action.
- Wired the banner into the medical records consultation composer using existing patient, facility, appointment, admission, referral, and theatre context signals.
- Wired the banner into laboratory order creation while preserving patient-chart, consultation, appointment, admission, basket, and context-editor actions.
- Wired the banner into radiology order creation while preserving the imaging context editor and linked appointment/admission details.
- Wired the banner into pharmacy order creation while preserving patient-chart, consultation, appointment, admission, medication-basket, and context-editor actions.
- Wired the banner into admission creation while preserving the appointment handoff editor and medical-records continuation action.
- Wired the banner into billing invoice creation through `BillingCreateContextSummary` while preserving the context editor, unlink action, and source workflow traceability panel.
- Wired the banner into the patient chart so downstream care launches start from visible patient, facility, and encounter context.
- Wired the banner into the inpatient ward documentation workspace so bedside tasks, notes, care plans, and discharge readiness actions start from visible admission and facility context.
- Wired the banner into direct service request creation so patient routing to lab, pharmacy, radiology, or procedure desks starts from visible patient, facility, and destination context.
- Wired the banner into billing cash account setup and the selected-account cashier workbench so charge and payment posting starts from visible patient and facility context.
- Wired the banner into theatre procedure scheduling so patient, appointment, and admission handoff context remains visible while perioperative details are entered.
- Wired the banner into claims intake from billing handoff so invoice, patient, and payer context remains visible while reimbursement details are entered.
- Wired the banner into inventory dispensing claim-link intake so dispensed item, patient, and claim or invoice context stays visible while reimbursement traceability is captured.
- Wired the banner into billing payment-plan setup so patient, billing source, and open-balance context remains visible while installment terms are created.
- Wired the banner into billing refund request, approval, and payout dialogs so source invoice, patient, and payout context remain visible through the refund control trail.
- Wired the banner into billing discount policy creation and invoice-apply dialogs so finance governance context stays visible while concession rules or invoice discounts are entered.
- Verified with `cmd /c npm run build` on 2026-05-14.
- Remaining work: transition from banner rollout into broader P0.8 form-safety coverage across other critical write workflows.

### P0.8 - Add critical form safety pattern

**Goal:** Prevent accidental duplicate or unsafe writes.

Tasks:

- Standardize dirty-form protection.
- Standardize duplicate-submit prevention.
- Add idempotency key generation for critical create/update operations.
- Add consistent validation display and recovery.

Acceptance:

- P0 clinical, billing, and stock forms have consistent submit, retry, and validation behavior.

Progress as of 2026-05-14:

- Started the finance-form safety pilot in `resources/js/pages/billing-discounts/Index.vue`.
- Moved the page onto the shared `apiClient` wrappers and added `X-Idempotency-Key` / `X-Request-Id` support in `resources/js/lib/apiClient.ts`.
- Added unsaved-change leave/discard protection for the discount policy create and invoice-apply dialogs.
- Extended the same P0.8 pattern to `resources/js/pages/billing-payment-plans/Index.vue` for plan creation and installment payment posting.
- Extended the same P0.8 pattern to `resources/js/pages/billing-refunds/Index.vue` for refund request, approval, and payout processing.
- Extended the shared API-client and request-correlation pattern into `resources/js/pages/billing-invoices/Index.vue` and `resources/js/pages/billing-invoices/composables/usePaymentReversal.ts` for draft create/save, edit, payment capture, status transitions, and payment reversal.
- Extended the same P0.8 pattern into `resources/js/pages/billing-payer-contracts/Index.vue` for contract, negotiated-price, and authorization-rule create/edit/status workflows, including shared API-client mutation plumbing, discard protection, route leave guarding, and idempotency/request keys.
- Extended the same P0.8 pattern into `resources/js/pages/billing-service-catalog/Index.vue` for service-price registration, identity and pricing edits, status changes, and version creation, including shared API-client mutation plumbing, discard protection for the create workbench and details sheet, route leave guarding, audit export client standardization, and idempotency/request keys.

---

## 4. Phase 1 Build Sequence

The next implementation work should happen in this order:

```text
1. Source-tree cleanup for generated backup files
2. Shared API client migration guide and small client enhancements
3. Replace `window.axios` in appointments
4. Introduce storage policy helper
5. Audit and remediate patient/medical-record draft storage
6. Expand domain picker migration and add E2E evidence
7. Add Playwright foundation
8. Roll out shared patient/facility/context banner to P0 write workflows
```

This sequence gives immediate risk reduction without a rewrite.

---

## 5. First Code Change Recommendation

The first code change should be:

```text
Quarantine generated backup/recovery files from `resources/js/pages`
and add a source-tree rule to prevent this from returning.
```

Reason:

- It is low risk.
- It cleans the frontend source tree.
- It directly satisfies Phase 1 quick win 8.
- It reduces confusion before larger refactors.

The second code change should be:

```text
Replace `window.axios` in `resources/js/pages/appointments/Index.vue`
with the shared API client.
```

Reason:

- It is narrow.
- It starts API standardization.
- Appointments are a P0 workflow.
- `axios` is not listed as a direct dependency in `package.json`.

---

## 6. Release Gate Additions

Before any P0 module is marked complete, the release process must require:

- successful frontend build.
- lint or type-check gate.
- at least one E2E journey test for that module.
- documented UAT sign-off.
- accessibility check for the journey page.
- no PHI in browser storage unless explicitly approved by the secure offline architecture.

---

## 7. Working Rule For All Future Edits

Before writing application code, review:

1. `10-FRONTEND_UX_PRODUCT_COMPLETION_PLAN_2026.md`
2. `10A-FRONTEND_UX_PHASE0_MODULE_COMPLETION_MATRIX_2026.md`
3. `10B-FRONTEND_UX_PHASE0_RISK_REGISTER_AND_BACKLOG_2026.md`

Then update the matrix or backlog when the code change changes product-completion status.
