<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\User;
use App\Modules\Department\Infrastructure\Models\DepartmentModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use App\Modules\Platform\Infrastructure\Models\RoleModel;
use App\Modules\Platform\Infrastructure\Models\TenantModel;
use Illuminate\Database\Seeder;

class InventoryAccessRolesSeeder extends Seeder
{
    /**
     * Run the database seeds to create inventory access roles
     * Phase 1: Department-Level RBAC Implementation
     *
     * Creates roles:
     * - LAB.TECH (Request level)
     * - LAB.SUPERVISOR (Approve level)
     * - LAB.MANAGER (Manage level)
     */
    public function run(): void
    {
        // Get first tenant and facility for demo purposes
        $tenant = TenantModel::first();
        $facility = FacilityModel::first();

        if (!$tenant || !$facility) {
            $this->command->warn('No tenant or facility found. Skipping inventory role creation.');
            return;
        }

        // Get Laboratory department
        $labDepartment = DepartmentModel::where('facility_id', $facility->id)
            ->where('name', 'ilike', '%Laboratory%')
            ->first();

        if (!$labDepartment) {
            $this->command->warn('No Laboratory department found. Skipping inventory role creation.');
            return;
        }

        // Get or create permissions
        $this->ensurePermissionsExist();

        // Create LAB.TECH role
        $labTechRole = RoleModel::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'facility_id' => $facility->id,
                'department_id' => $labDepartment->id,
                'code' => 'LAB.TECH',
            ],
            [
                'name' => 'Laboratory Technician',
                'status' => 'active',
                'description' => 'Lab technician - can view own department inventory and create requisitions',
                'is_system' => false,
                'access_level' => 'request',
                'scope_type' => 'own_department',
                'effective_from' => now(),
                'effective_until' => null,
            ]
        );

        // Assign permissions to LAB.TECH
        $this->assignPermissionsToRole($labTechRole, [
            'inventory.view-own-items',
            'inventory.create-requisition-own-department',
            'inventory.view-requisition-own',
            'inventory.view-warehouse-own-department',
        ]);

        // Create LAB.SUPERVISOR role
        $labSupervisorRole = RoleModel::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'facility_id' => $facility->id,
                'department_id' => $labDepartment->id,
                'code' => 'LAB.SUPERVISOR',
            ],
            [
                'name' => 'Laboratory Supervisor',
                'status' => 'active',
                'description' => 'Lab supervisor - can approve requisitions and manage lab warehouse',
                'is_system' => false,
                'access_level' => 'approve',
                'scope_type' => 'own_department',
                'effective_from' => now(),
                'effective_until' => null,
            ]
        );

        // Assign permissions to LAB.SUPERVISOR
        $this->assignPermissionsToRole($labSupervisorRole, [
            'inventory.view-own-items',
            'inventory.view-department-items',
            'inventory.create-requisition-own-department',
            'inventory.approve-requisition-own-department',
            'inventory.execute-warehouse-transfer-own-department',
            'inventory.authorize-warehouse-transfer-receiving-department',
            'inventory.view-warehouse-own-department',
            'inventory.view-requisition-own',
            'inventory.view-requisition-department',
        ]);

        // Create LAB.MANAGER role
        $labManagerRole = RoleModel::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'facility_id' => $facility->id,
                'department_id' => $labDepartment->id,
                'code' => 'LAB.MANAGER',
            ],
            [
                'name' => 'Laboratory Manager',
                'status' => 'active',
                'description' => 'Lab manager - can manage lab inventory, approve requisitions, manage access',
                'is_system' => false,
                'access_level' => 'manage',
                'scope_type' => 'related_departments',
                'effective_from' => now(),
                'effective_until' => null,
                'related_department_ids' => [], // Will be populated with Pathology, Radiology, Microbiology if they exist
            ]
        );

        // Try to populate related departments
        $relatedDepts = DepartmentModel::where('facility_id', $facility->id)
            ->whereIn('name', ['Pathology', 'Radiology', 'Microbiology'])
            ->pluck('id')
            ->toArray();

        if (!empty($relatedDepts)) {
            $labManagerRole->update(['related_department_ids' => $relatedDepts]);
        }

        // Assign permissions to LAB.MANAGER
        $this->assignPermissionsToRole($labManagerRole, [
            'inventory.view-own-items',
            'inventory.view-department-items',
            'inventory.create-requisition-own-department',
            'inventory.create-requisition-cross-department',
            'inventory.approve-requisition-own-department',
            'inventory.manage-warehouse-own-department',
            'inventory.execute-warehouse-transfer-own-department',
            'inventory.authorize-warehouse-transfer-receiving-department',
            'inventory.dispose-items-own-department',
            'inventory.view-warehouse-own-department',
            'inventory.view-requisition-own',
            'inventory.view-requisition-department',
            'inventory.admin-manage-access',
        ]);

        $this->command->info('Inventory access roles created successfully for Laboratory department!');
        $this->command->info("  - LAB.TECH (Request level)");
        $this->command->info("  - LAB.SUPERVISOR (Approve level)");
        $this->command->info("  - LAB.MANAGER (Manage level)");
    }

    /**
     * Ensure all inventory permissions exist
     */
    private function ensurePermissionsExist(): void
    {
        $permissions = [
            'inventory.view-own-items' => 'View items in own department warehouse only',
            'inventory.view-department-items' => 'View items in own department (manager level)',
            'inventory.view-warehouse-own-department' => 'View warehouse operations for own department',
            'inventory.view-requisition-own' => 'View own requisitions',
            'inventory.view-requisition-department' => 'View department requisitions (manager level)',
            'inventory.create-requisition-own-department' => 'Create requisition for own department',
            'inventory.create-requisition-cross-department' => 'Create requisition for other departments (manager level)',
            'inventory.approve-requisition-own-department' => 'Approve requisitions for own department (manager level)',
            'inventory.approve-requisition-high-value' => 'Approve requisitions >$5,000 (finance level)',
            'inventory.approve-requisition-controlled-substance' => 'Approve controlled substance requisitions (pharmacy level)',
            'inventory.manage-warehouse-own-department' => 'Manage warehouse operations for own department',
            'inventory.manage-warehouse-all' => 'Manage all warehouses (admin only)',
            'inventory.execute-warehouse-transfer-own-department' => 'Initiate transfer from own department warehouse',
            'inventory.authorize-warehouse-transfer-receiving-department' => 'Authorize transfer TO own department (receiving)',
            'inventory.dispose-items-own-department' => 'Mark items as disposed (department manager+)',
            'inventory.dispose-items-controlled-substance' => 'Dispose controlled substances (pharmacy + DEA compliance)',
            'inventory.audit-view-all-items' => 'View all inventory for audit purposes',
            'inventory.audit-view-all-requisitions' => 'View all requisitions for audit (compliance officer)',
            'inventory.audit-view-all-transfers' => 'View all transfers for audit (compliance officer)',
            'inventory.admin-manage-access' => 'Manage user inventory access (admin only)',
            'inventory.admin-manage-settings' => 'Manage inventory system settings (admin only)',
        ];

        foreach ($permissions as $name => $description) {
            Permission::firstOrCreate(
                ['name' => $name],
                ['description' => $description]
            );
        }
    }

    /**
     * Assign permissions to a role
     *
     * @param RoleModel $role
     * @param array $permissionNames
     */
    private function assignPermissionsToRole(RoleModel $role, array $permissionNames): void
    {
        $permissions = Permission::whereIn('name', $permissionNames)->get();
        $role->permissions()->syncWithoutDetaching($permissions->pluck('id'));
    }
}
