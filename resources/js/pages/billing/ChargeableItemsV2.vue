<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ChargeableItemAddPriceSheet from '@/components/billing/ChargeableItemAddPriceSheet.vue';
import ChargeableItemCreateSheet from '@/components/billing/ChargeableItemCreateSheet.vue';
import ChargeableItemDetailsSheet from '@/components/billing/ChargeableItemDetailsSheet.vue';
import ChargeableItemEditSheet from '@/components/billing/ChargeableItemEditSheet.vue';
import ClinicalCatalogEditSheet from '@/components/platform/clinical-catalogs/ClinicalCatalogEditSheet.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import CatalogLinkBadge from '@/components/shared/CatalogLinkBadge.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchInput } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChargeableItems, type ChargeableItem } from '@/composables/chargeableItems/useChargeableItems';
import { useUpdateChargeableItem } from '@/composables/chargeableItems/useUpdateChargeableItem';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import type { AppIconName } from '@/lib/icons';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Admin list + create page for the new pricing engine's chargeable_items.
 * Deliberately leaner than ServiceCatalogV2.vue (that page manages the old
 * ~25-field billing_service_catalog_items table with bulk actions, CSV
 * export, and audit logs; this one manages a ~10-field table with no
 * versioning workspace yet — adding a price is "storePrice", not a full
 * version-history UI, per PricingEngine Phase 4's scope).
 */
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing' },
    { title: 'Chargeable Items', href: '/chargeable-items' },
];

const CATALOG_TYPE_TABS: Array<{ value: string; label: string; icon: AppIconName }> = [
    { value: '', label: 'All', icon: 'layers' },
    { value: 'lab_test', label: 'Lab', icon: 'flask-conical' },
    { value: 'radiology_procedure', label: 'Radiology', icon: 'activity' },
    { value: 'theatre_procedure', label: 'Theatre', icon: 'heart-pulse' },
    { value: 'clinical_procedure', label: 'Procedure', icon: 'scissors' },
    { value: 'formulary_item', label: 'Pharmacy', icon: 'pill' },
    { value: 'consultation', label: 'Consultation', icon: 'stethoscope' },
    { value: 'bed_day', label: 'Bed-day', icon: 'bed-double' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('billing.chargeable-items.read') === 'allowed');
const canManage = computed(() => permissionState('billing.chargeable-items.manage') === 'allowed');

const catalogTypeFilter = ref('');
const statusFilter = ref('');
const searchQuery = ref('');
const linkageFilter = ref<'' | 'clinical' | 'standalone'>('');
const filters = computed(() => ({ catalogType: catalogTypeFilter.value || null, status: statusFilter.value || null }));
const list = useChargeableItems(filters);

// Unscoped by catalogType (but still respecting the status filter) so the
// tab badges can show a real count per catalog type regardless of which
// tab is currently active -- matches ServiceCatalogV2.vue's per-tab counts,
// computed client-side here instead of via a dedicated backend endpoint
// since the whole list is small enough to fetch in one shot.
const allTypesFilters = computed(() => ({ catalogType: null, status: statusFilter.value || null }));
const allTypesList = useChargeableItems(allTypesFilters);
const tabCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const item of allTypesList.data.value ?? []) {
        counts[item.catalogType] = (counts[item.catalogType] ?? 0) + 1;
    }
    counts[''] = (allTypesList.data.value ?? []).length;
    return counts;
});

