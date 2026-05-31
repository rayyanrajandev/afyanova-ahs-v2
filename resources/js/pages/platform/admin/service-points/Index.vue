<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AuditTimelineList from '@/components/audit/AuditTimelineList.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type StatusCounts = { active: number; inactive: number; other: number; total: number };
type Department = { id: string | null; code: string | null; name: string | null };
type ServicePoint = {
    id: string | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    servicePointType: string | null;
    location: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
};
type AuditLog = {
    id: string;
    actorId: number | null;
    actor?: { displayName?: string | null } | null;
    action: string | null;
    actionLabel?: string | null;
    createdAt: string | null;
};
type ApiError = { message?: string; errors?: Record<string, string[]> };
type ListResponse<T> = { data: T[]; meta: Pagination };
type ItemResponse<T> = { data: T };
type StatusResponse = { data: StatusCounts };
type AuditResponse = { data: AuditLog[]; meta: Pagination };
type ValidationErrors = Record<string, string[]>;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Facility setup', href: '/platform/admin/facility-config' },
    { title: 'Service points', href: '/platform/admin/service-points' },
];

const EMPTY_SELECT_VALUE = '__all__';

const servicePointTypeOptions: SearchableSelectOption[] = [
    {
        value: 'Outpatient',
        label: 'Outpatient',
        description: 'OPD counter, consultation room, or clinic bay.',
        group: 'Patient flow',
    },
    {
        value: 'Emergency',
        label: 'Emergency',
        description: 'Emergency department bay, triage, or resuscitation area.',
        group: 'Patient flow',
    },
    {
        value: 'Laboratory',
        label: 'Laboratory',
        description: 'Sample collection or bench service point.',
        group: 'Diagnostics',
    },
    {
        value: 'Radiology',
        label: 'Radiology',
        description: 'Imaging room or modality service point.',
        group: 'Diagnostics',
    },
    {
        value: 'Pharmacy',
        label: 'Pharmacy',
        description: 'Dispensing counter or satellite pharmacy.',
        group: 'Diagnostics',
    },
    {
        value: 'Theatre',
        label: 'Theatre',
        description: 'Operating theatre or procedure room.',
        group: 'Inpatient',
    },
    {
        value: 'Ward',
        label: 'Ward',
        description: 'Inpatient ward station or nursing desk.',
        group: 'Inpatient',
    },
    {
        value: 'Billing',
        label: 'Billing',
        description: 'Cashier, billing desk, or claims window.',
        group: 'Administration',
    },
    {
        value: 'Records',
        label: 'Records',
        description: 'Registration or medical records desk.',
        group: 'Administration',
    },
];

const { permissionState, scope } = usePlatformAccess();
const canRead = computed(() => permissionState('platform.resources.read') === 'allowed');
const canManage = computed(() => permissionState('platform.resources.manage-service-points') === 'allowed');
const canAudit = computed(() => permissionState('platform.resources.view-audit-logs') === 'allowed');
const canDepartmentRead = computed(() => permissionState('departments.read') === 'allowed');
const registryReadOnly = computed(() => canRead.value && !canManage.value);

const workspaceIntroText = computed(() => {
    const base = `${counts.value.total} service points in facility scope`;
    return registryReadOnly.value
        ? `${base} · browse clinics, counters, and rooms used in patient flow`
        : `${base} · configure counters, rooms, and handoff locations for workflows`;
});

const loading = ref(true);
const listLoading = ref(false);
const errors = ref<string[]>([]);
const items = ref<ServicePoint[]>([]);
const pagination = ref<Pagination | null>(null);
const counts = ref<StatusCounts>({ active: 0, inactive: 0, other: 0, total: 0 });
const filters = reactive({ q: '', status: '', departmentId: '', servicePointType: '', page: 1, perPage: 20 });
const filtersSheetOpen = ref(false);

const departments = ref<Department[]>([]);
const departmentsLoading = ref(false);

const createOpen = ref(false);
const createLoading = ref(false);
const createRequestError = ref<string | null>(null);
const createFormErrors = ref<ValidationErrors>({});
const createForm = reactive({
    code: '',
    name: '',
    departmentId: '',
    servicePointType: '',
    location: '',
    notes: '',
});

const editOpen = ref(false);
const editLoading = ref(false);
const editTarget = ref<ServicePoint | null>(null);
const editRequestError = ref<string | null>(null);
const editFormErrors = ref<ValidationErrors>({});
const editForm = reactive({
    code: '',
    name: '',
    departmentId: '',
    servicePointType: '',
    location: '',
    notes: '',
});

const statusOpen = ref(false);
const statusLoading = ref(false);
const statusError = ref<string | null>(null);
const statusTarget = ref<'active' | 'inactive'>('active');
const statusReason = ref('');
const statusItem = ref<ServicePoint | null>(null);

const detailsOpen = ref(false);
const detailsServicePoint = ref<ServicePoint | null>(null);
const detailsSheetTab = ref('overview');
const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<AuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);

const filterCount = computed(() => {
    let count = 0;
    if (filters.q.trim()) count += 1;
    if (filters.status) count += 1;
    if (filters.departmentId) count += 1;
    if (filters.servicePointType.trim()) count += 1;
    if (filters.perPage !== 20) count += 1;
    return count;
});

const listFilterHintText = computed(() =>
    filterCount.value > 0 ? `${filterCount.value} filters applied` : 'Use filters for department, type, or page size',
);

