<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardWorkflowPresetStorage } from '@/composables/useDashboardWorkflowPreset';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import {
    DASHBOARD_ADMIN_ROLE_CODES,
    DASHBOARD_PRESETS,
    eligibleDashboardPresets,
    inferDashboardPreset,
    presetMatchesRole,
    type DashboardPresetKey,
} from '@/config/dashboardPresets';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGet } from '@/lib/apiClient';
import type { AppIconName } from '@/lib/icons';
import { formatEnumLabel } from '@/lib/labels';
import type { BreadcrumbItem } from '@/types';

type TabKey = 'overview' | 'handoff' | 'status' | 'resources';

type ApiEnvelope<T> = { data: T };

type QueueRow = {
    id: string;
    title: string;
    subtitle: string;
    meta: string;
    status: string;
    href: string;
    actionLabel: string;
    isOverdue?: boolean;
    group?: string;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];
const today = new Date(Date.now() - (new Date().getTimezoneOffset() * 60 * 1000)).toISOString().slice(0, 10);

const { hasPermission, isFacilitySuperAdmin, isPlatformSuperAdmin, multiTenantIsolationEnabled, sessionRoleCodes, scope: platformScope } =
    usePlatformAccess();

const loading = ref(true);
const refreshing = ref(false);
const dashboardHydrated = ref(false);
const activeTab = ref<TabKey>('overview');
const presetOverride = useDashboardWorkflowPresetStorage();
const failures = ref<Array<{ label: string; message: string }>>([]);

const scopeData = ref<any | null>(null);
const authMe = ref<any | null>(null);
const securityStatus = ref<any | null>(null);
const counts = ref<Record<string, any>>({});
const lists = ref<Record<string, any[]>>({});
const auditExportHealth = ref<any | null>(null);
const retryResumeHealth = ref<any | null>(null);
const lastLoadedAt = ref<string | null>(null);
const sharedOpsTelemetryLoaded = ref(false);

const nowTick = ref(Date.now());
let nowTickerHandle: ReturnType<typeof setInterval> | null = null;

type DensityMode = 'comfortable' | 'compact';
type AutoRefreshKey = 'off' | '30s' | '1m' | '5m';

const AUTO_REFRESH_INTERVAL_MS: Record<AutoRefreshKey, number> = {
    off: 0,
    '30s': 30_000,
    '1m': 60_000,
    '5m': 300_000,
};
const AUTO_REFRESH_LABEL: Record<AutoRefreshKey, string> = {
    off: 'Auto: Off',
    '30s': 'Auto: 30s',
    '1m': 'Auto: 1m',
    '5m': 'Auto: 5m',
};

function useLocalStorageString<T extends string>(key: string, defaultValue: T, valid: readonly T[]): Ref<T> {
    const state = ref(defaultValue) as Ref<T>;
    onMounted(() => {
        if (typeof window === 'undefined') return;
        const raw = window.localStorage.getItem(key);
        if (raw && (valid as readonly string[]).includes(raw)) {
            state.value = raw as T;
        }
    });
    watch(state, (value) => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(key, value);
    });
    return state;
}

const density = useLocalStorageString<DensityMode>('dashboard.density', 'comfortable', ['comfortable', 'compact']);
const autoRefreshInterval = useLocalStorageString<AutoRefreshKey>('dashboard.auto-refresh', 'off', ['off', '30s', '1m', '5m']);

const PINNED_METRICS_KEY = 'dashboard.pinned-metrics';
const pinnedMetrics = ref<Set<string>>(new Set());
let autoRefreshHandle: ReturnType<typeof setInterval> | null = null;

const frontDeskHandoffOpen = useLocalStorageBoolean('dashboard.front-desk-handoff.open', true);
const clinicianHandoffOpen = useLocalStorageBoolean('dashboard.clinician-handoff.open', false);
const nursingHandoffOpen = useLocalStorageBoolean('dashboard.nursing-handoff.open', true);
const emergencyHandoffOpen = useLocalStorageBoolean('dashboard.emergency-handoff.open', true);
const cashierHandoffOpen = useLocalStorageBoolean('dashboard.cashier-handoff.open', false);
const adminHandoffOpen = useLocalStorageBoolean('dashboard.admin-handoff.open', false);

const roleCodes = computed(() => {
    const fromApi = (authMe.value?.roles ?? [])
        .map((role: any) => String(role?.code ?? '').trim().toUpperCase())
        .filter((code: string) => code.length > 0);
    if (fromApi.length > 0) {
        return fromApi;
    }

    return sessionRoleCodes.value;
});

const presetContextInput = computed(() => ({
    roleCodesUpper: roleCodes.value,
    isFacilitySuperAdmin: isFacilitySuperAdmin.value,
    isPlatformSuperAdmin: isPlatformSuperAdmin.value,
    hasPermission,
}));

const rolesResolved = computed(
    () =>
        sessionRoleCodes.value.length > 0 ||
        (Array.isArray(authMe.value?.roles) && authMe.value.roles.length > 0),
);

const eligiblePresets = computed(() => eligibleDashboardPresets(presetContextInput.value));

const canSwitchPreset = computed(
    () =>
        isFacilitySuperAdmin.value ||
        isPlatformSuperAdmin.value ||
        presetMatchesRole(roleCodes.value, DASHBOARD_ADMIN_ROLE_CODES) ||
        eligiblePresets.value.length > 1,
);

const inferredPreset = computed<DashboardPresetKey>(() => inferDashboardPreset(presetContextInput.value));

const activePresetKey = computed<DashboardPresetKey>(() => {
    const eligible = eligiblePresets.value;
    const fallback = eligible[0] ?? 'front_desk';
    if (presetOverride.value === 'auto') {
        return fallback;
    }
    if (eligible.includes(presetOverride.value)) {
        return presetOverride.value;
    }
    return fallback;
});

const activePreset = computed(
    () => DASHBOARD_PRESETS.find((preset) => preset.key === activePresetKey.value) ?? DASHBOARD_PRESETS[0],
);

const visiblePresetOptions = computed(() =>
    DASHBOARD_PRESETS.filter((preset) => eligiblePresets.value.includes(preset.key)),
);

const presetSelectValue = computed({
    get: () => presetOverride.value,
    set: (value: string) => {
        if (!canSwitchPreset.value) return;
        presetOverride.value = value === 'auto' ? 'auto' : (value as DashboardPresetKey);
    },
});

watch(
    () => [rolesResolved.value, eligiblePresets.value, presetOverride.value] as const,
    () => {
        if (!rolesResolved.value) return;
        if (presetOverride.value !== 'auto' && !eligiblePresets.value.includes(presetOverride.value)) {
            presetOverride.value = 'auto';
        }
    },
    { flush: 'post' },
);

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
        if (activePresetKey.value === 'emergency') return emergencyHandoffOpen.value;
        return adminHandoffOpen.value;
    },
    set: (value: boolean) => {
        if (activePresetKey.value === 'front_desk') frontDeskHandoffOpen.value = value;
        else if (activePresetKey.value === 'clinician') clinicianHandoffOpen.value = value;
        else if (activePresetKey.value === 'nursing' || activePresetKey.value === 'direct_service') nursingHandoffOpen.value = value;
        else if (activePresetKey.value === 'cashier') cashierHandoffOpen.value = value;
        else if (activePresetKey.value === 'emergency') emergencyHandoffOpen.value = value;
        else adminHandoffOpen.value = value;
    },
});

function numberValue(source: any, key: string | string[]): number | null {
    if (!source) return null;
    if (Array.isArray(key)) return key.reduce((sum, entry) => sum + Number(source?.[entry] ?? 0), 0);
    return Number(source?.[key] ?? 0);
}

