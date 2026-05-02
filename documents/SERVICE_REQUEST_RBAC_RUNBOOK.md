# Service request RBAC — production runbook

## Goal

Digital walk-ins require **`service.requests.create`** on whoever raises tickets at the desk (usually **HOSPITAL.REGISTRATION.CLERK** and **HOSPITAL.NURSING.USER**). Departments consume queues with **`service.requests.read`** + **`service.requests.update-status`** on lab / pharmacy / radiology roles.

## Authoritative mappings

| Permission | Roles (migration + `defaultHospitalRolePermissionProfiles`) |
|-----------|------------------------------------------------------------------------------------------------|
| `service.requests.create` | Registration Clerk, Nursing User, Facility Admin |
| `service.requests.read` | Registration Clerk, Lab, Pharmacy, Radiology, Nursing, Facility Admin (+ broad patient readers see **routing summaries** when feature flag enabled) |
| `service.requests.update-status` | Lab, Pharmacy, Radiology, Facility Admin |
| `service.requests.export` | Facility Admin |
| `service.requests.audit-logs.read` | Facility Admin |

Seeded in:

- [`database/migrations/2026_05_02_000002_seed_service_request_permissions.php`](../database/migrations/2026_05_02_000002_seed_service_request_permissions.php)
- [`database/migrations/2026_05_03_000004_seed_service_request_export_audit_permissions.php`](../database/migrations/2026_05_03_000004_seed_service_request_export_audit_permissions.php)

Role **defaults for `php artisan`** bootstrapped users mirror the same mappings in **`routes/console.php`** → **`defaultHospitalRolePermissionProfiles()`**.

## Operational checks

After deploy:

1. `php artisan migrate` (apply permission + schema migrations).
2. For a deployment that uses console bootstrapped roles rather than migrations only, re-sync role permissions (`app:hospital-role-sync` / internal procedure documented for your tenancy).
3. Sign in as a **Registration Clerk** test user and confirm **`POST /api/v1/service-requests`** returns **201**.
4. Sign in as **Laboratory User** (or pharmacist / radiologist as appropriate), open the department module, and confirm **`WalkINServiceRequestsPanel`** lists the patient.
5. Optional: Facility Admin verifies **`GET /api/v1/service-requests/export/csv`** downloads and **`GET /api/v1/service-requests/{id}/audit-events`** returns rows.

## Drift symptom

Patients hand-off **Direct services** lane disabled and **no** rows in **`service_requests`**: deployment missing **`service.requests.create`** on reception role — fix permissions, do not chase UI patches first.
