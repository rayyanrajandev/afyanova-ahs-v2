<script setup lang="ts">
import { Head, Link, usePage } from '@inertiajs/vue3';
import { watchDebounced } from '@vueuse/core';
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardContext } from '@/composables/useDashboardContext';
import { useDashboardWorkflowPresetStorage } from '@/composables/useDashboardWorkflowPreset';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { DASHBOARD_PRESETS, type DashboardPresetKey } from '@/config/dashboardPresets';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGet } from '@/lib/apiClient';
import { buildOperationsPrivilegeQueueRows } from '@/lib/dashboardOperationsQueue';
import {
    directServicePatientWorklistHref,
    groupDirectServiceOrdersByPatient,
    type DirectServiceModuleKey,
} from '@/lib/directServicePatientWorklist';
import { encounterWorkspaceLegacyAppointmentHref } from '@/lib/encounterWorkspace';
import type { AppIconName } from '@/lib/icons';
import { formatEnumLabel } from '@/lib/labels';
import type { BreadcrumbItem } from '@/types';
import type { DashboardContextPayload } from '@/types/dashboard';
import { appendWorkflowBatchEntries } from '@/workflows/appendWorkflowBatch';
import { buildWorkflowSurface } from '@/workflows/buildWorkflowSurface';

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
    triageCategory?: string | null;
    searchHaystack?: string;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Dashboard', href: '/dashboard' }];
const today = new Date(Date.now() - (new Date().getTimezoneOffset() * 60 * 1000)).toISOString().slice(0, 10);
const page = usePage<{ dashboardContext?: DashboardContextPayload | null }>();

const { hasPermission, isFacilitySuperAdmin, isPlatformSuperAdmin, multiTenantIsolationEnabled, sessionRoleCodes, scope: platformScope } =
    usePlatformAccess();

const {
    eligibleWorkflowKeys: eligiblePresets,
    defaultWorkflowKey,
    workflowDefinitions,
    canSwitchWorkflow: canSwitchPreset,
} = useDashboardContext(page.props.dashboardContext);

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
const clinicianClinicalDepartment = ref<string | null>(null);
const auditExportHealth = ref<any | null>(null);
const retryResumeHealth = ref<any | null>(null);
const lastLoadedAt = ref<string | null>(null);
const sharedOpsTelemetryLoaded = ref(false);

const nowTick = ref(Date.now());
let nowTickerHandle: ReturnType<typeof setInterval> | null = null;

const currentUserId = computed<number | null>(() => {
    const raw = page.props.auth?.user?.id ?? authMe.value?.id;
    const normalized = Number(raw ?? 0);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
});

function clinicianQueueHref(
    status: 'waiting_provider' | 'in_consultation' | 'completed' = 'waiting_provider',
    focusAppointmentId?: string,
    searchQuery?: string,
): string {
    const params = new URLSearchParams({
        view: 'clinical',
        status,
        from: today,
    });

    if (currentUserId.value !== null) {
        params.set('clinicianUserId', String(currentUserId.value));
    }

    if (focusAppointmentId && focusAppointmentId !== '') {
        params.set('focusAppointmentId', focusAppointmentId);
        if (status === 'waiting_provider' || status === 'in_consultation') {
            params.set('focusAction', 'consultation');
        }
    }

    if (searchQuery && searchQuery.trim() !== '') {
        params.set('q', searchQuery.trim());
    }

    return `/appointments?${params.toString()}`;
}

function activeConsultationWorkspaceHref(appointmentId: string): string {
    return encounterWorkspaceLegacyAppointmentHref(appointmentId, {
        from: 'dashboard',
    });
}

function departmentQueueHref(
    department: string,
    status: 'waiting_provider' | 'in_consultation' = 'waiting_provider',
    focusAppointmentId?: string,
    searchQuery?: string,
): string {
    const params = new URLSearchParams({
        view: 'queue',
        status,
        from: today,
        department,
        unassignedClinician: 'true',
    });

    if (focusAppointmentId && focusAppointmentId !== '') {
        params.set('focusAppointmentId', focusAppointmentId);
        params.set('focusAction', 'consultation');
    }

    if (searchQuery && searchQuery.trim() !== '') {
        params.set('q', searchQuery.trim());
    }

    return `/appointments?${params.toString()}`;
}

function appointmentsWorklistSearchHref(searchQuery: string): string {
    const q = searchQuery.trim();
    if (q === '') {
        return '/appointments';
    }

    const params = new URLSearchParams({ q });
    const preset = activePresetKey.value;

    if (preset === 'clinician' || preset === 'nursing' || preset === 'emergency' || preset === 'front_desk') {
        params.set('view', 'queue');
    }

    return `/appointments?${params.toString()}`;
}

function queueRowMatchesSearch(row: QueueRow, query: string): boolean {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery === '') {
        return true;
    }

    const haystack = (row.searchHaystack ?? [row.title, row.subtitle, row.meta, row.status, row.group].filter(Boolean).join(' '))
        .toLowerCase();

    return haystack.includes(normalizedQuery);
}

type DashboardPatientSummary = {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    patientNumber?: string | null;
    phone?: string | null;
};

function dashboardPatientSummaryFromEmbedded(patient: DashboardPatientSummary | null | undefined): DashboardPatientSummary | null {
    if (!patient) {
        return null;
    }

    const summary = {
        firstName: patient.firstName ?? null,
        middleName: patient.middleName ?? null,
        lastName: patient.lastName ?? null,
        patientNumber: patient.patientNumber ?? null,
        phone: patient.phone ?? null,
    };

    const hasContent = Object.values(summary).some((value) => String(value ?? '').trim() !== '');
    return hasContent ? summary : null;
}

function directServiceEmbeddedPatientSummary(item: Record<string, unknown>): DashboardPatientSummary | null {
    return dashboardPatientSummaryFromEmbedded(item.patient as DashboardPatientSummary | undefined);
}

