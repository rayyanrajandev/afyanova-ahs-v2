<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGet, apiGetBlob, apiPatch, apiPost, isApiClientError } from '@/lib/apiClient';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { patientChartHref } from '@/lib/patientChart';
import type { BreadcrumbItem } from '@/types';

type DepartmentOptionRow = {
    value: string;
    label: string;
    code?: string | null;
    serviceType?: string | null;
};

type ServiceRequestRow = {
    id: string;
    requestNumber: string | null;
    patientId: string | null;
    appointmentId?: string | null;
    departmentId?: string | null;
    requestedByUserId?: string | number | null;
    serviceType: string | null;
    priority: string | null;
    status: string | null;
    notes: string | null;
    requestedAt?: string | null;
    acknowledgedAt?: string | null;
    acknowledgedByUserId?: string | number | null;
    completedAt?: string | null;
    statusReason?: string | null;
    linkedOrderType?: string | null;
    linkedOrderId?: string | null;
    linkedOrderNumber?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

type PatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
};

type ListMeta = {
    currentPage?: number;
    perPage?: number;
    total?: number;
    lastPage?: number;
};

type AuditEventRow = {
    id: string;
    action?: string | null;
    actorUserId?: string | number | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: string | null;
};

type StatusCounts = {
    pending: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    total: number;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Walk-in queue', href: '/walk-in-service-requests' },
];

const { hasPermission } = usePlatformAccess();

const canExport = () => hasPermission('service.requests.export');
const canViewAudit = () => hasPermission('service.requests.audit-logs.read');
const canCreate = () => hasPermission('service.requests.create');
const canUpdateStatus = () => hasPermission('service.requests.update-status');

const compactRows = useLocalStorageBoolean('walk-in-compact-rows', false);
const filtersSheetOpen = ref(false);

const routeSearchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

const serviceTypeOptions = [
    { value: '_all', label: 'All desks' },
    { value: 'laboratory', label: formatEnumLabel('laboratory') },
    { value: 'pharmacy', label: formatEnumLabel('pharmacy') },
    { value: 'radiology', label: formatEnumLabel('radiology') },
    { value: 'theatre_procedure', label: 'Procedure' },
];

const serviceTypeCreateOptions = [
    { value: 'laboratory', label: formatEnumLabel('laboratory') },
    { value: 'pharmacy', label: formatEnumLabel('pharmacy') },
    { value: 'radiology', label: formatEnumLabel('radiology') },
    { value: 'theatre_procedure', label: 'Procedure' },
];

const priorityFilterOptions = [
    { value: '_all', label: 'Any priority' },
    { value: 'routine', label: formatEnumLabel('routine') },
    { value: 'urgent', label: formatEnumLabel('urgent') },
];

const STATUS_TABS: { value: string; label: string; icon: string }[] = [
    { value: 'all', label: 'All', icon: 'list' },
    { value: 'pending', label: 'Pending', icon: 'clock' },
    { value: 'in_progress', label: 'In Progress', icon: 'loader-circle' },
    { value: 'completed', label: 'Completed', icon: 'check-circle' },
    { value: 'cancelled', label: 'Cancelled', icon: 'x-circle' },
];

// ─── Filters ─────────────────────────────────────────────────────────────────

const filters = reactive({
    q: '',
    serviceType: routeSearchParams.get('serviceType') ?? '_all',
    status: routeSearchParams.get('status') ?? '',
    priority: routeSearchParams.get('priority') ?? '_all',
    patientId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 25,
});

const activeTab = ref<string>(filters.status !== '' ? filters.status : 'all');

watch(activeTab, (newTab) => {
    filters.status = newTab === 'all' ? '' : newTab;
    filters.page = 1;
    void loadList();
});

const activeFilterCount = computed(() => {
    let count = 0;
    if (filters.serviceType && filters.serviceType !== '_all') count++;
    if (filters.priority && filters.priority !== '_all') count++;
    if (filters.patientId) count++;
    if (filters.from || filters.to) count++;
    return count;
});

// ─── List state ───────────────────────────────────────────────────────────────

const loading = ref(false);
const exportLoading = ref(false);
const loadError = ref<string | null>(null);
const rows = ref<ServiceRequestRow[]>([]);
const meta = ref<ListMeta | null>(null);

// ─── Status counts ────────────────────────────────────────────────────────────

const statusCounts = ref<StatusCounts>({ pending: 0, in_progress: 0, completed: 0, cancelled: 0, total: 0 });

async function loadStatusCounts(): Promise<void> {
    try {
        const result = await apiGet<{ data: StatusCounts }>('/service-requests/status-counts', undefined, {
            entitlementContext: 'Walk-in queue',
        });
        statusCounts.value = result.data ?? { pending: 0, in_progress: 0, completed: 0, cancelled: 0, total: 0 };
    } catch {
        // non-critical; ignore silently
    }
}

// ─── Pagination helper ────────────────────────────────────────────────────────

function buildPageList(current: number, last: number): (number | '...')[] {
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    const result: (number | '...')[] = [1];
    if (current > 3) result.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(last - 1, current + 1); i++) {
        result.push(i);
    }
    if (current < last - 2) result.push('...');
    result.push(last);
    return result;
}

const pageList = computed(() => buildPageList(meta.value?.currentPage ?? 1, meta.value?.lastPage ?? 1));

