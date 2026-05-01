<?php

namespace App\Support;

class RoleDetection
{
    const ROLE_PERMISSION_PATTERNS = [
        'registration_clerk' => ['patients.create', 'appointments.read'],
        'nurse' => ['inpatient.ward.read', 'patients.read', 'medical.records.read'],
        'doctor' => ['medical.records.read', 'patients.create', 'laboratory.orders.read', 'appointments.read'],
        'pharmacist' => ['pharmacy.orders.read', 'inventory.procurement.read'],
        'lab_technician' => ['laboratory.orders.read', 'inventory.procurement.read'],
        'radiologist' => ['radiology.orders.read', 'patients.read'],
        'ward_manager' => ['inpatient.ward.read', 'staff.read', 'departments.read'],
        'billing_officer' => ['billing.invoices.read', 'billing.payer-contracts.read'],
        'it_admin' => ['platform.users.read', 'platform.rbac.manage-roles'],
        'hospital_admin' => ['platform.facilities.read', 'staff.read', 'billing.invoices.read'],
        'executive' => ['billing.financial-controls.read', 'platform.users.read'],
    ];

    const PRIORITY_ROLES = [
        'registration_clerk',
        'nurse',
        'doctor',
        'pharmacist',
        'lab_technician',
        'radiologist',
        'ward_manager',
        'billing_officer',
        'it_admin',
        'hospital_admin',
        'executive',
    ];

    /**
     * Detect primary role from permission list
     * 
     * @param array $permissions User permission names
     * @return string|null Primary role or null if no match
     */
    public static function detectPrimaryRole(?array $permissions): ?string
    {
        if (!is_array($permissions) || empty($permissions)) {
            return null;
        }

        $permissionSet = array_map('strtolower', $permissions);

        foreach (self::PRIORITY_ROLES as $role) {
            $patterns = self::ROLE_PERMISSION_PATTERNS[$role] ?? [];
            
            // Check if user has ANY of the role's required permissions
            foreach ($patterns as $pattern) {
                if (in_array(strtolower($pattern), $permissionSet)) {
                    return $role;
                }
            }
        }

        return null;
    }
}