function directServicePatientLabel(item: Record<string, unknown>): string {
    const embedded = directServiceEmbeddedPatientSummary(item);
    if (embedded) {
        const fullName = [embedded.firstName, embedded.middleName, embedded.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
        if (fullName) {
            return fullName;
        }
        if (embedded.patientNumber) {
            return String(embedded.patientNumber).trim();
        }
    }

    return dashboardPatientLabel(String(item.patientId ?? '').trim());
}

function directServicePatientMeta(item: Record<string, unknown>): string {
    const embedded = directServiceEmbeddedPatientSummary(item);
    if (embedded) {
        return [embedded.patientNumber, embedded.phone].filter(Boolean).join(' | ');
    }

    return dashboardPatientMeta(String(item.patientId ?? '').trim());
}

function registerDashboardPatientsFromOrders(items: any[]): void {
    const nextEntries: Record<string, DashboardPatientSummary> = {};

    for (const item of items) {
        const patientId = String(item?.patientId ?? item?.patient?.id ?? '').trim();
        const embedded = dashboardPatientSummaryFromEmbedded(item?.patient);
        if (!patientId || !embedded || dashboardPatientDirectory.value[patientId]) {
            continue;
        }

        nextEntries[patientId] = embedded;
    }

    if (Object.keys(nextEntries).length === 0) {
        return;
    }

    dashboardPatientDirectory.value = {
        ...dashboardPatientDirectory.value,
        ...nextEntries,
    };
}

const dashboardPatientDirectory = ref<Record<string, DashboardPatientSummary>>({});
const dashboardSearchAppointments = ref<any[]>([]);
const dashboardSearchDirectServiceOrders = ref<any[]>([]);
const dashboardSearchLoading = ref(false);
const pendingDashboardPatientIds = new Set<string>();

function dashboardPatientLabel(patientId: string | null | undefined): string {
    const normalizedId = String(patientId ?? '').trim();
    if (!normalizedId) {
        return '';
    }

    const patient = dashboardPatientDirectory.value[normalizedId];
    if (!patient) {
        return '';
    }

    const fullName = [patient.firstName, patient.middleName, patient.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

    return fullName || String(patient.patientNumber ?? '').trim();
}

function dashboardPatientMeta(patientId: string | null | undefined): string {
    const normalizedId = String(patientId ?? '').trim();
    if (!normalizedId) {
        return '';
    }

    const patient = dashboardPatientDirectory.value[normalizedId];
    if (!patient) {
        return '';
    }

    return [patient.patientNumber, patient.phone].filter(Boolean).join(' | ');
}

async function hydrateDashboardPatient(patientId: string | null | undefined): Promise<void> {
    const normalizedId = String(patientId ?? '').trim();
    if (!normalizedId || dashboardPatientDirectory.value[normalizedId] || pendingDashboardPatientIds.has(normalizedId)) {
        return;
    }

    pendingDashboardPatientIds.add(normalizedId);
    try {
        const response = await apiGet<ApiEnvelope<DashboardPatientSummary>>(`/patients/${normalizedId}`);
        if (response.data) {
            dashboardPatientDirectory.value = {
                ...dashboardPatientDirectory.value,
                [normalizedId]: response.data,
            };
        }
    } catch {
        // Keep dashboard search usable when patient hydration is unavailable.
    } finally {
        pendingDashboardPatientIds.delete(normalizedId);
    }
}

async function hydrateDashboardPatientsForAppointments(items: any[]): Promise<void> {
    const uniqueIds = [...new Set(items.map((item) => String(item.patientId ?? '').trim()).filter(Boolean))];
    await Promise.all(uniqueIds.map((patientId) => hydrateDashboardPatient(patientId)));
}

function appointmentQueueSearchHaystack(item: Record<string, unknown>): string {
    const patientId = String(item.patientId ?? '').trim();

    return [
        dashboardPatientLabel(patientId),
        dashboardPatientMeta(patientId),
        item.appointmentNumber,
        item.reason,
        item.department,
        item.id,
        item.patientId,
    ]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' ');
}

function dashboardAppointmentHref(item: any): string {
    const appointmentId = String(item.id ?? '').trim();
    const status = String(item.status ?? '').trim();
    const assignedClinicianId = Number(item.clinicianUserId ?? 0);
    const department = String(item.department ?? '').trim();
    const assignedToMe =
        currentUserId.value !== null
        && assignedClinicianId > 0
        && assignedClinicianId === currentUserId.value;

    if (activePresetKey.value === 'clinician') {
        if (status === 'in_consultation' && assignedToMe) {
            return activeConsultationWorkspaceHref(appointmentId);
        }

        if (status === 'waiting_provider') {
            if (assignedToMe) {
                return clinicianQueueHref('waiting_provider', appointmentId);
            }

            if (department !== '') {
                return departmentQueueHref(department, 'waiting_provider', appointmentId);
            }
        }
    }

    const params = new URLSearchParams({ view: 'queue', from: today });
    if (status !== '') {
        params.set('status', status);
    }
    if (appointmentId !== '') {
        params.set('focusAppointmentId', appointmentId);
    }

    return `/appointments?${params.toString()}`;
}

function appointmentTriageCategory(item: any): QueueRow['triageCategory'] {
    const category = String(item?.triageCategory ?? item?.triage_category ?? '').trim().toUpperCase();
    if (category === 'P1' || category === 'P2' || category === 'P3' || category === 'P4' || category === 'P5') {
        return category;
    }

    return null;
}

function mapDashboardSearchAppointmentToRow(item: any): QueueRow {
    const patientId = String(item.patientId ?? '').trim();
    const patientName = dashboardPatientLabel(patientId);
    const patientMeta = dashboardPatientMeta(patientId);
    const appointmentNumber = String(item.appointmentNumber ?? 'Appointment');
    const title = patientName ? `${patientName} · ${appointmentNumber}` : appointmentNumber;
    const triageCategory = appointmentTriageCategory(item);

    return {
        id: `search-${String(item.id ?? appointmentNumber)}`,
        title,
        subtitle: [patientMeta, item.department, item.reason].filter(Boolean).join(' | ') || 'Matching visit in worklist.',
        meta: triageCategory
            ? `Status ${formatEnumLabel(String(item.status ?? 'scheduled'))} · ${triageCategory}`
            : `Status ${formatEnumLabel(String(item.status ?? 'scheduled'))}`,
        status: formatEnumLabel(String(item.status ?? 'scheduled')),
        href: dashboardAppointmentHref(item),
        actionLabel: 'Open visit',
        searchHaystack: appointmentQueueSearchHaystack(item),
        triageCategory,
    };
}

function resolveClinicalDepartmentFromDirectory(rows: any[] | undefined, userId: number | null): string | null {
    if (userId === null || !Array.isArray(rows)) return null;

    const match = rows.find((row) => Number(row?.userId ?? 0) === userId);
    const department = String(match?.department ?? '').trim();

    return department !== '' ? department : null;
}

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
const operationsHandoffOpen = useLocalStorageBoolean('dashboard.operations-handoff.open', true);
const recordsHandoffOpen = useLocalStorageBoolean('dashboard.records-handoff.open', true);
const supplyHandoffOpen = useLocalStorageBoolean('dashboard.supply-handoff.open', true);
const theatreHandoffOpen = useLocalStorageBoolean('dashboard.theatre-handoff.open', true);

const roleCodes = computed(() => {
    const fromApi = (authMe.value?.roles ?? [])
        .map((role: any) => String(role?.code ?? '').trim().toUpperCase())
        .filter((code: string) => code.length > 0);
    if (fromApi.length > 0) {
        return fromApi;
    }

    return sessionRoleCodes.value;
});

const rolesResolved = computed(
    () =>
        sessionRoleCodes.value.length > 0 ||
        (Array.isArray(authMe.value?.roles) && authMe.value.roles.length > 0) ||
        eligiblePresets.value.length > 0,
);

const inferredPreset = computed<DashboardPresetKey>(() => defaultWorkflowKey.value);

const activePresetKey = computed<DashboardPresetKey>(() => {
    const eligible = eligiblePresets.value;
    const fallback = defaultWorkflowKey.value;
    if (presetOverride.value === 'auto') {
        return fallback;
    }
    if (eligible.includes(presetOverride.value)) {
        return presetOverride.value;
    }
    return fallback;
});

const activeWorkflowWidgets = computed(() =>
    workflowDefinitions.value.find((workflow) => workflow.key === activePresetKey.value)?.widgets ?? [],
);

const activeWorkflowSurface = computed(() =>
    buildWorkflowSurface(
        activePresetKey.value,
        counts.value,
        lists.value,
        { numberValue, metric },
        activeWorkflowWidgets.value,
        dashboardSurfaceRuntime.value,
    ),
);


const activePreset = computed(() => {
    const fromContext = workflowDefinitions.value.find((workflow) => workflow.key === activePresetKey.value);
    if (fromContext) {
        return fromContext;
    }

    return DASHBOARD_PRESETS.find((preset) => preset.key === activePresetKey.value) ?? DASHBOARD_PRESETS[0];
});

const singleDirectServiceModule = computed(() =>
    activePresetKey.value === 'direct_service' && directServiceModules.value.length === 1
        ? directServiceModules.value[0]
        : null,
);

const dashboardPresetLabel = computed(() => singleDirectServiceModule.value?.label ?? activePreset.value.label);

const dashboardPresetDescription = computed(() => {
    const module = singleDirectServiceModule.value;
    if (!module) return activePreset.value.description;

    return `${module.label} queue focused on active orders, status movement, and safe handoff.`;
});

const visiblePresetOptions = computed(() => {
    if (workflowDefinitions.value.length > 0) {
        return workflowDefinitions.value;
    }

    return DASHBOARD_PRESETS.filter((preset) => eligiblePresets.value.includes(preset.key));
});

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

function directServiceModuleHref(module: DirectServiceModuleSummary | null, query?: string): string {
    if (!module) return '/dashboard';

    const normalizedQuery = query?.trim() ?? '';
    if (normalizedQuery === '') {
        return module.href;
    }

    const params = new URLSearchParams({ q: normalizedQuery, worklistScope: 'open' });
    return `${module.href}?${params.toString()}`;
}

function radiologyWorklistHref(status?: string | null, focusOrderId?: string | null): string {
    const params = new URLSearchParams();
    const normalizedStatus = String(status ?? '').trim();
    const normalizedOrderId = String(focusOrderId ?? '').trim();

    if (normalizedStatus !== '') {
        params.set('status', normalizedStatus);
    }

    if (normalizedOrderId !== '') {
        params.set('focusOrderId', normalizedOrderId);
    }

    const queryString = params.toString();
    return queryString ? `/radiology-orders?${queryString}` : '/radiology-orders';
}

function radiologyOrderActionLabel(status: string | null | undefined): string {
    switch (String(status ?? '').trim()) {
        case 'ordered':
            return 'Schedule study';
        case 'scheduled':
            return 'Start study';
        case 'in_progress':
            return 'Complete report';
        default:
            return 'Open order';
    }
}

async function hydrateDashboardPatientsForOrders(items: any[]): Promise<void> {
    const uniqueIds = [...new Set(items.map((item) => String(item.patientId ?? '').trim()).filter(Boolean))];
    await Promise.all(uniqueIds.map((patientId) => hydrateDashboardPatient(patientId)));
}

function directServiceOrderSearchHaystack(item: Record<string, unknown>): string {
    const patientId = String(item.patientId ?? '').trim();
    const orderedBy = item.orderedBy as { name?: string | null } | null | undefined;

    return [
        directServicePatientLabel(item),
        directServicePatientMeta(item),
        orderedBy?.name,
        item.orderNumber,
        item.testCode,
        item.testName,
        item.medicationCode,
        item.medicationName,
        item.procedureCode,
        item.studyDescription,
        item.modality,
        item.clinicalIndication,
        item.status,
        item.orderedByUserId,
        item.patientId,
    ]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' ');
}