// ─── Patient name hydration ────────────────────────────────────────────────────

const patientNames = ref<Record<string, string>>({});
const pendingLookups = new Set<string>();

function displayNameFromPatient(p: PatientSummary): string {
    const name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim();
    return name !== '' ? name : (p.patientNumber?.trim() || p.id);
}

async function hydratePatientName(patientId: string): Promise<void> {
    const id = patientId.trim();
    if (!id || patientNames.value[id] || pendingLookups.has(id)) return;
    pendingLookups.add(id);
    try {
        const response = await apiGet<{ data: PatientSummary }>(`/patients/${encodeURIComponent(id)}`);
        patientNames.value = { ...patientNames.value, [id]: displayNameFromPatient(response.data) };
    } catch {
        patientNames.value = { ...patientNames.value, [id]: id };
    } finally {
        pendingLookups.delete(id);
    }
}

function resolvedPatientName(patientId: string | null): string | null {
    if (!patientId) return null;
    return patientNames.value[patientId] ?? null;
}

// ─── Audit trail ──────────────────────────────────────────────────────────────

const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditEvents = ref<AuditEventRow[]>([]);

// ─── Details sheet ─────────────────────────────────────────────────────────────

const detailsOpen = ref(false);
const detailsRow = ref<ServiceRequestRow | null>(null);
const detailsTab = ref<'details' | 'audit'>('details');

function openDetails(row: ServiceRequestRow): void {
    detailsRow.value = row;
    detailsTab.value = 'details';
    detailsOpen.value = true;
}

function openAuditTab(row: ServiceRequestRow): void {
    detailsRow.value = row;
    detailsOpen.value = true;
    detailsTab.value = 'audit';
    if (canViewAudit()) void loadAuditForDetails();
}

// ─── Status update ─────────────────────────────────────────────────────────────

const statusUpdating = ref<string | null>(null);

async function updateRowStatus(row: ServiceRequestRow, newStatus: string): Promise<void> {
    if (!canUpdateStatus() || statusUpdating.value) return;
    statusUpdating.value = row.id;
    try {
        await apiPatch<{ data: ServiceRequestRow }>(`/service-requests/${encodeURIComponent(row.id)}/status`, {
            body: { status: newStatus },
            entitlementContext: 'Walk-in status',
        });
        notifySuccess('Status updated successfully.');
        if (detailsRow.value?.id === row.id) detailsOpen.value = false;
        void loadList();
        void loadStatusCounts();
    } catch (error) {
        notifyError(messageFromUnknown(error));
    } finally {
        statusUpdating.value = null;
    }
}

// ─── Create request ────────────────────────────────────────────────────────────

const createOpen = ref(false);
const createLoading = ref(false);
const createErrors = ref<Record<string, string>>({});
const createForm = reactive({
    patientId: '',
    departmentId: '',
    serviceType: '',
    priority: 'routine',
    notes: '',
});

const departmentOptions = ref<DepartmentOptionRow[]>([]);
const departmentOptionsLoading = ref(false);

function resetCreateForm(): void {
    createForm.patientId = '';
    createForm.departmentId = '';
    createForm.serviceType = '';
    createForm.priority = 'routine';
    createForm.notes = '';
    createErrors.value = {};
}

function departmentLabel(id: string | null | undefined): string | null {
    if (!id) return null;
    return departmentOptions.value.find((o) => o.value === id)?.label ?? null;
}

async function loadDepartmentOptions(): Promise<void> {
    if (departmentOptionsLoading.value) return;
    departmentOptionsLoading.value = true;
    try {
        const result = await apiGet<{ data: DepartmentOptionRow[] }>('/service-requests/department-options', undefined, {
            entitlementContext: 'Walk-in queue',
        });
        departmentOptions.value = result.data ?? [];
    } catch {
        departmentOptions.value = [];
    } finally {
        departmentOptionsLoading.value = false;
    }
}

async function submitCreate(): Promise<void> {
    if (createLoading.value) return;
    createErrors.value = {};
    if (!createForm.patientId) {
        createErrors.value.patientId = 'Patient is required.';
        return;
    }
    if (!createForm.serviceType) {
        createErrors.value.serviceType = 'Service desk is required.';
        return;
    }
    createLoading.value = true;
    try {
        await apiPost<{ data: ServiceRequestRow }>('/service-requests', {
            body: {
                patientId: createForm.patientId,
                departmentId: createForm.departmentId.trim() || null,
                serviceType: createForm.serviceType,
                priority: createForm.priority || null,
                notes: createForm.notes.trim() || null,
            },
            entitlementContext: 'Walk-in create',
        });
        notifySuccess('Walk-in request created.');
        createOpen.value = false;
        resetCreateForm();
        void loadList();
        void loadStatusCounts();
    } catch (error) {
        if (isApiClientError(error)) {
            const payload = error.payload as Record<string, unknown> | null;
            const errors = payload?.errors;
            if (errors && typeof errors === 'object') {
                const errMap = errors as Record<string, string[]>;
                for (const [field, msgs] of Object.entries(errMap)) {
                    if (Array.isArray(msgs) && msgs.length > 0) {
                        createErrors.value[field] = msgs[0];
                    }
                }
                return;
            }
            notifyError(error.message);
        } else {
            notifyError(messageFromUnknown(error));
        }
    } finally {
        createLoading.value = false;
    }
}

