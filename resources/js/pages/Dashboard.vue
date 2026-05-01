<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { useMasterDataSetupReadiness } from '@/composables/useMasterDataSetupReadiness';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import type { AppIconName } from '@/lib/icons';
import { formatEnumLabel } from '@/lib/labels';
import type { BreadcrumbItem } from '@/types';

type PresetKey = 'front_desk' | 'clinician' | 'nursing' | 'direct_service' | 'cashier' | 'admin';
type TabKey = 'overview' | 'resources';

type ApiEnvelope<T> = { data: T };

type QueueRow = {
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    status: string;
    href: string;
    actionLabel: string;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];
const today = new Date(Date.now() - (new Date().getTimezoneOffset() * 60 * 1000)).toISOString().slice(0, 10);

const presets = [
    {
        key: 'front_desk',
        label: 'Front Desk',
        description: 'Keep arrivals, registration, and appointment handoffs moving without losing queue context.',
        modules: ['Patients', 'Appointments', 'Admissions'],
    },
    {
        key: 'clinician',
        label: 'Clinician',
        description: 'Stay focused on consultation-ready encounters, open notes, and inpatient follow-up load.',
        modules: ['Appointments', 'Medical Records', 'Admissions'],
    },
    {
        key: 'nursing',
        label: 'Nursing',
        description: 'Watch occupancy, inpatient movement, and downstream orders that block bedside care.',
        modules: ['Admissions', 'Inpatient Ward', 'Pharmacy'],
    },
    {
        key: 'direct_service',
        label: 'Direct Service',
        description: 'Watch laboratory, pharmacy, and radiology queues without borrowing nursing-only census signals.',
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
] as const;

const adminRoles = ['PLATFORM.USER.ADMIN', 'PLATFORM.RBAC.ADMIN', 'HOSPITAL.FACILITY.ADMIN', 'HOSPITAL.DEPARTMENT.HEAD'];
const cashierRoles = ['HOSPITAL.BILLING.CASHIER', 'HOSPITAL.BILLING.OFFICER', 'HOSPITAL.FINANCE.CONTROLLER'];
const clinicianRoles = ['HOSPITAL.CLINICAL.USER', 'HOSPITAL.CLINICIAN.ORDERING'];
const nursingRoles = ['HOSPITAL.NURSING.USER'];
const directServiceRoles = ['HOSPITAL.LABORATORY.USER', 'HOSPITAL.PHARMACY.USER', 'HOSPITAL.RADIOLOGY.USER'];
const frontDeskRoles = ['HOSPITAL.REGISTRATION.CLERK'];

const { hasPermission, isFacilitySuperAdmin, multiTenantIsolationEnabled, permissionNames, facilityEntitlementNames } = usePlatformAccess();
const wardBedSetupRequired = computed(() =>
    ['inpatient.ward', 'inpatient.tasks', 'inpatient.care_plans'].some((entitlement) =>
        facilityEntitlementNames.value.includes(entitlement),
    ),
);
const {
    loading: setupReadinessLoading,
    steps: setupSteps,
    loadSetupReadiness,
} = useMasterDataSetupReadiness({ includeWardBeds: wardBedSetupRequired });

const loading = ref(true);
const refreshing = ref(false);
const activeTab = ref<TabKey>('overview');
const presetOverride = ref<PresetKey | 'auto'>('auto');
const failures = ref<Array<{ label: string; message: string }>>([]);

const scopeData = ref<any | null>(null);
const authMe = ref<any | null>(null);
const securityStatus = ref<any | null>(null);
const counts = ref<Record<string, any>>({});
const lists = ref<Record<string, any[]>>({});
const auditExportHealth = ref<any | null>(null);
const retryResumeHealth = ref<any | null>(null);
const lastLoadedAt = ref<string | null>(null);

const frontDeskHandoffOpen = useLocalStorageBoolean('dashboard.front-desk-handoff.open', false);
const clinicianHandoffOpen = useLocalStorageBoolean('dashboard.clinician-handoff.open', false);
const nursingHandoffOpen = useLocalStorageBoolean('dashboard.nursing-handoff.open', false);
const cashierHandoffOpen = useLocalStorageBoolean('dashboard.cashier-handoff.open', false);
const adminHandoffOpen = useLocalStorageBoolean('dashboard.admin-handoff.open', false);

const roleCodes = computed(() =>
    (authMe.value?.roles ?? [])
        .map((role: any) => String(role?.code ?? '').trim().toUpperCase())
        .filter((code: string) => code.length > 0),
);

const canSwitchPreset = computed(() =>
    isFacilitySuperAdmin.value || roleCodes.value.some((code: string) => adminRoles.includes(code)),
);

const inferredPreset = computed<PresetKey>(() => {
    if (isFacilitySuperAdmin.value) return 'admin';
    if (roleCodes.value.some((code: string) => adminRoles.includes(code))) return 'admin';
    if (roleCodes.value.some((code: string) => cashierRoles.includes(code))) return 'cashier';
    if (roleCodes.value.some((code: string) => clinicianRoles.includes(code))) return 'clinician';
    if (roleCodes.value.some((code: string) => nursingRoles.includes(code))) return 'nursing';
    if (roleCodes.value.some((code: string) => directServiceRoles.includes(code))) return 'direct_service';
    if (roleCodes.value.some((code: string) => frontDeskRoles.includes(code))) return 'front_desk';
    if (hasPermission('medical.records.read')) return 'clinician';
    if (hasPermission('billing.invoices.read') || hasPermission('claims.insurance.read')) return 'cashier';
    if (hasPermission('admissions.read') || hasPermission('inpatient.ward.read')) return 'nursing';
    if (hasPermission('laboratory.orders.read') || hasPermission('pharmacy.orders.read') || hasPermission('radiology.orders.read')) return 'direct_service';
    return 'front_desk';
});

const activePresetKey = computed<PresetKey>(() => presetOverride.value === 'auto' ? inferredPreset.value : presetOverride.value);
const activePreset = computed(() => presets.find((preset) => preset.key === activePresetKey.value) ?? presets[0]);
const visiblePresetOptions = computed(() => presets.filter((preset) => preset.key !== 'direct_service'));
const presetSelectValue = computed({
    get: () => presetOverride.value,
    set: (value: string) => {
        if (!canSwitchPreset.value) return;
        presetOverride.value = value === 'auto' ? 'auto' : (value as PresetKey);
    },
});

const partialData = computed(() => failures.value.length > 0);
const failureLabels = computed(() => failures.value.map((failure) => failure.label));
const canReadLaboratoryOrders = computed(
    () => isFacilitySuperAdmin.value || hasPermission('laboratory.orders.read'),
);
const canReadPharmacyOrders = computed(
    () => isFacilitySuperAdmin.value || hasPermission('pharmacy.orders.read'),
);
const canReadRadiologyOrders = computed(
    () => isFacilitySuperAdmin.value || hasPermission('radiology.orders.read'),
);
const canSeeSetupCenter = computed(() =>
    isFacilitySuperAdmin.value
    || permissionNames.value === null
    || hasPermission('inventory.procurement.read')
    || hasPermission('billing.service-catalog.read')
    || hasPermission('platform.clinical-catalog.read')
    || hasPermission('staff.read')
    || hasPermission('patients.read')
    || hasPermission('appointments.read'),
);
const setupStepsForReadiness = computed(() =>
    setupSteps.value.filter((step) => step.key !== 'ward_beds' || wardBedSetupRequired.value),
);
const setupReadinessStepKeys = computed(() => setupStepsForReadiness.value.map((step) => step.key));
const setupReadyStepCount = computed(() => setupStepsForReadiness.value.filter((step) => step.ready).length);
const setupRecommendedNextStep = computed(() =>
    setupStepsForReadiness.value.find((step) => !step.ready) ?? null,
);
const masterDataSetupReady = computed(() =>
    setupReadyStepCount.value === setupStepsForReadiness.value.length && setupStepsForReadiness.value.length > 0,
);
const showSetupReadinessCard = computed(() =>
    canSeeSetupCenter.value && (!masterDataSetupReady.value || activePresetKey.value === 'admin'),
);
const setupReadinessVariant = computed<'secondary' | 'outline'>(() =>
    masterDataSetupReady.value ? 'secondary' : 'outline',
);
const setupReadinessSummary = computed(() => {
    if (setupReadinessLoading.value) {
        return 'Checking facility structure, staff, catalogs, pricing, stock, and patient-registration readiness.';
    }

    if (masterDataSetupReady.value) {
        return 'Facility first-login setup is ready. Continue with patient flow, billing, orders, stock control, and live audit checks.';
    }

    if (setupRecommendedNextStep.value) {
        return `${setupRecommendedNextStep.value.label} is the next required setup step before deeper facility testing becomes safe.`;
    }

    return 'Follow the facility admin setup path so downstream workflows do not start from incomplete foundations.';
});

type DirectServiceModuleSummary = {
    key: 'laboratory' | 'pharmacy' | 'radiology';
    label: string;
    href: string;
    actionLabel: string;
    icon: AppIconName;
    active: number | null;
    completed: number | null;
    subtitle: string;
    meta: string;
    queueStatus: string;
};

const directServiceModules = computed<DirectServiceModuleSummary[]>(() => {
    const modules: DirectServiceModuleSummary[] = [];

    if (canReadLaboratoryOrders.value) {
        const active = numberValue(counts.value.laboratory, ['ordered', 'collected', 'in_progress']);
        const completed = numberValue(counts.value.laboratory, 'completed');
        modules.push({
            key: 'laboratory',
            label: 'Laboratory',
            href: '/laboratory-orders',
            actionLabel: 'Open laboratory',
            icon: 'flask-conical',
            active,
            completed,
            subtitle: 'Orders still waiting on collection, processing, or release.',
            meta: `Active ${active === null ? 'Unavailable' : active.toLocaleString()} | Completed ${completed === null ? 'Unavailable' : completed.toLocaleString()}`,
            queueStatus: active === null ? 'Unavailable' : active > 0 ? 'Active' : 'Stable',
        });
    }

    if (canReadPharmacyOrders.value) {
        const active = numberValue(counts.value.pharmacy, ['pending', 'in_preparation', 'partially_dispensed']);
        const completed = numberValue(counts.value.pharmacy, 'dispensed');
        modules.push({
            key: 'pharmacy',
            label: 'Pharmacy',
            href: '/pharmacy-orders',
            actionLabel: 'Open pharmacy',
            icon: 'pill',
            active,
            completed,
            subtitle: 'Medication orders still waiting on preparation, dispense, or release.',
            meta: `Active ${active === null ? 'Unavailable' : active.toLocaleString()} | Dispensed ${completed === null ? 'Unavailable' : completed.toLocaleString()}`,
            queueStatus: active === null ? 'Unavailable' : active > 0 ? 'Active' : 'Stable',
        });
    }

    if (canReadRadiologyOrders.value) {
        const active = numberValue(counts.value.radiology, ['ordered', 'scheduled', 'in_progress']);
        const completed = numberValue(counts.value.radiology, 'completed');
        modules.push({
            key: 'radiology',
            label: 'Radiology',
            href: '/radiology-orders',
            actionLabel: 'Open radiology',
            icon: 'activity',
            active,
            completed,
            subtitle: 'Studies still waiting on scheduling, execution, or report completion.',
            meta: `Active ${active === null ? 'Unavailable' : active.toLocaleString()} | Completed ${completed === null ? 'Unavailable' : completed.toLocaleString()}`,
            queueStatus: active === null ? 'Unavailable' : active > 0 ? 'Active' : 'Stable',
        });
    }

    return modules;
});

const activeDirectServiceModule = computed(() => {
    const modules = directServiceModules.value.slice();
    modules.sort((left, right) => Number(right.active ?? -1) - Number(left.active ?? -1));
    return modules[0] ?? null;
});

const shouldShowHandoff = computed(() => true);
const handoffOpen = computed({
    get: () => {
        if (activePresetKey.value === 'front_desk') return frontDeskHandoffOpen.value;
        if (activePresetKey.value === 'clinician') return clinicianHandoffOpen.value;
        if (activePresetKey.value === 'nursing' || activePresetKey.value === 'direct_service') return nursingHandoffOpen.value;
        if (activePresetKey.value === 'cashier') return cashierHandoffOpen.value;
        return adminHandoffOpen.value;
    },
    set: (value: boolean) => {
        if (activePresetKey.value === 'front_desk') frontDeskHandoffOpen.value = value;
        else if (activePresetKey.value === 'clinician') clinicianHandoffOpen.value = value;
        else if (activePresetKey.value === 'nursing' || activePresetKey.value === 'direct_service') nursingHandoffOpen.value = value;
        else if (activePresetKey.value === 'cashier') cashierHandoffOpen.value = value;
        else adminHandoffOpen.value = value;
    },
});

function numberValue(source: any, key: string | string[]): number | null {
    if (!source) return null;
    if (Array.isArray(key)) return key.reduce((sum, entry) => sum + Number(source?.[entry] ?? 0), 0);
    return Number(source?.[key] ?? 0);
}

function metric(label: string, help: string, icon: AppIconName, value: number | null) {
    return {
        label,
        help,
        icon,
        value: value === null ? 'Unavailable' : value.toLocaleString(),
        unavailable: value === null,
    };
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed);
}