function laboratoryWorklistHref(status?: string | null, focusOrderId?: string | null): string {
    const params = new URLSearchParams();
    const normalizedStatus = String(status ?? '').trim();
    const normalizedOrderId = String(focusOrderId ?? '').trim();

    if (normalizedStatus !== '') {
        params.set('status', normalizedStatus);
    }

    if (normalizedOrderId !== '') {
        params.set('focusOrderId', normalizedOrderId);
    }

    const queryString = params.toString();
    return queryString ? `/laboratory-orders?${queryString}` : '/laboratory-orders';
}

function pharmacyWorklistHref(status?: string | null, focusOrderId?: string | null): string {
    const params = new URLSearchParams();
    const normalizedStatus = String(status ?? '').trim();
    const normalizedOrderId = String(focusOrderId ?? '').trim();

    if (normalizedStatus !== '') {
        params.set('status', normalizedStatus);
    }

    if (normalizedOrderId !== '') {
        params.set('focusOrderId', normalizedOrderId);
    }

    const queryString = params.toString();
    return queryString ? `/pharmacy-orders?${queryString}` : '/pharmacy-orders';
}

function laboratoryOrderActionLabel(status: string | null | undefined): string {
    switch (String(status ?? '').trim()) {
        case 'ordered':
            return 'Collect specimen';
        case 'collected':
            return 'Start processing';
        case 'in_progress':
            return 'Release result';
        default:
            return 'Open order';
    }
}

function pharmacyOrderActionLabel(status: string | null | undefined): string {
    switch (String(status ?? '').trim()) {
        case 'pending':
            return 'Prepare medication';
        case 'in_preparation':
            return 'Dispense order';
        case 'partially_dispensed':
            return 'Complete dispense';
        default:
            return 'Open order';
    }
}

function directServiceOrderedByLabel(item: Record<string, unknown>): string {
    const orderedBy = item.orderedBy as { name?: string | null; id?: number | string | null } | null | undefined;
    const orderedByName = String(orderedBy?.name ?? '').trim();
    if (orderedByName !== '') {
        return `Ordered by ${orderedByName}`;
    }

    const orderedByUserId = Number(item.orderedByUserId ?? 0);
    return Number.isFinite(orderedByUserId) && orderedByUserId > 0
        ? `Ordered by user #${orderedByUserId}`
        : 'Ordering clinician not recorded';
}

function directServiceOrderTitle(item: any, detail: string): string {
    const patientName = directServicePatientLabel(item);
    const orderNumber = String(item.orderNumber ?? '').trim();
    const orderLabel = orderNumber !== '' ? orderNumber : 'Order';

    if (patientName) {
        return `${patientName} · ${orderLabel}`;
    }

    return detail || orderLabel;
}

function mapRadiologyOrderToQueueRow(item: any): QueueRow {
    const status = String(item.status ?? 'ordered');
    const study = String(item.studyDescription ?? item.procedureCode ?? 'Imaging order');
    const modality = formatEnumLabel(String(item.modality ?? 'radiology'));
    const patientMeta = directServicePatientMeta(item);
    const scheduledFor = item.scheduledFor ? `Scheduled ${formatDateTime(item.scheduledFor)}` : null;
    const orderedAt = item.orderedAt ? `Ordered ${formatDateTime(item.orderedAt)}` : null;
    const orderedBy = directServiceOrderedByLabel(item);

    return {
        id: `radiology-order-${String(item.id ?? item.orderNumber ?? Math.random())}`,
        title: directServiceOrderTitle(item, study),
        subtitle: [patientMeta, modality, item.clinicalIndication].filter(Boolean).join(' | ') || study,
        meta: [orderedBy, scheduledFor ?? orderedAt].filter(Boolean).join(' · ') || 'Ordering context not recorded',
        status: formatEnumLabel(status),
        href: radiologyWorklistHref(status, String(item.id ?? '')),
        actionLabel: radiologyOrderActionLabel(status),
        group: 'Radiology worklist',
        searchHaystack: directServiceOrderSearchHaystack(item),
    };
}

function mapLaboratoryOrderToQueueRow(item: any): QueueRow {
    const status = String(item.status ?? 'ordered');
    const testLabel = [item.testCode, item.testName].filter(Boolean).join(' - ') || 'Laboratory test';
    const patientMeta = directServicePatientMeta(item);
    const orderedAt = item.orderedAt ? `Ordered ${formatDateTime(item.orderedAt)}` : null;
    const orderedBy = directServiceOrderedByLabel(item);

    return {
        id: `laboratory-order-${String(item.id ?? item.orderNumber ?? Math.random())}`,
        title: directServiceOrderTitle(item, testLabel),
        subtitle: [patientMeta, testLabel, item.priority ? formatEnumLabel(String(item.priority)) : null].filter(Boolean).join(' | ') || 'Laboratory worklist item.',
        meta: [orderedBy, orderedAt].filter(Boolean).join(' · ') || 'Ordering context not recorded',
        status: formatEnumLabel(status),
        href: laboratoryWorklistHref(status, String(item.id ?? '')),
        actionLabel: laboratoryOrderActionLabel(status),
        group: 'Laboratory worklist',
        searchHaystack: directServiceOrderSearchHaystack(item),
    };
}