function metric(label: string, help: string, icon: AppIconName, value: number | null, suffix?: string) {
    return {
        label,
        help,
        icon,
        value: suffix ? `${(value ?? 0).toLocaleString()}${suffix}` : (value ?? 0).toLocaleString(),
        unavailable: false,
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

function formatRelativeTime(value: string | null | undefined, reference: number): string {
    if (!value) return 'Never';
    const parsed = new Date(value).getTime();
    if (Number.isNaN(parsed)) return 'Never';
    const deltaMs = Math.max(0, reference - parsed);
    const seconds = Math.floor(deltaMs / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

const lastLoadedRelative = computed(() => formatRelativeTime(lastLoadedAt.value, nowTick.value));

const isFresh = computed(() => {
    if (!lastLoadedAt.value) return false;
    return nowTick.value - new Date(lastLoadedAt.value).getTime() < 60_000;
});

const currentFacilityLabel = computed(() => {
    const facility = platformScope.value?.facility;
    if (facility?.name && facility?.code) return facility.name;
    if (facility?.code) return facility.code;
    if (isPlatformSuperAdmin.value || isFacilitySuperAdmin.value) return 'All facilities';
    return 'No facility selected';
});

const currentTenantLabel = computed(() => {
    const tenant = platformScope.value?.tenant;
    if (tenant?.name && tenant?.code) return `${tenant.name} - ${tenant.code}`;
    if (tenant?.name) return tenant.name;
    if (tenant?.code) return tenant.code;
    return 'Platform scope';
});

const kpiPaddingClass = computed(() => (density.value === 'compact' ? 'p-2.5' : 'p-3.5'));
const kpiValueClass = computed(() => (density.value === 'compact' ? 'text-lg' : 'text-2xl'));
const gridGapClass = computed(() => (density.value === 'compact' ? 'gap-2' : 'gap-3'));
const isCompact = computed(() => density.value === 'compact');

function persistPinnedMetrics(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PINNED_METRICS_KEY, [...pinnedMetrics.value].join('|'));
}

function loadPinnedMetrics(): void {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(PINNED_METRICS_KEY);
    if (!raw) return;
    pinnedMetrics.value = new Set(raw.split('|').filter(Boolean));
}

function togglePin(label: string): void {
    const next = new Set(pinnedMetrics.value);
    if (next.has(label)) {
        next.delete(label);
    } else {
        next.add(label);
    }
    pinnedMetrics.value = next;
    persistPinnedMetrics();
}

function applyAutoRefresh(): void {
    if (autoRefreshHandle !== null) {
        clearInterval(autoRefreshHandle);
        autoRefreshHandle = null;
    }
    const ms = AUTO_REFRESH_INTERVAL_MS[autoRefreshInterval.value] ?? 0;
    if (ms > 0) {
        autoRefreshHandle = setInterval(() => {
            void refreshDashboard();
        }, ms);
    }
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
    if (['completed', 'paid', 'approved', 'dispensed', 'resolved'].includes(normalized)) return 'secondary';
    if (['checked_in', 'admitted', 'in_progress'].includes(normalized)) return 'default';
    if (['failed', 'cancelled', 'voided', 'rejected', 'escalated', 'urgent', 'emergency'].includes(normalized)) return 'destructive';
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

async function loadOpsTelemetry() {
    const [auditExportHealthResponse, retryResumeHealthResponse] = await Promise.all([
        safeRequest<ApiEnvelope<any>>('Audit export health', () =>
            apiGet('/platform/audit-export-jobs/health', { days: 7, failureLimit: 5 }),
        ),
        safeRequest<ApiEnvelope<any>>('Retry-resume telemetry', () =>
            apiGet('/platform/audit-export-jobs/retry-resume-telemetry/health', { days: 7, failureLimit: 5 }),
        ),
    ]);

    auditExportHealth.value = auditExportHealthResponse?.data ?? auditExportHealth.value;
    retryResumeHealth.value = retryResumeHealthResponse?.data ?? retryResumeHealth.value;
}

async function loadDashboard(depth = 0): Promise<void> {
    if (depth > 5) return;

    failures.value = [];
    const presetAtStart = activePresetKey.value;
    const preset = presetAtStart;

    counts.value = {
        patients: null,
        appointments: null,
        admissions: null,
        medicalRecords: null,
        wardTasks: null,
        wardCarePlans: null,
        wardDischargeChecklists: null,
        laboratory: null,
        pharmacy: null,
        radiology: null,
        billing: null,
        claimOpen: null,
        claimResolved: null,
    };
    lists.value = {
        scheduledAppointments: [],
        checkedInAppointments: [],
        admissions: [],
        draftInvoices: [],
    };

    if (preset !== 'admin' && !sharedOpsTelemetryLoaded.value) {
        auditExportHealth.value = null;
        retryResumeHealth.value = null;
    }

    type BatchEntry = readonly [string, () => Promise<unknown>];

    const batch: BatchEntry[] = [
        ['scope', () => safeRequest<ApiEnvelope<any>>('Scope', () => apiGet('/platform/access-scope'))],
        ['authMe', () => safeRequest<ApiEnvelope<any>>('Auth user', () => apiGet('/auth/me'))],
        ['securityStatus', () => safeRequest<ApiEnvelope<any>>('Security status', () => apiGet('/auth/me/security-status'))],
    ];

    switch (preset) {
        case 'front_desk':
            batch.push(
                ['patientCounts', () => guardedRequest<ApiEnvelope<any>>('Patient counts', 'patients.read', () => apiGet('/patients/status-counts'))],
                ['appointmentCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Appointment counts', 'appointments.read', () => apiGet('/appointments/status-counts')),
                ],
                ['admissionCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Admission counts', 'admissions.read', () => apiGet('/admissions/status-counts')),
                ],
                [
                    'scheduledAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Scheduled appointments', 'appointments.read', () =>
                            apiGet('/appointments', { status: 'scheduled', perPage: 8, sortBy: 'scheduledAt', sortDir: 'asc' }),
                        ),
                ],
                [
                    'checkedInAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Checked-in appointments', 'appointments.read', () =>
                            apiGet('/appointments', { status: 'checked_in', perPage: 5, sortBy: 'checkedInAt', sortDir: 'asc' }),
                        ),
                ],
            );
            break;
        case 'clinician':
            batch.push(
                ['appointmentCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Appointment counts', 'appointments.read', () => apiGet('/appointments/status-counts')),
                ],
                ['medicalRecordCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Medical record counts', 'medical.records.read', () => apiGet('/medical-records/status-counts')),
                ],
                ['admissionCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Admission counts', 'admissions.read', () => apiGet('/admissions/status-counts')),
                ],
                ['laboratoryCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory counts', 'laboratory.orders.read', () => apiGet('/laboratory-orders/status-counts')),
                ],
                [
                    'checkedInAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Checked-in appointments', 'appointments.read', () =>
                            apiGet('/appointments', { status: 'checked_in', perPage: 5, sortBy: 'checkedInAt', sortDir: 'asc' }),
                        ),
                ],
            );
            break;
        case 'direct_service':
            batch.push(
                ['laboratoryCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory counts', 'laboratory.orders.read', () => apiGet('/laboratory-orders/status-counts')),
                ],
                ['pharmacyCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Pharmacy counts', 'pharmacy.orders.read', () => apiGet('/pharmacy-orders/status-counts')),
                ],
                ['radiologyCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Radiology counts', 'radiology.orders.read', () => apiGet('/radiology-orders/status-counts')),
                ],
            );
            break;
        case 'nursing':
            batch.push(
                ['admissionCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Admission counts', 'admissions.read', () => apiGet('/admissions/status-counts')),
                ],
                ['laboratoryCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory counts', 'laboratory.orders.read', () => apiGet('/laboratory-orders/status-counts')),
                ],
                ['pharmacyCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Pharmacy counts', 'pharmacy.orders.read', () => apiGet('/pharmacy-orders/status-counts')),
                ],
                ['wardTaskCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Ward task counts', 'inpatient.ward.read', () => apiGet('/inpatient-ward/task-status-counts')),
                ],
                ['wardCarePlanCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Ward care plan counts', 'inpatient.ward.read', () => apiGet('/inpatient-ward/care-plan-status-counts')),
                ],
                ['wardDischargeChecklistCounts', () =>
                    guardedRequest<ApiEnvelope<any>>(
                        'Ward discharge checklist counts',
                        'inpatient.ward.read',
                        () => apiGet('/inpatient-ward/discharge-checklist-status-counts'),
                    ),
                ],
                [
                    'admissions',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Admissions', 'admissions.read', () =>
                            apiGet('/admissions', { status: 'admitted', perPage: 2, sortBy: 'admittedAt', sortDir: 'desc' }),
                        ),
                ],
                ['appointmentCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Appointment counts', 'appointments.read', () => apiGet('/appointments/status-counts')),
                ],
                [
                    'checkedInAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Checked-in appointments', 'appointments.read', () =>
                            apiGet('/appointments', { status: 'checked_in', perPage: 5, sortBy: 'checkedInAt', sortDir: 'asc' }),
                        ),
                ],
            );
            break;
        case 'emergency':
            batch.push(
                ['patientCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Patient counts', 'patients.read', () => apiGet('/patients/status-counts')),
                ],
                ['appointmentCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Appointment counts', 'appointments.read', () => apiGet('/appointments/status-counts')),
                ],
                ['admissionCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Admission counts', 'admissions.read', () => apiGet('/admissions/status-counts')),
                ],
                ['laboratoryCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory counts', 'laboratory.orders.read', () => apiGet('/laboratory-orders/status-counts')),
                ],
                ['pharmacyCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Pharmacy counts', 'pharmacy.orders.read', () => apiGet('/pharmacy-orders/status-counts')),
                ],
                [
                    'checkedInAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Triage queue', 'appointments.read', () =>
                            apiGet('/appointments', { status: 'checked_in', perPage: 10, sortBy: 'checkedInAt', sortDir: 'asc' }),
                        ),
                ],
            );
            break;
        case 'cashier':
            batch.push(
                ['billingCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Billing counts', 'billing.invoices.read', () => apiGet('/billing-invoices/status-counts')),
                ],
                [
                    'claimOpenCounts',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Open claim exceptions', 'claims.insurance.read', () =>
                            apiGet('/claims-insurance/status-counts', { reconciliationExceptionStatus: 'open' }),
                        ),
                ],
                [
                    'claimResolvedCounts',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Resolved claim exceptions', 'claims.insurance.read', () =>
                            apiGet('/claims-insurance/status-counts', { reconciliationExceptionStatus: 'resolved' }),
                        ),
                ],
                [
                    'draftInvoices',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Draft invoices', 'billing.invoices.read', () =>
                            apiGet('/billing-invoices', { status: 'draft', perPage: 3 }),
                        ),
                ],
            );
            break;
        case 'admin':
            batch.push(
                ['wardTaskCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Ward task counts', 'inpatient.ward.read', () => apiGet('/inpatient-ward/task-status-counts')),
                ],
            );
            break;
    }

    if (preset === 'admin' || sharedOpsTelemetryLoaded.value) {
        batch.push(
            ['auditExportHealth', () => safeRequest<ApiEnvelope<any>>('Audit export health', () => apiGet('/platform/audit-export-jobs/health', { days: 7, failureLimit: 5 }))],
            [
                'retryResumeHealth',
                () =>
                    safeRequest<ApiEnvelope<any>>('Retry-resume telemetry', () =>
                        apiGet('/platform/audit-export-jobs/retry-resume-telemetry/health', { days: 7, failureLimit: 5 }),
                    ),
            ],
        );
    }

    const outcomes = await Promise.all(batch.map(([, run]) => run()));
    const bag = Object.fromEntries(batch.map(([key], index) => [key, outcomes[index]])) as Record<string, any>;

    scopeData.value = bag.scope?.data ?? null;
    authMe.value = bag.authMe?.data ?? null;
    securityStatus.value = bag.securityStatus?.data ?? null;

    counts.value = {
        patients: bag.patientCounts?.data ?? null,
        appointments: bag.appointmentCounts?.data ?? null,
        admissions: bag.admissionCounts?.data ?? null,
        medicalRecords: bag.medicalRecordCounts?.data ?? null,
        wardTasks: bag.wardTaskCounts?.data ?? null,
        wardCarePlans: bag.wardCarePlanCounts?.data ?? null,
        wardDischargeChecklists: bag.wardDischargeChecklistCounts?.data ?? null,
        laboratory: bag.laboratoryCounts?.data ?? null,
        pharmacy: bag.pharmacyCounts?.data ?? null,
        radiology: bag.radiologyCounts?.data ?? null,
        billing: bag.billingCounts?.data ?? null,
        claimOpen: bag.claimOpenCounts?.data ?? null,
        claimResolved: bag.claimResolvedCounts?.data ?? null,
    };

    lists.value = {
        scheduledAppointments: Array.isArray(bag.scheduledAppointments?.data) ? bag.scheduledAppointments.data : [],
        checkedInAppointments: Array.isArray(bag.checkedInAppointments?.data) ? bag.checkedInAppointments.data : [],
        admissions: Array.isArray(bag.admissions?.data) ? bag.admissions.data : [],
        draftInvoices: Array.isArray(bag.draftInvoices?.data) ? bag.draftInvoices.data : [],
    };

    if (bag.auditExportHealth !== undefined) {
        auditExportHealth.value = bag.auditExportHealth?.data ?? null;
    }
    if (bag.retryResumeHealth !== undefined) {
        retryResumeHealth.value = bag.retryResumeHealth?.data ?? null;
    }

    if (preset === 'admin') {
        sharedOpsTelemetryLoaded.value = true;
    }

    lastLoadedAt.value = new Date().toISOString();

    if (presetAtStart !== activePresetKey.value) {
        await loadDashboard(depth + 1);
    }
}

