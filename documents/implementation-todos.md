# Implementation Todos — Authorization Architecture Overhaul

**Total: 10 pushes (14 items)**

## Status Legend

| Status | Meaning |
|--------|---------|
| 🔴 Pending | Not started |
| 🟡 In Progress | Actively working |
| 🟢 Completed | Done and verified |
| ⚪ Cancelled | No longer needed |

---

## Phase 1 — Permission Rename + Insert Workflow Permissions

| # | Task | Status |
|---|------|--------|
| 1.1 | Create migration `standardize_permission_names` (rename hyphens → dots) | 🟢 |
| 1.2 | Create migration `insert_workflow_permissions` (all modules, copy role assignments) | 🟢 |
| 1.3 | Run `migrate --force`, verify no hyphenated names remain in DB | 🟢 |

**Files to create:** `database/migrations/YYYY_MM_DD_HHMMSS_standardize_permission_names.php`, `database/migrations/YYYY_MM_DD_HHMMSS_insert_workflow_permissions.php`

**Verification:**
```sql
SELECT count(*) FROM permissions WHERE name LIKE '%-%'  -- must be 0
SELECT name FROM permissions WHERE name LIKE 'lab.%'     -- lab.order, lab.sample.collect, etc.
```

---

## Phase 2 — Backward-Compat Gates

| # | Task | Status |
|---|------|--------|
| 2.1 | Add backward-compat Gates in `AppServiceProvider.php` (lab, pharmacy, radiology, patients, appointments, staff) | 🟢 |
| 2.2 | Update `EffectivePermissionNameResolver.php` with new composite abilities | 🟢 |
| 2.3 | Verify `$user->can('patient.demographics.update')` returns true for user with only `patients.update` | 🟢 |

**Files to modify:** `app/Providers/AppServiceProvider.php`, `app/Support/Auth/EffectivePermissionNameResolver.php`

---

## Phase 3 — Switch Code to New Permissions

| # | Task | Status |
|---|------|--------|
| 3.1 | Update `routes/api.php` — all `can:` middleware to new permission names | 🟢 |
| 3.2 | Update all FormRequest `authorize()` methods to check new permissions | 🟢 |
| 3.3 | Update all controller `$user->can()` / `Gate::any()` calls to new permissions | 🟢 |
| 3.4 | Update all frontend `hasPermission()` / `hasAccess()` calls in Vue files | 🟢 |
| 3.5 | Verify all routes load without 403 for users with correct roles | 🟢 |

**Files to modify:** `routes/api.php`, `app/Modules/*/Presentation/Http/Requests/*.php`, `app/Modules/*/Presentation/Http/Controllers/*.php`, `resources/js/pages/**/*.vue`

---

## Phase 4 — Create Policy Layer (Empty)

| # | Task | Status |
|---|------|--------|
| 4.1 | Create `app/Policies/PatientPolicy.php` (all methods return true) | 🟢 |
| 4.2 | Create `app/Policies/LaboratoryOrderPolicy.php` | 🟢 |
| 4.3 | Create `app/Policies/PharmacyOrderPolicy.php` | 🟢 |
| 4.4 | Create `app/Policies/RadiologyOrderPolicy.php` | 🟢 |
| 4.5 | Create `app/Policies/AppointmentPolicy.php` | 🟢 |
| 4.6 | Create `app/Policies/MedicalRecordPolicy.php` | 🟢 |
| 4.7 | Create `app/Policies/InventoryPolicy.php` | 🟢 |
| 4.8 | Register all policies in `AppServiceProvider.php` (Laravel 12, no AuthServiceProvider) | 🟢 |

**Files to create:** `app/Policies/*.php`
**Files to modify:** `app/Providers/AuthServiceProvider.php`

---

## Phase 5 — Switch Controllers to Policy Authorization

| # | Task | Status |
|---|------|--------|
| 5.1 | Update PatientController — call `$this->authorize()` instead of FormRequest-only | 🟢 |
| 5.2 | Update LabOrderController — call `$this->authorize()` per action | 🟢 |
| 5.3 | Update PharmacyOrderController | 🟢 |
| 5.4 | Update RadiologyOrderController | 🟢 |
| 5.5 | Update AppointmentController | 🟢 |
| 5.6 | Update MedicalRecordController | 🟢 |
| 5.7 | Update Inventory/RequisitionController | 🟢 |

**Files to modify:** All controllers in `app/Modules/*/Presentation/Http/Controllers/`

---

## Phase 6 — Add Business Logic to Policies

