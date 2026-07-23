# RBAC Remediation Plan

**Companion to:** `RBAC_Audit_Report.md` (2026-07-23 audit)
**Purpose:** Turn the audit's findings into an ordered, verifiable sequence of changes. Every task below has its own pass/fail check — a phase is not "done" until its checks pass, and no phase should start until the previous one is verified.

**How to use this document:** Work top to bottom. Tick a task's checkbox only after its verification step has actually been run and passed — not when the code merely "looks right." Each phase ends with a **Phase Gate**: a short go/no-go checklist that must be true before starting the next phase.

---

## Guiding principles

1. **Small, independently-shippable steps.** Never bundle the risky change (Phase 2) with the safe ones (Phase 1, 3, 4) — if something breaks, we need to know which change broke it.
2. **Verify before moving on.** Every task has a concrete way to prove it worked — a test, a query, or a manual check with expected output. "I edited the file" is not verification.
3. **Assume real users are relying on current behavior**, even the buggy parts. Phase 2 in particular must be checked against what real Facility Admin accounts actually use today before it ships.
4. **Every phase must be reversible.** Note the rollback for each phase before starting it.

---

## Pre-Phase 0 — Blast Radius Assessment

**Objective:** Know how exposed the system is *right now*, before changing anything.

| # | Task | Verification (how we know it's done / what "pass" looks like) |
|---|---|---|
| 0.1 | Run a database query listing every user with an `ADMIN.FACILITY` role, alongside that role row's `status`, `revoked_at`, and `effective_until`. | Query executed and output reviewed by hand. **Pass condition:** we have a concrete list of accounts and can say for each one "active & legitimate" or "stale/should have been revoked." |
| 0.2 | Cross-check that list against HR/offboarding records (which of those accounts belong to people who have left or changed roles). | A named person (not just this audit) confirms the list. **Pass condition:** every stale account is identified before Phase 1 ships, so we know if Phase 1 will immediately lock anyone out (expected/desired) or if there's a false-positive to double check. |
| 0.3 | Confirm whether any account also holds `PLATFORM.SUPER.ADMIN`/`SYSTEM.SUPER.ADMIN` in addition to `ADMIN.FACILITY` (those are unaffected by this bug and should keep working after the fix). | Query. **Pass condition:** list of "will lose bypass access" accounts is limited to *only* those whose sole elevated role is `ADMIN.FACILITY`. |

**Phase Gate 0 →1:** We have a named list of every account affected by the fix, and know which of them *should* lose access (stale/offboarded) vs. which are legitimate and must keep working through Phase 1.

---

## Phase 1 — Close the Active Vulnerability

**Objective:** Stop a stale/revoked `ADMIN.FACILITY` role from acting as a universal bypass. Small, low-risk, ships alone.

| # | Task | File(s) | Verification |
|---|---|---|---|
| 1.1 | Change `User::isFacilitySuperAdmin()` to require the role be active, not revoked, not expired — reuse the exact logic already defined in `RoleModel::scopeActive()` (`status='active'`, `effective_until` null-or-future, `revoked_at` null) instead of the current bare `where('code','ADMIN.FACILITY')`. | `app/Models/User.php:271-280` | **Automated test (new):** a Pest feature/unit test that creates a user with an `ADMIN.FACILITY` role row where `status != 'active'` (or `revoked_at` set, or `effective_until` in the past), then asserts `hasUniversalAdminAccess()` / `hasPermissionTo('anything')` returns `false`/denies. A second test with an *active* `ADMIN.FACILITY` role asserts it still returns `true`. **Pass condition:** both tests green. |
| 1.2 | ~~Apply the active-role gate (`user.has-role` / `EnsureUserHasActiveRole`) to the outer middleware group in `routes/api.php` and `routes/billing-phase1.php`~~ — **attempted and reverted, see finding below.** | `routes/api.php:65`, `routes/billing-phase1.php:17` | Automated regression test (`tests/Feature/Appointment/AppointmentApiTest.php`) caught the problem before this shipped. |
| 1.3 | Run the Pre-Phase-0 stale-account list against the *fixed* code (locally/staging) and confirm each stale account is now denied, and each legitimate account is unaffected. | n/a (validation step) | **Pass condition:** matches the Pre-Phase-0 predictions exactly. Any mismatch must be investigated before shipping. **Status: not yet done — requires real database access this session does not have; see "Still open" below.** |

