# Appointments Index — Audit

**Document type**: Read-only audit, no code changes. Method: structural survey of `resources/js/pages/appointments/Index.vue` (8,602 lines — script 1–5225, template 5226–8602) via targeted reads and greps for every sheet/dialog, state declaration, and API call, cross-referenced against `reports/queue-worklist-navigation-audit.md` (already covers this file's hidden Triage Queue/Clinician Queue modes — not re-derived here, only cited), `reports/patients-index-audit.md` (the reference shape for this document), and `routes/api.php`/backend controllers for endpoints the frontend does and doesn't call. Establishes facts only; a separate `appointments-index-modernization-plan.md` will hold recommendations, matching this session's audit-then-plan convention.

---

## 1. Feature inventory

Thirteen distinct Sheet/Dialog surfaces (vs. `patients/Index.vue`'s 6), identified by their `:open="xOpen"` state and template location:

| Feature | Open-state ref (line) | Template range | Size | Gate |
|---|---|---|---|---|
| Page header, KPIs, toolbar, queue table | — | 5226–5904 | ~680 | `canRead` (line 748, `appointments.read`) |
| Advanced filters sheet | 485 | 5905–5944 | ~40 | — |
| Mobile filters drawer | 486 | 5945–6036 | ~90 | — (parallel implementation of the same filter set as the advanced filters sheet — a real duplication, not confirmed further this pass) |
| **Create/Schedule Appointment sheet** | 487 | 6037–6418 | ~380 | `canCreate` |
| **Appointment Details sheet** (Summary / Workflow tabs) | 519 | 6419–7947 | ~1530 | per-tab/per-section computeds (`canReadLaboratory`, `canReadPharmacy`, `canReadRadiology`, `canReadTheatre`, `canReadBilling`, `canManageReferrals`, `canViewAudit`, `canReadMedicalRecords`, `canStartConsultation`, etc.) |
| Consultation takeover dialog | 695 | 7948–7984 | ~35 | `canManageProviderSession` (line 778, `appointments.manage-provider-session`) |
| **Triage recording sheet** | 580 | 7985–8199 | ~215 | `canRecordOpdTriage` |
| Create-leave-confirm dialog | 497 | 8200–8225 | ~25 | — |
| Details lifecycle dialog | 547 | 8226–8263 | ~40 | — |
| Consultation type override dialog | 556 | 8264–8302 | ~40 | `canOverrideConsultationType` |
| Status change dialog | 570 | 8303–8383 | ~80 | — |
| Reschedule dialog | 660 | 8384–8450 | ~65 | — |
| Referral creation dialog | 670 | 8451–8554 | ~100 | `canManageReferrals` |
| Referral status dialog | 684 | 8555–8601 (EOF) | ~47 | `canManageReferrals` |

**The Appointment Details sheet (~1530 lines) is the single largest feature**, roughly comparable in scale to `patients/Index.vue`'s Patient Details sheet (~2020 lines). Only 2 `TabsTrigger`s (`summary`, `workflow`), each internally divided into many labeled sub-sections rather than further tabs:
- **Summary tab**: People & assignment, Visit documentation, Consultation classification, Post-discharge handoff, Triage & intake, Visit payment coverage, Timestamps, Current status, Clinical path, Primary actions, Related workflows.
- **Workflow tab**: Details by area (embedded lab/pharmacy/radiology/theatre/billing cross-module cards), Referrals (outgoing handoffs, pipeline summary, all-referrals list), Audit trail (event log).

This single sheet is functionally equivalent to `ShowV2.vue`'s entire tab set (Overview/Timeline/Orders/Billing/Records/Audit) collapsed into 2 tabs of one dialog on top of the queue page, rather than a dedicated chart-style page.

**The two hidden queue modes** (`QueueMode = 'all' | 'triage' | 'clinical'`, `?view=triage`/`?view=clinical`) are already fully documented in `reports/queue-worklist-navigation-audit.md` §3 — not re-derived here. That audit's fixes (§7–8 of that document) are already shipped: `triageQueueHref()` and sidebar entries for both modes.

**A real, concrete asymmetry found this pass, not previously documented**: the backend has a full nurse-side "claim triage" capability — `PATCH /appointments/{id}/claim-triage` and `/release-triage-claim` (`routes/api.php:679-684`, `AppointmentController::claimTriage`/`releaseTriageClaim`, backed by `tests/Feature/Appointment/AppointmentTriageClaimApiTest.php`, 188 lines) — mirroring the consultation-ownership pattern clinicians already get (`start-consultation` with `forceTakeover`, wired to the Consultation takeover dialog above). The frontend never calls either triage-claim endpoint (confirmed by exhaustive grep — zero references anywhere in this file). `submitTriage()` (line 3470) calls `PATCH /appointments/{id}/triage` directly with no claim/lock step first — any nurse with `appointments.record-triage` can open the Triage sheet for any `waiting_triage` appointment with no contention protection, unlike the clinician side which has a full takeover-confirmation UX for exactly this race. A tested backend capability with zero frontend consumer, structurally identical to the pattern `reports/queue-based-workflow-audit.md` flagged for a different feature earlier this session.

---

## 2. State management

163 top-level `ref`/`reactive`/`computed` declarations (comparable scale to `patients/Index.vue`'s ~150+). **No composable extraction exists** — confirmed via `find resources/js/composables/appointments` (no such directory exists); every piece of state and every API call lives directly in this one `<script setup>` block, same core structural gap as `patients/Index.vue` had before its rebuild.

**Permissions are already reactive** — a genuine, material difference from `patients/Index.vue`'s pre-rebuild state: all 28 permission computeds (`canRecordOpdTriage`, `canUseMyClinicalQueue`, `canStartConsultation`, `canManageReferrals`, `canReadLaboratory`, etc., line 759–813) are `computed(() => isFacilitySuperAdmin.value || hasPermission(...))`, matching `ShowV2.vue`/`IndexV2.vue`'s established pattern exactly. Zero snapshot-`ref()` permission booleans found (confirmed via grep). No redundant `GET /auth/me/permissions` call exists either (confirmed — zero matches). **A rebuild here does not need to fix reactivity or the redundant-fetch problem `patients/Index.vue` had; that work is already done.**

**No offline-sync handling exists** (confirmed — zero references to `offline`/`isOnline`/`navigator.onLine`). Unlike patient registration, check-in/scheduling actions here are inherently synchronous, queue-state-mutating operations; whether offline resilience is a real requirement for this page is a product question, not something being silently dropped from an existing feature (there is nothing to preserve).

---

## 3. API surface

Calls go through a page-local `apiRequest<T>()` (line 1681) — **but unlike `patients/Index.vue`'s fully-duplicated local client, this is a thin thirteen-line wrapper around the shared `apiRequestJson()` from `@/lib/apiClient.ts`**, adding only an `entitlementContext` label for error messages (confirmed by reading the function body). One direct `apiPatch<T>()` call also exists (line 3379, consultation-type override), used straight from the shared client with no wrapper at all. This file does not have the "duplicated CSRF/HTTP client" problem `patients/Index.vue` had — a real, material difference worth preserving in a rebuild (keep using the shared client, wrapper or not) rather than a finding requiring fixes.

Distinct endpoints called:
- **List/scope**: `GET /appointments`, `GET /appointments/status-counts`, `GET /appointments/department-options`, `GET /staff/clinical-directory`, `GET /billing-payer-contracts`.
- **Create**: `POST /appointments`.
- **Update/status/reschedule**: `PATCH /appointments/{id}/status`, `PATCH /appointments/{id}/consultation-type`, `PATCH /appointments/{id}/start-consultation` (with `forceTakeover`), and (per §1) `PATCH /appointments/{id}/triage` — but never `/claim-triage` or `/release-triage-claim`.
- **Referrals**: `POST /appointments/{id}/referrals`, `GET /appointments/{id}/referrals`, `PATCH .../referrals/{referralId}/status`.
- **Audit**: `GET /appointments/{id}/audit-logs`.
- **Cross-module context** (Details sheet's Workflow tab): `GET /medical-records`, `GET /laboratory-orders`, `GET /pharmacy-orders`, `GET /radiology-orders`, `GET /theatre-procedures`, all patient-scoped, all fan-out reads for the same visit — a real N-query-per-open-detail-sheet cost pattern, not measured this pass (same caution `encounter-state-machine-design/02`'s ~91-query finding raised elsewhere in this codebase; flag for the plan, don't assume cheap).

**Cross-page navigation**: same 7-destination routing surface `patients-index-audit.md` §3 documented (`/emergency-triage`, `/laboratory-orders`, `/pharmacy-orders`, `/radiology-orders`, `/theatre-procedures`, `/billing-invoices`), reached here via `encounterWorkspaceLegacyAppointmentHref()`/`patientChartHref()` (both already-shared helpers, not page-local) plus page-local visit-workflow launchers — a rewrite needs to preserve this, same as the patients rebuild did.

---

## 4. Local helpers and types

- **`apiRequest<T>()`** (1681–1694): thin wrapper, see §3 — not a duplication finding.
- **35 local types** (not exported): `Appointment`, `Referral`, `AuditLog`, `MedicalRecordSummary`, `LaboratoryOrder`, `PharmacyOrder`, `RadiologyOrder`, `TheatreProcedure`, `StaffProfileSummary`, `DepartmentListResponse`, `BillingPayerContractListResponse`, `WorkspacePreset`, `QueueMode`, `AppointmentStatus`, `AppointmentFocusAction`, and more — same "one big local-types block" shape `patients/Index.vue` had.
- **Already-extracted shared libraries this file already consumes cleanly**: `@/lib/apiClient.ts` (§3), `@/lib/encounterWorkspace.ts` (`encounterWorkspaceLegacyAppointmentHref`), `@/lib/patientChart.ts` (`patientChartHref`), `@/lib/labels.ts` (`formatEnumLabel`), `@/lib/notify.ts`, `@/composables/usePlatformAccess.ts`, `@/composables/useLocalStorageBoolean.ts`. This file is materially better-integrated with shared infrastructure than `patients/Index.vue` was pre-rebuild.

---

## 5. Comparison against the established V2 architecture

Mapping this file's feature areas onto the `ShowV2.vue`/`IndexV2.vue`/`patients/IndexV2.vue` composable shape:

| Feature area | Fit |
|---|---|
| List / filters / status counts / KPIs | Clean, direct analog to `usePatientList`/`usePatientListFilters`/`usePatientStatusCounts` — advanced-filters-sheet vs. mobile-filters-drawer duplication (§1) is a decision point: one composable's reactive state driving two UI surfaces, or genuinely separate |
| Create/Schedule Appointment | One composable, thin — closest analog is `usePatientRegistration`, but no duplicate-detection complexity here |
| **Appointment Details sheet** | Highest-complexity extraction by far — 1530 lines, ~6 cross-module reads. Likely 4-5 composables split by domain (own-appointment mutations; referrals; audit; cross-module summary fan-out), mirroring `ShowV2.vue`'s 11-composable domain split rather than attempting one big "details" composable |
| Triage recording + (unused) claim/lock | New composable needed either way; whether to also wire up the dormant claim-triage endpoints (§1) is a real scope decision for the plan — building a nurse-facing claim UX from scratch vs. rebuilding the existing unclaimed flow as-is |
| Consultation takeover, type override, status, reschedule | Thin mutation composables, same shape as `usePatientStatusChange`/`usePatientEdit` |
| Referrals (create/list/status) | One composable, `useAppointmentReferrals`-shaped |
| Permissions | **Already correct** — `computed()` over `usePlatformAccess()`, no redundant fetch (§2). Nothing to fix here, unlike `patients/Index.vue` |
| `apiRequest()` | **Already correct** — thin wrapper over the shared client (§3). Preserve the pattern, don't flag as a duplication problem |
| Offline sync | Not applicable — no existing feature to preserve (§2) |

**Net assessment**: this file's architectural debt is narrower than `patients/Index.vue`'s was — permissions and the API client are already sound. The rebuild's real cost is almost entirely the sheer size and count of independent Sheet/Dialog surfaces (13 vs. 6) and the Details sheet's cross-module fan-out, not the foundational issues the patients rebuild had to fix first.

---

## 6. Existing test coverage

- **Backend**: substantial — `tests/Feature/Appointment/AppointmentApiTest.php` (2334 lines), `ConsultationClassificationApiTest.php` (896 lines), `AppointmentTriageClaimApiTest.php` (188 lines, covering the dormant claim/release endpoints — the backend capability is tested even though nothing in the frontend calls it), `AppointmentStatusTransitionGuardTest.php` (136 lines). ~3554 lines total, comparable to `patients/Index.vue`'s 2428-line `PatientApiTest.php`.
- **Frontend Vitest**: zero. No spec file anywhere in `resources/js` references `appointments/Index.vue` or `pages/appointments`.
- **E2E**: `appointments` appears only as a generic auth-required route entry in `tests/e2e/security/protected-routes.spec.ts` and `tests/e2e/clinical/selector-policy.spec.ts` (selector-convention checks, not functional tests), plus a support-helper mention in `tests/e2e/support/encounter-workspace.ts` en route to an unrelated journey. **No functional e2e coverage of scheduling, check-in, triage, referrals, consultation takeover, or the Details sheet** — identical shape to `patients-index-audit.md` §6's finding.

Same rewrite-risk framing as the patients audit: a 8,602-line page with zero frontend/e2e coverage and no composable boundaries is real risk. The backend contract is well-tested; the frontend behavior is not independently verified anywhere.

---

## 7. Already fixed or mature — not fresh findings

- **Reactive permissions, shared API client**: already correct, see §2/§3/§5. Do not re-flag in the plan as if this were `patients/Index.vue`'s starting state.
- **Nurse-triage-queue banner linking to `/reception/queue`**: shipped this session (`11731fd`, "feat(reception): link the nurse triage banner to the reception queue view") — the `showTriageQueueSuggestion` computed (line 891) and its associated banner are a working, deliberate cross-link to the newer Reception Queue page, not legacy cruft.
- **Redundant scope/facility header display**: removed (`9f5cb3e`), predates the triage-queue work.
- **Walk-in race condition, atomic check-in**: this page never had it — `RegisterWalkInAndCheckInUseCase`/`POST /reception/walk-ins` are `reception/Queue.vue`'s and `PatientVisitActionsMenu.vue`'s concern, not this file's; this page only creates scheduled appointments (`POST /appointments`) and records triage/consultation state for appointments that already exist.
- **The two hidden queue modes and the `triageQueueHref()`/sidebar-visibility gaps**: already found and already fixed this session — see `reports/queue-worklist-navigation-audit.md` §3, §7, §8. Do not re-flag; the modes themselves (`queueMode`, `isTriageQueue`, `isMyClinicalQueue`, `queueModeLabel`) are working, tested-by-use code, not something a rebuild needs to invent.

---

## 8. Not resolved here (belongs in the plan)

- Whether to build a real nurse-side "claim triage" UX around the dormant `claim-triage`/`release-triage-claim` endpoints (§1) as part of the rebuild, or carry the current unclaimed/first-come flow forward as-is and treat claim/lock as separately-scoped future work (the same staged-trust posture `queue-based-workflow-modernization-plan.md`'s Mode A→B→C framing already established for a different feature).
- Whether the Advanced Filters sheet and Mobile Filters Drawer should collapse into one responsive component backed by one composable, or stay genuinely separate (§1/§5) — not confirmed which is actually true this pass, only that both exist and both reference the same filter fields.
- How to decompose the Appointment Details sheet's Workflow tab — one composable per cross-module domain (mirroring `ShowV2.vue`'s 11-composable split), or a narrower "visit context" composable given every read here is patient/visit-scoped rather than the chart's broader history view.
- Whether the cross-module fan-out inside the Details sheet (5-6 separate reads on open) needs a measured performance pass before trusting it at real data volumes, per this session's own established caution (`encounter-state-machine-design/02`).
- Rollout mechanism — same decision `patients-index-modernization-plan.md` §3.3/§5 made explicitly (direct-cutover-with-legacy-fallback, matching `ShowV2.vue`'s precedent): needs the same explicit confirmation here, not assumed by continuity with the last plan.
- Given the file's narrower architectural debt (§5), whether this rebuild is scoped as one continuous effort or split into two: (a) the queue/list/create/status/reschedule surface, much closer in shape to `patients-index-modernization-plan.md`'s Phases 1/2/4, and (b) the Details sheet as its own larger effort — a sequencing question, not answered here.
