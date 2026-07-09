# Patients Index — Audit

**Document type**: Read-only audit, no code changes. Method: full read of `resources/js/pages/patients/Index.vue` (~12,000 lines — script 1–5745, template 5747–12062), cross-referenced against the established V2 architecture by reading `resources/js/pages/patients/chart/ShowV2.vue` and `resources/js/pages/medical-records/IndexV2.vue` in full (not assumed from their surface conventions, which prior work in this session already checked), plus `tests/Feature/Patient/PatientApiTest.php`, `git log` for this file, and a repo-wide check for frontend/e2e coverage. This document establishes facts only; a separate `patients-index-modernization-plan.md` will hold recommendations, matching the audit-then-plan convention already used twice this session (`patient-arrival-checkin-audit.md` → `...-modernization-plan.md`, `queue-based-workflow-audit.md` → `...-modernization-plan.md`).

---

## 1. Feature inventory

Eight major, banner-delimited template sections:

| Section | Lines | Size | Gate |
|---|---|---|---|
| Page header | 5754–5915 | ~160 | — |
| Patient list/table (toolbar, search, filter chips, pagination) | 5916–6702 | ~790 | `canReadPatients`; row actions gated individually (`canUpdatePatients` at 6419, `canUpdatePatientStatus` at 6433) |
| "No read permission" fallback | 6703–6740 | 40 | shown when `!canReadPatients` |
| **Register Patient sheet** (create + duplicate detection) | 6741–7742 | ~1000 | `canCreatePatients` |
| Post-registration actions dialog | 7742–7888 | ~150 | shown after successful create |
| **Patient Visit Handoff sheet** (5 modes) | 7889–8990 | ~1100 | per-mode availability via `visitHandoffModeAvailable()` (2685–2704) |
| **Patient Details sheet** (Overview / Activity / Audit tabs) | 8990–11008 | ~2020 | Audit tab gated `canViewPatientAudit` |
| Edit Demographics sheet | 11008–11691 | ~680 | `canUpdatePatients` |
| Status Change dialog | 11691–12062 (EOF) | ~370 | `canUpdatePatientStatus` |

**The Patient Visit Handoff sheet's 5 modes** (`PatientVisitHandoffMode`, line 301–306: `'outpatient' | 'emergency' | 'direct-services' | 'billing' | 'chart'`) are the highest-complexity single feature in the file, with mode-branching logic clustered at 1271–1543 and 2284–2731:
- **outpatient** — `startOutpatientWalkInFromHandoff()` (2598–2643), atomic `POST /reception/walk-ins`.
- **emergency** — `sendToEmergencyQueue()` (2644–2684), same atomic call, `arrivalMode: 'emergency'`.
- **direct-services** — `createDirectServiceRequest()` (2329–2436), `POST /service-requests`, gated by `visitHandoffCanUseDirectServicesRoute`/`visitHandoffHasAnyDirectServiceRight` (1440–1456).
- **billing** — routes to `/billing-invoices`.
- **chart** — routes to the patient chart via the already-extracted `@/lib/patientChart.ts` helper.

**Duplicate detection at registration** is a real, live feature matching `patient-arrival-checkin-audit.md` §2: hard-block / `strong_warning` (≥80) / `possible_warning` (≥50) tiers. It is reimplemented client-side (`duplicateConfidenceScore()` 4236–4255, `duplicateConfidenceLabel()` 4256–4259, `duplicateComparisonRows()` 4260–4331, `findPreSubmitDuplicateMatches()` 4826–4909) as a **second, parallel scoring implementation** of the same logic the server already does (`PatientDuplicateDetectionService.php`, `EloquentPatientRepository.php:196-317`). Client and server can drift independently — see §3.

**Insurance** is not a separate tab; it's embedded as cards inside the Overview tab (`canReadPatientInsurance`/`canManagePatientInsurance` at 9473/9501/9701).

**Offline registration/sync** is a real, mature subsystem, not a stub: draft autosave (838–906) and an offline write queue for both registrations and edits when the browser is offline (786–836, 4605–4826, 5206–5264), backed by an already-extracted library, `@/lib/offlinePatientRegistration.ts` (617 lines, service-worker + IndexedDB-backed).

---

## 2. State management

~150+ top-level `ref`/`reactive`/`computed` declarations, grouped by feature area (list/filters, permissions, registration form, visit handoff, details sheet, edit sheet, status dialog, offline sync). **No composable extraction exists anywhere in this file** — every piece of state and every API call lives directly in this one `<script setup>` block. This is the single largest structural gap versus the established V2 pattern (§5).