// ─── Status badge helpers ──────────────────────────────────────────────────────

function statusBadgeClass(status: string | null): string {
    switch (status) {
        case 'pending':
            return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
        case 'in_progress':
            return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
        case 'completed':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
        case 'cancelled':
            return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300';
        default:
            return '';
    }
}

function statusBarClass(status: string | null): string {
    switch (status) {
        case 'pending': return 'bg-amber-400';
        case 'in_progress': return 'bg-blue-500';
        case 'completed': return 'bg-emerald-500';
        case 'cancelled': return 'bg-red-400';
        default: return 'bg-muted-foreground/30';
    }
}

// ─── Load list ─────────────────────────────────────────────────────────────────

async function loadList(): Promise<void> {
    if (loading.value) return;

    loading.value = true;
    loadError.value = null;

    try {
        const query: Record<string, string | number> = {
            page: filters.page,
            perPage: filters.perPage,
            sortDir: 'desc',
        };
        if (filters.q.trim()) query.q = filters.q.trim();
        if (filters.serviceType && filters.serviceType !== '_all') query.serviceType = filters.serviceType;
        if (filters.status) query.status = filters.status;
        if (filters.priority && filters.priority !== '_all') query.priority = filters.priority;
        if (filters.patientId) query.patientId = filters.patientId;
        if (filters.from) query.from = filters.from;
        if (filters.to) query.to = filters.to;

        const result = await apiGet<{ data: ServiceRequestRow[]; meta: ListMeta }>('/service-requests', query, {
            entitlementContext: 'Walk-in queue',
        });

        rows.value = result.data ?? [];
        meta.value = result.meta ?? null;

        for (const row of rows.value) {
            if (row.patientId) void hydratePatientName(row.patientId);
        }
    } catch (error) {
        rows.value = [];
        meta.value = null;
        loadError.value = isApiClientError(error) ? error.message : messageFromUnknown(error);
    } finally {
        loading.value = false;
    }
}

function goToPage(next: number): void {
    const last = meta.value?.lastPage ?? 1;
    const clamped = Math.min(Math.max(next, 1), Math.max(last, 1));
    if (clamped === filters.page) return;
    filters.page = clamped;
    void loadList();
}

function changePerPage(value: string): void {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    filters.perPage = Math.min(parsed, 100);
    filters.page = 1;
    void loadList();
}

function applyFilters(): void {
    filters.page = 1;
    void loadList();
}

function resetFilters(): void {
    filters.serviceType = '_all';
    filters.priority = '_all';
    filters.patientId = '';
    filters.from = '';
    filters.to = '';
    filters.page = 1;
    filtersSheetOpen.value = false;
    void loadList();
}

async function downloadExport(): Promise<void> {
    if (!canExport() || exportLoading.value) return;

    exportLoading.value = true;

    try {
        const query: Record<string, string> = {};
        if (filters.q.trim()) query.q = filters.q.trim();
        if (filters.serviceType && filters.serviceType !== '_all') query.serviceType = filters.serviceType;
        if (filters.status) query.status = filters.status;
        if (filters.priority && filters.priority !== '_all') query.priority = filters.priority;
        if (filters.patientId) query.patientId = filters.patientId;
        if (filters.from) query.from = filters.from;
        if (filters.to) query.to = filters.to;

        const { blob, filename } = await apiGetBlob('/service-requests/export/csv', {
            query,
            entitlementContext: 'Walk-in export',
        });

        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename?.trim() !== '' ? filename : 'service-requests.csv';
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        notifyError(messageFromUnknown(error));
    } finally {
        exportLoading.value = false;
    }
}

async function loadAuditForDetails(): Promise<void> {
    if (!detailsRow.value || !canViewAudit()) return;

    auditEvents.value = [];
    auditError.value = null;
    auditLoading.value = true;

    try {
        const response = await apiGet<{ data: AuditEventRow[] }>(
            `/service-requests/${encodeURIComponent(detailsRow.value.id)}/audit-events`,
            undefined,
            { entitlementContext: 'Walk-in audit' },
        );
        auditEvents.value = response.data ?? [];
    } catch (error) {
        auditError.value = messageFromUnknown(error);
    } finally {
        auditLoading.value = false;
    }
}

watch(detailsTab, (tab) => {
    if (tab === 'audit') void loadAuditForDetails();
});

onMounted(() => {
    void loadList();
    void loadStatusCounts();
    void loadDepartmentOptions();
});
</script>