const filterChips = computed(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];

    if (filters.q.trim()) {
        chips.push({
            key: 'q',
            label: `"${filters.q.trim()}"`,
            clear: () => {
                filters.q = '';
                filters.page = 1;
                void refreshPage();
            },
        });
    }
    if (filters.status) {
        chips.push({
            key: 'status',
            label: filters.status === 'active' ? 'Active' : 'Inactive',
            clear: () => {
                filters.status = '';
                filters.page = 1;
                void refreshPage();
            },
        });
    }
    if (filters.departmentId) {
        chips.push({
            key: 'departmentId',
            label: `Dept: ${departmentLabelById(filters.departmentId)}`,
            clear: () => {
                filters.departmentId = '';
                filters.page = 1;
                void refreshPage();
            },
        });
    }
    if (filters.servicePointType.trim()) {
        chips.push({
            key: 'servicePointType',
            label: filters.servicePointType.trim(),
            clear: () => {
                filters.servicePointType = '';
                filters.page = 1;
                void refreshPage();
            },
        });
    }
    if (filters.perPage !== 20) {
        chips.push({
            key: 'perPage',
            label: `${filters.perPage} per page`,
            clear: () => {
                filters.perPage = 20;
                filters.page = 1;
                void refreshPage();
            },
        });
    }

    return chips;
});

const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => {
    if (!pagination.value) return false;
    return pagination.value.currentPage < pagination.value.lastPage;
});

const paginationPageNumbers = computed((): (number | '...')[] => {
    const total = pagination.value?.lastPage ?? 1;
    const current = pagination.value?.currentPage ?? 1;
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
        pages.push(page);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
});

const departmentOptions = computed<SearchableSelectOption[]>(() =>
    departments.value
        .map((department) => {
            const value = String(department.id ?? '').trim();
            if (!value) return null;
            const label =
                department.code && department.name
                    ? `${department.code} - ${department.name}`
                    : department.name || department.code || value;
            return {
                value,
                label,
                description: department.code || undefined,
                keywords: [department.code, department.name].filter(Boolean) as string[],
            } satisfies SearchableSelectOption;
        })
        .filter((option): option is SearchableSelectOption => option !== null),
);

const createValidationMessages = computed(() => Object.values(createFormErrors.value).flat());
const editValidationMessages = computed(() => Object.values(editFormErrors.value).flat());

const detailsSheetTabGridClass = computed(() => (canAudit.value ? 'grid-cols-2' : 'grid-cols-1'));

function toSelectValue(value: string): string {
    return value.trim() === '' ? EMPTY_SELECT_VALUE : value;
}

function fromSelectValue(value: string): string {
    return value === EMPTY_SELECT_VALUE ? '' : value;
}

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

function fieldError(errorsMap: ValidationErrors, field: string): string | null {
    const messages = errorsMap[field];
    return messages?.[0] ?? null;
}

function applyValidationErrors(error: unknown, target: { value: ValidationErrors }) {
    const payload = error as ApiError;
    if (payload.errors && typeof payload.errors === 'object') {
        target.value = payload.errors;
    }
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === '') return;
        url.searchParams.set(key, String(value));
    });
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;
        body = JSON.stringify(options?.body ?? {});
    }
    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & {
            payload?: ApiError;
        };
        error.payload = payload;
        throw error;
    }
    return payload as T;
}

function labelOf(item: ServicePoint | null): string {
    if (!item) return 'Unknown service point';
    if (item.code && item.name) return `${item.code} - ${item.name}`;
    return item.name || item.code || item.id || 'Unknown service point';
}

function departmentLabelById(departmentId: string | null): string {
    const id = String(departmentId ?? '').trim();
    if (!id) return 'No department';
    const match = departments.value.find((department) => String(department.id ?? '') === id);
    if (!match) return id;
    if (match.code && match.name) return `${match.code} - ${match.name}`;
    return match.name || match.code || id;
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
}

function resetCreateForm() {
    createForm.code = '';
    createForm.name = '';
    createForm.departmentId = '';
    createForm.servicePointType = '';
    createForm.location = '';
    createForm.notes = '';
    createRequestError.value = null;
    createFormErrors.value = {};
}

function openCreateSheet() {
    resetCreateForm();
    createOpen.value = true;
}

function closeCreateSheet(open: boolean) {
    createOpen.value = open;
    if (!open) resetCreateForm();
}

function closeEditSheet(open: boolean) {
    editOpen.value = open;
    if (!open) {
        editTarget.value = null;
        editRequestError.value = null;
        editFormErrors.value = {};
    }
}

function openServicePointDetails(item: ServicePoint) {
    detailsServicePoint.value = item;
    detailsSheetTab.value = 'overview';
    detailsOpen.value = true;
    if (canAudit.value) {
        void loadAudit(item);
    } else {
        auditLogs.value = [];
        auditMeta.value = null;
        auditError.value = null;
        auditLoading.value = false;
    }
}

function closeServicePointDetails() {
    detailsOpen.value = false;
    detailsServicePoint.value = null;
    detailsSheetTab.value = 'overview';
    auditLogs.value = [];
    auditMeta.value = null;
    auditError.value = null;
    auditLoading.value = false;
}

async function loadDepartments() {
    if (!canDepartmentRead.value) {
        departments.value = [];
        return;
    }
    departmentsLoading.value = true;
    try {
        const response = await apiRequest<ListResponse<Department>>('GET', '/departments', {
            query: { page: 1, perPage: 100, sortBy: 'name', sortDir: 'asc', status: 'active' },
        });
        departments.value = response.data ?? [];
    } catch {
        departments.value = [];
    } finally {
        departmentsLoading.value = false;
    }
}

