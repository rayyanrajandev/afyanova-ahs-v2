# Afyanova AHS v2 - Frontend UX Phase 0 Module Completion Matrix 2026

**Document status:** Phase 0 execution deliverable  
**Last updated:** 2026-05-14  
**Parent plan:** `10-FRONTEND_UX_PRODUCT_COMPLETION_PLAN_2026.md`  
**Roadmap phase:** Phase 0 - Product truth and module inventory  
**Prepared from perspective:** Principal healthcare software architect, distributed systems engineer, Laravel enterprise consultant

---

## 1. Purpose

This matrix is the live product truth document for frontend and hospital workflow completion.

It answers one question:

```text
Does each module merely exist, or is it complete enough to be called a modern production hospital workflow?
```

The current conclusion is that the system has broad functionality, but most critical workflows still require UX hardening, automated journey tests, and user acceptance before they should be called complete.

---

## 2. Review Scope

This Phase 0 review checked:

- `documents/10-FRONTEND_UX_PRODUCT_COMPLETION_PLAN_2026.md`
- `resources/js/pages`
- `resources/js/components`
- `resources/js/lib/apiClient.ts`
- `routes/web.php`
- `routes/api.php`
- `package.json`

This review did not perform clinical UAT, browser screenshots, accessibility testing, or production-load testing.

---

## 3. Status Definitions

| Status | Meaning |
|---|---|
| Built | Page/API functionality exists and appears substantially implemented |
| Partial | Functionality exists, but workflow quality, UX, testing, or integration is not complete |
| Needs validation | Code appears present, but product correctness must be proven through tests and UAT |
| Missing | Expected modern workflow is not visible or not confirmed in the current scan |
| Online only | Should not be made offline in the near term |

Priority:

| Priority | Meaning |
|---|---|
| P0 | Required before production-complete claim |
| P1 | Required for enterprise maturity, but can follow P0 |
| P2 | Enhancement after core hospital flows are stable |

---

## 4. Executive Completion Snapshot

| Area | Current state | Completion judgment |
|---|---|---|
| Module breadth | Strong | Many hospital modules exist |
| Frontend consistency | Partial | Local API helpers and page-specific patterns remain |
| UX polish | Partial | Large workbenches need decomposition and journey polish |
| Clinical safety UX | Needs validation | Must be proven through UAT and journey tests |
| Accessibility | Needs validation | No visible WCAG 2.2 AA test process yet |
| E2E testing | Foundation started | Playwright, Chromium install script, login/access-control smoke tests, authenticated selector-policy guard, axe helper, and CI smoke job added 2026-05-13; live local browser run still needs reachable app URL/server |
| PHI browser storage | Partially mitigated | Patient/clinical draft and lookup recent persistence disabled; continue auditing all browser storage before offline work |
| Offline readiness | Not ready | Online P0 workflows must stabilize first |

---

## 5. Module Completion Matrix

