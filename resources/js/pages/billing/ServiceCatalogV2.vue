<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import ServiceCatalogBulkStatusDialog from '@/components/service-catalog/ServiceCatalogBulkStatusDialog.vue';
import ServiceCatalogCreateItemSheet from '@/components/service-catalog/ServiceCatalogCreateItemSheet.vue';
import ServiceCatalogDetailsSheet from '@/components/service-catalog/ServiceCatalogDetailsSheet.vue';
import CatalogLinkBadge from '@/components/shared/CatalogLinkBadge.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchInput } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useServiceCatalogDepartmentOptions } from '@/composables/serviceCatalogIndex/useServiceCatalogDepartmentOptions';
import { useServiceCatalogFilters } from '@/composables/serviceCatalogIndex/useServiceCatalogFilters';
import { useServiceCatalogItems } from '@/composables/serviceCatalogIndex/useServiceCatalogItems';
import { useServiceCatalogStatusCounts } from '@/composables/serviceCatalogIndex/useServiceCatalogStatusCounts';
import { useServiceCatalogTypeCounts } from '@/composables/serviceCatalogIndex/useServiceCatalogTypeCounts';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGet, apiGetBlob } from '@/lib/apiClient';
import {
    SERVICE_TYPE_TABS,
    type CatalogItem,
    type CatalogListResponse,
    type CatalogStatus,
} from '@/lib/billingServiceCatalog';
import { catalogStatusDotClass, formatMoney, statusVariant, tariffLifecycleLabel } from '@/lib/billingServiceCatalog';
import { INVENTORY_PROCUREMENT_STOCK_CONTROL_PATH } from '@/lib/inventoryProcurement';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import BillingServiceCatalogSyncDialog from '@/pages/billing/BillingServiceCatalogSyncDialog.vue';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing' },
    { title: 'Billing Service Catalog', href: '/billing-service-catalog' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('billing.service-catalog.read') === 'allowed');
const canManagePricing = computed(() => (
    permissionState('billing.service-catalog.manage') === 'allowed'
    || permissionState('billing.service-catalog.manage-pricing') === 'allowed'
));
const catalogReadOnly = computed(() => canRead.value && !canManagePricing.value);

const filters = useServiceCatalogFilters();
const list = useServiceCatalogItems(filters);
const statusCounts = useServiceCatalogStatusCounts(filters);
const typeCounts = useServiceCatalogTypeCounts(filters);
const { filterOptions: filterDepartmentOptions } = useServiceCatalogDepartmentOptions();

const items = computed<CatalogItem[]>(() => list.data.value?.data ?? []);
const pagination = computed(() => list.data.value?.meta ?? null);
const counts = computed(() => statusCounts.data.value ?? { active: 0, inactive: 0, retired: 0, other: 0, total: 0 });

const queryClient = useQueryClient();
function invalidateServiceCatalogQueries(): void {
    void queryClient.invalidateQueries({ queryKey: ['service-catalog-items'] });
    void queryClient.invalidateQueries({ queryKey: ['service-catalog-status-counts'] });
    void queryClient.invalidateQueries({ queryKey: ['service-catalog-type-counts'] });
}

function refresh(): void {
    invalidateServiceCatalogQueries();
}

// --- Search + filters ---

const activeFilterChips = computed(() => {
    const chips: string[] = [];
    if (filters.q.trim()) chips.push(`Search: ${filters.q.trim()}`);
    if (filters.serviceType.trim()) chips.push(`Type: ${formatEnumLabel(filters.serviceType.trim())}`);
    if (filters.status) chips.push(`Status: ${formatEnumLabel(filters.status)}`);
    if (filters.departmentId.trim()) {
        const match = filterDepartmentOptions.value.find((option) => option.value === filters.departmentId.trim());
        chips.push(`Department: ${match?.label ?? filters.departmentId.trim()}`);
    }
    if (filters.lifecycle) {
        const labels: Record<string, string> = { effective: 'Effective now', scheduled: 'Scheduled', expired: 'Expired', no_window: 'No window' };
        chips.push(`Window: ${labels[filters.lifecycle] ?? filters.lifecycle}`);
    }
    if (filters.linkage) chips.push(`Source: ${filters.linkage === 'clinical' ? 'Clinical catalog' : 'Standalone'}`);
    if (filters.sortBy !== 'serviceName') chips.push(`Sort: ${formatEnumLabel(filters.sortBy)}`);
    if (filters.sortDir !== 'asc') chips.push('Descending');
    return chips;
});