function mapPharmacyOrderToQueueRow(item: any): QueueRow {
    const status = String(item.status ?? 'pending');
    const medicationLabel = [item.medicationCode, item.medicationName].filter(Boolean).join(' - ') || 'Medication order';
    const patientMeta = directServicePatientMeta(item);
    const orderedAt = item.orderedAt ? `Ordered ${formatDateTime(item.orderedAt)}` : null;
    const orderedBy = directServiceOrderedByLabel(item);

    return {
        id: `pharmacy-order-${String(item.id ?? item.orderNumber ?? Math.random())}`,
        title: directServiceOrderTitle(item, medicationLabel),
        subtitle: [patientMeta, medicationLabel].filter(Boolean).join(' | ') || 'Pharmacy worklist item.',
        meta: [orderedBy, orderedAt].filter(Boolean).join(' · ') || 'Ordering context not recorded',
        status: formatEnumLabel(status),
        href: pharmacyWorklistHref(status, String(item.id ?? '')),
        actionLabel: pharmacyOrderActionLabel(status),
        group: 'Pharmacy worklist',
        searchHaystack: directServiceOrderSearchHaystack(item),
    };
}

function mapDirectServiceOrderToQueueRow(item: any, moduleKey: DirectServiceModuleSummary['key']): QueueRow {
    if (moduleKey === 'radiology') return mapRadiologyOrderToQueueRow(item);
    if (moduleKey === 'laboratory') return mapLaboratoryOrderToQueueRow(item);
    return mapPharmacyOrderToQueueRow(item);
}

function directServiceOrdersEndpoint(moduleKey: DirectServiceModuleSummary['key'] | null | undefined): string | null {
    if (moduleKey === 'radiology') return '/radiology-orders';
    if (moduleKey === 'laboratory') return '/laboratory-orders';
    if (moduleKey === 'pharmacy') return '/pharmacy-orders';
    return null;
}

function mapDirectServicePatientGroupsToQueueRows(
    items: any[],
    moduleKey: DirectServiceModuleKey,
): QueueRow[] {
    const moduleLabel =
        moduleKey === 'radiology' ? 'Radiology' : moduleKey === 'laboratory' ? 'Laboratory' : 'Pharmacy';

    return groupDirectServiceOrdersByPatient(items, moduleKey)
        .filter((group) => !group.patientId.startsWith('__orphan__:'))
        .map((group) => {
        const earliest = group.orders[0]?.orderedAt ?? null;
        const requesterNames = [...new Set(group.orders
            .map((order) => String(order.orderedBy?.name ?? '').trim())
            .filter(Boolean))];
        const requesterSummary = requesterNames.length === 0
            ? null
            : `Ordered by ${requesterNames[0]}${requesterNames.length > 1 ? ` +${requesterNames.length - 1} more` : ''}`;

        return {
            id: `direct-service-patient-${group.patientId}`,
            title: group.patientMeta
                ? `${group.patientLabel} · ${group.patientMeta.split(' | ')[0]}`
                : group.patientLabel,
            subtitle: group.summarySubtitle,
            meta: [
                requesterSummary,
                earliest ? `Earliest order ${formatDateTime(earliest)}` : null,
            ].filter(Boolean).join(' Â· ') || group.summaryMeta || 'Open orders waiting',
            status: group.summaryStatus,
            href: directServicePatientWorklistHref(moduleKey, group.patientId),
            actionLabel: 'Open patient orders',
            group: `${moduleLabel} patients`,
            searchHaystack: group.searchHaystack,
        };
    });
}

function mapDirectServiceOrdersToQueueRows(
    items: any[],
    moduleKey: DirectServiceModuleKey,
): QueueRow[] {
    return mapDirectServicePatientGroupsToQueueRows(items, moduleKey);
}

function mergeDashboardRowsById(...groups: any[][]): any[] {
    const seen = new Set<string>();
    const rows: any[] = [];

    for (const group of groups) {
        for (const row of group) {
            const id = String(row?.id ?? '').trim();
            if (id === '' || seen.has(id)) continue;
            seen.add(id);
            rows.push(row);
        }
    }

    return rows;
}

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

const primaryDirectServiceModule = computed(() =>
    directServiceModules.value.length === 1 ? directServiceModules.value[0] : activeDirectServiceModule.value,
);

const directServiceActiveQueueCount = computed(() =>
    directServiceModules.value.reduce((sum, module) => sum + Number(module.active ?? 0), 0),
);

const showDirectServiceQueueAlert = computed(
    () =>
        activePresetKey.value === 'direct_service'
        && !loading.value
        && !refreshing.value
        && directServiceActiveQueueCount.value > 0,
);