async function loadCounts() {
    if (!canRead.value) {
        counts.value = { active: 0, inactive: 0, other: 0, total: 0 };
        return;
    }
    try {
        const response = await apiRequest<StatusResponse>('GET', '/platform/admin/service-points/status-counts', {
            query: {
                q: filters.q.trim() || null,
                departmentId: filters.departmentId || null,
                servicePointType: filters.servicePointType.trim() || null,
            },
        });
        counts.value = response.data ?? { active: 0, inactive: 0, other: 0, total: 0 };
    } catch {
        counts.value = { active: 0, inactive: 0, other: 0, total: 0 };
    }
}

async function loadItems() {
    if (!canRead.value) {
        items.value = [];
        pagination.value = null;
        loading.value = false;
        listLoading.value = false;
        return;
    }
    listLoading.value = true;
    errors.value = [];
    try {
        const response = await apiRequest<ListResponse<ServicePoint>>('GET', '/platform/admin/service-points', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                departmentId: filters.departmentId || null,
                servicePointType: filters.servicePointType.trim() || null,
                page: filters.page,
                perPage: filters.perPage,
                sortBy: 'name',
                sortDir: 'asc',
            },
        });
        items.value = response.data ?? [];
        pagination.value = response.meta ?? null;
    } catch (error) {
        items.value = [];
        pagination.value = null;
        errors.value.push(messageFromUnknown(error, 'Unable to load service points.'));
    } finally {
        loading.value = false;
        listLoading.value = false;
    }
}

async function refreshPage() {
    await Promise.all([loadItems(), loadCounts()]);
}

async function createItem() {
    if (!canManage.value || createLoading.value) return;
    createLoading.value = true;
    createRequestError.value = null;
    createFormErrors.value = {};
    try {
        const response = await apiRequest<ItemResponse<ServicePoint>>('POST', '/platform/admin/service-points', {
            body: {
                code: createForm.code.trim(),
                name: createForm.name.trim(),
                departmentId: createForm.departmentId || null,
                servicePointType: createForm.servicePointType.trim() || null,
                location: createForm.location.trim() || null,
                notes: createForm.notes.trim() || null,
            },
        });
        notifySuccess(`Created ${labelOf(response.data)}.`);
        closeCreateSheet(false);
        filters.page = 1;
        await refreshPage();
    } catch (error) {
        applyValidationErrors(error, createFormErrors);
        createRequestError.value = messageFromUnknown(error, 'Unable to create service point.');
    } finally {
        createLoading.value = false;
    }
}

function openEdit(item: ServicePoint) {
    editTarget.value = item;
    editForm.code = item.code || '';
    editForm.name = item.name || '';
    editForm.departmentId = item.departmentId || '';
    editForm.servicePointType = item.servicePointType || '';
    editForm.location = item.location || '';
    editForm.notes = item.notes || '';
    editRequestError.value = null;
    editFormErrors.value = {};
    editOpen.value = true;
}

async function saveEdit() {
    const id = editTarget.value?.id?.trim();
    if (!id || !canManage.value || editLoading.value) return;
    editLoading.value = true;
    editRequestError.value = null;
    editFormErrors.value = {};
    try {
        const response = await apiRequest<ItemResponse<ServicePoint>>('PATCH', `/platform/admin/service-points/${id}`, {
            body: {
                code: editForm.code.trim(),
                name: editForm.name.trim(),
                departmentId: editForm.departmentId || null,
                servicePointType: editForm.servicePointType.trim() || null,
                location: editForm.location.trim() || null,
                notes: editForm.notes.trim() || null,
            },
        });
        notifySuccess('Service point updated.');
        if (detailsServicePoint.value?.id === id) {
            detailsServicePoint.value = response.data;
        }
        closeEditSheet(false);
        await refreshPage();
    } catch (error) {
        applyValidationErrors(error, editFormErrors);
        editRequestError.value = messageFromUnknown(error, 'Unable to update service point.');
    } finally {
        editLoading.value = false;
    }
}

function openStatus(item: ServicePoint, target: 'active' | 'inactive') {
    statusItem.value = item;
    statusTarget.value = target;
    statusReason.value = target === 'inactive' ? item.statusReason ?? '' : '';
    statusError.value = null;
    statusOpen.value = true;
}

async function saveStatus() {
    const id = statusItem.value?.id?.trim();
    if (!id || !canManage.value || statusLoading.value) return;
    if (statusTarget.value === 'inactive' && !statusReason.value.trim()) {
        statusError.value = 'Reason is required for inactivation.';
        return;
    }
    statusLoading.value = true;
    statusError.value = null;
    try {
        const response = await apiRequest<ItemResponse<ServicePoint>>(
            'PATCH',
            `/platform/admin/service-points/${id}/status`,
            {
                body: {
                    status: statusTarget.value,
                    reason: statusTarget.value === 'inactive' ? statusReason.value.trim() : null,
                },
            },
        );
        notifySuccess('Service point status updated.');
        if (detailsServicePoint.value?.id === id) {
            detailsServicePoint.value = response.data;
        }
        statusOpen.value = false;
        await refreshPage();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update service point status.');
    } finally {
        statusLoading.value = false;
    }
}