function formatMoney(value: string | number | null | undefined, currencyCode: string | null | undefined): string {
    const numeric = Number(value ?? 0);
    const currency = String(currencyCode ?? 'TZS');
    if (!Number.isFinite(numeric)) return 'Amount unavailable';
    try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(numeric);
    } catch {
        return `${currency} ${numeric.toLocaleString()}`;
    }
}

function statusVariant(status: string | null | undefined) {
    const normalized = String(status ?? '').trim().toLowerCase();
    if (['checked_in', 'admitted', 'completed', 'paid', 'approved'].includes(normalized)) return 'secondary';
    if (['failed', 'cancelled', 'voided', 'rejected', 'escalated'].includes(normalized)) return 'destructive';
    return 'outline';
}

function firstArray<T = any>(source: any, keys: string[]): T[] {
    for (const key of keys) {
        const value = source?.[key];
        if (Array.isArray(value)) return value as T[];
    }
    return [];
}

function isUnauthorized(message: string) {
    const normalized = message.trim().toLowerCase();
    return normalized.includes('unauthorized') || normalized.startsWith('403 ');
}
async function apiGet<T>(path: string, query?: Record<string, string | number | null | undefined>) {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof payload?.message === 'string' ? payload.message : `${response.status} ${response.statusText}`);
    }

    return payload as T;
}

async function safeRequest<T>(label: string, callback: () => Promise<T>) {
    try {
        return await callback();
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (!isUnauthorized(message)) failures.value.push({ label, message });
        return null;
    }
}

async function guardedRequest<T>(label: string, permission: string, callback: () => Promise<T>) {
    if (!isFacilitySuperAdmin.value && !hasPermission(permission)) return null;
    return safeRequest(label, callback);
}