const shouldShowHandoff = computed(() => true);
const handoffOpen = computed({
    get: () => {
        if (activePresetKey.value === 'front_desk') return frontDeskHandoffOpen.value;
        if (activePresetKey.value === 'clinician') return clinicianHandoffOpen.value;
        if (activePresetKey.value === 'nursing' || activePresetKey.value === 'direct_service') return nursingHandoffOpen.value;
        if (activePresetKey.value === 'cashier') return cashierHandoffOpen.value;
        if (activePresetKey.value === 'emergency') return emergencyHandoffOpen.value;
        if (activePresetKey.value === 'operations') return operationsHandoffOpen.value;
        if (activePresetKey.value === 'records') return recordsHandoffOpen.value;
        if (activePresetKey.value === 'supply') return supplyHandoffOpen.value;
        if (activePresetKey.value === 'theatre') return theatreHandoffOpen.value;
        return adminHandoffOpen.value;
    },
    set: (value: boolean) => {
        if (activePresetKey.value === 'front_desk') frontDeskHandoffOpen.value = value;
        else if (activePresetKey.value === 'clinician') clinicianHandoffOpen.value = value;
        else if (activePresetKey.value === 'nursing' || activePresetKey.value === 'direct_service') nursingHandoffOpen.value = value;
        else if (activePresetKey.value === 'cashier') cashierHandoffOpen.value = value;
        else if (activePresetKey.value === 'emergency') emergencyHandoffOpen.value = value;
        else if (activePresetKey.value === 'operations') operationsHandoffOpen.value = value;
        else if (activePresetKey.value === 'records') recordsHandoffOpen.value = value;
        else if (activePresetKey.value === 'supply') supplyHandoffOpen.value = value;
        else if (activePresetKey.value === 'theatre') theatreHandoffOpen.value = value;
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

function queueRowActionVariant(row: QueueRow): 'default' | 'outline' {
    const label = String(row.actionLabel ?? '').trim().toLowerCase();
    if (label.includes('consultation') || label === 'open visit') {
        return 'default';
    }

    return 'outline';
}

const TRIAGE_P_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3, P5: 4 };

function dashboardRowBorderClass(row: QueueRow): string {
    if (activePresetKey.value !== 'emergency') return 'px-4';
    switch (row.triageCategory) {
        case 'P1': return 'border-l-[3px] border-l-destructive pl-3 pr-4';
        case 'P2': return 'border-l-[3px] border-l-orange-500 pl-3 pr-4';
        case 'P3': return 'border-l-[3px] border-l-amber-500 pl-3 pr-4';
        case 'P4': return 'border-l-[3px] border-l-sky-400 pl-3 pr-4';
        case 'P5': return 'border-l-[3px] border-l-muted-foreground/30 pl-3 pr-4';
        default: return row.isOverdue ? 'border-l-[3px] border-l-destructive/50 pl-3 pr-4' : 'px-4';
    }
}

function dashboardRowBgClass(row: QueueRow): string {
    if (activePresetKey.value !== 'emergency') return '';
    if (row.triageCategory === 'P1') return 'bg-destructive/5 dark:bg-destructive/10';
    if (row.triageCategory === 'P2') return 'bg-orange-500/5 dark:bg-orange-500/10';
    return '';
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
        operationalFlags: null,
        vitalsOverdue: null,
    };
    lists.value = {
        scheduledAppointments: [],
        checkedInAppointments: [],
        waitingProviderAppointments: [],
        inConsultationAppointments: [],
        departmentPoolWaitingAppointments: [],
        radiologyOrders: [],
        laboratoryOrders: [],
        pharmacyOrders: [],
        admissions: [],
        draftInvoices: [],
        operationsCredentialingAlerts: [],
        operationsPrivilegeQueue: [],
        theatreProcedures: [],
        draftMedicalRecords: [],
        procurementRequests: [],
    };
    clinicianClinicalDepartment.value = null;

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

    appendWorkflowBatchEntries(preset, batch, {
        guardedRequest,
        apiGet,
        currentUserId: currentUserId.value,
    });

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
        emergencyTriageCases: bag.emergencyTriageCaseCounts?.data ?? null,
        wardBeds: bag.wardBedCounts?.data ?? null,
        operationalFlags: bag.operationalFlagsCounts?.data ?? null,
        vitalsOverdue: bag.vitalsOverdueCounts?.data ?? null,
        staffProfiles: bag.staffStatusCounts?.data ?? null,
        credentialingAlertTotal:
            typeof bag.credentialingAlerts?.meta?.total === 'number'
                ? bag.credentialingAlerts.meta.total
                : Array.isArray(bag.credentialingAlerts?.data)
                  ? bag.credentialingAlerts.data.length
                  : null,
        inventoryStockAlerts: bag.inventoryStockAlerts?.data ?? null,
        theatreProcedureCounts: bag.theatreProcedureCounts?.data ?? null,
    };

    lists.value = {
        scheduledAppointments: Array.isArray(bag.scheduledAppointments?.data) ? bag.scheduledAppointments.data : [],
        checkedInAppointments: Array.isArray(bag.checkedInAppointments?.data) ? bag.checkedInAppointments.data : [],
        waitingProviderAppointments: Array.isArray(bag.waitingProviderAppointments?.data) ? bag.waitingProviderAppointments.data : [],
        inConsultationAppointments: Array.isArray(bag.inConsultationAppointments?.data) ? bag.inConsultationAppointments.data : [],
        departmentPoolWaitingAppointments: [],
        radiologyOrders: (Array.isArray(bag.radiologyOpenOrders?.data) ? bag.radiologyOpenOrders.data : mergeDashboardRowsById(
            Array.isArray(bag.radiologyInProgressOrders?.data) ? bag.radiologyInProgressOrders.data : [],
            Array.isArray(bag.radiologyScheduledOrders?.data) ? bag.radiologyScheduledOrders.data : [],
            Array.isArray(bag.radiologyOrderedOrders?.data) ? bag.radiologyOrderedOrders.data : [],
        )).slice(0, 40),
        laboratoryOrders: (Array.isArray(bag.laboratoryOpenOrders?.data) ? bag.laboratoryOpenOrders.data : mergeDashboardRowsById(
            Array.isArray(bag.laboratoryInProgressOrders?.data) ? bag.laboratoryInProgressOrders.data : [],
            Array.isArray(bag.laboratoryCollectedOrders?.data) ? bag.laboratoryCollectedOrders.data : [],
            Array.isArray(bag.laboratoryOrderedOrders?.data) ? bag.laboratoryOrderedOrders.data : [],
        )).slice(0, 40),
        pharmacyOrders: (Array.isArray(bag.pharmacyOpenOrders?.data) ? bag.pharmacyOpenOrders.data : mergeDashboardRowsById(
            Array.isArray(bag.pharmacyPartiallyDispensedOrders?.data) ? bag.pharmacyPartiallyDispensedOrders.data : [],
            Array.isArray(bag.pharmacyInPreparationOrders?.data) ? bag.pharmacyInPreparationOrders.data : [],
            Array.isArray(bag.pharmacyPendingOrders?.data) ? bag.pharmacyPendingOrders.data : [],
        )).slice(0, 40),
        admissions: Array.isArray(bag.admissions?.data) ? bag.admissions.data : [],
        draftInvoices: Array.isArray(bag.draftInvoices?.data) ? bag.draftInvoices.data : [],
        operationsCredentialingAlerts: Array.isArray(bag.credentialingAlerts?.data) ? bag.credentialingAlerts.data : [],
        operationsPrivilegeQueue: buildOperationsPrivilegeQueueRows(bag.privilegeCoverageBoard?.data),
        theatreProcedures: Array.isArray(bag.theatreProcedures?.data) ? bag.theatreProcedures.data : [],
        draftMedicalRecords: Array.isArray(bag.draftMedicalRecords?.data) ? bag.draftMedicalRecords.data : [],
        procurementRequests: Array.isArray(bag.procurementRequests?.data) ? bag.procurementRequests.data : [],
    };

    registerDashboardPatientsFromOrders([
        ...lists.value.radiologyOrders,
        ...lists.value.laboratoryOrders,
        ...lists.value.pharmacyOrders,
    ]);

    if (preset === 'clinician') {
        const departmentName = resolveClinicalDepartmentFromDirectory(bag.clinicalDirectory?.data, currentUserId.value);
        clinicianClinicalDepartment.value = departmentName;

        if (departmentName) {
            const departmentPoolQuery = {
                department: departmentName,
                unassignedClinician: true,
            };

            const [departmentPoolCounts, departmentPoolWaiting] = await Promise.all([
                guardedRequest<ApiEnvelope<any>>('Department pool counts', 'appointments.read', () =>
                    apiGet('/appointments/status-counts', departmentPoolQuery),
                ),
                guardedRequest<ApiEnvelope<any>>('Department pool appointments', 'appointments.read', () =>
                    apiGet('/appointments', {
                        ...departmentPoolQuery,
                        status: 'waiting_provider',
                        perPage: 5,
                        sortBy: 'checkedInAt',
                        sortDir: 'asc',
                    }),
                ),
            ]);

            counts.value.departmentPoolAppointments = departmentPoolCounts?.data ?? null;
            lists.value.departmentPoolWaitingAppointments = Array.isArray(departmentPoolWaiting?.data)
                ? departmentPoolWaiting.data
                : [];
        }
    }

    void hydrateDashboardPatientsForAppointments([
        ...lists.value.scheduledAppointments,
        ...lists.value.checkedInAppointments,
        ...lists.value.waitingProviderAppointments,
        ...lists.value.inConsultationAppointments,
        ...lists.value.departmentPoolWaitingAppointments,
    ]);
    void hydrateDashboardPatientsForOrders([
        ...lists.value.radiologyOrders,
        ...lists.value.laboratoryOrders,
        ...lists.value.pharmacyOrders,
    ]);

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

const kpis = computed(() => activeWorkflowSurface.value?.kpis ?? []);

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

const actions = computed(() => activeWorkflowSurface.value?.actions ?? []);

const queueRows = computed<QueueRow[]>(() => activeWorkflowSurface.value?.queueRows ?? []);

const displayedQueueRows = computed(() => {
    const query = patientSearchQuery.value.trim();

    if (activePresetKey.value === 'direct_service') {
        const moduleKey = primaryDirectServiceModule.value?.key;
        if (query.length >= 2 && moduleKey) {
            return mapDirectServiceOrdersToQueueRows(dashboardSearchDirectServiceOrders.value, moduleKey);
        }

        if (query) {
            return queueRows.value.filter((row) => queueRowMatchesSearch(row, query));
        }

        return queueRows.value;
    }

    if (query.length >= 2) {
        return dashboardSearchAppointments.value.map((item) => mapDashboardSearchAppointmentToRow(item));
    }

    if (!query) {
        return queueRows.value;
    }

    return queueRows.value.filter((row) => queueRowMatchesSearch(row, query));
});

const queuePreviewSearchActive = computed(() => patientSearchQuery.value.trim() !== '');

const dashboardSearchPlaceholder = computed(
    () => activeWorkflowSurface.value?.searchPlaceholder ?? 'Patient name, MRN, phone, or appointment #',
);

const queueGroupCounts = computed<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const row of displayedQueueRows.value) {
        if (row.group) {
            map.set(row.group, (map.get(row.group) ?? 0) + 1);
        }
    }
    return map;
});