async function loadAudit(item: ServicePoint) {
    const id = item.id?.trim();
    if (!id || !canAudit.value) return;
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await apiRequest<AuditResponse>('GET', `/platform/admin/service-points/${id}/audit-logs`, {
            query: { page: 1, perPage: 20 },
        });
        auditLogs.value = response.data ?? [];
        auditMeta.value = response.meta ?? null;
    } catch (error) {
        auditLogs.value = [];
        auditMeta.value = null;
        auditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
    } finally {
        auditLoading.value = false;
    }
}

function search() {
    filters.page = 1;
    void refreshPage();
}

function reset() {
    filters.q = '';
    filters.status = '';
    filters.departmentId = '';
    filters.servicePointType = '';
    filters.perPage = 20;
    filters.page = 1;
    void refreshPage();
}

function applyFiltersFromSheet() {
    filtersSheetOpen.value = false;
    search();
}

function resetFiltersFromSheet() {
    filtersSheetOpen.value = false;
    reset();
}

function setStatus(status: '' | 'active' | 'inactive') {
    filters.status = status;
    filters.page = 1;
    void refreshPage();
}

function prevPage() {
    if (!canPrev.value) return;
    filters.page -= 1;
    void loadItems();
}

function nextPage() {
    if (!canNext.value) return;
    filters.page += 1;
    void loadItems();
}

function goToPage(page: number) {
    filters.page = page;
    void loadItems();
}

watch(detailsSheetTab, (tab) => {
    if (tab === 'audit' && detailsServicePoint.value && canAudit.value && auditLogs.value.length === 0 && !auditLoading.value) {
        void loadAudit(detailsServicePoint.value);
    }
});

onMounted(async () => {
    await Promise.all([loadDepartments(), refreshPage()]);
});
</script>

