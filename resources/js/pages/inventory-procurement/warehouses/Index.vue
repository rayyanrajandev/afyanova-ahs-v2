<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import type { AppIconName } from '@/lib/icons';
import { INVENTORY_PROCUREMENT_HOME_PATH } from '@/lib/inventoryProcurement';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import SupplyChainFilterPopover from '@/pages/inventory-procurement/components/SupplyChainFilterPopover.vue';
import { type BreadcrumbItem } from '@/types';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type StatusCounts = { active: number; inactive: number; other: number; total: number };
type Warehouse = {
    id: string | null;
    warehouseCode: string | null;
    warehouseName: string | null;
    warehouseType: string | null;
    location: string | null;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};
type AuditLog = {
    id: string;
    actorId: number | null;
    actor?: { displayName?: string | null } | null;
    action: string | null;
    actionLabel?: string | null;
    createdAt: string | null;
};
type ListResponse<T> = { data: T[]; meta: Pagination };
type ItemResponse<T> = { data: T };
type StatusResponse = { data: StatusCounts };
type AuditResponse = { data: AuditLog[]; meta: Pagination };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: '/inventory-procurement' },
    { title: 'Warehouses', href: '/inventory-procurement/warehouses' },
];

const { permissionNames: sharedPermissionNames, permissionState, scope: platformScope } = usePlatformAccess();
const permissionsResolved = computed(() => sharedPermissionNames.value !== null);
const canRead = computed(() => permissionState('inventory.procurement.read') === 'allowed');
const canManage = computed(() => permissionState('inventory.procurement.manage-warehouses') === 'allowed');
const canAudit = computed(() => permissionState('inventory.procurement.view-audit-logs') === 'allowed');

const EMPTY_SELECT_VALUE = '__warehouses_empty_select__';

function toSelectValue(value: string | null | undefined): string {
    return value == null || value === '' ? EMPTY_SELECT_VALUE : value;
}

function fromSelectValue(value: string): string {
    return value === EMPTY_SELECT_VALUE ? '' : value;
}

const loading = ref(true);
const listLoading = ref(false);
const errors = ref<string[]>([]);
const items = ref<Warehouse[]>([]);
const pagination = ref<Pagination | null>(null);
const counts = ref<StatusCounts>({ active: 0, inactive: 0, other: 0, total: 0 });
const filters = reactive({ q: '', status: '', warehouseType: '', page: 1, perPage: 20 });
const hasActiveFilters = computed(() => filters.q.trim() !== '' || filters.status !== '' || filters.warehouseType.trim() !== '');
const filterCountForBadge = computed(() => {
    let c = 0;
    if (filters.status) c++;
    if (filters.warehouseType) c++;
    return c;
});

const createOpen = ref(false);
const createLoading = ref(false);
const createForm = reactive({
    warehouseCode: '',
    warehouseName: '',
    warehouseType: '',
    location: '',
    contactPerson: '',
    phone: '',
    email: '',
    notes: '',
});

const editOpen = ref(false);
const editLoading = ref(false);
const editTarget = ref<Warehouse | null>(null);
const editForm = reactive({
    warehouseCode: '',
    warehouseName: '',
    warehouseType: '',
    location: '',
    contactPerson: '',
    phone: '',
    email: '',
    notes: '',
});

const statusOpen = ref(false);
const statusLoading = ref(false);
const statusError = ref<string | null>(null);
const statusTarget = ref<'active' | 'inactive'>('active');
const statusReason = ref('');
const statusItem = ref<Warehouse | null>(null);

const auditTarget = ref<Warehouse | null>(null);
const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<AuditLog[]>([]);

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> },
): Promise<T> {
    return apiRequestJson<T>(method, path, options);
}

function labelOf(item: Warehouse | null): string {
    if (!item) return 'Unknown warehouse';
    if (item.warehouseCode && item.warehouseName) return `${item.warehouseCode} - ${item.warehouseName}`;
    return item.warehouseName || item.warehouseCode || item.id || 'Unknown warehouse';
}

