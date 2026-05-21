# Afyanova AHS v2 - Online Production Completion Plan 2026

**Document status:** Draft execution plan  
**Last updated:** 2026-05-09  
**Prepared from perspective:** Principal healthcare software architect, distributed systems engineer, Laravel enterprise consultant  
**Scope:** Complete the strong online production hospital system before broad offline capability

---

## 1. Executive Decision

The project should be completed first as a strong, secure, online production hospital platform.

Offline work should not be built broadly yet. The correct path is:

```text
Complete online production baseline
Build offline-ready foundations during normal development
Pilot offline only after critical online workflows are stable
```

This plan focuses on what must be finished before the system can responsibly be called production-complete for a modern 2026 hospital environment.

---

## 2. Completion Definition

The system can be called a strong online production standard only when all P0 gates are complete and signed off:

- Production runtime is not using development server behavior.
- Critical workflows work end-to-end online.
- Tenant/facility isolation is verified across PHI endpoints.
- RBAC and entitlement behavior is tested for normal and denied access.
- Clinical safety controls exist for critical workflows.
- Billing, stock, pharmacy, and clinical order flows are consistent under concurrency.
- Audit logs are complete, searchable, exportable, and retention-aware.
- Backup and restore are tested with measured RPO/RTO.
- Observability is live for app errors, queues, database, scheduler, and uptime.
- Security headers, HTTPS, sessions, cookies, and secrets are production-hardened.
- CI/CD blocks unsafe releases.
- Documentation matches the real codebase and deployment architecture.

---

## 3. Guiding Principles

1. Patient safety is the first design constraint.
2. The Laravel backend remains the source of truth.
3. Clinical, financial, and inventory writes must be auditable.
4. Critical actions must be idempotent or safely rejected on retry.
5. Every production claim must have evidence: test, screenshot, runbook, metric, or audit record.
6. Finish online correctness before expanding offline behavior.
7. Avoid large rewrites; harden the current modular monolith.

---

## 4. Workstream Overview

| Workstream | Goal | Priority |
|---|---|---|
| A. Documentation truth | Align docs with actual Laravel 12 code and deployment | P0 |
| B. Production runtime | Replace demo runtime with production runtime | P0 |
| C. Security baseline | Harden headers, cookies, secrets, access, PHI handling | P0 |
| D. Clinical safety | Strengthen patient safety workflows and traceability | P0 |
| E. Data integrity | Fix concurrency, idempotency, and cross-module consistency | P0 |
| F. Observability | Add monitoring, error reporting, queue and DB visibility | P0 |
| G. Backup and DR | Prove restore capability and operational continuity | P0 |
| H. QA and CI/CD | Add release gates and end-to-end regression coverage | P0 |
| I. Interoperability | Prepare standards-based integration layer | P1 |
| J. Offline readiness | Add future-safe design hooks only, not broad offline | P1 |

---

## 5. Phase Plan

### Phase 0 - Project Truth and Scope Freeze

**Target duration:** 3-5 days  
**Goal:** Make documentation and project state reliable enough to manage execution.

Checklist:

- [ ] DOC-01: Update `CURRENT_STATUS_2026.md` to match the actual stack: Laravel 12, PHP 8.4-capable build, Vue/Inertia, current Docker behavior.
- [ ] DOC-02: Replace broad "ready for deployment" language with evidence-based readiness status.
- [ ] DOC-03: Create a module completion matrix with status: complete, pilot-ready, needs hardening, incomplete.
- [ ] DOC-04: Mark offline as future phase, not current release scope.
- [ ] DOC-05: Assign owners for clinical, billing, inventory, platform, DevOps, QA, and security workstreams.

Exit criteria:

- Documentation no longer contradicts code.
- Everyone agrees what "online production complete" means.
- P0 release blockers are visible and assigned.

---

### Phase 1 - Production Runtime and Deployment Hardening

**Target duration:** 1-2 weeks  
**Goal:** Stop running production like a development server.

Checklist:

- [ ] DEPLOY-01: Replace production `php artisan serve` runtime with PHP-FPM plus Nginx/Caddy or a managed Laravel runtime.
- [ ] DEPLOY-02: Split web, queue worker, scheduler, and migration jobs into separate processes.
- [ ] DEPLOY-03: Add zero-downtime or low-downtime deployment process.
- [ ] DEPLOY-04: Add rollback procedure.
- [ ] DEPLOY-05: Add production health checks for app, database, cache, queue, storage, and scheduler.
- [ ] DEPLOY-06: Configure production environment variables: `APP_ENV=production`, `APP_DEBUG=false`, secure cookies, encrypted sessions, HTTPS URL.
- [ ] DEPLOY-07: Use Redis or managed queue for production if workload exceeds database queue safety.
- [ ] DEPLOY-08: Ensure scheduler runs exactly once per environment.

Exit criteria:

- Production process model is documented and tested.
- A failed deployment can be rolled back.
- Queue and scheduler are supervised and observable.

---

### Phase 2 - Security and Compliance Baseline

**Target duration:** 1-2 weeks  
**Goal:** Bring the online system to healthcare-grade security posture.

Checklist:

- [ ] SEC-01: Add security headers: Content-Security-Policy, HSTS, X-Frame-Options or frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- [ ] SEC-02: Verify session cookie flags: secure, httpOnly, sameSite, encrypted session.
- [ ] SEC-03: Add production secret management policy; no secrets in committed docs.
- [ ] SEC-04: Add access logging for PHI reads where clinically and legally appropriate.
- [ ] SEC-05: Verify every API route has correct auth, permission, tenant/facility, and entitlement behavior.
- [ ] SEC-06: Add dependency scanning for Composer and NPM.
- [ ] SEC-07: Add secret scanning in CI.
- [ ] SEC-08: Add security test cases for object-level authorization.
- [ ] SEC-09: Add file upload validation and malware scanning strategy for staff/patient documents.
- [ ] SEC-10: Produce a security evidence pack for go-live.

Exit criteria:

- OWASP API security risks are explicitly reviewed.
- Tenant/facility isolation test coverage exists for critical PHI endpoints.
- Security headers are verified in staging.

---

### Phase 3 - Clinical Safety Hardening

**Target duration:** 2-4 weeks  
**Goal:** Make clinical workflows safe, traceable, and production-ready.

Checklist:

- [ ] CLIN-01: Harden patient registration duplicate detection, merge workflow, and duplicate review queue.
- [ ] CLIN-02: Add patient identity policy: MRN rules, national ID handling, newborn/unknown patient handling.
- [ ] CLIN-03: Add audit and tenant/facility scope to patient vitals.
- [ ] CLIN-04: Add vitals history, abnormal flags, and escalation logic for critical values.
- [ ] CLIN-05: Add clinical handoff acknowledgement for critical lab/radiology results.
- [ ] CLIN-06: Add medication allergy checks before prescribing/dispensing.
- [ ] CLIN-07: Add medication reconciliation workflow for active medication profile.
- [ ] CLIN-08: Add controlled-drug audit policy if pharmacy will dispense controlled medicines.
- [ ] CLIN-09: Verify triage priority transitions and emergency transfer workflows.
- [ ] CLIN-10: Verify admission, ward task, discharge checklist, and transfer traceability.

Exit criteria:

- Critical clinical events cannot disappear silently.
- Every critical clinical transition has actor, timestamp, reason where needed, and audit trail.
- Clinicians can identify whether an item is draft, active, completed, cancelled, or requires acknowledgement.

---

### Phase 4 - Financial, Stock, and Order Integrity

**Target duration:** 2-4 weeks  
**Goal:** Prevent duplicate billing, wrong stock deduction, and inconsistent financial state.

Checklist:

- [ ] DATA-01: Add idempotency keys to critical create/payment/dispense/order actions.
- [ ] DATA-02: Add optimistic concurrency checks to status transitions where stale updates are dangerous.
- [ ] DATA-03: Load test billing invoice creation, payment posting, reversal, and receipt generation.
- [ ] DATA-04: Verify inventory stock movement ledger under concurrent issue/receive/reconcile scenarios.
- [ ] DATA-05: Verify pharmacy dispense stock deduction and backfill logic.
- [ ] DATA-06: Verify POS register session open/close, sale posting, receipt generation, and cashier reconciliation.
- [ ] DATA-07: Replace placeholder NHIF/MSD/tariff codes before real claims or procurement use.
- [ ] DATA-08: Create cross-module tests: lab -> billing, pharmacy -> stock -> billing, radiology -> billing, theatre -> billing.
- [ ] DATA-09: Add database constraints/indexes where application logic currently carries too much responsibility.
- [ ] DATA-10: Add data correction policy for financial and clinical mistakes.

Exit criteria:

- Duplicate browser submits do not duplicate critical records.
- Stock and billing remain consistent under concurrent use.
- Reversals and corrections are audited instead of destructive edits.

---

### Phase 5 - Observability and Operations

**Target duration:** 1-2 weeks  
**Goal:** Make production behavior visible before go-live.

Checklist:

- [ ] OBS-01: Add error tracking such as Sentry, Bugsnag, or equivalent.
- [ ] OBS-02: Add structured logs with request ID, user ID, tenant ID, facility ID, and module.
- [ ] OBS-03: Add queue monitoring and failed job alerts.
- [ ] OBS-04: Add scheduler monitoring.
- [ ] OBS-05: Add database slow-query monitoring.
- [ ] OBS-06: Add uptime checks for public app and authenticated health endpoint.
- [ ] OBS-07: Add dashboards for clinical safety signals, failed payments, failed stock operations, and audit export failures.
- [ ] OBS-08: Define alert severity: P1 patient safety, P2 revenue/stock, P3 degraded feature, P4 cosmetic.
- [ ] OBS-09: Create incident response runbook.
- [ ] OBS-10: Run a simulated incident before go-live.

Exit criteria:

- The team can detect and triage production failures quickly.
- Alerts have owners and escalation paths.
- Failed jobs and scheduler failures are visible without manual log inspection.

---

### Phase 6 - Backup, Disaster Recovery, and Data Governance

**Target duration:** 1-2 weeks  
**Goal:** Prove the system can recover from failure without losing hospital data.

Checklist:

- [ ] DR-01: Define RPO and RTO targets.
- [ ] DR-02: Configure encrypted database backups.
- [ ] DR-03: Configure file/storage backups for generated PDFs, staff documents, branding assets, and audit exports.
- [ ] DR-04: Test restore into a clean environment.
- [ ] DR-05: Document restore steps with screenshots/log output.
- [ ] DR-06: Verify audit log retention and legal hold behavior.
- [ ] DR-07: Verify backup access controls and key management.
- [ ] DR-08: Create disaster recovery sign-off artifact.

Exit criteria:

- Restore has been tested, not only documented.
- RPO/RTO are known.
- Backup and restore procedures are owned by named people.

---

### Phase 7 - QA, CI/CD, and Release Gates

**Target duration:** 2-3 weeks, parallel with phases 3-6  
**Goal:** Make releases boring and controlled.

Checklist:

- [ ] QA-01: Add frontend type-check gate with `vue-tsc`.
- [ ] QA-02: Add check-only frontend formatting/linting in CI.
- [ ] QA-03: Add Composer and NPM audit gates.
- [ ] QA-04: Add Postgres integration test job, not only SQLite in-memory tests.
- [ ] QA-05: Add Playwright or equivalent E2E tests for critical workflows.
- [ ] QA-06: Add migration smoke test against a production-like database.
- [ ] QA-07: Add seed-data smoke test for staging.
- [ ] QA-08: Add release checklist and approval gate.
- [ ] QA-09: Add test coverage report for critical modules.
- [ ] QA-10: Create manual UAT scripts for hospital staff.

Critical E2E scenarios:

- Patient registration and duplicate warning.
- Appointment check-in and triage handoff.
- Consultation start and completion.
- Lab order, result, verification, and critical result acknowledgement.
- Pharmacy order, allergy check, dispense, and stock movement.
- Billing invoice, payment, reversal, receipt/PDF.
- Inventory receive, issue, stock count, and reconciliation.
- Admission, ward task, vitals, discharge checklist.
- RBAC denied access and cross-facility denied access.

Exit criteria:

- CI blocks unsafe changes.
- Critical paths have automated regression coverage.
- UAT can be repeated by non-developers.

---

### Phase 8 - Interoperability Readiness

**Target duration:** 3-6 weeks, can start after production baseline stabilizes  
**Goal:** Prepare controlled integration without destabilizing core workflows.

Checklist:

- [ ] INT-01: Define external integration priorities: MOH, NHIF, MSD, lab systems, radiology/PACS, SMS, payment gateways.
- [ ] INT-02: Create OpenAPI documentation for current `/api/v1`.
- [ ] INT-03: Define FHIR mapping for Patient, Encounter, Observation, DiagnosticReport, MedicationRequest, MedicationDispense, Invoice/Claim where appropriate.
- [ ] INT-04: Add inbound message idempotency and dead-letter handling.
- [ ] INT-05: Add partner credential/key rotation policy.
- [ ] INT-06: Add integration audit log and replay policy.
- [ ] INT-07: Add sandbox partner environment.

Exit criteria:

- Integrations have contracts, versioning, and failure handling.
- No external partner can bypass tenant/facility/RBAC controls.

---

### Phase 9 - Offline Readiness Only

**Target duration:** 1-2 weeks for foundations, after online P0 is stable  
**Goal:** Prepare the codebase for future offline without building full offline now.

Checklist:

- [ ] OFF-01: Standardize frontend API calls through one central client.
- [ ] OFF-02: Add idempotency support to syncable create actions.
- [ ] OFF-03: Add row version or optimistic concurrency support to syncable records.
- [ ] OFF-04: Stop storing sensitive clinical data in `localStorage`.
- [ ] OFF-05: Create an offline policy document that classifies modules as allowed, partial, or online-only.
- [ ] OFF-06: Add feature flags for future offline pilot modules.

Exit criteria:

- Future offline MVP can be added without rewriting stable online workflows.
- No broad offline PHI storage exists yet.

---

## 6. Module Completion Matrix

| Module | Current posture | Before production-complete |
|---|---|---|
| Patient | Strong foundation | Duplicate review, merge policy, identity governance, PHI access audit |
| Appointments | Strong foundation | Concurrency/idempotency for transitions, E2E queue tests |
| Emergency triage | Functional | Escalation, transfer traceability, critical handoff tests |
| Patient vitals | Early/functional | Tenant/facility scope, audit, history UI, abnormal flags, tests |
| Medical records | Functional | Versioning policy, access audit, document safety, E2E tests |
| Laboratory | Functional | Critical result acknowledgement, LOINC mapping, result audit sign-off |
| Radiology | Functional | Report verification, critical report handoff, PACS/DICOM strategy |
| Pharmacy | Functional | Allergy checks, med reconciliation, stock/dispense concurrency, controlled-drug policy |
| Admissions/Inpatient | Functional | Transfer/discharge traceability, ward safety dashboards |
| Billing | Advanced | Idempotency, payment/reversal audit, tariff cleanup, load tests |
| Claims/Insurance | Functional | NHIF/partner mapping, claim lifecycle evidence, reconciliation tests |
| Inventory/Procurement | Advanced | Concurrent stock tests, MSD mapping cleanup, stock adjustment governance |
| POS | Functional/newer | Register reconciliation, receipt controls, cashier closeout tests |
| Staff/Credentialing | Strong foundation | Document scanning policy, privilege expiry alerts, onboarding/offboarding runbooks |
| Platform/RBAC | Strong foundation | Cross-tenant access evidence, security review, API inventory |
| Reporting/Analytics | Basic/operational | Production dashboards, audit/export governance, performance review |