| # | Task | Status |
|---|------|--------|
| 6a.1 | PatientPolicy — `updateDemographics`: clinician only own active encounters, reception any | 🟢 |
| 6a.2 | PatientPolicy — `view`: cashier only billing-relevant patients | 🟢 |
| 6a.3 | PatientPolicy — `recordVitals`: nurse only own ward admitted patients | 🟢 |
| 6b.1 | LaboratoryOrderPolicy — `order`: clinician only own active encounters | 🟢 |
| 6b.2 | LaboratoryOrderPolicy — `performTest`: specimen assigned to this lab | 🟢 |
| 6b.3 | LaboratoryOrderPolicy — `verifyResult`: cannot verify own entry | 🟢 |
| 6b.4 | LaboratoryOrderPolicy — `enterResult`: only if specimen collected | 🟢 |
| 6b.5 | PharmacyOrderPolicy — `dispense`: only verified, non-expired prescriptions | 🟢 |
| 6b.6 | PharmacyOrderPolicy — `cancel`: supervisor only | 🟢 |
| 6c.1 | RadiologyOrderPolicy — `perform`: assigned to this department | 🟢 |
| 6c.2 | RadiologyOrderPolicy — `verify`: cannot verify own entry | 🟢 |
| 6c.3 | AppointmentPolicy — `reschedule`: only future appointments | 🟢 |
| 6c.4 | AppointmentPolicy — `cancel`: only future appointments | 🟢 |
| 6c.5 | AppointmentPolicy — `checkIn`: only scheduled appointments | 🟢 |
| 6c.6 | AppointmentPolicy — `checkOut`: only checked-in appointments | 🟢 |
| 6d.1 | InventoryPolicy — `createRequisition`: department scope | 🟢 |
| 6d.2 | InventoryPolicy — `approveRequisition`: SOD (not own), high-value, controlled substances | 🟢 |
| 6d.3 | InventoryPolicy — `viewRequisition`: own department or own requests | 🟢 |
| 6e.1 | MedicalRecordPolicy — `updateDraft`: only draft, author or handoff recipient, scope | 🟢 |

---

## Phase 7 — Eliminate Dual Inventory RBAC Path

| # | Task | Status |
|---|------|--------|
| 7.1 | Replace hardcoded matrix in `DepartmentScopedPermissionResolver` with DB lookup | 🔴 |
| 7.2 | Remove `inventory.access` middleware alias from `bootstrap/app.php` | 🔴 |
| 7.3 | Replace `inventory.access:` middleware with `can:` + InventoryPolicy in routes | 🔴 |

**Files to modify:** `app/Support/Auth/DepartmentScopedPermissionResolver.php`, `bootstrap/app.php`, `routes/api.php`

---

## Phase 8 — Config-Driven Role Definition

| # | Task | Status |
|---|------|--------|
| 8.1 | Create `config/roles.php` with all role definitions | 🔴 |
| 8.2 | Create migration `sync_roles_from_config` (idempotent) | 🔴 |
| 8.3 | Update `RoleHierarchySeeder.php` to read from config | 🔴 |
| 8.4 | Update `routes/console.php` seeding commands to use config | 🔴 |

**Files to create:** `config/roles.php`, `database/migrations/YYYY_MM_DD_HHMMSS_sync_roles_from_config.php`
**Files to modify:** `database/seeders/RoleHierarchySeeder.php`, `routes/console.php`

---

## Phase 9 — Tanzania Role Names

| # | Task | Status |
|---|------|--------|
| 9.1 | Create migration to rename role display names to Tanzania MOH cadres | 🔴 |
| 9.2 | Create migration to insert missing Tanzania cadre roles | 🔴 |
| 9.3 | Verify all role names in DB match Tanzania terminology | 🔴 |

**Files to create:** `database/migrations/YYYY_MM_DD_HHMMSS_update_role_names_to_tanzania_cadres.php`, `database/migrations/YYYY_MM_DD_HHMMSS_insert_missing_tanzania_roles.php`

---

## Phase 10 — Cleanup

| # | Task | Status |
|---|------|--------|
| 10.1 | Remove all backward-compat gates from `AppServiceProvider.php` | 🔴 |
| 10.2 | Remove old permission string references from any remaining code | 🔴 |
| 10.3 | Remove old `HOSPITAL.*` role migration compatibility code from `RoleHierarchySeeder.php` | 🔴 |
| 10.4 | Final integration test pass — all 10 test scenarios pass | 🔴 |

**Files to modify:** `app/Providers/AppServiceProvider.php`, `database/seeders/RoleHierarchySeeder.php`

---

## Summary

| Phase | Description | Items | Est. Pushes |
|-------|-------------|-------|-------------|
| 1 | Permission rename + insert | 3 | 1 | 🟢 |
| 2 | Backward-compat gates | 3 | 1 | 🟢 |
| 3 | Switch code to new perms | 5 | 1 | 🟢 |
| 4 | Policy files (empty) | 8 | 1 | 🟢 |
| 5 | Controller → policy swap | 7 | 1 | 🟢 |
| 6 | Business logic in policies | 18 | 5 | 🟢 |
| 7 | Eliminate dual RBAC | 3 | 1 | 🔴 |
| 8 | Config-driven roles | 4 | 1 | 🔴 |
| 9 | Tanzania role names | 3 | 1 | 🔴 |
| 10 | Cleanup | 4 | 1 | 🔴 |
| **Total** | | **58** | **14 pushes** |