function warehouseRowKey(item: Warehouse, index: number): string {
    return item.id || item.warehouseCode || item.warehouseName || `warehouse-row-${index}`;
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

async function loadCounts() {
    if (!canRead.value) return;
    try {
        const response = await apiRequest<StatusResponse>('GET', '/inventory-procurement/warehouses/status-counts', {
            query: { q: filters.q.trim() || null, warehouseType: filters.warehouseType.trim() || null },
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
        const response = await apiRequest<ListResponse<Warehouse>>('GET', '/inventory-procurement/warehouses', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                warehouseType: filters.warehouseType.trim() || null,
                page: filters.page,
                perPage: filters.perPage,
                sortBy: 'warehouseName',
                sortDir: 'asc',
            },
        });
        items.value = response.data ?? [];
        pagination.value = response.meta ?? null;
    } catch (error) {
        items.value = [];
        pagination.value = null;
        errors.value.push(messageFromUnknown(error, 'Unable to load warehouses.'));
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
        const response = await apiRequest<ItemResponse<Warehouse>>('POST', '/inventory-procurement/warehouses', {
            body: {
                warehouseCode: createForm.warehouseCode.trim(),
                warehouseName: createForm.warehouseName.trim(),
                warehouseType: createForm.warehouseType.trim() || null,
                location: createForm.location.trim() || null,
                contactPerson: createForm.contactPerson.trim() || null,
                phone: createForm.phone.trim() || null,
                email: createForm.email.trim() || null,
                notes: createForm.notes.trim() || null,
            },
        });
        notifySuccess(`Created ${labelOf(response.data)}.`);
        Object.assign(createForm, { warehouseCode: '', warehouseName: '', warehouseType: '', location: '', contactPerson: '', phone: '', email: '', notes: '' });
        createOpen.value = false;
        filters.page = 1;
        await refreshPage();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create warehouse.'));
    } finally { createLoading.value = false; }
}

function openEdit(item: Warehouse) {
    editTarget.value = item;
    Object.assign(editForm, {
        warehouseCode: item.warehouseCode || '',
        warehouseName: item.warehouseName || '',
        warehouseType: item.warehouseType || '',
        location: item.location || '',
        contactPerson: item.contactPerson || '',
        phone: item.phone || '',
        email: item.email || '',
        notes: item.notes || '',
    });
    editOpen.value = true;
}

async function saveEdit() {
    const id = editTarget.value?.id?.trim();
    if (!id || !canManage.value || editLoading.value) return;
    editLoading.value = true;
    try {
        await apiRequest<ItemResponse<Warehouse>>('PATCH', `/inventory-procurement/warehouses/${id}`, {
            body: {
                warehouseCode: editForm.warehouseCode.trim(),
                warehouseName: editForm.warehouseName.trim(),
                warehouseType: editForm.warehouseType.trim() || null,
                location: editForm.location.trim() || null,
                contactPerson: editForm.contactPerson.trim() || null,
                phone: editForm.phone.trim() || null,
                email: editForm.email.trim() || null,
                notes: editForm.notes.trim() || null,
            },
        });
        notifySuccess('Warehouse updated.');
        editOpen.value = false;
        await refreshPage();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update warehouse.'));
    } finally { editLoading.value = false; }
}

function openStatus(item: Warehouse, target: 'active' | 'inactive') {
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
        await apiRequest<ItemResponse<Warehouse>>('PATCH', `/inventory-procurement/warehouses/${id}/status`, {
            body: { status: statusTarget.value, reason: statusTarget.value === 'inactive' ? statusReason.value.trim() : null },
        });
        notifySuccess('Warehouse status updated.');
        statusOpen.value = false;
        await refreshPage();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update warehouse status.');
    } finally { statusLoading.value = false; }
}

async function loadAudit(item: Warehouse) {
    const id = item.id?.trim();
    if (!id || !canAudit.value) return;
    auditTarget.value = item;
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await apiRequest<AuditResponse>('GET', `/inventory-procurement/warehouses/${id}/audit-logs`, { query: { page: 1, perPage: 20 } });
        auditLogs.value = response.data ?? [];
    } catch (error) {
        auditLogs.value = [];
        auditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
    } finally { auditLoading.value = false; }
}