async function loadDashboard() {
    failures.value = [];

    const [
        scopeResponse,
        authResponse,
        securityResponse,
        patientCountsResponse,
        appointmentCountsResponse,
        admissionCountsResponse,
        medicalRecordCountsResponse,
        wardTaskCountsResponse,
        wardCarePlanCountsResponse,
        wardDischargeChecklistCountsResponse,
        laboratoryCountsResponse,
        pharmacyCountsResponse,
        radiologyCountsResponse,
        billingCountsResponse,
        claimOpenCountsResponse,
        claimResolvedCountsResponse,
        scheduledAppointmentsResponse,
        checkedInAppointmentsResponse,
        admissionsResponse,
        draftInvoicesResponse,
        auditExportHealthResponse,
        retryResumeHealthResponse,
    ] = await Promise.all([
        safeRequest<ApiEnvelope<any>>('Scope', () => apiGet('/platform/access-scope')),
        safeRequest<ApiEnvelope<any>>('Auth user', () => apiGet('/auth/me')),
        safeRequest<ApiEnvelope<any>>('Security status', () => apiGet('/auth/me/security-status')),
        guardedRequest<ApiEnvelope<any>>('Patient counts', 'patients.read', () => apiGet('/patients/status-counts')),
        guardedRequest<ApiEnvelope<any>>('Appointment counts', 'appointments.read', () => apiGet('/appointments/status-counts')),
        guardedRequest<ApiEnvelope<any>>('Admission counts', 'admissions.read', () => apiGet('/admissions/status-counts')),
        guardedRequest<ApiEnvelope<any>>('Medical record counts', 'medical.records.read', () => apiGet('/medical-records/status-counts')),
        guardedRequest<ApiEnvelope<any>>('Ward task counts', 'inpatient.ward.read', () => apiGet('/inpatient-ward/task-status-counts')),
        guardedRequest<ApiEnvelope<any>>('Ward care plan counts', 'inpatient.ward.read', () => apiGet('/inpatient-ward/care-plan-status-counts')),
        guardedRequest<ApiEnvelope<any>>('Ward discharge checklist counts', 'inpatient.ward.read', () => apiGet('/inpatient-ward/discharge-checklist-status-counts')),
        guardedRequest<ApiEnvelope<any>>('Laboratory counts', 'laboratory.orders.read', () => apiGet('/laboratory-orders/status-counts')),
        guardedRequest<ApiEnvelope<any>>('Pharmacy counts', 'pharmacy.orders.read', () => apiGet('/pharmacy-orders/status-counts')),
        guardedRequest<ApiEnvelope<any>>('Radiology counts', 'radiology.orders.read', () => apiGet('/radiology-orders/status-counts')),
        guardedRequest<ApiEnvelope<any>>('Billing counts', 'billing.invoices.read', () => apiGet('/billing-invoices/status-counts')),
        guardedRequest<ApiEnvelope<any>>('Open claim exceptions', 'claims.insurance.read', () => apiGet('/claims-insurance/status-counts', { reconciliationExceptionStatus: 'open' })),
        guardedRequest<ApiEnvelope<any>>('Resolved claim exceptions', 'claims.insurance.read', () => apiGet('/claims-insurance/status-counts', { reconciliationExceptionStatus: 'resolved' })),
        guardedRequest<ApiEnvelope<any>>('Scheduled appointments', 'appointments.read', () => apiGet('/appointments', { status: 'scheduled', perPage: 3, sortBy: 'scheduledAt', sortDir: 'asc' })),
        guardedRequest<ApiEnvelope<any>>('Checked-in appointments', 'appointments.read', () => apiGet('/appointments', { status: 'checked_in', perPage: 2, sortBy: 'scheduledAt', sortDir: 'asc' })),
        guardedRequest<ApiEnvelope<any>>('Admissions', 'admissions.read', () => apiGet('/admissions', { status: 'admitted', perPage: 2, sortBy: 'admittedAt', sortDir: 'desc' })),
        guardedRequest<ApiEnvelope<any>>('Draft invoices', 'billing.invoices.read', () => apiGet('/billing-invoices', { status: 'draft', perPage: 3 })),
        safeRequest<ApiEnvelope<any>>('Audit export health', () => apiGet('/platform/audit-export-jobs/health', { days: 7, failureLimit: 5 })),
        safeRequest<ApiEnvelope<any>>('Retry-resume telemetry', () => apiGet('/platform/audit-export-jobs/retry-resume-telemetry/health', { days: 7, failureLimit: 5 })),
    ]);

    scopeData.value = scopeResponse?.data ?? null;
    authMe.value = authResponse?.data ?? null;
    securityStatus.value = securityResponse?.data ?? null;
    counts.value = {
        patients: patientCountsResponse?.data ?? null,
        appointments: appointmentCountsResponse?.data ?? null,
        admissions: admissionCountsResponse?.data ?? null,
        medicalRecords: medicalRecordCountsResponse?.data ?? null,
        wardTasks: wardTaskCountsResponse?.data ?? null,
        wardCarePlans: wardCarePlanCountsResponse?.data ?? null,
        wardDischargeChecklists: wardDischargeChecklistCountsResponse?.data ?? null,
        laboratory: laboratoryCountsResponse?.data ?? null,
        pharmacy: pharmacyCountsResponse?.data ?? null,
        radiology: radiologyCountsResponse?.data ?? null,
        billing: billingCountsResponse?.data ?? null,
        claimOpen: claimOpenCountsResponse?.data ?? null,
        claimResolved: claimResolvedCountsResponse?.data ?? null,
    };
    lists.value = {
        scheduledAppointments: scheduledAppointmentsResponse?.data ?? [],
        checkedInAppointments: checkedInAppointmentsResponse?.data ?? [],
        admissions: admissionsResponse?.data ?? [],
        draftInvoices: draftInvoicesResponse?.data ?? [],
    };
    auditExportHealth.value = auditExportHealthResponse?.data ?? null;
    retryResumeHealth.value = retryResumeHealthResponse?.data ?? null;
    lastLoadedAt.value = new Date().toISOString();

    if (canSeeSetupCenter.value) {
        await loadSetupReadiness(setupReadinessStepKeys.value);
    }
}

async function refreshDashboard() {
    if (refreshing.value) return;
    refreshing.value = true;
    try {
        await loadDashboard();
    } finally {
        refreshing.value = false;
    }
}

const kpis = computed(() => {
    if (activePresetKey.value === 'front_desk') {
        return [
            metric('Active patients', 'Patients currently active in the shared queue scope.', 'users', numberValue(counts.value.patients, 'active')),
            metric('Scheduled appointments', 'Appointments still scheduled for arrival.', 'calendar', numberValue(counts.value.appointments, 'scheduled')),
            metric('Checked-in handoff', 'Patients ready for upstream handoff.', 'calendar-clock', numberValue(counts.value.appointments, 'checked_in')),
            metric('Active admissions', 'Patients currently admitted.', 'bed-double', numberValue(counts.value.admissions, 'admitted')),
        ];
    }
    if (activePresetKey.value === 'clinician') {
        return [
            metric('Checked in', 'Encounters ready for consultation pickup.', 'calendar-clock', numberValue(counts.value.appointments, 'checked_in')),
            metric('Draft records', 'Documentation still open or unfinished.', 'clipboard-list', numberValue(counts.value.medicalRecords, 'draft')),
            metric('Admitted follow-ups', 'Patients still admitted and likely needing review.', 'bed-double', numberValue(counts.value.admissions, 'admitted')),
            metric('Pending lab orders', 'Laboratory orders still active downstream.', 'flask-conical', numberValue(counts.value.laboratory, ['ordered', 'collected', 'in_progress'])),
        ];
    }
    if (activePresetKey.value === 'direct_service') {
        return [
            ...directServiceModules.value.map((module) =>
                metric(
                    `Pending ${module.label.toLowerCase()} orders`,
                    module.subtitle,
                    module.icon,
                    module.active,
                ),
            ),
            metric('Service queues in scope', 'Direct-service modules available in this session.', 'building-2', directServiceModules.value.length),
        ];
    }
    if (activePresetKey.value === 'nursing') {
        return [
            metric('Admitted now', 'Current admitted census in scope.', 'bed-double', numberValue(counts.value.admissions, 'admitted')),
            metric('Pending lab orders', 'Laboratory work still blocking bedside flow.', 'flask-conical', numberValue(counts.value.laboratory, ['ordered', 'collected', 'in_progress'])),
            metric('Pending pharmacy orders', 'Pharmacy work that still needs completion.', 'pill', numberValue(counts.value.pharmacy, ['pending', 'in_preparation', 'partially_dispensed'])),
            metric('Escalated ward tasks', 'Ward follow-up items marked escalated.', 'alert-triangle', numberValue(counts.value.wardTasks, 'escalated')),
        ];
    }
    if (activePresetKey.value === 'cashier') {
        return [
            metric('Draft invoices', 'Invoices still waiting for billing action.', 'receipt', numberValue(counts.value.billing, 'draft')),
            metric('Open claim exceptions', 'Claims still carrying active reconciliation exceptions.', 'alert-triangle', numberValue(counts.value.claimOpen, 'total')),
            metric('Resolved claim exceptions', 'Claims already closed out from exception follow-up.', 'check-circle', numberValue(counts.value.claimResolved, 'total')),
            metric('Partial payments', 'Invoices that still carry a remaining balance.', 'receipt', numberValue(counts.value.billing, 'partially_paid')),
        ];
    }
    return [
        metric('Audit export backlog', 'Queued or processing export jobs across accessible modules.', 'activity', numberValue(auditExportHealth.value?.aggregate, 'currentBacklog')),
        metric('Recent export failures', 'Failed export jobs from the recent health window.', 'alert-triangle', numberValue(auditExportHealth.value?.aggregate, 'recentFailed')),
        metric('Accessible facilities', 'Facilities currently visible in this workstation scope.', 'building-2', Number(scopeData.value?.userAccess?.accessibleFacilityCount ?? 0)),
        metric('Ward escalations', 'Escalated inpatient tasks still visible in scope.', 'bed-double', numberValue(counts.value.wardTasks, 'escalated')),
    ];
});
const actions = computed(() => {
    if (activePresetKey.value === 'front_desk') {
        return [
            { label: 'Patients', icon: 'users', variant: 'default', href: '/patients' },
            { label: 'Today queue', icon: 'calendar-clock', variant: 'outline', href: `/appointments?view=queue&from=${today}` },
            { label: 'Admissions', icon: 'bed-double', variant: 'outline', href: '/admissions?view=queue' },
        ];
    }
    if (activePresetKey.value === 'clinician') {
        return [
            { label: 'Open checked-in queue', icon: 'calendar-clock', variant: 'default', href: `/appointments?view=queue&status=checked_in&from=${today}` },
            { label: 'Open medical records', icon: 'clipboard-list', variant: 'outline', href: '/medical-records' },
            { label: 'Admissions', icon: 'bed-double', variant: 'outline', href: '/admissions?view=queue' },
        ];
    }
    if (activePresetKey.value === 'direct_service') {
        return directServiceModules.value.map((module, index) => ({
            label: module.label,
            icon: module.icon,
            variant: index === 0 ? 'default' : 'outline',
            href: module.href,
        }));
    }
    if (activePresetKey.value === 'nursing') {
        return [
            { label: 'Admission queue', icon: 'layout-list', variant: 'default', href: '/admissions?view=queue' },
            { label: 'Bed board', icon: 'layout-grid', variant: 'outline', href: '/admissions?view=board' },
            { label: 'Inpatient ward', icon: 'bed-double', variant: 'outline', href: '/inpatient-ward' },
        ];
    }
    if (activePresetKey.value === 'cashier') {
        return [
            { label: 'Billing drafts', icon: 'receipt', variant: 'default', href: '/billing-invoices?status=draft' },
            { label: 'Claim exceptions', icon: 'alert-triangle', variant: 'outline', href: '/claims-insurance?reconciliationExceptionStatus=open' },
            { label: 'All invoices', icon: 'receipt', variant: 'outline', href: '/billing-invoices' },
        ];
    }
    return [
        { label: 'Setup Center', icon: 'layout-list', variant: masterDataSetupReady.value ? 'outline' : 'default', href: '/setup-center' },
        { label: 'Audit export', icon: 'activity', variant: 'outline', onClick: () => { activeTab.value = 'resources'; } },
        { label: 'Platform users', icon: 'users', variant: 'outline', href: '/platform/admin/users' },
    ];
});