---

## 7. Release Gates

### Gate A - Internal Technical Readiness

- [ ] Build passes.
- [ ] Backend tests pass.
- [ ] Frontend type-check passes.
- [ ] CI uses production-like database job.
- [ ] Security headers verified.
- [ ] Queue and scheduler verified.

### Gate B - Clinical Safety Readiness

- [ ] Patient identity workflows tested.
- [ ] Critical lab/radiology result handling tested.
- [ ] Allergy/medication safety path tested.
- [ ] Triage and emergency transfer path tested.
- [ ] Vitals audit and abnormal flag path tested.

### Gate C - Financial and Stock Readiness

- [ ] Invoice, payment, reversal tested.
- [ ] Pharmacy dispense to stock movement tested.
- [ ] Inventory receive/issue/reconcile tested under concurrency.
- [ ] POS register/session closeout tested.
- [ ] Tariff/NHIF/MSD placeholder codes resolved or blocked from production use.

### Gate D - Operations Readiness

- [ ] Backup restore test completed.
- [ ] Incident runbook completed.
- [ ] Monitoring alerts tested.
- [ ] Go-live support rota assigned.
- [ ] Rollback plan tested.

### Gate E - Hospital UAT Sign-Off

- [ ] Front desk UAT passed.
- [ ] Nurse/triage UAT passed.
- [ ] Clinician UAT passed.
- [ ] Lab UAT passed.
- [ ] Pharmacy UAT passed.
- [ ] Billing/cashier UAT passed.
- [ ] Inventory/procurement UAT passed.
- [ ] Admin/RBAC UAT passed.

---

## 8. Suggested Timeline

| Phase | Duration | Can run in parallel |
|---|---:|---|
| Phase 0: Documentation truth | 3-5 days | No |
| Phase 1: Production runtime | 1-2 weeks | Partly |
| Phase 2: Security baseline | 1-2 weeks | Yes |
| Phase 3: Clinical safety | 2-4 weeks | Yes |
| Phase 4: Financial/stock integrity | 2-4 weeks | Yes |
| Phase 5: Observability | 1-2 weeks | Yes |
| Phase 6: Backup/DR | 1-2 weeks | Yes |
| Phase 7: QA/CI/CD | 2-3 weeks | Yes |
| Phase 8: Interoperability | 3-6 weeks | After P0 stabilizes |
| Phase 9: Offline readiness | 1-2 weeks | After P0 stabilizes |

Expected timeline:

- Serious pilot-ready online release: 8-14 weeks.
- Enterprise production maturity: 3-5 months.
- Broad offline capability: later phase after online workflows stabilize.

---

## 9. Weekly Execution Rhythm

Every week:

- Review P0 blockers.
- Review failed tests and failed jobs.
- Review security and tenant isolation risks.
- Review clinical safety risks.
- Review unresolved billing/stock inconsistencies.
- Update this document's checkboxes.
- Capture evidence links for completed gates.

Recommended weekly status format:

```text
Week:
Completed:
Blocked:
New risks:
Clinical safety concerns:
Security concerns:
Next 5 priorities:
Go-live confidence: Red / Amber / Green
```

---

## 10. What To Avoid

- Do not build broad offline support before online workflows are stable.
- Do not run production with `php artisan serve`.
- Do not claim compliance without tested evidence.
- Do not rely on `localStorage` for PHI.
- Do not allow placeholder tariff/NHIF/MSD codes in real billing or claims.
- Do not make destructive edits to clinical/financial records; use reversal/correction workflows.
- Do not let integrations bypass RBAC, tenant isolation, or audit logging.

---

## 11. Final Recommendation

The fastest safe path is not to add more features immediately.

The fastest safe path is to harden the current system into a trustworthy online production platform:

```text
Runtime + security + clinical safety + data integrity + observability + DR + QA
```

After these gates are green, offline support can be introduced as a small, controlled pilot for triage, registration drafts, vitals, and clinical drafts.

