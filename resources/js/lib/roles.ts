/**
 * Hospital role definitions and configurations
 * Each role maps to permission patterns and dashboard behavior
 */

export type HISRole =
    | 'registration_clerk'
    | 'nurse'
    | 'doctor'
    | 'pharmacist'
    | 'lab_technician'
    | 'radiologist'
    | 'ward_manager'
    | 'billing_officer'
    | 'it_admin'
    | 'hospital_admin'
    | 'executive';

export const ROLE_LABELS: Record<HISRole, string> = {
    registration_clerk: 'Registration Clerk',
    nurse: 'Nurse',
    doctor: 'Doctor',
    pharmacist: 'Pharmacist',
    lab_technician: 'Lab Technician',
    radiologist: 'Radiologist',
    ward_manager: 'Ward Manager',
    billing_officer: 'Billing Officer',
    it_admin: 'IT Admin',
    hospital_admin: 'Hospital Admin',
    executive: 'Executive',
};

/**
 * Permission patterns for each role
 * Checked in priority order during role detection
 */
export const ROLE_PERMISSION_PATTERNS: Record<HISRole, string[]> = {
    registration_clerk: ['patients.create', 'appointments.read'],
    nurse: ['inpatient.ward.read', 'patients.read', 'medical.records.read'],
    doctor: ['medical.records.read', 'patients.create', 'laboratory.orders.read', 'appointments.read'],
    pharmacist: ['pharmacy.orders.read', 'inventory.procurement.read'],
    lab_technician: ['laboratory.orders.read', 'inventory.procurement.read'],
    radiologist: ['radiology.orders.read', 'patients.read'],
    ward_manager: ['inpatient.ward.read', 'staff.read', 'departments.read'],
    billing_officer: ['billing.invoices.read', 'billing.payer-contracts.read'],
    it_admin: ['platform.users.read', 'platform.rbac.manage-roles'],
    hospital_admin: ['platform.facilities.read', 'staff.read', 'billing.invoices.read'],
    executive: ['billing.financial-controls.read', 'platform.users.read'],
};

/**
 * Desktop-first vs mobile-first roles
 */
export const MOBILE_FIRST_ROLES: Set<HISRole> = new Set([
    'registration_clerk',
    'nurse',
    'doctor',
    'lab_technician',
    'radiologist',
]);

export const DESKTOP_FIRST_ROLES: Set<HISRole> = new Set([
    'pharmacist',
    'ward_manager',
    'billing_officer',
    'it_admin',
    'hospital_admin',
    'executive',
]);

/**
 * Detect primary role from permission list
 * Checks in priority order
 */
export function detectPrimaryRole(permissions: string[] | null): HISRole | null {
    if (!Array.isArray(permissions) || permissions.length === 0) return null;

    const permissionSet = new Set(permissions.map((p) => p.toLowerCase()));

    // Priority order for role detection
    const priorityRoles: HISRole[] = [
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

    for (const role of priorityRoles) {
        const patterns = ROLE_PERMISSION_PATTERNS[role];
        const hasAllPatterns = patterns.some((pattern) =>
            permissionSet.has(pattern.toLowerCase()),
        );

        if (hasAllPatterns) return role;
    }

    return null;
}

/**
 * Dashboard route for each role
 */
export const ROLE_DASHBOARD_ROUTES: Record<HISRole, string> = {
    registration_clerk: '/dashboard/registration-clerk',
    nurse: '/dashboard/nurse',
    doctor: '/dashboard/doctor',
    pharmacist: '/dashboard/pharmacist',
    lab_technician: '/dashboard/lab-technician',
    radiologist: '/dashboard/radiologist',
    ward_manager: '/dashboard/ward-manager',
    billing_officer: '/dashboard/billing-officer',
    it_admin: '/dashboard/it-admin',
    hospital_admin: '/dashboard/hospital-admin',
    executive: '/dashboard/executive',
};

/**
 * Fallback dashboard for unknown roles
 */
export const FALLBACK_DASHBOARD_ROUTE = '/dashboard';
