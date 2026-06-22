<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import AuditTimelineList from '@/components/audit/AuditTimelineList.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
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
import { formatEnumLabel } from '@/lib/labels';
import { activeInactiveStatusDotClass } from '@/lib/listRows';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type StatusCounts = { active: number; inactive: number; other: number; total: number };
type Department = { id: string | null; code: string | null; name: string | null };
type WardBed = {
    id: string | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    wardName: string | null;
    bedNumber: string | null;
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
    { title: 'Ward/Bed Registry', href: '/platform/admin/ward-beds' },
];

const EMPTY_SELECT_VALUE = '__all__';

const { permissionState, scope } = usePlatformAccess();
const canRead = computed(() => permissionState('platform.resources.read') === 'allowed');
const canManage = computed(() => permissionState('platform.resources.manage-ward-beds') === 'allowed');
const canAudit = computed(() => permissionState('platform.resources.view-audit-logs') === 'allowed');
const canDepartmentRead = computed(() => permissionState('departments.read') === 'allowed');
const registryReadOnly = computed(() => canRead.value && !canManage.value);

const workspaceIntroText = computed(() => {
    const base = `${counts.value.total} ward and bed resources in facility scope`;

    return registryReadOnly.value
        ? `${base} · browse inpatient placement resources for admissions and transfers`
        : `${base} · maintain ward names, bed numbers, and department linkage`;
});

const loading = ref(true);
const listLoading = ref(false);
const errors = ref<string[]>([]);
const items = ref<WardBed[]>([]);
const pagination = ref<Pagination | null>(null);
const counts = ref<StatusCounts>({ active: 0, inactive: 0, other: 0, total: 0 });
const filters = reactive({ q: '', status: '', departmentId: '', wardName: '', page: 1, perPage: 20 });
const filtersSheetOpen = ref(false);

const departments = ref<Department[]>([]);
const departmentsLoading = ref(false);

const createSheetOpen = ref(false);
const createLoading = ref(false);
const createRequestError = ref<string | null>(null);
const createFormErrors = ref<ValidationErrors>({});
const createForm = reactive({
    code: '',
    name: '',
    departmentId: '',
    wardName: '',
    bedNumber: '',
    location: '',
    notes: '',
});

const editSheetOpen = ref(false);
const editLoading = ref(false);
const editTarget = ref<WardBed | null>(null);
const editRequestError = ref<string | null>(null);
const editFormErrors = ref<ValidationErrors>({});
const editForm = reactive({
    code: '',
    name: '',
    departmentId: '',
    wardName: '',
    bedNumber: '',
    location: '',
    notes: '',
});

const statusOpen = ref(false);
const statusLoading = ref(false);
const statusError = ref<string | null>(null);
const statusTarget = ref<'active' | 'inactive'>('active');
const statusReason = ref('');
const statusItem = ref<WardBed | null>(null);

const detailsOpen = ref(false);
const detailsWardBed = ref<WardBed | null>(null);
const detailsSheetTab = ref<'overview' | 'audit'>('overview');
const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<AuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);

const filterCount = computed(() => {
    let count = 0;
    if (filters.q.trim()) count += 1;
    if (filters.status) count += 1;
    if (filters.departmentId) count += 1;
    if (filters.wardName.trim()) count += 1;
    if (filters.perPage !== 20) count += 1;
    return count;
});

