# Afyanova AHS v2 - Frontend UX and Product Completion Plan 2026

**Document status:** Draft execution plan  
**Last updated:** 2026-05-14  
**Prepared from perspective:** Principal healthcare software architect, distributed systems engineer, Laravel enterprise consultant  
**Scope:** Close the gap between broad feature coverage and a modern, safe, production-grade hospital user experience

---

## 1. Executive Decision

The project already has broad hospital functionality, but it should not yet be considered complete from a modern 2026 frontend/product-flow perspective.

The recommended decision is:

```text
Do not start broad offline-first work yet.
First complete and harden the online user experience for critical hospital workflows.
Then add offline support only to workflows that have stable, tested online behavior.
```

This plan defines the frontend, product-flow, accessibility, and workflow-quality work needed before the system can responsibly be called a completed modern online hospital platform.

---

## 2. Current Product Assessment

### What is strong today

- The system has wide module coverage across clinical, administrative, financial, stock, and platform workflows.
- The frontend already uses Vue, Inertia, Vite, Tailwind, and a shared UI component layer.
- There are many established pages for real hospital operations: patients, appointments, admissions, records, lab, pharmacy, radiology, theatre, emergency triage, inpatient ward, billing, claims, inventory, POS, staff, and platform admin.
- The application appears to have a real design-system foundation with shared components for buttons, dialogs, sheets, cards, tabs, inputs, selects, tooltips, sidebars, skeletons, and notifications.
- Some workflows already include draft behavior and rich operational screens.

### What is not complete yet

- Several critical pages are very large single-file workbenches, which makes UX quality, testing, and maintenance harder.
- API access patterns are inconsistent across frontend modules.
- Some user flows still expose raw UUID or user ID entry where hospital users should see searchable, human-readable choices.
- Sensitive patient, clinical, billing, and lookup draft persistence has started moving away from plain browser storage, but the remaining browser-storage surface still needs a formal classification before offline work.
- There is no sufficient visible end-to-end browser test layer for critical hospital journeys.
- Accessibility needs a formal WCAG 2.2 AA audit and regression process.
- Documentation and actual implementation need a live module-completion matrix because some docs are stale relative to current code.

---

## 3. Definition of "Modern Completed UX"

A workflow is not complete simply because the page exists.

A hospital workflow is complete only when it satisfies all of the following:

1. A normal staff user can complete the task without knowing internal IDs.
2. The patient, facility, visit, admission, and clinician context are always clear.
3. Required clinical and financial validation happens before submission.
4. Errors are understandable, actionable, and consistent.
5. Loading, empty, offline, permission-denied, and retry states are designed.
6. Dangerous actions require confirmation and are audit-visible.
7. The workflow works on common laptop and tablet screen sizes.
8. The workflow is keyboard accessible and screen-reader friendly where applicable.
9. The workflow has automated end-to-end test coverage.
10. The workflow has clinical or operational sign-off from the intended user group.

---

## 4. Standards Baseline

The frontend/product completion effort should align with these 2026-ready baselines:

| Area | Target standard |
|---|---|
| Accessibility | WCAG 2.2 AA |
| Application security verification | OWASP ASVS 5.0.0 as security verification baseline |
| API contract discipline | OpenAPI Specification 3.2.0 or compatible current project standard |
| Browser testing | Playwright end-to-end and visual regression tests |
| Healthcare usability | Patient-safety-first task design, clear audit trails, role-aware workflows |
| Mobile/tablet usability | Responsive layouts for unstable networks and clinical workstations |

Reference links:

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OpenAPI Specification: https://spec.openapis.org/oas/latest

---

## 5. Target Frontend Architecture

The frontend should evolve toward a layered structure:

```text
Laravel + Inertia page response
        |
        v
Vue page shell
        |
        +-- Feature workbench layout
        |       +-- tabs / panels / drawers / modals
        |
        +-- Domain workflow components
        |       +-- PatientSearch
        |       +-- AdmissionContextPicker
        |       +-- ClinicianPicker
        |       +-- OrderComposer
        |       +-- PaymentCapture
        |
        +-- Composables / stores
        |       +-- usePatientWorkflow()
        |       +-- useBillingWorkflow()
        |       +-- useClinicalDraft()
        |       +-- useApiMutation()
        |
        +-- Shared infrastructure
                +-- apiClient
                +-- form validation
                +-- error mapping
                +-- notifications
                +-- audit-safe logging hooks
                +-- telemetry
```