watch(activeTab, async (tab) => {
    if (tab !== 'resources') {
        return;
    }
    if (sharedOpsTelemetryLoaded.value) {
        return;
    }
    await loadOpsTelemetry();
    sharedOpsTelemetryLoaded.value = true;
});

watch(
    () => [
        activePresetKey.value,
        platformScope.value?.facility?.code ?? null,
        platformScope.value?.tenant?.code ?? null,
    ] as const,
    async (next, prev) => {
        if (!dashboardHydrated.value || prev === undefined) {
            return;
        }
        const [nextPreset, nextFacility, nextTenant] = next;
        const [prevPreset, prevFacility, prevTenant] = prev;
        const presetChanged = nextPreset !== prevPreset;
        const scopeChanged = nextFacility !== prevFacility || nextTenant !== prevTenant;
        if (!presetChanged && !scopeChanged) {
            return;
        }

        if (scopeChanged) {
            refreshing.value = true;
        }
        try {
            await loadDashboard();
        } finally {
            refreshing.value = false;
        }
    },
);

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
            metric('Waiting for triage', 'Checked-in patients pending nurse assessment.', 'users', numberValue(counts.value.appointments, 'checked_in')),
            metric('Admitted now', 'Current admitted census in scope.', 'bed-double', numberValue(counts.value.admissions, 'admitted')),
            metric('Escalated ward tasks', 'Ward follow-up items marked escalated.', 'alert-triangle', numberValue(counts.value.wardTasks, 'escalated')),
            metric('Pending pharmacy orders', 'Pharmacy work that still needs completion.', 'pill', numberValue(counts.value.pharmacy, ['pending', 'in_preparation', 'partially_dispensed'])),
        ];
    }
    if (activePresetKey.value === 'emergency') {
        const triageRows = lists.value.checkedInAppointments ?? [];
        const avgWaitMins = (() => {
            if (triageRows.length === 0) return 0;
            const now = nowTick.value;
            const total = triageRows.reduce((acc: number, item: any) => {
                const t = item.checkedInAt ?? item.scheduledAt;
                return t ? acc + Math.max(0, now - new Date(t).getTime()) : acc;
            }, 0);
            return Math.floor(total / triageRows.length / 60_000);
        })();
        return [
            metric('Awaiting triage', 'Checked-in patients not yet assessed by clinical staff.', 'heart-pulse', numberValue(counts.value.appointments, 'checked_in')),
            metric('Avg triage wait', 'Average time since check-in across all patients currently in the triage queue.', 'calendar-clock', avgWaitMins, 'm'),
            metric('Active admissions', 'Patients currently admitted from emergency intake.', 'bed-double', numberValue(counts.value.admissions, 'admitted')),
            metric('Stat lab orders', 'Laboratory orders still active and pending results.', 'flask-conical', numberValue(counts.value.laboratory, ['ordered', 'collected', 'in_progress'])),
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

const orderedKpis = computed(() => {
    return kpis.value
        .map((kpi, index) => ({ ...kpi, originalIndex: index, pinned: pinnedMetrics.value.has(kpi.label) }))
        .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return a.originalIndex - b.originalIndex;
        });
});

type ActivityEntry = {
    id: string;
    kind: 'failure' | 'info';
    title: string;
    subtitle: string;
    meta: string;
};

const activityFeed = computed<ActivityEntry[]>(() => {
    const items: ActivityEntry[] = [];
    const failures = firstArray<any>(auditExportHealth.value, ['recentFailures', 'failures']);
    failures.slice(0, 5).forEach((item, index) => {
        const moduleKey = String(item?.moduleKey ?? item?.module ?? 'module');
        const error = String(item?.errorMessage ?? item?.message ?? 'No error message captured.');
        const failedAt = item?.failedAt ?? item?.createdAt ?? item?.updatedAt ?? null;
        items.push({
            id: `audit-${String(item?.id ?? `${moduleKey}-${index}-${failedAt ?? ''}`)}`,
            kind: 'failure',
            title: `${formatEnumLabel(moduleKey)} export failed`,
            subtitle: error,
            meta: formatRelativeTime(failedAt, nowTick.value),
        });
    });
    return items;
});