const queueRows = computed<QueueRow[]>(() => {
    if (activePresetKey.value === 'front_desk') {
        return (lists.value.scheduledAppointments ?? []).slice(0, 3).map((item: any) => ({
            id: String(item.id ?? item.appointmentNumber ?? Math.random()),
            title: String(item.appointmentNumber ?? 'Scheduled appointment'),
            subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Arrival still needs front-desk handling.',
            meta: `Scheduled ${formatDateTime(item.scheduledAt)}`,
            status: formatEnumLabel(String(item.status ?? 'scheduled')),
            href: `/appointments?view=queue&focusAppointmentId=${encodeURIComponent(String(item.id ?? ''))}&from=${today}`,
            actionLabel: 'Open queue',
        }));
    }
    if (activePresetKey.value === 'clinician') {
        return (lists.value.checkedInAppointments ?? []).slice(0, 2).map((item: any) => ({
            id: String(item.id ?? item.appointmentNumber ?? Math.random()),
            title: String(item.appointmentNumber ?? 'Checked-in appointment'),
            subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Encounter is ready for consultation pickup.',
            meta: `Scheduled ${formatDateTime(item.scheduledAt)}`,
            status: formatEnumLabel(String(item.status ?? 'checked_in')),
            href: `/appointments?view=queue&status=checked_in&focusAppointmentId=${encodeURIComponent(String(item.id ?? ''))}&from=${today}`,
            actionLabel: 'Open queue',
        }));
    }
    if (activePresetKey.value === 'direct_service') {
        return directServiceModules.value.map((module) => ({
            id: `direct-service-${module.key}`,
            title: `${module.label} queue`,
            subtitle: module.subtitle,
            meta: module.meta,
            status: module.queueStatus,
            href: module.href,
            actionLabel: module.actionLabel,
        }));
    }
    if (activePresetKey.value === 'nursing') {
        return (lists.value.admissions ?? []).slice(0, 2).map((item: any) => ({
            id: String(item.id ?? item.admissionNumber ?? Math.random()),
            title: String(item.admissionNumber ?? 'Active admission'),
            subtitle: [item.ward, item.bed, item.admissionReason].filter(Boolean).join(' | ') || 'Admission needs ward or bed-flow review.',
            meta: `Admitted ${formatDateTime(item.admittedAt)}`,
            status: formatEnumLabel(String(item.status ?? 'admitted')),
            href: '/admissions?view=queue',
            actionLabel: 'Open admissions',
        }));
    }
    if (activePresetKey.value === 'cashier') {
        return (lists.value.draftInvoices ?? []).slice(0, 3).map((item: any) => ({
            id: String(item.id ?? item.invoiceNumber ?? Math.random()),
            title: String(item.invoiceNumber ?? 'Draft invoice'),
            subtitle: formatMoney(item.totalAmount, item.currencyCode),
            meta: item.paymentDueAt ? `Due ${formatDateTime(item.paymentDueAt)}` : `Created ${formatDateTime(item.createdAt)}`,
            status: formatEnumLabel(String(item.status ?? 'draft')),
            href: '/billing-invoices?status=draft',
            actionLabel: 'Open billing',
        }));
    }
    return (auditExportHealth.value?.recentFailures ?? []).slice(0, 3).map((item: any) => ({
        id: String(item.id ?? Math.random()),
        title: String(item.targetResourceId ?? 'Failed export job'),
        subtitle: String(item.errorMessage ?? 'Export failed and needs review.'),
        meta: `${formatEnumLabel(String(item.moduleKey ?? 'module'))} | ${formatDateTime(item.failedAt ?? item.createdAt)}`,
        status: 'Failed',
        href: '#dashboard-resources',
        actionLabel: 'Open resources',
    }));
});

const queueTitle = computed(() => {
    if (activePresetKey.value === 'front_desk') return 'Upcoming arrivals';
    if (activePresetKey.value === 'clinician') return 'Consultation-ready queue';
    if (activePresetKey.value === 'direct_service') return 'Direct-service queues';
    if (activePresetKey.value === 'nursing') return 'Live admissions view';
    if (activePresetKey.value === 'cashier') return 'Live billing preview';
    return 'Recent export failures';
});

const queueDescription = computed(() => {
    if (activePresetKey.value === 'front_desk') return 'Scheduled arrivals that still need registration or queue attention.';
    if (activePresetKey.value === 'clinician') return 'Checked-in encounters ready for consultation pickup.';
    if (activePresetKey.value === 'direct_service') return 'Accessible laboratory, pharmacy, and radiology worklists for this session.';
    if (activePresetKey.value === 'nursing') return 'Admitted patients that still need ward action or bed review.';
    if (activePresetKey.value === 'cashier') return 'Draft billing work that still needs invoice follow-up.';
    return 'Failures and backlog signals from audit export health.';
});