<template>
    <Head title="Walk-in queue" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <!-- Page header -->
            <section class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="list-checks" class="size-7 text-primary" />
                        Walk-in Service Queue
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Track and manage walk-in patient service requests across all desks.
                    </p>
                </div>
                <div class="flex shrink-0 flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5"
                        :disabled="loading"
                        @click="void loadList(); void loadStatusCounts()"
                    >
                        <AppIcon name="refresh-cw" class="size-3.5" :class="{ 'animate-spin': loading }" />
                        Refresh
                    </Button>
                    <Button
                        v-if="canExport()"
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5"
                        :disabled="exportLoading"
                        @click="downloadExport()"
                    >
                        <AppIcon v-if="exportLoading" name="refresh-cw" class="size-3.5 animate-spin" />
                        <AppIcon v-else name="download" class="size-3.5" />
                        Export CSV
                    </Button>
                    <Button v-if="canCreate()" size="sm" class="h-8 gap-1.5" @click="createOpen = true">
                        <AppIcon name="plus" class="size-3.5" />
                        New request
                    </Button>
                </div>
            </section>

            <!-- Status count bar -->
            <div class="flex min-h-9 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2">
                <span class="text-xs font-medium text-muted-foreground">Queue overview:</span>
                <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
                    :class="activeTab === 'pending' ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-border'"
                    @click="activeTab = 'pending'"
                >
                    <span class="font-medium text-foreground">{{ statusCounts.pending }}</span>
                    <span class="text-muted-foreground">Pending</span>
                </button>
                <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
                    :class="activeTab === 'in_progress' ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30' : 'border-border'"
                    @click="activeTab = 'in_progress'"
                >
                    <span class="font-medium text-foreground">{{ statusCounts.in_progress }}</span>
                    <span class="text-muted-foreground">In Progress</span>
                </button>
                <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
                    :class="activeTab === 'completed' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-border'"
                    @click="activeTab = 'completed'"
                >
                    <span class="font-medium text-foreground">{{ statusCounts.completed }}</span>
                    <span class="text-muted-foreground">Completed</span>
                </button>
                <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/60"
                    :class="activeTab === 'cancelled' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : 'border-border'"
                    @click="activeTab = 'cancelled'"
                >
                    <span class="font-medium text-foreground">{{ statusCounts.cancelled }}</span>
                    <span class="text-muted-foreground">Cancelled</span>
                </button>
                <span class="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <span class="font-medium text-foreground">{{ statusCounts.total }}</span> total
                </span>
            </div>

            <!-- Error alert -->
            <Alert v-if="loadError" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="circle-x" class="size-4" />
                    Failed to load requests
                </AlertTitle>
                <AlertDescription>{{ loadError }}</AlertDescription>
            </Alert>

            <!-- Status tabs + queue card -->
            <Tabs :model-value="activeTab" class="flex min-h-0 flex-1 flex-col gap-4" @update:model-value="activeTab = $event as string">
                <TabsList class="w-full justify-start">
                    <TabsTrigger v-for="tab in STATUS_TABS" :key="tab.value" :value="tab.value" class="gap-1.5">
                        <AppIcon :name="tab.icon" class="size-3.5" />
                        {{ tab.label }}
                    </TabsTrigger>
                </TabsList>

                <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <!-- Card title row -->
                    <div class="flex items-center gap-4 border-b px-4 py-3.5">
                        <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                            <AppIcon name="ticket" class="size-4 text-muted-foreground" />
                            Service Requests
                            <span v-if="meta?.total !== undefined" class="ml-1 text-xs font-normal text-muted-foreground">
                                &middot; {{ meta.total }} result{{ meta.total !== 1 ? 's' : '' }}
                            </span>
                        </h3>
                    </div>

                    <!-- Filter toolbar (compact: search + filters sheet + compact toggle) -->
                    <div class="flex items-center gap-2 border-b px-4 py-3">
                        <SearchInput
                            id="walk-in-q"
                            v-model="filters.q"
                            placeholder="Search ticket, notes..."
                            class="min-w-0 flex-1 text-xs"
                            @keyup.enter="applyFilters()"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-9 gap-1.5 rounded-lg text-xs"
                            @click="filtersSheetOpen = true"
                        >
                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                            Filters
                            <Badge
                                v-if="activeFilterCount > 0"
                                variant="secondary"
                                class="ml-1 h-5 px-1.5 text-[10px]"
                            >
                                {{ activeFilterCount }}
                            </Badge>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            class="hidden h-9 rounded-lg text-xs sm:inline-flex"
                            @click="compactRows = !compactRows"
                        >
                            {{ compactRows ? 'Comfortable' : 'Compact' }}
                        </Button>
                    </div>

                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem] p-4" :class="compactRows ? 'space-y-2' : 'space-y-3'">
                                <!-- Loading skeleton -->
                                <div v-if="loading" class="space-y-2">
                                    <div class="h-20 w-full animate-pulse rounded-lg bg-muted" />
                                    <div class="h-20 w-full animate-pulse rounded-lg bg-muted" />
                                    <div class="h-20 w-full animate-pulse rounded-lg bg-muted" />
                                </div>

                                <!-- Empty state -->
                                <div v-else-if="rows.length === 0" class="flex flex-col items-center gap-3 py-16 text-center">
                                    <span class="flex size-12 items-center justify-center rounded-full bg-muted/60">
                                        <AppIcon name="inbox" class="size-6 text-muted-foreground/50" />
                                    </span>
                                    <div>
                                        <p class="text-sm font-medium text-foreground">No requests found</p>
                                        <p class="mt-1 text-xs text-muted-foreground">No walk-in requests match the current filters.</p>
                                    </div>
                                </div>

                                <!-- Request rows -->
                                <div v-else :class="compactRows ? 'space-y-2' : 'space-y-3'">
                                    <div
                                        v-for="row in rows"
                                        :key="row.id"
                                        class="relative cursor-pointer rounded-lg border outline-none transition-colors hover:bg-muted/30"
                                        :class="compactRows ? 'p-2.5' : 'p-3'"
                                        @click="openDetails(row)"
                                    >
                                        <!-- Status left accent bar -->
                                        <div
                                            class="absolute inset-y-0 left-0 w-[3px] rounded-l-lg"
                                            :class="statusBarClass(row.status)"
                                        />

                                        <!-- Header: ticket # + desk + timestamps + badges -->
                                        <div class="flex flex-wrap items-start justify-between gap-2 pl-2">
                                            <div class="min-w-0">
                                                <p class="text-sm font-semibold">{{ row.requestNumber ?? row.id }}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ row.serviceType ? formatEnumLabel(row.serviceType) : '—' }}
                                                    &middot;
                                                    {{ row.requestedAt ? new Date(row.requestedAt).toLocaleString() : '—' }}
                                                </p>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-1.5">
                                                <span
                                                    v-if="row.priority === 'urgent'"
                                                    class="inline-flex rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-200"
                                                >
                                                    Urgent
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    class="font-normal capitalize"
                                                    :class="statusBadgeClass(row.status)"
                                                >
                                                    {{ row.status ? formatEnumLabel(row.status) : '—' }}
                                                </Badge>
                                            </div>
                                        </div>

                                        <!-- Patient row -->
                                        <div class="mt-1.5 pl-2 text-xs text-muted-foreground">
                                            <template v-if="row.patientId">
                                                Patient:
                                                <span
                                                    v-if="resolvedPatientName(row.patientId)"
                                                    class="font-medium text-foreground"
                                                >
                                                    {{ resolvedPatientName(row.patientId) }}
                                                </span>
                                                <span v-else class="italic text-muted-foreground/60">Loading…</span>
                                                &nbsp;&middot;&nbsp;
                                                <a
                                                    class="text-primary underline-offset-4 hover:underline"
                                                    :href="patientChartHref(row.patientId)"
                                                    @click.stop
                                                >Open chart</a>
                                            </template>
                                            <span v-else>No patient linked</span>
                                        </div>

                                        <div class="mt-1 pl-2 text-xs text-muted-foreground">
                                            Department:
                                            <span class="font-medium text-foreground">
                                                <template v-if="row.departmentId">
                                                    {{ departmentLabel(row.departmentId) ?? '—' }}
                                                </template>
                                                <template v-else>—</template>
                                            </span>
                                        </div>

                                        <!-- Action buttons -->
                                        <div class="mt-2.5 flex flex-wrap gap-2 pl-2" @click.stop>
                                            <Button
                                                v-if="canUpdateStatus() && row.status === 'pending'"
                                                size="sm"
                                                variant="outline"
                                                class="h-8 gap-1.5 rounded-lg text-xs"
                                                :disabled="statusUpdating === row.id"
                                                @click="updateRowStatus(row, 'in_progress')"
                                            >
                                                <AppIcon name="play" class="size-3.5" />
                                                Start
                                            </Button>
                                            <Button
                                                v-if="canUpdateStatus() && row.status === 'in_progress'"
                                                size="sm"
                                                variant="outline"
                                                class="h-8 gap-1.5 rounded-lg text-xs"
                                                :disabled="statusUpdating === row.id"
                                                @click="updateRowStatus(row, 'completed')"
                                            >
                                                <AppIcon name="check" class="size-3.5" />
                                                Complete
                                            </Button>
                                            <Button
                                                v-if="canUpdateStatus() && (row.status === 'pending' || row.status === 'in_progress')"
                                                size="sm"
                                                variant="ghost"
                                                class="h-8 gap-1.5 rounded-lg text-xs text-destructive hover:text-destructive"
                                                :disabled="statusUpdating === row.id"
                                                @click="updateRowStatus(row, 'cancelled')"
                                            >
                                                <AppIcon name="x" class="size-3.5" />
                                                Cancel
                                            </Button>
                                            <Button
                                                v-if="canViewAudit()"
                                                size="sm"
                                                variant="ghost"
                                                class="h-8 gap-1.5 rounded-lg text-xs"
                                                @click="openAuditTab(row)"
                                            >
                                                <AppIcon name="clock" class="size-3.5" />
                                                Audit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                class="h-8 rounded-lg text-xs"
                                                @click="openDetails(row)"
                                            >
                                                Details
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>

                        <!-- Pagination footer -->
                        <footer
                            v-if="!loading && meta && (meta.lastPage ?? 1) > 1"
                            class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2"
                        >
                            <p class="text-xs text-muted-foreground">
                                Showing {{ rows.length }} of {{ meta.total ?? rows.length }} &middot;
                                Page {{ meta.currentPage ?? 1 }} of {{ meta.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="(meta.currentPage ?? 1) <= 1 || loading"
                                    @click="goToPage((meta.currentPage ?? 1) - 1)"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Previous
                                </Button>
                                <template v-for="pg in pageList" :key="typeof pg === 'number' ? `p-${pg}` : `e-${Math.random()}`">
                                    <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                    <Button
                                        v-else
                                        size="sm"
                                        :variant="pg === (meta?.currentPage ?? 1) ? 'default' : 'outline'"
                                        class="h-8 w-8 p-0"
                                        :disabled="loading"
                                        @click="goToPage(pg as number)"
                                    >
                                        {{ pg }}
                                    </Button>
                                </template>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="(meta.currentPage ?? 1) >= (meta.lastPage ?? 1) || loading"
                                    @click="goToPage((meta.currentPage ?? 1) + 1)"
                                >
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>
            </Tabs>
        </div>

        <!-- ── Details sheet ──────────────────────────────────────────────────── -->
        <Sheet v-model:open="detailsOpen">
            <SheetContent side="right" variant="form" size="lg" class="flex h-full min-h-0 flex-col">
                <SheetHeader class="shrink-0 border-b px-4 py-3 text-left">
                    <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2">
                        <AppIcon name="ticket" class="size-4 text-muted-foreground" />
                        {{ detailsRow?.requestNumber ?? detailsRow?.id?.slice(0, 8) ?? '—' }}
                        <Badge
                            v-if="detailsRow?.status"
                            variant="outline"
                            class="font-normal capitalize"
                            :class="statusBadgeClass(detailsRow.status)"
                        >
                            {{ formatEnumLabel(detailsRow.status) }}
                        </Badge>
                        <span
                            v-if="detailsRow?.priority === 'urgent'"
                            class="inline-flex rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-200"
                        >
                            Urgent
                        </span>
                    </SheetTitle>
                    <SheetDescription v-if="detailsRow">
                        {{ detailsRow.serviceType ? formatEnumLabel(detailsRow.serviceType) : 'No desk' }}
                        <template v-if="detailsRow.requestedAt">
                            &middot; {{ new Date(detailsRow.requestedAt).toLocaleString() }}
                        </template>
                    </SheetDescription>
                </SheetHeader>

                <div v-if="detailsRow" class="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <!-- Info cards -->
                    <div class="shrink-0 border-b bg-muted/5 px-4 py-3">
                        <div class="grid gap-2 sm:grid-cols-2">
                            <div class="rounded-lg border bg-background/70 px-3 py-2">
                                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Request</p>
                                <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                    {{ detailsRow.requestNumber ?? detailsRow.id.slice(0, 8) }}
                                </p>
                                <p class="truncate text-xs leading-4 text-muted-foreground">
                                    {{ detailsRow.serviceType ? formatEnumLabel(detailsRow.serviceType) : 'No desk' }}
                                </p>
                            </div>
                            <div class="rounded-lg border bg-background/70 px-3 py-2">
                                <div class="flex items-center justify-between gap-2">
                                    <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Patient</p>
                                    <a
                                        v-if="detailsRow.patientId"
                                        class="text-xs text-primary underline-offset-4 hover:underline"
                                        :href="patientChartHref(detailsRow.patientId)"
                                    >Open chart</a>
                                </div>
                                <p class="mt-0.5 truncate text-sm font-semibold leading-4">
                                    <span v-if="detailsRow.patientId && resolvedPatientName(detailsRow.patientId)">
                                        {{ resolvedPatientName(detailsRow.patientId) }}
                                    </span>
                                    <span v-else-if="detailsRow.patientId" class="italic text-muted-foreground/60">Loading…</span>
                                    <span v-else class="text-muted-foreground">—</span>
                                </p>
                                <p class="truncate text-xs leading-4 capitalize text-muted-foreground">
                                    {{ detailsRow.priority ? formatEnumLabel(detailsRow.priority) : 'No priority' }} priority
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Tabs: Details / Audit -->
                    <Tabs v-model="detailsTab" class="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div class="shrink-0 border-b px-4 pt-3">
                            <TabsList class="h-auto w-full justify-start rounded-none bg-transparent p-0">
                                <TabsTrigger
                                    value="details"
                                    class="h-9 gap-1.5 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                                >
                                    <AppIcon name="info" class="size-3.5" />
                                    Details
                                </TabsTrigger>
                                <TabsTrigger
                                    v-if="canViewAudit()"
                                    value="audit"
                                    class="h-9 gap-1.5 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                                >
                                    <AppIcon name="clock" class="size-3.5" />
                                    Audit trail
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea class="min-h-0 flex-1">
                            <!-- Details tab -->
                            <TabsContent value="details" class="mt-0 px-4 py-4">
                                <dl class="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                                    <div>
                                        <dt class="text-xs font-medium text-muted-foreground">Desk</dt>
                                        <dd class="mt-0.5 capitalize text-foreground">
                                            {{ detailsRow.serviceType ? formatEnumLabel(detailsRow.serviceType) : '—' }}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs font-medium text-muted-foreground">Priority</dt>
                                        <dd class="mt-0.5 capitalize text-foreground">
                                            {{ detailsRow.priority ? formatEnumLabel(detailsRow.priority) : '—' }}
                                        </dd>
                                    </div>
                                    <div class="col-span-2">
                                        <dt class="text-xs font-medium text-muted-foreground">Department (patient destination)</dt>
                                        <dd class="mt-0.5 text-foreground">
                                            {{
                                                detailsRow.departmentId
                                                    ? (departmentLabel(detailsRow.departmentId) ?? '—')
                                                    : '—'
                                            }}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs font-medium text-muted-foreground">Requested</dt>
                                        <dd class="mt-0.5 text-foreground">
                                            {{ detailsRow.requestedAt ? new Date(detailsRow.requestedAt).toLocaleString() : '—' }}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs font-medium text-muted-foreground">Acknowledged</dt>
                                        <dd class="mt-0.5 text-foreground">
                                            {{ detailsRow.acknowledgedAt ? new Date(detailsRow.acknowledgedAt).toLocaleString() : '—' }}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt class="text-xs font-medium text-muted-foreground">Completed</dt>
                                        <dd class="mt-0.5 text-foreground">
                                            {{ detailsRow.completedAt ? new Date(detailsRow.completedAt).toLocaleString() : '—' }}
                                        </dd>
                                    </div>
                                    <div v-if="detailsRow.linkedOrderNumber">
                                        <dt class="text-xs font-medium text-muted-foreground">Linked order</dt>
                                        <dd class="mt-0.5 font-medium text-foreground">{{ detailsRow.linkedOrderNumber }}</dd>
                                    </div>
                                    <div v-if="detailsRow.statusReason" class="col-span-2">
                                        <dt class="text-xs font-medium text-muted-foreground">Status reason</dt>
                                        <dd class="mt-0.5 text-foreground">{{ detailsRow.statusReason }}</dd>
                                    </div>
                                    <div v-if="detailsRow.notes" class="col-span-2">
                                        <dt class="text-xs font-medium text-muted-foreground">Notes</dt>
                                        <dd class="mt-0.5 text-foreground">{{ detailsRow.notes }}</dd>
                                    </div>
                                </dl>
                            </TabsContent>

                            <!-- Audit tab -->
                            <TabsContent v-if="canViewAudit()" value="audit" class="mt-0 px-4 py-4">
                                <div v-if="auditLoading" class="space-y-2">
                                    <div class="h-10 w-full animate-pulse rounded-lg bg-muted" />
                                    <div class="h-10 w-4/5 animate-pulse rounded-lg bg-muted" />
                                    <div class="h-10 w-3/5 animate-pulse rounded-lg bg-muted" />
                                </div>
                                <div
                                    v-else-if="auditError"
                                    class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                                >
                                    {{ auditError }}
                                </div>
                                <p v-else-if="auditEvents.length === 0" class="py-8 text-center text-sm text-muted-foreground">
                                    No audit events recorded.
                                </p>
                                <ul v-else class="flex flex-col gap-2">
                                    <li
                                        v-for="ev in auditEvents"
                                        :key="ev.id"
                                        class="rounded-md border bg-card px-3 py-2 text-sm"
                                    >
                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                            <span class="font-medium text-foreground">{{ ev.action ?? 'event' }}</span>
                                            <span class="text-xs text-muted-foreground">
                                                {{ ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '' }}
                                            </span>
                                        </div>
                                        <div v-if="ev.fromStatus || ev.toStatus" class="mt-1.5 flex items-center gap-1.5">
                                            <Badge
                                                variant="outline"
                                                class="px-1.5 py-0 text-xs font-normal capitalize"
                                                :class="statusBadgeClass(ev.fromStatus ?? null)"
                                            >
                                                {{ ev.fromStatus ? formatEnumLabel(ev.fromStatus) : '?' }}
                                            </Badge>
                                            <AppIcon name="arrow-right" class="size-3 shrink-0 text-muted-foreground" />
                                            <Badge
                                                variant="outline"
                                                class="px-1.5 py-0 text-xs font-normal capitalize"
                                                :class="statusBadgeClass(ev.toStatus ?? null)"
                                            >
                                                {{ ev.toStatus ? formatEnumLabel(ev.toStatus) : '?' }}
                                            </Badge>
                                        </div>
                                    </li>
                                </ul>
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </div>

                <!-- Footer: status actions + close -->
                <SheetFooter class="shrink-0 gap-2 border-t px-4 py-3">
                    <template v-if="detailsRow && canUpdateStatus() && (detailsRow.status === 'pending' || detailsRow.status === 'in_progress')">
                        <Button
                            v-if="detailsRow.status === 'pending'"
                            size="sm"
                            class="gap-1.5"
                            :disabled="statusUpdating === detailsRow.id"
                            @click="updateRowStatus(detailsRow, 'in_progress')"
                        >
                            <AppIcon name="play" class="size-3.5" />
                            Start
                        </Button>
                        <Button
                            v-if="detailsRow.status === 'in_progress'"
                            size="sm"
                            class="gap-1.5"
                            :disabled="statusUpdating === detailsRow.id"
                            @click="updateRowStatus(detailsRow, 'completed')"
                        >
                            <AppIcon name="check" class="size-3.5" />
                            Complete
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            class="gap-1.5 text-destructive hover:text-destructive"
                            :disabled="statusUpdating === detailsRow.id"
                            @click="updateRowStatus(detailsRow, 'cancelled')"
                        >
                            <AppIcon name="x" class="size-3.5" />
                            Cancel
                        </Button>
                    </template>
                    <Button variant="outline" size="sm" class="ml-auto" @click="detailsOpen = false">Close</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <!-- ── Create request dialog ──────────────────────────────────────────── -->
        <Dialog v-model:open="createOpen" @update:open="(v) => !v && resetCreateForm()">
            <DialogContent class="max-w-md">
                <DialogHeader>
                    <DialogTitle>New walk-in request</DialogTitle>
                    <DialogDescription>
                        Register a patient for a direct service at one of the care desks.
                    </DialogDescription>
                </DialogHeader>
                <div class="flex flex-col gap-4 py-2">
                    <!-- Patient -->
                    <div class="flex flex-col gap-1.5">
                        <Label for="create-patient">
                            Patient <span class="text-destructive">*</span>
                        </Label>
                        <PatientLookupField
                            :model-value="createForm.patientId"
                            input-id="create-patient"
                            label="Patient"
                            placeholder="Search patient…"
                            :error-message="createErrors.patientId ?? null"
                            @update:model-value="createForm.patientId = $event"
                        />
                        <p v-if="createErrors.patientId" class="text-xs text-destructive">{{ createErrors.patientId }}</p>
                    </div>

                    <!-- Department (patient destination) -->
                    <div class="flex w-full flex-col gap-1.5">
                        <Label>Department patient is sent to <span class="text-xs text-muted-foreground">(optional)</span></Label>
                        <Select
                            :model-value="createForm.departmentId || undefined"
                            :disabled="departmentOptionsLoading"
                            @update:model-value="createForm.departmentId = $event ? String($event) : ''"
                        >
                            <SelectTrigger
                                class="w-full"
                                :class="createErrors.departmentId ? 'border-destructive' : ''"
                            >
                                <SelectValue placeholder="Select department…" />
                            </SelectTrigger>
                            <SelectContent class="z-[80]">
                                <SelectItem
                                    v-for="opt in departmentOptions"
                                    :key="opt.value"
                                    :value="opt.value"
                                >
                                    {{ opt.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="createErrors.departmentId" class="text-xs text-destructive">{{ createErrors.departmentId }}</p>
                    </div>

                    <!-- Service desk -->
                    <div class="flex w-full flex-col gap-1.5">
                        <Label>Service desk <span class="text-destructive">*</span></Label>
                        <Select
                            :model-value="createForm.serviceType || undefined"
                            @update:model-value="createForm.serviceType = $event ? String($event) : ''"
                        >
                            <SelectTrigger
                                class="w-full"
                                :class="createErrors.serviceType ? 'border-destructive' : ''"
                            >
                                <SelectValue placeholder="Select desk…" />
                            </SelectTrigger>
                            <SelectContent class="z-[80]">
                                <SelectItem v-for="opt in serviceTypeCreateOptions" :key="opt.value" :value="opt.value">
                                    {{ opt.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="createErrors.serviceType" class="text-xs text-destructive">{{ createErrors.serviceType }}</p>
                    </div>

                    <!-- Priority -->
                    <div class="flex w-full flex-col gap-1.5">
                        <Label>Priority</Label>
                        <Select
                            :model-value="createForm.priority"
                            @update:model-value="createForm.priority = $event ? String($event) : 'routine'"
                        >
                            <SelectTrigger class="w-full">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent class="z-[80]">
                                <SelectItem value="routine">Routine</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <!-- Notes -->
                    <div class="flex flex-col gap-1.5">
                        <Label for="create-notes">
                            Notes <span class="text-xs text-muted-foreground">(optional)</span>
                        </Label>
                        <Textarea
                            id="create-notes"
                            v-model="createForm.notes"
                            placeholder="Any additional context…"
                            class="resize-none"
                            :rows="3"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" :disabled="createLoading" @click="createOpen = false">Cancel</Button>
                    <Button :disabled="createLoading" class="gap-2" @click="submitCreate()">
                        <AppIcon v-if="createLoading" name="refresh-cw" class="size-4 animate-spin" />
                        Create request
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- ── Filter sheet ────────────────────────────────────────────────────── -->
        <Sheet :open="filtersSheetOpen" @update:open="filtersSheetOpen = $event">
            <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                <SheetHeader class="shrink-0 border-b px-4 py-3 text-left">
                    <SheetTitle class="flex items-center gap-2">
                        <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                        Filter Requests
                    </SheetTitle>
                    <SheetDescription>Filter and sort walk-in service requests.</SheetDescription>
                </SheetHeader>
                <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div class="rounded-lg border p-3">
                        <div class="grid gap-3">
                            <div class="grid gap-2">
                                <Label for="filter-sheet-patient">Patient</Label>
                                <PatientLookupField
                                    :model-value="filters.patientId"
                                    input-id="filter-sheet-patient"
                                    label="Patient"
                                    placeholder="Search patient…"
                                    mode="filter"
                                    :per-page="8"
                                    @update:model-value="filters.patientId = $event"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label>Service desk</Label>
                                <Select :model-value="filters.serviceType" @update:model-value="filters.serviceType = $event">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="opt in serviceTypeOptions" :key="opt.value" :value="opt.value">
                                            {{ opt.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-2">
                                <Label>Priority</Label>
                                <Select :model-value="filters.priority" @update:model-value="filters.priority = $event">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="opt in priorityFilterOptions" :key="opt.value" :value="opt.value">
                                            {{ opt.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Separator />
                            <div class="grid gap-2">
                                <Label>Date range</Label>
                                <DateRangeFilterPopover
                                    input-base-id="filter-sheet-date"
                                    title="Requested date"
                                    :from="filters.from"
                                    :to="filters.to"
                                    @update:from="filters.from = $event"
                                    @update:to="filters.to = $event"
                                />
                            </div>
                            <Separator />
                            <div class="grid gap-2">
                                <Label>Results per page</Label>
                                <Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event)">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        <SelectItem value="100">100</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
                <SheetFooter class="gap-2 border-t px-4 py-3">
                    <Button
                        class="gap-1.5"
                        :disabled="loading"
                        @click="applyFilters(); filtersSheetOpen = false"
                    >
                        <AppIcon name="search" class="size-3.5" />
                        Apply Filters
                    </Button>
                    <Button variant="outline" @click="resetFilters()">
                        Reset Filters
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    </AppLayout>
</template>
