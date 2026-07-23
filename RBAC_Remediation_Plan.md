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

## Phase 2 — Remove the Blanket Bypass (Least Privilege)

**Objective:** Stop treating `ADMIN.FACILITY` as "skip every check" even when the role *is* active. Replace it with the role's actual, already-defined permission list. Riskier — do this only after Phase 1 is stable in production.

| # | Task | File(s) | Verification |
|---|---|---|---|
| 2.1 | Enumerate every call site that reads `isFacilitySuperAdminAccess()` / `isFacilitySuperAdmin()` / `hasUniversalAdminAccess()`, in both backend and frontend. | Backend: `app/Providers/AppServiceProvider.php`, `app/Policies/*.php`, `app/Support/Auth/ConsultationProviderAuthorization.php`. Frontend: search for `isFacilitySuperAdmin` in `resources/js/**`. | **Deliverable, not a test:** a written list of every call site with a decision next to each — "replace with permission check X" or "safe to remove entirely." This list must exist and be reviewed before writing any code for 2.2. |
| 2.2 | For each call site from 2.1, replace the blanket bypass with the specific permission(s) that call site actually needs (most already correspond 1:1 to permissions in `config/roles.php`'s `ADMIN.FACILITY` list). | Per file, per 2.1's list | **Automated test (per call site):** a test proving a user with the full `ADMIN.FACILITY` permission list (but *not* the bypass) still passes that specific check, and a user missing the relevant permission is denied. |
| 2.3 | Audit `config/roles.php`'s `ADMIN.FACILITY` permission list for completeness against what real Facility Admin accounts have actually used in the last N months (requires either usage logs or a product-owner/domain-expert review — this cannot be fully verified from code alone). | `config/roles.php:363-390` | **Sign-off, not a test:** a named product owner or lead facility-admin user confirms the permission list covers real day-to-day usage. Any gap found gets added to the list *before* rollout, not patched reactively after. |
| 2.4 | Ship behind a feature flag (or to a single pilot facility first) rather than to every facility at once. | Deployment process | **Pass condition:** for a defined pilot period, zero unexpected "permission denied" reports from pilot facility admins doing their normal job. Only after the pilot is clean does this roll out everywhere. |
| 2.5 | Full regression pass: run the entire existing test suite, plus manually smoke-test the top 10 most common Facility Admin actions in a staging environment logged in as a real (or realistic test) Facility Admin account. | n/a | **Pass condition:** test suite green; all 10 smoke-tested actions succeed exactly as before the change. |

**Rollback for Phase 2:** Keep the feature flag in place through the pilot; flipping it off reverts to bypass behavior instantly without a code deploy. Only remove the flag (and the old bypass code path) once the full rollout has been stable for an agreed monitoring period.

**Phase Gate 2→3:** Full rollout complete, flag removed, no open incident tickets traceable to this change for the agreed monitoring period (recommend at least one full business cycle, e.g. one billing month, given this touches financial/admin permissions).

---

## Phase 3 — Fix the Zero-Authorization Endpoints

**Objective:** Add the missing lock to the three actions that currently have no check at all. Low risk, independent of Phase 2, can run in parallel with Phase 1/2 if resourcing allows.

| # | Task | File(s) | Verification |
|---|---|---|---|
| 3.1 | Add `can:` middleware (matching the sibling `update`/`record-payment` routes' convention) to the invoice status-transition route. | `routes/api.php:1028-1030` | **Automated test:** a user without the relevant billing permission gets `403` on this route; a user with it succeeds. |
| 3.2 | Add `can:` middleware to the billing service-catalog create/update/publish routes, **and** seed the permission they check (or a corrected one — see Phase 5) to the appropriate role(s). | `routes/api.php:1199-1212`, plus a migration seeding `permission_role` rows | **Automated test:** same allow/deny pattern as 3.1, for each of the 6 affected routes. |
| 3.3 | Add a permission check to the staff privilege-grant status-transition endpoint. | `routes/api.php:2184-2186`, `UpdateStaffPrivilegeGrantStatusUseCase.php` | **Automated test:** same allow/deny pattern, confirming a non-credentialing user cannot activate/suspend a clinician's privileges. |
| 3.4 | (Medium-priority, can be folded in here) Add a baseline permission check alongside the existing ownership check for medical-record/encounter status transitions. | `routes/api.php:859,899` | **Automated test:** a user with zero relevant permissions, even if recorded as record "owner," is denied. |

**Rollback for Phase 3:** Plain code + migration revert; these are additive checks, not removals, so rollback risk is minimal.

**Phase Gate 3→4:** All new tests green, full suite passes, and a manual pass through each of the 3 affected workflows in staging confirms legitimate users are unaffected.

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