### Recommended folder pattern

```text
resources/js/
  lib/
    apiClient.ts
    errors.ts
    validation.ts
    permissions.ts
  components/
    ui/
    domain/
      patients/
      clinical/
      billing/
      pharmacy/
      inventory/
  pages/
    patients/
      Index.vue
      components/
      composables/
      types.ts
    billing-invoices/
      Index.vue
      components/
      composables/
      types.ts
```

### Rule

Large pages should be split gradually. Do not rewrite the whole frontend. Extract stable pieces around real workflow boundaries.

---

## 6. Frontend Engineering Rules

### API access

All frontend HTTP calls should go through a single shared API client.

The shared client must handle:

- CSRF/session behavior.
- 401 and 403 responses.
- validation errors.
- facility/tenant context.
- request IDs.
- retry-safe GET behavior.
- consistent toast/dialog messages.
- audit-safe error reporting without leaking PHI.

Avoid this pattern in feature pages:

```ts
async function apiRequest() {
  return fetch(...)
}
```

Prefer this:

```ts
const response = await apiClient.post('/api/v1/patients', payload, {
  workflow: 'patient-registration',
  idempotencyKey,
})
```

### Forms

Every critical form should have:

- field-level validation.
- server validation mapping.
- dirty-state protection.
- draft policy.
- clear submit state.
- duplicate submission protection.
- idempotency key for critical writes.
- audit context.

### Human-readable selectors

Normal staff workflows should not require manual UUID entry.

Replace raw identifiers with:

- patient search by MRN, name, phone, national ID where allowed.
- clinician search by name, department, role, availability.
- admission search by patient, ward, bed, admission number.
- visit context picker.
- facility-aware service catalog picker.

Manual UUID entry may remain only for administrator fallback, support tools, or emergency debug screens.

---

## 7. Module Completion Matrix

| Module | Completion target | Priority | UX status target |
|---|---|---:|---|
| Patient registration | Fast, duplicate-safe registration with patient search and clear identifiers | P0 | Must be polished |
| Emergency triage | Rapid triage, acuity scoring, escalation, handoff to consultation/admission | P0 | Must be polished |
| Vitals | Quick capture, trend visibility, abnormal value warnings | P0 | Must be polished |
| Consultations / EMR | Structured notes, diagnoses, orders, prescriptions, follow-up | P0 | Must be polished |
| Prescriptions | Medication search, dosage safety, stock visibility, pharmacy handoff | P0 | Must be polished |
| Laboratory orders | Order creation, specimen workflow, results entry, result review | P0 | Must be polished |
| Radiology orders | Request, scheduling/status, result attachment/reporting | P1 | Standardize |
| Admissions | Admission, bed/ward assignment, transfers, discharge | P0 | Must be polished |
| Inpatient ward | Daily rounds, meds, nursing tasks, discharge readiness | P0 | Must be polished |
| Theatre | Procedure scheduling, team assignment, operative notes | P1 | Standardize |
| Billing invoices | Charge capture, invoice review, payments, adjustments | P0 | Must be polished |
| Claims / insurance | Eligibility, claim preparation, submission tracking | P1 | Standardize |
| Pharmacy | Dispensing, OTC, stock link, substitutions, returns | P0 | Must be polished |
| Inventory / procurement | Requisition, receive, transfer, adjustment, supplier workflows | P0 | Must be polished |
| POS | Register sessions, OTC, cafeteria/lab quick sale, refunds/voids | P1 | Standardize |
| Staff | Staff profiles, roles, credentialing, privileges | P1 | Standardize |
| Platform admin | Facilities, roles, configuration, subscription governance | P1 | Standardize |
| Reports / analytics | Reliable summaries with export controls and permission checks | P2 | Improve after core flows |

---

## 8. Critical End-to-End Journeys

These journeys must be tested and signed off before calling the frontend complete.

### Journey 1 - Outpatient visit

```text
Register/search patient
  -> create appointment or walk-in visit
  -> capture vitals
  -> consultation note
  -> diagnosis
  -> lab/radiology/prescription orders
  -> billing
  -> payment/claim
  -> patient summary/printout
```

### Journey 2 - Emergency triage to admission

