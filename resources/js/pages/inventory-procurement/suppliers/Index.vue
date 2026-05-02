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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type StatusCounts = { active: number; inactive: number; other: number; total: number };
type Supplier = {
    id: string | null;
    supplierCode: string | null;
    supplierName: string | null;
    tinNumber: string | null;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    addressLine: string | null;
    countryCode: string | null;
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
type SupplierCountryOption = { code: string; name: string };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inventory & Procurement', href: '/inventory-procurement' },
    { title: 'Suppliers', href: '/inventory-procurement/suppliers' },
];

const { permissionState } = usePlatformAccess();
const { countryProfileCatalog, loadCountryProfile } = usePlatformCountryProfile();
const canRead = computed(() => permissionState('inventory.procurement.read') === 'allowed');
const canManage = computed(() => permissionState('inventory.procurement.manage-suppliers') === 'allowed');
const canAudit = computed(() => permissionState('inventory.procurement.view-audit-logs') === 'allowed');

const EMPTY_SELECT_VALUE = '__empty__';

function toSelectValue(value: string | null | undefined): string {
    return value == null || value === '' ? EMPTY_SELECT_VALUE : value;
}

function fromSelectValue(value: string): string {
    return value === EMPTY_SELECT_VALUE ? '' : value;
}

const loading = ref(true);
const listLoading = ref(false);
const errors = ref<string[]>([]);
const items = ref<Supplier[]>([]);
const pagination = ref<Pagination | null>(null);
const counts = ref<StatusCounts>({ active: 0, inactive: 0, other: 0, total: 0 });
const filters = reactive({ q: '', status: '', countryCode: '', page: 1, perPage: 20 });
const hasActiveFilters = computed(() => filters.q.trim() !== '' || filters.status !== '' || filters.countryCode.trim() !== '');

const createLoading = ref(false);
const createForm = reactive({
    supplierCode: '',
    supplierName: '',
    tinNumber: '',
    contactPerson: '',
    phone: '',
    email: '',
    addressLine: '',
    countryCode: '',
    notes: '',
});

const createOpen = ref(false);
const editOpen = ref(false);
const editLoading = ref(false);
const editTarget = ref<Supplier | null>(null);
const editForm = reactive({
    supplierCode: '',
    supplierName: '',
    tinNumber: '',
    contactPerson: '',
    phone: '',
    email: '',
    addressLine: '',
    countryCode: '',
    notes: '',
});

const statusOpen = ref(false);
const statusLoading = ref(false);
const statusError = ref<string | null>(null);
const statusTarget = ref<'active' | 'inactive'>('active');
const statusReason = ref('');
const statusItem = ref<Supplier | null>(null);

const auditTarget = ref<Supplier | null>(null);
const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<AuditLog[]>([]);

function normalizeCountryCode(value: string | null | undefined): string {
    return (value ?? '').trim().toUpperCase();
}

const supplierCountryOptions = computed(() =>
    countryProfileCatalog.value
        .map((profile) => {
            const code = normalizeCountryCode(profile.code);
            if (!code) return null;

            return {
                code,
                name: (profile.name ?? '').trim() || code,
            } satisfies SupplierCountryOption;
        })
        .filter((option): option is SupplierCountryOption => option !== null),
);

function supplierCountryOptionsForSelect(currentCode: string | null | undefined): SupplierCountryOption[] {
    const normalized = normalizeCountryCode(currentCode);
    const baseOptions = supplierCountryOptions.value;

    if (!normalized || baseOptions.some((option) => option.code === normalized)) {
        return baseOptions;
    }

    return [{ code: normalized, name: normalized }, ...baseOptions];
}

function countryDisplayLabel(code: string | null | undefined): string {
    const normalized = normalizeCountryCode(code);
    if (!normalized) return 'N/A';

    const option = supplierCountryOptions.value.find((candidate) => candidate.code === normalized);

    return option ? `${option.name} (${option.code})` : normalized;
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> },
): Promise<T> {
    return apiRequestJson<T>(method, path, options);
}

