/**
 * Dashboard workflow metadata and client-side fallback eligibility.
 *
 * @deprecated Role-code eligibility mirrors PHP for offline/fallback only.
 * Prefer `useDashboardContext()` and server `GET /api/v1/dashboard/context`.
 * Client role lists will be removed once dashboard context is guaranteed on all routes.
 */

import type { DashboardContextPayload, DashboardWorkflowKey } from '@/types/dashboard';

export type DashboardPresetKey = DashboardWorkflowKey;

export type DashboardPresetDefinition = {
    readonly key: DashboardPresetKey;
    readonly label: string;
    readonly description: string;
    readonly modules: readonly string[];
};

export const DASHBOARD_ADMIN_ROLE_CODES: readonly string[] = [
    'PLATFORM.USER.ADMIN',
    'PLATFORM.RBAC.ADMIN',
    'PLATFORM.SUBSCRIPTION.ADMIN',
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

export const DASHBOARD_EMERGENCY_ROLE_CODES: readonly string[] = [
    'HOSPITAL.EMERGENCY.USER',
    'HOSPITAL.EMERGENCY.NURSE',
    'HOSPITAL.TRIAGE.USER',
];

export const DASHBOARD_FRONT_DESK_ROLE_CODES: readonly string[] = ['HOSPITAL.REGISTRATION.CLERK'];

export const DASHBOARD_OPERATIONS_ROLE_CODES: readonly string[] = [
    'HOSPITAL.STAFF.ADMIN',
    'HOSPITAL.CREDENTIALING.OFFICER',
    'HOSPITAL.PRIVILEGING.REVIEWER',
    'HOSPITAL.PRIVILEGING.APPROVER',
];

export const DASHBOARD_RECORDS_ROLE_CODES: readonly string[] = ['HOSPITAL.MEDICAL.RECORDS.OFFICER'];

export const DASHBOARD_SUPPLY_ROLE_CODES: readonly string[] = ['HOSPITAL.INVENTORY.STOREKEEPER'];

export const DASHBOARD_THEATRE_ROLE_CODES: readonly string[] = ['HOSPITAL.THEATRE.USER'];

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
            'Monitor triage queue, inpatient movement, and downstream orders that block bedside care.',
        modules: ['Triage', 'Admissions', 'Inpatient Ward'],
    },
    {
        key: 'emergency',
        label: 'Emergency',
        description:
            'Triage queue sorted by arrival time, stat orders, and real-time admission load for emergency and acute-care staff.',
        modules: ['Triage', 'Admissions', 'Laboratory', 'Pharmacy'],
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
    {
        key: 'operations',
        label: 'Operations',
        description: 'Staff directory, credentialing compliance, and privileging queues for HR and quality teams.',
        modules: ['Staff', 'Credentialing', 'Privileges'],
    },
    {
        key: 'records',
        label: 'Medical Records',
        description: 'Health information workflows focused on chart completeness, release, and record governance.',
        modules: ['Medical Records', 'Patients', 'Audit'],
    },
    {
        key: 'supply',
        label: 'Supply Chain',
        description: 'Inventory alerts, stock movement, and procurement requests for storekeepers.',
        modules: ['Inventory', 'Procurement', 'Suppliers'],
    },
    {
        key: 'theatre',
        label: 'Theatre',
        description: 'Procedure scheduling, OR resource allocation, and perioperative status at a glance.',
        modules: ['Theatre Procedures', 'Resource Allocation'],
    },
] as const satisfies readonly DashboardPresetDefinition[];