```text
Patient arrival
  -> triage category
  -> immediate vitals
  -> clinician handoff
  -> treatment/orders
  -> admission decision
  -> bed allocation
  -> inpatient handoff
```

### Journey 3 - Pharmacy dispensing

```text
Prescription received
  -> verify medicine and stock
  -> substitution or partial dispense if allowed
  -> billing/payment or claim check
  -> dispense
  -> stock movement
  -> audit trail
```

### Journey 4 - Lab order to result review

```text
Clinician creates order
  -> specimen collection
  -> lab processing
  -> result entry
  -> result verification
  -> clinician review
  -> patient chart update
```

### Journey 5 - Admission to discharge

```text
Admission
  -> ward/bed assignment
  -> inpatient orders
  -> daily rounds/nursing notes
  -> pharmacy/lab/radiology activity
  -> discharge summary
  -> final bill
  -> discharge documents
```

### Journey 6 - Stock procurement to dispensing

```text
Supplier order
  -> goods received
  -> stock ledger update
  -> transfer to store/pharmacy
  -> dispense/sell/consume
  -> stock reconciliation
```

---

## 9. UX Quality Gates

Every P0 workflow must pass these gates.

| Gate | Requirement |
|---|---|
| Navigation | User can reach the workflow from expected menu/context |
| Context | Patient/facility/visit/admission context is visible |
| Search | Staff can find records without raw IDs |
| Validation | Errors appear at the right fields and preserve input |
| Safety | Risky actions have confirmation and audit trail |
| Permissions | Unauthorized actions are hidden or clearly denied |
| Loading | Slow requests show stable loading states |
| Empty states | No-data screens explain what can be done next |
| Failure states | Network/server errors are understandable and recoverable |
| Mobile/tablet | Layout works on tablet and small laptop widths |
| Accessibility | Keyboard and screen-reader behavior meet WCAG 2.2 AA target |
| Performance | Page does not feel blocked by unnecessary large renders |
| Testing | Playwright journey tests exist |
| UAT | Real clinical/operations user signs off |

---

## 10. Accessibility Plan

Target: WCAG 2.2 AA.

Actions:

1. Add automated accessibility checks to Playwright using axe.
2. Audit modals, drawers, tabs, comboboxes, dropdowns, tables, and notifications.
3. Ensure focus management works when opening and closing dialogs.
4. Ensure all icons with behavior have labels or tooltips.
5. Ensure error messages are associated with inputs.
6. Ensure color is not the only indicator for clinical status.
7. Ensure keyboard users can complete P0 workflows.
8. Test common clinical workstations and tablet viewports.

Do not claim accessibility completion until automated checks and manual keyboard testing both pass.

---

## 11. Performance Plan

Frontend performance risk is highest on very large workbench pages.

Actions:

- Split oversized pages by workflow area.
- Lazy-load heavy dialogs, charts, tables, and secondary panels.
- Use paginated or virtualized tables for large data sets.
- Avoid re-rendering full workbenches after small mutations.
- Centralize loading states and optimistic UI rules.
- Track bundle size and route-level performance.
- Add performance budgets for P0 pages.

Target:

| Metric | Target |
|---|---:|
| P0 page initial usable render on normal connection | under 3 seconds |
| Mutation feedback | under 500 ms visible response |
| Search interaction response | under 1 second where backend allows |
| Large table behavior | pagination or virtualization |

---

## 12. Design System Completion

The shared UI layer should become a governed product system, not just reusable components.

Required patterns:

- Standard page header.
- Standard patient context banner.
- Standard facility/tenant context indicator.
- Standard search and filter bar.
- Standard data table.
- Standard empty/loading/error states.
- Standard confirmation dialog.
- Standard destructive action pattern.
- Standard clinical warning pattern.
- Standard audit trail viewer.
- Standard print/export action pattern.
- Standard permission-denied state.

Component decisions should be documented with examples so every module behaves consistently.

---

## 13. Testing Strategy

### Unit/component tests

Use for:

- composables.
- validation helpers.
- API error mapping.
- permission helpers.
- small workflow components.

### End-to-end tests

Use Playwright for:

- patient registration.
- triage.
- vitals.
- consultation.
- prescriptions.
- lab orders/results.
- billing invoice/payment.
- admission/discharge.
- pharmacy dispensing.
- inventory receiving/transfer.
- POS sale/refund.