const handoff = computed(() => {
    if (activePresetKey.value === 'front_desk') {
        const checkedIn = numberValue(counts.value.appointments, 'checked_in');
        const scheduled = numberValue(counts.value.appointments, 'scheduled');
        const activePatients = numberValue(counts.value.patients, 'active');
        const hasCheckedInBlocker = Number(checkedIn ?? 0) > 0;
        const hasScheduledBlocker = Number(scheduled ?? 0) > 0;

        return {
            title: 'Front desk handoff',
            note: 'Reception to clinical queue',
            blockerTitle: hasCheckedInBlocker
                ? 'Checked-in patients awaiting pickup'
                : hasScheduledBlocker
                    ? 'Scheduled arrivals still open'
                    : 'No critical front desk blockers',
            blockerNote: hasCheckedInBlocker
                ? 'The clinician handoff queue is already forming.'
                : hasScheduledBlocker
                    ? 'Upcoming appointments still need check-in coverage.'
                    : 'Confirm scope before relying on front-desk queue counts.',
            nextAction: hasCheckedInBlocker
                ? 'Start from the checked-in queue so no patient handoff is missed.'
                : 'Review remaining scheduled arrivals and patient search requests.',
            primaryAction: {
                label: hasCheckedInBlocker ? 'Open checked-in queue' : 'Open appointments',
                href: hasCheckedInBlocker ? `/appointments?view=queue&status=checked_in&from=${today}` : `/appointments?view=queue&from=${today}`,
            },
            secondaryAction: { label: 'Open patients', href: '/patients' },
            chips: [
                { label: 'Active patients', value: activePatients },
                { label: 'Scheduled', value: scheduled },
                { label: 'Checked in', value: checkedIn },
            ],
        };
    }
    if (activePresetKey.value === 'clinician') {
        const checkedIn = numberValue(counts.value.appointments, 'checked_in');
        const draftRecords = numberValue(counts.value.medicalRecords, 'draft');
        const admittedFollowUps = numberValue(counts.value.admissions, 'admitted');
        const hasDraftBlocker = Number(draftRecords ?? 0) > 0;
        const hasCheckedInBlocker = Number(checkedIn ?? 0) > 0;

        return {
            title: 'Clinician handoff',
            note: 'OPD and inpatient clinical flow',
            blockerTitle: hasDraftBlocker
                ? 'Draft records still open'
                : hasCheckedInBlocker
                    ? 'Checked-in consultations waiting'
                    : Number(admittedFollowUps ?? 0) > 0
                        ? 'Active inpatient follow-up load'
                        : 'No critical clinician blockers',
            blockerNote: hasDraftBlocker
                ? 'Clinical documentation still needs completion or finalization.'
                : hasCheckedInBlocker
                    ? 'Patients are ready to be picked up into active consultation.'
                    : Number(admittedFollowUps ?? 0) > 0
                        ? 'Current inpatients may still need progress review or discharge decisions.'
                        : 'Consultation queue and note backlog are stable for the next clinical shift.',
            nextAction: hasCheckedInBlocker
                ? 'Start the next consultation without leaving the current preset.'
                : hasDraftBlocker
                    ? 'Review incomplete notes before new backlog accumulates.'
                    : 'Review active inpatients for continuation planning.',
            primaryAction: {
                label: hasCheckedInBlocker ? 'Open checked-in queue' : 'Open medical records',
                href: hasCheckedInBlocker ? `/appointments?view=queue&status=checked_in&from=${today}` : '/medical-records',
            },
            secondaryAction: { label: 'Open admissions', href: '/admissions?view=queue' },
            chips: [
                { label: 'Checked in', value: checkedIn },
                { label: 'Draft notes', value: draftRecords },
                { label: 'Admitted follow-ups', value: admittedFollowUps },
            ],
        };
    }
    if (activePresetKey.value === 'direct_service') {
        const leadModule = activeDirectServiceModule.value;
        const secondaryModule = directServiceModules.value[1] ?? null;
        const hasActiveQueue = Number(leadModule?.active ?? 0) > 0;

        return {
            title: 'Direct-service handoff',
            note: 'Laboratory, pharmacy, and radiology flow',
            blockerTitle: leadModule
                ? hasActiveQueue
                    ? `${leadModule.label} queue still active`
                    : `${leadModule.label} queue stable`
                : 'No direct-service modules available',
            blockerNote: leadModule
                ? hasActiveQueue
                    ? leadModule.subtitle
                    : `${leadModule.label} queue looks stable for this session.`
                : 'No direct-service modules are available in this session scope.',
            nextAction: leadModule
                ? hasActiveQueue
                    ? `Start from ${leadModule.label.toLowerCase()} so service queue work keeps moving.`
                    : `Open ${leadModule.label.toLowerCase()} to confirm the queue is still clear.`
                : 'Refresh scope or permissions before relying on this dashboard.',
            primaryAction: leadModule
                ? { label: leadModule.actionLabel, href: leadModule.href }
                : { label: 'Refresh dashboard', href: '/dashboard' },
            secondaryAction: secondaryModule
                ? { label: secondaryModule.actionLabel, href: secondaryModule.href }
                : { label: 'Open resources', href: '/dashboard#dashboard-resources' },
            chips: directServiceModules.value.slice(0, 3).map((module) => ({
                label: module.label,
                value: module.active,
            })),
        };
    }
    if (activePresetKey.value === 'nursing') {
        const escalatedTasks = numberValue(counts.value.wardTasks, 'escalated');
        const blockedDischarge = numberValue(counts.value.wardDischargeChecklists, ['blocked', 'pending']);
        const pendingLab = numberValue(counts.value.laboratory, ['ordered', 'collected', 'in_progress']);
        const pendingPharmacy = numberValue(counts.value.pharmacy, ['pending', 'in_preparation', 'partially_dispensed']);
        const hasEscalated = Number(escalatedTasks ?? 0) > 0;

        return {
            title: 'Nursing handoff',
            note: 'Ward operations',
            blockerTitle: hasEscalated
                ? 'Immediate bedside follow-up still needs acknowledgement.'
                : Number(blockedDischarge ?? 0) > 0
                    ? 'Blocked discharge checklists'
                    : Number(pendingLab ?? 0) > 0
                        ? 'Pending lab follow-up'
                        : 'No critical nursing blockers',
            blockerNote: hasEscalated
                ? 'Review task escalation or discharge blockers before closing handoff.'
                : Number(blockedDischarge ?? 0) > 0
                    ? 'Bed occupancy and discharge readiness need another pass.'
                    : Number(pendingLab ?? 0) > 0
                        ? 'Check which laboratory work is still blocking bedside care.'
                        : 'Bed occupancy and discharge readiness look stable for the next shift.',
            nextAction: Number(blockedDischarge ?? 0) > 0
                ? 'Review current occupancy and placement before the next handoff.'
                : 'Start from the live admissions view, then step into ward follow-up.',
            primaryAction: { label: 'Open bed board', href: '/admissions?view=board' },
            secondaryAction: { label: 'Open inpatient ward', href: '/inpatient-ward' },
            chips: [
                { label: 'Admitted now', value: numberValue(counts.value.admissions, 'admitted') },
                { label: 'Pending pharmacy', value: pendingPharmacy },
                { label: 'Escalated tasks', value: escalatedTasks },
            ],
        };
    }
    if (activePresetKey.value === 'cashier') {
        const openClaims = numberValue(counts.value.claimOpen, 'total');
        const draftInvoices = numberValue(counts.value.billing, 'draft');
        const partialPayments = numberValue(counts.value.billing, 'partially_paid');

        return {
            title: 'Cashier shift handoff',
            note: 'Billing and payer follow-up',
            blockerTitle: Number(openClaims ?? 0) > 0
                ? 'Open claims exceptions'
                : Number(draftInvoices ?? 0) > 0
                    ? 'Draft invoices awaiting issue'
                    : Number(partialPayments ?? 0) > 0
                        ? 'Partially paid invoices'
                        : 'No critical cashier blockers',
            blockerNote: Number(openClaims ?? 0) > 0
                ? 'Payer blockers are still holding reconciliation open.'
                : Number(draftInvoices ?? 0) > 0
                    ? 'Revenue still depends on invoice completion or release.'
                    : Number(partialPayments ?? 0) > 0
                        ? 'Outstanding balances still need cashier follow-up.'
                        : 'Billing queues look stable for the next cashier handoff.',
            nextAction: Number(openClaims ?? 0) > 0
                ? 'Start with payer exceptions that are still blocking reconciliation.'
                : 'Review invoice drafts and partially paid balances next.',
            primaryAction: {
                label: Number(openClaims ?? 0) > 0 ? 'Open claim queue' : 'Open billing drafts',
                href: Number(openClaims ?? 0) > 0 ? '/claims-insurance?reconciliationExceptionStatus=open' : '/billing-invoices?status=draft',
            },
            secondaryAction: { label: 'Open billing', href: '/billing-invoices' },
            chips: [
                { label: 'Open claims', value: openClaims },
                { label: 'Draft invoices', value: draftInvoices },
                { label: 'Partially paid', value: partialPayments },
            ],
        };
    }

    const recentExportFailures = numberValue(auditExportHealth.value?.aggregate, 'recentFailed');
    const exportBacklog = numberValue(auditExportHealth.value?.aggregate, 'currentBacklog');
    const wardEscalations = numberValue(counts.value.wardTasks, 'escalated');
    const accessibleFacilities = Number(scopeData.value?.userAccess?.accessibleFacilityCount ?? 0);

    return {
        title: 'Operations handoff',
        note: 'Platform and operational oversight',
        blockerTitle: accessibleFacilities === 0
            ? 'Scope needs attention'
            : Number(recentExportFailures ?? 0) > 0
                ? 'Recent audit export failures'
                : Number(wardEscalations ?? 0) > 0
                    ? 'Ward escalations still open'
                    : 'No critical admin blockers',
        blockerNote: accessibleFacilities === 0
            ? 'Confirm tenant/facility scope before trusting any queue metrics.'
            : Number(recentExportFailures ?? 0) > 0
                ? 'Recent failed export jobs need review before the next shift.'
                : Number(wardEscalations ?? 0) > 0
                    ? 'The next operations lead should review current ward escalations.'
                    : 'Operational scope and platform queues look stable for the next lead.',
        nextAction: accessibleFacilities === 0
            ? 'Review scope selection before moving into operational queues.'
            : 'Switch to resources for export health, retry-resume telemetry, and workstation context.',
        primaryAction: {
            label: accessibleFacilities === 0 ? 'Review scope' : 'Open audit export',
            href: '/dashboard#dashboard-resources',
        },
        secondaryAction: { label: 'Platform users', href: '/platform/admin/users' },
        chips: [
            { label: 'Accessible facilities', value: Number.isFinite(accessibleFacilities) ? accessibleFacilities : null },
            { label: 'Export backlog', value: exportBacklog },
            { label: 'Recent failures', value: recentExportFailures },
        ],
    };
});

