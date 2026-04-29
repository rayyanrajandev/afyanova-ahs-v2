<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
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
type ApiError = { message?: string };
type ListResponse<T> = { data: T[]; meta: Pagination };
type ItemResponse<T> = { data: T };
type StatusResponse = { data: StatusCounts };
type AuditResponse = { data: AuditLog[]; meta: Pagination };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Platform Admin', href: '/platform/admin/service-points' },
    { title: 'Service Points', href: '/platform/admin/service-points' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('platform.resources.read') === 'allowed');
const canManage = computed(() => permissionState('platform.resources.manage-service-points') === 'allowed');
const canAudit = computed(() => permissionState('platform.resources.view-audit-logs') === 'allowed');
const canDepartmentRead = computed(() => permissionState('departments.read') === 'allowed');

const loading = ref(true);
const listLoading = ref(false);
const errors = ref<string[]>([]);
const items = ref<ServicePoint[]>([]);
const pagination = ref<Pagination | null>(null);
const counts = ref<StatusCounts>({ active: 0, inactive: 0, other: 0, total: 0 });
const filters = reactive({ q: '', status: '', departmentId: '', servicePointType: '', page: 1, perPage: 20 });

const departments = ref<Department[]>([]);
const departmentsLoading = ref(false);
const createLoading = ref(false);
const createForm = reactive({ code: '', name: '', departmentId: '', servicePointType: '', location: '', notes: '' });
const editOpen = ref(false);
const editLoading = ref(false);
const editTarget = ref<ServicePoint | null>(null);
const editForm = reactive({ code: '', name: '', departmentId: '', servicePointType: '', location: '', notes: '' });

const statusOpen = ref(false);
const statusLoading = ref(false);
const statusError = ref<string | null>(null);
const statusTarget = ref<'active' | 'inactive'>('active');
const statusReason = ref('');
const statusItem = ref<ServicePoint | null>(null);

const auditTarget = ref<ServicePoint | null>(null);
const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<AuditLog[]>([]);

function scrollToCreateServicePoint() {
    document.getElementById('create-service-point')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`);
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

function actorLabel(log: AuditLog): string {
    return log.actor?.displayName?.trim() || (log.actorId === null ? 'System' : `User #${log.actorId}`);
}

async function loadDepartments() {
    if (!canDepartmentRead.value) {
        departments.value = [];
        return;
    }
    departmentsLoading.value = true;
    try {
        const response = await apiRequest<ListResponse<Department>>('GET', '/departments', { query: { page: 1, perPage: 100, sortBy: 'name', sortDir: 'asc' } });
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
            query: { q: filters.q.trim() || null, departmentId: filters.departmentId || null, servicePointType: filters.servicePointType.trim() || null },
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

async function refreshPage() { await Promise.all([loadItems(), loadCounts()]); }

async function createItem() {
    if (!canManage.value || createLoading.value) return;
    createLoading.value = true;
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
        createForm.code = ''; createForm.name = ''; createForm.departmentId = ''; createForm.servicePointType = ''; createForm.location = ''; createForm.notes = '';
        filters.page = 1;
        await refreshPage();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create service point.'));
    } finally { createLoading.value = false; }
}

function openEdit(item: ServicePoint) {
    editTarget.value = item;
    editForm.code = item.code || ''; editForm.name = item.name || ''; editForm.departmentId = item.departmentId || '';
    editForm.servicePointType = item.servicePointType || ''; editForm.location = item.location || ''; editForm.notes = item.notes || '';
    editOpen.value = true;
}

async function saveEdit() {
    const id = editTarget.value?.id?.trim();
    if (!id || !canManage.value || editLoading.value) return;
    editLoading.value = true;
    try {
        await apiRequest<ItemResponse<ServicePoint>>('PATCH', `/platform/admin/service-points/${id}`, {
            body: {
                code: editForm.code.trim(), name: editForm.name.trim(), departmentId: editForm.departmentId || null,
                servicePointType: editForm.servicePointType.trim() || null, location: editForm.location.trim() || null, notes: editForm.notes.trim() || null,
            },
        });
        notifySuccess('Service point updated.');
        editOpen.value = false;
        await refreshPage();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update service point.'));
    } finally { editLoading.value = false; }
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
    if (statusTarget.value === 'inactive' && !statusReason.value.trim()) return (statusError.value = 'Reason is required for inactivation.');
    statusLoading.value = true;
    try {
        await apiRequest<ItemResponse<ServicePoint>>('PATCH', `/platform/admin/service-points/${id}/status`, {
            body: { status: statusTarget.value, reason: statusTarget.value === 'inactive' ? statusReason.value.trim() : null },
        });
        notifySuccess('Service point status updated.');
        statusOpen.value = false;
        await refreshPage();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update service point status.');
    } finally { statusLoading.value = false; }
}

async function loadAudit(item: ServicePoint) {
    const id = item.id?.trim();
    if (!id || !canAudit.value) return;
    auditTarget.value = item;
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await apiRequest<AuditResponse>('GET', `/platform/admin/service-points/${id}/audit-logs`, { query: { page: 1, perPage: 20 } });
        auditLogs.value = response.data ?? [];
    } catch (error) {
        auditLogs.value = [];
        auditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
    } finally { auditLoading.value = false; }
}