### Visual regression tests

Use for:

- dashboard.
- patient chart.
- critical forms.
- billing workbench.
- pharmacy workbench.
- inpatient ward view.

### UAT

Each P0 module needs sign-off from at least:

- one clinical user.
- one operations/admin user where applicable.
- one finance/stock user where applicable.
- one technical reviewer.

---

## 14. Security and Privacy UX

Healthcare UX must protect PHI by design.

Required frontend rules:

- Do not store PHI in plain `localStorage`.
- Do not put patient-sensitive data in URLs unless explicitly safe.
- Do not show PHI in error tracking payloads.
- Add session timeout warnings for active users.
- Add locked-screen or re-authentication pattern for sensitive workflows.
- Hide unauthorized actions, but also enforce permissions server-side.
- Ensure print/export actions are permission-gated and audit-visible.
- Treat browser caching and local drafts as security-sensitive.

Draft policy:

| Data type | Allowed storage |
|---|---|
| UI preferences | `localStorage` allowed |
| Non-sensitive temporary filters | `localStorage` allowed |
| Patient/clinical drafts | Plain `localStorage` not allowed |
| Offline clinical drafts | Encrypted IndexedDB only after offline architecture is approved |

---

## 15. Implementation Roadmap

### Phase 0 - Product truth and module inventory

**Duration:** 3-5 days  
**Priority:** P0

Actions:

- Create a live module completion matrix.
- Mark each workflow as complete, partial, missing, or needs validation.
- Compare docs against current code and update stale statements.
- Identify all manual UUID/user ID entry points.
- Identify all `localStorage` usage that may include PHI.
- Identify oversized frontend pages and rank by risk.

Deliverables:

- Updated module completion matrix.
- UX risk register.
- Prioritized workflow backlog.

### Phase 1 - Frontend foundation cleanup

**Duration:** 1-2 weeks  
**Priority:** P0

Actions:

- Standardize API client usage.
- Standardize error/loading/empty states.
- Add route-level page shells.
- Add shared patient/facility/context components.
- Add frontend telemetry and audit-safe error reporting.
- Remove or quarantine generated backup files from frontend source paths.

Progress as of 2026-05-14:

- Shared clinical context banner introduced at `resources/js/components/domain/clinical/ClinicalContextBanner.vue`.
- First rollout completed for appointment locked-patient scheduling, emergency triage intake, the medical records consultation composer, laboratory order creation, radiology order creation, pharmacy order creation, admission creation, theatre procedure scheduling, claims intake from billing handoff, inventory dispensing claim-link intake, billing invoice creation, billing cash account setup/workbench context, billing payment-plan setup, billing refund request/approval/payout dialogs, billing discount policy/apply dialogs, patient chart context, the inpatient ward documentation workspace, and walk-in direct service request creation.
- P0.8 now covers the core finance workflow set: billing discounts, billing payment plans, billing refunds, billing payer contracts, billing service catalog, and the critical billing invoice mutations now share API-client mutation plumbing and idempotency/request-key support, with leave/discard protection already in place on the invoice creation workspace and the smaller finance dialogs.

Deliverables:

- Shared frontend infrastructure contract.
- Consistent error and loading UX.
- Cleaner source tree.

### Phase 2 - P0 clinical workflow polish

**Duration:** 2-4 weeks  
**Priority:** P0

Actions:

- Polish patient registration/search.
- Polish emergency triage.
- Polish vitals.
- Polish consultation/EMR flow.
- Polish lab order/result workflow.
- Polish prescription/pharmacy handoff.
- Polish admission/inpatient/discharge workflow.

Deliverables:

- Signed-off P0 clinical journeys.
- Playwright tests for each P0 clinical journey.
- Clinical safety UX checklist passed.

### Phase 3 - P0 financial and stock workflow polish

**Duration:** 2-4 weeks  
**Priority:** P0

Actions:

- Polish billing invoice/payment flows.
- Polish pharmacy dispensing and stock deduction visibility.
- Polish inventory receiving, transfer, adjustment, and reconciliation.
- Validate POS sale/refund/void UX.
- Add concurrency and duplicate-submit UX patterns.

Deliverables:

- Signed-off billing and stock journeys.
- Playwright tests for financial and inventory flows.
- Clear audit and reconciliation screens.