| Module / workflow | Frontend evidence | API / route evidence | Current status | Priority | Completion decision |
|---|---|---|---|---:|---|
| Dashboard | `resources/js/pages/Dashboard.vue` | platform and analytics APIs | Partial | P1 | Keep, but standardize dashboard storage and performance |
| Patient registration/search | `resources/js/pages/patients/Index.vue`, `components/patients/PatientLookupField.vue` | `patients` web route and patient APIs | Partial | P0 | PHI draft and patient lookup recent localStorage writes disabled 2026-05-12; must still polish duplicate prevention, patient context, and E2E |
| Patient chart | `resources/js/pages/patients/chart/Show.vue` | `patients/{id}/chart` web route | Partial | P0 | Patient chart now shows the shared `ClinicalContextBanner`; must still validate clinical timeline, orders, records, and safety context |
| Appointments | `resources/js/pages/appointments/Index.vue` | `appointments` web route and API routes | Partial | P0 | `window.axios` removed and local API wrapper now delegates to shared `apiClient` as of 2026-05-12; preferred/referral clinician normal flows now use shared `ClinicianPicker` directory selectors or restricted-state guidance as of 2026-05-13; locked-patient scheduling now shows the shared `ClinicalContextBanner` |
| Walk-in service requests | `resources/js/pages/walk-in-service-requests/Index.vue` | API routes present by module scan | Partial | P0 | Direct service request creation now shows the shared `ClinicalContextBanner`; validate handoff flow into triage, billing, lab, pharmacy, or consultation |
| Emergency triage | `resources/js/pages/emergency-triage/Index.vue` | `emergency-triage` routes | Partial | P0 | Accepting clinician normal flow now uses shared `ClinicianPicker` directory selector or restricted-state guidance as of 2026-05-13; triage intake now shows the shared `ClinicalContextBanner`; add triage-to-admission journey test |
| Patient vitals | API endpoint visible; dedicated page not confirmed | `patient-vitals` API route | Missing/partial | P0 | Build or confirm integrated vitals UX, abnormal warnings, trend visibility, and tests |
| Medical records / consultations | `resources/js/pages/medical-records/Index.vue` | `medical-records` web/API routes | Partial | P0 | Plain local clinical draft writes disabled 2026-05-12; consultation composer now shows the shared `ClinicalContextBanner`; split consultation workflow components and add E2E |
| Laboratory orders/results | `resources/js/pages/laboratory-orders/Index.vue` | lab routes and document contracts | Partial | P0 | Plain create-draft localStorage disabled by shared draft policy 2026-05-12; laboratory order creation now shows the shared `ClinicalContextBanner`; validate order-to-result journey, specimen states, results verification, and E2E |
| Radiology orders/results | `resources/js/pages/radiology-orders/Index.vue` | radiology routes and catalog routes | Partial | P1 | Plain create-draft localStorage disabled by shared draft policy 2026-05-12; radiology order creation now shows the shared `ClinicalContextBanner`; standardize order/result UX and audit/report handoff |
| Prescriptions / pharmacy orders | `resources/js/pages/pharmacy-orders/Index.vue` | pharmacy APIs | Partial | P0 | Plain create-draft localStorage disabled by shared draft policy 2026-05-12; pharmacy order creation now shows the shared `ClinicalContextBanner`; validate prescription-to-dispense, stock visibility, substitution, billing, and E2E |
| Admissions | `resources/js/pages/admissions/Index.vue` | `admissions` web/API routes | Partial | P0 | Admission lookup recent localStorage writes disabled 2026-05-12; admission creation now shows the shared `ClinicalContextBanner`; polish admission, transfer, discharge checklist, and appointment/admission context |
| Inpatient ward | `resources/js/pages/inpatient-ward/RebuiltPage.vue` | `inpatient-ward` routes | Partial | P0 | Ward documentation workspace now shows the shared `ClinicalContextBanner`; continue stabilizing the workbench and test care tasks and discharge |
| Theatre procedures | `resources/js/pages/theatre-procedures/Index.vue` | theatre routes | Partial | P1 | Plain create-draft localStorage disabled by shared draft policy 2026-05-12; operating/anesthetist normal flow now uses shared `ClinicianPicker` staff selectors or restricted-state guidance as of 2026-05-13; theatre procedure scheduling now shows the shared `ClinicalContextBanner` |
| Billing invoices | `resources/js/pages/billing-invoices/Index.vue` | billing invoice routes and document routes | Partial | P0 | Plain create-draft localStorage and audit handoff sessionStorage resource IDs disabled 2026-05-12; billing invoice creation now shows the shared `ClinicalContextBanner`; P0.8 now routes create/edit/status/payment/reversal mutations through shared API-client request correlation with idempotency/request keys; split large workbench and continue validating charge/payment/claim handoff behavior |
| Billing cash | `resources/js/pages/billing-cash/Index.vue` | billing cash routes | Partial | P0 | Cash account setup and selected-account cashier workbench now show the shared `ClinicalContextBanner`; validate cashier journey, permissions, receipts, and payment failure handling |
| Billing refunds | `resources/js/pages/billing-refunds/Index.vue` | refund API routes | Partial | P1 | Refund request, approval, and payout dialogs now show the shared `ClinicalContextBanner`; P0.8 finance-form safety adds shared API client usage, discard protection, and idempotency/request keys; validate approval, processing, audit trail, and role separation |
| Billing discounts | `resources/js/pages/billing-discounts/Index.vue` | discount API routes | Partial | P1 | Discount policy create/apply dialogs now show the shared `ClinicalContextBanner`; P0.8 finance-form safety pilot adds shared API client usage, discard protection, and idempotency/request keys; validate approval rules, audit trail, and invoice impact |
| Billing payment plans | `resources/js/pages/billing-payment-plans/Index.vue` | payment-plan routes | Partial | P1 | Payment-plan setup and installment payment dialogs now show the shared `ClinicalContextBanner`; P0.8 finance-form safety adds shared API client usage, discard protection, and idempotency/request keys; validate plan lifecycle and billing/discharge links |
| Billing payer contracts | `resources/js/pages/billing-payer-contracts/Index.vue` | payer contract APIs | Partial | P1 | P0.8 finance-form safety now routes contract, negotiated-price, and authorization-rule create/edit/status mutations through the shared API client with discard protection and idempotency/request keys; continue validating contract governance, manual review UX, and claim integration |
| Billing service catalog | `resources/js/pages/billing-service-catalog/Index.vue` | service catalog APIs | Partial | P1 | P0.8 finance-form safety now routes service-price create, identity/pricing/status updates, and new-version creation through the shared API client with discard protection and idempotency/request keys; continue validating governed catalog editing, pricing safety, and downstream payer impact behavior |
| Billing financial reports | `resources/js/pages/billing-financial-reports/Index.vue` | reporting APIs | Needs validation | P2 | Keep online only; add export controls and report-access tests |
| Claims / insurance | `resources/js/pages/claims-insurance/Index.vue` | claims routes and document routes | Partial | P1 | Claim intake from billing handoff now shows the shared `ClinicalContextBanner`; validate claim preparation, submission tracking, payer status, and audit trail |
| Inventory / procurement | `resources/js/pages/inventory-procurement/Index.vue` | inventory/procurement routes | Partial | P0 | Plain create-draft localStorage disabled by shared draft policy 2026-05-12; dispensing claim-link intake now shows the shared `ClinicalContextBanner`; split workbench and validate receive, transfer, adjustment, reconciliation, and stock concurrency |
| Suppliers | `resources/js/pages/inventory-procurement/suppliers/Index.vue` | supplier routes | Needs validation | P1 | Standardize supplier lifecycle and audit UX |
| Warehouses | `resources/js/pages/inventory-procurement/warehouses/Index.vue` | warehouse routes | Needs validation | P1 | Validate facility-aware stock locations and transfers |
| POS | `resources/js/pages/pos/Index.vue` | POS sale/session document routes and APIs | Needs validation | P1 | Validate register sessions, OTC, cafeteria, lab quick sale, voids, refunds, and reports |
| Staff profiles | `resources/js/pages/staff/Index.vue` | staff APIs | Partial | P1 | Standardize staff search, profile editing, document upload, and status transitions |
| Staff credentialing | `resources/js/pages/staff-credentialing/Index.vue` | credentialing APIs | Needs validation | P1 | Validate credential expiry, verification, and regulatory records |
| Staff privileges | `resources/js/pages/staff-privileges/Index.vue` | privilege APIs | Partial | P1 | Remove facility/specialty UUID fallback from normal flow |
| Platform users/RBAC | `resources/js/pages/platform/admin/users`, roles, permissions | platform admin API routes | Needs validation | P0 | Validate user lifecycle, RBAC changes, bulk actions, audit logs, and denied access |
| Platform facility config | `resources/js/pages/platform/admin/facility-config/Index.vue` | facility config APIs | Needs validation | P0 | Validate multi-facility context, ownership, subscription, and rollout safety |
| Clinical catalogs | `resources/js/pages/platform/admin/clinical-catalogs/Index.vue` | lab/radiology/theatre/formulary catalog APIs | Needs validation | P1 | Validate governed catalog lifecycle and downstream order impact |
| Help / shortcuts | `resources/js/pages/help` | help route | Needs validation | P2 | Align help content with actual workflows |
| Settings | `resources/js/pages/settings` | settings routes | Needs validation | P2 | Validate session, preferences, and security settings |
| Auth | `resources/js/pages/auth` | Laravel auth routes | Needs validation | P0 | Validate login, session expiry, two-factor state, and facility context handoff |