const watchItems = computed(() => {
    if (activePresetKey.value === 'front_desk') {
        return [
            {
                label: 'Checked-in handoff',
                note: 'Arrivals already ready for clinician handoff.',
                value: numberValue(counts.value.appointments, 'checked_in'),
                href: `/appointments?view=queue&status=checked_in&from=${today}`,
                actionLabel: 'Open checked-in queue',
                icon: 'calendar-clock' as AppIconName,
            },
            {
                label: 'Scheduled arrivals still open',
                note: 'Upcoming appointments still need check-in coverage.',
                value: numberValue(counts.value.appointments, 'scheduled'),
                href: `/appointments?view=queue&from=${today}`,
                actionLabel: 'Open appointments',
                icon: 'calendar' as AppIconName,
            },
            {
                label: 'Active patient records',
                note: 'Registration-ready records still need desk attention.',
                value: numberValue(counts.value.patients, 'active'),
                href: '/patients',
                actionLabel: 'Open patients',
                icon: 'users' as AppIconName,
            },
        ];
    }

    if (activePresetKey.value === 'clinician') {
        return [
            {
                label: 'Pending laboratory decisions',
                note: 'Outstanding lab work may still be blocking treatment plans.',
                value: numberValue(counts.value.laboratory, ['ordered', 'collected', 'in_progress']),
                href: '/laboratory-orders',
                actionLabel: 'Open laboratory',
                icon: 'flask-conical' as AppIconName,
            },
            {
                label: 'Draft records still open',
                note: 'Clinical documentation still needs completion or finalization.',
                value: numberValue(counts.value.medicalRecords, 'draft'),
                href: '/medical-records',
                actionLabel: 'Open medical records',
                icon: 'clipboard-list' as AppIconName,
            },
            {
                label: 'Active inpatient follow-up load',
                note: 'Current inpatients may still need progress review or discharge decisions.',
                value: numberValue(counts.value.admissions, 'admitted'),
                href: '/admissions?view=queue',
                actionLabel: 'Open admissions',
                icon: 'bed-double' as AppIconName,
            },
        ];
    }

    if (activePresetKey.value === 'direct_service') {
        return directServiceModules.value.map((module) => ({
            label: `${module.label} active queue`,
            note: module.subtitle,
            value: module.active,
            href: module.href,
            actionLabel: module.actionLabel,
            icon: module.icon,
        }));
    }
    if (activePresetKey.value === 'nursing') {
        return [
            {
                label: 'Blocked discharge checklists',
                note: 'Discharge blockers are still open on active inpatients.',
                value: numberValue(counts.value.wardDischargeChecklists, ['blocked', 'pending']),
                href: '/inpatient-ward',
                actionLabel: 'Open inpatient ward',
                icon: 'bed-double' as AppIconName,
            },
            {
                label: 'Pending lab follow-up',
                note: 'Orders are still waiting on collection or result handoff.',
                value: numberValue(counts.value.laboratory, ['ordered', 'collected', 'in_progress']),
                href: '/laboratory-orders',
                actionLabel: 'Open laboratory',
                icon: 'flask-conical' as AppIconName,
            },
            {
                label: 'Pending medication dispense',
                note: 'Medication requests are still queued for the ward.',
                value: numberValue(counts.value.pharmacy, ['pending', 'in_preparation', 'partially_dispensed']),
                href: '/pharmacy-orders',
                actionLabel: 'Open pharmacy',
                icon: 'pill' as AppIconName,
            },
        ];
    }

    if (activePresetKey.value === 'cashier') {
        return [
            {
                label: 'Open claims exceptions',
                note: 'Payer exceptions still blocking reconciliation.',
                value: numberValue(counts.value.claimOpen, 'total'),
                href: '/claims-insurance?reconciliationExceptionStatus=open',
                actionLabel: 'Open claims',
                icon: 'alert-triangle' as AppIconName,
            },
            {
                label: 'Draft invoices awaiting issue',
                note: 'Revenue still depends on invoice completion or release.',
                value: numberValue(counts.value.billing, 'draft'),
                href: '/billing-invoices?status=draft',
                actionLabel: 'Open billing drafts',
                icon: 'receipt' as AppIconName,
            },
            {
                label: 'Partially paid invoices',
                note: 'Outstanding balances still need cashier follow-up.',
                value: numberValue(counts.value.billing, 'partially_paid'),
                href: '/billing-invoices',
                actionLabel: 'Open billing',
                icon: 'receipt' as AppIconName,
            },
        ];
    }

    return [
        {
            label: 'Scope resolution needs review',
            note: 'Review scope when tenant or facility context looks off.',
            value: Number(scopeData.value?.userAccess?.accessibleFacilityCount ?? 0),
            href: '/dashboard#dashboard-resources',
            actionLabel: 'Review scope',
            icon: 'building-2' as AppIconName,
        },
        {
            label: 'Recent audit export failures',
            note: 'Recent failed export jobs need review before the next shift.',
            value: numberValue(auditExportHealth.value?.aggregate, 'recentFailed'),
            href: '/dashboard#dashboard-resources',
            actionLabel: 'Open audit export',
            icon: 'activity' as AppIconName,
        },
        {
            label: 'Ward escalations still open',
            note: 'Operational escalations that may need leadership review.',
            value: numberValue(counts.value.wardTasks, 'escalated'),
            href: '/inpatient-ward',
            actionLabel: 'Open inpatient ward',
            icon: 'bed-double' as AppIconName,
        },
    ];
});

const exportModuleRows = computed(() =>
    firstArray(auditExportHealth.value, ['moduleHealth', 'moduleSlices', 'modules', 'moduleSummaries'])
        .slice(0, 4)
        .map((item: any) => ({
            moduleKey: String(item?.moduleKey ?? item?.module ?? item?.key ?? 'module'),
            label: formatEnumLabel(String(item?.label ?? item?.moduleKey ?? item?.module ?? item?.key ?? 'module')),
            currentBacklog: Number(item?.currentBacklog ?? item?.backlog ?? 0),
            recentFailed: Number(item?.recentFailed ?? item?.failed ?? 0),
            recentCompleted: Number(item?.recentCompleted ?? item?.completed ?? 0),
        })),
);

const recentExportFailures = computed(() =>
    firstArray(auditExportHealth.value, ['recentFailures', 'failures', 'recentFailureSlice']).slice(0, 4),
);

const retryModuleRows = computed(() =>
    firstArray(retryResumeHealth.value, ['moduleHealth', 'moduleSlices', 'modules', 'moduleSummaries'])
        .slice(0, 4)
        .map((item: any) => ({
            moduleKey: String(item?.moduleKey ?? item?.module ?? item?.key ?? 'module'),
            label: formatEnumLabel(String(item?.label ?? item?.moduleKey ?? item?.module ?? item?.key ?? 'module')),
            attempts: Number(item?.attempts ?? 0),
            successes: Number(item?.successes ?? 0),
            failures: Number(item?.failures ?? 0),
            lastFailureReason: String(item?.lastFailureReason ?? item?.failureReason ?? ''),
        })),
);