function search() { filters.page = 1; void refreshPage(); }
function reset() { filters.q = ''; filters.status = ''; filters.departmentId = ''; filters.servicePointType = ''; filters.page = 1; void refreshPage(); }
function setStatus(status: '' | 'active' | 'inactive') { filters.status = status; filters.page = 1; void refreshPage(); }
function prevPage() { if ((pagination.value?.currentPage ?? 1) > 1) { filters.page -= 1; void loadItems(); } }
function nextPage() { if (pagination.value && pagination.value.currentPage < pagination.value.lastPage) { filters.page += 1; void loadItems(); } }

onMounted(async () => { await Promise.all([loadDepartments(), refreshPage()]); });
</script>

<template>
    <Head title="Service Points" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">

            <!-- Page header -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="map-pin" class="size-7 text-primary" />
                        Service Point Registry
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">Manage operational service points.</p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" :disabled="listLoading" class="gap-1.5" @click="refreshPage">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button size="sm" class="h-8 gap-1.5" @click="scrollToCreateServicePoint">
                        <AppIcon name="plus" class="size-3.5" />
                        Create Service Point
                    </Button>
                </div>
            </div>

            <!-- Queue bar -->
            <div v-if="canRead" class="flex min-h-9 flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2">
                <span class="text-xs font-medium text-muted-foreground">Queue:</span>
                <span class="flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs">
                    <span class="font-medium text-foreground">{{ counts.active }}</span>
                    <span class="text-muted-foreground">Active</span>
                </span>
                <span class="flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs">
                    <span class="font-medium text-foreground">{{ counts.inactive }}</span>
                    <span class="text-muted-foreground">Inactive</span>
                </span>
                <span class="flex items-center gap-1 rounded-md border bg-background px-2.5 py-1 text-xs">
                    <span class="font-medium text-foreground">{{ counts.total }}</span>
                    <span class="text-muted-foreground">Total</span>
                </span>
                <Separator orientation="vertical" class="mx-1 hidden h-6 sm:block" />
                <span class="text-xs font-medium text-muted-foreground">Presets:</span>
                <Button size="sm" class="h-8" :variant="filters.status === '' ? 'default' : 'outline'" @click="setStatus('')">All</Button>
                <Button size="sm" class="h-8" :variant="filters.status === 'active' ? 'default' : 'outline'" @click="setStatus('active')">Active</Button>
                <Button size="sm" class="h-8" :variant="filters.status === 'inactive' ? 'default' : 'outline'" @click="setStatus('inactive')">Inactive</Button>
            </div>

            <!-- Alerts -->
            <Alert v-if="errors.length" variant="destructive">
                <AlertTitle>Request error</AlertTitle>
                <AlertDescription>
                    <p v-for="errorMessage in errors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p>
                </AlertDescription>
            </Alert>

            <!-- Single column layout -->
            <div class="flex min-w-0 flex-col gap-4">

                <!-- Service point list card -->
                <Card v-if="canRead" class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70">
                    <CardHeader class="shrink-0 gap-3 pb-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div class="min-w-0">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                                    Service Point List
                                </CardTitle>
                                <CardDescription>
                                    {{ items.length }} service points on this page · Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                </CardDescription>
                            </div>
                            <div class="flex w-full flex-wrap items-center gap-2 lg:max-w-2xl">
                                <!-- Inline search bar -->
                                <SearchInput
                                    v-model="filters.q"
                                    placeholder="Code, name, location"
                                    class="min-w-0 flex-1"
                                    @keyup.enter="search"
                                />
                                <!-- Options popover -->
                                <Popover>
                                    <PopoverTrigger as-child>
                                        <Button variant="outline" size="sm" class="gap-1.5">
                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                            Options
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" class="flex max-h-[28rem] w-[20rem] flex-col overflow-hidden rounded-md border bg-popover p-0 shadow-md">
                                        <div class="space-y-3 border-b px-4 py-3">
                                            <p class="flex items-center gap-2 text-sm font-medium">
                                                <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                Filters
                                            </p>
                                            <div class="grid gap-2">
                                                <Label for="sp-status-popover">Status</Label>
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
                                                <Label for="sp-type-popover">Service Point Type</Label>
                                                <Input id="sp-type-popover" v-model="filters.servicePointType" placeholder="e.g. Outpatient, Lab..." />
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="sp-dept-popover">Department</Label>
                                                <Select v-model="filters.departmentId">
                                                    <SelectTrigger class="w-full" :disabled="departmentsLoading">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                    <SelectItem value="">All departments</SelectItem>
                                                    <SelectItem v-for="department in departments" :key="department.id || department.code || department.name" :value="String(department.id ?? '')">
                                                        {{ (department.code && department.name) ? `${department.code} - ${department.name}` : (department.name || department.code || department.id) }}
                                                    </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="sp-per-page-popover">Per page</Label>
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
                                                Search
                                            </Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem] space-y-2 p-4">
                                <div v-if="loading || listLoading" class="space-y-2">
                                    <Skeleton class="h-16 w-full" />
                                    <Skeleton class="h-16 w-full" />
                                    <Skeleton class="h-16 w-full" />
                                </div>
                                <div v-else-if="items.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                    No service points found. Try adjusting your search or filters.
                                </div>
                                <div v-else class="space-y-2">
                                    <div
                                        v-for="item in items"
                                        :key="item.id || item.code || item.name"
                                        class="rounded-lg border p-3 transition-colors"
                                    >
                                        <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                            <div class="space-y-0.5">
                                                <p class="text-sm font-semibold">{{ labelOf(item) }}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    Department: {{ departmentLabelById(item.departmentId) }} · Type: {{ item.servicePointType || 'N/A' }}
                                                </p>
                                                <p class="text-xs text-muted-foreground">Location: {{ item.location || 'N/A' }}</p>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-2">
                                                <Badge :variant="statusVariant(item.status)">{{ item.status || 'unknown' }}</Badge>
                                                <Button v-if="canManage" size="sm" variant="outline" class="gap-1.5" @click="openEdit(item)">
                                                    <AppIcon name="pencil" class="size-3.5" />
                                                    Edit
                                                </Button>
                                                <Button
                                                    v-if="canManage"
                                                    size="sm"
                                                    class="gap-1.5"
                                                    :variant="(item.status ?? '').toLowerCase() === 'active' ? 'destructive' : 'secondary'"
                                                    @click="openStatus(item, (item.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active')"
                                                >
                                                    <AppIcon :name="(item.status ?? '').toLowerCase() === 'active' ? 'ban' : 'circle-check'" class="size-3.5" />
                                                    {{ (item.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}
                                                </Button>
                                                <Button v-if="canAudit" size="sm" variant="outline" class="gap-1.5" @click="loadAudit(item)">
                                                    <AppIcon name="shield-check" class="size-3.5" />
                                                    Audit
                                                </Button>
                                            </div>
                                        </div>
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
                            Service Point List
                        </CardTitle>
                        <CardDescription>Service point access is permission restricted.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle>Access restricted</AlertTitle>
                            <AlertDescription>Request <code>platform.resources.read</code> permission.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <!-- Audit log card -->
                <Card v-if="auditTarget" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="shield-check" class="size-5 text-muted-foreground" />
                            Service Point Audit
                        </CardTitle>
                        <CardDescription>{{ labelOf(auditTarget) }}</CardDescription>
                    </CardHeader>
                    <CardContent>
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
                            <p class="text-sm text-muted-foreground">No audit logs found for this service point.</p>
                        </div>
                        <div v-else class="space-y-2">
                            <div v-for="log in auditLogs" :key="log.id" class="flex items-start gap-3">
                                <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                                    <AppIcon name="activity" class="size-3.5 text-muted-foreground" />
                                </div>
                                <div class="min-w-0 flex-1 pt-0.5">
                                    <p class="text-sm font-medium">{{ log.actionLabel || log.action || 'event' }}</p>
                                    <p class="mt-0.5 text-xs text-muted-foreground">{{ log.createdAt || 'N/A' }} · {{ actorLabel(log) }}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <!-- Create Service Point card -->
                <Card id="create-service-point" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="plus" class="size-5 text-muted-foreground" />
                            Create Service Point
                        </CardTitle>
                        <CardDescription>Add a new service point record.</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-4">
                        <Alert v-if="!canManage" variant="destructive">
                            <AlertTitle>Create access restricted</AlertTitle>
                            <AlertDescription>Request <code>platform.resources.manage-service-points</code> permission.</AlertDescription>
                        </Alert>
                        <template v-else>
                            <div class="grid gap-3 md:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="create-sp-code">Code</Label>
                                    <Input id="create-sp-code" v-model="createForm.code" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-sp-name">Name</Label>
                                    <Input id="create-sp-name" v-model="createForm.name" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-sp-department">Department</Label>
                                    <Select v-model="createForm.departmentId">
                                        <SelectTrigger :disabled="departmentsLoading">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">No department</SelectItem>
                                        <SelectItem v-for="department in departments" :key="department.id || department.code || department.name" :value="String(department.id ?? '')">
                                            {{ (department.code && department.name) ? `${department.code} - ${department.name}` : (department.name || department.code || department.id) }}
                                        </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-sp-type">Service Point Type</Label>
                                    <Input id="create-sp-type" v-model="createForm.servicePointType" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="create-sp-location">Location</Label>
                                    <Input id="create-sp-location" v-model="createForm.location" />
                                </div>
                                <div class="grid gap-2 md:col-span-2">
                                    <Label for="create-sp-notes">Notes</Label>
                                    <Textarea id="create-sp-notes" v-model="createForm.notes" class="min-h-20" />
                                </div>
                            </div>
                            <Separator />
                            <div class="flex justify-end">
                                <Button :disabled="createLoading" class="gap-1.5" @click="createItem">
                                    <AppIcon name="plus" class="size-3.5" />
                                    {{ createLoading ? 'Creating...' : 'Create Service Point' }}
                                </Button>
                            </div>
                        </template>
                    </CardContent>
                </Card>
            </div>

            <!-- Edit Service Point dialog -->
            <Dialog :open="editOpen" @update:open="(open) => (editOpen = open)">
                <DialogContent size="xl">
                    <DialogHeader>
                        <DialogTitle>Edit Service Point</DialogTitle>
                        <DialogDescription>Update service point metadata.</DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-3">
                        <div class="grid gap-2">
                            <Label for="edit-sp-code">Code</Label>
                            <Input id="edit-sp-code" v-model="editForm.code" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-sp-name">Name</Label>
                            <Input id="edit-sp-name" v-model="editForm.name" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-sp-department">Department</Label>
                            <Select v-model="editForm.departmentId">
                                <SelectTrigger :disabled="departmentsLoading">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="">No department</SelectItem>
                                <SelectItem v-for="department in departments" :key="department.id || department.code || department.name" :value="String(department.id ?? '')">
                                    {{ (department.code && department.name) ? `${department.code} - ${department.name}` : (department.name || department.code || department.id) }}
                                </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-sp-type">Service Point Type</Label>
                            <Input id="edit-sp-type" v-model="editForm.servicePointType" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-sp-location">Location</Label>
                            <Input id="edit-sp-location" v-model="editForm.location" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="edit-sp-notes">Notes</Label>
                            <Textarea id="edit-sp-notes" v-model="editForm.notes" class="min-h-20" />
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
                        <DialogTitle>{{ statusTarget === 'inactive' ? 'Deactivate Service Point' : 'Activate Service Point' }}</DialogTitle>
                        <DialogDescription>{{ statusTarget === 'inactive' ? 'Reason is required before deactivating.' : 'Confirm activation of this service point.' }}</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="statusError" variant="destructive">
                            <AlertTitle>Status update failed</AlertTitle>
                            <AlertDescription>{{ statusError }}</AlertDescription>
                        </Alert>
                        <div v-if="statusTarget === 'inactive'" class="grid gap-2">
                            <Label for="sp-status-reason">Reason</Label>
                            <Textarea id="sp-status-reason" v-model="statusReason" class="min-h-20" placeholder="Required reason for deactivation" />
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