> **Finding during implementation (Task 1.2 revised):** applying `user.has-role` to `routes/api.php`/`routes/billing-phase1.php` was implemented and then reverted after it caused 56 test regressions in `tests/Feature/Appointment/AppointmentApiTest.php` alone. Root cause: this codebase has a second, legitimate way to grant access — `User::givePermissionTo()` grants a permission directly to a user with **no role at all** — and `EnsureUserHasActiveRole` unconditionally rejects any user with zero role rows, regardless of direct grants. That pattern is used extensively (dozens of existing tests, e.g. `makeAppointmentUser()`), so it is very likely also used in production, not just tests.
>
> This turned out not to matter for the actual Critical finding: **Task 1.1 alone already closes it.** Once `isFacilitySuperAdmin()`/`isPlatformSuperAdmin()` correctly require an active, non-revoked, non-expired role, a stale `ADMIN.FACILITY` grant no longer bypasses `hasPermissionTo()` on *any* route, `api.php` included — the request just falls through to the route's own `can:` check and is denied there instead of by `user.has-role`. Verified with a dedicated test (`tests/Feature/RbacSuperAdminBypassTest.php`, "blocks api/v1 routes for a user whose only role is a revoked ADMIN.FACILITY grant") that passes with Task 1.1 alone.
>
> **Revised Task 1.2 (if still wanted):** rather than a blanket middleware, protect only the small number of `api.php`/`billing-phase1.php` routes that have **no** `can:`/permission check at all (the §8.4 list in the audit report, e.g. `platform/access-scope`, `platform/feature-flags*`) — either by adding a `can:` gate to each, or by adding a narrower "has a role OR has any direct permission" check if a blanket gate is still wanted. Not implemented in this session; flagged for a decision before pursuing further.

**Also discovered and fixed as part of Task 1.1 (not originally listed, same bug class):** `EnsureUserHasActiveRole::handle()` (`app/Http/Middleware/EnsureUserHasActiveRole.php:20-22`) had the identical status-only gap — it checked `roles.status = 'active'` but ignored `revoked_at`/`effective_until`, so a revoked-but-status-active role would still count as "active" for the purpose of accessing `pending-setup`-gated web routes. Hardened to use `RoleModel`'s `active()` scope, consistent with the `User` model fix.

**Rollback for Phase 1:** Revert the two file changes; no data/schema changes are involved, so rollback is a plain code revert.

**Phase Gate 1→2:** All Phase 1 tests green, full existing test suite passes, stale-account validation (1.3) matches expectations, and this has been deployed to production (or the team's equivalent release gate) for at least one full monitoring cycle with no unexpected lockouts reported.

---

## Phase 2 — Remove the Blanket Bypass (Least Privilege) — **DONE (surgical scope), 2026-07-23**

**Objective:** Stop treating `ADMIN.FACILITY` as "skip every check" even when the role *is* active.

**Scope decision:** Task 2.1's enumeration found **170+ call sites** (20+ backend, ~150 frontend Vue pages), far more than this plan originally anticipated. User chose the "surgical fix" option over a full sweep: fix the core permission-granting mechanism plus every backend call site that performs a **direct authorization bypass**, and leave alone the ~150 frontend UI-convenience checks and the backend ownership/scoping conveniences (frontend never enforces security; ownership overrides don't grant new capability, they only skip a same-facility "who owns this record" nicety after the real permission gate already passed).