const queueTitle = computed(() => activeWorkflowSurface.value?.queueTitle ?? 'Workflow queue');

const queueDescription = computed(() => activeWorkflowSurface.value?.queueDescription ?? '');

const handoff = computed(() => activeWorkflowSurface.value?.handoff ?? {
    title: 'Dashboard handoff',
    note: 'Workflow context',
    blockerTitle: 'Loading',
    blockerNote: 'Refresh the dashboard to load workflow context.',
    nextAction: 'Refresh the dashboard.',
    primaryAction: { label: 'Refresh', href: '/dashboard' },
    secondaryAction: { label: 'Open resources', href: '/dashboard#dashboard-resources' },
    chips: [],
});

const watchItems = computed(() => activeWorkflowSurface.value?.watchItems ?? []);

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

const mciModeActive = computed(() => Boolean((counts.value.operationalFlags as any)?.mci_mode?.is_active));

const vitalsOverdueCount = computed(() => Number((counts.value.vitalsOverdue as any)?.overdue_count ?? 0));

const dashboardSurfaceRuntime = computed(() => ({
    today,
    nowTick: nowTick.value,
    clinicianClinicalDepartment: clinicianClinicalDepartment.value,
    vitalsOverdueCount: vitalsOverdueCount.value,
    mciModeActive: mciModeActive.value,
    directServiceModules: directServiceModules.value,
    singleDirectServiceModule: singleDirectServiceModule.value,
    primaryDirectServiceModule: primaryDirectServiceModule.value,
    auditExportHealth: auditExportHealth.value,
    scopeData: scopeData.value,
    TRIAGE_P_ORDER,
    formatDateTime,
    formatMoney,
    formatEnumLabel,
    clinicianQueueHref,
    departmentQueueHref,
    activeConsultationWorkspaceHref,
    directServiceModuleHref,
    dashboardPatientLabel,
    appointmentTriageCategory,
    appointmentQueueSearchHaystack,
    mapDirectServiceOrdersToQueueRows,
    openResourcesTab: () => {
        activeTab.value = 'resources';
    },
}));

const patientSearchQuery = ref('');

watchDebounced(
    patientSearchQuery,
    async () => {
        const query = patientSearchQuery.value.trim();
        if (activePresetKey.value === 'direct_service') {
            dashboardSearchAppointments.value = [];

            if (query.length < 2) {
                dashboardSearchDirectServiceOrders.value = [];
                dashboardSearchLoading.value = false;
                return;
            }

            const moduleKey = primaryDirectServiceModule.value?.key;
            const endpoint = directServiceOrdersEndpoint(moduleKey);
            if (!endpoint) {
                dashboardSearchDirectServiceOrders.value = [];
                dashboardSearchLoading.value = false;
                return;
            }

            dashboardSearchLoading.value = true;
            try {
                const response = await apiGet<ApiEnvelope<any[]>>(endpoint, {
                    q: query,
                    worklistScope: 'open',
                    perPage: 50,
                    sortBy: 'orderedAt',
                    sortDir: 'asc',
                });
                dashboardSearchDirectServiceOrders.value = Array.isArray(response.data) ? response.data : [];
                registerDashboardPatientsFromOrders(dashboardSearchDirectServiceOrders.value);
                await hydrateDashboardPatientsForOrders(dashboardSearchDirectServiceOrders.value);
            } catch {
                dashboardSearchDirectServiceOrders.value = [];
            } finally {
                dashboardSearchLoading.value = false;
            }
            return;
        }

        dashboardSearchDirectServiceOrders.value = [];

        if (query.length < 2) {
            dashboardSearchAppointments.value = [];
            dashboardSearchLoading.value = false;
            return;
        }

        dashboardSearchLoading.value = true;
        try {
            const response = await apiGet<ApiEnvelope<any[]>>('/appointments', {
                q: query,
                perPage: 15,
                sortBy: 'checkedInAt',
                sortDir: 'asc',
            });
            dashboardSearchAppointments.value = Array.isArray(response.data) ? response.data : [];
            await hydrateDashboardPatientsForAppointments(dashboardSearchAppointments.value);
        } catch {
            dashboardSearchAppointments.value = [];
        } finally {
            dashboardSearchLoading.value = false;
        }
    },
    { debounce: 400, maxWait: 1200 },
);

function goToPatientSearch(): void {
    const q = patientSearchQuery.value.trim();
    if (!q) return;

    if (['front_desk', 'clinician', 'nursing', 'emergency'].includes(activePresetKey.value)) {
        window.location.href = appointmentsWorklistSearchHref(q);
        return;
    }

    if (activePresetKey.value === 'direct_service') {
        window.location.href = directServiceModuleHref(primaryDirectServiceModule.value, q);
        return;
    }

    window.location.href = `/patients?q=${encodeURIComponent(q)}`;
}

function dismissShiftIntent(presetKey?: DashboardPresetKey): void {
    if (presetKey) switchPreset(presetKey);
    shiftIntentDismissed.value = true;
    window.sessionStorage.setItem('dashboard.shift-intent', '1');
}

const clinicianMyQueueWaitingCount = computed(() =>
    Number(numberValue(counts.value.appointments, 'waiting_provider') ?? 0),
);

const departmentPoolWaitingCount = computed(() =>
    Number(numberValue(counts.value.departmentPoolAppointments, 'waiting_provider') ?? 0),
);

const showClinicianConsultationQueueAlert = computed(
    () =>
        activePresetKey.value === 'clinician'
        && !loading.value
        && !refreshing.value
        && (clinicianMyQueueWaitingCount.value > 0
            || (Boolean(clinicianClinicalDepartment.value) && departmentPoolWaitingCount.value > 0)),
);

const clinicianConsultationQueueAlertTitle = computed(() => {
    const myCount = clinicianMyQueueWaitingCount.value;
    const poolCount = departmentPoolWaitingCount.value;
    const department = clinicianClinicalDepartment.value;
    const segments: string[] = [];

    if (myCount > 0) {
        segments.push(`${myCount} in your queue`);
    }

    if (department && poolCount > 0) {
        segments.push(`${poolCount} in the ${department} department pool`);
    }

    if (segments.length === 0) {
        return '';
    }

    const totalPatients = myCount + poolCount;
    const patientLabel = `${totalPatients} patient${totalPatients === 1 ? '' : 's'}`;

    if (segments.length === 1) {
        return `${patientLabel} ${segments[0]}`;
    }

    return `${patientLabel} ready for consultation — ${segments.join(' and ')}`;
});

const clinicianConsultationQueueAlertDescription = computed(() => {
    const myCount = clinicianMyQueueWaitingCount.value;
    const poolCount = departmentPoolWaitingCount.value;
    const department = clinicianClinicalDepartment.value;
    const notes: string[] = [];

    if (myCount > 0) {
        notes.push(
            myCount === 1
                ? 'One visit is assigned to you and listed under My queue — waiting for provider below.'
                : `${myCount} visits are assigned to you and listed under My queue — waiting for provider below.`,
        );
    }

    if (department && poolCount > 0) {
        notes.push(
            poolCount === 1
                ? `One visit is in the shared ${department} pool and is waiting for the next available provider.`
                : `${poolCount} visits are in the shared ${department} pool and are waiting for the next available provider.`,
        );
    }

    return `${notes.join(' ')} Open the matching queue sections below or use the worklist actions above.`;
});