function labelOf(item: Supplier | null): string {
    if (!item) return 'Unknown supplier';
    if (item.supplierCode && item.supplierName) return `${item.supplierCode} - ${item.supplierName}`;
    return item.supplierName || item.supplierCode || item.id || 'Unknown supplier';
}

function supplierRowKey(item: Supplier, index: number): string {
    return item.id || item.supplierCode || item.supplierName || `supplier-row-${index}`;
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
        const response = await apiRequest<StatusResponse>('GET', '/inventory-procurement/suppliers/status-counts', {
            query: { q: filters.q.trim() || null, countryCode: filters.countryCode.trim().toUpperCase() || null },
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
        const response = await apiRequest<ListResponse<Supplier>>('GET', '/inventory-procurement/suppliers', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                countryCode: filters.countryCode.trim().toUpperCase() || null,
                page: filters.page,
                perPage: filters.perPage,
                sortBy: 'supplierName',
                sortDir: 'asc',
            },
        });
        items.value = response.data ?? [];
        pagination.value = response.meta ?? null;
    } catch (error) {
        items.value = [];
        pagination.value = null;
        errors.value.push(messageFromUnknown(error, 'Unable to load suppliers.'));
    } finally {
        loading.value = false;
        listLoading.value = false;
    }
}

async function refreshPage() { await Promise.all([loadCountryProfile(), loadItems(), loadCounts()]); }

async function createItem() {
    if (!canManage.value || createLoading.value) return;
    createLoading.value = true;
    try {
        const response = await apiRequest<ItemResponse<Supplier>>('POST', '/inventory-procurement/suppliers', {
            body: {
                supplierCode: createForm.supplierCode.trim(),
                supplierName: createForm.supplierName.trim(),
                tinNumber: createForm.tinNumber.trim() || null,
                contactPerson: createForm.contactPerson.trim() || null,
                phone: createForm.phone.trim() || null,
                email: createForm.email.trim() || null,
                addressLine: createForm.addressLine.trim() || null,
                countryCode: createForm.countryCode.trim().toUpperCase() || null,
                notes: createForm.notes.trim() || null,
            },
        });
        notifySuccess(`Created ${labelOf(response.data)}.`);
        Object.assign(createForm, { supplierCode: '', supplierName: '', tinNumber: '', contactPerson: '', phone: '', email: '', addressLine: '', countryCode: '', notes: '' });
        createOpen.value = false;
        filters.page = 1;
        await refreshPage();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create supplier.'));
    } finally { createLoading.value = false; }
}

function openEdit(item: Supplier) {
    editTarget.value = item;
    Object.assign(editForm, {
        supplierCode: item.supplierCode || '',
        supplierName: item.supplierName || '',
        tinNumber: item.tinNumber || '',
        contactPerson: item.contactPerson || '',
        phone: item.phone || '',
        email: item.email || '',
        addressLine: item.addressLine || '',
        countryCode: item.countryCode || '',
        notes: item.notes || '',
    });
    editOpen.value = true;
}

async function saveEdit() {
    const id = editTarget.value?.id?.trim();
    if (!id || !canManage.value || editLoading.value) return;
    editLoading.value = true;
    try {
        await apiRequest<ItemResponse<Supplier>>('PATCH', `/inventory-procurement/suppliers/${id}`, {
            body: {
                supplierCode: editForm.supplierCode.trim(),
                supplierName: editForm.supplierName.trim(),
                tinNumber: editForm.tinNumber.trim() || null,
                contactPerson: editForm.contactPerson.trim() || null,
                phone: editForm.phone.trim() || null,
                email: editForm.email.trim() || null,
                addressLine: editForm.addressLine.trim() || null,
                countryCode: editForm.countryCode.trim().toUpperCase() || null,
                notes: editForm.notes.trim() || null,
            },
        });
        notifySuccess('Supplier updated.');
        editOpen.value = false;
        await refreshPage();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update supplier.'));
    } finally { editLoading.value = false; }
}