---

## 6. Oversized Frontend Workbenches

These files should not be rewritten at once. They should be decomposed gradually around real workflow boundaries.

| File | Approx. lines | Risk |
|---|---:|---|
| `resources/js/pages/pharmacy-orders/Index.vue` | 15537 | Very high |
| `resources/js/pages/billing-invoices/Index.vue` | 13870 | Very high |
| `resources/js/pages/inventory-procurement/Index.vue` | 11324 | Very high |
| `resources/js/pages/medical-records/Index.vue` | 9329 | Very high |
| `resources/js/pages/laboratory-orders/Index.vue` | 9135 | Very high |
| `resources/js/pages/admissions/Index.vue` | 7388 | High |
| `resources/js/pages/patients/Index.vue` | 7243 | High |
| `resources/js/pages/appointments/Index.vue` | 7102 | High |
| `resources/js/pages/radiology-orders/Index.vue` | 6860 | High |
| `resources/js/pages/theatre-procedures/Index.vue` | 6502 | High |
| `resources/js/pages/patients/chart/Show.vue` | 5498 | High |
| `resources/js/pages/emergency-triage/Index.vue` | 4334 | High |

---

## 7. Manual Identifier Entry Points

Normal hospital staff workflows should not require raw IDs. These are known areas for remediation:

| Area | Evidence | Required improvement |
|---|---|---|
| Patient lookup | `PatientLookupField.vue` exposes `allowManualIdFallback` but defaults it off | Normal flow uses searchable patient picker; UUID fallback now requires explicit admin/support opt-in |
| Admission lookup | `AdmissionLookupField.vue` exposes `allowManualIdFallback` but defaults it off | Normal flow uses admission search by patient, ward, bed, and admission number; UUID fallback now requires explicit admin/support opt-in |
| Linked context lookup | `LinkedContextLookupField.vue` exposes `allowManualIdFallback` but defaults it off | Appointment/admission context lookup no longer accepts manual UUIDs in normal flows unless a support/admin screen explicitly opts in |
| Appointments | Preferred and target clinician fields | Normal flow now uses shared `ClinicianPicker` clinician directory selector; continue adding E2E and UAT evidence |
| Emergency triage | Accepting clinician field | Normal flow now uses shared `ClinicianPicker` accepting clinician selector; continue adding transfer journey test evidence |
| Theatre | Operating clinician and anesthetist fields | Normal flow now uses shared `ClinicianPicker` operating clinician and anaesthesia staff selectors; continue adding theatre scheduling journey test evidence |
| Staff privileges | Facility and specialty UUID fallback | Use facility and specialty selectors; restrict UUID fallback to admin repair tools |
| Platform admin rollout | Facility UUID fallback | Use governed facility selector |

---

## 8. Browser Storage Review

| Area | Storage found | Risk decision |
|---|---|---|
| Patient registration | `localStorage` draft in `patients/Index.vue` | P0 risk if PHI is stored in plain browser storage |
| Medical records | `localStorage` clinical draft in `medical-records/Index.vue` | P0 risk if clinical notes or patient context are stored |
| Patient/admission lookup recents | In-memory only in lookup components | Persistent localStorage writes disabled and app-start legacy purge added 2026-05-12 because labels/searches may contain PHI |
| Dashboard preferences | `localStorage`/`sessionStorage` | Acceptable if non-PHI |
| Lab/pharmacy/billing handoff state | In-memory resource handoff; non-PHI telemetry remains in `sessionStorage` | Audit export retry handoff IDs no longer persist to `sessionStorage`; app-start legacy purge added 2026-05-12 |
| UI preferences | `localStorage` | Acceptable for non-sensitive preferences |

Decision:

```text
Plain localStorage is allowed only for non-sensitive UI preferences.
Patient and clinical drafts must move to a safer draft policy before offline work expands.
```

---

## 9. Frontend Test Coverage Status

Current package scripts include build, lint, formatting, project guard scripts, and Playwright E2E scripts.

Playwright foundation added 2026-05-13:

- `playwright.config.ts`
- `tests/e2e/auth/login.spec.ts`
- `tests/e2e/security/protected-routes.spec.ts`
- `tests/e2e/clinical/selector-policy.spec.ts`
- `tests/e2e/support/auth.ts`
- `tests/e2e/support/accessibility.ts`
- `tests/e2e/README.md`

Verification:

- `npm run test:e2e:list` passes and lists 11 tests.
- `npm run test:e2e:install` installed Chromium locally.
- `.github/workflows/tests.yml` now has a dedicated `e2e-smoke` job for login and unauthenticated access-control smoke coverage.
- Live smoke run was blocked in this sandbox because `php artisan serve` cannot bind locally and browser network access to the configured tunnel URL returned `ERR_NETWORK_ACCESS_DENIED`.

Completion requirement:

```text
Every P0 workflow must have at least one happy-path E2E test and one validation/error-path E2E test before production-complete sign-off.
```

---

## 10. Immediate Phase 0 Decisions

1. Treat all P0 modules as not complete until E2E and UAT evidence exists.
2. Do not start broad offline work yet.
3. Start Phase 1 with shared frontend infrastructure and source-tree cleanup.
4. Do not rewrite large pages wholesale.
5. First harden patient, triage, vitals, consultation, lab, pharmacy, admission, billing, and inventory flows.

---

## 11. Next Document

The companion Phase 0 risk and backlog document is:

`10B-FRONTEND_UX_PHASE0_RISK_REGISTER_AND_BACKLOG_2026.md`