**Permission booleans are one-time snapshots, not reactive.** All ~20 permission refs (`canReadPatients`, `canCreatePatients`, `canUpdatePatients`, etc., declared 692–743) are `ref(hasPermission(...))` — evaluated once at component setup, not `computed()`. If the underlying permission set changes during a session (role change, impersonation switch), these do not update. `ShowV2.vue` and `IndexV2.vue` both use `computed()` wrapping `usePlatformAccess()` for this exact reason.

---

## 3. API surface

All calls go through a file-local `apiRequest<T>()` (2120–2179) except two `apiPost` calls (2355, 2372) that already use the shared `@/lib/apiClient.ts`.

- **List/scope**: `GET /patients`, `GET /patients/status-counts`, `GET /platform/access-scope`, `GET /platform/country-profile`, `GET /auth/me/permissions` (3628–3691).
- **Registration**: `POST /patients`.
- **Update/status**: `PATCH /patients/{id}`, `PATCH /patients/{id}/status`.
- **Audit**: `GET /patients/{id}/audit-logs`, plus a raw `window.open` CSV export call (4016–4041, bypasses `apiRequest` entirely).
- **Insurance**: `GET /patients/insurance-options`, `GET`/`POST /patients/{id}/insurance`, `PATCH /patients/{id}/insurance/{recordId}/verify`.
- **Timeline** (details sheet): `GET /appointments`, `GET /admissions`, `GET /medical-records`.
- **Visit handoff**: `GET /appointments` (context load), `POST /reception/walk-ins` (outpatient + emergency), `POST /service-requests` (direct services).
- **CSRF**: a raw `GET /api/v1/auth/csrf-token` `fetch` call (2095), separate from `apiRequest`.

**Finding**: `GET /auth/me/permissions` (3628–3691) is a redundant network call — its only purpose is re-deriving booleans that `usePlatformAccess()` already exposes from shared Inertia page props, with no extra fetch, everywhere else in the codebase.

**Cross-page navigation**: hrefs to `/appointments`, `/emergency-triage`, `/laboratory-orders`, `/pharmacy-orders`, `/radiology-orders`, `/theatre-procedures`, `/billing-invoices`, built via `patientContextHref()`/`patientTimelineHref()`/`patientAppointmentWorkflowHref()` (2206–2283) — not API calls, but a routing surface a rewrite needs to preserve.

---

## 4. Local helpers and types

- **`apiRequest<T>()`** (2120–2179): prefixes `/api/v1`, sets `Accept`/`X-Requested-With`, adds CSRF header + JSON body for non-GET, retries once on HTTP 419 via `refreshCsrfToken()`, throws an `Error` with `.status`/`.payload` on non-2xx. This duplicates `@/lib/apiClient.ts`'s `apiGet`/`apiPost`/`apiPatch` almost exactly — the same shared client already used by every composable built this session (Reception, PatientFlow).
- **CSRF helpers**: `xsrfCookieToken()`, `csrfMetaToken()`, `csrfRequestHeaders()`, `setCsrfToken()`, `refreshCsrfToken()` (2047–2094) — all local, not shared.
- **Notification**: already uses the shared `messageFromUnknown`/`notifyError`/`notifySuccess` from `@/lib/notify` — no duplication here.
- **~35 local types** (103–463), none exported: `Patient`, `ActiveRoutingTicket`, `DirectServiceRequestType`, `PatientListResponse`, `PatientStatusCounts`, `PatientWarning`, `PatientStoreResponse`, `PatientTimelineAppointment`/`Admission`/`MedicalRecord`, `PatientTimelineEvent`, `PatientActivityFeedEvent`, `PatientWorkflowRecommendation`, `PatientVisitHandoffMode`/`Source`, `PatientAuditLog`, `PatientInsuranceRecord`/`Form`, `SearchForm`, `PatientRegistrationForm`, `PatientEditForm`, `PatientStatusForm`, and more.
- **Already-extracted shared libraries this file already consumes cleanly**: `@/lib/offlinePatientRegistration.ts` (617 lines), `@/lib/patientLocations.ts` (111 lines, region/district presets), `@/lib/patientChart.ts` (30 lines), `@/lib/locale.ts` (a large translation map at 463–553).

---

## 5. Comparison against the established V2 architecture

`ShowV2.vue` (1840 lines) imports 11 dedicated composables from `@/composables/patientChart/` — one per data domain (`usePatientMedicalRecords`, `usePatientAppointments`, `usePatientEncounters`, `usePatientChartOrderStream`, `usePatientBillingInvoices`, `usePatientAllergies`, `usePatientMedicationProfile`, `usePatientMedicationReconciliation`, `useVisitScope`, `usePatientChartOrderLifecycle`, `usePatientChartTimeline`), all TanStack-Query-backed.