function resetFilters(): void {
    filters.q = '';
    filters.serviceType = '';
    filters.status = '';
    filters.departmentId = '';
    filters.lifecycle = '';
    filters.linkage = '';
    filters.sortBy = 'serviceName';
    filters.sortDir = 'asc';
    filters.page = 1;
}

const activeServiceTypeTab = computed(() => filters.serviceType || '__all__');
function setActiveServiceTypeTab(value: string | number): void {
    filters.serviceType = value === '__all__' ? '' : String(value);
    filters.page = 1;
}

const linkageFilterValue = computed(() => filters.linkage || 'all');
function setLinkageFilter(value: string | number): void {
    filters.linkage = value === 'all' ? '' : (String(value) as 'clinical' | 'standalone');
    filters.page = 1;
}

// --- Pagination ---

const canPrevPage = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNextPage = computed(() => Boolean(pagination.value && pagination.value.currentPage < pagination.value.lastPage));
const paginationPageNumbers = computed((): (number | '...')[] => {
    const total = pagination.value?.lastPage ?? 1;
    const current = pagination.value?.currentPage ?? 1;
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) pages.push(page);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
});
function goToPage(page: number): void { filters.page = page; }
function prevPage(): void { if (canPrevPage.value) filters.page -= 1; }
function nextPage(): void { if (canNextPage.value) filters.page += 1; }

// --- Bulk selection ---

const selectedItemIds = ref<string[]>([]);
const pageItemIds = computed(() => items.value.map((item) => String(item.id ?? '').trim()).filter(Boolean));
const allVisibleSelected = computed(() => pageItemIds.value.length > 0 && pageItemIds.value.every((id) => selectedItemIds.value.includes(id)));
const canUseBulkSelection = computed(() => canRead.value && canManagePricing.value);

function clearSelectedItems(): void {
    selectedItemIds.value = [];
}
function toggleItemSelection(itemId: string, checked: boolean | 'indeterminate'): void {
    const normalizedId = itemId.trim();
    if (!normalizedId) return;
    if (checked === true) {
        if (!selectedItemIds.value.includes(normalizedId)) selectedItemIds.value = [...selectedItemIds.value, normalizedId];
        return;
    }
    selectedItemIds.value = selectedItemIds.value.filter((id) => id !== normalizedId);
}
function toggleSelectAllVisible(checked: boolean | 'indeterminate'): void {
    const visible = new Set(pageItemIds.value);
    if (checked !== true) {
        selectedItemIds.value = selectedItemIds.value.filter((id) => !visible.has(id));
        return;
    }
    selectedItemIds.value = Array.from(new Set([...selectedItemIds.value, ...pageItemIds.value]));
}

const bulkStatusDialogOpen = ref(false);
const bulkStatusTarget = ref<CatalogStatus>('active');

function openBulkStatusDialog(status: CatalogStatus): void {
    if (!canUseBulkSelection.value || selectedItemIds.value.length === 0) return;
    bulkStatusTarget.value = status;
    bulkStatusDialogOpen.value = true;
}
function onBulkStatusUpdated(): void {
    clearSelectedItems();
    invalidateServiceCatalogQueries();
}

// --- Create / Details sheets ---

const createSheetOpen = ref(false);
const detailsSheetOpen = ref(false);
const detailsItemId = ref<string | null>(null);
const billingSyncDialogOpen = ref(false);

function openDetails(item: CatalogItem): void {
    const itemId = String(item.id ?? '').trim();
    if (!itemId) return;
    detailsItemId.value = itemId;
    detailsSheetOpen.value = true;
}