onMounted(async () => {
    try {
        await loadDashboard();
    } finally {
        loading.value = false;
    }
});
</script>
<template>
    <Head title="Dashboard" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4 md:p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0 space-y-2">
                    <div class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="layout-grid" class="size-5 text-muted-foreground" />
                        <span>Dashboard</span>
                    </div>
                    <p class="text-sm text-muted-foreground">{{ activePreset.description }}</p>
                    <div class="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">{{ activePreset.label }}</Badge>
                        <Badge v-for="module in activePreset.modules" :key="module" variant="outline">{{ module }}</Badge>
                        <Badge v-if="scopeData?.facility?.name || scopeData?.facility?.code" variant="outline">
                            {{ scopeData?.facility?.name || scopeData?.facility?.code }}
                        </Badge>
                        <Badge v-if="lastLoadedAt" variant="outline">Updated {{ formatDateTime(lastLoadedAt) }}</Badge>
                        <Badge v-if="partialData" variant="outline">{{ failures.length }} source{{ failures.length === 1 ? '' : 's' }} unavailable</Badge>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <div v-if="canSwitchPreset" class="min-w-[13rem]">
                        <Select v-model="presetSelectValue">
                            <SelectTrigger class="h-8 rounded-lg">
                                <SelectValue placeholder="View as" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">Auto ({{ presets.find((preset) => preset.key === inferredPreset)?.label ?? 'Default' }})</SelectItem>
                                <SelectItem v-for="preset in visiblePresetOptions" :key="preset.key" :value="preset.key">{{ preset.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button size="sm" variant="outline" class="h-8 rounded-lg gap-1.5" :disabled="refreshing" @click="refreshDashboard">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ refreshing ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                </div>
            </div>

            <Alert v-if="partialData" class="rounded-lg border-dashed">
                <AppIcon name="alert-triangle" class="size-4" />
                <AlertTitle>Partial data load</AlertTitle>
                <AlertDescription>
                    <div class="space-y-2">
                        <p>Some dashboard modules are unavailable right now. The rest of the dashboard is still usable.</p>
                        <div class="flex flex-wrap gap-1.5">
                            <Badge v-for="label in failureLabels" :key="label" variant="outline">{{ label }}</Badge>
                        </div>
                    </div>
                </AlertDescription>
            </Alert>

            <Tabs v-model="activeTab" class="space-y-4">
                <TabsList class="grid w-full grid-cols-2 sm:w-auto">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="resources">Resources</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" class="space-y-4">
                    <Card v-if="showSetupReadinessCard" class="rounded-lg border-sidebar-border/70">
                        <CardContent class="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                            <div class="space-y-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">Facility Admin Setup</Badge>
                                    <Badge :variant="setupReadinessVariant">{{ setupReadyStepCount }}/{{ setupStepsForReadiness.length }} ready</Badge>
                                    <Badge v-if="setupRecommendedNextStep" variant="outline">Next: {{ setupRecommendedNextStep.label }}</Badge>
                                </div>
                                <p class="text-sm text-muted-foreground">{{ setupReadinessSummary }}</p>
                            </div>
                            <Button size="sm" :variant="masterDataSetupReady ? 'outline' : 'default'" class="gap-1.5" as-child>
                                <Link href="/setup-center">
                                    <AppIcon name="layout-list" class="size-3.5" />
                                    {{ masterDataSetupReady ? 'Review setup' : 'Open setup guide' }}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Card v-for="item in kpis" :key="item.label" class="rounded-lg border border-border/70">
                            <CardHeader class="gap-2 py-4">
                                <div class="flex items-center justify-between gap-2">
                                    <CardDescription class="text-xs uppercase tracking-wide text-muted-foreground">{{ item.label }}</CardDescription>
                                    <AppIcon :name="item.icon" class="size-4 text-muted-foreground" />
                                </div>
                                <template v-if="loading">
                                    <Skeleton class="h-7 w-24" />
                                    <Skeleton class="h-3 w-full" />
                                </template>
                                <template v-else>
                                    <CardTitle :class="item.unavailable ? 'text-lg font-semibold text-muted-foreground' : 'text-2xl font-semibold'">{{ item.value }}</CardTitle>
                                    <CardDescription class="text-xs text-muted-foreground">{{ item.help }}</CardDescription>
                                </template>
                            </CardHeader>
                        </Card>
                    </div>

                    <div class="rounded-lg border bg-muted/30 p-2.5">
                        <div class="grid gap-2 md:grid-cols-3">
                            <template v-for="action in actions" :key="action.label">
                                <Button
                                    v-if="action.href"
                                    as-child
                                    size="sm"
                                    :variant="action.variant"
                                    class="h-8 w-full justify-center rounded-md gap-1.5"
                                >
                                    <Link :href="action.href">
                                        <AppIcon :name="action.icon" class="size-3.5" />
                                        {{ action.label }}
                                    </Link>
                                </Button>
                                <Button
                                    v-else
                                    size="sm"
                                    :variant="action.variant"
                                    class="h-8 w-full justify-center rounded-md gap-1.5"
                                    @click="action.onClick?.()"
                                >
                                    <AppIcon :name="action.icon" class="size-3.5" />
                                    {{ action.label }}
                                </Button>
                            </template>
                        </div>
                    </div>
                    <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)]">
                        <Card class="rounded-lg border border-border/70">
                            <CardHeader class="gap-1.5 py-4">
                                <CardTitle class="text-base">{{ queueTitle }}</CardTitle>
                                <CardDescription>{{ queueDescription }}</CardDescription>
                            </CardHeader>
                            <CardContent class="pt-0">
                                <div v-if="loading" class="space-y-2">
                                    <div v-for="index in 3" :key="index" class="rounded-lg border px-3 py-2">
                                        <Skeleton class="h-4 w-32" />
                                        <Skeleton class="mt-2 h-3 w-full" />
                                        <Skeleton class="mt-1 h-3 w-40" />
                                    </div>
                                </div>
                                <div v-else-if="queueRows.length === 0" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                    No queue items are currently visible for this preset.
                                </div>
                                <div v-else class="space-y-2">
                                    <Link
                                        v-for="row in queueRows"
                                        :key="row.id"
                                        :href="row.href"
                                        class="group block rounded-lg border px-3 py-2 transition-colors hover:bg-muted/40"
                                    >
                                        <div class="flex items-start justify-between gap-1.5">
                                            <div class="min-w-0">
                                                <p class="truncate text-sm font-medium">{{ row.title }}</p>
                                                <p class="truncate text-[11px] text-muted-foreground">{{ row.subtitle }}</p>
                                            </div>
                                            <Badge :variant="statusVariant(row.status)" class="shrink-0">{{ row.status }}</Badge>
                                        </div>
                                        <div class="mt-1 flex flex-wrap items-center justify-between gap-1.5">
                                            <p class="text-[11px] text-muted-foreground">{{ row.meta }}</p>
                                            <span class="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                                                {{ row.actionLabel }}
                                                <AppIcon name="chevron-right" class="size-3" />
                                            </span>
                                        </div>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>

                        <div class="space-y-4">
                            <Collapsible v-if="shouldShowHandoff" v-model:open="handoffOpen">
                                <Card class="rounded-lg border border-border/70">
                                    <CardHeader class="gap-1.5 py-4">
                                        <div class="flex items-start justify-between gap-3">
                                            <div class="min-w-0">
                                                <CardTitle class="text-base">Shift handoff</CardTitle>
                                                <CardDescription>{{ handoff.title }} | {{ handoff.note }}</CardDescription>
                                            </div>
                                            <CollapsibleTrigger as-child>
                                                <Button size="sm" variant="outline" class="h-8 rounded-lg gap-1.5">
                                                    <AppIcon :name="handoffOpen ? 'chevron-left' : 'chevron-right'" class="size-3.5" />
                                                    {{ handoffOpen ? 'Hide' : 'Show' }}
                                                </Button>
                                            </CollapsibleTrigger>
                                        </div>
                                    </CardHeader>
                                    <CollapsibleContent>
                                        <CardContent class="space-y-3 pt-0">
                                            <div class="rounded-lg border bg-muted/20 p-3">
                                                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Current blocker</p>
                                                <p class="mt-1 text-sm font-semibold">{{ handoff.blockerTitle }}</p>
                                                <p class="mt-1 text-xs text-muted-foreground">{{ handoff.blockerNote }}</p>
                                            </div>
                                            <div class="rounded-lg border p-3">
                                                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Next action</p>
                                                <p class="mt-1 text-sm">{{ handoff.nextAction }}</p>
                                                <div class="mt-3 flex flex-wrap gap-2">
                                                    <Button as-child size="sm" class="h-8 rounded-lg gap-1.5">
                                                        <Link :href="handoff.primaryAction.href">{{ handoff.primaryAction.label }}</Link>
                                                    </Button>
                                                    <Button as-child size="sm" variant="outline" class="h-8 rounded-lg gap-1.5">
                                                        <Link :href="handoff.secondaryAction.href">{{ handoff.secondaryAction.label }}</Link>
                                                    </Button>
                                                </div>
                                            </div>
                                            <div class="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                                                <div v-for="chip in handoff.chips" :key="chip.label" class="rounded-md border p-2">
                                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ chip.label }}</p>
                                                    <p class="mt-1 text-sm font-semibold">{{ chip.value === null ? 'Unavailable' : chip.value.toLocaleString() }}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>

                            <Card class="rounded-lg border border-border/70">
                                <CardHeader class="gap-1.5 py-4">
                                    <CardTitle class="text-base">Operational watch</CardTitle>
                                    <CardDescription>Keep the secondary workload visible without leaving this preset.</CardDescription>
                                </CardHeader>
                                <CardContent class="space-y-2 pt-0">
                                    <div v-for="item in watchItems" :key="item.label" class="rounded-lg border p-3">
                                        <div class="flex items-start justify-between gap-3">
                                            <div class="min-w-0">
                                                <div class="flex items-center gap-2">
                                                    <AppIcon :name="item.icon" class="size-3.5 text-muted-foreground" />
                                                    <p class="text-sm font-medium">{{ item.label }}</p>
                                                </div>
                                                <p class="mt-1 text-xs text-muted-foreground">{{ item.note }}</p>
                                            </div>
                                            <Badge variant="outline">{{ item.value === null ? 'Unavailable' : item.value.toLocaleString() }}</Badge>
                                        </div>
                                        <div class="mt-2">
                                            <Button as-child size="sm" variant="ghost" class="h-7 rounded-md px-2 text-[11px]">
                                                <Link :href="item.href">{{ item.actionLabel }}</Link>
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent id="dashboard-resources" value="resources" class="space-y-4">
                    <div class="grid gap-4 xl:grid-cols-2">
                        <Card class="rounded-lg border border-border/70">
                            <CardHeader class="pb-2">
                                <CardTitle class="text-base">User &amp; Security</CardTitle>
                                <CardDescription>Session context for this workstation.</CardDescription>
                            </CardHeader>
                            <CardContent class="space-y-3 pt-0 text-sm">
                                <div>
                                    <p class="text-xs uppercase tracking-wide text-muted-foreground">User</p>
                                    <p class="mt-1 font-medium">{{ authMe?.name || 'Unavailable' }}</p>
                                    <p class="text-xs text-muted-foreground">{{ authMe?.email || 'Unavailable' }}</p>
                                </div>
                                <div class="flex flex-wrap gap-1.5" v-if="(authMe?.roles ?? []).length > 0">
                                    <Badge v-for="role in authMe.roles.slice(0, 6)" :key="role.code || role.name" variant="outline">
                                        {{ role.name || role.code }}
                                    </Badge>
                                </div>
                                <div class="grid gap-2 sm:grid-cols-2">
                                    <div class="rounded-md border p-2">
                                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Email verified</p>
                                        <p class="mt-1 font-medium">{{ securityStatus?.emailVerified ? 'OK' : 'No' }}</p>
                                    </div>
                                    <div class="rounded-md border p-2">
                                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">2FA enabled</p>
                                        <p class="mt-1 font-medium">{{ securityStatus?.twoFactorEnabled ? 'OK' : 'No' }}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card class="rounded-lg border border-border/70">
                            <CardHeader class="pb-2">
                                <CardTitle class="text-base">Scope &amp; Routing</CardTitle>
                                <CardDescription>Facility and isolation context driving this dashboard session.</CardDescription>
                            </CardHeader>
                            <CardContent class="space-y-3 pt-0 text-sm">
                                <div class="grid gap-2 sm:grid-cols-2">
                                    <div class="rounded-md border p-2">
                                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Tenant</p>
                                        <p class="mt-1 font-medium">{{ scopeData?.tenant?.name || scopeData?.tenant?.code || 'Not scoped' }}</p>
                                    </div>
                                    <div class="rounded-md border p-2">
                                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Facility</p>
                                        <p class="mt-1 font-medium">{{ scopeData?.facility?.name || scopeData?.facility?.code || 'Not scoped' }}</p>
                                    </div>
                                    <div class="rounded-md border p-2">
                                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Resolved from</p>
                                        <p class="mt-1 font-medium">{{ scopeData?.resolvedFrom || 'Unknown' }}</p>
                                    </div>
                                    <div class="rounded-md border p-2">
                                        <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Accessible facilities</p>
                                        <p class="mt-1 font-medium">{{ Number(scopeData?.userAccess?.accessibleFacilityCount ?? 0) }}</p>
                                    </div>
                                </div>
                                <div class="rounded-md border p-2">
                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">Isolation mode</p>
                                    <p class="mt-1 font-medium">{{ multiTenantIsolationEnabled ? 'Multi-tenant isolation enabled' : 'Single-tenant / shared routing mode' }}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div class="grid gap-4 xl:grid-cols-2">
                        <Card class="rounded-lg border border-border/70">
                            <CardHeader class="pb-2">
                                <CardTitle class="text-base">Audit export health</CardTitle>
                                <CardDescription>Backlog and failure signals across the export modules you can access.</CardDescription>
                            </CardHeader>
                            <CardContent class="space-y-3 pt-0 text-sm">
                                <template v-if="auditExportHealth">
                                    <div class="flex flex-wrap gap-2 text-xs">
                                        <Badge variant="outline">Backlog {{ Number(auditExportHealth.aggregate?.currentBacklog ?? 0) }}</Badge>
                                        <Badge :variant="Number(auditExportHealth.aggregate?.recentFailed ?? 0) > 0 ? 'destructive' : 'outline'">Failed {{ Number(auditExportHealth.aggregate?.recentFailed ?? 0) }}</Badge>
                                        <Badge variant="outline">Completed {{ Number(auditExportHealth.aggregate?.recentCompleted ?? 0) }}</Badge>
                                        <Badge variant="outline">Window jobs {{ Number(auditExportHealth.aggregate?.totalRecent ?? 0) }}</Badge>
                                    </div>
                                    <div v-if="exportModuleRows.length > 0" class="space-y-2">
                                        <div v-for="row in exportModuleRows" :key="row.moduleKey" class="rounded-md border p-2">
                                            <div class="flex items-center justify-between gap-2">
                                                <p class="text-xs font-medium">{{ row.label }}</p>
                                                <Badge :variant="row.recentFailed > 0 ? 'destructive' : row.currentBacklog > 0 ? 'secondary' : 'outline'">
                                                    {{ row.recentFailed > 0 ? 'Attention' : row.currentBacklog > 0 ? 'In progress' : 'Healthy' }}
                                                </Badge>
                                            </div>
                                            <p class="mt-1 text-xs text-muted-foreground">
                                                Backlog {{ row.currentBacklog }} | Failed {{ row.recentFailed }} | Completed {{ row.recentCompleted }}
                                            </p>
                                        </div>
                                    </div>
                                    <div v-if="recentExportFailures.length > 0" class="space-y-2">
                                        <p class="text-xs uppercase tracking-wide text-muted-foreground">Recent failures</p>
                                        <div v-for="item in recentExportFailures" :key="item.id || item.failedAt || item.createdAt" class="rounded-md border p-2">
                                            <p class="text-xs font-medium">{{ formatEnumLabel(String(item.moduleKey ?? 'module')) }} | {{ formatDateTime(item.failedAt ?? item.createdAt) }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ item.errorMessage?.trim() || 'No error message captured.' }}</p>
                                        </div>
                                    </div>
                                </template>
                                <div v-else class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                    Audit export health is unavailable for this session.
                                </div>
                            </CardContent>
                        </Card>

                        <Card class="rounded-lg border border-border/70">
                            <CardHeader class="pb-2">
                                <CardTitle class="text-base">Retry-resume telemetry</CardTitle>
                                <CardDescription>Operational signal for export retry and resume handling.</CardDescription>
                            </CardHeader>
                            <CardContent class="space-y-3 pt-0 text-sm">
                                <template v-if="retryResumeHealth">
                                    <div class="flex flex-wrap gap-2 text-xs">
                                        <Badge variant="outline">Attempts {{ Number(retryResumeHealth.aggregate?.attempts ?? 0) }}</Badge>
                                        <Badge variant="outline">Success {{ Number(retryResumeHealth.aggregate?.successes ?? 0) }}</Badge>
                                        <Badge :variant="Number(retryResumeHealth.aggregate?.failures ?? 0) > 0 ? 'destructive' : 'outline'">Failure {{ Number(retryResumeHealth.aggregate?.failures ?? 0) }}</Badge>
                                        <Badge variant="outline">Success rate {{ retryResumeHealth.aggregate?.successRatePercent ?? 'N/A' }}</Badge>
                                    </div>
                                    <div v-if="retryModuleRows.length > 0" class="space-y-2">
                                        <div v-for="row in retryModuleRows" :key="row.moduleKey" class="rounded-md border p-2">
                                            <div class="flex items-center justify-between gap-2">
                                                <p class="text-xs font-medium">{{ row.label }}</p>
                                                <Badge :variant="row.failures > 0 ? 'destructive' : 'outline'">{{ row.failures > 0 ? 'Failure' : 'Stable' }}</Badge>
                                            </div>
                                            <p class="mt-1 text-xs text-muted-foreground">
                                                Attempts {{ row.attempts }} | Success {{ row.successes }} | Failure {{ row.failures }}
                                            </p>
                                            <p v-if="row.lastFailureReason" class="mt-1 text-[11px] text-muted-foreground">
                                                Last failure reason: {{ row.lastFailureReason }}
                                            </p>
                                        </div>
                                    </div>
                                </template>
                                <div v-else class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                    Retry-resume telemetry is unavailable for this session.
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    </AppLayout>
</template>