const queueViewAllHref = computed(() => {
    if (activePresetKey.value === 'front_desk') return `/appointments?view=queue&from=${today}`;
    if (activePresetKey.value === 'clinician') {
        if (clinicianMyQueueWaitingCount.value > 0) {
            return clinicianQueueHref('waiting_provider');
        }

        if (clinicianClinicalDepartment.value && departmentPoolWaitingCount.value > 0) {
            return departmentQueueHref(clinicianClinicalDepartment.value, 'waiting_provider');
        }

        return clinicianQueueHref('waiting_provider');
    }
    if (activePresetKey.value === 'nursing') return `/appointments?view=queue&status=checked_in&from=${today}`;
    if (activePresetKey.value === 'emergency') return `/appointments?view=queue&status=checked_in&from=${today}`;
    if (activePresetKey.value === 'direct_service') return directServiceModuleHref(primaryDirectServiceModule.value);
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
                                {{ dashboardPresetDescription }}
                            </p>
                            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
                                <span class="font-medium text-foreground">{{ dashboardPresetLabel }}</span>
                                <span class="select-none text-border" aria-hidden="true">·</span>
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">{{ currentFacilityLabel }}</span>
                                </span>
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
                                            Auto — {{ visiblePresetOptions.find((p) => p.key === inferredPreset)?.label ?? 'Default' }}
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
                        v-if="showClinicianConsultationQueueAlert"
                        class="rounded-lg border border-amber-500/40 bg-amber-500/5 py-2.5 text-amber-950 dark:text-amber-200"
                    >
                        <AppIcon name="calendar-clock" class="size-4 text-amber-600" />
                        <AlertTitle class="text-sm font-medium">
                            {{ clinicianConsultationQueueAlertTitle }}
                        </AlertTitle>
                        <AlertDescription class="mt-1 text-xs">
                            {{ clinicianConsultationQueueAlertDescription }}
                        </AlertDescription>
                    </Alert>

                    <Alert
                        v-if="showDirectServiceQueueAlert"
                        class="rounded-lg border border-sky-500/40 bg-sky-500/5 py-2.5 text-sky-950 dark:text-sky-200"
                    >
                        <AppIcon name="activity" class="size-4 text-sky-600" />
                        <AlertTitle class="text-sm font-medium">
                            {{ directServiceActiveQueueCount }} active {{ singleDirectServiceModule?.label.toLowerCase() ?? 'service' }} order{{ directServiceActiveQueueCount === 1 ? '' : 's' }} need attention
                        </AlertTitle>
                        <AlertDescription class="mt-1 text-xs">
                            Start with {{ primaryDirectServiceModule?.label ?? 'the active service queue' }} so ordered, scheduled, and in-progress work keeps moving.
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

                    <Alert
                        v-if="activePresetKey === 'emergency' && !loading && !refreshing && mciModeActive"
                        class="rounded-lg border border-red-600/50 bg-red-600/10 py-2.5 text-red-900 dark:text-red-200"
                    >
                        <AppIcon name="alert-triangle" class="size-4 text-red-600" />
                        <AlertTitle class="text-sm font-medium">
                            MCI Mode Active — Mass Casualty Incident
                        </AlertTitle>
                        <AlertDescription class="mt-1 text-xs">
                            Mass Casualty Incident protocols are active. Surge triage workflows apply. Coordinate with the incident commander before making individual disposition decisions.
                        </AlertDescription>
                    </Alert>

                    <!-- Worklist quick-search — front desk, clinician, nursing, emergency, direct service -->
                    <div
                        v-if="['front_desk', 'clinician', 'nursing', 'emergency', 'direct_service'].includes(activePresetKey)"
                        class="relative"
                    >
                        <AppIcon
                            name="search"
                            class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <input
                            v-model="patientSearchQuery"
                            type="search"
                            :placeholder="dashboardSearchPlaceholder"
                            class="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-24 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                            @keydown.enter="goToPatientSearch"
                        />
                        <button
                            v-if="patientSearchQuery.trim()"
                            type="button"
                            class="absolute right-9 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                            @click="goToPatientSearch"
                        >
                            Search all
                        </button>
                        <button
                            v-if="patientSearchQuery.trim()"
                            type="button"
                            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                            aria-label="Clear search"
                            @click="patientSearchQuery = ''"
                        >
                            <AppIcon name="x" class="size-3.5" />
                        </button>
                    </div>

                    <!-- P1 critical alert above queue when in emergency preset -->
                    <div
                        v-if="activePresetKey === 'emergency' && queueRows.some(r => r.triageCategory === 'P1')"
                        class="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2.5 dark:border-destructive/50 dark:bg-destructive/10"
                    >
                        <div class="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                            <AppIcon name="alert-triangle" class="size-3.5" />
                        </div>
                        <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <p class="text-xs font-semibold text-destructive">
                                P1 · IMMEDIATE — {{ queueRows.filter(r => r.triageCategory === 'P1').length }} critical patient{{ queueRows.filter(r => r.triageCategory === 'P1').length === 1 ? '' : 's' }} require immediate attention
                            </p>
                            <Link :href="queueViewAllHref" class="shrink-0 text-[11px] font-semibold text-destructive underline underline-offset-2">
                                Open queue
                            </Link>
                        </div>
                    </div>

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
                                    <template v-if="queuePreviewSearchActive">
                                        {{ displayedQueueRows.length }} / {{ queueRows.length }}
                                    </template>
                                    <template v-else>
                                        {{ queueRows.length }}
                                    </template>
                                </Badge>
                                <Button
                                    v-if="(queueRows.length > 0 || queuePreviewSearchActive) && !loading"
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
                            <div v-if="loading" class="divide-y">
                                <div
                                    v-for="n in 5"
                                    :key="`sk-q-${n}`"
                                    class="flex items-start gap-3 px-4 py-3.5"
                                >
                                    <div class="mt-0.5 size-2 shrink-0 animate-pulse rounded-full bg-muted" />
                                    <div class="min-w-0 flex-1 space-y-2">
                                        <div class="flex items-center justify-between gap-3">
                                            <div class="h-3.5 w-32 animate-pulse rounded bg-muted" />
                                            <div class="h-5 w-16 animate-pulse rounded-full bg-muted" />
                                        </div>
                                        <div class="h-3 w-3/4 animate-pulse rounded bg-muted" />
                                        <div class="h-3 w-1/2 animate-pulse rounded bg-muted" />
                                    </div>
                                </div>
                            </div>

                            <!-- Empty state -->
                            <div
                                v-else-if="queueRows.length === 0"
                                class="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center"
                            >
                                <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                    <AppIcon name="check-circle" class="size-5 text-muted-foreground/40" />
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-muted-foreground">Queue is clear</p>
                                    <p class="mt-0.5 text-xs text-muted-foreground/70">No items to action right now. Switch workflow preset or use the quick actions above to open a worklist.</p>
                                </div>
                            </div>

                            <!-- Search: loading or no matches -->
                            <div
                                v-else-if="queuePreviewSearchActive && (dashboardSearchLoading || displayedQueueRows.length === 0)"
                                class="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center"
                            >
                                <AppIcon
                                    :name="dashboardSearchLoading ? 'refresh-cw' : 'search'"
                                    class="size-8 text-muted-foreground/40"
                                    :class="dashboardSearchLoading ? 'motion-safe:animate-spin' : ''"
                                />
                                <div class="space-y-1">
                                    <p class="text-sm font-medium text-muted-foreground">
                                        {{ dashboardSearchLoading ? 'Searching worklist…' : 'No matching visits found' }}
                                    </p>
                                    <p v-if="!dashboardSearchLoading" class="text-xs text-muted-foreground/70">
                                        Try another patient name, MRN, phone, or appointment number, or open the full appointments worklist.
                                    </p>
                                </div>
                                <Button
                                    v-if="!dashboardSearchLoading"
                                    size="sm"
                                    variant="outline"
                                    class="h-8"
                                    @click="goToPatientSearch"
                                >
                                    Open full worklist
                                </Button>
                            </div>

                            <!-- Queue rows -->
                            <div v-else class="max-h-[28rem] overflow-y-auto">
                                <template v-for="(row, index) in displayedQueueRows" :key="row.id">
                                    <!-- Group header: show when this row starts a new group -->
                                    <div
                                        v-if="row.group && (index === 0 || displayedQueueRows[index - 1]?.group !== row.group)"
                                        class="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted/60 px-4 py-1.5 backdrop-blur-sm"
                                    >
                                        <span class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{{ row.group }}</span>
                                        <span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                                            {{ queueGroupCounts.get(row.group) ?? 0 }}
                                        </span>
                                    </div>
                                    <RegistryListRow
                                        :status-dot-class="
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
                                        :surface-class="['border-b px-4 py-3 last:border-b-0', dashboardRowBorderClass(row), dashboardRowBgClass(row)]"
                                        align="start"
                                        status-dot-offset
                                        :selectable="false"
                                    >
                                        <template #title>
                                            <div class="flex items-start justify-between gap-2">
                                                <p class="truncate text-sm font-medium leading-snug">{{ row.title }}</p>
                                                <div class="flex shrink-0 items-center gap-1">
                                                    <Badge
                                                        v-if="row.triageCategory"
                                                        class="rounded-lg text-[10px]"
                                                        :class="{
                                                            'bg-red-600 text-white hover:bg-red-600': row.triageCategory === 'P1',
                                                            'bg-orange-500 text-white hover:bg-orange-500': row.triageCategory === 'P2',
                                                            'bg-amber-400 text-amber-950 hover:bg-amber-400': row.triageCategory === 'P3',
                                                            'bg-sky-400 text-sky-950 hover:bg-sky-400': row.triageCategory === 'P4',
                                                            'bg-emerald-400 text-emerald-950 hover:bg-emerald-400': row.triageCategory === 'P5',
                                                        }"
                                                    >{{ row.triageCategory }}</Badge>
                                                    <Badge v-if="row.isOverdue" variant="destructive" class="rounded-lg text-[10px]">Overdue</Badge>
                                                    <Badge :variant="statusVariant(row.status)" class="max-w-[7rem] truncate rounded-lg text-[10px]">
                                                        {{ row.status }}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </template>
                                        <template #meta>
                                            <p class="truncate text-xs text-muted-foreground">{{ row.subtitle }}</p>
                                            <p class="mt-1 text-[11px] text-muted-foreground">{{ row.meta }}</p>
                                        </template>
                                        <template #actions>
                                            <Button
                                                as-child
                                                size="sm"
                                                :variant="queueRowActionVariant(row)"
                                                class="mt-0.5 h-7 shrink-0 rounded-lg text-xs"
                                            >
                                                <Link :href="row.href">{{ row.actionLabel }}</Link>
                                            </Button>
                                        </template>
                                    </RegistryListRow>
                                </template>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <!-- ── Handoff: shift context + operational watch ───────────── -->
                <TabsContent value="handoff" class="space-y-4">

                    <!-- Shift stat chips — top-level numbers at a glance -->
                    <div class="grid grid-cols-3 gap-3">
                        <!-- Skeleton -->
                        <template v-if="loading">
                            <div
                                v-for="n in 3"
                                :key="`sk-chip-${n}`"
                                class="rounded-lg border border-border bg-card p-3 text-center shadow-sm"
                            >
                                <div class="mx-auto h-2.5 w-16 animate-pulse rounded bg-muted" />
                                <div class="mx-auto mt-2 h-7 w-12 animate-pulse rounded-lg bg-muted" />
                            </div>
                        </template>
                        <template v-else>
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
                        </template>
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
                                <!-- Skeleton -->
                                <template v-if="loading">
                                    <div class="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                                        <div class="h-2 w-24 animate-pulse rounded bg-amber-500/30" />
                                        <div class="h-4 w-3/4 animate-pulse rounded bg-muted" />
                                        <div class="h-3 w-full animate-pulse rounded bg-muted" />
                                    </div>
                                    <div class="space-y-2 rounded-lg border bg-muted/25 p-3">
                                        <div class="h-2 w-32 animate-pulse rounded bg-muted" />
                                        <div class="h-3 w-full animate-pulse rounded bg-muted" />
                                        <div class="h-3 w-2/3 animate-pulse rounded bg-muted" />
                                        <div class="mt-1 flex gap-2">
                                            <div class="h-8 w-24 animate-pulse rounded-lg bg-muted" />
                                            <div class="h-8 w-24 animate-pulse rounded-lg bg-muted" />
                                        </div>
                                    </div>
                                </template>
                                <template v-else>
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
                                </template>
                            </CardContent>
                        </Card>

                        <!-- Operational watch -->
                        <Card class="self-start rounded-lg border border-border shadow-sm">
                            <CardHeader class="space-y-0 border-b pb-3">
                                <CardTitle class="text-sm font-semibold">Operational watch</CardTitle>
                                <CardDescription class="mt-0.5 text-xs">Cross-checks for this workspace.</CardDescription>
                            </CardHeader>
                            <CardContent class="divide-y p-0">
                                <!-- Skeleton -->
                                <template v-if="loading">
                                    <div
                                        v-for="n in 3"
                                        :key="`sk-watch-${n}`"
                                        class="flex items-start gap-3 px-4 py-3"
                                    >
                                        <div class="mt-0.5 size-8 shrink-0 animate-pulse rounded-lg bg-muted" />
                                        <div class="min-w-0 flex-1 space-y-2">
                                            <div class="flex items-center justify-between gap-2">
                                                <div class="h-3.5 w-32 animate-pulse rounded bg-muted" />
                                                <div class="h-5 w-8 animate-pulse rounded-lg bg-muted" />
                                            </div>
                                            <div class="h-3 w-4/5 animate-pulse rounded bg-muted" />
                                            <div class="h-3 w-20 animate-pulse rounded bg-muted" />
                                        </div>
                                    </div>
                                </template>
                                <template v-else>
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
                                </template>
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
                            <!-- Skeleton -->
                            <template v-if="loading">
                                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                    <div v-for="n in 4" :key="`sk-sys-${n}`" class="rounded-lg border bg-muted/20 p-2.5">
                                        <div class="h-2 w-20 animate-pulse rounded bg-muted" />
                                        <div class="mt-1.5 h-4 w-16 animate-pulse rounded bg-muted" />
                                    </div>
                                </div>
                            </template>
                            <template v-else>
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
                            </template>
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
                            <!-- Skeleton -->
                            <div v-if="loading" class="divide-y">
                                <div
                                    v-for="n in 3"
                                    :key="`sk-act-${n}`"
                                    class="flex items-start gap-3 px-4 py-3"
                                >
                                    <div class="mt-0.5 size-7 shrink-0 animate-pulse rounded-lg bg-muted" />
                                    <div class="min-w-0 flex-1 space-y-2">
                                        <div class="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
                                        <div class="h-3 w-3/4 animate-pulse rounded bg-muted" />
                                        <div class="h-3 w-1/3 animate-pulse rounded bg-muted" />
                                    </div>
                                </div>
                            </div>

                            <!-- Empty state -->
                            <div
                                v-else-if="activityFeed.length === 0"
                                class="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center"
                            >
                                <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25">
                                    <AppIcon name="check-circle" class="size-5 text-muted-foreground/40" />
                                </div>
                                <div>
                                    <p class="text-sm font-medium text-muted-foreground">No export failures</p>
                                    <p class="mt-0.5 text-xs text-muted-foreground/70">No audit export failures recorded in the recent window.</p>
                                </div>
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