function onItemCreated(): void {
    invalidateServiceCatalogQueries();
}

// --- CSV export / print (kept as page-level imperative actions, not composables) ---

const catalogExporting = ref(false);
const catalogPrinting = ref(false);

function exportQuery(): Record<string, string | number | null> {
    return {
        q: filters.q.trim() || null,
        serviceType: filters.serviceType.trim() || null,
        status: filters.status || null,
        departmentId: filters.departmentId.trim() || null,
        lifecycle: filters.lifecycle || null,
        linkage: filters.linkage || null,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
    };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
}

async function exportCatalogItemsCsv(): Promise<void> {
    if (catalogExporting.value) return;
    catalogExporting.value = true;
    try {
        const { blob, filename } = await apiGetBlob('/billing-service-catalog/items/export', {
            query: exportQuery(),
            entitlementContext: 'Billing service catalog export',
        });
        triggerBlobDownload(blob, filename ?? 'billing-service-catalog.csv');
        notifySuccess('Billable services exported.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export billable services.'));
    } finally {
        catalogExporting.value = false;
    }
}

function escapePrintHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function loadFilteredCatalogItemsForPrint(): Promise<{ data: CatalogItem[]; total: number }> {
    const results: CatalogItem[] = [];
    let page = 1;
    let lastPage = 1;
    let total = 0;

    do {
        const response = await apiGet<CatalogListResponse>('/billing-service-catalog/items', { ...exportQuery(), perPage: 100, page });
        results.push(...(response.data ?? []));
        total = response.meta?.total ?? results.length;
        lastPage = Math.max(response.meta?.lastPage ?? 1, 1);
        page += 1;
    } while (page <= lastPage);

    return { data: results, total };
}