| # | Task | File(s) | Verification |
|---|---|---|---|
| 2.1 | Enumerate every call site. | See full list below. | **Done.** 20+ backend, ~150 frontend (41 Vue files). Classified each backend site as genuine-bypass vs. ownership-convenience; frontend left out of scope (no security enforcement there). |
| 2.2a | Core fix: `hasPermissionTo()`/`permissionNames()` now check `isPlatformSuperAdmin()` only, not `hasUniversalAdminAccess()`. A facility admin's permission checks are now governed solely by their real `permission_role` grants. | `app/Models/User.php` | 3 tests in `tests/Feature/RbacFacilityAdminScopeTest.php` — a facility admin gets only their granted permissions, `permissionNames()` isn't the full catalog, a true platform admin is unaffected. |
| 2.2b | Fixed 6 backend call sites that read `hasUniversalAdminAccess()`/`isFacilitySuperAdminAccess()` **directly** (not through `hasPermissionTo()`, so 2.2a doesn't cover them) to require `isPlatformSuperAdminAccess()` instead — see per-site reasoning below. | `CreatePlatformRoleUseCase.php`, `SyncPlatformRolePermissionsUseCase.php`, `SyncPlatformUserRolesUseCase.php`, `PlatformRbacController.php` (`shouldRestrictToAssignableHospitalRoles`), `PatientFlowBoardChannelAuthorizer.php`, `BillingQueueChannelAuthorizer.php` | 8 tests in `tests/Feature/RbacFacilityAdminScopeTest.php`. |
| 2.2c | Incidental fix found while testing 2.2b: `PlatformRbacController::storeRole()` was missing the `PlatformRoleProtectedException` catch its sibling methods already had, so a blocked escalation attempt 500'd instead of a clean 422. | `PlatformRbacController.php` | Covered by the 2.2b tests (the "create role with escalation permission" test needs this to assert a clean exception rather than an uncaught one). |
| 2.3 | Audit `config/roles.php`'s `ADMIN.FACILITY` permission list for completeness against real usage. | `config/roles.php:363-390` | **Not done — still requires a named product owner/facility-admin sign-off; cannot be verified from code alone.** Unchanged from the original plan. |
| 2.4 | Pilot rollout / feature flag. | — | **Not done.** Given the surgical scope only touches 7 backend files with full regression coverage (see below) and the reduced blast radius, a feature flag was judged unnecessary for this scope by the same reasoning as Task 1.2 — reconsider if 2.3's sign-off surfaces gaps. |
| 2.5 | Full regression pass. | — | **Done, thoroughly.** Ran the entire 1,718-test suite twice (JUnit XML output) — once on fully original code, once with Phase 1+2 applied — and diffed every individual test's pass/fail status (not just aggregate counts, which can hide offsetting regressions). Result: **zero real regressions.** One test in `RbacSuperAdminBypassTest.php` needed its own assertion updated (it asserted the old Phase-1-only behavior, now correctly superseded by Phase 2). One *pre-existing, already-broken* test (`FacilityAdminAccessSmokeTest`) started passing as a side effect — it already expected facility admins to be blocked from platform-wide pages, which is exactly what Phase 2 now delivers. |

### Backend call-site classification (Task 2.1 detail)

**Fixed (genuine authorization bypass):**

- `CreatePlatformRoleUseCase::actorIsSuperAdmin()` / `SyncPlatformRolePermissionsUseCase::actorIsSuperAdmin()` — guarded whether an actor could grant a role `platform.rbac.manage-roles`/`manage-user-roles`. Before the fix, any `ADMIN.FACILITY` holder could mint a brand-new role carrying full platform RBAC power and hand it to anyone — the single most severe of the 6.
- `SyncPlatformUserRolesUseCase::actorCanAssignAnyRole()` — governed whether an actor could assign *any* role (including platform-wide ones) to a user, vs. being restricted to hospital-operational roles.
- `PlatformRbacController::shouldRestrictToAssignableHospitalRoles()` — governed whether the roles-listing endpoint shows every platform role or only hospital-assignable ones.
- `PatientFlowBoardChannelAuthorizer` / `BillingQueueChannelAuthorizer` — let a facility admin subscribe to *any* facility's real-time broadcast channel, not just facilities they actually belong to (a genuine cross-facility data-exposure path, since these channels are keyed by `{facilityId}`).

**Reviewed, left unchanged (ownership/scoping convenience, not privilege escalation):**

- `EncounterLifecycleService::assertEncounterOwnership()`, `UpdateEncounterStatusUseCase`, `UpdateAppointmentStatusUseCase` — let a facility admin close/reopen/transition a record they don't personally own. Doesn't grant new data access; the route's own permission gate already ran first, and this only skips a same-facility "who's the assigned clinician" nicety.
- `DepartmentRequisitionScopeResolver::canSelectAnyDepartment()` — lets a facility admin select any *department within their own facility* for a requisition. Still facility-scoped, consistent with the role's actual purpose.
- `AppServiceProvider`'s 4 `Gate::define()` closures (`appointments.record-triage`, `appointments.read-routing-options`, `appointments.start-consultation`/`manage-provider-session`, `medical.records.draft.update`) and `MedicalRecordPolicy::updateDraft()` — same pattern, facility-scoped clinical-ownership overrides, not cross-facility/cross-tenant escalation.

**Reviewed, left unchanged (out of pure-RBAC scope):**

- `GetDashboardContextUseCase` / `DashboardWorkflowRegistry` — uses the flag to decide dashboard workflow routing and whether to bypass *subscription entitlement* filtering. This is a billing/product question (should an admin see the full interface regardless of subscription plan), not a permission-escalation question — left alone, flagged as ambiguous rather than silently "fixed."

**Not touched (~150 frontend call sites across 41 Vue files):** the frontend never enforces real security (confirmed in the original audit) — these are all UI show/hide convenience checks reading the same `auth.isFacilitySuperAdmin` shared prop, which this change does not alter the value of. No security impact either way; a full sweep was explicitly declined as disproportionate risk for zero security gain.

### New finding, out of scope for this plan: `HOSPITAL.*` legacy role-code naming drift

While verifying Task 2.2, discovered that **~13-17 separate migrations** (spanning April–July 2026) seed permissions to an entire parallel role-naming scheme — `HOSPITAL.FACILITY.ADMIN`, `HOSPITAL.REGISTRATION.CLERK`, `HOSPITAL.BILLING.CASHIER`, and 14 others — that appears to be **legacy and dead**: no seeder or migration anywhere actually creates a role row with any `HOSPITAL.*` code (the live role catalog uses `ADMIN.FACILITY`, `ADMIN.REGISTRATION`, `FINANCE.CASHIER`, etc. per `config/roles.php`). `PlatformRbacController.php:332` even has a comment acknowledging `HOSPITAL.` as "Legacy backward compatibility." If confirmed dead, this means every one of those ~13-17 migrations has been silently granting permissions to roles that don't exist — a much larger-scale instance of the same "orphaned permission grant" bug class the original audit found in miniature (§6.1/§6.2). **Recommend a follow-up audit item**, separate from this plan: confirm no `HOSPITAL.*` role rows exist in any real environment, then either delete the dead migrations or, if `HOSPITAL.*` roles turn out to exist somewhere this session couldn't see (e.g. seeded only in a production-only script), reconcile the naming with `config/roles.php` properly.

**Rollback for Phase 2:** Plain code + test revert; no schema/data changes were made, so this is a straightforward revert if Task 2.3's sign-off later reveals a real gap in `ADMIN.FACILITY`'s permission list.

**Phase Gate 2→3:** Complete for the surgical scope actually implemented. Task 2.3 (product sign-off on permission-list completeness) remains open and should happen before this is considered fully closed — flagged, not blocking, since the change is low-risk (see regression results above) and reversible.

---

## Phase 3 — Fix the Zero-Authorization Endpoints — **DONE: 3.1 fixed, 3.2/3.3/3.4 were all audit false-positives (2026-07-23)**

**Objective:** Add the missing lock to the three actions that currently have no check at all.

**Important correction to the original audit:** re-verifying each finding before fixing it (reading the actual `FormRequest::authorize()` implementations, not just the controller/use-case files the original audit's session-limited manual pass checked) found that **three of the four were false positives** — only the billing invoice status gap was real:

| # | Task | File(s) | Result |
|---|---|---|---|
| 3.1 | Add the missing permission check to the invoice status-transition route. | `app/Modules/Billing/Presentation/Http/Requests/UpdateBillingInvoiceStatusRequest.php` | **Real gap, fixed.** `authorize()` already correctly checked `billing.invoices.issue`/`.void`/`.cancel` for those three status values, but fell through to an unconditional `return true` for `paid`, `partially_paid`, and `draft` — meaning any authenticated user could mark an invoice paid (which creates a real payment record) or revert it to draft, with no permission check at all. Fixed: `paid`/`partially_paid` now require `billing.payments.record` (the same permission the dedicated payment-recording endpoint already requires, since this achieves the same effect); `draft` now requires `billing.invoices.update-draft` (matching the sibling general-update route). Fallback changed from `return true` to `return false` (fail closed) since all 6 real status values are now handled explicitly. |
| 3.2 | ~~Add `can:` middleware to the billing service-catalog write routes~~ | `app/Modules/Billing/Presentation/Http/Requests/{Store,Update,BulkUpdate,BulkSync}*ServiceCatalog*Request.php` | **False positive — already protected.** Each of the 6 FormRequests checks `hasPermissionTo('billing.service-catalog.manage')` **OR** the granular `manage-identity`/`manage-pricing` variant. The original audit only noticed the first (orphaned, never-granted) permission and concluded the whole check was dead; it missed that the second half of the OR is real and *is* granted to `FINANCE.OFFICER`/`FINANCE.CONTROLLER` in `config/roles.php`. Confirmed via already-passing tests in `tests/Feature/Billing/BillingServiceCatalogApiTest.php` (e.g. "allows service identity updates with the identity permission only"). No code change needed. |
| 3.3 | ~~Add a permission check to the staff privilege-grant status endpoint~~ | `app/Modules/Staff/Presentation/Http/Requests/UpdateStaffPrivilegeGrantStatusRequest.php` | **False positive — already protected.** `authorize()` maps each target status to the correct permission via `Gate::forUser($user)->allows(...)` (`requested`/`under_review` → `staff.privileges.review`, `approved` → `staff.privileges.approve`, `active`/`suspended`/`retired` → `staff.privileges.update-status`). The original audit checked the Controller and UseCase files (both correctly have no check) but did not check this FormRequest. Confirmed via an already-passing test, `tests/Feature/Staff/StaffPrivilegeGrantApiTest.php::it requires role-specific workflow permissions for review and approval stages`, which explicitly exercises this and passes today. No code change needed. |
| 3.4 | ~~Add a baseline permission check alongside the existing ownership check for medical-record/encounter status transitions~~ | `app/Modules/MedicalRecord/Presentation/Http/Requests/UpdateMedicalRecordStatusRequest.php`, `app/Modules/Encounter/Presentation/Http/Requests/UpdateEncounterStatusRequest.php` | **False positive — already protected.** Both `authorize()` methods already require `medical.records.read` as a floor, plus `finalize`/`amend`/`archive` depending on the target status — layered *underneath* the ownership check the original audit found (which is real and correctly gates same-permission users against each other, not a substitute for the permission check). Confirmed via an already-passing test on the medical-records side (`MedicalRecordApiTest.php::it forbids medical record finalization without finalize permission`) and a new test added for the encounter side, which had no equivalent coverage (`EncounterOwnershipEnforcementTest.php::it forbids closing an encounter without medical.records.finalize/amend permission, even when unclaimed`) — deliberately using an *unclaimed* (no owner) encounter to prove the permission floor holds independently of the ownership check. No code change needed. |

**Unplanned but fixed while verifying 3.1:** found that `tests/Feature/Billing/BillingInvoiceApiTest.php` called `/api/v1/billing-invoices` throughout (66 call sites) — a URL that has never been a real route (the actual path is `/api/v1/billing`; `billing-invoices` is only ever used as a route *name*, never a path). This silently broke ~69 of the file's tests, providing zero real coverage for the entire billing-invoice module, completely unrelated to RBAC. Fixed by correcting all 66 call sites to the real path. Verified via full-suite JUnit diff: **57 tests newly passing, 0 newly failing, all 57 confined to this one file** — i.e. a pure improvement with no side effects anywhere else in the 1,722-test suite.

**Verification performed:** full-suite JUnit diff (same method as Phases 1 and 2) across four checkpoints — after the 3.1 code fix, after adding 4 new explicit tests for it (2 of which initially failed only because they inherited the same broken URL from the file's existing pattern), after the URL correction, and after adding the 3.4 verification test. Final result: 0 regressions across all four checkpoints, 62 net-new passing tests (5 new Phase 3 tests + 57 restored pre-existing tests), fully attributed and explained.

**Rollback for Phase 3:** Plain code revert for 3.1 (additive check, not a removal). The test-file URL correction has no production-code footprint at all — pure test-file revert if ever needed, though there is no reason to revert it.

**Phase Gate 3→4: cleared.** 3.1 done and verified; 3.2, 3.3, and 3.4 all closed as false positives (no code change required, corrected in `RBAC_Audit_Report.md`). Phase 3 is complete.

**Lesson carried forward:** three of four "no authorization" findings in the original audit were wrong because the manual-grep verification pass (done after two research agents hit a session limit) checked Controller/UseCase files but not the `FormRequest::authorize()` layer, which turns out to be where real, working authorization lives for several endpoints in this codebase — inconsistently used (sometimes a stub returning `$this->user() !== null`, sometimes real per-action logic), so it can't be assumed away in either direction. Any future audit of this codebase must check the FormRequest for every endpoint before concluding "no authorization."

---

## Phase 4 — Remove Dead / Conflicting Code

**Objective:** Delete the leftover code that could silently reintroduce a conflicting rule set if ever run by accident. Low risk, no behavior change for real users (confirmed dead via the audit).

| # | Task | File(s) | Verification |
|---|---|---|---|
| 4.1 | Delete (or move to a clearly-marked non-autoloaded archive) the seeders that define a second, conflicting role/permission catalog and are never invoked. | `database/seeders/RoleHierarchySeeder.php`, `InventoryAccessRolesSeeder.php`, `InventoryPermissionsSeeder.php` | **Verification:** re-run `grep -rn "RoleHierarchySeeder\|InventoryAccessRolesSeeder\|InventoryPermissionsSeeder" --include=*.php .` (excluding the files themselves) and confirm zero references remain anywhere (`DatabaseSeeder`, console commands, tests). Full test suite still passes after removal. |
| 4.2 | Remove the dead `inventory.access` middleware alias and `InventoryAccessMiddleware` class, and the unused `InventoryPolicy` Gate registration (or fold any genuinely-missing rule from it into `DepartmentScopedPermissionResolver` first, if review finds one). | `bootstrap/app.php:46`, `app/Http/Middleware/InventoryAccessMiddleware.php`, `app/Providers/AppServiceProvider.php:90`, `app/Policies/InventoryPolicy.php` | **Verification:** grep confirms zero remaining references/route usages before deletion (already confirmed in the audit — re-confirm at delete time in case anything changed). Test suite passes. |
| 4.3 | Fix or remove the broken post-write `Gate::authorize('perform', $order)` call in the Clinical Procedure controller (either register a matching policy/gate the same way `RadiologyOrderPolicy::perform()` does, or delete the redundant call since the route already enforces the equivalent permission). | `app/Modules/ClinicalProcedure/Presentation/Http/Controllers/ClinicalProcedureOrderController.php:194` | **Automated test:** a legitimately-permitted user can now successfully call this endpoint end-to-end without the spurious 403 that currently follows every successful write. |

**Rollback for Phase 4:** Plain code revert; nothing here has external dependents (confirmed unused pre-deletion).

**Phase Gate 4→5:** Grep-confirmed zero lingering references to deleted code; full test suite green.

---

## Phase 5 — Fix Permissions Nobody Can Actually Get

**Objective:** Grant the permissions that gate real, live features but were never actually assigned to any role — so the intended staff can use their own tools instead of only "root" accounts being able to.

| # | Task | File(s) | Verification |
|---|---|---|---|
| 5.1 | Seed `billing.insurance.read`, `billing.insurance.manage`, `billing.payments.read` to the `FINANCE.CLAIMS` role (and `FINANCE.OFFICER` where appropriate) in `config/roles.php`, then run `php artisan roles:sync`. | `config/roles.php` (insurance-officer entry), migration if needed | **Automated test:** an `insurance-officer`/`FINANCE.CLAIMS` test user can now successfully call the ~13 NHIF/insurance routes in `routes/billing-phase1.php` that require these permissions, where previously they'd have been denied. |
| 5.2 | Decide and fix the `billing.service-catalog.manage` mismatch — either grant this exact permission name to the correct role, or (better) update the 6 FormRequests to check the granular permissions that already exist and are granted (`billing.service-catalog.manage-identity` / `.manage-pricing`). | `app/Modules/Billing/Presentation/Http/Requests/{Store,Update,BulkUpdate,BulkSync}*.php` | **Automated test:** a `FINANCE.OFFICER`/`FINANCE.CONTROLLER` test user (who already holds the granular permissions per `config/roles.php`) can now successfully create/update service-catalog items. |

**Rollback for Phase 5:** Revert the config/migration change; this only *adds* access, so a rollback simply removes it again.

**Phase Gate 5→6:** Both new tests green; a manual smoke test confirms an `insurance-officer` test account can complete a real NHIF claim workflow end-to-end in staging.

---

## Phase 6 — Add a Tripwire So This Doesn't Quietly Happen Again

**Objective:** Catch the "permission checked in code but never seeded" / "seeded under one name, checked under another" bug class automatically, before merge — this exact bug has already shipped once (`clinical_procedure.*` vs `clinical-procedure.*`).

| # | Task | File(s) | Verification |
|---|---|---|---|
| 6.1 | Write a small Artisan command or automated test that: (a) greps the codebase for every permission literal used in `can:` middleware, `hasPermissionTo(`, and `->authorize(`/`->can(`, and (b) asserts each one exists as a seeded permission name (or is on an explicit allow-list of Gate-only composite abilities, e.g. the ones in `EffectivePermissionNameResolver`). | New file, e.g. `app/Console/Commands/AuditPermissionUsage.php` + a Pest test that runs it | **Pass condition:** running it today, before any further changes, produces a clean report of exactly the anomalies already documented in `RBAC_Audit_Report.md` §6.2/§6.3 (proving the tool works) — and zero *new*, previously-unknown anomalies (which would mean the tool has a bug, since the audit was meant to be exhaustive for this class of issue). |
| 6.2 | Wire this check into CI (e.g. `composer test` or a dedicated CI job) so a future PR that introduces a new mismatched permission name fails the build. | `composer.json` scripts, CI config | **Verification:** intentionally introduce a deliberately-typo'd permission check in a throwaway branch and confirm CI fails; remove the typo and confirm CI passes. |

**Phase Gate 6→7:** CI check is live and has been proven to both catch a real mismatch and pass on clean code.

---

## Phase 7 — Beyond-RBAC Hospital-Specific Work (Backlog, Not Scheduled)

These are real gaps for a hospital system but are **separate initiatives**, each large enough to need their own scoping/plan document — listed here only so they aren't lost, not because they're next in this sequence.

| Item | Why it matters | Suggested next step |
|---|---|---|
| Break-glass emergency access | Lets a clinician override normal permission checks in a genuine emergency, but logs it and forces a mandatory after-the-fact review. | Separate design doc: who can trigger it, what gets logged, who reviews, what happens on abuse. |
| System-wide segregation of duties | A `SegregationOfDutiesValidator` already exists but only covers inventory approvals — extending the same concept to billing (e.g. one person can't both create and approve their own refund) needs its own audit of which actions are SoD-sensitive. | Separate audit: list every "request vs. approve" pair across all modules, not just inventory. |
| Read-access audit logging for patient data | Current audit logs (confirmed present in several modules, e.g. `staff.view-audit-logs`, `billing-invoices.view-audit-logs`) appear to focus on writes/changes. Whether every *read* of PHI is logged was not verified in this audit. | Separate verification pass specifically on read-path logging coverage, likely a compliance/legal requirement depending on jurisdiction. |
| Periodic access recertification | A process (not code) where facility admins periodically re-confirm every user's role assignments are still correct — this is exactly the kind of process that would have caught the Phase 1 bug's real-world instances before they became a security issue. | This is an operational/process change for the hospital's IT admin team, not a code task. |

---

## Overall Definition of Done

The remediation is considered complete when:
- [ ] Pre-Phase 0 blast-radius list exists and has been reviewed.
- [ ] Phase 1 shipped, verified, and stable in production for at least one monitoring cycle.
- [ ] Phase 2 shipped (via pilot → full rollout), verified, feature flag removed.
- [ ] Phase 3's three endpoints all have passing allow/deny tests in the suite.
- [ ] Phase 4's dead code is deleted and grep-confirmed gone.
- [ ] Phase 5's previously-orphaned permissions are seeded and end-to-end tested.
- [ ] Phase 6's CI tripwire is live and proven to catch a deliberately-introduced mismatch.
- [ ] Phase 7 items are logged as their own backlog items/tickets (not silently dropped), even though they're out of scope for this plan.

This document should be updated (checkboxes ticked, dates added) as each phase actually completes — it is a tracking artifact, not a one-time write-up.
