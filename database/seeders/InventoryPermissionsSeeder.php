<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class InventoryPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds for inventory access control permissions
     * Phase 1: Department-Level RBAC Implementation
     */
    public function run(): void
    {
        $permissions = [
            // View permissions
            'inventory.view-own-items',
            'inventory.view-department-items',
            'inventory.view-warehouse-own-department',
            'inventory.view-requisition-own',
            'inventory.view-requisition-department',

            // Create permissions
            'inventory.create-requisition-own-department',
            'inventory.create-requisition-cross-department',

            // Approve permissions
            'inventory.approve-requisition-own-department',
            'inventory.approve-requisition-high-value',
            'inventory.approve-requisition-controlled-substance',

            // Warehouse management
            'inventory.manage-warehouse-own-department',
            'inventory.manage-warehouse-all',

            // Transfer permissions
            'inventory.execute-warehouse-transfer-own-department',
            'inventory.authorize-warehouse-transfer-receiving-department',

            // Disposal permissions
            'inventory.dispose-items-own-department',
            'inventory.dispose-items-controlled-substance',

            // Audit permissions
            'inventory.audit-view-all-items',
            'inventory.audit-view-all-requisitions',
            'inventory.audit-view-all-transfers',

            // Admin permissions
            'inventory.admin-manage-access',
            'inventory.admin-manage-settings',
        ];

        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name]);
        }

        $this->command->info('Inventory permissions seeded successfully!');
    }
}
