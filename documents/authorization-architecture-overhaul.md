# Authorization Architecture Overhaul

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target State: Three-Layer Authorization Model](#2-target-state-three-layer-authorization-model)
3. [Tanzania Hospital Context — Role Audit](#3-tanzania-hospital-context--role-audit)
4. [Permisssion Catalog: Before & After](#4-permission-catalog-before--after)
5. [Policy Layer: Complete Implementation](#5-policy-layer-complete-implementation)
6. [Cloud-Safe Deployment Strategy](#6-cloud-safe-deployment-strategy)
7. [Complete File Manifest](#7-complete-file-manifest)
8. [Role Definitions: config/roles.php](#8-role-definitions-configrolesphp)
9. [Migration Scripts](#9-migration-scripts)
10. [Verification Checklist](#10-verification-checklist)

---

## 1. Current State Analysis

### 1.1 What Works Well

| Aspect | Assessment |
|--------|------------|
| Permissions are flat and granular | Mostly true — strings follow `module.action` format |
| Roles aggregate flat permissions | Correct — roles are collections of permission strings |
| Module-level door permissions exist | `patients.read`, `laboratory.access`, `pharmacy.access` |
| Business rules partially separated | `medical-records.update-draft` gate checks ownership + status |
| Super admin bypass | `hasUniversalAdminAccess()` works correctly |
| Gate::before fallback | Bridges `can:` middleware to `hasPermissionTo()` cleanly |

### 1.2 What Needs Fixing

| Problem | Severity | Location |
|---------|----------|----------|
| One permission gates multiple workflow steps | **Critical** | `patients.update`, `laboratory.orders.create`, `laboratory.orders.update-status`, `pharmacy.orders.create`, `pharmacy.orders.update-status`, `radiology.orders.create`, `radiology.orders.update-status`, `appointments.update`, `appointments.update-status`, `staff.update` |
| No Policy classes exist | **High** | Zero files in `app/Policies/` |
| Business rules scattered | **High** | Across FormRequests, controllers, use cases, one gate |
| Dual RBAC path | **Medium** | Standard Gate system + `InventoryAccessMiddleware` with hardcoded matrix |
| Inconsistent naming convention | **Medium** | Hyphens in some module names (`laboratory-orders.view-audit-logs` vs `laboratory.orders.read`) |
| Old role codes coexist | **Low** | `HOSPITAL.*` references in migration files |
| Role names don't match Tanzania cadres | **Medium** | "Clinical Physician" should be "Medical Officer", etc. |
| Missing Tanzania-specific roles | **Medium** | Nurse Midwife, Dental Officer, Nutritionist, Counselor, Community Health Worker, Medical Attendant, Surgeon |

### 1.3 The Dual RBAC Path

```
Standard Path                          Inventory Path
──────────────                         ──────────────
User::hasPermissionTo()                DepartmentScopedPermissionResolver
  → permission_user (direct)              → hardcoded matrix keyed by access_level
  → permission_role → role_user             (view/request/approve/manage)
  → super admin bypass
                                        InventoryAccessMiddleware
Middleware: can:perm.name                 Middleware: inventory.access:perm.name
Route: ->middleware('can:patients.read')  Route: ->middleware('inventory.access:...')
```

The hardcoded matrix duplicates what `RoleHierarchySeeder` already defines. Departments no longer need a separate resolver.

---

## 2. Target State: Three-Layer Authorization Model

```
Layer 1 — Door Permissions: Can the user open this module?
───────────────────────────────────────────────────────────
patients.read
patients.create
laboratory.access
pharmacy.access
imaging.access
billing.access
admissions.read

These answer only: "Can this user open this screen?"


Layer 2 — Workflow Permissions: What actions can they perform?
──────────────────────────────────────────────────────────────
lab.order, lab.sample.collect, lab.test.perform
lab.result.enter, lab.result.verify, lab.result.release
medication.prescribe, medication.dispense, dispense.cancel
imaging.order, imaging.perform, imaging.result.enter, imaging.result.verify
patient.demographics.update, patient.allergies.manage
patient.medications.manage, patient.vitals.record
appointment.reschedule, appointment.cancel
appointment.check-in, appointment.check-out
staff.employment.update, staff.status.update

These match actual hospital workflows. No overlap between roles.


Layer 3 — Business Rules: Context-aware authorization
──────────────────────────────────────────────────────
Implemented in Laravel Policies.

Examples:
• Doctor can update demographics only for patients in today's encounter
• Nurse can record vitals only for admitted patients in own ward
• Lab tech can perform test only if specimen assigned to their lab
• Lab supervisor can verify results only if not their own entry
• Pharmacist can dispense only if prescription is verified and not expired
• Requester cannot approve their own inventory requisition
• High-value requisitions require additional approval
```

---

## 3. Tanzania Hospital Context — Role Audit

### 3.1 Current Role Names vs Tanzania MOH Cadres

| Internal Code | Current Name → Should Be (Tanzania Cadre) | Facility Level |
|---|---|---|
| `PLATFORM.SUPER.ADMIN` | Platform Super Admin → **System Administrator (MoH ICT)** | National |
| `PLATFORM.USER.ADMIN` | Platform User Admin → **Platform User Admin** | National |
| `PLATFORM.RBAC.ADMIN` | Platform RBAC Admin → **Platform RBAC Admin** | National |
| `PLATFORM.SUBSCRIPTION.ADMIN` | Subscription Admin → **Subscription Admin** | National |
| `ADMIN.FACILITY` | Facility Admin → **Hospital Administrator / Medical Superintendent** | All |
| `ADMIN.HR` | HR Admin → **Human Resources Officer** | Hospital/Health Centre |
| `ADMIN.REGISTRATION` | Registration Admin → **Health Records Officer** | All |
| `ADMIN.MEDICAL.RECORDS` | Medical Records Admin → **Health Records Officer-in-Charge** | Hospital |
| `CLINICAL.PHYSICIAN` | Clinical Physician → **Medical Officer** | Hospital/Health Centre |
| `CLINICAL.GENERAL` | Clinical General → **Clinical Officer (CO/ACO)** | Dispensary/Health Centre |
| `CLINICAL.NURSE` | Clinical Nurse → **Nurse Officer** | All |
| `CLINICAL.EMERGENCY` | Clinical Emergency → **Casualty Nurse / EMT** | Hospital |
| `FINANCE.CASHIER` | Finance Cashier → **Cashier** | All |
| `FINANCE.OFFICER` | Finance Officer → **Accountant** | Hospital |
| `FINANCE.CONTROLLER` | Finance Controller → **Finance Manager** | Hospital |
| `FINANCE.CLAIMS` | Finance Claims → **Insurance Claims Officer** | Hospital |
| `LAB.STAFF` | Lab Staff → **Laboratory Technologist / Technician** | Hospital/Health Centre |
| `LAB.SUPERVISOR` | Lab Supervisor → **Chief Laboratory Technologist** | Hospital |
| `LAB.MANAGER` | Lab Manager → **Laboratory Manager** | Referral Hospital |
| `RADIOLOGY.STAFF` | Radiology Staff → **Radiographer** | Hospital |
| `RADIOLOGY.SUPERVISOR` | Radiology Supervisor → **Senior Radiographer** | Hospital |
| `RADIOLOGY.MANAGER` | Radiology Manager → **Radiology Manager** | Referral Hospital |
| `PHARMACY.STAFF` | Pharmacy Staff → **Dispenser / Pharmaceutical Technician** | All |
| `PHARMACY.SUPERVISOR` | Pharmacy Supervisor → **Pharmacist-in-Charge** | Hospital |
| `PHARMACY.MANAGER` | Pharmacy Manager → **Chief Pharmacist** | Referral Hospital |
| `THEATRE.STAFF` | Theatre Staff → **Theatre Nurse** | Hospital |
| `THEATRE.SUPERVISOR` | Theatre Supervisor → **Theatre Nurse-in-Charge** | Hospital |
| `THEATRE.MANAGER` | Theatre Manager → **Theatre Manager** | Referral Hospital |
| `INVENTORY.STAFF` | Inventory Staff → **Storekeeper** | All |
| `INVENTORY.SUPERVISOR` | Inventory Supervisor → **Senior Storekeeper** | Hospital |
| `INVENTORY.MANAGER` | Inventory Manager → **Procurement Officer** | Hospital |

### 3.2 Missing Tanzania Cadres

| Code | Name | Description | Facilities |
|---|---|---|---|
| `CLINICAL.NURSE.MIDWIFE` | Nurse Midwife | Antenatal, delivery, postnatal, family planning. Different scope from general Nurse. | All |
| `CLINICAL.DENTAL.OFFICER` | Dental Officer | Dental exams, extractions, fillings, oral health education. | Hospital/Health Centre |
| `CLINICAL.SURGEON` | Surgeon | Surgical procedures, theatre management, post-op care. | Hospital/Referral |
| `ALLIED.NUTRITIONIST` | Nutritionist | Malnutrition management, therapeutic feeding, HIV nutrition support. | Hospital/Health Centre |
| `ALLIED.COUNSELOR` | Counselor | HIV testing counseling, adherence support, psychosocial support, mental health. | Hospital/Health Centre |
| `ALLIED.COMMUNITY.HEALTH.WORKER` | Community Health Worker | Home visits, defaulter tracing, health education, outreach. | Dispensary/Outreach |
| `SUPPORT.MEDICAL.ATTENDANT` | Medical Attendant | Patient hygiene, bed-making, linen, cleaning, basic patient care. | All |
| `SUPPORT.HEALTH.SECRETARY` | Health Secretary | Front desk, document management, appointment scheduling, referrals. | Hospital |

### 3.3 Role Hierarchy by Facility Level

```
NATIONAL LEVEL (Platform)
  PLATFORM.SUPER.ADMIN
  PLATFORM.USER.ADMIN
  PLATFORM.RBAC.ADMIN
  PLATFORM.SUBSCRIPTION.ADMIN

REFERRAL HOSPITAL
  ADMIN.FACILITY (Medical Superintendent)
  ADMIN.HR, ADMIN.REGISTRATION, ADMIN.MEDICAL.RECORDS
  CLINICAL.PHYSICIAN (Medical Officer - Specialists)
  CLINICAL.SURGEON
  CLINICAL.NURSE, CLINICAL.NURSE.MIDWIFE
  CLINICAL.GENERAL (Clinical Officer)
  CLINICAL.EMERGENCY, CLINICAL.DENTAL.OFFICER
  LAB.STAFF, LAB.SUPERVISOR, LAB.MANAGER
  RADIOLOGY.STAFF, RADIOLOGY.SUPERVISOR, RADIOLOGY.MANAGER
  PHARMACY.STAFF, PHARMACY.SUPERVISOR, PHARMACY.MANAGER
  THEATRE.STAFF, THEATRE.SUPERVISOR, THEATRE.MANAGER
  FINANCE.CASHIER, FINANCE.OFFICER, FINANCE.CONTROLLER, FINANCE.CLAIMS
  INVENTORY.STAFF, INVENTORY.SUPERVISOR, INVENTORY.MANAGER
  ALLIED.NUTRITIONIST, ALLIED.COUNSELOR
  SUPPORT.MEDICAL.ATTENDANT, SUPPORT.HEALTH.SECRETARY

DISTRICT / COUNCIL HOSPITAL
  ADMIN.FACILITY, ADMIN.HR, ADMIN.REGISTRATION
  CLINICAL.PHYSICIAN, CLINICAL.GENERAL
  CLINICAL.NURSE, CLINICAL.NURSE.MIDWIFE
  CLINICAL.EMERGENCY, CLINICAL.DENTAL.OFFICER
  LAB.STAFF, LAB.SUPERVISOR
  RADIOLOGY.STAFF
  PHARMACY.STAFF, PHARMACY.SUPERVISOR
  FINANCE.CASHIER, FINANCE.OFFICER
  INVENTORY.STAFF, INVENTORY.SUPERVISOR
  ALLIED.NUTRITIONIST, ALLIED.COUNSELOR
  SUPPORT.MEDICAL.ATTENDANT, SUPPORT.HEALTH.SECRETARY

HEALTH CENTRE
  ADMIN.FACILITY (In-Charge)
  CLINICAL.GENERAL (Clinical Officer - main clinician)
  CLINICAL.NURSE, CLINICAL.NURSE.MIDWIFE
  LAB.STAFF (Lab Technician - basic tests only)
  PHARMACY.STAFF (Dispenser)
  INVENTORY.STAFF (Storekeeper)
  ALLIED.COMMUNITY.HEALTH.WORKER
  SUPPORT.MEDICAL.ATTENDANT

DISPENSARY
  CLINICAL.GENERAL (Clinical Officer - sole clinician)
  CLINICAL.NURSE.MIDWIFE (if available)
  ALLIED.COMMUNITY.HEALTH.WORKER
```

---

## 4. Permission Catalog: Before & After

### 4.1 Laboratory

| Current | Problem | Replacement | Backward-Compat Gate |
|---------|---------|-------------|----------------------|
| `laboratory.orders.read` | OK — door permission | Keep as is | — |
| `laboratory.orders.create` | Mixes ordering + collecting + performing | `lab.order` (for clinicians), `lab.sample.collect` (for nurses/lab), `lab.test.perform` (for lab techs) | `$user->hasPermissionTo('lab.order') \|\| $user->hasPermissionTo('laboratory.orders.create')` |
| `laboratory.orders.update-status` | Mixes ALL status transitions | `lab.sample.reject`, `lab.result.enter`, `lab.result.verify`, `lab.result.release` | Each new perm falls back to `laboratory.orders.update-status` |
| `laboratory.orders.verify-result` | OK — already a verify step | Keep as: `lab.result.verify` | — |
| `laboratory.orders.audit-logs.view` | Rename only | `laboratory.orders.audit-logs.view` | — |

**Workflow mapping:**
```
Clinician orders test          →  lab.order
Nurse collects specimen        →  lab.sample.collect
Lab tech receives specimen     →  lab.sample.collect (or new lab.sample.receive)
Lab tech rejects specimen      →  lab.sample.reject
Lab tech performs test         →  lab.test.perform
Lab tech enters result         →  lab.result.enter
Lab supervisor verifies result →  lab.result.verify
Lab supervisor releases result →  lab.result.release
```

### 4.2 Pharmacy

| Current | Problem | Replacement | Backward-Compat Gate |
|---------|---------|-------------|----------------------|
| `pharmacy.orders.read` | OK — door permission | Keep as is | — |
| `pharmacy.orders.create` | Prescribing + dispensing mixed | `medication.prescribe` (clinician), `medication.dispense` (pharmacist) | `$user->hasPermissionTo('medication.prescribe') \|\| $user->hasPermissionTo('pharmacy.orders.create')` |
| `pharmacy.orders.update-status` | All status transitions | `medication.dispense`, `dispense.cancel` | Each new perm falls back to `pharmacy.orders.update-status` |
| `pharmacy.orders.verify-dispense` | OK | Keep — maps to `pharmacy.orders.verify-dispense` | — |
| `pharmacy.orders.manage-policy` | OK | Keep | — |
| `pharmacy.orders.reconcile` | OK | Keep | — |
| `pharmacy.orders.audit-logs.view` | Rename only | `pharmacy.orders.audit-logs.view` | — |

**Workflow mapping:**
```
Clinician prescribes medication      →  medication.prescribe
Pharmacist reviews prescription      →  pharmacy.orders.read
Pharmacist dispenses                 →  medication.dispense
Pharmacist-in-Charge cancels dispense → dispense.cancel
Pharmacist reconciles stock          →  pharmacy.orders.reconcile
```

### 4.3 Radiology / Imaging

| Current | Problem | Replacement | Backward-Compat Gate |
|---------|---------|-------------|----------------------|
| `radiology.orders.read` | OK — door permission | Keep as is | — |
| `radiology.orders.create` | Ordering + performing mixed | `imaging.order` (clinician), `imaging.perform` (radiographer) | `$user->hasPermissionTo('imaging.order') \|\| $user->hasPermissionTo('radiology.orders.create')` |
| `radiology.orders.update` | Too broad — any field update | Keep for now, migrate per-field later | — |
| `radiology.orders.update-status` | All status transitions | `imaging.perform`, `imaging.result.enter`, `imaging.result.verify` | Each new perm falls back to `radiology.orders.update-status` |

**Workflow mapping:**
```
Clinician orders imaging        →  imaging.order
Radiographer performs scan      →  imaging.perform
Radiographer enters images      →  imaging.perform (same step)
Radiologist enters findings     →  imaging.result.enter
Radiologist verifies report     →  imaging.result.verify
Report released to clinician    →  imaging.result.verify (or new imaging.result.release)
```

### 4.4 Patients

| Current | Problem | Replacement | Backward-Compat Gate |
|---------|---------|-------------|----------------------|
| `patients.read` | OK — door permission | Keep | — |
| `patients.create` | OK | Keep | — |
| `patients.update` | **Critical** — mixes demographics, allergies, medications, vitals | `patient.demographics.update`, `patient.allergies.manage`, `patient.medications.manage`, `patient.vitals.record` | `$user->hasPermissionTo('patient.demographics.update') \|\| $user->hasPermissionTo('patients.update')` (same pattern for all four) |
| `patients.update-status` | OK — separate | Keep | — |
| `patients.export` | OK | Keep | — |
| `patients.import` | OK | Keep | — |
| `patients.insurance.read` | OK | Keep | — |
| `patients.insurance.manage` | OK | Keep | — |
| `patients.insurance.verify` | OK | Keep | — |

### 4.5 Appointments

| Current | Problem | Replacement | Backward-Compat Gate |
|---------|---------|-------------|----------------------|
| `appointments.read` | OK — door permission | Keep | — |
| `appointments.create` | OK | Keep | — |
| `appointments.update` | Reschedule + cancel + edit mixed | `appointment.reschedule`, `appointment.cancel` | Fallback to `appointments.update` |
| `appointments.update-status` | All status transitions | `appointment.check-in`, `appointment.check-out` | Fallback to `appointments.update-status` |

### 4.6 Staff

| Current | Problem | Replacement | Backward-Compat Gate |
|---------|---------|-------------|----------------------|
| `staff.read` | OK | Keep | — |
| `staff.create` | OK | Keep | — |
| `staff.update` | Employment changes + status changes mixed | `staff.employment.update`, `staff.status.update` | Fallback to `staff.update` |
| `staff.update-status` | OK — already separate | Keep | — |
| `staff.documents.*` | OK — already split | Keep | — |
| `staff.credentialing.*` | OK — already split | Keep | — |
| `staff.privileges.*` | OK — already split | Keep | — |

### 4.7 Naming Standardization

All hyphenated module names in permission strings are renamed to dots:

| Before | After |
|--------|-------|
| `laboratory-orders.view-audit-logs` | `laboratory.orders.audit-logs.view` |
| `pharmacy-orders.view-audit-logs` | `pharmacy.orders.audit-logs.view` |
| `radiology-orders.view-audit-logs` | `radiology.orders.audit-logs.view` |
| `medical-records.view-audit-logs` | `medical.records.audit-logs.view` |
| `billing-invoices.view-audit-logs` | `billing.invoices.audit-logs.view` |
| `laboratory-orders.view-audit-logs` | `laboratory.orders.audit-logs.view` |
| `medical-records.update-draft` | `medical.records.draft.update` |

Note: Code gate names (e.g., `medical-records.update-draft` in `AppServiceProvider.php`) are NOT stored in the database — they are referenced in `$this->authorize('medical-records.update-draft')` calls. These gate names are also updated to match the new convention.

---

## 5. Policy Layer: Complete Implementation

### 5.1 Policy File Structure

```
app/Policies/
├── PatientPolicy.php
├── MedicalRecordPolicy.php
├── LaboratoryOrderPolicy.php
├── PharmacyOrderPolicy.php
├── RadiologyOrderPolicy.php
├── AppointmentPolicy.php
├── EncounterPolicy.php
├── InvoicePolicy.php
├── InventoryPolicy.php
└── StaffProfilePolicy.php
```

### 5.2 PatientPolicy.php — Full Implementation

```php
<?php

namespace App\Policies;

use App\Models\User;

class PatientPolicy
{
    public function view(User $user, Patient $patient): bool
    {
        if (! $user->hasPermissionTo('patients.read')) {
            return false;
        }

        // Cashier: only see patients with active billing
        if ($user->hasRole('FINANCE.CASHIER')) {
            return $patient->invoices()->where('status', 'unpaid')->exists();
        }

        return true;
    }

    public function updateDemographics(User $user, Patient $patient): bool
    {
        if (! $user->hasPermissionTo('patient.demographics.update')) {
            return false;
        }

        // Registration/Receptionist: any patient
        if ($user->hasRole('ADMIN.REGISTRATION')) {
            return true;
        }

        // Clinician: only patients in active encounters assigned to them
        if ($this->isClinicalRole($user)) {
            return $patient->encounters()
                ->where('primary_clinician_user_id', $user->id)
                ->whereNull('closed_at')
                ->exists();
        }

        return true;
    }

    public function manageAllergies(User $user, Patient $patient): bool
    {
        return $user->hasPermissionTo('patient.allergies.manage');
    }

    public function manageMedications(User $user, Patient $patient): bool
    {
        return $user->hasPermissionTo('patient.medications.manage');
    }

    public function recordVitals(User $user, Patient $patient): bool
    {
        return $user->hasPermissionTo('patient.vitals.record')
            || $user->hasPermissionTo('emergency.triage.create');
    }

    private function isClinicalRole(User $user): bool
    {
        return $user->hasAnyRole([
            'CLINICAL.PHYSICIAN',
            'CLINICAL.GENERAL',
            'CLINICAL.EMERGENCY',
        ]);
    }
}
```

### 5.3 LaboratoryOrderPolicy.php — Full Implementation

```php
<?php

namespace App\Policies;

use App\Models\User;

class LaboratoryOrderPolicy
{
    public function order(User $user, Patient $patient): bool
    {
        if (! $user->hasPermissionTo('lab.order')) {
            return false;
        }

        // Can only order for patients in active encounter
        return $patient->encounters()
            ->where('primary_clinician_user_id', $user->id)
            ->whereNull('closed_at')
            ->exists();
    }

    public function collectSample(User $user, LabOrder $order): bool
    {
        if (! $user->hasPermissionTo('lab.sample.collect')) {
            return false;
        }

        // Specimen must be pending collection
        if ($order->status !== 'pending') {
            return false;
        }

        // Lab tech/nurse can collect
        return true;
    }

    public function performTest(User $user, LabOrder $order): bool
    {
        if (! $user->hasPermissionTo('lab.test.perform')) {
            return false;
        }

        // Specimen must be collected
        if ($order->status !== 'specimen_collected') {
            return false;
        }

        // Must be assigned to this lab department
        $userDeptId = $user->staffProfile?->department_id;
        if ($order->laboratory_id !== $userDeptId) {
            return false;
        }

        return true;
    }

    public function enterResult(User $user, LabOrder $order): bool
    {
        if (! $user->hasPermissionTo('lab.result.enter')) {
            return false;
        }

        return $order->status === 'test_performed'
            || $order->status === 'specimen_collected';
    }

    public function verifyResult(User $user, LabOrder $order): bool
    {
        if (! $user->hasPermissionTo('lab.result.verify')) {
            return false;
        }

        // Cannot verify own results
        if ($order->performed_by_user_id === $user->id) {
            return false;
        }

        return $order->status === 'result_entered';
    }

    public function releaseResult(User $user, LabOrder $order): bool
    {
        if (! $user->hasPermissionTo('lab.result.release')) {
            return false;
        }

        return $order->status === 'result_verified';
    }

    public function rejectSample(User $user, LabOrder $order): bool
    {
        if (! $user->hasPermissionTo('lab.sample.reject')) {
            return false;
        }

        return $order->status === 'specimen_collected';
    }
}
```

### 5.4 MedicalRecordPolicy.php

```php
<?php

namespace App\Policies;

use App\Models\User;

class MedicalRecordPolicy
{
    public function updateDraft(User $user, MedicalRecord $record): bool
    {
        // Permission: clinical access
        $canClinical = $user->hasPermissionTo('medical.records.read')
            && $user->hasPermissionTo('medical.records.create');

        if (! $canClinical && ! $user->hasPermissionTo('medical.records.update')) {
            return false;
        }

        // Business rules
        if ($record->status !== 'draft') {
            return false;
        }

        // Super admin bypass
        if ($user->hasPermissionTo('medical.records.update')) {
            return true;
        }

        // Author or accepted handoff recipient
        $isAuthor = (int) $record->author_user_id === (int) $user->id;
        $isHandoffRecipient = $record->handoff_status === 'accepted'
            && (int) $record->handed_off_to_user_id === (int) $user->id;

        return $isAuthor || $isHandoffRecipient;
    }
}
```

### 5.5 AppointmentPolicy.php

```php
<?php

namespace App\Policies;

use App\Models\User;

class AppointmentPolicy
{
    public function reschedule(User $user, Appointment $appointment): bool
    {
        if (! $user->hasPermissionTo('appointment.reschedule')) {
            return false;
        }

        // Cannot reschedule completed appointments
        return ! in_array($appointment->status, ['completed', 'cancelled', 'no_show']);
    }

    public function cancel(User $user, Appointment $appointment): bool
    {
        if (! $user->hasPermissionTo('appointment.cancel')) {
            return false;
        }

        // Only future appointments
        return $appointment->start_time->isFuture();
    }

    public function checkIn(User $user, Appointment $appointment): bool
    {
        return $user->hasPermissionTo('appointment.check-in')
            && $appointment->status === 'scheduled';
    }

    public function checkOut(User $user, Appointment $appointment): bool
    {
        return $user->hasPermissionTo('appointment.check-out')
            && $appointment->status === 'checked_in';
    }
}
```

### 5.6 InventoryPolicy.php

```php
<?php

namespace App\Policies;

use App\Models\User;

class InventoryPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasPermissionTo('inventory.admin-manage-access')) {
            return true;
        }
        return null;
    }

    public function createRequisition(User $user, string $targetDepartmentId): bool
    {
        if (! $user->hasPermissionTo('inventory.create-requisition-own-department')) {
            return false;
        }

        $userDeptId = $user->staffProfile?->department_id;

        // Cross-department check
        if ($targetDepartmentId !== $userDeptId) {
            return $user->hasPermissionTo('inventory.create-requisition-cross-department');
        }

        return true;
    }

    public function approveRequisition(User $user, Requisition $requisition): bool
    {
        // SOD: requester cannot approve own request
        if ($requisition->requested_by_user_id === $user->id) {
            return false;
        }

        if (! $user->hasPermissionTo('inventory.approve-requisition-own-department')) {
            return false;
        }

        // High-value threshold
        if ($requisition->total_value > 50000) {
            return $user->hasPermissionTo('inventory.approve-requisition-high-value');
        }

        // Controlled substances
        if ($requisition->hasControlledSubstances()) {
            return $user->hasPermissionTo('inventory.approve-requisition-controlled-substance');
        }

        return true;
    }

    public function viewRequisition(User $user, Requisition $requisition): bool
    {
        if ($user->hasPermissionTo('inventory.view-requisition-department')) {
            $userDeptId = $user->staffProfile?->department_id;
            if ($requisition->department_id === $userDeptId) {
                return true;
            }
        }

        if ($user->hasPermissionTo('inventory.view-requisition-own')) {
            return $requisition->requested_by_user_id === $user->id
                || $requisition->department_id === $user->staffProfile?->department_id;
        }

        return false;
    }
}
```

### 5.7 Policy Registration (AuthServiceProvider.php)

```php
// app/Providers/AuthServiceProvider.php
protected $policies = [
    Patient::class       => PatientPolicy::class,
    MedicalRecord::class => MedicalRecordPolicy::class,
    LabOrder::class      => LaboratoryOrderPolicy::class,
    PharmacyOrder::class => PharmacyOrderPolicy::class,
    RadiologyOrder::class => RadiologyOrderPolicy::class,
    Appointment::class   => AppointmentPolicy::class,
    Invoice::class       => InvoicePolicy::class,
    Requisition::class   => InventoryPolicy::class,
    StaffProfile::class  => StaffProfilePolicy::class,
];
```

### 5.8 EffectivePermissionNameResolver Update

Update `EffectivePermissionNameResolver.php` to include the new composite abilities:

```php
private const RESOLVED_ABILITIES = [
    'appointments.record-triage',
    'appointments.start-consultation',
    'appointments.manage-provider-session',
    'medical.records.draft.update',
    'patient.demographics.update',
    'patient.allergies.manage',
    'patient.medications.manage',
    'patient.vitals.record',
];
```

---

## 6. Cloud-Safe Deployment Strategy

### 6.1 The Core Constraint

Laravel Cloud runs `php artisan migrate --force` on every deploy. No artisan commands, no deploy hooks, no manual steps. The only automation mechanism is migrations.

**Critical runtime behavior:** `Gate::before()` in `AppServiceProvider.php` checks `$user->hasPermissionTo()` which queries the database. If code references a permission string that doesn't exist in the database, the user gets denied.

### 6.2 Two-Phase Safety Pattern

Every permission split follows this pattern:

```
Commit 1 (Migration + Backward-Compat Gate):
  ├── Migration: Inserts new permission strings into DB
  ├── Migration: Copies role assignments from old → new
  └── Code: Adds Gate::define() that checks BOTH new and old

Commit 2 (Code Switch):
  └── Code: Changes authorize() calls to reference new permission
              Safe because backward-compat gate catches users
              still on old permissions.

Commit N (Cleanup):
  └── Code: Removes backward-compat gates
              Only after all roles have been reseeded.
```

### 6.3 Full Deployment Sequence (10 Pushes)

#### Push 1: Permission Rename + New Permission Insertion

**Files:**
- `database/migrations/YYYY_MM_DD_HHMMSS_standardize_permission_names.php`
- `database/migrations/YYYY_MM_DD_HHMMSS_insert_workflow_permissions.php`

**Migration 1 — Rename hyphens to dots:**
```php
class StandardizePermissionNames extends Migration
{
    public function up(): void
    {
        $renames = [
            'laboratory-orders.view-audit-logs' => 'laboratory.orders.audit-logs.view',
            'pharmacy-orders.view-audit-logs'   => 'pharmacy.orders.audit-logs.view',
            'radiology-orders.view-audit-logs'  => 'radiology.orders.audit-logs.view',
            'medical-records.view-audit-logs'   => 'medical.records.audit-logs.view',
            'billing-invoices.view-audit-logs'  => 'billing.invoices.audit-logs.view',
        ];

        foreach ($renames as $old => $new) {
            DB::table('permissions')
                ->where('name', $old)
                ->update(['name' => $new]);
        }
    }

    public function down(): void
    {
        $renames = [
            'laboratory.orders.audit-logs.view' => 'laboratory-orders.view-audit-logs',
            // ... reverse map
        ];

        foreach ($renames as $old => $new) {
            DB::table('permissions')->where('name', $old)->update(['name' => $new]);
        }
    }
}
```

**Migration 2 — Insert all new workflow permissions:**
```php
class InsertWorkflowPermissions extends Migration
{
    public function up(): void
    {
        $newPermissions = [
            // Laboratory
            'lab.order', 'lab.sample.collect', 'lab.sample.reject',
            'lab.test.perform', 'lab.result.enter', 'lab.result.verify',
            'lab.result.release',

            // Pharmacy
            'medication.prescribe', 'medication.dispense', 'dispense.cancel',

            // Radiology
            'imaging.order', 'imaging.perform',
            'imaging.result.enter', 'imaging.result.verify',

            // Patients
            'patient.demographics.update', 'patient.allergies.manage',
            'patient.medications.manage', 'patient.vitals.record',

            // Appointments
            'appointment.reschedule', 'appointment.cancel',
            'appointment.check-in', 'appointment.check-out',

            // Staff
            'staff.employment.update', 'staff.status.update',
        ];

        foreach ($newPermissions as $name) {
            DB::table('permissions')->updateOrInsert(
                ['name' => $name],
                ['guard_name' => 'web', 'created_at' => now(), 'updated_at' => now()],
            );
        }

        // Copy role assignments from old broad permissions to new granular ones
        $this->copyRoleAssignments(
            'laboratory.orders.create',
            ['CLINICAL.PHYSICIAN' => ['lab.order'],
             'CLINICAL.GENERAL'   => ['lab.order'],
             'CLINICAL.EMERGENCY' => ['lab.order'],
             'LAB.STAFF'          => ['lab.sample.collect', 'lab.test.perform', 'lab.result.enter']],
        );

        $this->copyRoleAssignments(
            'laboratory.orders.update-status',
            ['LAB.STAFF'        => ['lab.result.enter', 'lab.sample.reject'],
             'LAB.SUPERVISOR'   => ['lab.result.verify', 'lab.result.release']],
        );

        // Same pattern for pharmacy, radiology, patients, appointments, staff
    }

    private function copyRoleAssignments(string $sourcePermission, array $rolePermMap): void
    {
        foreach ($rolePermMap as $roleCode => $targetPerms) {
            $roleId = DB::table('roles')->where('code', $roleCode)->value('id');
            if (! $roleId) continue;

            foreach ($targetPerms as $targetPerm) {
                $permId = DB::table('permissions')->where('name', $targetPerm)->value('id');
                if (! $permId) continue;

                DB::table('permission_role')->updateOrInsert(
                    ['permission_id' => $permId, 'role_id' => $roleId],
                );
            }
        }
    }
}
```

**Verification after Push 1:**
- `SELECT count(*) FROM permissions WHERE name LIKE '%-%'` returns 0
- Clinicians with `laboratory.orders.create` still have `lab.order` assigned (migration copied it)
- New permissions exist in DB but code is not yet checking them — no behavior change

---

#### Push 2: Backward-Compat Gates + Naming Standardization in Code

**Files modified:**
- `app/Providers/AppServiceProvider.php` — add backward-compat gates
- `app/Support/Auth/EffectivePermissionNameResolver.php` — update gate names

**AppServiceProvider additions (backward-compat gates):**
```php
// ── Laboratory ──
Gate::define('lab.order', function ($user) {
    return $user->hasPermissionTo('lab.order')
        || $user->hasPermissionTo('laboratory.orders.create');
});
Gate::define('lab.sample.collect', function ($user) {
    return $user->hasPermissionTo('lab.sample.collect')
        || $user->hasPermissionTo('laboratory.orders.create');
});
Gate::define('lab.test.perform', function ($user) {
    return $user->hasPermissionTo('lab.test.perform')
        || $user->hasPermissionTo('laboratory.orders.create');
});
Gate::define('lab.result.enter', function ($user) {
    return $user->hasPermissionTo('lab.result.enter')
        || $user->hasPermissionTo('laboratory.orders.update-status');
});
Gate::define('lab.result.verify', function ($user) {
    return $user->hasPermissionTo('lab.result.verify')
        || $user->hasPermissionTo('laboratory.orders.verify-result');
});
Gate::define('lab.result.release', function ($user) {
    return $user->hasPermissionTo('lab.result.release')
        || $user->hasPermissionTo('laboratory.orders.update-status');
});
Gate::define('lab.sample.reject', function ($user) {
    return $user->hasPermissionTo('lab.sample.reject')
        || $user->hasPermissionTo('laboratory.orders.update-status');
});

// ── Pharmacy ──
Gate::define('medication.prescribe', function ($user) {
    return $user->hasPermissionTo('medication.prescribe')
        || $user->hasPermissionTo('pharmacy.orders.create');
});
Gate::define('medication.dispense', function ($user) {
    return $user->hasPermissionTo('medication.dispense')
        || $user->hasPermissionTo('pharmacy.orders.create')
        || $user->hasPermissionTo('pharmacy.orders.update-status');
});
Gate::define('dispense.cancel', function ($user) {
    return $user->hasPermissionTo('dispense.cancel')
        || $user->hasPermissionTo('pharmacy.orders.update-status');
});

// ── Radiology ──
Gate::define('imaging.order', function ($user) {
    return $user->hasPermissionTo('imaging.order')
        || $user->hasPermissionTo('radiology.orders.create');
});
Gate::define('imaging.perform', function ($user) {
    return $user->hasPermissionTo('imaging.perform')
        || $user->hasPermissionTo('radiology.orders.create');
});
Gate::define('imaging.result.enter', function ($user) {
    return $user->hasPermissionTo('imaging.result.enter')
        || $user->hasPermissionTo('radiology.orders.update-status');
});
Gate::define('imaging.result.verify', function ($user) {
    return $user->hasPermissionTo('imaging.result.verify')
        || $user->hasPermissionTo('radiology.orders.update-status');
});

// ── Patients ──
Gate::define('patient.demographics.update', function ($user) {
    return $user->hasPermissionTo('patient.demographics.update')
        || $user->hasPermissionTo('patients.update');
});
Gate::define('patient.allergies.manage', function ($user) {
    return $user->hasPermissionTo('patient.allergies.manage')
        || $user->hasPermissionTo('patients.update');
});
Gate::define('patient.medications.manage', function ($user) {
    return $user->hasPermissionTo('patient.medications.manage')
        || $user->hasPermissionTo('patients.update');
});
Gate::define('patient.vitals.record', function ($user) {
    return $user->hasPermissionTo('patient.vitals.record')
        || $user->hasPermissionTo('patients.update')
        || $user->hasPermissionTo('emergency.triage.create')
        || $user->hasPermissionTo('emergency.triage.update-status');
});

// ── Appointments ──
Gate::define('appointment.reschedule', function ($user) {
    return $user->hasPermissionTo('appointment.reschedule')
        || $user->hasPermissionTo('appointments.update');
});
Gate::define('appointment.cancel', function ($user) {
    return $user->hasPermissionTo('appointment.cancel')
        || $user->hasPermissionTo('appointments.update');
});
Gate::define('appointment.check-in', function ($user) {
    return $user->hasPermissionTo('appointment.check-in')
        || $user->hasPermissionTo('appointments.update-status');
});
Gate::define('appointment.check-out', function ($user) {
    return $user->hasPermissionTo('appointment.check-out')
        || $user->hasPermissionTo('appointments.update-status');
});

// ── Staff ──
Gate::define('staff.employment.update', function ($user) {
    return $user->hasPermissionTo('staff.employment.update')
        || $user->hasPermissionTo('staff.update');
});
Gate::define('staff.status.update', function ($user) {
    return $user->hasPermissionTo('staff.status.update')
        || $user->hasPermissionTo('staff.update');
});
```

**EffectivePermissionNameResolver update:**
```php
private const RESOLVED_ABILITIES = [
    'appointments.record-triage',
    'appointments.start-consultation',
    'appointments.manage-provider-session',
    'medical.records.draft.update',
    'patient.demographics.update',
    'patient.allergies.manage',
    'patient.medications.manage',
    'patient.vitals.record',
    'lab.order',
    'lab.sample.collect',
    'lab.test.perform',
    'lab.result.enter',
    'lab.result.verify',
    'lab.result.release',
    'medication.prescribe',
    'medication.dispense',
    'imaging.order',
    'imaging.perform',
    'imaging.result.enter',
    'appointment.reschedule',
    'appointment.cancel',
    'appointment.check-in',
    'appointment.check-out',
];
```

**Verification after Push 2:**
- `$user->can('patient.demographics.update')` returns true for any user who had `patients.update`
- Backward-compat gates work — no change in user-facing behavior
- New code can reference new permission names safely

---

#### Push 3: Switch Routes and FormRequests to New Permissions

**Files modified:**
- `routes/api.php` — update all `can:` middleware strings
- All FormRequest `authorize()` methods
- All controller `$this->authorize()` / `$user->can()` calls

**Example — Patients routes:**
```php
// Before
Route::patch('patients/{id}', [PatientController::class, 'update'])
    ->middleware(['auth', 'verified', 'can:patients.update', 'facility.entitlement:patients.demographics']);

// After
Route::patch('patients/{id}', [PatientController::class, 'update'])
    ->middleware(['auth', 'verified', 'can:patient.demographics.update', 'facility.entitlement:patients.demographics']);

Route::post('patients/{id}/allergies', [PatientMedicationSafetyController::class, 'storeAllergy'])
    ->middleware(['auth', 'verified', 'can:patient.allergies.manage', 'facility.entitlement:patients.demographics']);

Route::post('patients/{id}/medication-profile', [PatientMedicationSafetyController::class, 'storeMedicationProfile'])
    ->middleware(['auth', 'verified', 'can:patient.medications.manage', 'facility.entitlement:patients.demographics']);
```

**Example — FormRequest update:**
```php
// app/Modules/Patient/Presentation/Http/Requests/UpdatePatientRequest.php
public function authorize(): bool
{
    return $this->user()?->can('patient.demographics.update') ?? false;
}
```

**Example — Lab routes:**
```php
// Before
Route::post('laboratory/orders', [LabOrderController::class, 'store'])
    ->middleware('can:laboratory.orders.create');

// After — clinician route
Route::post('laboratory/orders', [LabOrderController::class, 'store'])
    ->middleware('can:lab.order');

// After — lab tech collection route
Route::patch('laboratory/orders/{id}/collect', [LabOrderController::class, 'collectSample'])
    ->middleware('can:lab.sample.collect');

Route::patch('laboratory/orders/{id}/perform', [LabOrderController::class, 'performTest'])
    ->middleware('can:lab.test.perform');

Route::patch('laboratory/orders/{id}/enter-result', [LabOrderController::class, 'enterResult'])
    ->middleware('can:lab.result.enter');

Route::patch('laboratory/orders/{id}/verify-result', [LabOrderController::class, 'verifyResult'])
    ->middleware('can:lab.result.verify');

Route::patch('laboratory/orders/{id}/release-result', [LabOrderController::class, 'releaseResult'])
    ->middleware('can:lab.result.release');
```

**Verification after Push 3:**
- User-facing behavior is identical (backward-compat gates catch old permission names)
- Code now references new permission names everywhere
- Old permission strings (`patients.update`, `laboratory.orders.create`) are no longer checked in code

---

#### Push 4: Policy Files (Empty → Returning True)

**Files created:**
- `app/Policies/PatientPolicy.php`
- `app/Policies/MedicalRecordPolicy.php`
- `app/Policies/LaboratoryOrderPolicy.php`
- `app/Policies/PharmacyOrderPolicy.php`
- `app/Policies/RadiologyOrderPolicy.php`
- `app/Policies/AppointmentPolicy.php`
- `app/Policies/InventoryPolicy.php`

**Files modified:**
- `app/Providers/AuthServiceProvider.php` — register policies

All policy methods initially return `true` — no business rules enforced yet. This ensures the policy layer can be deployed without breaking anything.

```php
// Initial state — all methods return true
class PatientPolicy
{
    public function view(User $user, Patient $patient): bool { return true; }
    public function updateDemographics(User $user, Patient $patient): bool { return true; }
    public function manageAllergies(User $user, Patient $patient): bool { return true; }
    public function manageMedications(User $user, Patient $patient): bool { return true; }
    public function recordVitals(User $user, Patient $patient): bool { return true; }
}
```

**Verification after Push 4:**
- Policies are registered and called
- All policies return true — no behavior change
- `app/Policies/` directory exists and is loaded

---

#### Push 5: Switch Controllers to Use Policy Authorization

Replace raw `$user->can()` calls with `$this->authorize()` calls that invoke policies.

```php
// Before (controller)
public function update(string $id, UpdatePatientRequest $request): JsonResponse
{
    // authorize() not called — FormRequest handles permission check
    // ... update logic
}

// After (controller)
public function update(string $id, UpdatePatientRequest $request): JsonResponse
{
    $patient = $this->patientRepository->findById($id);
    if (! $patient) {
        return response()->json(['message' => 'Patient not found.'], 404);
    }

    $this->authorize('updateDemographics', $patient);
    // ... update logic
}
```

```php
// Before (LabOrderController)
public function performTest(string $orderId, PerformTestRequest $request): JsonResponse
{
    $order = $this->labOrderRepository->findById($orderId);
    // ... perform logic
}

// After
public function performTest(string $orderId, PerformTestRequest $request): JsonResponse
{
    $order = $this->labOrderRepository->findById($orderId);
    if (! $order) {
        return response()->json(['message' => 'Order not found.'], 404);
    }

    $this->authorize('performTest', $order);
    // ... perform logic
}
```

**Note:** The route middleware `can:lab.test.perform` still fires first (Layer 2 — permission). The policy `performTest()` fires second (Layer 3 — context). Both are defense in depth.

**Verification after Push 5:**
- All protected actions call `$this->authorize()` through policies
- Policies return true — no behavior change yet
- Route middleware still provides Layer 2 permission enforcement

---

#### Push 6: Add Business Logic to Policies

This push turns on real context-aware authorization.

```php
// PatientPolicy.php — full implementation
public function updateDemographics(User $user, Patient $patient): bool
{
    if (! $user->hasPermissionTo('patient.demographics.update')) {
        return false;
    }

    // Registration: any patient
    if ($user->hasRole('ADMIN.REGISTRATION')) {
        return true;
    }

    // Clinical roles: only patients in active encounter
    if ($this->isClinicalRole($user)) {
        return $patient->encounters()
            ->where('primary_clinician_user_id', $user->id)
            ->whereNull('closed_at')
            ->exists();
    }

    return true;
}
```

**IMPORTANT:** Test each policy method thoroughly before deploying. A mistake here can lock users out of critical workflows.

**Recommended rollout:**
```
Push 6a: PatientPolicy only (test with one department)
Push 6b: LaboratoryOrderPolicy + PharmacyOrderPolicy
Push 6c: RadiologyOrderPolicy + AppointmentPolicy
Push 6d: InventoryPolicy (this is the most complex)
Push 6e: MedicalRecordPolicy + remaining
```

---

#### Push 7: Eliminate Dual Inventory RBAC Path

**Files modified:**
- `app/Support/Auth/DepartmentScopedPermissionResolver.php` — remove hardcoded matrix
- `bootstrap/app.php` — remove `inventory.access` middleware alias (optional, can be deferred)
- `app/Http/Middleware/InventoryAccessMiddleware.php` — deprecate

**New implementation:**
```php
class DepartmentScopedPermissionResolver
{
    public function hasPermissionInDepartment(
        User $user,
        string $permission,
        ?string $departmentId = null
    ): bool {
        // Standard check (covers super admin bypass)
        if ($user->hasPermissionTo($permission)) {
            return true;
        }

        // Department-scoped role check
        $query = $user->inventoryAccessRoles()->active()->notExpired();
        if ($departmentId) {
            $query->forDepartment($departmentId);
        }

        return $query->whereHas('permissions', fn($q) =>
            $q->where('name', $permission)
        )->exists();
    }
}
```

This eliminates the hardcoded matrix. The permission assignment is now driven entirely by the `permission_role` table — seeded by `RoleHierarchySeeder` or the config file.

**Verification after Push 7:**
- Inventory routes still enforce department scope
- Permission check is now data-driven, not hardcoded
- `inventory.access` middleware still works (still delegates to resolver)
- Old matrix code is removed — no dual maintenance

---

#### Push 8: Config-Driven Role Definition

**Files created:**
- `config/roles.php` — centralized role definitions

**Files modified:**
- `database/seeders/RoleHierarchySeeder.php` — read from config
- `routes/console.php` — update seeding commands to use config

**config/roles.php structure:**
```php
<?php

return [
    'clinical-officer' => [
        'code' => 'CLINICAL.GENERAL',
        'name' => 'Clinical Officer',
        'description' => 'Diploma-level clinician. Main clinical staff at dispensaries and health centres.',
        'access_level' => 'request',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            // Module access
            'patients.read', 'patients.create',
            'appointments.read', 'appointments.create',
            'admissions.read',
            'medical.records.read', 'medical.records.create',
            'laboratory.access',
            'pharmacy.access',

            // Workflow actions
            'patient.demographics.update',
            'patient.medications.manage',
            'patient.vitals.record',
            'medical.records.draft.update',
            'medical.records.finalize',
            'medical.records.amend',
            'lab.order',
            'medication.prescribe',
            'imaging.order',
        ],
    ],

    'medical-officer' => [
        'code' => 'CLINICAL.PHYSICIAN',
        'name' => 'Medical Officer',
        'description' => 'Medical degree holder. Works at hospitals and health centres.',
        'access_level' => 'manage',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            // Inherits Clinical Officer perms
            'patients.read', 'patients.create',
            'appointments.read', 'appointments.create',
            'admissions.read', 'admissions.create',
            'medical.records.read', 'medical.records.create',
            'laboratory.access', 'pharmacy.access',
            'patient.demographics.update',
            'patient.allergies.manage',
            'patient.medications.manage',
            'patient.vitals.record',
            'medical.records.draft.update',
            'medical.records.finalize',
            'medical.records.amend',
            'medical.records.attest',
            'lab.order',
            'medication.prescribe',
            'imaging.order',

            // Additional
            'procedure.order',
            'admissions.update-status',
            'discharge.approve',
        ],
    ],

    'surgeon' => [
        'code' => 'CLINICAL.SURGEON',
        'name' => 'Surgeon',
        'description' => 'Surgical specialist. Performs operations and post-op care.',
        'access_level' => 'manage',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            // Inherits Medical Officer
            'theatre.procedures.read',
            'theatre.procedures.create',
            'theatre.procedures.update-status',
        ],
    ],

    'nurse-officer' => [
        'code' => 'CLINICAL.NURSE',
        'name' => 'Nurse Officer',
        'description' => 'Registered Nurse. Provides bedside care, medication administration, patient monitoring.',
        'access_level' => 'request',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            'patients.read',
            'appointments.read',
            'admissions.read',
            'medical.records.read',
            'inpatient.ward.read',
            'inpatient.ward.create-task',
            'inpatient.ward.update-task-status',
            'inpatient.ward.create-care-plan',
            'inpatient.ward.update-care-plan',
            'patient.vitals.record',
            'lab.sample.collect',
            'service.requests.create',
            'service.requests.read',
        ],
    ],

    'nurse-midwife' => [
        'code' => 'CLINICAL.NURSE.MIDWIFE',
        'name' => 'Nurse Midwife',
        'description' => 'Specialised in maternal and child health. Antenatal, delivery, postnatal care.',
        'access_level' => 'request',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            'patients.read', 'patients.create',
            'appointments.read', 'appointments.create',
            'medical.records.read', 'medical.records.create',
            'patient.demographics.update',
            'patient.vitals.record',
            'medical.records.draft.update',
            'medical.records.finalize',
            'lab.sample.collect',
        ],
    ],

    'lab-technologist' => [
        'code' => 'LAB.STAFF',
        'name' => 'Laboratory Technologist',
        'description' => 'Performs lab tests, enters results. Cannot order tests.',
        'access_level' => 'request',
        'scope_type' => 'department',
        'is_system' => true,
        'permissions' => [
            'laboratory.access',
            'laboratory.orders.read',
            'lab.sample.collect',
            'lab.sample.reject',
            'lab.test.perform',
            'lab.result.enter',
        ],
    ],

    'lab-supervisor' => [
        'code' => 'LAB.SUPERVISOR',
        'name' => 'Chief Laboratory Technologist',
        'description' => 'Supervises lab staff. Verifies and releases results.',
        'access_level' => 'approve',
        'scope_type' => 'department',
        'is_system' => true,
        'permissions' => [
            // Inherits Lab Technologist
            'lab.result.verify',
            'lab.result.release',
            'laboratory.orders.audit-logs.view',
        ],
    ],

    'pharmacist' => [
        'code' => 'PHARMACY.SUPERVISOR',
        'name' => 'Pharmacist-in-Charge',
        'description' => 'Degree pharmacist. Verifies prescriptions, manages pharmacy.',
        'access_level' => 'approve',
        'scope_type' => 'department',
        'is_system' => true,
        'permissions' => [
            'pharmacy.access',
            'pharmacy.orders.read',
            'pharmacy.orders.verify-dispense',
            'pharmacy.orders.manage-policy',
            'pharmacy.orders.reconcile',
            'medication.dispense',
            'dispense.cancel',
            'pharmacy.orders.audit-logs.view',
        ],
    ],

    'dispenser' => [
        'code' => 'PHARMACY.STAFF',
        'name' => 'Dispenser',
        'description' => 'Diploma pharmaceutical technician. Dispenses medications under supervision.',
        'access_level' => 'request',
        'scope_type' => 'department',
        'is_system' => true,
        'permissions' => [
            'pharmacy.access',
            'pharmacy.orders.read',
            'medication.dispense',
        ],
    ],

    'radiographer' => [
        'code' => 'RADIOLOGY.STAFF',
        'name' => 'Radiographer',
        'description' => 'Performs X-ray and imaging procedures.',
        'access_level' => 'request',
        'scope_type' => 'department',
        'is_system' => true,
        'permissions' => [
            'imaging.access',
            'imaging.perform',
            'imaging.result.enter',
        ],
    ],

    'cashier' => [
        'code' => 'FINANCE.CASHIER',
        'name' => 'Cashier',
        'description' => 'Receives payments, issues receipts, manages daily cash.',
        'access_level' => 'request',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            'patients.read',
            'billing.access',
            'billing.invoices.read',
            'billing.payments.record',
            'billing.payments.view-history',
            'billing.refunds.create',
            'billing.refunds.read',
            'pos.registers.read',
            'pos.sessions.read',
            'pos.sales.read',
            'pos.sales.create',
        ],
    ],

    'receptionist' => [
        'code' => 'ADMIN.REGISTRATION',
        'name' => 'Health Records Officer',
        'description' => 'Manages patient registration, appointments, front desk.',
        'access_level' => 'request',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            'patients.read', 'patients.create',
            'patient.demographics.update',
            'appointments.read', 'appointments.create',
            'appointment.reschedule', 'appointment.cancel',
            'appointment.check-in',
            'service.requests.create',
            'service.requests.read',
        ],
    ],

    'hospital-admin' => [
        'code' => 'ADMIN.FACILITY',
        'name' => 'Hospital Administrator',
        'description' => 'Manages facility operations, staffing, and administration.',
        'access_level' => 'manage',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            // Full read on all modules
            'patients.read', 'patients.create', 'patient.demographics.update',
            'patients.update-status',
            'appointments.read', 'appointments.create', 'appointments.update',
            'medical.records.read', 'medical.records.archive',
            'admissions.read', 'admissions.create', 'admissions.update',
            'laboratory.access',
            'pharmacy.access',
            'imaging.access',

            // Staff management
            'staff.read', 'staff.create', 'staff.update',
            'staff.employment.update', 'staff.status.update',
            'staff.documents.read', 'staff.documents.create',
            'staff.documents.verify',
            'staff.credentialing.read', 'staff.credentialing.verify',

            // Admin
            'departments.read', 'departments.create', 'departments.update',
            'platform.clinical-catalog.read',
            'platform.resources.read',
            'inventory.procurement.read',
        ],
    ],

    'nutritionist' => [
        'code' => 'ALLIED.NUTRITIONIST',
        'name' => 'Nutritionist',
        'description' => 'Manages therapeutic feeding, malnutrition, and dietary counseling.',
        'access_level' => 'request',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            'patients.read',
            'medical.records.read',
            'medical.records.create',
            'medical.records.draft.update',
        ],
    ],

    'counselor' => [
        'code' => 'ALLIED.COUNSELOR',
        'name' => 'Counselor',
        'description' => 'Provides HIV testing counseling, adherence support, psychosocial support.',
        'access_level' => 'request',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            'patients.read',
            'medical.records.read',
            'medical.records.create',
            'medical.records.draft.update',
        ],
    ],

    'community-health-worker' => [
        'code' => 'ALLIED.COMMUNITY.HEALTH.WORKER',
        'name' => 'Community Health Worker',
        'description' => 'Conducts home visits, defaulter tracing, health education, and outreach.',
        'access_level' => 'view',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            'patients.read',
            'patients.create',
            'appointments.read',
        ],
    ],

    'medical-attendant' => [
        'code' => 'SUPPORT.MEDICAL.ATTENDANT',
        'name' => 'Medical Attendant',
        'description' => 'Patient hygiene, bed-making, linen, cleaning, basic patient care.',
        'access_level' => 'view',
        'scope_type' => 'facility',
        'is_system' => true,
        'permissions' => [
            'inpatient.ward.read',
            'inpatient.ward.create-task',
            'inpatient.ward.update-task-status',
        ],
    ],
];
```

**Migration to sync roles from config:**
```php
class SyncRolesFromConfig extends Migration
{
    public function up(): void
    {
        $roles = config('roles');

        foreach ($roles as $roleKey => $roleDef) {
            $perms = $roleDef['permissions'];
            unset($roleDef['permissions']);

            $roleId = DB::table('roles')->updateOrInsert(
                ['code' => $roleDef['code']],
                array_merge($roleDef, [
                    'updated_at' => now(),
                    'status' => 'active',
                ]),
            );

            $roleId = DB::table('roles')->where('code', $roleDef['code'])->value('id');
            if (! $roleId) continue;

            // Get all permission IDs
            $permIds = DB::table('permissions')
                ->whereIn('name', $perms)
                ->pluck('id');

            // Remove permissions no longer in the role definition
            DB::table('permission_role')
                ->where('role_id', $roleId)
                ->whereNotIn('permission_id', $permIds)
                ->delete();

            // Add/keep current permissions
            foreach ($permIds as $permId) {
                DB::table('permission_role')->updateOrInsert(
                    ['permission_id' => $permId, 'role_id' => $roleId],
                );
            }
        }
    }

    public function down(): void
    {
        // Cannot reliably reverse — roles should be re-seeded
    }
}
```

---

#### Push 9: Tanzania Role Name Updates

**Files:**
- `database/migrations/YYYY_MM_DD_HHMMSS_update_role_names_to_tanzania_cadres.php`
- `database/migrations/YYYY_MM_DD_HHMMSS_insert_missing_tanzania_roles.php`

**Migration — rename roles:**
```php
class UpdateRoleNamesToTanzaniaCadres extends Migration
{
    public function up(): void
    {
        $nameUpdates = [
            'ADMIN.REGISTRATION'     => 'Health Records Officer',
            'ADMIN.MEDICAL.RECORDS'  => 'Health Records Officer-in-Charge',
            'CLINICAL.PHYSICIAN'     => 'Medical Officer',
            'CLINICAL.GENERAL'       => 'Clinical Officer',
            'CLINICAL.NURSE'         => 'Nurse Officer',
            'CLINICAL.EMERGENCY'     => 'Casualty Nurse',
            'FINANCE.OFFICER'        => 'Accountant',
            'FINANCE.CONTROLLER'     => 'Finance Manager',
            'FINANCE.CLAIMS'         => 'Insurance Claims Officer',
            'LAB.STAFF'              => 'Laboratory Technologist',
            'LAB.SUPERVISOR'         => 'Chief Laboratory Technologist',
            'LAB.MANAGER'            => 'Laboratory Manager',
            'RADIOLOGY.STAFF'        => 'Radiographer',
            'RADIOLOGY.SUPERVISOR'  => 'Senior Radiographer',
            'RADIOLOGY.MANAGER'     => 'Radiology Manager',
            'PHARMACY.STAFF'         => 'Dispenser',
            'PHARMACY.SUPERVISOR'    => 'Pharmacist-in-Charge',
            'PHARMACY.MANAGER'       => 'Chief Pharmacist',
            'THEATRE.STAFF'          => 'Theatre Nurse',
            'THEATRE.SUPERVISOR'     => 'Theatre Nurse-in-Charge',
            'THEATRE.MANAGER'        => 'Theatre Manager',
            'INVENTORY.STAFF'        => 'Storekeeper',
            'INVENTORY.SUPERVISOR'   => 'Senior Storekeeper',
            'INVENTORY.MANAGER'      => 'Procurement Officer',
        ];

        foreach ($nameUpdates as $code => $name) {
            DB::table('roles')->where('code', $code)->update(['name' => $name]);
        }
    }
}
```

**Migration — insert missing roles:**
```php
class InsertMissingTanzaniaRoles extends Migration
{
    public function up(): void
    {
        $roles = config('roles');

        // Only insert roles whose code starts with new/added ones
        $missingCodes = [
            'CLINICAL.NURSE.MIDWIFE',
            'CLINICAL.DENTAL.OFFICER',
            'CLINICAL.SURGEON',
            'ALLIED.NUTRITIONIST',
            'ALLIED.COUNSELOR',
            'ALLIED.COMMUNITY.HEALTH.WORKER',
            'SUPPORT.MEDICAL.ATTENDANT',
            'SUPPORT.HEALTH.SECRETARY',
        ];

        foreach ($missingCodes as $code) {
            $roleDef = collect($roles)->firstWhere('code', $code);
            if (! $roleDef) continue;

            $perms = $roleDef['permissions'];
            unset($roleDef['permissions']);

            DB::table('roles')->updateOrInsert(
                ['code' => $code],
                array_merge($roleDef, ['created_at' => now(), 'updated_at' => now()]),
            );

            $roleId = DB::table('roles')->where('code', $code)->value('id');
            $permIds = DB::table('permissions')->whereIn('name', $perms)->pluck('id');

            foreach ($permIds as $permId) {
                DB::table('permission_role')->updateOrInsert(
                    ['permission_id' => $permId, 'role_id' => $roleId],
                );
            }
        }
    }
}
```

---

#### Push 10: Remove Backward-Compat Gates + Cleanup

**Files modified:**
- `app/Providers/AppServiceProvider.php` — remove all backward-compat gates from Push 2

**What gets removed:**
```php
// These are all deleted:
Gate::define('patient.demographics.update', ...);   // old fallback is gone
Gate::define('lab.order', ...);                       // old fallback is gone
Gate::define('medication.prescribe', ...);            // old fallback is gone
// etc. — every backward-compat gate
```

At this point, all roles have been reseeded with new permissions. Users who somehow still have only `patients.update` (without `patient.demographics.update`) will be denied. This is intentional — the migration in Push 1 already copied the assignments.

**Also in this push:**
- Remove old `laboratory-orders.view-audit-logs` style references from any remaining code comments or dead code
- Remove unused old permission strings from any remaining helper arrays

---

## 7. Complete File Manifest

### Files to Create

| File | Push | Purpose |
|------|------|---------|
| `database/migrations/YYYY_MM_DD_HHMMSS_standardize_permission_names.php` | 1 | Rename hyphens to dots in permission strings |
| `database/migrations/YYYY_MM_DD_HHMMSS_insert_workflow_permissions.php` | 1 | Insert all new workflow-split permissions; copy role assignments |
| `app/Policies/PatientPolicy.php` | 4 | Patient context rules (initially returns true) |
| `app/Policies/MedicalRecordPolicy.php` | 4 | Medical record draft/handoff rules |
| `app/Policies/LaboratoryOrderPolicy.php` | 4 | Lab order workflow + specimen ownership |
| `app/Policies/PharmacyOrderPolicy.php` | 4 | Pharmacy order context |
| `app/Policies/RadiologyOrderPolicy.php` | 4 | Radiology order context |
| `app/Policies/AppointmentPolicy.php` | 4 | Appointment ownership + status transitions |
| `app/Policies/InventoryPolicy.php` | 4 | Inventory department scoping + SOD |
| `config/roles.php` | 8 | Centralized role definitions |
| `database/migrations/YYYY_MM_DD_HHMMSS_sync_roles_from_config.php` | 8 | Idempotent role-permission sync from config |
| `database/migrations/YYYY_MM_DD_HHMMSS_update_role_names_to_tanzania_cadres.php` | 9 | Rename role display names |
| `database/migrations/YYYY_MM_DD_HHMMSS_insert_missing_tanzania_roles.php` | 9 | Insert new Tanzania cadre roles |

### Files to Modify

| File | Push | What Changes |
|------|------|--------------|
| `app/Providers/AppServiceProvider.php` | 2, 6, 10 | Add backward-compat gates; add business rules; remove backward-compat gates |
| `app/Support/Auth/EffectivePermissionNameResolver.php` | 2 | Add new composite abilities to `RESOLVED_ABILITIES` |
| `routes/api.php` | 3 | All `can:` middleware → new permission names |
| All FormRequest `authorize()` methods | 3 | Check new permission names |
| All controller `$this->authorize()` / `$user->can()` | 3, 5 | Use new permission names; switch to policy methods |
| `app/Providers/AuthServiceProvider.php` | 4 | Register all policy classes |
| `app/Support/Auth/DepartmentScopedPermissionResolver.php` | 7 | Remove hardcoded matrix; use DB lookup |
| `bootstrap/app.php` | 7 | Remove `inventory.access` alias (optional, can defer) |
| `app/Http/Middleware/InventoryAccessMiddleware.php` | 7 | Deprecate (remove from kernel) |
| `database/seeders/RoleHierarchySeeder.php` | 8 | Read from `config/roles.php` |
| `routes/console.php` | 8 | Update seeding commands to use config |
| `app/Http/Middleware/InventoryAccessMiddleware.php` | 10 | Remove (cleanup) |
| Frontend `*.vue` files | 3 | Update `hasPermission()` calls to new names |

---

## 8. Role Definitions: config/roles.php (Full File)

See Section 6.3 Push 8 for the complete `config/roles.php` file content. It defines every role with:
- Internal code
- Tanzania MOH cadre name
- Description of the role
- Access level (view/request/approve/manage)
- Scope type (facility/department)
- Complete list of workflow permissions

---

## 9. Migration Scripts

All migration scripts are defined inline in Section 6.3 under their respective Push number. Each migration is:
- **Idempotent** — can be run multiple times safely
- **Self-contained** — does not depend on code changes in the same push
- **Reversible** — has a `down()` method (except the config sync — that is intentionally one-directional)

---

## 10. Verification Checklist

### After Each Push

| Push | Verification |
|------|--------------|
| 1 | `SELECT count(*) FROM permissions WHERE name LIKE '%-%'` = 0; All new perms exist; Clinician with `laboratory.orders.create` now also has `lab.order` |
| 2 | `$user->can('patient.demographics.update')` returns true for user with `patients.update`; `$user->can('lab.order')` returns true for clinician |
| 3 | All routes load without 403; FormRequests pass for users with correct roles; Backward-compat gates ensure no regressions |
| 4 | `app/Policies/PatientPolicy.php` exists; policy returns true for all users; AuthServiceProvider registers it |
| 5 | Controllers call `$this->authorize()` through policies; same behavior as before (policies return true) |
| 6 | Doctor can edit demographics on today's patient only; Lab tech cannot verify own results; Pharmacist cannot cancel dispense without supervisor role |
| 7 | Inventory routes still enforce department scope; Missing permission returns 403 correctly |
| 8 | New role gets exactly the permissions defined in config; Old roles retain their permissions |
| 9 | Role `name` shows "Medical Officer" instead of "Clinical Physician"; New Tanzania roles appear |
| 10 | Users with only `patients.update` get denied (must have `patient.demographics.update`); No broken 403s in normal workflow |

### Integration Test Scenarios

These scenarios must be tested as automated tests before each production push:

```php
/** @test */
public function medical_officer_can_order_lab_test_but_not_perform_it(): void
{
    $mo = User::factory()->create();
    $mo->assignRole('CLINICAL.PHYSICIAN');
    $order = LabOrder::factory()->create();

    $this->assertTrue($mo->can('lab.order'));
    $this->assertFalse($mo->can('lab.test.perform'));
    $this->assertFalse($mo->can('lab.result.enter'));
}

/** @test */
public function lab_technologist_can_perform_test_but_not_order_it(): void
{
    $tech = User::factory()->create();
    $tech->assignRole('LAB.STAFF');

    $this->assertFalse($tech->can('lab.order'));
    $this->assertTrue($tech->can('lab.test.perform'));
    $this->assertTrue($tech->can('lab.result.enter'));
}

/** @test */
public function lab_supervisor_can_verify_result_but_technologist_cannot(): void
{
    $tech = User::factory()->create();
    $tech->assignRole('LAB.STAFF');
    $supervisor = User::factory()->create();
    $supervisor->assignRole('LAB.SUPERVISOR');

    $this->assertFalse($tech->can('lab.result.verify'));
    $this->assertTrue($supervisor->can('lab.result.verify'));
}

/** @test */
public function clinician_cannot_verify_own_lab_results(): void
{
    $clinician = User::factory()->create();
    $clinician->assignRole('LAB.SUPERVISOR');
    $order = LabOrder::factory()->create([
        'performed_by_user_id' => $clinician->id,
        'status' => 'result_entered',
    ]);

    $this->assertFalse($clinician->can('lab.result.verify', $order));
}

/** @test */
public function receptionist_can_update_demographics_for_any_patient(): void
{
    $receptionist = User::factory()->create();
    $receptionist->assignRole('ADMIN.REGISTRATION');
    $patient = Patient::factory()->create();

    $this->assertTrue($receptionist->can('patient.demographics.update', $patient));
}

/** @test */
public function doctor_can_update_demographics_only_for_own_active_encounter_patients(): void
{
    $doctor = User::factory()->create();
    $doctor->assignRole('CLINICAL.PHYSICIAN');
    $myPatient = Patient::factory()->hasEncounters(1, [
        'primary_clinician_user_id' => $doctor->id,
        'closed_at' => null,
    ])->create();
    $otherPatient = Patient::factory()->create();

    $this->assertTrue($doctor->can('patient.demographics.update', $myPatient));
    $this->assertFalse($doctor->can('patient.demographics.update', $otherPatient));
}

/** @test */
public function requester_cannot_approve_own_requisition(): void
{
    $user = User::factory()->create();
    $user->assignRole('INVENTORY.SUPERVISOR');
    $requisition = Requisition::factory()->create([
        'requested_by_user_id' => $user->id,
    ]);

    $this->assertFalse($user->can('inventory.approve-requisition', $requisition));
}
```