<template>
    <Head title="Service Points" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="map-pin" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">
                                    Service Point Registry
                                </h1>
                                <Badge
                                    v-if="registryReadOnly"
                                    variant="outline"
                                    class="h-5 px-1.5 text-[10px] font-medium"
                                >
                                    View only
                                </Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">{{ workspaceIntroText }}</p>
                            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">
                                        {{ scope?.facility?.name || 'No facility' }}
                                    </span>
                                </span>
                                <span class="select-none text-border" aria-hidden="true">·</span>
                                <span>{{ scope?.tenant?.name || 'No tenant' }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            :disabled="listLoading"
                            @click="refreshPage"
                        >
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                        </Button>
                        <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                            <AppIcon name="plus" class="size-3.5" />
                            Create service point
                        </Button>
                    </div>
                </div>
            </section>

            <Alert v-if="errors.length" variant="destructive">
                <AlertTitle>Request error</AlertTitle>
                <AlertDescription>
                    <p v-for="errorMessage in errors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p>
                </AlertDescription>
            </Alert>

            <Card v-if="canRead" class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                <div class="flex flex-col gap-3 border-b px-4 py-3">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div class="min-w-0">
                        <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                            <AppIcon name="layout-list" class="size-4 text-muted-foreground" />
                            Service points
                        </h3>
                        <p class="mt-1 text-xs text-muted-foreground">
                            {{ counts.total }} in scope · {{ listFilterHintText }}
                        </p>
                    </div>
                    <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-2xl">
                        <SearchInput
                            v-model="filters.q"
                            placeholder="Search code, name, or location"
                            class="min-w-0 flex-1 text-xs [&_input]:h-8"
                            @keyup.enter="search"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5 rounded-lg text-xs"
                            @click="filtersSheetOpen = true"
                        >
                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                            Filters
                            <Badge
                                v-if="filterCount > 0"
                                variant="secondary"
                                class="ml-1 h-5 px-1.5 text-[10px]"
                            >
                                {{ filterCount }}
                            </Badge>
                        </Button>
                    </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                            :class="{ 'border-primary bg-primary/5': filters.status === '' }"
                            @click="setStatus('')"
                        >
                            <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                            <span class="font-medium tabular-nums">{{ counts.total }}</span>
                            <span class="text-muted-foreground">All</span>
                        </button>
                        <button
                            type="button"
                            class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                            :class="{ 'border-primary bg-primary/5': filters.status === 'active' }"
                            @click="setStatus('active')"
                        >
                            <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            <span class="font-medium tabular-nums">{{ counts.active }}</span>
                            <span class="text-muted-foreground">Active</span>
                        </button>
                        <button
                            type="button"
                            class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                            :class="{ 'border-primary bg-primary/5': filters.status === 'inactive' }"
                            @click="setStatus('inactive')"
                        >
                            <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                            <span class="font-medium tabular-nums">{{ counts.inactive }}</span>
                            <span class="text-muted-foreground">Inactive</span>
                        </button>
                        <button
                            v-if="counts.other > 0"
                            type="button"
                            class="flex items-center gap-1.5 rounded-md border border-dashed bg-background px-2.5 py-1 text-xs text-muted-foreground"
                            disabled
                        >
                            <span class="font-medium tabular-nums">{{ counts.other }}</span>
                            <span>Other</span>
                        </button>
                    </div>
                </div>
                <div v-if="filterChips.length" class="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
                    <span class="text-[11px] text-muted-foreground">Filters:</span>
                    <button
                        v-for="chip in filterChips"
                        :key="chip.key"
                        type="button"
                        class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                        @click="chip.clear"
                    >
                        {{ chip.label }}
                        <AppIcon name="circle-x" class="size-3" />
                    </button>
                    <button
                        class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                        @click="reset"
                    >
                        Clear all
                    </button>
                </div>
                <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="min-h-[12rem]">
                            <div v-if="loading || listLoading" class="divide-y px-4">
                                <div
                                    v-for="index in 6"
                                    :key="`sp-skeleton-${index}`"
                                    class="flex items-center gap-3 py-3"
                                >
                                    <Skeleton class="size-2 shrink-0 rounded-full" />
                                    <div class="min-w-0 flex-1 space-y-2">
                                        <Skeleton class="h-4 w-48" />
                                        <Skeleton class="h-3.5 w-64 max-w-full" />
                                    </div>
                                    <Skeleton class="hidden h-5 w-14 shrink-0 rounded-full sm:block" />
                                    <Skeleton class="h-8 w-16 shrink-0 rounded-md" />
                                </div>
                            </div>
                            <div
                                v-else-if="items.length === 0"
                                class="flex flex-col items-center gap-3 px-4 py-10 text-center"
                            >
                                <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
                                    <AppIcon name="map-pin" class="size-4 text-muted-foreground" />
                                </div>
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">No service points found</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            filterCount > 0
                                                ? 'Adjust or clear filters to widen the registry.'
                                                : 'Create the first service point before routing patients and handoffs.'
                                        }}
                                    </p>
                                </div>
                                <div class="flex flex-wrap justify-center gap-2">
                                    <Button
                                        v-if="filterCount > 0"
                                        variant="outline"
                                        size="sm"
                                        class="h-8 gap-1.5"
                                        @click="reset"
                                    >
                                        <AppIcon name="x" class="size-3.5" />
                                        Clear filters
                                    </Button>
                                    <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                                        <AppIcon name="plus" class="size-3.5" />
                                        Create first service point
                                    </Button>
                                </div>
                            </div>
                            <div v-else class="divide-y px-4">
                                <div
                                    v-for="item in items"
                                    :key="item.id || item.code || item.name"
                                    class="flex items-center gap-3 py-3 transition-colors hover:bg-muted/30"
                                >
                                    <span
                                        class="size-2 shrink-0 rounded-full"
                                        :class="
                                            (item.status ?? '').toLowerCase() === 'active'
                                                ? 'bg-emerald-500'
                                                : 'bg-rose-500'
                                        "
                                        :title="(item.status ?? 'unknown').toString()"
                                    />
                                    <button
                                        type="button"
                                        class="min-w-0 flex-1 space-y-0.5 text-left"
                                        @click="openServicePointDetails(item)"
                                    >
                                        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <span
                                                class="truncate text-sm font-medium transition-colors hover:text-primary"
                                            >
                                                {{ item.name || labelOf(item) }}
                                            </span>
                                            <span class="shrink-0 text-xs text-muted-foreground">
                                                {{ item.code || 'No code' }}
                                            </span>
                                        </div>
                                        <p class="truncate text-xs text-muted-foreground">
                                            {{ item.servicePointType || 'Uncategorized' }}
                                            <span class="text-border"> · </span>
                                            {{ departmentLabelById(item.departmentId) }}
                                            <span class="text-border"> · </span>
                                            {{ item.location || 'No location recorded' }}
                                        </p>
                                    </button>
                                    <Badge :variant="statusVariant(item.status)" class="hidden shrink-0 sm:inline-flex">
                                        {{ item.status || 'unknown' }}
                                    </Badge>
                                    <div class="flex shrink-0 items-center gap-1.5">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            class="h-8 rounded-lg text-xs"
                                            @click="openServicePointDetails(item)"
                                        >
                                            Details
                                        </Button>
                                        <Button
                                            v-if="canManage"
                                            size="sm"
                                            variant="secondary"
                                            class="hidden h-8 rounded-lg text-xs sm:inline-flex"
                                            @click="openEdit(item)"
                                        >
                                            Edit
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <footer class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                        <p class="text-xs text-muted-foreground">
                            <template v-if="pagination">
                                Showing {{ items.length }} of {{ pagination.total }} · Page
                                {{ pagination.currentPage }} of {{ pagination.lastPage }}
                            </template>
                            <template v-else>No pagination data</template>
                        </p>
                        <div class="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                class="size-8"
                                :disabled="!canPrev || listLoading"
                                @click="prevPage"
                            >
                                <AppIcon name="chevron-left" class="size-4" />
                            </Button>
                            <template v-for="page in paginationPageNumbers" :key="String(page)">
                                <span v-if="page === '...'" class="px-1 text-xs text-muted-foreground">…</span>
                                <Button
                                    v-else
                                    :variant="page === pagination?.currentPage ? 'default' : 'ghost'"
                                    size="icon"
                                    class="size-8 text-xs"
                                    :disabled="listLoading"
                                    @click="goToPage(page as number)"
                                >
                                    {{ page }}
                                </Button>
                            </template>
                            <Button
                                variant="outline"
                                size="icon"
                                class="size-8"
                                :disabled="!canNext || listLoading"
                                @click="nextPage"
                            >
                                <AppIcon name="chevron-right" class="size-4" />
                            </Button>
                        </div>
                    </footer>
                </CardContent>
            </Card>

            <Card v-else class="rounded-lg border-sidebar-border/70">
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                        Service points
                    </CardTitle>
                    <CardDescription>Service point access is permission restricted.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertTitle>Access restricted</AlertTitle>
                        <AlertDescription>
                            Request <code>platform.resources.read</code> permission.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            <!-- Filters sheet -->
            <Sheet v-if="canRead" :open="filtersSheetOpen" @update:open="filtersSheetOpen = $event">
                <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                    <SheetHeader>
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            Service point filters
                        </SheetTitle>
                        <SheetDescription>Filter the registry without crowding the list.</SheetDescription>
                    </SheetHeader>
                    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="sp-filter-q">Search</Label>
                                    <Input
                                        id="sp-filter-q"
                                        v-model="filters.q"
                                        placeholder="Code, name, or location"
                                        @keyup.enter="applyFiltersFromSheet"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="sp-filter-status">Status</Label>
                                    <Select
                                        :model-value="toSelectValue(filters.status)"
                                        @update:model-value="filters.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))"
                                    >
                                        <SelectTrigger id="sp-filter-status" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <SearchableSelectField
                                    input-id="sp-filter-type"
                                    label="Service point type"
                                    v-model="filters.servicePointType"
                                    :options="servicePointTypeOptions"
                                    placeholder="All types"
                                    search-placeholder="Outpatient, lab, pharmacy..."
                                    empty-text="No matching type. Type a custom value."
                                    :allow-custom-value="true"
                                />
                                <SearchableSelectField
                                    input-id="sp-filter-department"
                                    label="Department"
                                    v-model="filters.departmentId"
                                    :options="departmentOptions"
                                    :disabled="departmentsLoading || !canDepartmentRead"
                                    :placeholder="departmentsLoading ? 'Loading departments...' : 'All departments'"
                                    search-placeholder="Search departments"
                                    empty-text="No department matched."
                                />
                                <Separator />
                                <div class="grid gap-2">
                                    <Label for="sp-filter-per-page">Results per page</Label>
                                    <Select
                                        :model-value="String(filters.perPage)"
                                        @update:model-value="filters.perPage = Number($event)"
                                    >
                                        <SelectTrigger id="sp-filter-per-page" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="20">20</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                            <SelectItem value="100">100</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <SheetFooter class="gap-2 border-t px-4 py-3">
                        <Button :disabled="listLoading" class="gap-1.5" @click="applyFiltersFromSheet">
                            <AppIcon name="search" class="size-3.5" />
                            Apply filters
                        </Button>
                        <Button variant="outline" :disabled="listLoading && filterCount === 0" @click="resetFiltersFromSheet">
                            Reset filters
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Details sheet -->
            <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeServicePointDetails())">
                <SheetContent side="right" variant="workspace" size="4xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader
                        v-if="detailsServicePoint"
                        class="shrink-0 border-b bg-background/95 px-4 py-3 pr-12 text-left sm:px-5"
                    >
                        <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2 text-base">
                            <AppIcon name="map-pin" class="size-5 text-muted-foreground" />
                            <span class="min-w-0 truncate">
                                {{ detailsServicePoint.name || labelOf(detailsServicePoint) }}
                            </span>
                            <Badge v-if="detailsServicePoint.code" variant="outline" class="shrink-0 font-normal">
                                {{ detailsServicePoint.code }}
                            </Badge>
                            <Badge :variant="statusVariant(detailsServicePoint.status)" class="shrink-0 capitalize">
                                {{ detailsServicePoint.status || 'unknown' }}
                            </Badge>
                        </SheetTitle>
                        <SheetDescription class="text-xs">
                            {{ detailsServicePoint.servicePointType || 'Uncategorized' }}
                            · {{ departmentLabelById(detailsServicePoint.departmentId) }}
                            · {{ detailsServicePoint.location || 'No location recorded' }}
                        </SheetDescription>
                    </SheetHeader>

                    <div v-if="detailsServicePoint" class="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <Tabs v-model="detailsSheetTab" class="flex h-full min-h-0 flex-col">
                            <div class="shrink-0 border-b bg-background px-4 py-2 sm:px-5">
                                <TabsList
                                    class="grid h-auto w-full gap-1 rounded-md bg-muted p-1"
                                    :class="detailsSheetTabGridClass"
                                >
                                    <TabsTrigger value="overview" class="h-9 gap-1.5 text-xs sm:text-sm">
                                        <AppIcon name="layout-grid" class="size-3.5" />
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger v-if="canAudit" value="audit" class="h-9 gap-1.5 text-xs sm:text-sm">
                                        <AppIcon name="file-text" class="size-3.5" />
                                        Audit
                                        <Badge
                                            v-if="auditMeta"
                                            variant="secondary"
                                            class="h-4 min-w-4 px-1 text-xs"
                                        >
                                            {{ auditMeta.total }}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                            <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                                <TabsContent value="overview" class="m-0 space-y-3 px-4 py-3 sm:px-5">
                                    <div
                                        v-if="
                                            detailsServicePoint.status &&
                                            detailsServicePoint.status.toLowerCase() !== 'active' &&
                                            detailsServicePoint.statusReason
                                        "
                                        class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs"
                                    >
                                        <AppIcon
                                            name="alert-triangle"
                                            class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                                        />
                                        <span class="text-amber-700 dark:text-amber-300">
                                            <span class="font-semibold capitalize">{{ detailsServicePoint.status }}</span
                                            >: {{ detailsServicePoint.statusReason }}
                                        </span>
                                    </div>
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    Identity
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Code</span>
                                                    <span class="font-medium">{{ detailsServicePoint.code || '—' }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Name</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{
                                                        detailsServicePoint.name || '—'
                                                    }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Type</span>
                                                    <span class="font-medium">{{
                                                        detailsServicePoint.servicePointType || 'Uncategorized'
                                                    }}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    Placement
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Department</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{
                                                        departmentLabelById(detailsServicePoint.departmentId)
                                                    }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Location</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{
                                                        detailsServicePoint.location || '—'
                                                    }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Status</span>
                                                    <Badge :variant="statusVariant(detailsServicePoint.status)" class="capitalize">
                                                        {{ detailsServicePoint.status || 'unknown' }}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                    <Card
                                        v-if="detailsServicePoint.notes"
                                        class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none"
                                    >
                                        <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                            <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                Notes
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent class="px-3 py-3 text-sm whitespace-pre-wrap">
                                            {{ detailsServicePoint.notes }}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                                <TabsContent v-if="canAudit" value="audit" class="m-0 px-4 py-3 sm:px-5">
                                    <Alert v-if="auditError" variant="destructive">
                                        <AlertTitle>Audit load issue</AlertTitle>
                                        <AlertDescription>{{ auditError }}</AlertDescription>
                                    </Alert>
                                    <div v-else-if="auditLoading" class="space-y-2">
                                        <Skeleton class="h-14 w-full" />
                                        <Skeleton class="h-14 w-full" />
                                    </div>
                                    <AuditTimelineList
                                        v-else
                                        :logs="auditLogs"
                                        :format-date-time="formatDateTime"
                                        empty-message="No audit logs found for this service point."
                                        actor-fallback-label="User"
                                    />
                                </TabsContent>
                            </ScrollArea>
                        </Tabs>
                    </div>

                    <SheetFooter
                        class="shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                        <Button variant="outline" size="sm" class="gap-1.5" @click="closeServicePointDetails">
                            <AppIcon name="circle-x" class="size-3.5" />
                            Close
                        </Button>
                        <div class="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button
                                v-if="canManage && detailsServicePoint"
                                size="sm"
                                :variant="
                                    (detailsServicePoint.status ?? '').toLowerCase() === 'active'
                                        ? 'outline'
                                        : 'secondary'
                                "
                                class="gap-1.5"
                                @click="
                                    openStatus(
                                        detailsServicePoint,
                                        (detailsServicePoint.status ?? '').toLowerCase() === 'active'
                                            ? 'inactive'
                                            : 'active',
                                    )
                                "
                            >
                                <AppIcon
                                    :name="
                                        (detailsServicePoint.status ?? '').toLowerCase() === 'active'
                                            ? 'ban'
                                            : 'circle-check'
                                    "
                                    class="size-3.5"
                                />
                                {{
                                    (detailsServicePoint.status ?? '').toLowerCase() === 'active'
                                        ? 'Deactivate'
                                        : 'Activate'
                                }}
                            </Button>
                            <Button
                                v-if="canManage && detailsServicePoint"
                                size="sm"
                                variant="outline"
                                class="gap-1.5"
                                @click="openEdit(detailsServicePoint)"
                            >
                                <AppIcon name="pencil" class="size-3.5" />
                                Edit service point
                            </Button>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Create sheet -->
            <Sheet :open="createOpen" @update:open="closeCreateSheet">
                <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="map-pin" class="size-5 text-muted-foreground" />
                            Create service point
                        </SheetTitle>
                        <SheetDescription>
                            Register a counter, room, or desk used in appointments, handoffs, and clinical workflows.
                        </SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="grid gap-4 px-6 py-4">
                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Identity</legend>
                                <div class="grid gap-2">
                                    <Label for="create-sp-code">Code</Label>
                                    <Input
                                        id="create-sp-code"
                                        v-model="createForm.code"
                                        :disabled="createLoading"
                                        placeholder="OPD-01, LAB-COLLECT"
                                        :class="{ 'border-destructive': fieldError(createFormErrors, 'code') }"
                                    />
                                    <p v-if="fieldError(createFormErrors, 'code')" class="text-xs text-destructive">
                                        {{ fieldError(createFormErrors, 'code') }}
                                    </p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-sp-name">Name</Label>
                                    <Input
                                        id="create-sp-name"
                                        v-model="createForm.name"
                                        :disabled="createLoading"
                                        placeholder="Outpatient counter 1"
                                        :class="{ 'border-destructive': fieldError(createFormErrors, 'name') }"
                                    />
                                    <p v-if="fieldError(createFormErrors, 'name')" class="text-xs text-destructive">
                                        {{ fieldError(createFormErrors, 'name') }}
                                    </p>
                                </div>
                                <div class="sm:col-span-2">
                                    <SearchableSelectField
                                        input-id="create-sp-type"
                                        label="Service point type"
                                        v-model="createForm.servicePointType"
                                        :options="servicePointTypeOptions"
                                        placeholder="Select or type"
                                        :allow-custom-value="true"
                                        :disabled="createLoading"
                                        :error-message="fieldError(createFormErrors, 'servicePointType')"
                                    />
                                </div>
                            </fieldset>
                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Placement</legend>
                                <div class="sm:col-span-2">
                                    <SearchableSelectField
                                        input-id="create-sp-department"
                                        label="Department"
                                        v-model="createForm.departmentId"
                                        :options="departmentOptions"
                                        :disabled="createLoading || departmentsLoading || !canDepartmentRead"
                                        placeholder="Optional department link"
                                        empty-text="No department matched."
                                    />
                                </div>
                                <div class="sm:col-span-2 grid gap-2">
                                    <Label for="create-sp-location">Location</Label>
                                    <Input
                                        id="create-sp-location"
                                        v-model="createForm.location"
                                        :disabled="createLoading"
                                        placeholder="Building, floor, wing"
                                    />
                                </div>
                                <div class="sm:col-span-2 grid gap-2">
                                    <Label for="create-sp-notes">Notes</Label>
                                    <Textarea
                                        id="create-sp-notes"
                                        v-model="createForm.notes"
                                        class="min-h-20"
                                        :disabled="createLoading"
                                        placeholder="Handoff notes, hours, or scope"
                                    />
                                </div>
                            </fieldset>
                        </div>
                    </ScrollArea>
                    <Alert
                        v-if="createRequestError || createValidationMessages.length"
                        variant="destructive"
                        class="mx-4 mb-3 shrink-0"
                    >
                        <AlertTitle>Create service point needs attention</AlertTitle>
                        <AlertDescription class="space-y-2">
                            <p v-if="createRequestError">{{ createRequestError }}</p>
                            <ul v-if="createValidationMessages.length" class="list-disc space-y-1 pl-4">
                                <li
                                    v-for="message in createValidationMessages"
                                    :key="message"
                                    class="text-xs leading-5"
                                >
                                    {{ message }}
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>
                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button type="button" variant="outline" :disabled="createLoading" @click="closeCreateSheet(false)">
                            Cancel
                        </Button>
                        <Button type="button" :disabled="createLoading" class="gap-1.5" @click="createItem">
                            <AppIcon name="plus" class="size-3.5" />
                            {{ createLoading ? 'Creating...' : 'Create service point' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Edit sheet -->
            <Sheet :open="editOpen" @update:open="closeEditSheet">
                <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="pencil" class="size-5 text-muted-foreground" />
                            Edit service point
                        </SheetTitle>
                        <SheetDescription v-if="editTarget">{{ labelOf(editTarget) }}</SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="grid gap-4 px-6 py-4">
                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Identity</legend>
                                <div class="grid gap-2">
                                    <Label for="edit-sp-code">Code</Label>
                                    <Input
                                        id="edit-sp-code"
                                        v-model="editForm.code"
                                        :disabled="editLoading"
                                        :class="{ 'border-destructive': fieldError(editFormErrors, 'code') }"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="edit-sp-name">Name</Label>
                                    <Input
                                        id="edit-sp-name"
                                        v-model="editForm.name"
                                        :disabled="editLoading"
                                        :class="{ 'border-destructive': fieldError(editFormErrors, 'name') }"
                                    />
                                </div>
                                <div class="sm:col-span-2">
                                    <SearchableSelectField
                                        input-id="edit-sp-type"
                                        label="Service point type"
                                        v-model="editForm.servicePointType"
                                        :options="servicePointTypeOptions"
                                        :allow-custom-value="true"
                                        :disabled="editLoading"
                                        :error-message="fieldError(editFormErrors, 'servicePointType')"
                                    />
                                </div>
                            </fieldset>
                            <fieldset class="grid gap-3 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Placement</legend>
                                <SearchableSelectField
                                    input-id="edit-sp-department"
                                    label="Department"
                                    v-model="editForm.departmentId"
                                    :options="departmentOptions"
                                    :disabled="editLoading || departmentsLoading || !canDepartmentRead"
                                />
                                <div class="grid gap-2">
                                    <Label for="edit-sp-location">Location</Label>
                                    <Input id="edit-sp-location" v-model="editForm.location" :disabled="editLoading" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="edit-sp-notes">Notes</Label>
                                    <Textarea
                                        id="edit-sp-notes"
                                        v-model="editForm.notes"
                                        class="min-h-20"
                                        :disabled="editLoading"
                                    />
                                </div>
                            </fieldset>
                        </div>
                    </ScrollArea>
                    <Alert
                        v-if="editRequestError || editValidationMessages.length"
                        variant="destructive"
                        class="mx-4 mb-3 shrink-0"
                    >
                        <AlertTitle>Update service point needs attention</AlertTitle>
                        <AlertDescription>
                            <p v-if="editRequestError">{{ editRequestError }}</p>
                            <ul v-if="editValidationMessages.length" class="list-disc space-y-1 pl-4">
                                <li v-for="message in editValidationMessages" :key="message" class="text-xs">
                                    {{ message }}
                                </li>
                            </ul>
                        </AlertDescription>
                    </Alert>
                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button type="button" variant="outline" :disabled="editLoading" @click="closeEditSheet(false)">
                            Cancel
                        </Button>
                        <Button type="button" :disabled="editLoading" class="gap-1.5" @click="saveEdit">
                            <AppIcon name="save" class="size-3.5" />
                            {{ editLoading ? 'Saving...' : 'Save changes' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Status dialog -->
            <Dialog :open="statusOpen" @update:open="(open) => (statusOpen = open)">
                <DialogContent variant="action" size="lg">
                    <DialogHeader>
                        <DialogTitle>
                            {{ statusTarget === 'inactive' ? 'Deactivate service point' : 'Activate service point' }}
                        </DialogTitle>
                        <DialogDescription>
                            {{
                                statusTarget === 'inactive'
                                    ? 'Reason is required before deactivating.'
                                    : 'Confirm activation of this service point.'
                            }}
                        </DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="statusError" variant="destructive">
                            <AlertTitle>Status update failed</AlertTitle>
                            <AlertDescription>{{ statusError }}</AlertDescription>
                        </Alert>
                        <div v-if="statusTarget === 'inactive'" class="grid gap-2">
                            <Label for="sp-status-reason">Reason</Label>
                            <Textarea
                                id="sp-status-reason"
                                v-model="statusReason"
                                class="min-h-20"
                                placeholder="Required reason for deactivation"
                            />
                        </div>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" :disabled="statusLoading" @click="statusOpen = false">Cancel</Button>
                        <Button :disabled="statusLoading" @click="saveStatus">
                            {{ statusLoading ? 'Saving...' : 'Confirm' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