`IndexV2.vue` (476 lines) imports 5 from `@/composables/medicalRecordsIndex/` (`useMedicalRecordList`, `useMedicalRecordListFilters`, `usePatientDirectory`, `useMedicalRecordStatusAction`, `useMedicalRecordStatusCounts`), same TanStack pattern. Both use `computed()`-wrapped `usePlatformAccess()` for permissions, not one-time snapshots.

Mapping `patients/Index.vue`'s feature areas onto this shape:

| Feature area | Fit |
|---|---|
| List / filters / status counts | Clean, direct analog to `useMedicalRecordList`/`useMedicalRecordListFilters`/`useMedicalRecordStatusCounts` |
| Registration + duplicate detection | New composable needed; the client/server duplicate-scoring duplication (§1) is a decision point for the plan, not resolved here |
| Visit handoff (5 modes) | Highest-complexity extraction. Already partially de-risked this session: the walk-in race condition is fixed (§7), and direct-services now has a real backend home (`ServiceRequest`, visible on `patient-flow/Board.vue`) it didn't have before this session started |
| Details sheet (timeline / audit / insurance) | Maps to roughly 3 composables, similar domain split to `ShowV2.vue` |
| Edit / status dialogs | Thin; likely a shared mutation composable |
| Permissions | Drop the redundant `GET /auth/me/permissions` fetch; switch snapshot refs to `computed()` over `usePlatformAccess()` |
| `apiRequest()` | Replace with the shared `@/lib/apiClient.ts` functions already proven in this session's own composables |
| Offline sync | Already cleanly extracted (`offlinePatientRegistration.ts`) — a rewrite mainly needs to wire it into new composables, not rebuild it |

---

## 6. Existing test coverage

- **Backend**: `tests/Feature/Patient/PatientApiTest.php` — 2428 lines, substantial coverage of registration, duplicate detection, status changes, etc.
- **Frontend Vitest**: zero. No spec file anywhere in `resources/js` references `patients/Index.vue` or `pages/patients`.
- **E2E**: `playwright.config.ts` and `tests/e2e/` exist and are real (auth, encounter-workspace journey, dashboard workflow-context, protected-routes specs). `patients` appears only as a generic auth-required route entry in `tests/e2e/security/protected-routes.spec.ts` and as a support helper in `tests/e2e/support/encounter-workspace.ts` (navigates through patient creation en route to an encounter — not a test of this page's own logic). **No functional e2e coverage of registration, duplicate detection, visit handoff, or the details sheet.**

This matters directly for rewrite risk: a full rewrite of a 12,000-line page with zero frontend/e2e coverage and no composable boundaries to test in isolation is real risk, not a process formality — the backend contract is tested, the frontend behavior is not.

---

## 7. Already fixed or mature — not fresh findings

- **Walk-in check-in race condition**: fixed this session (`3facfbc`, "fix(reception): close walk-in check-in race window in patient handoff panel"). `startOutpatientWalkInFromHandoff()` and `sendToEmergencyQueue()` now use the atomic `POST /reception/walk-ins` instead of a two-call create-then-check-in sequence. Do not re-flag in the plan.
- **Redundant scope/facility header display**: removed in `9f5cb3e`, predates this session.
- **Offline sync and duplicate detection**: both show incremental, iterative build-out across many older commits — mature, working features, not half-finished.
- **`ShowV2.vue`'s sticky-header/bounded-scroll fix** (98dvh) was applied to `ShowV2.vue` itself this session, not to this file — `patients/Index.vue` has no V2 surface treatment at all yet, consistent with §5.

---

## 8. Not resolved here (belongs in the plan)

- Whether duplicate-detection scoring should be deduplicated (call the server's scoring only) or kept as an intentional client-side fast-path with the server as source of truth.
- How the 5-mode Visit Handoff sheet should be decomposed — one composable per mode, or a shared "visit handoff" composable with mode-specific sub-logic.
- Whether the direct-services mode's UI should be simplified now that `patient-flow/Board.vue` gives it a real downstream view it didn't have before.
- Rollout mechanism (flag-gated route vs. direct cutover) — this codebase's own precedent has drifted here: `config/frontend_rebuild.php`'s flags exist but are no longer referenced anywhere in `routes/web.php`; every completed V2 cutover (`ShowV2.vue`) now ships as the direct route with a `/legacy` fallback path, not a config flag. The plan needs to pick one explicitly rather than assume.
