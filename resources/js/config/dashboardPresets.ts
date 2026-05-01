/**
 * Central dashboard preset metadata and primary-role inference (HIS-style workflow landing).
 * Layout and module lists stay here; business logic lives in page composables and APIs.
 */

export type DashboardPresetKey =
    | 'front_desk'
    | 'clinician'
    | 'nursing'
    | 'direct_service'
    | 'cashier'
    | 'admin';

export type DashboardPresetDefinition = {
    readonly key: DashboardPresetKey;
    readonly label: string;
    readonly description: string;
    readonly modules: readonly string[];
};

export const DASHBOARD_ADMIN_ROLE_CODES: readonly string[] = [
    'PLATFORM.USER.ADMIN',
    'PLATFORM.RBAC.ADMIN',
    'HOSPITAL.FACILITY.ADMIN',
    'HOSPITAL.DEPARTMENT.HEAD',
];

export const DASHBOARD_CASHIER_ROLE_CODES: readonly string[] = [
    'HOSPITAL.BILLING.CASHIER',
    'HOSPITAL.BILLING.OFFICER',
    'HOSPITAL.FINANCE.CONTROLLER',
];

export const DASHBOARD_CLINICIAN_ROLE_CODES: readonly string[] = [
    'HOSPITAL.CLINICAL.USER',
    'HOSPITAL.CLINICIAN.ORDERING',
];

export const DASHBOARD_NURSING_ROLE_CODES: readonly string[] = ['HOSPITAL.NURSING.USER'];

export const DASHBOARD_DIRECT_SERVICE_ROLE_CODES: readonly string[] = [
    'HOSPITAL.LABORATORY.USER',
    'HOSPITAL.PHARMACY.USER',
    'HOSPITAL.RADIOLOGY.USER',
];

export const DASHBOARD_FRONT_DESK_ROLE_CODES: readonly string[] = ['HOSPITAL.REGISTRATION.CLERK'];

export const DASHBOARD_PRESETS = [
    {
        key: 'front_desk',
        label: 'Front Desk',
        description:
            'Keep arrivals, registration, and appointment handoffs moving without losing queue context.',
        modules: ['Patients', 'Appointments', 'Admissions'],
    },
    {
        key: 'clinician',
        label: 'Clinician',
        description:
            'Stay focused on consultation-ready encounters, open notes, and inpatient follow-up load.',
        modules: ['Appointments', 'Medical Records', 'Admissions'],
    },
    {
        key: 'nursing',
        label: 'Nursing',
        description:
            'Watch occupancy, inpatient movement, and downstream orders that block bedside care.',
        modules: ['Admissions', 'Inpatient Ward', 'Pharmacy'],
    },
    {
        key: 'direct_service',
        label: 'Direct Service',
        description:
            'Watch laboratory, pharmacy, and radiology queues without borrowing nursing-only census signals.',
        modules: ['Laboratory', 'Pharmacy', 'Radiology'],
    },
    {
        key: 'cashier',
        label: 'Cashier',
        description: 'Prioritize invoice follow-up and payer exception handling from a single landing view.',
        modules: ['Billing', 'Claims', 'Pharmacy'],
    },
    {
        key: 'admin',
        label: 'Admin',
        description: 'Monitor platform health, scope coverage, and operational controls across modules.',
        modules: ['Audit Export', 'Users', 'Facility Config'],
    },
] as const satisfies readonly DashboardPresetDefinition[];

/** First match wins for Auto landing when multiple roles qualify. */
export const DASHBOARD_PRESET_PRIORITY: readonly DashboardPresetKey[] = [
    'admin',
    'cashier',
    'clinician',
    'nursing',
    'direct_service',
    'front_desk',
] as const;

export function presetMatchesRole(roleCodesUpper: readonly string[], configuredRoles: readonly string[]): boolean {
    return roleCodesUpper.some((code) => configuredRoles.includes(code));
}

export type InferDashboardPresetInput = {
    roleCodesUpper: readonly string[];
    isFacilitySuperAdmin: boolean;
    isPlatformSuperAdmin: boolean;
    hasPermission: (name: string) => boolean;
};

/**
 * Workflow presets this session may legitimately operate in (roles + effective permissions union).
 */
export function eligibleDashboardPresets(input: InferDashboardPresetInput): DashboardPresetKey[] {
    const { roleCodesUpper, isFacilitySuperAdmin, isPlatformSuperAdmin, hasPermission } = input;
    const allow = new Set<DashboardPresetKey>();

    if (isFacilitySuperAdmin || isPlatformSuperAdmin || presetMatchesRole(roleCodesUpper, DASHBOARD_ADMIN_ROLE_CODES)) {
        allow.add('admin');
    }
    if (presetMatchesRole(roleCodesUpper, DASHBOARD_CASHIER_ROLE_CODES)) {
        allow.add('cashier');
    }
    if (hasPermission('billing.invoices.read') || hasPermission('claims.insurance.read')) {
        allow.add('cashier');
    }
    if (presetMatchesRole(roleCodesUpper, DASHBOARD_CLINICIAN_ROLE_CODES)) {
        allow.add('clinician');
    }
    /*
     * Nurses often carry medical.records.read for bedside chart viewing, but that is not the same workflow
     * as the Clinician (OPD) dashboard. Showing the Clinician preset here triggers medical-record KPI fetches that
     * may not match the facility's subscribed MR bundle — and it hides Nursing as Auto when priority lists
     * clinician ahead of nursing. Only derive Clinician from this permission when the user is not a nursing-role holder.
     */
    const holdsNursingRole = presetMatchesRole(roleCodesUpper, DASHBOARD_NURSING_ROLE_CODES);
    if (hasPermission('medical.records.read') && !holdsNursingRole) {
        allow.add('clinician');
    }
    if (holdsNursingRole) {
        allow.add('nursing');
    }
    /*
     * Omit admissions.read alone: clerks/registrars need it for workflows but must not inherit the Nursing
     * dashboard (preset priority would also put nursing ahead of front_desk). Ward context is required.
     */
    if (hasPermission('inpatient.ward.read')) {
        allow.add('nursing');
    }
    if (presetMatchesRole(roleCodesUpper, DASHBOARD_DIRECT_SERVICE_ROLE_CODES)) {
        allow.add('direct_service');
    }
    if (
        hasPermission('laboratory.orders.read') ||
        hasPermission('pharmacy.orders.read') ||
        hasPermission('radiology.orders.read')
    ) {
        allow.add('direct_service');
    }
    if (presetMatchesRole(roleCodesUpper, DASHBOARD_FRONT_DESK_ROLE_CODES)) {
        allow.add('front_desk');
    }
    if (hasPermission('patients.read') && hasPermission('appointments.read')) {
        allow.add('front_desk');
    }

    const ordered = DASHBOARD_PRESET_PRIORITY.filter((key) => allow.has(key));
    return ordered.length > 0 ? ordered : ['front_desk'];
}

/** Default landing preset when Override is Auto: highest-precedence stripe among eligible. */
export function inferDashboardPreset(input: InferDashboardPresetInput): DashboardPresetKey {
    const ordered = eligibleDashboardPresets(input);
    return ordered[0] ?? 'front_desk';
}