function openStatus(item: Supplier, target: 'active' | 'inactive') {
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
        await apiRequest<ItemResponse<Supplier>>('PATCH', `/inventory-procurement/suppliers/${id}/status`, {
            body: { status: statusTarget.value, reason: statusTarget.value === 'inactive' ? statusReason.value.trim() : null },
        });
        notifySuccess('Supplier status updated.');
        statusOpen.value = false;
        await refreshPage();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update supplier status.');
    } finally { statusLoading.value = false; }
}

async function loadAudit(item: Supplier) {
    const id = item.id?.trim();
    if (!id || !canAudit.value) return;
    auditTarget.value = item;
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await apiRequest<AuditResponse>('GET', `/inventory-procurement/suppliers/${id}/audit-logs`, { query: { page: 1, perPage: 20 } });
        auditLogs.value = response.data ?? [];
    } catch (error) {
        auditLogs.value = [];
        auditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
    } finally { auditLoading.value = false; }
}

function search() { filters.page = 1; void refreshPage(); }
function reset() { filters.q = ''; filters.status = ''; filters.countryCode = ''; filters.page = 1; void refreshPage(); }
function setStatus(status: '' | 'active' | 'inactive') { filters.status = status; filters.page = 1; void refreshPage(); }
function prevPage() { if ((pagination.value?.currentPage ?? 1) > 1) { filters.page -= 1; void loadItems(); } }
function nextPage() { if (pagination.value && pagination.value.currentPage < pagination.value.lastPage) { filters.page += 1; void loadItems(); } }

onMounted(() => {
    void refreshPage();
});
</script>

