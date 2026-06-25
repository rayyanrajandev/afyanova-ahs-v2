<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Modules\Department\Infrastructure\Models\DepartmentModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use App\Modules\Platform\Infrastructure\Models\RoleModel;
use App\Modules\Platform\Infrastructure\Models\TenantModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class RoleHierarchySeeder extends Seeder
{
    /**
     * Maps old role codes → new role codes for user migration.
     */
    private const OLD_TO_NEW = [
        'HOSPITAL.FACILITY.ADMIN' => 'ADMIN.FACILITY',
        'HOSPITAL.DEPARTMENT.HEAD' => null, // Replaced by dept-specific MANAGER roles
        'HOSPITAL.REGISTRATION.CLERK' => 'ADMIN.REGISTRATION',
        'HOSPITAL.MEDICAL.RECORDS.OFFICER' => 'ADMIN.MEDICAL.RECORDS',
        'HOSPITAL.STAFF.ADMIN' => 'ADMIN.HR',
        'HOSPITAL.CREDENTIALING.OFFICER' => 'ADMIN.HR',
        'HOSPITAL.PRIVILEGING.REVIEWER' => 'ADMIN.HR',
        'HOSPITAL.PRIVILEGING.APPROVER' => 'ADMIN.HR',
        'HOSPITAL.CLINICAL.USER' => 'CLINICAL.GENERAL',
        'HOSPITAL.CLINICIAN.ORDERING' => 'CLINICAL.PHYSICIAN',
        'HOSPITAL.NURSING.USER' => 'CLINICAL.NURSE',
        'HOSPITAL.EMERGENCY.USER' => 'CLINICAL.EMERGENCY',
        'HOSPITAL.LABORATORY.USER' => 'LAB.STAFF',
        'HOSPITAL.PHARMACY.USER' => 'PHARMACY.STAFF',
        'HOSPITAL.RADIOLOGY.USER' => 'RADIOLOGY.STAFF',
        'HOSPITAL.THEATRE.USER' => 'THEATRE.STAFF',
        'HOSPITAL.INVENTORY.STOREKEEPER' => 'INVENTORY.STAFF',
        'HOSPITAL.BILLING.CASHIER' => 'FINANCE.CASHIER',
        'HOSPITAL.BILLING.OFFICER' => 'FINANCE.OFFICER',
        'HOSPITAL.FINANCE.CONTROLLER' => 'FINANCE.CONTROLLER',
        'HOSPITAL.CLAIMS.USER' => 'FINANCE.CLAIMS',
        'LAB.TECH' => 'LAB.STAFF',
        'LAB.SUPERVISOR' => 'LAB.SUPERVISOR',
        'LAB.MANAGER' => 'LAB.MANAGER',
    ];

    /**
     * Role display names.
     */
    private const DISPLAY_NAMES = [
        'PLATFORM.SUPER.ADMIN' => 'System Super Admin',
        'PLATFORM.USER.ADMIN' => 'Platform User Administrator',
        'PLATFORM.RBAC.ADMIN' => 'Platform RBAC Administrator',
        'PLATFORM.SUBSCRIPTION.ADMIN' => 'Platform Subscription Administrator',
        'ADMIN.FACILITY' => 'Facility Administrator',
        'ADMIN.HR' => 'Human Resources Administrator',
        'ADMIN.REGISTRATION' => 'Registration Clerk',
        'ADMIN.MEDICAL.RECORDS' => 'Medical Records Officer',
        'CLINICAL.PHYSICIAN' => 'Physician',
        'CLINICAL.NURSE' => 'Nurse',
        'CLINICAL.EMERGENCY' => 'Emergency & Triage',
        'CLINICAL.GENERAL' => 'Clinical User',
        'LAB.STAFF' => 'Laboratory Staff',
        'LAB.SUPERVISOR' => 'Laboratory Supervisor',
        'LAB.MANAGER' => 'Laboratory Manager',
        'RADIOLOGY.STAFF' => 'Radiology Staff',
        'RADIOLOGY.SUPERVISOR' => 'Radiology Supervisor',
        'RADIOLOGY.MANAGER' => 'Radiology Manager',
        'PHARMACY.STAFF' => 'Pharmacy Staff',
        'PHARMACY.SUPERVISOR' => 'Pharmacy Supervisor',
        'PHARMACY.MANAGER' => 'Pharmacy Manager',
        'THEATRE.STAFF' => 'Theatre Staff',
        'THEATRE.SUPERVISOR' => 'Theatre Supervisor',
        'THEATRE.MANAGER' => 'Theatre Manager',
        'INVENTORY.STAFF' => 'Inventory Storekeeper',
        'INVENTORY.SUPERVISOR' => 'Inventory Supervisor',
        'INVENTORY.MANAGER' => 'Inventory Manager',
        'FINANCE.CASHIER' => 'Cashier',
        'FINANCE.OFFICER' => 'Billing Officer',
        'FINANCE.CONTROLLER' => 'Finance Controller',
        'FINANCE.CLAIMS' => 'Claims & Insurance User',
    ];

    /**
     * Descriptions for each role.
     */
    private const DESCRIPTIONS = [
        'ADMIN.FACILITY' => 'Facility-wide administration: users, resources, catalogs, read-only access across modules',
        'ADMIN.HR' => 'Staff records, credentialing, documents, privileging, and HR operations',
        'ADMIN.REGISTRATION' => 'Patient registration, appointment scheduling, and admission management',
        'ADMIN.MEDICAL.RECORDS' => 'Medical records management, archiving, and audit',
        'CLINICAL.PHYSICIAN' => 'Full clinical: diagnose, order tests, prescribe medications, document medical records',
        'CLINICAL.NURSE' => 'Nursing care: ward tasks, care plans, discharge management, medication administration',
        'CLINICAL.EMERGENCY' => 'Emergency triage, acute care, and trauma management',
        'CLINICAL.GENERAL' => 'General clinical access: patient records, medical records, basic ordering',
        'LAB.STAFF' => 'Perform laboratory tests, view results, create requisitions for lab supplies',
        'LAB.SUPERVISOR' => 'Verify test results, approve requisitions, manage lab inventory',
        'LAB.MANAGER' => 'Full lab management, cross-department coordination, access administration',
        'RADIOLOGY.STAFF' => 'Perform imaging procedures, view reports, create requisitions',
        'RADIOLOGY.SUPERVISOR' => 'Verify reports, approve requisitions, manage radiology inventory',
        'RADIOLOGY.MANAGER' => 'Full radiology management, cross-department coordination',
        'PHARMACY.STAFF' => 'Dispense medications, manage pharmacy inventory, POS operations',
        'PHARMACY.SUPERVISOR' => 'Verify dispensation, clinical review, approve requisitions',
        'PHARMACY.MANAGER' => 'Full pharmacy management, controlled substances, cross-department access',
        'THEATRE.STAFF' => 'Assist in surgical procedures, manage theatre inventory',
        'THEATRE.SUPERVISOR' => 'Coordinate theatre schedule, approve requisitions, manage resources',
        'THEATRE.MANAGER' => 'Full theatre management, cross-department coordination',
        'INVENTORY.STAFF' => 'Receive, issue, and move stock; create procurement requests',
        'INVENTORY.SUPERVISOR' => 'Approve transfers, manage catalogs, reconcile stock',
        'INVENTORY.MANAGER' => 'Full inventory management, settings, access administration',
        'FINANCE.CASHIER' => 'Point of sale, payment collection, basic refunds',
        'FINANCE.OFFICER' => 'Invoicing, billing, insurance processing, discount management',
        'FINANCE.CONTROLLER' => 'Financial control: voids, overrides, approve refunds, audit',
        'FINANCE.CLAIMS' => 'Claims and insurance processing',
    ];

    /**
     * Role metadata: access_level, scope_type, related departments config.
     */
    private const ROLE_META = [
        // Platform-level roles
        'PLATFORM.SUPER.ADMIN' => ['access_level' => 'manage', 'scope_type' => 'cross_facility'],
        'PLATFORM.USER.ADMIN' => ['access_level' => 'manage', 'scope_type' => 'cross_facility'],
        'PLATFORM.RBAC.ADMIN' => ['access_level' => 'manage', 'scope_type' => 'cross_facility'],
        'PLATFORM.SUBSCRIPTION.ADMIN' => ['access_level' => 'manage', 'scope_type' => 'cross_facility'],
        // Facility-wide admin roles
        'ADMIN.FACILITY' => ['access_level' => 'manage', 'scope_type' => 'facility'],
        'ADMIN.HR' => ['access_level' => 'manage', 'scope_type' => 'facility'],
        'ADMIN.REGISTRATION' => ['access_level' => 'request', 'scope_type' => 'facility'],
        'ADMIN.MEDICAL.RECORDS' => ['access_level' => 'request', 'scope_type' => 'facility'],
        // Clinical roles
        'CLINICAL.PHYSICIAN' => ['access_level' => 'manage', 'scope_type' => 'facility'],
        'CLINICAL.NURSE' => ['access_level' => 'request', 'scope_type' => 'facility'],
        'CLINICAL.EMERGENCY' => ['access_level' => 'request', 'scope_type' => 'facility'],
        'CLINICAL.GENERAL' => ['access_level' => 'request', 'scope_type' => 'facility'],
        // Finance roles
        'FINANCE.CASHIER' => ['access_level' => 'request', 'scope_type' => 'facility'],
        'FINANCE.OFFICER' => ['access_level' => 'approve', 'scope_type' => 'facility'],
        'FINANCE.CONTROLLER' => ['access_level' => 'manage', 'scope_type' => 'facility'],
        'FINANCE.CLAIMS' => ['access_level' => 'request', 'scope_type' => 'facility'],
        // Department-scoped roles
        'LAB.STAFF' => ['access_level' => 'request', 'scope_type' => 'own_department'],
        'LAB.SUPERVISOR' => ['access_level' => 'approve', 'scope_type' => 'own_department'],
        'LAB.MANAGER' => ['access_level' => 'manage', 'scope_type' => 'related_departments'],
        'RADIOLOGY.STAFF' => ['access_level' => 'request', 'scope_type' => 'own_department'],
        'RADIOLOGY.SUPERVISOR' => ['access_level' => 'approve', 'scope_type' => 'own_department'],
        'RADIOLOGY.MANAGER' => ['access_level' => 'manage', 'scope_type' => 'related_departments'],
        'PHARMACY.STAFF' => ['access_level' => 'request', 'scope_type' => 'own_department'],
        'PHARMACY.SUPERVISOR' => ['access_level' => 'approve', 'scope_type' => 'own_department'],
        'PHARMACY.MANAGER' => ['access_level' => 'manage', 'scope_type' => 'related_departments'],
        'THEATRE.STAFF' => ['access_level' => 'request', 'scope_type' => 'own_department'],
        'THEATRE.SUPERVISOR' => ['access_level' => 'approve', 'scope_type' => 'own_department'],
        'THEATRE.MANAGER' => ['access_level' => 'manage', 'scope_type' => 'related_departments'],
        'INVENTORY.STAFF' => ['access_level' => 'request', 'scope_type' => 'own_department'],
        'INVENTORY.SUPERVISOR' => ['access_level' => 'approve', 'scope_type' => 'own_department'],
        'INVENTORY.MANAGER' => ['access_level' => 'manage', 'scope_type' => 'related_departments'],
    ];

    /**
     * Department codes to create roles for (must match DepartmentModel.code or name).
     */
    private const DEPARTMENT_ROLE_MAP = [
        'LAB' => ['code' => 'LAB', 'name_like' => '%Laboratory%'],
        'RADIOLOGY' => ['code' => 'RADIOLOGY', 'name_like' => '%Radiology%'],
        'PHARMACY' => ['code' => 'PHARMACY', 'name_like' => '%Pharmacy%'],
        'THEATRE' => ['code' => 'THEATRE', 'name_like' => '%Theatre%'],
        'INVENTORY' => ['code' => 'INVENTORY', 'name_like' => '%Stores%'],
    ];

    /**
     * Related department names for MANAGER-level scope.
     */
    private const MANAGER_RELATED_DEPARTMENTS = [
        'LAB' => ['Pathology', 'Microbiology'],
        'RADIOLOGY' => ['Imaging'],
        'PHARMACY' => ['Dispensary'],
        'THEATRE' => ['Surgery', 'Theatre Recovery'],
        'INVENTORY' => ['Procurement', 'Supply Chain'],
    ];

    public function run(): void
    {
        // Ensure all permissions exist first
        $this->ensurePermissionsExist();

        $tenant = TenantModel::first();
        if (!$tenant) {
            $this->command->warn('No tenant found. Skipping role hierarchy seeding.');
            return;
        }

        // Create or update roles per facility
        foreach (FacilityModel::all() as $facility) {
            $this->seedFacilityRoles($tenant, $facility);
        }

        // Migrate users from old roles to new
        $this->migrateOldRoles($tenant);

        // Clean up deactivated old roles
        $this->deleteOldRoles();

        $this->command->info('Role hierarchy seeded successfully!');
    }

    private function seedFacilityRoles(TenantModel $tenant, FacilityModel $facility): void
    {
        // Platform roles (no department_id, created once regardless of facility)
        static $platformSeeded = false;
        if (!$platformSeeded) {
            $this->createPlatformRoles($tenant);
            $platformSeeded = true;
        }

        // Facility-wide admin roles
        $this->createRole($tenant, $facility, null, 'ADMIN.FACILITY');
        $this->createRole($tenant, $facility, null, 'ADMIN.HR');
        $this->createRole($tenant, $facility, null, 'ADMIN.REGISTRATION');
        $this->createRole($tenant, $facility, null, 'ADMIN.MEDICAL.RECORDS');

        // Clinical roles
        $this->createRole($tenant, $facility, null, 'CLINICAL.PHYSICIAN');
        $this->createRole($tenant, $facility, null, 'CLINICAL.NURSE');
        $this->createRole($tenant, $facility, null, 'CLINICAL.EMERGENCY');
        $this->createRole($tenant, $facility, null, 'CLINICAL.GENERAL');

        // Finance roles
        $this->createRole($tenant, $facility, null, 'FINANCE.CASHIER');
        $this->createRole($tenant, $facility, null, 'FINANCE.OFFICER');
        $this->createRole($tenant, $facility, null, 'FINANCE.CONTROLLER');
        $this->createRole($tenant, $facility, null, 'FINANCE.CLAIMS');

        // Department-scoped roles
        foreach (self::DEPARTMENT_ROLE_MAP as $deptKey => $deptConfig) {
            $department = DepartmentModel::where('facility_id', $facility->id)
                ->where(function ($q) use ($deptConfig): void {
                    $q->where('code', $deptConfig['code'])
                      ->orWhere('name', 'LIKE', $deptConfig['name_like']);
                })
                ->first();

            if (!$department) {
                continue;
            }

            // Create 3-tier roles for this department
            foreach (['STAFF', 'SUPERVISOR', 'MANAGER'] as $tier) {
                $roleCode = $deptConfig['code'] . '.' . $tier;
                $this->createRole($tenant, $facility, $department, $roleCode);
            }

            // Link related departments to MANAGER roles
            $managerRole = RoleModel::where('tenant_id', $tenant->id)
                ->where('facility_id', $facility->id)
                ->where('department_id', $department->id)
                ->where('code', $deptConfig['code'] . '.MANAGER')
                ->first();

            if ($managerRole && isset(self::MANAGER_RELATED_DEPARTMENTS[$deptKey])) {
                $related = DepartmentModel::where('facility_id', $facility->id)
                    ->whereIn('name', self::MANAGER_RELATED_DEPARTMENTS[$deptKey])
                    ->pluck('id')
                    ->toArray();

                if (!empty($related)) {
                    $managerRole->update(['related_department_ids' => $related]);
                }
            }
        }
    }

    private function createRole(TenantModel $tenant, FacilityModel $facility, ?DepartmentModel $department, string $code): void
    {
        $meta = self::ROLE_META[$code] ?? [];
        $displayName = self::DISPLAY_NAMES[$code] ?? $code;
        $description = self::DESCRIPTIONS[$code] ?? null;

        $role = RoleModel::updateOrCreate(
            [
                'tenant_id' => $tenant->id,
                'facility_id' => $facility->id,
                'department_id' => $department?->id,
                'code' => $code,
            ],
            [
                'name' => $displayName,
                'status' => 'active',
                'description' => $description,
                'is_system' => false,
                'access_level' => $meta['access_level'] ?? null,
                'scope_type' => $meta['scope_type'] ?? null,
                'effective_from' => now(),
                'effective_until' => null,
            ]
        );

        // Sync permissions
        $permissions = $this->permissionsForRole($code, $department);
        if (!empty($permissions)) {
            $permissionIds = Permission::whereIn('name', $permissions)->pluck('id');
            $role->permissions()->syncWithoutDetaching($permissionIds);
        }
    }

    private function createPlatformRoles(TenantModel $tenant): void
    {
        $platformRoles = [
            'PLATFORM.SUPER.ADMIN',
            'PLATFORM.USER.ADMIN',
            'PLATFORM.RBAC.ADMIN',
            'PLATFORM.SUBSCRIPTION.ADMIN',
        ];

        foreach ($platformRoles as $code) {
            $meta = self::ROLE_META[$code] ?? [];

            RoleModel::updateOrCreate(
                ['tenant_id' => $tenant->id, 'code' => $code],
                [
                    'name' => self::DISPLAY_NAMES[$code] ?? $code,
                    'status' => 'active',
                    'description' => null,
                    'is_system' => false,
                    'access_level' => $meta['access_level'] ?? 'manage',
                    'scope_type' => $meta['scope_type'] ?? 'cross_facility',
                ]
            );

            $permissions = $this->permissionsForRole($code, null);
            if (!empty($permissions)) {
                $role = RoleModel::where('tenant_id', $tenant->id)
                    ->where('code', $code)->first();
                $permissionIds = Permission::whereIn('name', $permissions)->pluck('id');
                $role->permissions()->syncWithoutDetaching($permissionIds);
            }
        }
    }

    private function migrateOldRoles(TenantModel $tenant): void
    {
        $migrated = 0;
        foreach (self::OLD_TO_NEW as $oldCode => $newCode) {
            if ($newCode === null) {
                // Mark old role as inactive (no replacement)
                RoleModel::where('code', $oldCode)->update(['status' => 'inactive']);
                continue;
            }

            // Skip self-mapping (old and new codes are the same — no migration needed)
            if ($oldCode === $newCode) {
                continue;
            }

            $oldRoles = RoleModel::where('code', $oldCode)->get();
            foreach ($oldRoles as $oldRole) {
                $users = $oldRole->users;

                // Find matching new role (same tenant/facility/department)
                $newRoleQuery = RoleModel::where('tenant_id', $oldRole->tenant_id)
                    ->where('facility_id', $oldRole->facility_id)
                    ->where('code', $newCode);

                if ($oldRole->department_id) {
                    $newRoleQuery->where('department_id', $oldRole->department_id);
                }

                $newRole = $newRoleQuery->first();
                if (!$newRole) {
                    continue;
                }

                foreach ($users as $user) {
                    // Avoid duplicate assignment
                    if (!$user->roles()->where('role_id', $newRole->id)->exists()) {
                        $user->roles()->attach($newRole->id);
                        $migrated++;
                    }
                }

                // Deactivate old role
                $oldRole->update(['status' => 'inactive']);
            }
        }

        if ($migrated > 0) {
            $this->command->info("Migrated {$migrated} user assignments to new roles.");
        }
    }

    private function deleteOldRoles(): void
    {
        $oldCodes = array_keys(self::OLD_TO_NEW);
        $deleted = RoleModel::whereIn('code', $oldCodes)
            ->where('status', 'inactive')
            ->delete();

        if ($deleted > 0) {
            $this->command->info("Deleted {$deleted} deactivated old roles.");
        }
    }

    private function permissionsForRole(string $code, ?DepartmentModel $department): array
    {
        static $deptPermissions = [];

        $profiles = $this->rolePermissionProfiles();
        if (isset($profiles[$code])) {
            $perms = $profiles[$code];

            // For department roles, also add inventory department-scoped permissions
            if ($department !== null) {
                $deptKey = $department->id ?? 'fallback';
                if (!isset($deptPermissions[$deptKey])) {
                    $deptPermissions[$deptKey] = $this->inventoryPermissionsForDept($department);
                }

                $inventoryPerms = $deptPermissions[$deptKey][$code] ?? [];
                $perms = array_merge($perms, $inventoryPerms);
            }

            return $perms;
        }

        return [];
    }

    private function inventoryPermissionsForDept(DepartmentModel $department): array
    {
        $profile = strtolower(trim(implode(' ', array_filter([
            (string) $department->code,
            (string) $department->name,
            (string) $department->service_type,
        ]))));

        $categoryPerms = [];

        // Assign inventory department-scoped permissions based on category
        if (str_contains($profile, 'laboratory') || str_contains($profile, 'lab')) {
            $categoryPerms = [
                'inventory.view-own-items',
                'inventory.create-requisition-own-department',
                'inventory.view-requisition-own',
                'inventory.view-warehouse-own-department',
            ];
        } elseif (str_contains($profile, 'pharmacy') || str_contains($profile, 'dispensary')) {
            $categoryPerms = [
                'inventory.view-own-items',
                'inventory.create-requisition-own-department',
                'inventory.view-requisition-own',
                'inventory.view-warehouse-own-department',
            ];
        } elseif (str_contains($profile, 'radiology') || str_contains($profile, 'imaging')) {
            $categoryPerms = [
                'inventory.view-own-items',
                'inventory.create-requisition-own-department',
                'inventory.view-requisition-own',
                'inventory.view-warehouse-own-department',
            ];
        } elseif (str_contains($profile, 'theatre') || str_contains($profile, 'surgery')) {
            $categoryPerms = [
                'inventory.view-own-items',
                'inventory.create-requisition-own-department',
                'inventory.view-requisition-own',
                'inventory.view-warehouse-own-department',
            ];
        } elseif (str_contains($profile, 'store') || str_contains($profile, 'warehouse') || str_contains($profile, 'inventory')) {
            $categoryPerms = [
                'inventory.view-own-items',
                'inventory.create-requisition-own-department',
                'inventory.view-requisition-own',
                'inventory.view-warehouse-own-department',
            ];
        }

        return [
            'LAB.STAFF' => $categoryPerms,
            'LAB.SUPERVISOR' => array_merge($categoryPerms, [
                'inventory.view-department-items',
                'inventory.approve-requisition-own-department',
                'inventory.execute-warehouse-transfer-own-department',
                'inventory.authorize-warehouse-transfer-receiving-department',
                'inventory.view-requisition-department',
            ]),
            'LAB.MANAGER' => array_merge($categoryPerms, [
                'inventory.view-department-items',
                'inventory.approve-requisition-own-department',
                'inventory.manage-warehouse-own-department',
                'inventory.execute-warehouse-transfer-own-department',
                'inventory.authorize-warehouse-transfer-receiving-department',
                'inventory.dispose-items-own-department',
                'inventory.view-requisition-department',
                'inventory.create-requisition-cross-department',
                'inventory.admin-manage-access',
            ]),
            'RADIOLOGY.STAFF' => $categoryPerms,
            'RADIOLOGY.SUPERVISOR' => array_merge($categoryPerms, [
                'inventory.view-department-items',
                'inventory.approve-requisition-own-department',
                'inventory.execute-warehouse-transfer-own-department',
                'inventory.authorize-warehouse-transfer-receiving-department',
                'inventory.view-requisition-department',
            ]),
            'RADIOLOGY.MANAGER' => array_merge($categoryPerms, [
                'inventory.view-department-items',
                'inventory.approve-requisition-own-department',
                'inventory.manage-warehouse-own-department',
                'inventory.execute-warehouse-transfer-own-department',
                'inventory.authorize-warehouse-transfer-receiving-department',
                'inventory.dispose-items-own-department',
                'inventory.view-requisition-department',
                'inventory.create-requisition-cross-department',
                'inventory.admin-manage-access',
            ]),
            'PHARMACY.STAFF' => $categoryPerms,
            'PHARMACY.SUPERVISOR' => array_merge($categoryPerms, [
                'inventory.view-department-items',
                'inventory.approve-requisition-own-department',
                'inventory.execute-warehouse-transfer-own-department',
                'inventory.authorize-warehouse-transfer-receiving-department',
                'inventory.view-requisition-department',
            ]),
            'PHARMACY.MANAGER' => array_merge($categoryPerms, [
                'inventory.view-department-items',
                'inventory.approve-requisition-own-department',
                'inventory.manage-warehouse-own-department',
                'inventory.execute-warehouse-transfer-own-department',
                'inventory.authorize-warehouse-transfer-receiving-department',
                'inventory.dispose-items-own-department',
                'inventory.dispose-items-controlled-substance',
                'inventory.view-requisition-department',
                'inventory.create-requisition-cross-department',
                'inventory.admin-manage-access',
            ]),
            'THEATRE.STAFF' => $categoryPerms,
            'THEATRE.SUPERVISOR' => array_merge($categoryPerms, [
                'inventory.view-department-items',
                'inventory.approve-requisition-own-department',
                'inventory.execute-warehouse-transfer-own-department',
                'inventory.authorize-warehouse-transfer-receiving-department',
                'inventory.view-requisition-department',
            ]),
            'THEATRE.MANAGER' => array_merge($categoryPerms, [
                'inventory.view-department-items',
                'inventory.approve-requisition-own-department',
                'inventory.manage-warehouse-own-department',
                'inventory.execute-warehouse-transfer-own-department',
                'inventory.authorize-warehouse-transfer-receiving-department',
                'inventory.dispose-items-own-department',
                'inventory.view-requisition-department',
                'inventory.create-requisition-cross-department',
                'inventory.admin-manage-access',
            ]),
            'INVENTORY.STAFF' => $categoryPerms,
            'INVENTORY.SUPERVISOR' => array_merge($categoryPerms, [
                'inventory.view-department-items',
                'inventory.approve-requisition-own-department',
                'inventory.manage-warehouse-own-department',
                'inventory.execute-warehouse-transfer-own-department',
                'inventory.authorize-warehouse-transfer-receiving-department',
                'inventory.view-requisition-department',
            ]),
            'INVENTORY.MANAGER' => array_merge($categoryPerms, [
                'inventory.view-department-items',
                'inventory.approve-requisition-own-department',
                'inventory.manage-warehouse-own-department',
                'inventory.manage-warehouse-all',
                'inventory.execute-warehouse-transfer-own-department',
                'inventory.authorize-warehouse-transfer-receiving-department',
                'inventory.dispose-items-own-department',
                'inventory.view-requisition-department',
                'inventory.create-requisition-cross-department',
                'inventory.admin-manage-access',
                'inventory.admin-manage-settings',
                'inventory.audit-view-all-items',
                'inventory.audit-view-all-requisitions',
                'inventory.audit-view-all-transfers',
            ]),
        ];
    }

    private function rolePermissionProfiles(): array
    {
        return [
            'PLATFORM.SUPER.ADMIN' => [], // Gate::before() gives universal access

            'PLATFORM.USER.ADMIN' => [
                'platform.users.read',
                'platform.users.create',
                'platform.users.update',
                'platform.users.update-status',
                'platform.users.manage-facilities',
                'platform.users.reset-password',
                'platform.users.view-audit-logs',
                'platform.users.approval-cases.read',
                'platform.users.approval-cases.create',
                'platform.users.approval-cases.manage',
                'platform.users.approval-cases.review',
                'platform.users.approval-cases.view-audit-logs',
                'platform.facilities.read',
                'platform.facilities.create',
                'platform.facilities.update',
                'platform.facilities.update-status',
                'platform.facilities.manage-owners',
                'platform.facilities.manage-subscriptions',
                'platform.facilities.view-audit-logs',
                'platform.subscription-plans.read',
                'platform.subscription-plans.manage',
                'platform.subscription-plans.view-audit-logs',
            ],

            'PLATFORM.RBAC.ADMIN' => [
                'platform.rbac.read',
                'platform.rbac.manage-roles',
                'platform.rbac.manage-user-roles',
                'platform.rbac.view-audit-logs',
                'platform.settings.manage-branding',
            ],

            'PLATFORM.SUBSCRIPTION.ADMIN' => [
                'platform.facilities.read',
                'platform.facilities.manage-subscriptions',
                'platform.facilities.view-audit-logs',
                'platform.subscription-plans.read',
                'platform.subscription-plans.manage',
                'platform.subscription-plans.view-audit-logs',
            ],

            'ADMIN.FACILITY' => [
                'patients.read',
                'patients.create',
                'patients.update',
                'admissions.read',
                'admissions.create',
                'admissions.update',
                'admissions.update-status',
                'admissions.view-audit-logs',
                'appointments.read',
                'medical.records.read',
                'medical.records.archive',
                'medical-records.view-audit-logs',
                'laboratory.orders.read',
                'pharmacy.orders.read',
                'radiology.orders.read',
                'theatre.procedures.read',
                'claims.insurance.read',
                'billing.invoices.read',
                'billing.payments.view-history',
                'billing.financial-controls.read',
                'service.requests.create',
                'service.requests.read',
                'service.requests.update-status',
                'service.requests.export',
                'service.requests.audit-logs.read',
                'pos.registers.read',
                'pos.sessions.read',
                'pos.sales.read',
                'pos.lab-quick.read',
                'pos.cafeteria.read',
                'pos.pharmacy-otc.read',
                'inventory.procurement.read',
                'inventory.procurement.create-movement',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'inventory.procurement.reconcile-stock',
                'inventory.procurement.view-audit-logs',
                'inventory.procurement.manage-suppliers',
                'inventory.procurement.manage-warehouses',
                'inpatient.ward.read',
                'staff.read',
                'staff.clinical-directory.read',
                'staff.view-audit-logs',
                'staff.documents.read',
                'staff.credentialing.read',
                'staff.privileges.read',
                'staff.create',
                'staff.update',
                'staff.update-status',
                'staff.specialties.read',
                'staff.specialties.manage',
                'specialties.read',
                'specialties.create',
                'specialties.update',
                'specialties.update-status',
                'specialties.view-audit-logs',
                'departments.read',
                'departments.create',
                'departments.update',
                'departments.update-status',
                'departments.view-audit-logs',
                'platform.resources.read',
                'platform.resources.manage-service-points',
                'platform.resources.manage-ward-beds',
                'platform.resources.view-audit-logs',
                'platform.clinical-catalog.read',
                'platform.clinical-catalog.manage-lab-tests',
                'platform.clinical-catalog.manage-radiology-procedures',
                'platform.clinical-catalog.manage-theatre-procedures',
                'platform.clinical-catalog.manage-formulary',
                'platform.clinical-catalog.view-audit-logs',
                'billing.service-catalog.read',
                'billing.service-catalog.manage-identity',
                'billing.service-catalog.manage-pricing',
                'billing.service-catalog.view-audit-logs',
                'platform.users.read',
                'platform.users.create',
                'platform.users.update',
                'platform.users.update-status',
                'platform.users.reset-password',
                'platform.users.view-audit-logs',
                'platform.users.manage-facilities',
                'platform.users.approval-cases.read',
                'platform.users.approval-cases.create',
                'platform.users.approval-cases.manage',
                'platform.users.approval-cases.review',
                'platform.users.approval-cases.view-audit-logs',
                'platform.rbac.read',
                'platform.rbac.manage-user-roles',
            ],

            'ADMIN.HR' => [
                'staff.read',
                'staff.create',
                'staff.update',
                'staff.update-status',
                'staff.view-audit-logs',
                'staff.documents.read',
                'staff.documents.create',
                'staff.documents.update',
                'staff.documents.verify',
                'staff.documents.update-status',
                'staff.documents.view-audit-logs',
                'staff.credentialing.read',
                'staff.credentialing.manage-profile',
                'staff.credentialing.manage-registrations',
                'staff.credentialing.verify',
                'staff.credentialing.view-audit-logs',
                'staff.privileges.read',
                'staff.privileges.create',
                'staff.privileges.update',
                'staff.privileges.review',
                'staff.privileges.approve',
                'staff.privileges.update-status',
                'staff.privileges.view-audit-logs',
                'staff.specialties.read',
                'specialties.read',
                'departments.read',
            ],

            'ADMIN.REGISTRATION' => [
                'patients.read',
                'patients.create',
                'patients.update',
                'admissions.read',
                'admissions.create',
                'admissions.update',
                'appointments.read',
                'appointments.create',
                'appointments.update',
                'appointments.update-status',
                'service.requests.create',
                'service.requests.read',
                'staff.clinical-directory.read',
            ],

            'ADMIN.MEDICAL.RECORDS' => [
                'patients.read',
                'medical.records.read',
                'medical.records.archive',
                'medical-records.view-audit-logs',
            ],

            'CLINICAL.PHYSICIAN' => [
                'patients.read',
                'patients.update',
                'appointments.read',
                'admissions.read',
                'medical.records.read',
                'medical.records.create',
                'medical.records.update',
                'medical.records.finalize',
                'medical.records.amend',
                'medical.records.attest',
                'laboratory.orders.create',
                'laboratory.orders.read',
                'pharmacy.orders.create',
                'pharmacy.orders.read',
                'radiology.orders.read',
                'radiology.orders.create',
                'theatre.procedures.read',
                'theatre.procedures.create',
                'platform.clinical-catalog.read',
                'inpatient.ward.read',
                'inpatient.ward.create-round-note',
                'inpatient.ward.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'staff.clinical-directory.read',
            ],

            'CLINICAL.NURSE' => [
                'patients.read',
                'service.requests.create',
                'service.requests.read',
                'admissions.read',
                'appointments.read',
                'medical.records.read',
                'inpatient.ward.read',
                'inpatient.ward.create-task',
                'inpatient.ward.update-task-status',
                'inpatient.ward.create-care-plan',
                'inpatient.ward.update-care-plan',
                'inpatient.ward.update-care-plan-status',
                'inpatient.ward.manage-discharge-checklist',
                'inpatient.ward.view-audit-logs',
                'staff.clinical-directory.read',
            ],

            'CLINICAL.EMERGENCY' => [
                'patients.read',
                'appointments.read',
                'admissions.read',
                'medical.records.read',
                'medical.records.create',
                'medical.records.update',
                'medical.records.finalize',
                'medical.records.amend',
                'medical.records.attest',
                'emergency.triage.read',
                'emergency.triage.create',
                'emergency.triage.update',
                'emergency.triage.update-status',
                'emergency.triage.view-audit-logs',
                'emergency.triage.manage-transfers',
                'emergency.triage.view-transfer-audit-logs',
                'staff.clinical-directory.read',
            ],

            'CLINICAL.GENERAL' => [
                'patients.read',
                'patients.update',
                'appointments.read',
                'admissions.read',
                'medical.records.read',
                'medical.records.create',
                'medical.records.update',
                'medical.records.finalize',
                'medical.records.amend',
                'medical.records.attest',
                'inpatient.ward.read',
                'inpatient.ward.create-round-note',
                'inpatient.ward.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'staff.clinical-directory.read',
            ],

            'LAB.STAFF' => [
                'laboratory.orders.read',
                'laboratory.orders.update-status',
                'service.requests.read',
                'service.requests.update-status',
                'laboratory.orders.verify-result',
                'laboratory-orders.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'pos.registers.read',
                'pos.sessions.read',
                'pos.sessions.manage',
                'pos.sales.read',
                'pos.sales.create',
                'pos.lab-quick.read',
                'pos.lab-quick.create',
            ],

            'LAB.SUPERVISOR' => [
                'laboratory.orders.read',
                'laboratory.orders.update-status',
                'service.requests.read',
                'service.requests.update-status',
                'laboratory.orders.verify-result',
                'laboratory-orders.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'inventory.procurement.reconcile-stock',
                'inventory.procurement.create-movement',
                'inventory.procurement.set-opening-stock',
                'inventory.procurement.correct-movement',
                'pos.registers.read',
                'pos.sessions.read',
                'pos.sessions.manage',
                'pos.sales.read',
                'pos.sales.create',
                'pos.lab-quick.read',
                'pos.lab-quick.create',
            ],

            'LAB.MANAGER' => [
                'laboratory.orders.read',
                'laboratory.orders.update-status',
                'service.requests.read',
                'service.requests.update-status',
                'laboratory.orders.verify-result',
                'laboratory-orders.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'inventory.procurement.reconcile-stock',
                'inventory.procurement.create-movement',
                'inventory.procurement.set-opening-stock',
                'inventory.procurement.correct-movement',
                'inventory.procurement.manage-items',
                'inventory.procurement.view-audit-logs',
                'pos.registers.read',
                'pos.sessions.read',
                'pos.sessions.manage',
                'pos.sales.read',
                'pos.sales.create',
                'pos.lab-quick.read',
                'pos.lab-quick.create',
            ],

            'RADIOLOGY.STAFF' => [
                'radiology.orders.read',
                'service.requests.read',
                'service.requests.update-status',
                'radiology.orders.update',
                'radiology.orders.update-status',
                'radiology.orders.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
            ],

            'RADIOLOGY.SUPERVISOR' => [
                'radiology.orders.read',
                'service.requests.read',
                'service.requests.update-status',
                'radiology.orders.update',
                'radiology.orders.update-status',
                'radiology.orders.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
            ],

            'RADIOLOGY.MANAGER' => [
                'radiology.orders.read',
                'service.requests.read',
                'service.requests.update-status',
                'radiology.orders.update',
                'radiology.orders.update-status',
                'radiology.orders.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'inventory.procurement.manage-items',
                'inventory.procurement.view-audit-logs',
            ],

            'PHARMACY.STAFF' => [
                'patients.read',
                'service.requests.read',
                'service.requests.update-status',
                'pharmacy.orders.read',
                'pharmacy.orders.update-status',
                'pharmacy.orders.verify-dispense',
                'pharmacy.orders.manage-policy',
                'pharmacy.orders.reconcile',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'pharmacy-orders.view-audit-logs',
                'pos.registers.read',
                'pos.sessions.read',
                'pos.sessions.manage',
                'pos.sales.read',
                'pos.sales.create',
                'pos.pharmacy-otc.read',
                'pos.pharmacy-otc.create',
            ],

            'PHARMACY.SUPERVISOR' => [
                'patients.read',
                'service.requests.read',
                'service.requests.update-status',
                'pharmacy.orders.read',
                'pharmacy.orders.update-status',
                'pharmacy.orders.verify-dispense',
                'pharmacy.orders.manage-policy',
                'pharmacy.orders.reconcile',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'inventory.procurement.reconcile-stock',
                'inventory.procurement.view-audit-logs',
                'pharmacy-orders.view-audit-logs',
                'pos.registers.read',
                'pos.sessions.read',
                'pos.sessions.manage',
                'pos.sales.read',
                'pos.sales.create',
                'pos.pharmacy-otc.read',
                'pos.pharmacy-otc.create',
            ],

            'PHARMACY.MANAGER' => [
                'patients.read',
                'service.requests.read',
                'service.requests.update-status',
                'pharmacy.orders.read',
                'pharmacy.orders.update-status',
                'pharmacy.orders.verify-dispense',
                'pharmacy.orders.manage-policy',
                'pharmacy.orders.reconcile',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'inventory.procurement.reconcile-stock',
                'inventory.procurement.create-movement',
                'inventory.procurement.set-opening-stock',
                'inventory.procurement.correct-movement',
                'inventory.procurement.manage-items',
                'inventory.procurement.manage-suppliers',
                'inventory.procurement.view-audit-logs',
                'pharmacy-orders.view-audit-logs',
                'pos.registers.read',
                'pos.sessions.read',
                'pos.sessions.manage',
                'pos.sales.read',
                'pos.sales.create',
                'pos.pharmacy-otc.read',
                'pos.pharmacy-otc.create',
            ],

            'THEATRE.STAFF' => [
                'theatre.procedures.read',
                'theatre.procedures.create',
                'theatre.procedures.update',
                'theatre.procedures.update-status',
                'theatre.procedures.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'staff.clinical-directory.read',
            ],

            'THEATRE.SUPERVISOR' => [
                'theatre.procedures.read',
                'theatre.procedures.create',
                'theatre.procedures.update',
                'theatre.procedures.update-status',
                'theatre.procedures.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'staff.clinical-directory.read',
            ],

            'THEATRE.MANAGER' => [
                'theatre.procedures.read',
                'theatre.procedures.create',
                'theatre.procedures.update',
                'theatre.procedures.update-status',
                'theatre.procedures.view-audit-logs',
                'inventory.procurement.read',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'inventory.procurement.manage-items',
                'inventory.procurement.view-audit-logs',
                'staff.clinical-directory.read',
            ],

            'INVENTORY.STAFF' => [
                'inventory.procurement.read',
                'inventory.procurement.create-movement',
                'inventory.procurement.correct-movement',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'inventory.procurement.reconcile-stock',
                'inventory.procurement.view-audit-logs',
            ],

            'INVENTORY.SUPERVISOR' => [
                'inventory.procurement.read',
                'inventory.procurement.manage-items',
                'inventory.procurement.create-movement',
                'inventory.procurement.set-opening-stock',
                'inventory.procurement.correct-movement',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'inventory.procurement.reconcile-stock',
                'inventory.procurement.view-audit-logs',
                'inventory.procurement.manage-suppliers',
                'inventory.procurement.manage-item-units',
                'inventory.procurement.manage-unit-prices',
            ],

            'INVENTORY.MANAGER' => [
                'inventory.procurement.read',
                'inventory.procurement.manage-items',
                'inventory.procurement.create-movement',
                'inventory.procurement.set-opening-stock',
                'inventory.procurement.correct-movement',
                'inventory.procurement.create-request',
                'inventory.procurement.update-request-status',
                'inventory.procurement.reconcile-stock',
                'inventory.procurement.manage-warehouses',
                'inventory.procurement.manage-suppliers',
                'inventory.procurement.manage-item-units',
                'inventory.procurement.manage-unit-prices',
                'inventory.procurement.view-audit-logs',
            ],

            'FINANCE.CASHIER' => [
                'patients.read',
                'billing.invoices.read',
                'billing.payments.record',
                'billing.payments.view-history',
                'billing.cash-accounts.read',
                'billing.cash-accounts.manage',
                'billing.refunds.create',
                'billing.refunds.read',
                'pos.registers.read',
                'pos.sessions.read',
                'pos.sessions.manage',
                'pos.sales.read',
                'pos.sales.create',
                'pos.lab-quick.read',
                'pos.lab-quick.create',
                'pos.cafeteria.read',
                'pos.cafeteria.create',
                'pos.pharmacy-otc.read',
                'pos.pharmacy-otc.create',
            ],

            'FINANCE.OFFICER' => [
                'patients.read',
                'departments.read',
                'billing.invoices.create',
                'billing.invoices.read',
                'billing.invoices.issue',
                'billing.invoices.update-draft',
                'billing.invoices.cancel',
                'billing.payments.view-history',
                'billing.service-catalog.read',
                'billing.service-catalog.manage-identity',
                'billing.payer-contracts.read',
                'billing.routing.read',
                'billing.discounts.read',
                'billing.refunds.read',
                'billing.refunds.create',
                'pos.registers.read',
                'pos.registers.manage',
                'pos.sessions.read',
                'pos.sales.read',
                'pos.lab-quick.read',
                'pos.cafeteria.read',
                'pos.cafeteria.manage-catalog',
                'pos.pharmacy-otc.read',
            ],

            'FINANCE.CONTROLLER' => [
                'patients.read',
                'departments.read',
                'billing.invoices.read',
                'billing.financial-controls.read',
                'billing.invoices.void',
                'billing-invoices.view-audit-logs',
                'billing.payments.reverse',
                'billing.payments.view-history',
                'billing.service-catalog.read',
                'billing.service-catalog.manage-pricing',
                'billing.service-catalog.view-audit-logs',
                'billing.payer-contracts.read',
                'billing.payer-contracts.view-audit-logs',
                'billing.payer-contracts.manage-price-overrides',
                'billing.payer-contracts.view-price-override-audit-logs',
                'billing.routing.read',
                'billing.discounts.read',
                'billing.discounts.manage',
                'billing.refunds.read',
                'billing.refunds.approve',
                'billing.refunds.process',
                'pos.registers.read',
                'pos.registers.manage',
                'pos.sessions.read',
                'pos.sales.read',
                'pos.sales.void',
                'pos.sales.refund',
                'pos.lab-quick.read',
                'pos.cafeteria.read',
                'pos.cafeteria.manage-catalog',
                'pos.pharmacy-otc.read',
            ],

            'FINANCE.CLAIMS' => [
                'patients.read',
                'claims.insurance.read',
                'claims.insurance.create',
                'claims.insurance.update',
                'claims.insurance.update-status',
                'claims.insurance.view-audit-logs',
            ],
        ];
    }

    private function ensurePermissionsExist(): void
    {
        $allPermissions = [];
        foreach ($this->rolePermissionProfiles() as $perms) {
            $allPermissions = array_merge($allPermissions, $perms);
        }

        // Also ensure inventory department-scoped permissions exist
        $departmentPerms = [
            'inventory.view-own-items',
            'inventory.view-department-items',
            'inventory.view-warehouse-own-department',
            'inventory.view-requisition-own',
            'inventory.view-requisition-department',
            'inventory.create-requisition-own-department',
            'inventory.create-requisition-cross-department',
            'inventory.approve-requisition-own-department',
            'inventory.approve-requisition-high-value',
            'inventory.approve-requisition-controlled-substance',
            'inventory.manage-warehouse-own-department',
            'inventory.manage-warehouse-all',
            'inventory.execute-warehouse-transfer-own-department',
            'inventory.authorize-warehouse-transfer-receiving-department',
            'inventory.dispose-items-own-department',
            'inventory.dispose-items-controlled-substance',
            'inventory.audit-view-all-items',
            'inventory.audit-view-all-requisitions',
            'inventory.audit-view-all-transfers',
            'inventory.admin-manage-access',
            'inventory.admin-manage-settings',
        ];
        $allPermissions = array_merge($allPermissions, $departmentPerms);

        $allPermissions = array_values(array_unique(array_filter($allPermissions)));

        foreach ($allPermissions as $name) {
            Permission::firstOrCreate(['name' => $name]);
        }
    }
}