### Phase 4 - Accessibility, performance, and responsive hardening

**Duration:** 2-3 weeks  
**Priority:** P0

Actions:

- Run WCAG 2.2 AA audit.
- Add automated accessibility checks.
- Improve keyboard flows.
- Split/lazy-load the largest pages by risk.
- Add responsive checks for tablet and small laptop widths.
- Add visual regression tests for critical screens.

Deliverables:

- Accessibility report.
- Performance report.
- Visual regression baseline.

### Phase 5 - Release gates and production sign-off

**Duration:** 1-2 weeks  
**Priority:** P0

Actions:

- Add CI gates for frontend lint/build/tests.
- Add E2E smoke tests for every release.
- Add UAT scripts for hospital pilot users.
- Create final acceptance checklist.
- Freeze UX changes before production pilot.

Deliverables:

- Release readiness checklist.
- Pilot-ready frontend sign-off.
- Production UX risk acceptance document.

---

## 16. Quick Wins

These should be done early because they reduce risk quickly:

1. Add the live module completion matrix.
2. Add Playwright with one smoke test per P0 workflow.
3. Replace manual user ID fields in clinical flows with clinician search.
4. Replace manual patient/admission UUID usage in normal workflows with search/select components.
5. Centralize frontend API calls.
6. Add standard loading, empty, validation, and permission-denied states.
7. Stop using plain `localStorage` for patient or clinical drafts.
8. Remove generated backup files from `resources/js/pages`.
9. Add patient context banner to clinical workbenches.
10. Add dirty-form protection to critical clinical and billing forms.

Execution note 2026-05-13: `resources/js/components/domain/clinical/ClinicianPicker.vue` now centralizes normal clinician directory selection for appointment routing/referrals, emergency transfer handoffs, and theatre clinician assignment. Patient, admission, and linked appointment/admission context lookup components also disable manual UUID fallback by default through `allowManualIdFallback: false`. The next selector work should focus on explicit support/admin opt-ins, facility and specialty UUID fallbacks, plus E2E evidence.

Execution note 2026-05-13: Playwright foundation is now present with login smoke coverage, unauthenticated P0 route protection checks, an authenticated selector-policy guard, a reusable axe helper, and a dedicated `e2e-smoke` CI job. `npm run test:e2e:list` verifies the suite registry; live local smoke execution requires a reachable app server because this sandbox cannot bind `php artisan serve` and blocks browser access to the configured tunnel URL.

---

## 17. What to Avoid

- Do not rebuild the entire frontend from scratch.
- Do not introduce a second frontend framework.
- Do not start broad offline-first work before online flows are stable.
- Do not allow each module to define its own API and error patterns.
- Do not rely on manual UUID entry for normal hospital staff.
- Do not store PHI in plain browser storage.
- Do not call a workflow complete without E2E tests and UAT sign-off.
- Do not optimize the visual style while leaving unsafe workflow behavior unchanged.

---

## 18. Completion Checklist

The frontend/product layer can be called modern and production-ready when:

- P0 workflows are signed off.
- Manual ID entry is removed from normal staff journeys.
- Shared API client is used consistently.
- Sensitive drafts no longer use plain `localStorage`.
- All P0 workflows have Playwright coverage.
- Accessibility audit passes target criteria.
- Critical pages are responsive and usable on tablets.
- Performance budgets are met.
- Design-system patterns are documented and followed.
- Documentation reflects the actual implemented system.

---

## 19. Estimated Timeline

| Target state | Estimated time |
|---|---:|
| Basic UX cleanup and module truth | 2-3 weeks |
| Pilot-ready modern workflow UX | 8-14 weeks |
| Enterprise-grade UX maturity | 3-5 months |
| Offline-ready product foundation | After P0 online flows are stable |

These estimates assume the existing module breadth remains in place and the team improves incrementally rather than rewriting.

---

## 20. Final Recommendation

The project should be treated as a broad, advanced hospital platform that still needs a dedicated frontend/product completion phase.

The best path is:

```text
1. Finish online production correctness.
2. Complete P0 frontend workflow polish.
3. Add automated UX, accessibility, and E2E release gates.
4. Run hospital UAT.
5. Only then expand offline support to selected stable workflows.
```

This gives the best balance of patient safety, development cost, maintainability, and long-term enterprise quality.