const listFilterHintText = computed(() =>
    filterCount.value > 0 ? `${filterCount.value} filters applied` : 'Use filters for ward, department, or page size',
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
            label: formatEnumLabel(filters.status),
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
    if (filters.wardName.trim()) {
        chips.push({
            key: 'wardName',
            label: `Ward: ${filters.wardName.trim()}`,
            clear: () => {
                filters.wardName = '';
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
    return errorsMap[field]?.[0] ?? null;
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

function labelOf(item: WardBed | null): string {
    if (!item) return 'Unknown ward/bed';
    if (item.code && item.name) return `${item.code} - ${item.name}`;
    return item.name || item.code || item.id || 'Unknown ward/bed';
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
    createForm.wardName = '';
    createForm.bedNumber = '';
    createForm.location = '';
    createForm.notes = '';
    createRequestError.value = null;
    createFormErrors.value = {};
}

function openCreateSheet() {
    resetCreateForm();
    createSheetOpen.value = true;
}

function closeCreateSheet(open: boolean) {
    createSheetOpen.value = open;
    if (!open) resetCreateForm();
}

function closeEditSheet(open: boolean) {
    editSheetOpen.value = open;
    if (!open) {
        editTarget.value = null;
        editRequestError.value = null;
        editFormErrors.value = {};
    }
}

function openWardBedDetails(item: WardBed) {
    detailsWardBed.value = item;
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

function closeWardBedDetails() {
    detailsOpen.value = false;
    detailsWardBed.value = null;
    auditLogs.value = [];
    auditMeta.value = null;
    auditError.value = null;
    auditLoading.value = false;
}

async function loadDepartments() {
    if (!canDepartmentRead.value) return;
    departmentsLoading.value = true;
    try {
        const response = await apiRequest<ListResponse<Department>>('GET', '/departments', {
            query: { page: 1, perPage: 100, sortBy: 'name', sortDir: 'asc' },
        });
        departments.value = response.data ?? [];
    } catch {
        departments.value = [];
    } finally {
        departmentsLoading.value = false;
    }
}

async function loadCounts() {
    if (!canRead.value) return;
    try {
        const response = await apiRequest<StatusResponse>('GET', '/platform/admin/ward-beds/status-counts', {
            query: {
                q: filters.q.trim() || null,
                departmentId: filters.departmentId || null,
                wardName: filters.wardName.trim() || null,
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
        const response = await apiRequest<ListResponse<WardBed>>('GET', '/platform/admin/ward-beds', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                departmentId: filters.departmentId || null,
                wardName: filters.wardName.trim() || null,
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
        errors.value.push(messageFromUnknown(error, 'Unable to load ward/bed resources.'));
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
        const response = await apiRequest<ItemResponse<WardBed>>('POST', '/platform/admin/ward-beds', {
            body: {
                code: createForm.code.trim(),
                name: createForm.name.trim(),
                departmentId: createForm.departmentId || null,
                wardName: createForm.wardName.trim(),
                bedNumber: createForm.bedNumber.trim(),
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
        createRequestError.value = messageFromUnknown(error, 'Unable to create ward/bed resource.');
    } finally {
        createLoading.value = false;
    }
}

function openEdit(item: WardBed) {
    editTarget.value = item;
    editForm.code = item.code || '';
    editForm.name = item.name || '';
    editForm.departmentId = item.departmentId || '';
    editForm.wardName = item.wardName || '';
    editForm.bedNumber = item.bedNumber || '';
    editForm.location = item.location || '';
    editForm.notes = item.notes || '';
    editRequestError.value = null;
    editFormErrors.value = {};
    editSheetOpen.value = true;
}

async function saveEdit() {
    const id = editTarget.value?.id?.trim();
    if (!id || !canManage.value || editLoading.value) return;
    editLoading.value = true;
    editRequestError.value = null;
    editFormErrors.value = {};
    try {
        const response = await apiRequest<ItemResponse<WardBed>>('PATCH', `/platform/admin/ward-beds/${id}`, {
            body: {
                code: editForm.code.trim(),
                name: editForm.name.trim(),
                departmentId: editForm.departmentId || null,
                wardName: editForm.wardName.trim(),
                bedNumber: editForm.bedNumber.trim(),
                location: editForm.location.trim() || null,
                notes: editForm.notes.trim() || null,
            },
        });
        notifySuccess('Ward/bed resource updated.');
        if (detailsWardBed.value?.id === id) {
            detailsWardBed.value = response.data;
        }
        closeEditSheet(false);
        await refreshPage();
    } catch (error) {
        applyValidationErrors(error, editFormErrors);
        editRequestError.value = messageFromUnknown(error, 'Unable to update ward/bed resource.');
    } finally {
        editLoading.value = false;
    }
}

function openStatus(item: WardBed, target: 'active' | 'inactive') {
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
        const response = await apiRequest<ItemResponse<WardBed>>('PATCH', `/platform/admin/ward-beds/${id}/status`, {
            body: {
                status: statusTarget.value,
                reason: statusTarget.value === 'inactive' ? statusReason.value.trim() : null,
            },
        });
        notifySuccess('Ward/bed status updated.');
        if (detailsWardBed.value?.id === id) {
            detailsWardBed.value = response.data;
        }
        statusOpen.value = false;
        await refreshPage();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update ward/bed status.');
    } finally {
        statusLoading.value = false;
    }
}

async function loadAudit(item: WardBed) {
    const id = item.id?.trim();
    if (!id || !canAudit.value) return;
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await apiRequest<AuditResponse>('GET', `/platform/admin/ward-beds/${id}/audit-logs`, {
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
    filters.wardName = '';
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
    if (tab === 'audit' && detailsWardBed.value && canAudit.value && auditLogs.value.length === 0 && !auditLoading.value) {
        void loadAudit(detailsWardBed.value);
    }
});

onMounted(async () => {
    await Promise.all([loadDepartments(), refreshPage()]);
});
</script>

<template>
    <Head title="Ward/Bed Registry" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="bed-double" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">Ward/Bed Registry</h1>
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
                                    <span class="font-medium text-foreground">{{ scope?.facility?.name || 'No facility' }}</span>
                                </span>
                                <span class="select-none text-border" aria-hidden="true">·</span>
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
                            Create ward/bed
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

            <div class="flex min-w-0 flex-col gap-4">
                <Card v-if="canRead" class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <div class="flex flex-col gap-3 border-b px-4 py-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="bed-double" class="size-4 text-primary" />
                                    Ward and bed resources
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{ counts.total }} in scope · {{ listFilterHintText }}
                                </p>
                            </div>
                            <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-2xl">
                                <SearchInput
                                    v-model="filters.q"
                                    placeholder="Search code, name, ward, or location"
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
                                    <Badge v-if="filterCount > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
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
                        <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="reset">
                            Clear all
                        </button>
                    </div>
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem]">
                                <RegistryListSkeleton v-if="loading || listLoading" :count="6" />
                                <div v-else-if="items.length === 0" class="flex flex-col items-center gap-3 px-4 py-10 text-center">
                                    <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
                                        <AppIcon name="bed-double" class="size-4 text-muted-foreground" />
                                    </div>
                                    <div class="space-y-1">
                                        <p class="text-sm font-medium">No ward/bed resources found</p>
                                        <p class="text-xs text-muted-foreground">
                                            {{
                                                filterCount > 0
                                                    ? 'Adjust or clear filters to widen the registry.'
                                                    : 'Create the first ward or bed before assigning admissions.'
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
                                            Create ward/bed
                                        </Button>
                                    </div>
                                </div>
                                <div v-else class="divide-y px-4">
                                    <RegistryListRow
                                        v-for="item in items"
                                        :key="item.id || item.code || item.name"
                                        :status-dot-class="activeInactiveStatusDotClass(item.status)"
                                        :status-title="(item.status ?? 'unknown').toString()"
                                        @select="openWardBedDetails(item)"
                                    >
                                        <template #title>
                                            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <span class="truncate text-sm font-medium transition-colors hover:text-primary">
                                                    {{ item.name || labelOf(item) }}
                                                </span>
                                                <span class="shrink-0 text-xs text-muted-foreground">
                                                    {{ item.code || 'No code' }}
                                                </span>
                                            </div>
                                        </template>
                                        <template #meta>
                                            <p class="truncate text-xs text-muted-foreground">
                                                Ward {{ item.wardName || 'N/A' }}
                                                <span class="text-border"> · </span>
                                                Bed {{ item.bedNumber || 'N/A' }}
                                                <span class="text-border"> · </span>
                                                {{ departmentLabelById(item.departmentId) }}
                                                <span class="text-border"> · </span>
                                                {{ item.location || 'No location recorded' }}
                                            </p>
                                        </template>
                                        <template #badges>
                                            <Badge :variant="statusVariant(item.status)" class="capitalize">
                                                {{ formatEnumLabel(item.status) }}
                                            </Badge>
                                        </template>
                                        <template #actions>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                class="h-8 rounded-lg text-xs"
                                                @click="openWardBedDetails(item)"
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
                                        </template>
                                    </RegistryListRow>
                                </div>
                            </div>
                        </ScrollArea>
                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                            <p class="text-xs text-muted-foreground">
                                <template v-if="pagination">
                                    Showing {{ items.length }} of {{ pagination.total }} · Page {{ pagination.currentPage }} of
                                    {{ pagination.lastPage }}
                                </template>
                                <template v-else>No pagination data</template>
                            </p>
                            <div class="flex items-center gap-1">
                                <Button variant="outline" size="icon" class="size-8" :disabled="!canPrev || listLoading" @click="prevPage">
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
                                <Button variant="outline" size="icon" class="size-8" :disabled="!canNext || listLoading" @click="nextPage">
                                    <AppIcon name="chevron-right" class="size-4" />
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>

                <Card v-else class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="bed-double" class="size-5 text-muted-foreground" />
                            Ward and bed resources
                        </CardTitle>
                        <CardDescription>Ward/bed access is permission restricted.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle>Access restricted</AlertTitle>
                            <AlertDescription>Request <code>platform.resources.read</code> permission.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <Sheet v-if="canRead" :open="filtersSheetOpen" @update:open="filtersSheetOpen = $event">
                    <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                        <SheetHeader>
                            <SheetTitle class="flex items-center gap-2">
                                <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                Ward/bed filters
                            </SheetTitle>
                            <SheetDescription>Filter the registry without crowding the list.</SheetDescription>
                        </SheetHeader>
                        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                            <div class="rounded-lg border p-3">
                                <div class="grid gap-3">
                                    <div class="grid gap-2">
                                        <Label for="wb-filter-q">Search</Label>
                                        <Input
                                            id="wb-filter-q"
                                            v-model="filters.q"
                                            placeholder="Code, name, ward, location"
                                            @keyup.enter="applyFiltersFromSheet"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="wb-filter-status">Status</Label>
                                        <Select
                                            :model-value="toSelectValue(filters.status)"
                                            @update:model-value="filters.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))"
                                        >
                                            <SelectTrigger id="wb-filter-status" class="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="inactive">Inactive</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="wb-filter-ward">Ward name</Label>
                                        <Input id="wb-filter-ward" v-model="filters.wardName" placeholder="e.g. Ward A, ICU" />
                                    </div>
                                    <SearchableSelectField
                                        input-id="wb-filter-department"
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
                                        <Label for="wb-filter-per-page">Results per page</Label>
                                        <Select
                                            :model-value="String(filters.perPage)"
                                            @update:model-value="filters.perPage = Number($event)"
                                        >
                                            <SelectTrigger id="wb-filter-per-page" class="w-full">
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

                <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeWardBedDetails())">
                    <SheetContent side="right" variant="workspace" size="4xl" class="flex h-full min-h-0 flex-col">
                        <SheetHeader
                            v-if="detailsWardBed"
                            class="shrink-0 border-b bg-background/95 px-4 py-3 pr-12 text-left sm:px-5"
                        >
                            <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2 text-base">
                                <AppIcon name="bed-double" class="size-5 text-muted-foreground" />
                                <span class="min-w-0 truncate">{{ detailsWardBed.name || labelOf(detailsWardBed) }}</span>
                                <Badge v-if="detailsWardBed.code" variant="outline" class="shrink-0 font-normal">{{ detailsWardBed.code }}</Badge>
                                <Badge :variant="statusVariant(detailsWardBed.status)" class="shrink-0 capitalize">
                                    {{ formatEnumLabel(detailsWardBed.status) }}
                                </Badge>
                            </SheetTitle>
                            <SheetDescription class="text-xs">
                                Ward {{ detailsWardBed.wardName || 'N/A' }} · Bed {{ detailsWardBed.bedNumber || 'N/A' }} ·
                                {{ departmentLabelById(detailsWardBed.departmentId) }} ·
                                {{ detailsWardBed.location || 'No location recorded' }}
                            </SheetDescription>
                        </SheetHeader>

                        <div v-if="detailsWardBed" class="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <Tabs v-model="detailsSheetTab" class="flex h-full min-h-0 flex-col">
                                <div class="shrink-0 border-b bg-background px-4 py-2 sm:px-5">
                                    <TabsList class="grid h-auto w-full gap-1 rounded-md bg-muted p-1" :class="detailsSheetTabGridClass">
                                        <TabsTrigger value="overview" class="h-9 gap-1.5 text-xs sm:text-sm">
                                            <AppIcon name="layout-grid" class="size-3.5" />
                                            Overview
                                        </TabsTrigger>
                                        <TabsTrigger v-if="canAudit" value="audit" class="h-9 gap-1.5 text-xs sm:text-sm">
                                            <AppIcon name="file-text" class="size-3.5" />
                                            Audit
                                            <Badge v-if="auditMeta" variant="secondary" class="h-4 min-w-4 px-1 text-xs">
                                                {{ auditMeta.total }}
                                            </Badge>
                                        </TabsTrigger>
                                    </TabsList>
                                </div>
                                <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                                    <TabsContent value="overview" class="m-0 space-y-3 px-4 py-3 sm:px-5">
                                        <div
                                            v-if="
                                                detailsWardBed.status &&
                                                detailsWardBed.status.toLowerCase() !== 'active' &&
                                                detailsWardBed.statusReason
                                            "
                                            class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs"
                                        >
                                            <AppIcon name="alert-triangle" class="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                                            <span class="text-amber-700 dark:text-amber-300">
                                                <span class="font-semibold capitalize">{{ detailsWardBed.status }}</span
                                                >: {{ detailsWardBed.statusReason }}
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
                                                        <span class="font-medium">{{ detailsWardBed.code || '—' }}</span>
                                                    </div>
                                                    <div class="flex justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Name</span>
                                                        <span class="max-w-[14rem] truncate text-right font-medium">{{
                                                            detailsWardBed.name || '—'
                                                        }}</span>
                                                    </div>
                                                    <div class="flex justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Ward</span>
                                                        <span class="font-medium">{{ detailsWardBed.wardName || '—' }}</span>
                                                    </div>
                                                    <div class="flex justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Bed</span>
                                                        <span class="font-medium">{{ detailsWardBed.bedNumber || '—' }}</span>
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
                                                            departmentLabelById(detailsWardBed.departmentId)
                                                        }}</span>
                                                    </div>
                                                    <div class="flex justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Location</span>
                                                        <span class="max-w-[14rem] truncate text-right font-medium">{{
                                                            detailsWardBed.location || '—'
                                                        }}</span>
                                                    </div>
                                                    <div class="flex justify-between gap-4 py-2">
                                                        <span class="text-muted-foreground">Status</span>
                                                        <Badge :variant="statusVariant(detailsWardBed.status)" class="capitalize">
                                                            {{ formatEnumLabel(detailsWardBed.status) }}
                                                        </Badge>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                        <Card
                                            v-if="detailsWardBed.notes"
                                            class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none"
                                        >
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Notes</CardTitle>
                                            </CardHeader>
                                            <CardContent class="px-3 py-3 text-sm whitespace-pre-wrap">{{ detailsWardBed.notes }}</CardContent>
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
                                            empty-message="No audit logs found for this ward/bed resource."
                                            actor-fallback-label="User"
                                        />
                                    </TabsContent>
                                </ScrollArea>
                            </Tabs>
                        </div>

                        <SheetFooter
                            class="shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                        >
                            <Button variant="outline" size="sm" class="gap-1.5" @click="closeWardBedDetails">
                                <AppIcon name="circle-x" class="size-3.5" />
                                Close
                            </Button>
                            <div class="flex flex-col-reverse gap-2 sm:flex-row">
                                <Button
                                    v-if="canManage && detailsWardBed"
                                    size="sm"
                                    :variant="
                                        (detailsWardBed.status ?? '').toLowerCase() === 'active' ? 'outline' : 'secondary'
                                    "
                                    class="gap-1.5"
                                    @click="
                                        openStatus(
                                            detailsWardBed,
                                            (detailsWardBed.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active',
                                        )
                                    "
                                >
                                    <AppIcon
                                        :name="
                                            (detailsWardBed.status ?? '').toLowerCase() === 'active'
                                                ? 'user-x'
                                                : 'circle-check-big'
                                        "
                                        class="size-3.5"
                                    />
                                    {{
                                        (detailsWardBed.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate'
                                    }}
                                </Button>
                                <Button v-if="canManage && detailsWardBed" size="sm" variant="outline" class="gap-1.5" @click="openEdit(detailsWardBed)">
                                    <AppIcon name="pencil" class="size-3.5" />
                                    Edit ward/bed
                                </Button>
                            </div>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                <Sheet v-if="canManage" :open="createSheetOpen" @update:open="closeCreateSheet">
                    <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                        <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                            <SheetTitle class="flex items-center gap-2">
                                <AppIcon name="bed-double" class="size-5 text-muted-foreground" />
                                Create ward/bed
                            </SheetTitle>
                            <SheetDescription>
                                Register a ward name and bed number for admissions, transfers, and inpatient workflows.
                            </SheetDescription>
                        </SheetHeader>
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="grid gap-4 px-6 py-4">
                                <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Identity</legend>
                                    <div class="grid gap-2">
                                        <Label for="create-wb-code">Code</Label>
                                        <Input
                                            id="create-wb-code"
                                            v-model="createForm.code"
                                            :disabled="createLoading"
                                            placeholder="WARD-A-01"
                                            :class="{ 'border-destructive': fieldError(createFormErrors, 'code') }"
                                        />
                                        <p v-if="fieldError(createFormErrors, 'code')" class="text-xs text-destructive">
                                            {{ fieldError(createFormErrors, 'code') }}
                                        </p>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="create-wb-name">Display name</Label>
                                        <Input
                                            id="create-wb-name"
                                            v-model="createForm.name"
                                            :disabled="createLoading"
                                            placeholder="Ward A Bed 1"
                                            :class="{ 'border-destructive': fieldError(createFormErrors, 'name') }"
                                        />
                                        <p v-if="fieldError(createFormErrors, 'name')" class="text-xs text-destructive">
                                            {{ fieldError(createFormErrors, 'name') }}
                                        </p>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="create-wb-ward">Ward name</Label>
                                        <Input
                                            id="create-wb-ward"
                                            v-model="createForm.wardName"
                                            :disabled="createLoading"
                                            placeholder="Ward A"
                                            :class="{ 'border-destructive': fieldError(createFormErrors, 'wardName') }"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="create-wb-bed">Bed number</Label>
                                        <Input
                                            id="create-wb-bed"
                                            v-model="createForm.bedNumber"
                                            :disabled="createLoading"
                                            placeholder="01"
                                            :class="{ 'border-destructive': fieldError(createFormErrors, 'bedNumber') }"
                                        />
                                    </div>
                                </fieldset>
                                <fieldset class="grid gap-3 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Placement</legend>
                                    <SearchableSelectField
                                        input-id="create-wb-department"
                                        label="Department"
                                        v-model="createForm.departmentId"
                                        :options="departmentOptions"
                                        :disabled="createLoading || departmentsLoading || !canDepartmentRead"
                                        placeholder="Optional department link"
                                        empty-text="No department matched."
                                    />
                                    <div class="grid gap-2">
                                        <Label for="create-wb-location">Location</Label>
                                        <Input
                                            id="create-wb-location"
                                            v-model="createForm.location"
                                            :disabled="createLoading"
                                            placeholder="Building, floor, wing"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="create-wb-notes">Notes</Label>
                                        <Textarea
                                            id="create-wb-notes"
                                            v-model="createForm.notes"
                                            class="min-h-20"
                                            :disabled="createLoading"
                                            placeholder="Isolation, gender, or equipment notes"
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
                            <AlertTitle>Create ward/bed needs attention</AlertTitle>
                            <AlertDescription class="space-y-2">
                                <p v-if="createRequestError">{{ createRequestError }}</p>
                                <ul v-if="createValidationMessages.length" class="list-disc space-y-1 pl-4">
                                    <li v-for="message in createValidationMessages" :key="message" class="text-xs leading-5">
                                        {{ message }}
                                    </li>
                                </ul>
                            </AlertDescription>
                        </Alert>
                        <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                            <Button type="button" variant="outline" :disabled="createLoading" @click="closeCreateSheet(false)">Cancel</Button>
                            <Button type="button" :disabled="createLoading" class="gap-1.5" @click="createItem">
                                <AppIcon name="plus" class="size-3.5" />
                                {{ createLoading ? 'Creating...' : 'Create ward/bed' }}
                            </Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                <Sheet :open="editSheetOpen" @update:open="closeEditSheet">
                    <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                        <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                            <SheetTitle class="flex items-center gap-2">
                                <AppIcon name="pencil" class="size-5 text-muted-foreground" />
                                Edit ward/bed
                            </SheetTitle>
                            <SheetDescription v-if="editTarget">{{ labelOf(editTarget) }}</SheetDescription>
                        </SheetHeader>
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="grid gap-4 px-6 py-4">
                                <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Identity</legend>
                                    <div class="grid gap-2">
                                        <Label for="edit-wb-code">Code</Label>
                                        <Input
                                            id="edit-wb-code"
                                            v-model="editForm.code"
                                            :disabled="editLoading"
                                            :class="{ 'border-destructive': fieldError(editFormErrors, 'code') }"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="edit-wb-name">Display name</Label>
                                        <Input
                                            id="edit-wb-name"
                                            v-model="editForm.name"
                                            :disabled="editLoading"
                                            :class="{ 'border-destructive': fieldError(editFormErrors, 'name') }"
                                        />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="edit-wb-ward">Ward name</Label>
                                        <Input id="edit-wb-ward" v-model="editForm.wardName" :disabled="editLoading" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="edit-wb-bed">Bed number</Label>
                                        <Input id="edit-wb-bed" v-model="editForm.bedNumber" :disabled="editLoading" />
                                    </div>
                                </fieldset>
                                <fieldset class="grid gap-3 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Placement</legend>
                                    <SearchableSelectField
                                        input-id="edit-wb-department"
                                        label="Department"
                                        v-model="editForm.departmentId"
                                        :options="departmentOptions"
                                        :disabled="editLoading || departmentsLoading || !canDepartmentRead"
                                    />
                                    <div class="grid gap-2">
                                        <Label for="edit-wb-location">Location</Label>
                                        <Input id="edit-wb-location" v-model="editForm.location" :disabled="editLoading" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="edit-wb-notes">Notes</Label>
                                        <Textarea id="edit-wb-notes" v-model="editForm.notes" class="min-h-20" :disabled="editLoading" />
                                    </div>
                                </fieldset>
                            </div>
                        </ScrollArea>
                        <Alert
                            v-if="editRequestError || editValidationMessages.length"
                            variant="destructive"
                            class="mx-4 mb-3 shrink-0"
                        >
                            <AlertTitle>Update ward/bed needs attention</AlertTitle>
                            <AlertDescription>
                                <p v-if="editRequestError">{{ editRequestError }}</p>
                                <ul v-if="editValidationMessages.length" class="list-disc space-y-1 pl-4">
                                    <li v-for="message in editValidationMessages" :key="message" class="text-xs">{{ message }}</li>
                                </ul>
                            </AlertDescription>
                        </Alert>
                        <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                            <Button type="button" variant="outline" :disabled="editLoading" @click="closeEditSheet(false)">Cancel</Button>
                            <Button type="button" :disabled="editLoading" class="gap-1.5" @click="saveEdit">
                                <AppIcon name="pencil" class="size-3.5" />
                                {{ editLoading ? 'Saving...' : 'Save changes' }}
                            </Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                <Dialog :open="statusOpen" @update:open="(open) => (statusOpen = open)">
                    <DialogContent variant="action" size="lg">
                        <DialogHeader>
                            <DialogTitle>{{ statusTarget === 'inactive' ? 'Deactivate ward/bed' : 'Activate ward/bed' }}</DialogTitle>
                            <DialogDescription>
                                {{
                                    statusTarget === 'inactive'
                                        ? 'Reason is required before deactivating.'
                                        : 'Confirm activation of this ward/bed resource.'
                                }}
                            </DialogDescription>
                        </DialogHeader>
                        <div class="space-y-3">
                            <Alert v-if="statusError" variant="destructive">
                                <AlertTitle>Status update failed</AlertTitle>
                                <AlertDescription>{{ statusError }}</AlertDescription>
                            </Alert>
                            <div v-if="statusTarget === 'inactive'" class="grid gap-2">
                                <Label for="wb-status-reason">Reason</Label>
                                <Textarea
                                    id="wb-status-reason"
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
        </div>
    </AppLayout>
</template>