/** First match wins for Auto landing when multiple workflows qualify (mirrors server). */
export const DASHBOARD_PRESET_PRIORITY: readonly DashboardPresetKey[] = [
    'admin',
    'emergency',
    'operations',
    'cashier',
    'clinician',
    'records',
    'nursing',
    'theatre',
    'direct_service',
    'supply',
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

function isOperationsEligible(input: InferDashboardPresetInput): boolean {
    const { roleCodesUpper, hasPermission } = input;
    if (presetMatchesRole(roleCodesUpper, DASHBOARD_OPERATIONS_ROLE_CODES)) {
        return true;
    }
    if (!hasPermission('staff.read')) {
        return false;
    }

    return hasPermission('staff.credentialing.read') || hasPermission('staff.privileges.read');
}

function isRecordsEligible(input: InferDashboardPresetInput): boolean {
    const { roleCodesUpper, hasPermission } = input;
    if (presetMatchesRole(roleCodesUpper, DASHBOARD_RECORDS_ROLE_CODES)) {
        return true;
    }
    if (!hasPermission('medical.records.read')) {
        return false;
    }
    if (presetMatchesRole(roleCodesUpper, DASHBOARD_NURSING_ROLE_CODES)) {
        return false;
    }
    if (presetMatchesRole(roleCodesUpper, DASHBOARD_EMERGENCY_ROLE_CODES)) {
        return false;
    }
    if (presetMatchesRole(roleCodesUpper, DASHBOARD_CLINICIAN_ROLE_CODES)) {
        return false;
    }

    return true;
}

export function resolveDirectServicePresentation(input: InferDashboardPresetInput): {
    label: string;
    description: string;
} {
    const { roleCodesUpper, hasPermission } = input;
    const heldRoles = DASHBOARD_DIRECT_SERVICE_ROLE_CODES.filter((code) => roleCodesUpper.includes(code));

    if (heldRoles.length === 1) {
        switch (heldRoles[0]) {
            case 'HOSPITAL.LABORATORY.USER':
                return {
                    label: 'Laboratory',
                    description: 'Laboratory order queue, specimen processing, and result verification for bench staff.',
                };
            case 'HOSPITAL.PHARMACY.USER':
                return {
                    label: 'Pharmacy',
                    description: 'Pharmacy dispensing queue, order preparation, and verification for dispensary staff.',
                };
            case 'HOSPITAL.RADIOLOGY.USER':
                return {
                    label: 'Radiology',
                    description: 'Imaging order queue, scheduling, and reporting for radiology staff.',
                };
            default:
                break;
        }
    }

    const modules: string[] = [];
    if (hasPermission('laboratory.orders.read')) modules.push('laboratory');
    if (hasPermission('pharmacy.orders.read')) modules.push('pharmacy');
    if (hasPermission('radiology.orders.read')) modules.push('radiology');

    if (modules.length === 1) {
        switch (modules[0]) {
            case 'laboratory':
                return {
                    label: 'Laboratory',
                    description: 'Laboratory order queue, specimen processing, and result verification for bench staff.',
                };
            case 'pharmacy':
                return {
                    label: 'Pharmacy',
                    description: 'Pharmacy dispensing queue, order preparation, and verification for dispensary staff.',
                };
            case 'radiology':
                return {
                    label: 'Radiology',
                    description: 'Imaging order queue, scheduling, and reporting for radiology staff.',
                };
        }
    }

    return {
        label: 'Direct Service',
        description: 'Watch laboratory, pharmacy, and radiology queues without borrowing nursing-only census signals.',
    };
}

/**
 * Client fallback when /dashboard/context is unavailable.
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

    const holdsRecordsRole = presetMatchesRole(roleCodesUpper, DASHBOARD_RECORDS_ROLE_CODES);

    if (presetMatchesRole(roleCodesUpper, DASHBOARD_CLINICIAN_ROLE_CODES)) {
        allow.add('clinician');
    }
    const holdsNursingRole = presetMatchesRole(roleCodesUpper, DASHBOARD_NURSING_ROLE_CODES);
    if (hasPermission('medical.records.read') && !holdsNursingRole && !holdsRecordsRole) {
        allow.add('clinician');
    }
    if (holdsNursingRole) {
        allow.add('nursing');
    }
    const holdsEmergencyRole = presetMatchesRole(roleCodesUpper, DASHBOARD_EMERGENCY_ROLE_CODES);
    if (holdsEmergencyRole) {
        allow.add('emergency');
    }
    if (hasPermission('inpatient.ward.read') && !holdsEmergencyRole) {
        allow.add('nursing');
    }
    if (isOperationsEligible(input)) {
        allow.add('operations');
    }
    if (isRecordsEligible(input)) {
        allow.add('records');
    }
    if (
        presetMatchesRole(roleCodesUpper, DASHBOARD_SUPPLY_ROLE_CODES)
        || (!presetMatchesRole(roleCodesUpper, DASHBOARD_DIRECT_SERVICE_ROLE_CODES)
            && hasPermission('inventory.procurement.read'))
    ) {
        allow.add('supply');
    }
    if (presetMatchesRole(roleCodesUpper, DASHBOARD_THEATRE_ROLE_CODES) || hasPermission('theatre.procedures.read')) {
        allow.add('theatre');
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

export function inferDashboardPreset(input: InferDashboardPresetInput): DashboardPresetKey {
    const ordered = eligibleDashboardPresets(input);
    return ordered[0] ?? 'front_desk';
}

export function workflowDefinitionForKey(key: DashboardPresetKey): DashboardPresetDefinition | undefined {
    return DASHBOARD_PRESETS.find((preset) => preset.key === key);
}

export function resolveDashboardContextFromPayload(
    payload: DashboardContextPayload | null | undefined,
): DashboardContextPayload | null {
    if (!payload?.eligibleWorkflowKeys?.length) {
        return null;
    }

    return payload;
}
