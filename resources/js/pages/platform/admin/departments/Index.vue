<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type StatusCounts = { active: number; inactive: number; other: number; total: number };
type DepartmentManager = {
    userId: number | null;
    displayName: string | null;
    email: string | null;
    staffProfileId: string | null;
    staffStatus: string | null;
};
type Department = {
    id: string | null;
    code: string | null;
    name: string | null;
    serviceType: string | null;
    isPatientFacing: boolean;
    isAppointmentable: boolean;
    managerUserId: number | null;
    manager?: DepartmentManager | null;
    status: string | null;
    statusReason: string | null;
    description: string | null;
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
type DepartmentStaffProfile = {
    id: string;
    userId: number | null;
    userName: string | null;
    userEmail?: string | null;
    userEmailVerified?: boolean;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    status: string | null;
    updatedAt: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/departments' },
    { title: 'Departments', href: '/platform/admin/departments' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('departments.read') === 'allowed');
const canCreate = computed(() => permissionState('departments.create') === 'allowed');
const canUpdate = computed(() => permissionState('departments.update') === 'allowed');
const canUpdateStatus = computed(() => permissionState('departments.update-status') === 'allowed');
const canAudit = computed(() => permissionState('departments.view-audit-logs') === 'allowed');
const canReadStaff = computed(() => permissionState('staff.read') === 'allowed');
const departmentRegistryReadOnly = computed(
    () => canRead.value && !canCreate.value && !canUpdate.value && !canUpdateStatus.value,
);

const loading = ref(true);
const listLoading = ref(false);
const errors = ref<string[]>([]);
const items = ref<Department[]>([]);
const pagination = ref<Pagination | null>(null);
const counts = ref<StatusCounts>({ active: 0, inactive: 0, other: 0, total: 0 });
const filters = reactive({ q: '', status: '', serviceType: '', managerUserId: '', page: 1, perPage: 20 });
const departmentFilterCount = computed(() => {
    let count = 0;
    if (filters.q.trim()) count += 1;
    if (filters.status) count += 1;
    if (filters.serviceType.trim()) count += 1;
    if (filters.managerUserId.trim()) count += 1;
    if (filters.perPage !== 20) count += 1;
    return count;
});
const departmentListSummaryText = computed(() => {
    const segments = [`${counts.value.active} active`, `${counts.value.inactive} inactive`];

    if (counts.value.other > 0) {
        segments.push(`${counts.value.other} other`);
    }

    if (departmentFilterCount.value > 0) {
        segments.push(`${departmentFilterCount.value} filters applied`);
    }

    return segments.join(' | ');
});

const departmentScopeText = computed(() => `${counts.value.total} departments in scope`);

const createOpen = ref(false);
const createLoading = ref(false);
const createForm = reactive({
    code: '',
    name: '',
    serviceType: '',
    isPatientFacing: false,
    isAppointmentable: false,
    managerUserId: '',
    description: '',
});
const editOpen = ref(false);
const editLoading = ref(false);
const editTarget = ref<Department | null>(null);
const editForm = reactive({
    code: '',
    name: '',
    serviceType: '',
    isPatientFacing: false,
    isAppointmentable: false,
    managerUserId: '',
    description: '',
});

const statusOpen = ref(false);
const statusLoading = ref(false);
const statusError = ref<string | null>(null);
const statusTarget = ref<'active' | 'inactive'>('active');
const statusReason = ref('');
const statusDepartment = ref<Department | null>(null);

const auditTarget = ref<Department | null>(null);
const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<AuditLog[]>([]);
const detailsOpen = ref(false);
const detailsDepartment = ref<Department | null>(null);
const detailsStaffLoading = ref(false);
const detailsStaffError = ref<string | null>(null);
const detailsStaff = ref<DepartmentStaffProfile[]>([]);
const detailsStaffMeta = ref<Pagination | null>(null);

function resetCreateForm() {
    createForm.code = '';
    createForm.name = '';
    createForm.serviceType = '';
    createForm.isPatientFacing = false;
    createForm.isAppointmentable = false;
    createForm.managerUserId = '';
    createForm.description = '';
}

function setCreatePatientFacing(checked: boolean) {
    createForm.isPatientFacing = checked;
    if (!checked) {
        createForm.isAppointmentable = false;
    }
}

function setCreateAppointmentable(checked: boolean) {
    createForm.isAppointmentable = checked;
    if (checked) {
        createForm.isPatientFacing = true;
    }
}

function setEditPatientFacing(checked: boolean) {
    editForm.isPatientFacing = checked;
    if (!checked) {
        editForm.isAppointmentable = false;
    }
}

function setEditAppointmentable(checked: boolean) {
    editForm.isAppointmentable = checked;
    if (checked) {
        editForm.isPatientFacing = true;
    }
}

function openCreateDialog() {
    resetCreateForm();
    createOpen.value = true;
}

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
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
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & { status?: number; payload?: ApiError };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload as T;
}

function labelOf(item: Department | null): string {
    if (!item) return 'Unknown department';
    if (item.code && item.name) return `${item.code} - ${item.name}`;
    return item.name || item.code || item.id || 'Unknown department';
}

function departmentManagerDisplayName(manager: DepartmentManager | null | undefined, managerUserId: number | null): string {
    const label = (manager?.displayName ?? '').trim();
    if (label) return label;

    return managerUserId ? `User #${managerUserId}` : 'Unassigned manager';
}

function departmentManagerInitials(manager: DepartmentManager | null | undefined, managerUserId: number | null): string {
    const label = departmentManagerDisplayName(manager, managerUserId);
    if (!label || label === 'Unassigned manager') return '--';

    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '--';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function departmentManagerStaffHref(item: Department): string | null {
    const staffProfileId = String(item.manager?.staffProfileId ?? '').trim();
    if (!canReadStaff.value || staffProfileId === '') return null;

    return `/staff?staffId=${encodeURIComponent(staffProfileId)}`;
}

function staffProfileDisplayName(profile: DepartmentStaffProfile): string {
    return profile.userName?.trim() || profile.employeeNumber?.trim() || 'Staff profile';
}

function staffProfileInitials(profile: DepartmentStaffProfile): string {
    const label = staffProfileDisplayName(profile);
    const parts = label.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '--';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function staffProfileHref(profile: DepartmentStaffProfile): string | null {
    const id = String(profile.id ?? '').trim();
    if (!canReadStaff.value || id === '') return null;

    return `/staff?staffId=${encodeURIComponent(id)}`;
}

function openDepartmentDetails(item: Department) {
    detailsDepartment.value = item;
    detailsOpen.value = true;
    void loadDepartmentStaff(item);
    if (canAudit.value) {
        void loadAudit(item);
    } else {
        auditTarget.value = item;
        auditLogs.value = [];
        auditError.value = null;
        auditLoading.value = false;
    }
}

function closeDepartmentDetails() {
    detailsOpen.value = false;
    detailsDepartment.value = null;
    detailsStaffLoading.value = false;
    detailsStaffError.value = null;
    detailsStaff.value = [];
    detailsStaffMeta.value = null;
    auditTarget.value = null;
    auditLoading.value = false;
    auditError.value = null;
    auditLogs.value = [];
}

async function loadDepartmentStaff(item: Department) {
    if (!canReadStaff.value) {
        detailsStaff.value = [];
        detailsStaffMeta.value = null;
        detailsStaffError.value = null;
        return;
    }

    const department = (item.name ?? item.code ?? '').trim();
    if (!department) {
        detailsStaff.value = [];
        detailsStaffMeta.value = null;
        detailsStaffError.value = null;
        return;
    }

    detailsStaffLoading.value = true;
    detailsStaffError.value = null;

    try {
        const response = await apiRequest<ListResponse<DepartmentStaffProfile>>('GET', '/staff', {
            query: {
                department,
                page: 1,
                perPage: 12,
            },
        });
        detailsStaff.value = response.data ?? [];
        detailsStaffMeta.value = response.meta ?? null;
    } catch (error) {
        detailsStaff.value = [];
        detailsStaffMeta.value = null;
        detailsStaffError.value = messageFromUnknown(error, 'Unable to load staff assigned to this department.');
    } finally {
        detailsStaffLoading.value = false;
    }
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

function actorLabel(log: AuditLog): string {
    return log.actor?.displayName?.trim() || (log.actorId === null ? 'System' : `User #${log.actorId}`);
}

function parseManager(raw: string): number | null {
    const value = raw.trim();
    if (!value) return null;
    if (!/^\d+$/.test(value)) return NaN;
    return Number(value);
}

async function loadCounts() {
    if (!canRead.value) {
        counts.value = { active: 0, inactive: 0, other: 0, total: 0 };
        return;
    }
    try {
        const response = await apiRequest<StatusResponse>('GET', '/departments/status-counts', {
            query: {
                q: filters.q.trim() || null,
                serviceType: filters.serviceType.trim() || null,
                managerUserId: filters.managerUserId.trim() || null,
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
        const response = await apiRequest<ListResponse<Department>>('GET', '/departments', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                serviceType: filters.serviceType.trim() || null,
                managerUserId: filters.managerUserId.trim() || null,
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
        errors.value.push(messageFromUnknown(error, 'Unable to load departments.'));
    } finally {
        loading.value = false;
        listLoading.value = false;
    }
}

async function refreshPage() {
    await Promise.all([loadItems(), loadCounts()]);
}

async function createItem() {
    if (!canCreate.value || createLoading.value) return;
    const manager = parseManager(createForm.managerUserId);
    if (Number.isNaN(manager)) return notifyError('Manager user ID must be numeric.');
    createLoading.value = true;
    try {
        const response = await apiRequest<ItemResponse<Department>>('POST', '/departments', {
            body: {
                code: createForm.code.trim(),
                name: createForm.name.trim(),
                serviceType: createForm.serviceType.trim() || null,
                isPatientFacing: createForm.isPatientFacing,
                isAppointmentable: createForm.isAppointmentable,
                managerUserId: manager,
                description: createForm.description.trim() || null,
            },
        });
        notifySuccess(`Created ${labelOf(response.data)}.`);
        resetCreateForm();
        createOpen.value = false;
        filters.page = 1;
        await refreshPage();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create department.'));
    } finally {
        createLoading.value = false;
    }
}

function openEdit(item: Department) {
    editTarget.value = item;
    editForm.code = item.code || '';
    editForm.name = item.name || '';
    editForm.serviceType = item.serviceType || '';
    editForm.isPatientFacing = item.isPatientFacing === true;
    editForm.isAppointmentable = item.isAppointmentable === true;
    editForm.managerUserId = item.managerUserId === null ? '' : String(item.managerUserId);
    editForm.description = item.description || '';
    editOpen.value = true;
}

async function saveEdit() {
    const id = editTarget.value?.id?.trim();
    if (!id || !canUpdate.value || editLoading.value) return;
    const manager = parseManager(editForm.managerUserId);
    if (Number.isNaN(manager)) return notifyError('Manager user ID must be numeric.');
    editLoading.value = true;
    try {
        await apiRequest<ItemResponse<Department>>('PATCH', `/departments/${id}`, {
            body: {
                code: editForm.code.trim(),
                name: editForm.name.trim(),
                serviceType: editForm.serviceType.trim() || null,
                isPatientFacing: editForm.isPatientFacing,
                isAppointmentable: editForm.isAppointmentable,
                managerUserId: manager,
                description: editForm.description.trim() || null,
            },
        });
        notifySuccess('Department updated.');
        editOpen.value = false;
        await refreshPage();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update department.'));
    } finally {
        editLoading.value = false;
    }
}

function openStatus(item: Department, target: 'active' | 'inactive') {
    statusDepartment.value = item;
    statusTarget.value = target;
    statusReason.value = target === 'inactive' ? item.statusReason ?? '' : '';
    statusError.value = null;
    statusOpen.value = true;
}

async function saveStatus() {
    const id = statusDepartment.value?.id?.trim();
    if (!id || !canUpdateStatus.value || statusLoading.value) return;
    if (statusTarget.value === 'inactive' && !statusReason.value.trim()) {
        statusError.value = 'Reason is required for inactivation.';
        return;
    }
    statusLoading.value = true;
    statusError.value = null;
    try {
        await apiRequest<ItemResponse<Department>>('PATCH', `/departments/${id}/status`, {
            body: { status: statusTarget.value, reason: statusTarget.value === 'inactive' ? statusReason.value.trim() : null },
        });
        notifySuccess('Department status updated.');
        statusOpen.value = false;
        await refreshPage();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update department status.');
    } finally {
        statusLoading.value = false;
    }
}

async function loadAudit(item: Department) {
    const id = item.id?.trim();
    if (!id || !canAudit.value) return;
    auditTarget.value = item;
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await apiRequest<AuditResponse>('GET', `/departments/${id}/audit-logs`, { query: { page: 1, perPage: 20 } });
        auditLogs.value = response.data ?? [];
    } catch (error) {
        auditLogs.value = [];
        auditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
    } finally {
        auditLoading.value = false;
    }
}

function search() { filters.page = 1; void refreshPage(); }
function reset() { filters.q = ''; filters.status = ''; filters.serviceType = ''; filters.managerUserId = ''; filters.page = 1; void refreshPage(); }
function setStatus(status: '' | 'active' | 'inactive') { filters.status = status; filters.page = 1; void refreshPage(); }
function prevPage() { if ((pagination.value?.currentPage ?? 1) > 1) { filters.page -= 1; void loadItems(); } }
function nextPage() { if (pagination.value && pagination.value.currentPage < pagination.value.lastPage) { filters.page += 1; void loadItems(); } }

onMounted(refreshPage);
</script>

<template>
    <Head title="Departments" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">

            <!-- Page header -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="building-2" class="size-7 text-primary" />
                        Department Registry
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">Department queue, status management, and audit visibility for facility operations.</p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" :disabled="listLoading" class="gap-1.5" @click="refreshPage">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button v-if="canCreate" size="sm" class="gap-1.5" @click="openCreateDialog">
                        <AppIcon name="plus" class="size-3.5" />
                        Create Department
                    </Button>
                </div>
            </div>

            <Alert v-if="departmentRegistryReadOnly" variant="default">
                <AlertTitle>Read-only access</AlertTitle>
                <AlertDescription>
                    This registry is available in read-only mode for your role. Create and status-change actions stay hidden until department management permissions are granted.
                </AlertDescription>
            </Alert>

            <!-- Alerts -->
            <Alert v-if="errors.length" variant="destructive">
                <AlertTitle>Request error</AlertTitle>
                <AlertDescription>
                    <p v-for="errorMessage in errors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p>
                </AlertDescription>
            </Alert>

            <div v-if="canRead" class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3">
                <Button
                    variant="outline"
                    size="sm"
                    class="gap-2 bg-background"
                    :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': filters.status === 'active' }"
                    @click="setStatus('active')"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    <span class="font-medium">{{ counts.active }}</span>
                    <span class="text-muted-foreground">Active</span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    class="gap-2 bg-background"
                    :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': filters.status === 'inactive' }"
                    @click="setStatus('inactive')"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                    <span class="font-medium">{{ counts.inactive }}</span>
                    <span class="text-muted-foreground">Inactive</span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    class="gap-2 bg-background"
                    :class="{ 'border-primary bg-primary/5 hover:bg-primary/10': filters.status === '' }"
                    @click="setStatus('')"
                >
                    <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                    <span class="font-medium">{{ counts.total }}</span>
                    <span class="text-muted-foreground">All</span>
                </Button>
                <div class="ml-auto flex items-center gap-2">
                    <p class="hidden text-xs text-muted-foreground sm:block">{{ departmentScopeText }} | {{ departmentListSummaryText }}</p>
                    <Button v-if="departmentFilterCount > 0" variant="ghost" size="sm" class="text-xs" @click="reset">
                        <AppIcon name="sliders-horizontal" class="size-3" />
                        Reset
                    </Button>
                </div>
            </div>

            <!-- Single column layout -->
            <div class="flex min-w-0 flex-col gap-4">

                <!-- Departments card -->
                <Card v-if="canRead" class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70">
                                        <CardHeader class="shrink-0 gap-3 pt-4 pb-2">
                        <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div class="min-w-0 space-y-1">
                                <CardTitle class="flex items-center gap-2 text-base">
                                    <AppIcon name="layout-list" class="size-4.5 text-muted-foreground" />
                                    Departments
                                </CardTitle>
                                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    <span>Showing {{ items.length }} of {{ pagination?.total ?? 0 }} results</span>
                                    <span>{{ departmentListSummaryText }}</span>
                                </div>
                            </div>
                            <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:max-w-2xl">
                                <div class="relative min-w-0 flex-1 min-w-[12rem]">
                                    <AppIcon
                                        name="search"
                                        class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        v-model="filters.q"
                                        placeholder="Search code, name, or description"
                                        class="h-9 pl-9"
                                        @keyup.enter="search"
                                    />
                                </div>
                                <Popover>
                                    <PopoverTrigger as-child>
                                        <Button variant="outline" size="sm" class="shrink-0 gap-1.5">
                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                            Queue options
                                            <Badge v-if="departmentFilterCount > 0" variant="secondary" class="ml-1 text-[10px]">{{ departmentFilterCount }}</Badge>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" class="flex max-h-[28rem] w-[20rem] flex-col overflow-hidden rounded-lg border bg-popover p-0 shadow-md">
                                        <div class="space-y-3 border-b px-4 py-3">
                                            <p class="flex items-center gap-2 text-sm font-medium">
                                                <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                Queue options
                                            </p>
                                            <div class="grid gap-2">
                                                <Label for="dept-status-popover">Status</Label>
                                                <Select v-model="filters.status">
                                                    <SelectTrigger class="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                    <SelectItem value="">All statuses</SelectItem>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="inactive">Inactive</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="dept-service-type-popover">Category / Service Type</Label>
                                                <Input id="dept-service-type-popover" v-model="filters.serviceType" placeholder="Clinical, Administrative, Support..." />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="dept-manager-popover">Manager User ID</Label>
                                                <Input id="dept-manager-popover" v-model="filters.managerUserId" inputmode="numeric" placeholder="Numeric user ID" />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="dept-per-page-popover">Per page</Label>
                                                <Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event)">
                                                    <SelectTrigger class="w-full">
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
                                        <div class="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
                                            <Button variant="outline" size="sm" class="gap-1.5" @click="reset">Reset</Button>
                                            <Button size="sm" class="gap-1.5" :disabled="listLoading" @click="search">
                                                <AppIcon name="search" class="size-3.5" />
                                                Apply
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem] px-4">
                                <div v-if="loading || listLoading" class="divide-y">
                                    <div v-for="index in 6" :key="`department-skeleton-${index}`" class="flex items-center gap-3 py-2.5">
                                        <Skeleton class="h-4 w-40" />
                                        <div class="ml-auto flex items-center gap-2">
                                            <Skeleton class="hidden h-5 w-16 rounded-full sm:block" />
                                            <Skeleton class="h-6 w-6 rounded-full" />
                                            <Skeleton class="h-8 w-8 rounded-md" />
                                        </div>
                                    </div>
                                </div>
                                <div v-else-if="items.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                    No departments found. Try adjusting your search or filters.
                                </div>
                                <div v-else class="divide-y">
                                    <div
                                        v-for="item in items"
                                        :key="item.id || item.code || item.name"
                                        class="group flex items-center gap-3 py-2.5"
                                    >
                                        <button
                                            type="button"
                                            class="min-w-0 flex-1 truncate text-left text-sm font-medium transition-colors hover:text-primary hover:underline"
                                            @click="openDepartmentDetails(item)"
                                        >
                                            {{ labelOf(item) }}
                                        </button>
                                        <Badge class="hidden sm:inline-flex" :variant="statusVariant(item.status)">{{ item.status || 'unknown' }}</Badge>
                                        <TooltipProvider v-if="item.managerUserId || item.manager" :delay-duration="100">
                                            <Tooltip>
                                                <TooltipTrigger as-child>
                                                    <Link
                                                        v-if="departmentManagerStaffHref(item)"
                                                        :href="departmentManagerStaffHref(item)!"
                                                        class="inline-flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                                    >
                                                        <Avatar class="h-6 w-6 border border-border/70">
                                                            <AvatarFallback class="bg-primary/10 text-[10px] font-semibold text-primary">
                                                                {{ departmentManagerInitials(item.manager, item.managerUserId) }}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </Link>
                                                    <span v-else class="inline-flex items-center">
                                                        <Avatar class="h-6 w-6 border border-border/70">
                                                            <AvatarFallback class="bg-muted text-[10px] font-semibold text-muted-foreground">
                                                                {{ departmentManagerInitials(item.manager, item.managerUserId) }}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" class="space-y-0.5">
                                                    <p class="text-sm font-medium">{{ departmentManagerDisplayName(item.manager, item.managerUserId) }}</p>
                                                    <p v-if="item.manager?.email" class="text-xs text-muted-foreground">{{ item.manager.email }}</p>
                                                    <p v-if="departmentManagerStaffHref(item)" class="text-xs text-muted-foreground">Open in Staff</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                        <Button variant="ghost" size="icon-sm" @click="openDepartmentDetails(item)">
                                            <AppIcon name="chevron-right" class="size-4" />
                                            <span class="sr-only">Open department details</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                            <p class="text-xs text-muted-foreground">
                                Showing {{ items.length }} of {{ pagination?.total ?? 0 }} results &middot; Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                            </p>
                            <div class="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="listLoading || (pagination?.currentPage ?? 1) <= 1"
                                    @click="prevPage"
                                >
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="listLoading || !pagination || pagination.currentPage >= pagination.lastPage"
                                    @click="nextPage"
                                >
                                    Next
                                    <AppIcon name="chevron-right" class="size-3.5" />
                                </Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>

                <!-- No read permission card -->
                <Card v-else class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                            Departments
                        </CardTitle>
                        <CardDescription>Department access is permission restricted.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle>Access restricted</AlertTitle>
                            <AlertDescription>Request <code>departments.read</code> permission.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeDepartmentDetails())">
                    <SheetContent side="right" variant="workspace" size="3xl">
                        <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                            <SheetTitle class="flex items-center gap-2 text-base">
                                <AppIcon name="building-2" class="size-5 text-primary" />
                                {{ detailsDepartment ? labelOf(detailsDepartment) : 'Department details' }}
                            </SheetTitle>
                            <SheetDescription class="text-sm">Review department metadata, assigned staff, and audit activity.</SheetDescription>
                        </SheetHeader>
                        <div class="min-h-0 flex-1 overflow-y-auto">
                            <div class="space-y-4 p-4">
                                <div v-if="detailsDepartment" class="flex flex-wrap items-center gap-2">
                                    <Badge :variant="statusVariant(detailsDepartment.status)">{{ detailsDepartment.status || 'unknown' }}</Badge>
                                    <Badge variant="outline">{{ detailsDepartment.serviceType || 'Uncategorized' }}</Badge>
                                    <Badge v-if="detailsDepartment.isPatientFacing" variant="secondary">Patient-facing</Badge>
                                    <Badge v-if="detailsDepartment.isAppointmentable" variant="secondary">Appointmentable</Badge>
                                    <Button v-if="canUpdate" variant="outline" size="sm" class="gap-1.5" @click="openEdit(detailsDepartment)">
                                        <AppIcon name="pencil" class="size-3.5" />
                                        Edit
                                    </Button>
                                    <Button
                                        v-if="canUpdateStatus"
                                        size="sm"
                                        class="gap-1.5"
                                        :variant="(detailsDepartment.status ?? '').toLowerCase() === 'active' ? 'destructive' : 'secondary'"
                                        @click="openStatus(detailsDepartment, (detailsDepartment.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active')"
                                    >
                                        <AppIcon :name="(detailsDepartment.status ?? '').toLowerCase() === 'active' ? 'ban' : 'circle-check'" class="size-3.5" />
                                        {{ (detailsDepartment.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}
                                    </Button>
                                </div>

                                <Card class="rounded-lg border-sidebar-border/70">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-sm">Department overview</CardTitle>
                                        <CardDescription>Core metadata and operational ownership for this department.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-3 sm:grid-cols-2">
                                        <div class="grid gap-1">
                                            <span class="text-xs text-muted-foreground">Code</span>
                                            <span class="text-sm font-medium">{{ detailsDepartment?.code || 'N/A' }}</span>
                                        </div>
                                        <div class="grid gap-1">
                                            <span class="text-xs text-muted-foreground">Name</span>
                                            <span class="text-sm font-medium">{{ detailsDepartment?.name || 'N/A' }}</span>
                                        </div>
                                        <div class="grid gap-1">
                                            <span class="text-xs text-muted-foreground">Category / Service type</span>
                                            <span class="text-sm font-medium">{{ detailsDepartment?.serviceType || 'N/A' }}</span>
                                        </div>
                                        <div class="grid gap-1">
                                            <span class="text-xs text-muted-foreground">Patient access</span>
                                            <span class="text-sm font-medium">{{ detailsDepartment?.isPatientFacing ? 'Patient-facing' : 'Internal only' }}</span>
                                        </div>
                                        <div class="grid gap-1">
                                            <span class="text-xs text-muted-foreground">Appointment scheduling</span>
                                            <span class="text-sm font-medium">{{ detailsDepartment?.isAppointmentable ? 'Available in Appointments' : 'Hidden from Appointments' }}</span>
                                        </div>
                                        <div class="grid gap-1">
                                            <span class="text-xs text-muted-foreground">Manager</span>
                                            <div class="flex items-center gap-2">
                                                <Avatar class="h-7 w-7 border border-border/70">
                                                    <AvatarFallback class="bg-primary/10 text-[10px] font-semibold text-primary">
                                                        {{ departmentManagerInitials(detailsDepartment?.manager, detailsDepartment?.managerUserId ?? null) }}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div class="min-w-0">
                                                    <p class="truncate text-sm font-medium">{{ departmentManagerDisplayName(detailsDepartment?.manager, detailsDepartment?.managerUserId ?? null) }}</p>
                                                    <p v-if="detailsDepartment?.manager?.email" class="truncate text-xs text-muted-foreground">{{ detailsDepartment.manager.email }}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="detailsDepartment?.statusReason" class="grid gap-1 sm:col-span-2">
                                            <span class="text-xs text-muted-foreground">Status reason</span>
                                            <span class="text-sm">{{ detailsDepartment.statusReason }}</span>
                                        </div>
                                        <div class="grid gap-1 sm:col-span-2">
                                            <span class="text-xs text-muted-foreground">Description</span>
                                            <span class="text-sm">{{ detailsDepartment?.description || 'No description recorded.' }}</span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card v-if="canReadStaff" class="rounded-lg border-sidebar-border/70">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-sm">Assigned staff</CardTitle>
                                        <CardDescription>
                                            {{ detailsStaffMeta?.total ?? detailsStaff.length }} staff profiles currently mapped to this department.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent class="space-y-2">
                                        <Alert v-if="detailsStaffError" variant="destructive">
                                            <AlertTitle>Staff load issue</AlertTitle>
                                            <AlertDescription>{{ detailsStaffError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="detailsStaffLoading" class="space-y-2">
                                            <Skeleton class="h-12 w-full" />
                                            <Skeleton class="h-12 w-full" />
                                            <Skeleton class="h-12 w-full" />
                                        </div>
                                        <div v-else-if="detailsStaff.length === 0" class="flex flex-col items-center gap-2 py-8 text-center">
                                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                                <AppIcon name="users" class="size-5 text-muted-foreground" />
                                            </div>
                                            <p class="text-sm text-muted-foreground">No staff profiles are currently assigned to this department.</p>
                                        </div>
                                        <div v-else class="divide-y rounded-lg border">
                                            <div v-for="profile in detailsStaff" :key="profile.id" class="flex items-center gap-3 px-3 py-2.5">
                                                <Avatar class="h-8 w-8 border border-border/70">
                                                    <AvatarFallback class="bg-primary/10 text-[10px] font-semibold text-primary">
                                                        {{ staffProfileInitials(profile) }}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div class="min-w-0 flex-1">
                                                    <Link
                                                        v-if="staffProfileHref(profile)"
                                                        :href="staffProfileHref(profile)!"
                                                        class="truncate text-sm font-medium hover:text-primary hover:underline"
                                                    >
                                                        {{ staffProfileDisplayName(profile) }}
                                                    </Link>
                                                    <p v-else class="truncate text-sm font-medium">{{ staffProfileDisplayName(profile) }}</p>
                                                    <p class="truncate text-xs text-muted-foreground">{{ profile.employeeNumber || 'No employee number' }} | {{ profile.jobTitle || 'No job title' }}</p>
                                                </div>
                                                <Badge :variant="statusVariant(profile.status)">{{ profile.status || 'unknown' }}</Badge>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card v-if="canAudit" class="rounded-lg border-sidebar-border/70">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-sm">Audit activity</CardTitle>
                                        <CardDescription>Recent governance and status events for this department.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="space-y-2">
                                        <Alert v-if="auditError" variant="destructive">
                                            <AlertTitle>Audit load issue</AlertTitle>
                                            <AlertDescription>{{ auditError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="auditLoading" class="space-y-2">
                                            <Skeleton class="h-10 w-full" />
                                            <Skeleton class="h-10 w-full" />
                                            <Skeleton class="h-10 w-full" />
                                        </div>
                                        <div v-else-if="auditLogs.length === 0" class="flex flex-col items-center gap-2 py-8 text-center">
                                            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                                                <AppIcon name="activity" class="size-5 text-muted-foreground" />
                                            </div>
                                            <p class="text-sm text-muted-foreground">No audit logs found for this department.</p>
                                        </div>
                                        <div v-else class="space-y-2">
                                            <div v-for="log in auditLogs" :key="log.id" class="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2">
                                                <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                                                    <AppIcon name="activity" class="size-3.5 text-muted-foreground" />
                                                </div>
                                                <div class="min-w-0 flex-1 pt-0.5">
                                                    <p class="text-sm font-medium">{{ log.actionLabel || log.action || 'event' }}</p>
                                                    <p class="mt-0.5 text-xs text-muted-foreground">{{ log.createdAt || 'N/A' }} | {{ actorLabel(log) }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>

            <!-- Create Department dialog -->
            <Dialog :open="createOpen" @update:open="(open) => { createOpen = open; if (!open) resetCreateForm(); }">
                <DialogContent size="2xl">
                    <DialogHeader>
                        <DialogTitle>Create Department</DialogTitle>
                        <DialogDescription>Add a new department record.</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-3 md:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="create-code">Code</Label>
                            <Input id="create-code" v-model="createForm.code" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="create-name">Name</Label>
                            <Input id="create-name" v-model="createForm.name" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="create-service-type">Service Type</Label>
                            <Input id="create-service-type" v-model="createForm.serviceType" placeholder="Clinical, Administrative, Support, Pharmacy, Laboratory..." />
                            <p class="text-xs text-muted-foreground">
                                Use this as the department category, not just a clinic name. Staff selectors group departments by this value.
                            </p>
                        </div>
                        <div class="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 md:col-span-2">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Patient access</p>
                                <p class="text-xs text-muted-foreground">Use these flags to control whether patients can encounter this department and whether Appointments can offer it as a destination.</p>
                            </div>
                            <label class="flex items-start gap-3 rounded-lg border border-border/70 bg-background px-3 py-3">
                                <Checkbox :model-value="createForm.isPatientFacing" class="mt-0.5" @update:model-value="setCreatePatientFacing($event === true)" />
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Patient-facing department</p>
                                    <p class="text-xs text-muted-foreground">Enable this for services patients interact with directly, like OPD, diagnostics, pharmacy, medical records, or billing counseling.</p>
                                </div>
                            </label>
                            <label class="flex items-start gap-3 rounded-lg border border-border/70 bg-background px-3 py-3">
                                <Checkbox :model-value="createForm.isAppointmentable" class="mt-0.5" @update:model-value="setCreateAppointmentable($event === true)" />
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Available in Appointments</p>
                                    <p class="text-xs text-muted-foreground">Only patient-facing departments marked here will appear in the Schedule Appointment department picker.</p>
                                </div>
                            </label>
                        </div>
                        <div class="grid gap-2">
                            <Label for="create-manager">Manager User ID</Label>
                            <Input id="create-manager" v-model="createForm.managerUserId" inputmode="numeric" />
                        </div>
                        <div class="grid gap-2 md:col-span-2">
                            <Label for="create-description">Description</Label>
                            <Textarea id="create-description" v-model="createForm.description" class="min-h-20" />
                        </div>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" :disabled="createLoading" @click="createOpen = false">Cancel</Button>
                        <Button :disabled="createLoading" class="gap-1.5" @click="createItem">
                            <AppIcon name="plus" class="size-3.5" />
                            {{ createLoading ? 'Creating...' : 'Create Department' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <!-- Edit Department dialog -->
            <Dialog :open="editOpen" @update:open="(open) => (editOpen = open)">
                <DialogContent size="2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Department</DialogTitle>
                        <DialogDescription>Update department metadata.</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-3">
                        <div class="grid gap-2">
                            <Label for="edit-code">Code</Label>
                            <Input id="edit-code" v-model="editForm.code" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-name">Name</Label>
                            <Input id="edit-name" v-model="editForm.name" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-service-type">Service Type</Label>
                            <Input id="edit-service-type" v-model="editForm.serviceType" placeholder="Clinical, Administrative, Support, Pharmacy, Laboratory..." />
                            <p class="text-xs text-muted-foreground">
                                Use this as the department category so staff selectors can group operational and clinical areas consistently.
                            </p>
                        </div>
                        <div class="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Patient access</p>
                                <p class="text-xs text-muted-foreground">These flags decide whether the department is patient-facing and whether it can be offered in Appointments.</p>
                            </div>
                            <label class="flex items-start gap-3 rounded-lg border border-border/70 bg-background px-3 py-3">
                                <Checkbox :model-value="editForm.isPatientFacing" class="mt-0.5" @update:model-value="setEditPatientFacing($event === true)" />
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Patient-facing department</p>
                                    <p class="text-xs text-muted-foreground">Turn this off for internal departments like HR, stores, ICT, or maintenance.</p>
                                </div>
                            </label>
                            <label class="flex items-start gap-3 rounded-lg border border-border/70 bg-background px-3 py-3">
                                <Checkbox :model-value="editForm.isAppointmentable" class="mt-0.5" @update:model-value="setEditAppointmentable($event === true)" />
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Available in Appointments</p>
                                    <p class="text-xs text-muted-foreground">Only use this for patient-facing destinations that make sense as scheduled appointments.</p>
                                </div>
                            </label>
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-manager">Manager User ID</Label>
                            <Input id="edit-manager" v-model="editForm.managerUserId" inputmode="numeric" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-description">Description</Label>
                            <Textarea id="edit-description" v-model="editForm.description" class="min-h-20" />
                        </div>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" :disabled="editLoading" @click="editOpen = false">Cancel</Button>
                        <Button :disabled="editLoading" class="gap-1.5" @click="saveEdit">
                            <AppIcon name="save" class="size-3.5" />
                            {{ editLoading ? 'Saving...' : 'Save Changes' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <!-- Status update dialog -->
            <Dialog :open="statusOpen" @update:open="(open) => (statusOpen = open)">
                <DialogContent variant="action" size="lg">
                    <DialogHeader>
                        <DialogTitle>{{ statusTarget === 'inactive' ? 'Deactivate Department' : 'Activate Department' }}</DialogTitle>
                        <DialogDescription>{{ statusTarget === 'inactive' ? 'Reason is required before deactivating.' : 'Confirm activation of this department.' }}</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="statusError" variant="destructive">
                            <AlertTitle>Status update failed</AlertTitle>
                            <AlertDescription>{{ statusError }}</AlertDescription>
                        </Alert>
                        <div v-if="statusTarget === 'inactive'" class="grid gap-2">
                            <Label for="status-reason">Reason</Label>
                            <Textarea id="status-reason" v-model="statusReason" class="min-h-20" placeholder="Required reason for deactivation" />
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