const actions = computed(() => {
    if (activePresetKey.value === 'front_desk') {
        return [
            { label: 'Register Patient', icon: 'user', variant: 'default', href: '/patients' },
            { label: 'Today queue', icon: 'calendar-clock', variant: 'outline', href: `/appointments?view=queue&from=${today}` },
            { label: 'Walk-in', icon: 'log-in', variant: 'outline', href: `/appointments?type=walkin&view=queue&from=${today}` },
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
            { label: 'Triage queue', icon: 'users', variant: 'default', href: `/appointments?view=queue&status=checked_in&from=${today}` },
            { label: 'Admission queue', icon: 'layout-list', variant: 'outline', href: '/admissions?view=queue' },
            { label: 'Inpatient ward', icon: 'bed-double', variant: 'outline', href: '/inpatient-ward' },
        ];
    }
    if (activePresetKey.value === 'emergency') {
        return [
            { label: 'Register walk-in', icon: 'calendar-plus-2', variant: 'default', href: `/appointments?type=walkin&view=queue&from=${today}` },
            { label: 'Triage queue', icon: 'heart-pulse', variant: 'outline', href: `/appointments?view=queue&status=checked_in&from=${today}` },
            { label: 'Admit patient', icon: 'bed-double', variant: 'outline', href: '/admissions' },
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
        { label: 'Audit export', icon: 'activity', variant: 'outline', onClick: () => { activeTab.value = 'resources'; } },
        { label: 'Platform users', icon: 'users', variant: 'outline', href: '/platform/admin/users' },
    ];
});

const queueRows = computed<QueueRow[]>(() => {
    if (activePresetKey.value === 'front_desk') {
        const now = Date.now();
        const sortByArrival = (a: any, b: any) => {
            const ta = a.checkedInAt ?? a.scheduledAt;
            const tb = b.checkedInAt ?? b.scheduledAt;
            if (!ta && !tb) return 0;
            if (!ta) return 1;
            if (!tb) return -1;
            return new Date(ta).getTime() - new Date(tb).getTime();
        };
        const checkedInRows = [...(lists.value.checkedInAppointments ?? [])]
            .sort(sortByArrival)
            .slice(0, 5)
            .map((item: any) => ({
            id: `checkedin-${String(item.id ?? item.appointmentNumber ?? Math.random())}`,
            title: String(item.appointmentNumber ?? 'Checked-in patient'),
            subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Checked-in and waiting for clinical handoff.',
            meta: `Checked in ${formatDateTime(item.checkedInAt ?? item.scheduledAt)}`,
            status: formatEnumLabel(String(item.status ?? 'checked_in')),
            href: `/appointments?view=queue&status=checked_in&focusAppointmentId=${encodeURIComponent(String(item.id ?? ''))}&from=${today}`,
            actionLabel: 'Open checked-in queue',
            isOverdue: false,
            group: 'Checked-in',
        }));
        const scheduledRows = (lists.value.scheduledAppointments ?? []).slice(0, 8).map((item: any) => {
            const scheduledAt = item.scheduledAt ? new Date(item.scheduledAt).getTime() : null;
            const isOverdue = scheduledAt !== null && scheduledAt < now && String(item.status ?? '').toLowerCase() === 'scheduled';
            return {
                id: String(item.id ?? item.appointmentNumber ?? Math.random()),
                title: String(item.appointmentNumber ?? 'Scheduled appointment'),
                subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Arrival still needs front-desk handling.',
                meta: `Scheduled ${formatDateTime(item.scheduledAt)}`,
                status: formatEnumLabel(String(item.status ?? 'scheduled')),
                href: `/appointments?view=queue&focusAppointmentId=${encodeURIComponent(String(item.id ?? ''))}&from=${today}`,
                actionLabel: 'Open queue',
                isOverdue,
                group: 'Scheduled',
            };
        });
        return [...checkedInRows, ...scheduledRows];
    }
    if (activePresetKey.value === 'clinician') {
        return (lists.value.checkedInAppointments ?? []).slice(0, 5).map((item: any) => ({
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
        const sortByArrival = (a: any, b: any) => {
            const ta = a.checkedInAt ?? a.scheduledAt;
            const tb = b.checkedInAt ?? b.scheduledAt;
            if (!ta && !tb) return 0;
            if (!ta) return 1;
            if (!tb) return -1;
            return new Date(ta).getTime() - new Date(tb).getTime();
        };
        const triageItems = [...(lists.value.checkedInAppointments ?? [])]
            .sort(sortByArrival)
            .slice(0, 3)
            .map((item: any) => ({
            id: `triage-${String(item.id ?? item.appointmentNumber ?? Math.random())}`,
            title: String(item.appointmentNumber ?? 'Triage patient'),
            subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Checked-in and waiting for nurse assessment.',
            meta: `Checked in ${formatDateTime(item.checkedInAt ?? item.scheduledAt)}`,
            status: formatEnumLabel(String(item.status ?? 'checked_in')),
            href: `/appointments?view=queue&status=checked_in&focusAppointmentId=${encodeURIComponent(String(item.id ?? ''))}&from=${today}`,
            actionLabel: 'Open triage queue',
            isOverdue: false,
            group: 'Triage',
        }));
        const admissionItems = (lists.value.admissions ?? []).slice(0, 2).map((item: any) => ({
            id: String(item.id ?? item.admissionNumber ?? Math.random()),
            title: String(item.admissionNumber ?? 'Active admission'),
            subtitle: [item.ward, item.bed, item.admissionReason].filter(Boolean).join(' | ') || 'Admission needs ward or bed-flow review.',
            meta: `Admitted ${formatDateTime(item.admittedAt)}`,
            status: formatEnumLabel(String(item.status ?? 'admitted')),
            href: '/admissions?view=queue',
            actionLabel: 'Open admissions',
            isOverdue: false,
            group: 'Admissions',
        }));
        return [...triageItems, ...admissionItems];
    }
    if (activePresetKey.value === 'emergency') {
        const now = nowTick.value;
        const sortByArrival = (a: any, b: any) => {
            const ta = a.checkedInAt ?? a.scheduledAt;
            const tb = b.checkedInAt ?? b.scheduledAt;
            if (!ta && !tb) return 0;
            if (!ta) return 1;
            if (!tb) return -1;
            return new Date(ta).getTime() - new Date(tb).getTime();
        };
        return [...(lists.value.checkedInAppointments ?? [])]
            .sort(sortByArrival)
            .slice(0, 10)
            .map((item: any) => {
            const arrivalTime = item.checkedInAt ?? item.scheduledAt;
            const waitMs = arrivalTime ? now - new Date(arrivalTime).getTime() : 0;
            const waitMins = Math.max(0, Math.floor(waitMs / 60_000));
            const isOverdue = waitMins >= 30;
            return {
                id: String(item.id ?? item.appointmentNumber ?? Math.random()),
                title: String(item.appointmentNumber ?? 'Walk-in / arrival'),
                subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Awaiting triage assessment.',
                meta: arrivalTime ? `Waiting ${waitMins}m` : 'Wait time unknown',
                status: formatEnumLabel(String(item.status ?? 'checked_in')),
                href: `/appointments?view=queue&status=checked_in&focusAppointmentId=${encodeURIComponent(String(item.id ?? ''))}&from=${today}`,
                actionLabel: 'Open triage',
                isOverdue,
            };
        });
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

const queueGroupCounts = computed<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const row of queueRows.value) {
        if (row.group) {
            map.set(row.group, (map.get(row.group) ?? 0) + 1);
        }
    }
    return map;
});

const queueTitle = computed(() => {
    if (activePresetKey.value === 'front_desk') return 'Front desk queue';
    if (activePresetKey.value === 'clinician') return 'Consultation-ready queue';
    if (activePresetKey.value === 'direct_service') return 'Direct-service queues';
    if (activePresetKey.value === 'nursing') return 'Triage & admissions queue';
    if (activePresetKey.value === 'emergency') return 'Emergency triage queue';
    if (activePresetKey.value === 'cashier') return 'Live billing preview';
    return 'Recent export failures';
});

const queueDescription = computed(() => {
    if (activePresetKey.value === 'front_desk') return 'Checked-in patients awaiting clinical handoff, followed by upcoming scheduled arrivals.';
    if (activePresetKey.value === 'clinician') return 'Checked-in encounters ready for consultation pickup.';
    if (activePresetKey.value === 'direct_service') return 'Accessible laboratory, pharmacy, and radiology worklists for this session.';
    if (activePresetKey.value === 'nursing') return 'Checked-in patients waiting for triage and active inpatient admissions.';
    if (activePresetKey.value === 'emergency') return 'All checked-in patients sorted by arrival time — longest wait shown first. Rows overdue at 30 min.';
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
        const waitingTriage = numberValue(counts.value.appointments, 'checked_in');
        const hasEscalated = Number(escalatedTasks ?? 0) > 0;
        const hasWaitingTriage = Number(waitingTriage ?? 0) > 0;

        return {
            title: 'Nursing handoff',
            note: 'Triage and ward operations',
            blockerTitle: hasWaitingTriage
                ? 'Patients waiting for triage assessment'
                : hasEscalated
                    ? 'Immediate bedside follow-up still needs acknowledgement.'
                    : Number(blockedDischarge ?? 0) > 0
                        ? 'Blocked discharge checklists'
                        : Number(pendingLab ?? 0) > 0
                            ? 'Pending lab follow-up'
                            : 'No critical nursing blockers',
            blockerNote: hasWaitingTriage
                ? 'Check-in queue has patients waiting for initial nursing assessment.'
                : hasEscalated
                ? 'Review task escalation or discharge blockers before closing handoff.'
                : Number(blockedDischarge ?? 0) > 0
                    ? 'Bed occupancy and discharge readiness need another pass.'
                    : Number(pendingLab ?? 0) > 0
                        ? 'Check which laboratory work is still blocking bedside care.'
                        : 'Bed occupancy and discharge readiness look stable for the next shift.',
            nextAction: hasWaitingTriage
                ? 'Start from the triage queue to clear patients waiting for assessment.'
                : Number(blockedDischarge ?? 0) > 0
                ? 'Review current occupancy and placement before the next handoff.'
                : 'Start from the live admissions view, then step into ward follow-up.',
            primaryAction: hasWaitingTriage
                ? { label: 'Open triage queue', href: `/appointments?view=queue&status=checked_in&from=${today}` }
                : { label: 'Open bed board', href: '/admissions?view=board' },
            secondaryAction: { label: 'Open inpatient ward', href: '/inpatient-ward' },
            chips: [
                { label: 'Waiting triage', value: waitingTriage },
                { label: 'Admitted now', value: numberValue(counts.value.admissions, 'admitted') },
                { label: 'Escalated tasks', value: escalatedTasks },
            ],
        };
    }
    if (activePresetKey.value === 'emergency') {
        const waitingTriage = numberValue(counts.value.appointments, 'checked_in');
        const activeAdmissions = numberValue(counts.value.admissions, 'admitted');
        const statLab = numberValue(counts.value.laboratory, ['ordered', 'collected', 'in_progress']);
        const hasWaiting = Number(waitingTriage ?? 0) > 0;
        const hasLab = Number(statLab ?? 0) > 0;

        return {
            title: 'Emergency handoff',
            note: 'Triage and emergency care flow',
            blockerTitle: hasWaiting
                ? `${(waitingTriage ?? 0).toLocaleString()} patient${Number(waitingTriage) === 1 ? '' : 's'} awaiting triage`
                : hasLab
                    ? 'Pending stat lab orders need follow-up'
                    : 'No critical emergency blockers',
            blockerNote: hasWaiting
                ? 'Patients have checked in and are waiting for initial clinical assessment. Prioritise longest-wait patients.'
                : hasLab
                    ? 'Stat laboratory orders are pending results — treatment decisions may be blocked.'
                    : 'Triage queue is clear and admission load looks stable.',
            nextAction: hasWaiting
                ? 'Open the triage queue sorted by wait time and begin assessments from the top.'
                : 'Review current admissions for discharge or escalation decisions.',
            primaryAction: {
                label: hasWaiting ? 'Open triage queue' : 'Open admissions',
                href: hasWaiting ? `/appointments?view=queue&status=checked_in&from=${today}` : '/admissions?view=queue',
            },
            secondaryAction: { label: 'Register walk-in', href: `/appointments?type=walkin&view=queue&from=${today}` },
            chips: [
                { label: 'Awaiting triage', value: waitingTriage },
                { label: 'Active admissions', value: activeAdmissions },
                { label: 'Stat lab orders', value: statLab },
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
                label: 'Triage queue',
                note: 'Checked-in patients waiting for nurse assessment.',
                value: numberValue(counts.value.appointments, 'checked_in'),
                href: `/appointments?view=queue&status=checked_in&from=${today}`,
                actionLabel: 'Open triage',
                icon: 'users' as AppIconName,
            },
            {
                label: 'Blocked discharge checklists',
                note: 'Discharge blockers are still open on active inpatients.',
                value: numberValue(counts.value.wardDischargeChecklists, ['blocked', 'pending']),
                href: '/inpatient-ward',
                actionLabel: 'Open inpatient ward',
                icon: 'bed-double' as AppIconName,
            },
            {
                label: 'Pending medication dispense',
                note: 'Medication requests are still queued for the ward.',
                value: numberValue(counts.value.pharmacy, ['pending', 'in_preparation', 'partially_dispensed']),
                href: '/pharmacy-orders',
                actionLabel: 'Open pharmacy',
                icon: 'pill' as AppIconName,
            },
            {
                label: 'Pending care plans',
                note: 'Care plans not yet finalised or awaiting nurse sign-off.',
                value: numberValue(counts.value.wardCarePlans, ['draft', 'pending']),
                href: '/inpatient-ward',
                actionLabel: 'Open inpatient ward',
                icon: 'clipboard-list' as AppIconName,
            },
        ];
    }

    if (activePresetKey.value === 'emergency') {
        return [
            {
                label: 'Triage queue',
                note: 'Patients checked in and waiting for initial clinical assessment.',
                value: numberValue(counts.value.appointments, 'checked_in'),
                href: `/appointments?view=queue&status=checked_in&from=${today}`,
                actionLabel: 'Open triage queue',
                icon: 'heart-pulse' as AppIconName,
            },
            {
                label: 'Active admissions',
                note: 'Current inpatient census from emergency and ward intake.',
                value: numberValue(counts.value.admissions, 'admitted'),
                href: '/admissions?view=queue',
                actionLabel: 'Open admissions',
                icon: 'bed-double' as AppIconName,
            },
            {
                label: 'Stat lab orders',
                note: 'Laboratory orders still pending collection, processing, or results.',
                value: numberValue(counts.value.laboratory, ['ordered', 'collected', 'in_progress']),
                href: '/laboratory-orders',
                actionLabel: 'Open laboratory',
                icon: 'flask-conical' as AppIconName,
            },
            {
                label: 'Pending medication orders',
                note: 'Pharmacy orders waiting preparation or dispense for emergency patients.',
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

const shiftIntentDismissed = ref(false);

onMounted(async () => {
    loadPinnedMetrics();
    shiftIntentDismissed.value = window.sessionStorage.getItem('dashboard.shift-intent') === '1';
    nowTickerHandle = setInterval(() => {
        nowTick.value = Date.now();
    }, 15_000);
    try {
        await loadDashboard();
    } finally {
        loading.value = false;
        dashboardHydrated.value = true;
        nowTick.value = Date.now();
        applyAutoRefresh();
    }
});

watch(autoRefreshInterval, () => {
    if (dashboardHydrated.value) {
        applyAutoRefresh();
    }
});

onBeforeUnmount(() => {
    if (nowTickerHandle !== null) {
        clearInterval(nowTickerHandle);
        nowTickerHandle = null;
    }
    if (autoRefreshHandle !== null) {
        clearInterval(autoRefreshHandle);
        autoRefreshHandle = null;
    }
});

const showShiftIntent = computed(
    () => !shiftIntentDismissed.value && !loading.value && eligiblePresets.value.length > 1,
);

const overdueQueueCount = computed(() => queueRows.value.filter((r) => r.isOverdue).length);

const escalatedTaskCount = computed(() => Number(counts.value.wardTasks?.escalated ?? 0));

function dismissShiftIntent(presetKey?: DashboardPresetKey): void {
    if (presetKey) switchPreset(presetKey);
    shiftIntentDismissed.value = true;
    window.sessionStorage.setItem('dashboard.shift-intent', '1');
}

const queueViewAllHref = computed(() => {
    if (activePresetKey.value === 'front_desk') return `/appointments?view=queue&from=${today}`;
    if (activePresetKey.value === 'clinician') return `/appointments?view=queue&status=checked_in&from=${today}`;
    if (activePresetKey.value === 'nursing') return `/appointments?view=queue&status=checked_in&from=${today}`;
    if (activePresetKey.value === 'emergency') return `/appointments?view=queue&status=checked_in&from=${today}`;
    if (activePresetKey.value === 'cashier') return '/billing-invoices?status=draft';
    return '#';
});

function switchPreset(key: DashboardPresetKey): void {
    presetSelectValue.value = key;
}
</script>
<template>
    <Head title="Dashboard" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="dashboard-root flex h-full flex-1 flex-col gap-4 overflow-x-auto p-3 md:p-5 lg:p-6">

            <!-- ─── Page Header ─────────────────────────────────────────────── -->
            <section
                class="rounded-lg border border-border bg-card shadow-sm"
                :aria-busy="refreshing"
            >
                <!-- Progress bar -->
                <div
                    v-if="refreshing"
                    class="h-0.5 rounded-t-lg bg-gradient-to-r from-primary/60 via-primary to-primary/60 motion-safe:animate-pulse"
                    aria-hidden="true"
                />

                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <!-- Left: identity -->
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="layout-grid" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <h1 class="text-base font-semibold tracking-tight md:text-lg">Dashboard</h1>
                            <p class="truncate text-xs text-muted-foreground md:max-w-xl md:whitespace-normal">
                                {{ activePreset.description }}
                            </p>
                            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
                                <span class="font-medium text-foreground">{{ activePreset.label }}</span>
                                <span class="select-none text-border" aria-hidden="true">·</span>
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">{{ currentFacilityLabel }}</span>
                                </span>
                                <span class="select-none text-border" aria-hidden="true">·</span>
                                <span>{{ currentTenantLabel }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Right: status badges + toolbar -->
                    <div class="flex w-full shrink-0 flex-col gap-2 md:w-auto md:items-end">
                        <!-- Status row -->
                        <div class="flex flex-wrap items-center gap-1.5 md:justify-end">
                            <Badge
                                v-if="lastLoadedAt"
                                variant="outline"
                                class="rounded-lg text-[11px] tabular-nums"
                                :class="isFresh ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'"
                                :title="`Last refreshed at ${lastLoadedAt}`"
                            >
                                <AppIcon :name="isFresh ? 'check-circle' : 'refresh-cw'" class="mr-1 size-3" aria-hidden="true" />
                                {{ lastLoadedRelative }}
                            </Badge>
                            <Badge
                                v-if="partialData"
                                variant="outline"
                                class="rounded-lg border-amber-500/40 bg-amber-500/5 text-[11px] text-amber-700 dark:text-amber-300"
                                :title="failureLabels.join(', ')"
                            >
                                <AppIcon name="alert-triangle" class="mr-1 size-3" aria-hidden="true" />
                                {{ failures.length }} source{{ failures.length === 1 ? '' : 's' }} unavailable
                            </Badge>
                        </div>

                        <!-- Toolbar row -->
                        <div class="flex flex-wrap items-center gap-1.5 md:justify-end">
                            <!-- Preset switcher -->
                            <template v-if="canSwitchPreset">
                                <template v-if="visiblePresetOptions.length <= 4">
                                    <div class="inline-flex rounded-lg border bg-muted/40 p-0.5">
                                        <Button
                                            v-for="preset in visiblePresetOptions"
                                            :key="preset.key"
                                            size="sm"
                                            :variant="activePresetKey === preset.key ? 'default' : 'ghost'"
                                            class="h-7 rounded-md px-2.5 text-[11px]"
                                            @click="switchPreset(preset.key)"
                                        >
                                            {{ preset.label }}
                                        </Button>
                                    </div>
                                </template>
                                <Select v-else v-model="presetSelectValue">
                                    <SelectTrigger class="h-8 w-full min-w-[12rem] rounded-lg text-xs sm:w-48 data-[size=default]:h-8">
                                        <SelectValue placeholder="Workflow view" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">
                                            Auto — {{ DASHBOARD_PRESETS.find((p) => p.key === inferredPreset)?.label ?? 'Default' }}
                                        </SelectItem>
                                        <SelectItem
                                            v-for="preset in visiblePresetOptions"
                                            :key="preset.key"
                                            :value="preset.key"
                                        >
                                            {{ preset.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </template>

                            <!-- Density toggle -->
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                class="h-8 rounded-lg px-2.5 text-xs"
                                :title="density === 'compact' ? 'Switch to comfortable density' : 'Switch to compact density'"
                                @click="density = density === 'compact' ? 'comfortable' : 'compact'"
                            >
                                <AppIcon :name="density === 'compact' ? 'layout-list' : 'layout-grid'" class="size-3.5" />
                                <span class="ml-1 hidden sm:inline">{{ density === 'compact' ? 'Compact' : 'Comfort' }}</span>
                            </Button>

                            <!-- Auto-refresh -->
                            <Select v-model="autoRefreshInterval">
                                <SelectTrigger
                                    class="h-8 w-[8rem] rounded-lg text-xs data-[size=default]:h-8"
                                    :title="autoRefreshInterval !== 'off' ? `Auto-refresh every ${autoRefreshInterval}` : 'Auto-refresh off'"
                                >
                                    <SelectValue placeholder="Auto" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="key in (['off', '30s', '1m', '5m'] as const)"
                                        :key="key"
                                        :value="key"
                                    >
                                        {{ AUTO_REFRESH_LABEL[key] }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>

                            <!-- Manual refresh -->
                            <Button
                                size="sm"
                                variant="outline"
                                class="h-8 rounded-lg px-3 text-xs"
                                :disabled="refreshing"
                                @click="refreshDashboard"
                            >
                                <AppIcon
                                    name="refresh-cw"
                                    class="size-3.5 transition-transform"
                                    :class="refreshing ? 'animate-spin' : ''"
                                />
                                <span class="ml-1.5">{{ refreshing ? 'Refreshing…' : 'Refresh' }}</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- ─── Partial-data alert ─────────────────────────────────────── -->
            <Alert
                v-if="partialData"
                class="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 py-2.5 text-amber-900 dark:text-amber-200"
            >
                <AppIcon name="alert-triangle" class="size-4 text-amber-600" />
                <AlertTitle class="text-sm font-medium">Some data sources are unavailable</AlertTitle>
                <AlertDescription class="mt-1 text-xs">
                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-muted-foreground">Affected sources:</span>
                        <Badge
                            v-for="label in failureLabels"
                            :key="label"
                            variant="outline"
                            class="rounded-lg bg-background/60 text-[10px]"
                        >
                            {{ label }}
                        </Badge>
                    </div>
                </AlertDescription>
            </Alert>

            <!-- ─── Shift-intent prompt (multi-preset, once per day) ────────── -->
            <div
                v-if="showShiftIntent"
                class="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                role="status"
                aria-live="polite"
            >
                <div class="min-w-0">
                    <p class="text-sm font-medium text-foreground">What are you working on today?</p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                        You have access to multiple workflows. Select one to set the context for this session.
                    </p>
                </div>
                <div class="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                    <Button
                        v-for="preset in visiblePresetOptions"
                        :key="preset.key"
                        size="sm"
                        :variant="activePresetKey === preset.key ? 'default' : 'outline'"
                        class="h-8 rounded-lg px-3 text-xs"
                        @click="dismissShiftIntent(preset.key)"
                    >
                        {{ preset.label }}
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        class="h-8 rounded-lg px-2.5 text-xs text-muted-foreground"
                        @click="dismissShiftIntent()"
                    >
                        <AppIcon name="x" class="size-3.5" />
                        <span class="ml-1">Dismiss</span>
                    </Button>
                </div>
            </div>

            <!-- ─── Tabs ───────────────────────────────────────────────────── -->
            <Tabs v-model="activeTab" class="space-y-4">
                <TabsList class="h-9 rounded-lg border bg-muted/40 p-1">
                    <TabsTrigger value="overview" class="h-7 rounded-md px-4 text-xs font-medium">
                        <AppIcon name="layout-grid" class="mr-1.5 size-3.5" aria-hidden="true" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="handoff" class="h-7 rounded-md px-4 text-xs font-medium">
                        <AppIcon name="calendar-clock" class="mr-1.5 size-3.5" aria-hidden="true" />
                        Handoff
                    </TabsTrigger>
                    <TabsTrigger value="status" class="h-7 rounded-md px-4 text-xs font-medium">
                        <AppIcon name="activity" class="mr-1.5 size-3.5" aria-hidden="true" />
                        Status
                    </TabsTrigger>
                    <TabsTrigger value="resources" class="h-7 rounded-md px-4 text-xs font-medium">
                        <AppIcon name="shield-check" class="mr-1.5 size-3.5" aria-hidden="true" />
                        Resources
                    </TabsTrigger>
                </TabsList>

                <!-- ── Overview: KPIs + quick actions + queue ──────────────── -->
                <TabsContent value="overview" class="space-y-4">

                    <!-- KPI grid -->
                    <div
                        class="grid transition-opacity duration-300 sm:grid-cols-2 lg:grid-cols-4"
                        :class="[gridGapClass, refreshing ? 'opacity-60' : 'opacity-100']"
                    >
                        <Card
                            v-for="item in orderedKpis"
                            :key="item.label"
                            class="group relative overflow-hidden rounded-lg border border-border shadow-sm transition-shadow hover:shadow-md"
                        >
                            <span
                                class="absolute inset-y-0 left-0 w-[3px] rounded-l-lg"
                                :class="item.unavailable ? 'bg-muted-foreground/20' : item.pinned ? 'bg-amber-500' : 'bg-primary/50'"
                                aria-hidden="true"
                            />
                            <CardContent :class="['relative pl-4 pt-4', kpiPaddingClass]">
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0 flex-1">
                                        <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                            {{ item.label }}
                                        </p>
                                        <template v-if="loading || refreshing">
                                            <Skeleton :class="['mt-2', isCompact ? 'h-5' : 'h-7', 'w-20 rounded-lg']" />
                                            <Skeleton class="mt-1.5 h-2.5 w-3/4 rounded-lg" />
                                        </template>
                                        <template v-else>
                                            <p
                                                :class="[
                                                    'mt-1 leading-tight tabular-nums',
                                                    kpiValueClass,
                                                    item.unavailable
                                                        ? 'font-medium text-muted-foreground'
                                                        : 'font-bold text-foreground',
                                                ]"
                                            >
                                                {{ item.value }}
                                            </p>
                                            <p class="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                                                {{ item.help }}
                                            </p>
                                        </template>
                                    </div>
                                    <div class="flex shrink-0 flex-col items-end gap-1.5">
                                        <span
                                            :class="[
                                                'flex items-center justify-center rounded-lg text-primary/70',
                                                item.unavailable ? 'bg-muted text-muted-foreground' : 'bg-primary/10',
                                                isCompact ? 'size-8' : 'size-9',
                                            ]"
                                            aria-hidden="true"
                                        >
                                            <AppIcon :name="item.icon" class="size-4" />
                                        </span>
                                        <button
                                            type="button"
                                            class="rounded-md p-0.5 text-sm leading-none text-muted-foreground/60 transition-colors hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            :title="item.pinned ? 'Unpin metric' : 'Pin metric to top'"
                                            :aria-pressed="item.pinned"
                                            @click="togglePin(item.label)"
                                        >
                                            {{ item.pinned ? '★' : '☆' }}
                                            <span class="sr-only">{{ item.pinned ? 'Unpin' : 'Pin' }} {{ item.label }}</span>
                                        </button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <!-- Quick actions -->
                    <div class="flex flex-wrap items-center gap-2">
                        <template v-for="action in actions" :key="action.label">
                            <Button
                                v-if="action.href"
                                as-child
                                size="sm"
                                :variant="action.variant"
                                class="h-9 rounded-lg px-4 text-xs font-medium"
                            >
                                <Link :href="action.href" class="inline-flex items-center gap-1.5">
                                    <AppIcon :name="action.icon" class="size-3.5" />
                                    {{ action.label }}
                                </Link>
                            </Button>
                            <Button
                                v-else
                                size="sm"
                                :variant="action.variant"
                                class="h-9 rounded-lg px-4 text-xs font-medium"
                                @click="action.onClick?.()"
                            >
                                <AppIcon :name="action.icon" class="size-3.5" />
                                <span class="ml-1.5">{{ action.label }}</span>
                            </Button>
                        </template>
                    </div>

                    <!-- P0 critical alerts for current preset -->
                    <Alert
                        v-if="activePresetKey === 'front_desk' && !loading && !refreshing && overdueQueueCount > 0"
                        class="rounded-lg border border-rose-500/40 bg-rose-500/5 py-2.5 text-rose-900 dark:text-rose-200"
                    >
                        <AppIcon name="alert-triangle" class="size-4 text-rose-600" />
                        <AlertTitle class="text-sm font-medium">
                            {{ overdueQueueCount }} overdue arrival{{ overdueQueueCount === 1 ? '' : 's' }} in queue
                        </AlertTitle>
                        <AlertDescription class="mt-1 text-xs">
                            Scheduled appointments have passed their expected check-in time. Review the queue below and prioritise them.
                        </AlertDescription>
                    </Alert>

                    <Alert
                        v-if="activePresetKey === 'nursing' && !loading && !refreshing && escalatedTaskCount > 0"
                        class="rounded-lg border border-rose-500/40 bg-rose-500/5 py-2.5 text-rose-900 dark:text-rose-200"
                    >
                        <AppIcon name="alert-triangle" class="size-4 text-rose-600" />
                        <AlertTitle class="text-sm font-medium">
                            {{ escalatedTaskCount }} escalated ward task{{ escalatedTaskCount === 1 ? '' : 's' }} require attention
                        </AlertTitle>
                        <AlertDescription class="mt-1 text-xs">
                            Open the inpatient ward to review and acknowledge outstanding escalations before the next shift.
                        </AlertDescription>
                    </Alert>

                    <!-- Queue card — full width, shrinks to content -->
                    <Card
                        class="self-start rounded-lg border border-border shadow-sm"
                        :class="refreshing ? 'opacity-75' : ''"
                    >
                        <CardHeader class="flex flex-col gap-3 space-y-0 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
                            <div class="min-w-0 space-y-0.5">
                                <CardTitle class="text-sm font-semibold">{{ queueTitle }}</CardTitle>
                                <CardDescription class="text-xs leading-relaxed">{{ queueDescription }}</CardDescription>
                            </div>
                            <div class="flex shrink-0 items-center gap-2">
                                <Badge v-if="!loading" variant="secondary" class="rounded-lg tabular-nums text-[11px]">
                                    {{ queueRows.length }}
                                </Badge>
                                <Button
                                    v-if="queueRows.length > 0 && !loading"
                                    as-child
                                    size="sm"
                                    variant="outline"
                                    class="h-7 rounded-lg text-xs"
                                >
                                    <Link :href="queueViewAllHref" class="inline-flex items-center gap-1">
                                        View all
                                        <AppIcon name="arrow-right" class="size-3.5" />
                                    </Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent class="p-0">
                            <!-- Loading skeleton -->
                            <div v-if="loading" class="space-y-px p-3">
                                <div
                                    v-for="index in 3"
                                    :key="index"
                                    class="flex items-start gap-3 rounded-lg p-2.5"
                                >
                                    <Skeleton class="mt-0.5 size-8 shrink-0 rounded-lg" />
                                    <div class="flex-1 space-y-1.5">
                                        <Skeleton class="h-3.5 w-36 rounded" />
                                        <Skeleton class="h-3 w-full rounded" />
                                        <Skeleton class="h-3 w-1/2 rounded" />
                                    </div>
                                </div>
                            </div>

                            <!-- Empty state -->
                            <div
                                v-else-if="queueRows.length === 0"
                                class="flex flex-col items-center justify-center gap-2 px-6 py-6 text-center"
                            >
                                <span class="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
                                    <AppIcon name="check-circle" class="size-6 text-emerald-600 dark:text-emerald-400" />
                                </span>
                                <p class="mt-1 text-sm font-medium text-foreground">Queue is clear</p>
                                <p class="max-w-xs text-xs text-muted-foreground">
                                    No items in this queue. Switch workflow preset or use the quick actions above to open a worklist.
                                </p>
                            </div>

                            <!-- Queue rows -->
                            <div v-else class="max-h-[28rem] overflow-y-auto">
                                <template v-for="(row, index) in queueRows" :key="row.id">
                                    <!-- Group header: show when this row starts a new group -->
                                    <div
                                        v-if="row.group && (index === 0 || queueRows[index - 1]?.group !== row.group)"
                                        class="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted/60 px-4 py-1.5 backdrop-blur-sm"
                                    >
                                        <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{{ row.group }}</span>
                                        <span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                                            {{ queueGroupCounts.get(row.group) ?? 0 }}
                                        </span>
                                    </div>
                                    <Link
                                        :href="row.href"
                                        class="group flex items-start gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none"
                                    >
                                        <span
                                            class="mt-1.5 size-2 shrink-0 rounded-full"
                                            :class="
                                                row.isOverdue
                                                    ? 'bg-rose-500'
                                                    : statusVariant(row.status) === 'destructive'
                                                      ? 'bg-rose-500/80'
                                                      : statusVariant(row.status) === 'default'
                                                        ? 'bg-sky-500'
                                                        : statusVariant(row.status) === 'secondary'
                                                          ? 'bg-emerald-500'
                                                          : 'bg-muted-foreground/40'
                                            "
                                            aria-hidden="true"
                                        />
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-start justify-between gap-2">
                                                <p class="truncate text-sm font-medium leading-snug">{{ row.title }}</p>
                                                <div class="flex shrink-0 items-center gap-1">
                                                    <Badge v-if="row.isOverdue" variant="destructive" class="rounded-lg text-[10px]">Overdue</Badge>
                                                    <Badge :variant="statusVariant(row.status)" class="max-w-[7rem] truncate rounded-lg text-[10px]">
                                                        {{ row.status }}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ row.subtitle }}</p>
                                            <div class="mt-1 flex items-center justify-between gap-2">
                                                <span class="text-[11px] text-muted-foreground">{{ row.meta }}</span>
                                                <span class="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                                                    {{ row.actionLabel }}
                                                    <AppIcon name="chevron-right" class="size-3" />
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                </template>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <!-- ── Handoff: shift context + operational watch ───────────── -->
                <TabsContent value="handoff" class="space-y-4">

                    <!-- Shift stat chips — top-level numbers at a glance -->
                    <div class="grid grid-cols-3 gap-3">
                        <div
                            v-for="chip in handoff.chips"
                            :key="chip.label"
                            class="rounded-lg border border-border bg-card p-3 text-center shadow-sm"
                        >
                            <p class="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{{ chip.label }}</p>
                            <p class="mt-1.5 text-2xl font-bold tabular-nums text-foreground">
                                {{ chip.value === null ? '—' : chip.value.toLocaleString() }}
                            </p>
                        </div>
                    </div>

                    <!-- Two-column: handoff card | operational watch -->
                    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">

                        <!-- Shift handoff (always expanded on this dedicated tab) -->
                        <Card class="rounded-lg border border-border shadow-sm">
                            <CardHeader class="border-b pb-3">
                                <CardTitle class="text-sm font-semibold">Shift handoff</CardTitle>
                                <CardDescription class="mt-0.5 text-xs leading-snug">
                                    {{ handoff.title }} · {{ handoff.note }}
                                </CardDescription>
                            </CardHeader>
                            <CardContent class="space-y-3 pt-3">
                                <!-- Current blocker -->
                                <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                                    <p class="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                                        Current blocker
                                    </p>
                                    <p class="mt-1 text-sm font-semibold text-foreground">{{ handoff.blockerTitle }}</p>
                                    <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">{{ handoff.blockerNote }}</p>
                                </div>

                                <!-- Recommended next action -->
                                <div class="rounded-lg border bg-muted/25 p-3">
                                    <p class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        Recommended next action
                                    </p>
                                    <p class="mt-1 text-xs leading-relaxed text-foreground">{{ handoff.nextAction }}</p>
                                    <div class="mt-3 flex flex-wrap gap-2">
                                        <Button as-child size="sm" class="h-8 rounded-lg text-xs">
                                            <Link :href="handoff.primaryAction.href">{{ handoff.primaryAction.label }}</Link>
                                        </Button>
                                        <Button as-child size="sm" variant="outline" class="h-8 rounded-lg text-xs">
                                            <Link :href="handoff.secondaryAction.href">{{ handoff.secondaryAction.label }}</Link>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <!-- Operational watch -->
                        <Card class="self-start rounded-lg border border-border shadow-sm">
                            <CardHeader class="space-y-0 border-b pb-3">
                                <CardTitle class="text-sm font-semibold">Operational watch</CardTitle>
                                <CardDescription class="mt-0.5 text-xs">Cross-checks for this workspace.</CardDescription>
                            </CardHeader>
                            <CardContent class="divide-y p-0">
                                <div
                                    v-for="item in watchItems"
                                    :key="item.label"
                                    class="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                                >
                                    <span
                                        class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                                        aria-hidden="true"
                                    >
                                        <AppIcon :name="item.icon" class="size-4" />
                                    </span>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-start justify-between gap-2">
                                            <p class="text-xs font-medium leading-snug text-foreground">{{ item.label }}</p>
                                            <Badge variant="outline" class="shrink-0 rounded-lg text-[11px] tabular-nums">
                                                {{ item.value === null ? '—' : item.value.toLocaleString() }}
                                            </Badge>
                                        </div>
                                        <p class="mt-0.5 text-[11px] leading-snug text-muted-foreground">{{ item.note }}</p>
                                        <Link
                                            :href="item.href"
                                            class="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                                        >
                                            {{ item.actionLabel }}
                                            <AppIcon name="chevron-right" class="size-3" />
                                        </Link>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <!-- ── Status: system health + recent activity ─────────────── -->
                <TabsContent value="status" class="space-y-4">

                    <!-- System status -->
                    <Card class="rounded-lg border border-border shadow-sm">
                        <CardHeader class="flex flex-row items-center justify-between space-y-0 border-b pb-3">
                            <CardTitle class="text-sm font-semibold">System status</CardTitle>
                            <Badge
                                variant="outline"
                                class="rounded-lg text-[11px]"
                                :class="multiTenantIsolationEnabled ? 'border-sky-500/40 bg-sky-500/5 text-sky-700 dark:text-sky-300' : ''"
                            >
                                {{ multiTenantIsolationEnabled ? 'Multi-tenant' : 'Single-tenant' }}
                            </Badge>
                        </CardHeader>
                        <CardContent class="pt-3">
                            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                <div class="rounded-lg border bg-muted/20 p-2.5">
                                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Resolved from</p>
                                    <p class="mt-0.5 truncate text-xs font-medium text-foreground">{{ scopeData?.resolvedFrom || 'Unknown' }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-2.5">
                                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Accessible facilities</p>
                                    <p class="mt-0.5 text-xs font-bold tabular-nums text-foreground">
                                        {{ Number(scopeData?.userAccess?.accessibleFacilityCount ?? 0) }}
                                    </p>
                                </div>
                                <div
                                    class="rounded-lg border p-2.5"
                                    :class="securityStatus?.emailVerified ? 'border-emerald-500/30 bg-emerald-500/5' : 'bg-muted/20'"
                                >
                                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Email verified</p>
                                    <p
                                        class="mt-0.5 text-xs font-medium"
                                        :class="securityStatus?.emailVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'"
                                    >
                                        {{ securityStatus?.emailVerified ? 'Verified' : 'Not verified' }}
                                    </p>
                                </div>
                                <div
                                    class="rounded-lg border p-2.5"
                                    :class="securityStatus?.twoFactorEnabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'"
                                >
                                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">2FA status</p>
                                    <p
                                        class="mt-0.5 text-xs font-medium"
                                        :class="securityStatus?.twoFactorEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'"
                                    >
                                        {{ securityStatus?.twoFactorEnabled ? 'Enabled' : 'Disabled' }}
                                    </p>
                                </div>
                            </div>
                            <div class="mt-3 grid gap-2 sm:grid-cols-2">
                                <div v-if="auditExportHealth" class="rounded-lg border bg-muted/20 p-2.5">
                                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Audit exports (7d)</p>
                                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                                        <Badge variant="outline" class="rounded-lg text-[11px] tabular-nums">
                                            Backlog {{ Number(auditExportHealth.aggregate?.currentBacklog ?? 0) }}
                                        </Badge>
                                        <Badge
                                            :variant="Number(auditExportHealth.aggregate?.recentFailed ?? 0) > 0 ? 'destructive' : 'outline'"
                                            class="rounded-lg text-[11px] tabular-nums"
                                        >
                                            Failed {{ Number(auditExportHealth.aggregate?.recentFailed ?? 0) }}
                                        </Badge>
                                        <Badge variant="outline" class="rounded-lg text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400">
                                            Done {{ Number(auditExportHealth.aggregate?.recentCompleted ?? 0) }}
                                        </Badge>
                                    </div>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-2.5">
                                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Auto-refresh</p>
                                    <p class="mt-0.5 text-xs font-medium text-foreground">{{ AUTO_REFRESH_LABEL[autoRefreshInterval] }}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <!-- Recent activity -->
                    <Card class="rounded-lg border border-border shadow-sm">
                        <CardHeader class="flex flex-row items-center justify-between space-y-0 border-b pb-3">
                            <div>
                                <CardTitle class="text-sm font-semibold">Recent activity</CardTitle>
                                <CardDescription class="mt-0.5 text-xs">Audit export events from the recent window.</CardDescription>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                class="h-7 shrink-0 rounded-lg px-2.5 text-xs"
                                @click="activeTab = 'resources'"
                            >
                                Deep dive
                                <AppIcon name="arrow-right" class="ml-1 size-3" />
                            </Button>
                        </CardHeader>
                        <CardContent class="p-0">
                            <div
                                v-if="activityFeed.length === 0"
                                class="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center"
                            >
                                <span class="flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
                                    <AppIcon name="check-circle" class="size-5 text-emerald-600 dark:text-emerald-400" />
                                </span>
                                <p class="text-xs text-muted-foreground">No export failures in the recent window.</p>
                            </div>
                            <ul v-else class="divide-y">
                                <li
                                    v-for="entry in activityFeed"
                                    :key="entry.id"
                                    class="flex items-start gap-3 px-4 py-3"
                                >
                                    <span
                                        class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
                                        aria-hidden="true"
                                    >
                                        <AppIcon name="alert-triangle" class="size-3.5" />
                                    </span>
                                    <div class="min-w-0">
                                        <p class="text-xs font-medium leading-snug text-foreground">{{ entry.title }}</p>
                                        <p class="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{{ entry.subtitle }}</p>
                                        <p class="mt-1 text-[11px] text-muted-foreground/70">{{ entry.meta }}</p>
                                    </div>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent id="dashboard-resources" value="resources" class="space-y-4">
                    <div class="grid gap-4 xl:grid-cols-2">
                        <!-- User & Security -->
                        <Card class="rounded-lg border border-border shadow-sm">
                            <CardHeader class="border-b pb-3">
                                <CardTitle class="text-sm font-semibold">User &amp; Security</CardTitle>
                                <CardDescription class="text-xs">Session context for this workstation.</CardDescription>
                            </CardHeader>
                            <CardContent class="pt-4 text-sm">
                                <div class="flex items-start gap-3">
                                    <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <AppIcon name="user" class="size-5" />
                                    </span>
                                    <div class="min-w-0">
                                        <p class="font-semibold text-foreground">{{ authMe?.name || 'Unavailable' }}</p>
                                        <p class="text-xs text-muted-foreground">{{ authMe?.email || 'Unavailable' }}</p>
                                    </div>
                                </div>
                                <div v-if="(authMe?.roles ?? []).length > 0" class="mt-3 flex flex-wrap gap-1.5">
                                    <Badge
                                        v-for="role in authMe.roles.slice(0, 6)"
                                        :key="role.code || role.name"
                                        variant="outline"
                                        class="rounded-lg text-[11px]"
                                    >
                                        {{ role.name || role.code }}
                                    </Badge>
                                </div>
                                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                                    <div
                                        class="flex items-center gap-2 rounded-lg border p-2.5"
                                        :class="securityStatus?.emailVerified ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'"
                                    >
                                        <AppIcon
                                            :name="securityStatus?.emailVerified ? 'check-circle' : 'alert-triangle'"
                                            class="size-4 shrink-0"
                                            :class="securityStatus?.emailVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'"
                                        />
                                        <div>
                                            <p class="text-[10px] uppercase tracking-wide text-muted-foreground">Email verified</p>
                                            <p class="text-xs font-medium">{{ securityStatus?.emailVerified ? 'Verified' : 'Not verified' }}</p>
                                        </div>
                                    </div>
                                    <div
                                        class="flex items-center gap-2 rounded-lg border p-2.5"
                                        :class="securityStatus?.twoFactorEnabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'"
                                    >
                                        <AppIcon
                                            :name="securityStatus?.twoFactorEnabled ? 'shield-check' : 'alert-triangle'"
                                            class="size-4 shrink-0"
                                            :class="securityStatus?.twoFactorEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'"
                                        />
                                        <div>
                                            <p class="text-[10px] uppercase tracking-wide text-muted-foreground">2FA</p>
                                            <p class="text-xs font-medium">{{ securityStatus?.twoFactorEnabled ? 'Enabled' : 'Disabled' }}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <!-- Scope & Routing -->
                        <Card class="rounded-lg border border-border shadow-sm">
                            <CardHeader class="border-b pb-3">
                                <CardTitle class="text-sm font-semibold">Scope &amp; Routing</CardTitle>
                                <CardDescription class="text-xs">Facility and isolation context for this session.</CardDescription>
                            </CardHeader>
                            <CardContent class="pt-4">
                                <div class="grid gap-2 sm:grid-cols-2">
                                    <div class="rounded-lg border bg-muted/20 p-2.5">
                                        <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tenant</p>
                                        <p class="mt-0.5 truncate text-xs font-medium text-foreground">{{ scopeData?.tenant?.name || scopeData?.tenant?.code || 'Not scoped' }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/20 p-2.5">
                                        <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Facility</p>
                                        <p class="mt-0.5 truncate text-xs font-medium text-foreground">{{ scopeData?.facility?.name || scopeData?.facility?.code || 'Not scoped' }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/20 p-2.5">
                                        <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Resolved from</p>
                                        <p class="mt-0.5 text-xs font-medium text-foreground">{{ scopeData?.resolvedFrom || 'Unknown' }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/20 p-2.5">
                                        <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Accessible facilities</p>
                                        <p class="mt-0.5 text-xs font-bold tabular-nums text-foreground">{{ Number(scopeData?.userAccess?.accessibleFacilityCount ?? 0) }}</p>
                                    </div>
                                </div>
                                <div class="mt-2 rounded-lg border bg-muted/20 p-2.5">
                                    <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Isolation mode</p>
                                    <p class="mt-0.5 text-xs font-medium text-foreground">
                                        {{ multiTenantIsolationEnabled ? 'Multi-tenant isolation enabled' : 'Single-tenant / shared routing mode' }}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div class="grid gap-4 xl:grid-cols-2">
                        <!-- Audit export health -->
                        <Card class="rounded-lg border border-border shadow-sm">
                            <CardHeader class="border-b pb-3">
                                <CardTitle class="text-sm font-semibold">Audit export health</CardTitle>
                                <CardDescription class="text-xs">Backlog and failure signals across accessible export modules.</CardDescription>
                            </CardHeader>
                            <CardContent class="pt-4">
                                <template v-if="auditExportHealth">
                                    <div class="flex flex-wrap gap-1.5">
                                        <Badge variant="outline" class="rounded-lg text-[11px] tabular-nums">
                                            Backlog {{ Number(auditExportHealth.aggregate?.currentBacklog ?? 0) }}
                                        </Badge>
                                        <Badge
                                            :variant="Number(auditExportHealth.aggregate?.recentFailed ?? 0) > 0 ? 'destructive' : 'outline'"
                                            class="rounded-lg text-[11px] tabular-nums"
                                        >
                                            Failed {{ Number(auditExportHealth.aggregate?.recentFailed ?? 0) }}
                                        </Badge>
                                        <Badge variant="outline" class="rounded-lg text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400">
                                            Completed {{ Number(auditExportHealth.aggregate?.recentCompleted ?? 0) }}
                                        </Badge>
                                        <Badge variant="outline" class="rounded-lg text-[11px] tabular-nums">
                                            Window {{ Number(auditExportHealth.aggregate?.totalRecent ?? 0) }}
                                        </Badge>
                                    </div>
                                    <div v-if="exportModuleRows.length > 0" class="mt-3 space-y-2">
                                        <div
                                            v-for="row in exportModuleRows"
                                            :key="row.moduleKey"
                                            class="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 p-2.5"
                                        >
                                            <div class="min-w-0">
                                                <p class="text-xs font-medium text-foreground">{{ row.label }}</p>
                                                <p class="mt-0.5 text-[11px] text-muted-foreground">
                                                    Backlog {{ row.currentBacklog }} · Failed {{ row.recentFailed }} · Done {{ row.recentCompleted }}
                                                </p>
                                            </div>
                                            <Badge
                                                :variant="row.recentFailed > 0 ? 'destructive' : row.currentBacklog > 0 ? 'secondary' : 'outline'"
                                                class="shrink-0 rounded-lg text-[11px]"
                                            >
                                                {{ row.recentFailed > 0 ? 'Attention' : row.currentBacklog > 0 ? 'In progress' : 'Healthy' }}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div v-if="recentExportFailures.length > 0" class="mt-4 space-y-2">
                                        <p class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recent failures</p>
                                        <div
                                            v-for="item in recentExportFailures"
                                            :key="item.id || item.failedAt || item.createdAt"
                                            class="rounded-lg border border-destructive/20 bg-destructive/5 p-2.5"
                                        >
                                            <p class="text-xs font-medium text-foreground">
                                                {{ formatEnumLabel(String(item.moduleKey ?? 'module')) }} ·
                                                {{ formatDateTime(item.failedAt ?? item.createdAt) }}
                                            </p>
                                            <p class="mt-0.5 text-[11px] text-muted-foreground">
                                                {{ item.errorMessage?.trim() || 'No error message captured.' }}
                                            </p>
                                        </div>
                                    </div>
                                </template>
                                <div
                                    v-else
                                    class="flex flex-col items-center justify-center gap-2 py-10 text-center"
                                >
                                    <span class="flex size-10 items-center justify-center rounded-full bg-muted">
                                        <AppIcon name="activity" class="size-5 text-muted-foreground" />
                                    </span>
                                    <p class="text-xs text-muted-foreground">Audit export health is unavailable for this session.</p>
                                </div>
                            </CardContent>
                        </Card>

                        <!-- Retry-resume telemetry -->
                        <Card class="rounded-lg border border-border shadow-sm">
                            <CardHeader class="border-b pb-3">
                                <CardTitle class="text-sm font-semibold">Retry-resume telemetry</CardTitle>
                                <CardDescription class="text-xs">Operational signal for export retry and resume handling.</CardDescription>
                            </CardHeader>
                            <CardContent class="pt-4">
                                <template v-if="retryResumeHealth">
                                    <div class="flex flex-wrap gap-1.5">
                                        <Badge variant="outline" class="rounded-lg text-[11px] tabular-nums">
                                            Attempts {{ Number(retryResumeHealth.aggregate?.attempts ?? 0) }}
                                        </Badge>
                                        <Badge variant="outline" class="rounded-lg text-[11px] tabular-nums text-emerald-700 dark:text-emerald-400">
                                            Success {{ Number(retryResumeHealth.aggregate?.successes ?? 0) }}
                                        </Badge>
                                        <Badge
                                            :variant="Number(retryResumeHealth.aggregate?.failures ?? 0) > 0 ? 'destructive' : 'outline'"
                                            class="rounded-lg text-[11px] tabular-nums"
                                        >
                                            Failures {{ Number(retryResumeHealth.aggregate?.failures ?? 0) }}
                                        </Badge>
                                        <Badge variant="outline" class="rounded-lg text-[11px]">
                                            Rate {{ retryResumeHealth.aggregate?.successRatePercent ?? 'N/A' }}
                                        </Badge>
                                    </div>
                                    <div v-if="retryModuleRows.length > 0" class="mt-3 space-y-2">
                                        <div
                                            v-for="row in retryModuleRows"
                                            :key="row.moduleKey"
                                            class="rounded-lg border bg-muted/20 p-2.5"
                                        >
                                            <div class="flex items-start justify-between gap-2">
                                                <p class="text-xs font-medium text-foreground">{{ row.label }}</p>
                                                <Badge
                                                    :variant="row.failures > 0 ? 'destructive' : 'outline'"
                                                    class="shrink-0 rounded-lg text-[11px]"
                                                >
                                                    {{ row.failures > 0 ? 'Failure' : 'Stable' }}
                                                </Badge>
                                            </div>
                                            <p class="mt-1 text-[11px] text-muted-foreground">
                                                Attempts {{ row.attempts }} · Success {{ row.successes }} · Failures {{ row.failures }}
                                            </p>
                                            <p v-if="row.lastFailureReason" class="mt-0.5 text-[11px] text-muted-foreground/80">
                                                Last reason: {{ row.lastFailureReason }}
                                            </p>
                                        </div>
                                    </div>
                                </template>
                                <div
                                    v-else
                                    class="flex flex-col items-center justify-center gap-2 py-10 text-center"
                                >
                                    <span class="flex size-10 items-center justify-center rounded-full bg-muted">
                                        <AppIcon name="activity" class="size-5 text-muted-foreground" />
                                    </span>
                                    <p class="text-xs text-muted-foreground">Retry-resume telemetry is unavailable for this session.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    </AppLayout>
</template>