function search() { filters.page = 1; void refreshPage(); }
function reset() { filters.q = ''; filters.status = ''; filters.warehouseType = ''; filters.page = 1; void refreshPage(); }
function setStatus(status: '' | 'active' | 'inactive') { filters.status = status; filters.page = 1; void refreshPage(); }
function prevPage() { if ((pagination.value?.currentPage ?? 1) > 1) { filters.page -= 1; void loadItems(); } }
function nextPage() { if (pagination.value && pagination.value.currentPage < pagination.value.lastPage) { filters.page += 1; void loadItems(); } }

onMounted(() => {
    void refreshPage();
});

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Warehouses" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Warehouses</h1>
                            <Badge v-if="permissionsResolved && !canRead" variant="outline" class="h-5 px-1.5 text-[10px] font-medium">
                                View only
                            </Badge>
                        </div>
                        <p class="text-xs text-muted-foreground">Warehouse and store locations, contacts, and lifecycle status</p>
                    </div>
                    <div class="flex shrink-0 flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" class="h-8 w-8 p-0" :disabled="listLoading" title="Refresh" @click="refreshPage">
                            <AppIcon :name="(listLoading ? 'loader-circle' : 'refresh-cw') as AppIconName" class="size-3.5" :class="listLoading ? 'animate-spin' : ''" />
                        </Button>
                        <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="createOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            Create warehouse
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                                    <AppIcon name="ellipsis-vertical" class="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" class="w-48">
                                <DropdownMenuItem as-child>
                                    <Link :href="INVENTORY_PROCUREMENT_HOME_PATH" class="gap-2">
                                        <AppIcon name="layout-grid" class="size-4" /> Supply chain home
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link href="/inventory-procurement/stock-control" class="gap-2">
                                        <AppIcon name="package" class="size-4" /> Stock Control
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link href="/inventory-procurement/procurement" class="gap-2">
                                        <AppIcon name="clipboard-list" class="size-4" /> Procurement
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link href="/inventory-procurement/suppliers" class="gap-2">
                                        <AppIcon name="truck" class="size-4" /> Suppliers
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <template v-if="canRead">
                    <div class="mt-3 grid grid-cols-3 gap-2">
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                            <p class="text-sm font-bold tabular-nums">{{ counts.total.toLocaleString() }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Active</p>
                            <p class="text-sm font-bold tabular-nums">{{ counts.active.toLocaleString() }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Inactive</p>
                            <p class="text-sm font-bold tabular-nums">{{ counts.inactive.toLocaleString() }}</p>
                        </div>
                    </div>

                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        <div class="relative min-w-72 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <input
                                v-model="filters.q"
                                class="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                placeholder="Code, name, location"
                                @keydown.enter="search"
                            />
                        </div>
                        <Select :model-value="toSelectValue(filters.status)" @update:model-value="setStatus(fromSelectValue(String($event ?? EMPTY_SELECT_VALUE)) as '' | 'active' | 'inactive')">
                            <SelectTrigger class="h-9 w-36 bg-background"><SelectValue placeholder="All statuses" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="EMPTY_SELECT_VALUE">All statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                        <input v-model="filters.warehouseType" class="h-9 w-44 rounded-lg border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Warehouse type" @keydown.enter="search" />
                        <Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event); search()">
                            <SelectTrigger class="h-9 w-24 bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" class="h-9 gap-1.5" :disabled="listLoading" @click="search">
                            <AppIcon name="search" class="size-3.5" />
                            Search
                        </Button>
                        <Button v-if="hasActiveFilters" size="sm" variant="outline" class="h-9 gap-1.5" @click="reset">Reset</Button>
                    </div>
                </template>
            </div>

            <div v-if="!canRead" class="px-6">
                <Alert variant="destructive">
                    <AlertTitle>Access restricted</AlertTitle>
                    <AlertDescription>Request <code>inventory.procurement.read</code> permission.</AlertDescription>
                </Alert>
            </div>

            <div v-if="canRead" class="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-6">

                <!-- Alerts -->
                <Alert v-if="errors.length" variant="destructive">
                    <AlertTitle>Request error</AlertTitle>
                    <AlertDescription>
                        <p v-for="errorMessage in errors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p>
                    </AlertDescription>
                </Alert>

                <!-- Warehouse list card -->
                <Card class="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem] space-y-2 p-4">
                                <div v-if="loading || listLoading" class="space-y-2">
                                    <Skeleton class="h-16 w-full" />
                                    <Skeleton class="h-16 w-full" />
                                    <Skeleton class="h-16 w-full" />
                                </div>
                                <div v-else-if="items.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                    <template v-if="!hasActiveFilters && counts.total === 0">
                                        No warehouses exist yet. This is setup step 1 because receiving, transfers, and stock controls need a physical store before anything else can run.
                                    </template>
                                    <template v-else>
                                        No warehouses matched the current search or filters.
                                    </template>
                                </div>
                                <div v-else class="space-y-2">
                                    <div
                                        v-for="(item, index) in items"
                                        :key="warehouseRowKey(item, index)"
                                        class="rounded-lg border p-3 transition-colors"
                                    >
                                        <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                            <div class="space-y-0.5">
                                                <p class="text-sm font-semibold">{{ labelOf(item) }}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    Type: {{ item.warehouseType || 'N/A' }} · Contact: {{ item.contactPerson || 'N/A' }}
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    Location: {{ item.location || 'N/A' }} · Phone: {{ item.phone || 'N/A' }}
                                                </p>
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
                                                    <AppIcon :name="(item.status ?? '').toLowerCase() === 'active' ? 'circle-x' : 'circle-check-big'" class="size-3.5" />
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

                <!-- Audit log card -->
                <Card v-if="auditTarget" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="shield-check" class="size-5 text-muted-foreground" />
                            Warehouse Audit
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
                            <p class="text-sm text-muted-foreground">No audit logs found for this warehouse.</p>
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

            </div>

            <!-- Create Warehouse sheet -->
            <Sheet :open="createOpen" @update:open="createOpen = $event">
                <SheetContent side="right" variant="form" size="4xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="folder" class="size-5 text-muted-foreground" />
                            Create Warehouse
                        </SheetTitle>
                        <SheetDescription>Register a new warehouse or store location.</SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="px-6 py-4 grid gap-4">
                            <Alert v-if="!canManage" variant="destructive">
                                <AlertTitle>Create access restricted</AlertTitle>
                                <AlertDescription>Request <code>inventory.procurement.manage-warehouses</code> permission.</AlertDescription>
                            </Alert>
                            <template v-else>
                                <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Identification</legend>
                                    <div class="grid gap-2">
                                        <Label for="create-wh-code">Warehouse Code</Label>
                                        <Input id="create-wh-code" v-model="createForm.warehouseCode" :disabled="createLoading" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="create-wh-name">Warehouse Name</Label>
                                        <Input id="create-wh-name" v-model="createForm.warehouseName" :disabled="createLoading" />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="create-wh-type">Warehouse Type</Label>
                                        <Input id="create-wh-type" v-model="createForm.warehouseType" :disabled="createLoading" placeholder="e.g. Main Store, Pharmacy, Cold Room" />
                                    </div>
                                </fieldset>
                                <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Location &amp; Contact</legend>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="create-wh-location">Location</Label>
                                        <Input id="create-wh-location" v-model="createForm.location" :disabled="createLoading" placeholder="Building, floor, or address" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="create-wh-contact">Contact Person</Label>
                                        <Input id="create-wh-contact" v-model="createForm.contactPerson" :disabled="createLoading" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="create-wh-phone">Phone</Label>
                                        <Input id="create-wh-phone" v-model="createForm.phone" :disabled="createLoading" />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="create-wh-email">Email</Label>
                                        <Input id="create-wh-email" v-model="createForm.email" :disabled="createLoading" type="email" />
                                    </div>
                                </fieldset>
                                <fieldset class="rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Notes</legend>
                                    <Textarea id="create-wh-notes" v-model="createForm.notes" :disabled="createLoading" class="min-h-24" placeholder="Optional operational notes" />
                                </fieldset>
                            </template>
                        </div>
                    </ScrollArea>
                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button variant="outline" @click="createOpen = false">Cancel</Button>
                        <Button :disabled="createLoading || !canManage" class="gap-1.5" @click="createItem">
                            <AppIcon name="plus" class="size-3.5" />
                            {{ createLoading ? 'Creating...' : 'Create Warehouse' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Edit Warehouse sheet -->
            <Sheet :open="editOpen" @update:open="editOpen = $event">
                <SheetContent side="right" variant="form" size="4xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="pencil" class="size-5 text-muted-foreground" />
                            Edit Warehouse
                        </SheetTitle>
                        <SheetDescription>{{ labelOf(editTarget) }}</SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="px-6 py-4 grid gap-4">
                            <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Identification</legend>
                                <div class="grid gap-2">
                                    <Label for="edit-wh-code">Warehouse Code</Label>
                                    <Input id="edit-wh-code" v-model="editForm.warehouseCode" :disabled="editLoading" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="edit-wh-name">Warehouse Name</Label>
                                    <Input id="edit-wh-name" v-model="editForm.warehouseName" :disabled="editLoading" />
                                </div>
                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="edit-wh-type">Warehouse Type</Label>
                                    <Input id="edit-wh-type" v-model="editForm.warehouseType" :disabled="editLoading" placeholder="e.g. Main Store, Pharmacy, Cold Room" />
                                </div>
                            </fieldset>
                            <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Location &amp; Contact</legend>
                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="edit-wh-location">Location</Label>
                                    <Input id="edit-wh-location" v-model="editForm.location" :disabled="editLoading" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="edit-wh-contact">Contact Person</Label>
                                    <Input id="edit-wh-contact" v-model="editForm.contactPerson" :disabled="editLoading" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="edit-wh-phone">Phone</Label>
                                    <Input id="edit-wh-phone" v-model="editForm.phone" :disabled="editLoading" />
                                </div>
                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="edit-wh-email">Email</Label>
                                    <Input id="edit-wh-email" v-model="editForm.email" :disabled="editLoading" type="email" />
                                </div>
                            </fieldset>
                            <fieldset class="rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Notes</legend>
                                <Textarea id="edit-wh-notes" v-model="editForm.notes" :disabled="editLoading" class="min-h-24" />
                            </fieldset>
                        </div>
                    </ScrollArea>
                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button variant="outline" :disabled="editLoading" @click="editOpen = false">Cancel</Button>
                        <Button :disabled="editLoading" class="gap-1.5" @click="saveEdit">
                            <AppIcon name="check" class="size-3.5" />
                            {{ editLoading ? 'Saving...' : 'Save Changes' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Status update dialog -->
            <Dialog :open="statusOpen" @update:open="(open) => (statusOpen = open)">
                <DialogContent variant="action" size="lg">
                    <DialogHeader>
                        <DialogTitle>{{ statusTarget === 'inactive' ? 'Deactivate Warehouse' : 'Activate Warehouse' }}</DialogTitle>
                        <DialogDescription>{{ statusTarget === 'inactive' ? 'Reason is required before deactivating.' : 'Confirm activation of this warehouse.' }}</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="statusError" variant="destructive">
                            <AlertTitle>Status update failed</AlertTitle>
                            <AlertDescription>{{ statusError }}</AlertDescription>
                        </Alert>
                        <div v-if="statusTarget === 'inactive'" class="grid gap-2">
                            <Label for="wh-status-reason">Reason</Label>
                            <Textarea id="wh-status-reason" v-model="statusReason" class="min-h-20" placeholder="Required reason for deactivation" />
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