<template>
    <Head title="Suppliers" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">

            <!-- Page header -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="package" class="size-7 text-primary" />
                        Supplier Registry
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">Manage supplier master data and status.</p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" :disabled="listLoading" class="gap-1.5" @click="refreshPage">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button size="sm" class="h-8 gap-1.5" @click="createOpen = true">
                        <AppIcon name="plus" class="size-3.5" />
                        Create Supplier
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

                <!-- Supplier list card -->
                <Card v-if="canRead" class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70">
                    <CardHeader class="shrink-0 gap-3 pb-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div class="min-w-0">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                                    Supplier List
                                </CardTitle>
                                <CardDescription>
                                    {{ items.length }} suppliers on this page · Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                </CardDescription>
                            </div>
                            <div class="flex w-full flex-wrap items-center gap-2 lg:max-w-2xl">
                                <!-- Inline search bar -->
                                <SearchInput
                                    v-model="filters.q"
                                    placeholder="Code, name, contact"
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
                                                <Label for="sup-status-popover">Status</Label>
                                                <Select :model-value="toSelectValue(filters.status)" @update:model-value="filters.status = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                    <SelectTrigger class="w-full">
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
                                                <Label for="sup-country-popover">Country</Label>
                                                <Select :model-value="toSelectValue(filters.countryCode)" @update:model-value="filters.countryCode = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                                    <SelectTrigger class="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                    <SelectItem :value="EMPTY_SELECT_VALUE">All countries</SelectItem>
                                                    <SelectItem
                                                        v-for="option in supplierCountryOptionsForSelect(filters.countryCode)"
                                                        :key="option.code"
                                                        :value="option.code"
                                                    >
                                                        {{ option.name }} ({{ option.code }})
                                                    </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="sup-per-page-popover">Per page</Label>
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
                                    <template v-if="!hasActiveFilters && counts.total === 0">
                                        No suppliers exist yet. This is setup step 2 after warehouses, and procurement should not start until at least one active supplier is registered.
                                    </template>
                                    <template v-else>
                                        No suppliers matched the current search or filters.
                                    </template>
                                </div>
                                <div v-else class="space-y-2">
                                    <div
                                        v-for="(item, index) in items"
                                        :key="supplierRowKey(item, index)"
                                        class="rounded-lg border p-3 transition-colors"
                                    >
                                        <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                            <div class="space-y-0.5">
                                                <p class="text-sm font-semibold">{{ labelOf(item) }}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    Contact: {{ item.contactPerson || 'N/A' }} · Phone: {{ item.phone || 'N/A' }} · Country: {{ countryDisplayLabel(item.countryCode) }}
                                                </p>
                                                <p class="text-xs text-muted-foreground">{{ item.email || 'No email' }}{{ item.tinNumber ? ` · TIN: ${item.tinNumber}` : '' }}</p>
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
                            Supplier List
                        </CardTitle>
                        <CardDescription>Supplier access is permission restricted.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle>Access restricted</AlertTitle>
                            <AlertDescription>Request <code>inventory.procurement.read</code> permission.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <!-- Audit log card -->
                <Card v-if="auditTarget" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="shield-check" class="size-5 text-muted-foreground" />
                            Supplier Audit
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
                            <p class="text-sm text-muted-foreground">No audit logs found for this supplier.</p>
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

            <Sheet :open="createOpen" @update:open="createOpen = $event">
                <SheetContent side="right" variant="form" size="4xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="plus" class="size-5 text-primary" />
                            Create Supplier
                        </SheetTitle>
                        <SheetDescription>Add a new supplier record to the registry.</SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="px-6 py-4 grid gap-4">
                            <Alert v-if="!canManage" variant="destructive">
                                <AlertTitle>Create access restricted</AlertTitle>
                                <AlertDescription>Request <code>inventory.procurement.manage-suppliers</code> permission.</AlertDescription>
                            </Alert>

                            <form v-else class="grid gap-4" @submit.prevent="createItem">
                                <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Identification</legend>
                                    <div class="grid gap-2">
                                        <Label for="cs-code">Supplier Code</Label>
                                        <Input id="cs-code" v-model="createForm.supplierCode" :disabled="createLoading" placeholder="e.g. SUP-001" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="cs-name">Supplier Name</Label>
                                        <Input id="cs-name" v-model="createForm.supplierName" :disabled="createLoading" placeholder="Full legal name" />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="cs-tin">TIN Number</Label>
                                        <Input id="cs-tin" v-model="createForm.tinNumber" :disabled="createLoading" placeholder="e.g. 100123456" />
                                        <p class="text-xs text-muted-foreground">Tax Identification Number. Required for VAT-registered suppliers.</p>
                                    </div>
                                </fieldset>

                                <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Contact Details</legend>
                                    <div class="grid gap-2">
                                        <Label for="cs-contact">Contact Person</Label>
                                        <Input id="cs-contact" v-model="createForm.contactPerson" :disabled="createLoading" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="cs-phone">Phone</Label>
                                        <Input id="cs-phone" v-model="createForm.phone" :disabled="createLoading" type="tel" />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="cs-email">Email</Label>
                                        <Input id="cs-email" v-model="createForm.email" :disabled="createLoading" type="email" />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="cs-address">Address</Label>
                                        <Textarea id="cs-address" v-model="createForm.addressLine" :disabled="createLoading" class="min-h-20" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="cs-country">Country</Label>
                                        <Select :model-value="toSelectValue(createForm.countryCode)" @update:model-value="createForm.countryCode = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                            <SelectTrigger class="w-full" :disabled="createLoading">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem :value="EMPTY_SELECT_VALUE">Select country</SelectItem>
                                            <SelectItem
                                                v-for="option in supplierCountryOptionsForSelect(createForm.countryCode)"
                                                :key="option.code"
                                                :value="option.code"
                                            >
                                                {{ option.name }} ({{ option.code }})
                                            </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </fieldset>

                                <fieldset class="grid gap-3 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Notes</legend>
                                    <div class="grid gap-2">
                                        <Label for="cs-notes">Internal Notes</Label>
                                        <Textarea id="cs-notes" v-model="createForm.notes" :disabled="createLoading" class="min-h-20" />
                                    </div>
                                </fieldset>
                            </form>
                        </div>
                    </ScrollArea>
                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button type="button" variant="outline" :disabled="createLoading" @click="createOpen = false">Cancel</Button>
                        <Button type="button" :disabled="createLoading || !canManage" class="gap-1.5" @click="createItem">
                            <AppIcon name="plus" class="size-3.5" />
                            {{ createLoading ? 'Creating...' : 'Create Supplier' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Edit Supplier sheet -->
            <Sheet :open="editOpen" @update:open="editOpen = $event">
                <SheetContent side="right" variant="form" size="4xl">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="pencil" class="size-5 text-primary" />
                            Edit Supplier
                        </SheetTitle>
                        <SheetDescription>{{ labelOf(editTarget) }}</SheetDescription>
                    </SheetHeader>

                    <ScrollArea class="min-h-0 flex-1">
                        <div class="px-6 py-4 grid gap-4">
                            <form class="grid gap-4" @submit.prevent="saveEdit">
                                <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Identification</legend>
                                    <div class="grid gap-2">
                                        <Label for="es-code">Supplier Code</Label>
                                        <Input id="es-code" v-model="editForm.supplierCode" :disabled="editLoading" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="es-name">Supplier Name</Label>
                                        <Input id="es-name" v-model="editForm.supplierName" :disabled="editLoading" />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="es-tin">TIN Number</Label>
                                        <Input id="es-tin" v-model="editForm.tinNumber" :disabled="editLoading" placeholder="e.g. 100123456" />
                                        <p class="text-xs text-muted-foreground">Tax Identification Number. Required for VAT-registered suppliers.</p>
                                    </div>
                                </fieldset>

                                <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Contact Details</legend>
                                    <div class="grid gap-2">
                                        <Label for="es-contact">Contact Person</Label>
                                        <Input id="es-contact" v-model="editForm.contactPerson" :disabled="editLoading" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="es-phone">Phone</Label>
                                        <Input id="es-phone" v-model="editForm.phone" :disabled="editLoading" type="tel" />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="es-email">Email</Label>
                                        <Input id="es-email" v-model="editForm.email" :disabled="editLoading" type="email" />
                                    </div>
                                    <div class="grid gap-2 sm:col-span-2">
                                        <Label for="es-address">Address</Label>
                                        <Textarea id="es-address" v-model="editForm.addressLine" :disabled="editLoading" class="min-h-20" />
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="es-country">Country</Label>
                                        <Select :model-value="toSelectValue(editForm.countryCode)" @update:model-value="editForm.countryCode = fromSelectValue(String($event ?? EMPTY_SELECT_VALUE))">
                                            <SelectTrigger class="w-full" :disabled="editLoading">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem :value="EMPTY_SELECT_VALUE">Select country</SelectItem>
                                            <SelectItem
                                                v-for="option in supplierCountryOptionsForSelect(editForm.countryCode)"
                                                :key="option.code"
                                                :value="option.code"
                                            >
                                                {{ option.name }} ({{ option.code }})
                                            </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </fieldset>

                                <fieldset class="grid gap-3 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Notes</legend>
                                    <div class="grid gap-2">
                                        <Label for="es-notes">Internal Notes</Label>
                                        <Textarea id="es-notes" v-model="editForm.notes" :disabled="editLoading" class="min-h-20" />
                                    </div>
                                </fieldset>
                            </form>
                        </div>
                    </ScrollArea>
                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button type="button" variant="outline" :disabled="editLoading" @click="editOpen = false">Cancel</Button>
                        <Button type="button" :disabled="editLoading" class="gap-1.5" @click="saveEdit">
                            <AppIcon name="save" class="size-3.5" />
                            {{ editLoading ? 'Saving...' : 'Save Changes' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <!-- Status update dialog -->
            <Dialog :open="statusOpen" @update:open="(open) => (statusOpen = open)">
                <DialogContent variant="action" size="lg">
                    <DialogHeader>
                        <DialogTitle>{{ statusTarget === 'inactive' ? 'Deactivate Supplier' : 'Activate Supplier' }}</DialogTitle>
                        <DialogDescription>{{ statusTarget === 'inactive' ? 'Reason is required before deactivating.' : 'Confirm activation of this supplier.' }}</DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <Alert v-if="statusError" variant="destructive">
                            <AlertTitle>Status update failed</AlertTitle>
                            <AlertDescription>{{ statusError }}</AlertDescription>
                        </Alert>
                        <div v-if="statusTarget === 'inactive'" class="grid gap-2">
                            <Label for="sup-status-reason">Reason</Label>
                            <Textarea id="sup-status-reason" v-model="statusReason" class="min-h-20" placeholder="Required reason for deactivation" />
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