async function printCatalogItems(): Promise<void> {
    if (catalogPrinting.value) return;

    const title = 'Billable services';
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
        notifyError('Unable to open print preview.');
        return;
    }

    catalogPrinting.value = true;
    try {
        const printable = await loadFilteredCatalogItemsForPrint();
        const rows = printable.data.map((item) => `
            <tr>
                <td>${escapePrintHtml(item.serviceCode)}</td>
                <td>${escapePrintHtml(item.serviceName)}</td>
                <td>${escapePrintHtml(item.serviceType ? formatEnumLabel(item.serviceType) : '')}</td>
                <td>${escapePrintHtml(item.department)}</td>
                <td>${escapePrintHtml(formatMoney(item.basePrice, item.currencyCode))}</td>
                <td>${escapePrintHtml(formatEnumLabel(item.status))}</td>
                <td>${escapePrintHtml(tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo))}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <title>${escapePrintHtml(title)}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
                        h1 { font-size: 20px; margin: 0 0 4px; }
                        p { margin: 0 0 16px; color: #4b5563; font-size: 12px; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
                        th { background: #f3f4f6; font-weight: 700; }
                        @media print { body { margin: 12mm; } }
                    </style>
                </head>
                <body>
                    <h1>${escapePrintHtml(title)}</h1>
                    <p>Filtered records: ${escapePrintHtml(printable.total)}. Printed ${escapePrintHtml(new Date().toLocaleString())}.</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Service code</th><th>Service name</th><th>Type</th><th>Department</th><th>Price</th><th>Status</th><th>Window</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="7">No records match the current filters.</td></tr>'}</tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    } catch (error) {
        printWindow.close();
        notifyError(messageFromUnknown(error, 'Unable to print filtered billable services.'));
    } finally {
        catalogPrinting.value = false;
    }
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Billing Service Catalog" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Billing Service Catalog</h1>
                            <Badge v-if="catalogReadOnly" variant="outline" class="h-5 px-1.5 text-[10px] font-medium">View only</Badge>
                        </div>
                        <p class="text-sm text-muted-foreground">
                            {{ catalogReadOnly ? 'Browse tariffs linked to clinical services and payer contracts.' : 'Manage base prices, effective windows, and catalog versions.' }}
                        </p>
                    </div>
                    <div class="flex shrink-0 flex-wrap items-center gap-2">
                        <Badge variant="secondary">{{ counts.total }} services</Badge>
                        <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="list.isFetching.value" @click="refresh">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            Refresh
                        </Button>
                        <Button v-if="canManagePricing" size="sm" class="h-8 gap-1.5" @click="createSheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            Add service price
                        </Button>
                        <Button v-if="canManagePricing" size="sm" variant="outline" class="h-8 gap-1.5" @click="billingSyncDialogOpen = true">
                            <AppIcon name="book-open" class="size-3.5" />
                            Sync from Clinical Catalog
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                                    <AppIcon name="ellipsis-vertical" class="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" class="w-48">
                                <DropdownMenuItem as-child>
                                    <Link href="/platform/admin/clinical-catalogs" class="gap-2"><AppIcon name="book-open" class="size-4" />Clinical catalogs</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link :href="INVENTORY_PROCUREMENT_STOCK_CONTROL_PATH" class="gap-2"><AppIcon name="package" class="size-4" />Inventory items</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link href="/billing-payer-contracts" class="gap-2"><AppIcon name="shield-check" class="size-4" />Payer contracts</Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div v-if="canRead" class="mt-3 grid grid-cols-4 gap-2">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Active</p>
                        <p class="text-sm font-bold tabular-nums">{{ counts.active }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Inactive</p>
                        <p class="text-sm font-bold tabular-nums">{{ counts.inactive }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Retired</p>
                        <p class="text-sm font-bold tabular-nums">{{ counts.retired }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                        <p class="text-sm font-bold tabular-nums">{{ counts.total }}</p>
                    </div>
                </div>

                <Tabs v-if="canRead" :model-value="activeServiceTypeTab" class="mt-3" @update:model-value="setActiveServiceTypeTab">
                    <TabsList class="grid h-9 w-full grid-cols-6 gap-1 bg-muted/40 p-1 sm:grid-cols-11">
                        <TabsTrigger
                            v-for="tab in SERVICE_TYPE_TABS"
                            :key="tab.value"
                            :value="tab.value"
                            class="gap-1 rounded-md border border-transparent px-1.5 text-[11px] text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                        >
                            <AppIcon :name="tab.icon" class="size-3" />
                            {{ tab.label }}
                            <Badge variant="secondary" class="h-4 min-w-4 justify-center px-1 text-[9px] tabular-nums">
                                {{ typeCounts.data.value?.[tab.value === '__all__' ? 'all' : tab.value] ?? 0 }}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div v-if="canRead" class="mt-3 flex flex-wrap items-center gap-2">
                    <SearchInput v-model="filters.q" placeholder="Search code, name, type, or department" class="min-w-72 flex-1" />
                    <SearchableSelectField
                        input-id="catalog-filter-department"
                        label=""
                        v-model="filters.departmentId"
                        :options="filterDepartmentOptions"
                        placeholder="All departments"
                        search-placeholder="Search department code or name"
                        empty-text="No departments matched this search."
                        trigger-class="w-56"
                        message-class="hidden"
                    />
                    <Select :model-value="linkageFilterValue" @update:model-value="(value) => setLinkageFilter(String(value ?? 'all'))">
                        <SelectTrigger class="h-9 w-44 bg-background"><SelectValue placeholder="All sources" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All sources</SelectItem>
                            <SelectItem value="clinical">Clinical catalog</SelectItem>
                            <SelectItem value="standalone">Standalone</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-model="filters.sortBy">
                        <SelectTrigger class="h-9 w-44 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="serviceName">Service name</SelectItem>
                            <SelectItem value="serviceCode">Service code</SelectItem>
                            <SelectItem value="serviceType">Service type</SelectItem>
                            <SelectItem value="department">Department</SelectItem>
                            <SelectItem value="basePrice">Base price</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                            <SelectItem value="effectiveFrom">Effective from</SelectItem>
                            <SelectItem value="updatedAt">Updated</SelectItem>
                            <SelectItem value="createdAt">Created</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-model="filters.sortDir">
                        <SelectTrigger class="h-9 w-36 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="asc">Ascending</SelectItem>
                            <SelectItem value="desc">Descending</SelectItem>
                        </SelectContent>
                    </Select>
                    <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                            <Button variant="ghost" size="sm" class="h-9 w-9 p-0" :disabled="catalogExporting || catalogPrinting">
                                <AppIcon :name="catalogExporting || catalogPrinting ? 'loader-circle' : 'ellipsis-vertical'" :class="catalogExporting || catalogPrinting ? 'size-4 animate-spin' : 'size-4'" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-44">
                            <DropdownMenuItem :disabled="catalogExporting" class="gap-2" @select="exportCatalogItemsCsv">
                                <AppIcon name="download" class="size-4" />Export CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem :disabled="catalogPrinting" class="gap-2" @select="printCatalogItems">
                                <AppIcon name="printer" class="size-4" />Print
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button v-if="activeFilterChips.length > 0" variant="ghost" size="sm" class="h-9 gap-1.5 text-xs" @click="resetFilters">
                        <AppIcon name="x" class="size-3.5" />
                        Clear
                    </Button>
                </div>

                <div v-if="canUseBulkSelection && selectedItemIds.length > 0" class="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <label class="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                            :model-value="allVisibleSelected"
                            :disabled="pageItemIds.length === 0"
                            @update:model-value="toggleSelectAllVisible"
                        />
                        <span class="font-medium text-foreground">{{ selectedItemIds.length }} selected</span>
                    </label>
                    <Button size="sm" variant="ghost" class="h-6 px-2 text-xs" @click="clearSelectedItems">Clear</Button>
                    <Button size="sm" variant="secondary" class="h-7 gap-1 text-xs" @click="openBulkStatusDialog('active')">
                        <AppIcon name="check-circle" class="size-3" />Activate
                    </Button>
                    <Button size="sm" variant="outline" class="h-7 gap-1 text-xs" @click="openBulkStatusDialog('inactive')">
                        <AppIcon name="circle-x" class="size-3" />Deactivate
                    </Button>
                    <Button size="sm" variant="destructive" class="h-7 gap-1 text-xs" @click="openBulkStatusDialog('retired')">
                        <AppIcon name="trash-2" class="size-3" />Retire
                    </Button>
                </div>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing the service catalog requires <code>billing.service-catalog.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <div v-if="list.isLoading.value">
                        <RegistryListSkeleton :count="6" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Price list load issue</AlertTitle>
                        <AlertDescription>{{ messageFromUnknown(list.error.value, 'Unknown error.') }}</AlertDescription>
                    </Alert>

                    <div v-else-if="items.length === 0" class="rounded-lg border border-dashed bg-card px-5 py-8 text-center">
                        <p class="text-sm font-medium text-foreground">No service prices found</p>
                        <p class="mt-1 text-xs text-muted-foreground">
                            {{ activeFilterChips.length === 0 && counts.total === 0
                                ? 'Start from Clinical Catalog, then register linked tariffs here so finance does not duplicate service codes.'
                                : 'Adjust or clear filters to widen the catalog.' }}
                        </p>
                        <div class="mt-3 flex flex-wrap justify-center gap-2">
                            <Button v-if="activeFilterChips.length > 0" variant="outline" size="sm" class="h-8 gap-1.5" @click="resetFilters">
                                <AppIcon name="x" class="size-3.5" />Clear filters
                            </Button>
                            <Button v-if="canManagePricing" size="sm" class="h-8 gap-1.5" @click="createSheetOpen = true">
                                <AppIcon name="plus" class="size-3.5" />Add service price
                            </Button>
                        </div>
                    </div>

                    <div v-else class="overflow-hidden rounded-lg border bg-card">
                        <ul class="divide-y px-3" :class="list.isFetching.value ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'">
                            <li v-for="item in items" :key="String(item.id)">
                                <RegistryListRow
                                    :status-dot-class="catalogStatusDotClass(item)"
                                    :status-title="`${formatEnumLabel(item.status)} · ${tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo)}`"
                                    @select="openDetails(item)"
                                >
                                    <template v-if="canUseBulkSelection" #leading>
                                        <Checkbox
                                            class="shrink-0"
                                            :model-value="selectedItemIds.includes(String(item.id ?? ''))"
                                            :disabled="!item.id"
                                            @update:model-value="(checked) => toggleItemSelection(String(item.id ?? ''), checked)"
                                            @click.stop
                                        />
                                    </template>
                                    <template #title>
                                        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <span class="truncate text-sm font-medium">{{ item.serviceName || 'Unnamed service' }}</span>
                                            <span class="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{{ item.serviceCode || '—' }}</span>
                                        </div>
                                    </template>
                                    <template #meta>
                                        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                            <span class="font-medium tabular-nums text-foreground">{{ formatMoney(item.basePrice, item.currencyCode) }}</span>
                                            <span class="text-border">·</span>
                                            <span>{{ item.department || 'No department' }}</span>
                                            <span class="text-border">·</span>
                                            <span class="text-muted-foreground/70">v{{ item.versionNumber || 1 }}</span>
                                            <span class="text-border">·</span>
                                            <span>{{ tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo) }}</span>
                                        </div>
                                    </template>
                                    <template #badges>
                                        <CatalogLinkBadge
                                            :source="item.clinicalCatalogItemId ? 'clinical_catalog' : 'standalone'"
                                            :catalog-type="item.clinicalCatalogItem?.catalogType"
                                            :catalog-name="item.clinicalCatalogItem?.name"
                                            :catalog-code="item.clinicalCatalogItem?.code"
                                        />
                                        <Badge :variant="statusVariant(item.status)" class="capitalize">{{ formatEnumLabel(item.status) }}</Badge>
                                    </template>
                                    <template #actions>
                                        <Button size="sm" variant="outline" class="h-8 rounded-lg text-xs" @click="openDetails(item)">Details</Button>
                                    </template>
                                </RegistryListRow>
                            </li>
                        </ul>

                        <div v-if="pagination && pagination.lastPage > 1" class="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
                            <p>Showing {{ items.length }} of {{ pagination.total }} · Page {{ pagination.currentPage }} of {{ pagination.lastPage }}</p>
                            <div class="flex items-center gap-1">
                                <Button variant="outline" size="icon" class="size-8" :disabled="!canPrevPage || list.isFetching.value" @click="prevPage">
                                    <AppIcon name="chevron-left" class="size-4" />
                                </Button>
                                <template v-for="page in paginationPageNumbers" :key="`catalog-page-${String(page)}`">
                                    <span v-if="page === '...'" class="px-1 text-xs text-muted-foreground">…</span>
                                    <Button v-else :variant="page === pagination?.currentPage ? 'default' : 'ghost'" size="icon" class="size-8 text-xs" :disabled="list.isFetching.value" @click="goToPage(page as number)">
                                        {{ page }}
                                    </Button>
                                </template>
                                <Button variant="outline" size="icon" class="size-8" :disabled="!canNextPage || list.isFetching.value" @click="nextPage">
                                    <AppIcon name="chevron-right" class="size-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <ServiceCatalogCreateItemSheet v-model:open="createSheetOpen" @created="onItemCreated" />
        <ServiceCatalogDetailsSheet v-model:open="detailsSheetOpen" :item-id="detailsItemId" />
        <ServiceCatalogBulkStatusDialog
            v-model:open="bulkStatusDialogOpen"
            :item-ids="selectedItemIds"
            :target-status="bulkStatusTarget"
            @updated="onBulkStatusUpdated"
        />
        <BillingServiceCatalogSyncDialog
            :open="billingSyncDialogOpen"
            @update:open="billingSyncDialogOpen = $event"
            @synced="refresh"
        />
    </AppLayout>
</template>