const SORT_OPTIONS = [
    { value: 'name', label: 'Name' },
    { value: 'code', label: 'Code' },
    { value: 'price', label: 'Price' },
    { value: 'status', label: 'Status' },
    { value: 'updatedAt', label: 'Updated' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['value'];
const sortBy = ref<SortKey>('name');
const sortDir = ref<'asc' | 'desc'>('asc');

function sortValue(item: ChargeableItem, key: SortKey): string | number {
    if (key === 'name') return item.name.toLowerCase();
    if (key === 'code') return item.code.toLowerCase();
    if (key === 'status') return (item.status ?? '').toLowerCase();
    if (key === 'updatedAt') return item.updatedAt ?? '';
    const activePrice = item.prices.find((price) => price.status === 'active') ?? item.prices[0];
    return activePrice?.unitPrice ?? -1;
}

const fetchedItems = computed<ChargeableItem[]>(() => list.data.value ?? []);
const filteredItems = computed<ChargeableItem[]>(() => {
    const query = searchQuery.value.trim().toLowerCase();
    return fetchedItems.value.filter((item) => {
        if (linkageFilter.value === 'clinical' && !item.clinicalCatalogItemId) return false;
        if (linkageFilter.value === 'standalone' && item.clinicalCatalogItemId) return false;
        if (query === '') return true;
        return item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
    });
});
const items = computed<ChargeableItem[]>(() => {
    const sorted = [...filteredItems.value].sort((a, b) => {
        const left = sortValue(a, sortBy.value);
        const right = sortValue(b, sortBy.value);
        const comparison = left < right ? -1 : left > right ? 1 : 0;
        return sortDir.value === 'asc' ? comparison : -comparison;
    });
    return sorted;
});
const activeCount = computed(() => fetchedItems.value.filter((item) => (item.status ?? '').toLowerCase() === 'active').length);
const inactiveCount = computed(() => fetchedItems.value.filter((item) => (item.status ?? '').toLowerCase() === 'inactive').length);

// --- Pagination (client-side -- the whole filtered list is already in
// memory, no need for a server round-trip for a set this size) ---
const PER_PAGE = 20;
const page = ref(1);
watch([catalogTypeFilter, statusFilter, searchQuery, linkageFilter, sortBy, sortDir], () => {
    page.value = 1;
});
const lastPage = computed(() => Math.max(Math.ceil(items.value.length / PER_PAGE), 1));
const pagedItems = computed(() => items.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE));
const canPrevPage = computed(() => page.value > 1);
const canNextPage = computed(() => page.value < lastPage.value);
function prevPage(): void {
    if (canPrevPage.value) page.value -= 1;
}
function nextPage(): void {
    if (canNextPage.value) page.value += 1;
}

const queryClient = useQueryClient();
function invalidateChargeableItemQueries(): void {
    void queryClient.invalidateQueries({ queryKey: ['chargeable-items'] });
    void queryClient.invalidateQueries({ queryKey: ['chargeable-item-options'] });
}

function activePriceLabel(item: ChargeableItem): string {
    const activePrice = item.prices.find((price) => price.status === 'active') ?? item.prices[0];
    if (!activePrice) return 'No price set';

    return `${activePrice.unitPrice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} ${activePrice.currencyCode}`;
}

function hasActivePrice(item: ChargeableItem): boolean {
    return item.prices.some((price) => price.status === 'active');
}

function rowMeta(item: ChargeableItem): string {
    const priceCount = item.prices.length;
    const priceVersionLabel = priceCount > 0 ? `v${priceCount}` : 'No prices';
    return `${activePriceLabel(item)} · ${formatEnumLabel(item.catalogType)} · ${priceVersionLabel}`;
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

const createSheetOpen = ref(false);

function openCreateSheet(): void {
    createSheetOpen.value = true;
}

function onCreated(item: ChargeableItem): void {
    notifySuccess(`Created ${item.code} — ${item.name}.`);
    invalidateChargeableItemQueries();
}

const addPriceSheetOpen = ref(false);
const addPriceItem = ref<ChargeableItem | null>(null);

function openAddPriceSheet(item: ChargeableItem): void {
    addPriceItem.value = item;
    addPriceSheetOpen.value = true;
}

function onPriceAdded(item: ChargeableItem): void {
    notifySuccess(`Added a new price for ${item.code}.`);
    invalidateChargeableItemQueries();
}

function onPriceUpdated(item: ChargeableItem): void {
    detailsItem.value = item;
}

const detailsSheetOpen = ref(false);
const detailsItem = ref<ChargeableItem | null>(null);

function openDetails(item: ChargeableItem): void {
    detailsItem.value = item;
    detailsSheetOpen.value = true;
}

const editSheetOpen = ref(false);
const editItem = ref<ChargeableItem | null>(null);

const clinicalCatalogEditOpen = ref(false);
const clinicalCatalogItem = ref<ClinicalCatalogEditItem | null>(null);

type ClinicalCatalogEditItem = {
    id: string | null;
    catalogType: string | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    category: string | null;
    unit: string | null;
    billingServiceCode: string | null;
    billingLinkStatus: string | null;
    billingLink: Record<string, unknown> | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    codes: Record<string, string> | null;
    facilityTier: string | null;
    genericName: string | null;
    dosageForm: string | null;
    strength: string | null;
    route: string | null;
    storageConditions: string | null;
    requiresColdChain: boolean;
    isControlledSubstance: boolean;
    controlledSubstanceSchedule: string | null;
    genericGroupCode: string | null;
    status: string | null;
    statusReason: string | null;
    updatedAt: string | null;
};

function catalogTypeToKey(catalogType: string): string | null {
    const map: Record<string, string> = {
        lab_test: 'lab-tests',
        radiology_procedure: 'radiology-procedures',
        theatre_procedure: 'theatre-procedures',
        clinical_procedure: 'clinical-procedures',
        formulary_item: 'formulary-items',
    };
    return map[catalogType] ?? null;
}

async function openEditSheet(item: ChargeableItem): Promise<void> {
    // Close the Details sheet first — both edit sheets render at the same
    // z-index, so leaving Details open made the standalone edit sheet paint
    // underneath it (only the clinical-catalog sheet happened to render on
    // top, purely because it's declared later in the template).
    detailsSheetOpen.value = false;

    if (item.clinicalCatalogItemId) {
        const key = catalogTypeToKey(item.catalogType);
        if (!key) return;
        try {
            const response = await apiRequestJson<{ data: ClinicalCatalogEditItem }>('GET', `/platform/admin/clinical-catalogs/${key}/${item.clinicalCatalogItemId}`);
            clinicalCatalogItem.value = response.data;
            clinicalCatalogEditOpen.value = true;
        } catch (error) {
            notifyError(messageFromUnknown(error, 'Unable to load the clinical catalog item.'));
        }
        return;
    }
    editItem.value = item;
    editSheetOpen.value = true;
}

function onClinicalCatalogUpdated(): void {
    clinicalCatalogEditOpen.value = false;
    invalidateChargeableItemQueries();
}

function onUpdated(item: ChargeableItem): void {
    notifySuccess(`Updated ${item.code}.`);
    invalidateChargeableItemQueries();
}

const updateItem = useUpdateChargeableItem();

async function toggleStatus(item: ChargeableItem): Promise<void> {
    const nextStatus = (item.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active';

    try {
        await updateItem.mutateAsync({ chargeableItemId: item.id, status: nextStatus });
        notifySuccess(`${item.code} is now ${nextStatus}.`);
        invalidateChargeableItemQueries();
    } catch (error) {
        notifyError(messageFromUnknown(error, `Unable to update ${item.code}.`));
    }
}

// --- Bulk selection ---
// No dedicated bulk-status endpoint exists for chargeable_items yet
// (ServiceCatalogBulkStatusDialog.vue's equivalent is a single bulk PATCH
// against the old table) -- this fires ChargeableItemController::update()
// once per selected item via Promise.allSettled, same visible outcome,
// no new backend endpoint needed for a page this size.
const selectedItemIds = ref<string[]>([]);
const pageItemIds = computed(() => pagedItems.value.map((item) => item.id));
const allVisibleSelected = computed(() => pageItemIds.value.length > 0 && pageItemIds.value.every((id) => selectedItemIds.value.includes(id)));
const bulkUpdating = ref(false);

function clearSelectedItems(): void {
    selectedItemIds.value = [];
}
function toggleItemSelection(itemId: string, checked: boolean | 'indeterminate'): void {
    if (checked === true) {
        if (!selectedItemIds.value.includes(itemId)) selectedItemIds.value = [...selectedItemIds.value, itemId];
        return;
    }
    selectedItemIds.value = selectedItemIds.value.filter((id) => id !== itemId);
}
function toggleSelectAllVisible(checked: boolean | 'indeterminate'): void {
    const visible = new Set(pageItemIds.value);
    if (checked !== true) {
        selectedItemIds.value = selectedItemIds.value.filter((id) => !visible.has(id));
        return;
    }
    selectedItemIds.value = Array.from(new Set([...selectedItemIds.value, ...pageItemIds.value]));
}

async function bulkSetStatus(status: 'active' | 'inactive'): Promise<void> {
    if (selectedItemIds.value.length === 0 || bulkUpdating.value) return;

    bulkUpdating.value = true;
    const ids = [...selectedItemIds.value];
    const results = await Promise.allSettled(
        ids.map((chargeableItemId) => updateItem.mutateAsync({ chargeableItemId, status })),
    );
    bulkUpdating.value = false;

    const failed = results.filter((result) => result.status === 'rejected').length;
    const succeeded = ids.length - failed;

    if (succeeded > 0) notifySuccess(`${succeeded} item${succeeded === 1 ? '' : 's'} set to ${status}.`);
    if (failed > 0) notifyError(`${failed} item${failed === 1 ? '' : 's'} could not be updated.`);

    clearSelectedItems();
    invalidateChargeableItemQueries();
}

// --- CSV export / print -- generated client-side from the already-loaded,
// filtered+sorted list (no backend export endpoint exists for the new
// engine yet, and this page's item count doesn't need one). ---
function exportRows(): ChargeableItem[] {
    return items.value;
}

function csvEscape(value: string | number | null | undefined): string {
    const normalized = String(value ?? '');
    return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function exportChargeableItemsCsv(): void {
    const rows = exportRows();
    const header = ['Code', 'Name', 'Catalog type', 'Charge model', 'Status', 'Current price', 'Currency', 'Linkage'];
    const lines = rows.map((item) => {
        const activePrice = item.prices.find((price) => price.status === 'active') ?? item.prices[0];
        return [
            csvEscape(item.code),
            csvEscape(item.name),
            csvEscape(formatEnumLabel(item.catalogType)),
            csvEscape(formatEnumLabel(item.chargeModel)),
            csvEscape(formatEnumLabel(item.status)),
            csvEscape(activePrice?.unitPrice ?? ''),
            csvEscape(activePrice?.currencyCode ?? ''),
            csvEscape(item.clinicalCatalogItemId ? 'Clinical catalog' : 'Standalone'),
        ].join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = 'chargeable-items.csv';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    notifySuccess('Chargeable items exported.');
}

function escapePrintHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function printChargeableItems(): void {
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
        notifyError('Unable to open print preview.');
        return;
    }

    const rows = exportRows();
    const tableRows = rows.map((item) => {
        const activePrice = item.prices.find((price) => price.status === 'active') ?? item.prices[0];
        return `
            <tr>
                <td>${escapePrintHtml(item.code)}</td>
                <td>${escapePrintHtml(item.name)}</td>
                <td>${escapePrintHtml(formatEnumLabel(item.catalogType))}</td>
                <td>${escapePrintHtml(activePrice ? `${activePrice.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${activePrice.currencyCode}` : 'No price set')}</td>
                <td>${escapePrintHtml(formatEnumLabel(item.status))}</td>
            </tr>
        `;
    }).join('');

    printWindow.document.write(`
        <!doctype html>
        <html>
            <head>
                <title>Chargeable items</title>
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
                <h1>Chargeable items</h1>
                <p>Filtered records: ${escapePrintHtml(rows.length)}. Printed ${escapePrintHtml(new Date().toLocaleString())}.</p>
                <table>
                    <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Price</th><th>Status</th></tr></thead>
                    <tbody>${tableRows || '<tr><td colspan="5">No records match the current filters.</td></tr>'}</tbody>
                </table>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Chargeable Items" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Chargeable Items</h1>
                        <p class="text-xs text-muted-foreground">
                            New pricing engine: canonical chargeable items and their price book entries.
                        </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{{ items.length }} chargeable items</Badge>
                        <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                            <AppIcon name="plus" class="size-3.5" />
                            New chargeable item
                        </Button>
                        <Tooltip>
                            <TooltipTrigger as-child>
                                <Button variant="outline" size="sm" class="h-8 w-8 p-0" @click="exportChargeableItemsCsv">
                                    <AppIcon name="download" class="size-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Export CSV</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger as-child>
                                <Button variant="outline" size="sm" class="h-8 w-8 p-0" @click="printChargeableItems">
                                    <AppIcon name="printer" class="size-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Print</TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                <div v-if="canRead" class="mt-3 grid grid-cols-3 gap-2">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Active</p>
                        <p class="text-sm font-bold tabular-nums">{{ activeCount }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Inactive</p>
                        <p class="text-sm font-bold tabular-nums">{{ inactiveCount }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total (this tab)</p>
                        <p class="text-sm font-bold tabular-nums">{{ items.length }}</p>
                    </div>
                </div>

                <Tabs v-if="canRead" :model-value="catalogTypeFilter" class="mt-3" @update:model-value="(value) => (catalogTypeFilter = String(value))">
                    <TabsList class="grid w-full grid-cols-4 sm:grid-cols-8">
                        <TabsTrigger v-for="tab in CATALOG_TYPE_TABS" :key="tab.value" :value="tab.value" class="gap-1 text-xs">
                            <AppIcon :name="tab.icon" class="size-3" />
                            {{ tab.label }}
                            <Badge variant="secondary" class="h-4 min-w-4 justify-center px-1 text-[9px] tabular-nums">
                                {{ tabCounts[tab.value] ?? 0 }}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div v-if="canRead" class="mt-3 flex flex-wrap items-center gap-2">
                    <SearchInput v-model="searchQuery" placeholder="Search code or name" class="min-w-72 flex-1" />
                    <Select :model-value="statusFilter || 'all'" @update:model-value="(value) => (statusFilter = value === 'all' ? '' : String(value))">
                        <SelectTrigger class="h-9 w-40 bg-background"><SelectValue placeholder="All statuses" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-model="sortBy">
                        <SelectTrigger class="h-9 w-36 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select v-model="sortDir">
                        <SelectTrigger class="h-9 w-32 bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="asc">Ascending</SelectItem>
                            <SelectItem value="desc">Descending</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select :model-value="linkageFilter || 'all'" @update:model-value="(value) => (linkageFilter = value === 'all' ? '' : (String(value) as 'clinical' | 'standalone'))">
                        <SelectTrigger class="h-9 w-44 bg-background"><SelectValue placeholder="All sources" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All sources</SelectItem>
                            <SelectItem value="clinical">Clinical catalog</SelectItem>
                            <SelectItem value="standalone">Standalone</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div v-if="canManage && selectedItemIds.length > 0" class="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <label class="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox :model-value="allVisibleSelected" @update:model-value="toggleSelectAllVisible" />
                        <span class="font-medium text-foreground">{{ selectedItemIds.length }} selected</span>
                    </label>
                    <Button size="sm" variant="ghost" class="h-6 px-2 text-xs" @click="clearSelectedItems">Clear</Button>
                    <Button size="sm" variant="secondary" class="h-7 gap-1 text-xs" :disabled="bulkUpdating" @click="bulkSetStatus('active')">
                        <AppIcon name="check-circle" class="size-3" />Activate
                    </Button>
                    <Button size="sm" variant="outline" class="h-7 gap-1 text-xs" :disabled="bulkUpdating" @click="bulkSetStatus('inactive')">
                        <AppIcon name="circle-x" class="size-3" />Deactivate
                    </Button>
                </div>
            </div>

            <div v-if="!canRead" class="px-6 py-8 text-sm text-muted-foreground">
                You don't have permission to view chargeable items.
            </div>

            <div v-else class="px-6 pb-6">
                <div v-if="list.isLoading.value" class="overflow-hidden rounded-lg border bg-card">
                    <RegistryListSkeleton :count="6" />
                </div>
                <p v-else-if="items.length === 0" class="px-1 py-4 text-sm text-muted-foreground">No chargeable items found for this filter.</p>

                <div v-else class="overflow-hidden rounded-lg border bg-card">
                    <ul class="divide-y px-3" :class="list.isFetching.value ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'">
                        <li v-for="item in pagedItems" :key="item.id">
                            <RegistryListRow
                                :status-dot-class="statusVariant(item.status) === 'secondary' ? 'bg-emerald-500' : 'bg-muted-foreground'"
                                @select="openDetails(item)"
                            >
                                <template v-if="canManage" #leading>
                                    <Checkbox
                                        class="shrink-0"
                                        :model-value="selectedItemIds.includes(item.id)"
                                        @update:model-value="(checked) => toggleItemSelection(item.id, checked)"
                                        @click.stop
                                    />
                                </template>
                                <template #title>
                                    <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span class="truncate text-sm font-medium">{{ item.name }}</span>
                                        <span class="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{{ item.code }}</span>
                                    </div>
                                </template>
                                <template #meta>
                                    <p class="truncate text-xs text-muted-foreground">{{ rowMeta(item) }}</p>
                                </template>
                                <template #badges>
                                    <CatalogLinkBadge
                                        :source="item.clinicalCatalogItemId ? 'clinical_catalog' : 'standalone'"
                                        :catalog-type="item.catalogType"
                                        :catalog-name="item.name"
                                        :catalog-code="item.code"
                                    />
                                    <Badge :variant="statusVariant(item.status)" class="h-5 px-1.5 text-[10px]">{{ formatEnumLabel(item.status) }}</Badge>
                                </template>
                                <template v-if="canManage" #actions>
                                    <Button size="sm" variant="outline" class="h-8 gap-1.5 rounded-lg text-xs" @click="openAddPriceSheet(item)">
                                        <AppIcon name="banknote" class="size-3.5" />
                                        {{ hasActivePrice(item) ? 'New price' : 'Add price' }}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        class="h-8 rounded-lg text-xs"
                                        :disabled="updateItem.isPending.value"
                                        @click="toggleStatus(item)"
                                    >
                                        {{ (item.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}
                                    </Button>
                                </template>
                            </RegistryListRow>
                        </li>
                    </ul>

                    <div v-if="lastPage > 1" class="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
                        <p>Showing {{ pagedItems.length }} of {{ items.length }} · Page {{ page }} of {{ lastPage }}</p>
                        <div class="flex items-center gap-1">
                            <Button variant="outline" size="icon" class="size-8" :disabled="!canPrevPage" @click="prevPage">
                                <AppIcon name="chevron-left" class="size-4" />
                            </Button>
                            <Button variant="outline" size="icon" class="size-8" :disabled="!canNextPage" @click="nextPage">
                                <AppIcon name="chevron-right" class="size-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <ChargeableItemCreateSheet v-model:open="createSheetOpen" @created="onCreated" />
        <ChargeableItemAddPriceSheet v-model:open="addPriceSheetOpen" :item="addPriceItem" @added="onPriceAdded" />
        <ChargeableItemEditSheet v-model:open="editSheetOpen" :item="editItem" @updated="onUpdated" />
        <ChargeableItemDetailsSheet v-model:open="detailsSheetOpen" :item="detailsItem" @edit="openEditSheet" @price-updated="onPriceUpdated" />
        <ClinicalCatalogEditSheet
            v-if="clinicalCatalogItem"
            v-model:open="clinicalCatalogEditOpen"
            :item="clinicalCatalogItem"
            :catalog-key="catalogTypeToKey(clinicalCatalogItem.catalogType ?? '') ?? 'lab-tests'"
            :departments="[]"
            :can-manage-compliance="false"
            @updated="onClinicalCatalogUpdated"
        />
    </AppLayout>
</template>
