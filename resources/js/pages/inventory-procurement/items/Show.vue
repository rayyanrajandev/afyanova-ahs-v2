<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGetBlob, apiRequestJson } from '@/lib/apiClient';
import { INVENTORY_PROCUREMENT_HOME_PATH } from '@/lib/inventoryProcurement';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { EMPTY_SELECT_VALUE, fromSelectValue, toSelectValue, formatDateTime, formatDateOnly, auditActorLabel } from '@/pages/inventory-procurement/constants';
import { type BreadcrumbItem } from '@/types';

const props = defineProps<{ itemId: string }>();

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
    { title: 'Inventory Items', href: '/inventory-procurement/stock-control' },
    { title: 'Item details', href: '#' },
];

const { permissionNames: sharedPermissionNames, isFacilitySuperAdmin } = usePlatformAccess();

const permissionsResolved = computed(() => sharedPermissionNames.value !== null);
const canRead = ref(false);
const canManageItems = ref(false);
const canSetOpeningStock = ref(false);
const canCreateMovement = ref(false);
const canViewAudit = ref(false);

function evaluatePermissions(names: Iterable<string>, hasSuperAdmin: boolean): void {
    const permissionSet = new Set(
        Array.from(names)
            .map((name) => String(name ?? '').trim())
            .filter((name) => name.length > 0),
    );

    canRead.value = hasSuperAdmin || permissionSet.has('inventory.procurement.read');
    canManageItems.value = hasSuperAdmin || permissionSet.has('inventory.procurement.manage-items');
    canSetOpeningStock.value = hasSuperAdmin || permissionSet.has('inventory.procurement.set-opening-stock');
    canCreateMovement.value = hasSuperAdmin || permissionSet.has('inventory.procurement.create-movement');
    canViewAudit.value = hasSuperAdmin || permissionSet.has('inventory.procurement.view-audit-logs');
}

const EMPTY = EMPTY_SELECT_VALUE;

const activeTab = ref('overview');
const itemLoading = ref(true);
const itemError = ref<string | null>(null);
const item = ref<any>(null);

const batchesLoading = ref(false);
const batches = ref<any[]>([]);

const unitsLoading = ref(false);
const units = ref<any[]>([]);

const unitPricesLoading = ref(false);
const unitPrices = ref<any[]>([]);

const auditLoading = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<any[]>([]);
const auditMeta = ref<any>(null);
const auditExporting = ref(false);
const auditFilters = reactive({
    q: '', action: '', actorType: '', actorId: '', from: '', to: '', page: 1, perPage: 50,
});

const loading = ref(false);
const errors = ref<Record<string, string[]>>({});
const form = reactive({
    clinicalCatalogItemId: '', itemCode: '', itemName: '', genericName: '', dosageForm: '',
    strength: '', category: '', subcategory: '', venClassification: '', abcClassification: '',
    unit: '', dispensingUnit: '', conversionFactor: '', binLocation: '', manufacturer: '',
    storageConditions: '', requiresColdChain: false, isControlledSubstance: false,
    controlledSubstanceSchedule: '', msdCode: '', nhifCode: '', barcode: '',
    reorderLevel: '', maxStockLevel: '', defaultWarehouseId: '', defaultSupplierId: '',
});

function fieldError(errs: Record<string, string[]>, field: string): string {
    return errs[field]?.[0] ?? '';
}

async function loadItem(): Promise<void> {
    itemLoading.value = true;
    itemError.value = null;
    try {
        const response = await apiRequestJson<{ data: any }>('GET', `/inventory-procurement/items/${props.itemId}`);
        item.value = response.data;
        Object.assign(form, {
            clinicalCatalogItemId: response.data.clinicalCatalogItemId ?? '',
            itemCode: response.data.itemCode ?? '',
            itemName: response.data.itemName ?? '',
            genericName: response.data.genericName ?? '',
            dosageForm: response.data.dosageForm ?? '',
            strength: response.data.strength ?? '',
            category: response.data.category ?? '',
            subcategory: response.data.subcategory ?? '',
            venClassification: response.data.venClassification ?? '',
            abcClassification: response.data.abcClassification ?? '',
            unit: response.data.unit ?? '',
            dispensingUnit: response.data.dispensingUnit ?? '',
            conversionFactor: response.data.conversionFactor ?? '',
            binLocation: response.data.binLocation ?? '',
            manufacturer: response.data.manufacturer ?? '',
            storageConditions: response.data.storageConditions ?? '',
            requiresColdChain: response.data.requiresColdChain ?? false,
            isControlledSubstance: response.data.isControlledSubstance ?? false,
            controlledSubstanceSchedule: response.data.controlledSubstanceSchedule ?? '',
            msdCode: response.data.msdCode ?? '',
            nhifCode: response.data.nhifCode ?? '',
            barcode: response.data.barcode ?? '',
            reorderLevel: response.data.reorderLevel ?? '',
            maxStockLevel: response.data.maxStockLevel ?? '',
            defaultWarehouseId: response.data.defaultWarehouseId ?? '',
            defaultSupplierId: response.data.defaultSupplierId ?? '',
        });
        void loadBatches();
        void loadUnits();
        void loadUnitPrices();
        void loadAuditLogs();
    } catch (error) {
        item.value = null;
        itemError.value = messageFromUnknown(error, 'Unable to load inventory item details.');
    } finally {
        itemLoading.value = false;
    }
}

async function loadBatches(): Promise<void> {
    batchesLoading.value = true;
    try {
        const response = await apiRequestJson<{ data: any[] }>('GET', '/inventory-procurement/batches', { query: { itemId: props.itemId, perPage: 50 } });
        batches.value = response.data ?? [];
    } catch {
        batches.value = [];
    } finally {
        batchesLoading.value = false;
    }
}

async function loadUnits(): Promise<void> {
    unitsLoading.value = true;
    try {
        const response = await apiRequestJson<{ data: any[] }>('GET', `/inventory-procurement/items/${props.itemId}/units`);
        units.value = response.data ?? [];
    } catch {
        units.value = [];
    } finally {
        unitsLoading.value = false;
    }
}

async function loadUnitPrices(): Promise<void> {
    unitPricesLoading.value = true;
    try {
        const response = await apiRequestJson<{ data: any[] }>('GET', `/inventory-procurement/items/${props.itemId}/unit-prices`);
        unitPrices.value = response.data ?? [];
    } catch {
        unitPrices.value = [];
    } finally {
        unitPricesLoading.value = false;
    }
}

function auditQuery() {
    const q: Record<string, any> = {};
    if (auditFilters.q.trim()) q.q = auditFilters.q.trim();
    if (auditFilters.action.trim()) q.action = auditFilters.action.trim();
    if (auditFilters.actorType) q.actorType = auditFilters.actorType || undefined;
    if (auditFilters.actorId.trim()) q.actorId = auditFilters.actorId.trim();
    if (auditFilters.from) q.from = auditFilters.from;
    if (auditFilters.to) q.to = auditFilters.to;
    q.page = auditFilters.page;
    q.perPage = auditFilters.perPage;
    return q;
}

async function loadAuditLogs(): Promise<void> {
    auditLoading.value = true;
    auditError.value = null;
    try {
        const response = await apiRequestJson<{ data: any[]; meta: any }>('GET', `/inventory-procurement/items/${props.itemId}/audit-logs`, { query: auditQuery() });
        auditLogs.value = response.data ?? [];
        auditMeta.value = response.meta ?? null;
    } catch (error) {
        auditLogs.value = [];
        auditError.value = messageFromUnknown(error, 'Failed to load audit logs.');
    } finally {
        auditLoading.value = false;
    }
}

function applyAuditFilters(): void {
    auditFilters.page = 1;
    loadAuditLogs();
}

function resetAuditFilters(): void {
    auditFilters.q = '';
    auditFilters.action = '';
    auditFilters.actorType = '';
    auditFilters.actorId = '';
    auditFilters.from = '';
    auditFilters.to = '';
    auditFilters.page = 1;
    loadAuditLogs();
}

function goToAuditPage(page: number): void {
    auditFilters.page = page;
    loadAuditLogs();
}

async function exportAuditLogsCsv(): Promise<void> {
    auditExporting.value = true;
    try {
        const { blob, filename } = await apiGetBlob(`/inventory-procurement/items/${props.itemId}/audit-logs/export`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `item-${props.itemId}-audit-logs.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch {
        notifyError('Failed to export audit logs.');
    } finally {
        auditExporting.value = false;
    }
}

function expiryBadgeClass(state: string): string {
    switch (state) {
        case 'expired': return 'bg-destructive text-destructive-foreground';
        case 'critical': return 'bg-orange-600 text-white';
        case 'warning': return 'bg-yellow-500 text-black';
        default: return 'bg-green-600 text-white';
    }
}

function stockStateLabel(state: string | null | undefined): string {
    if (!state) return 'Unknown';
    const labels: Record<string, string> = {
        in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock',
        overstocked: 'Overstocked', expired: 'Expired', pending: 'Pending',
    };
    return labels[state] || formatEnumLabel(state);
}

function clinicalCatalogLabel(id: string | null | undefined): string {
    if (!id) return 'No link';
    return `Clinical #${id}`;
}

watch(
    [sharedPermissionNames, isFacilitySuperAdmin],
    ([permissionNames, hasSuperAdmin]) => {
        evaluatePermissions(permissionNames ?? [], hasSuperAdmin);
    },
    { immediate: true },
);

onMounted(() => {
    loadItem();
});
</script>

<template>
    <Head title="Inventory Item Details" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <div v-if="itemLoading" class="flex flex-col gap-4">
                <section class="rounded-lg border border-border bg-card shadow-sm">
                    <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                        <div class="flex min-w-0 items-center gap-3">
                            <Skeleton class="size-10 shrink-0 rounded-lg" />
                            <div class="space-y-1">
                                <Skeleton class="h-5 w-48" />
                                <Skeleton class="h-3 w-72" />
                            </div>
                        </div>
                    </div>
                </section>

                <Card class="min-w-0 flex-1">
                    <CardHeader class="pb-3">
                        <Skeleton class="h-5 w-32" />
                        <Skeleton class="mt-1 h-3 w-64" />
                    </CardHeader>
                    <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div v-for="i in 6" :key="i" class="space-y-1">
                            <Skeleton class="h-3 w-20" />
                            <Skeleton class="h-4 w-32" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Alert v-else-if="itemError" variant="destructive" class="m-4">
                <AlertTitle>Item load failed</AlertTitle>
                <AlertDescription>{{ itemError }}</AlertDescription>
            </Alert>

            <template v-else-if="item">
                <section class="rounded-lg border border-border bg-card shadow-sm">
                    <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                        <div class="flex min-w-0 items-center gap-3">
                            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                                <AppIcon name="package" class="size-5" />
                            </div>
                            <div class="min-w-0 space-y-0.5">
                                <div class="flex flex-wrap items-center gap-2">
                                    <h1 class="text-base font-semibold tracking-tight md:text-lg">{{ item.itemName || 'Inventory item' }}</h1>
                                    <Badge v-if="item.clinicalCatalogItemId" variant="secondary" class="gap-1">
                                        <AppIcon name="check-circle" class="size-3" />
                                        Catalog
                                    </Badge>
                                    <Badge v-else variant="outline">Manual</Badge>
                                    <Badge v-if="item.stockState" variant="secondary" class="capitalize">
                                        {{ stockStateLabel(item.stockState) }}
                                    </Badge>
                                </div>
                                <p class="truncate text-xs text-muted-foreground">
                                    {{ item.itemCode || 'No code' }} · {{ item.category ? formatEnumLabel(item.category) : 'No category' }} · {{ item.unit || 'No unit' }}
                                </p>
                            </div>
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                            <Button variant="outline" size="sm" class="h-8 gap-1.5" as-child>
                                <Link :href="'/inventory-procurement/stock-control'">
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Stock Control
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>

                <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">

                <Tabs v-model="activeTab" class="flex h-full min-h-0 flex-col">
                    <div class="shrink-0 border-b bg-muted/5 px-4 py-2.5">
                        <TabsList class="grid h-9 w-full gap-1 bg-muted/40 p-1" :class="canManageItems && canViewAudit ? 'grid-cols-4' : 'grid-cols-3'">
                            <TabsTrigger value="overview" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                <span class="flex items-center gap-1 leading-none">
                                    <AppIcon name="layout-grid" class="size-3" />
                                    Overview
                                </span>
                            </TabsTrigger>
                            <TabsTrigger value="stock" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                <span class="flex items-center gap-1 leading-none">
                                    <AppIcon name="layers" class="size-3" />
                                    Batches
                                </span>
                            </TabsTrigger>
                            <TabsTrigger v-if="canManageItems" value="units" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                <span class="flex items-center gap-1 leading-none">
                                    <AppIcon name="list" class="size-3" />
                                    Units
                                </span>
                            </TabsTrigger>
                            <TabsTrigger v-if="canViewAudit" value="audit" class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                <span class="flex items-center gap-1 leading-none">
                                    <AppIcon name="file-text" class="size-3" />
                                    Audit
                                </span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                        <div class="space-y-5 p-4">
                            <TabsContent value="overview" class="mt-0 min-w-0 space-y-5">
                                <div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Item code</p>
                                        <p class="text-sm font-semibold">{{ item.itemCode || 'Not recorded' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Item name</p>
                                        <p class="text-sm font-semibold">{{ item.itemName || 'Not recorded' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Category</p>
                                        <p class="text-sm font-semibold">{{ item.category ? formatEnumLabel(item.category) : 'Unclassified' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Subcategory</p>
                                        <p class="text-sm font-semibold">{{ item.subcategory ? formatEnumLabel(item.subcategory) : 'Not assigned' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Stock unit</p>
                                        <p class="text-sm font-semibold">{{ item.unit || 'Not set' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Manufacturer</p>
                                        <p class="text-sm font-semibold">{{ item.manufacturer || 'Not recorded' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Bin location</p>
                                        <p class="text-sm font-semibold">{{ item.binLocation || 'Not assigned' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Storage conditions</p>
                                        <p class="text-sm font-semibold">{{ item.storageConditions ? formatEnumLabel(item.storageConditions) : 'Not specified' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Cold chain</p>
                                        <p class="text-sm font-semibold">{{ item.requiresColdChain ? 'Required' : 'Not required' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Controlled substance</p>
                                        <p class="text-sm font-semibold">{{ item.isControlledSubstance ? (item.controlledSubstanceSchedule || 'Yes') : 'No' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Clinical link</p>
                                        <p class="text-sm font-semibold">{{ item.clinicalCatalogItemId ? clinicalCatalogLabel(item.clinicalCatalogItemId) : 'No clinical definition link' }}</p>
                                    </div>
                                </div>

                                <hr class="border-border/50" />

                                <div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">VEN</p>
                                        <p class="text-sm font-semibold">{{ item.venClassification ? formatEnumLabel(item.venClassification) : 'Not set' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">ABC</p>
                                        <p class="text-sm font-semibold">{{ item.abcClassification || 'Not set' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">MSD code</p>
                                        <p class="text-sm font-semibold">{{ item.msdCode || 'Not recorded' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">NHIF code</p>
                                        <p class="text-sm font-semibold">{{ item.nhifCode || 'Not recorded' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Barcode</p>
                                        <p class="text-sm font-semibold">{{ item.barcode || 'Not recorded' }}</p>
                                    </div>
                                    <div class="space-y-1.5">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                                        <p class="text-sm font-semibold">{{ formatDateTime(item.createdAt) }}</p>
                                    </div>
                                    <div class="space-y-1.5 sm:col-span-2">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Last updated</p>
                                        <p class="text-sm font-semibold">{{ formatDateTime(item.updatedAt) }}</p>
                                    </div>
                                </div>

                                <template v-if="item.genericName || item.dosageForm || item.strength || item.dispensingUnit || item.conversionFactor != null">
                                    <hr class="border-border/50" />
                                    <div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                                        <div class="space-y-1.5">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Generic name</p>
                                            <p class="text-sm font-semibold">{{ item.genericName || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1.5">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Dosage form</p>
                                            <p class="text-sm font-semibold">{{ item.dosageForm || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1.5">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Strength</p>
                                            <p class="text-sm font-semibold">{{ item.strength || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1.5">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Dispensing unit</p>
                                            <p class="text-sm font-semibold">{{ item.dispensingUnit || 'Not recorded' }}</p>
                                        </div>
                                        <div v-if="item.conversionFactor != null" class="space-y-1.5 sm:col-span-2">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Unit conversion</p>
                                            <p class="text-sm font-semibold">1 {{ item.unit || 'stock unit' }} = {{ Number(item.conversionFactor) }} {{ item.dispensingUnit || 'dispensing unit' }}(s)</p>
                                        </div>
                                    </div>
                                </template>
                            </TabsContent>

                            <TabsContent value="stock" class="mt-0 min-w-0 space-y-4">
                                <div v-if="batchesLoading" class="text-sm text-muted-foreground">Loading batches...</div>
                                <div v-else-if="batches.length === 0" class="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                                    No batches have been recorded for this item yet.
                                </div>
                                <div v-else class="overflow-hidden rounded-lg border">
                                    <div v-for="batch in batches" :key="batch.id" class="border-b bg-background/70 p-3 transition-colors last:border-b-0 hover:bg-muted/30">
                                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                            <div class="min-w-0 space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Batch #</p>
                                                <p class="break-words font-mono text-sm">{{ batch.batchNumber }}</p>
                                            </div>
                                            <div class="min-w-0 space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Lot #</p>
                                                <p class="break-words text-sm">{{ batch.lotNumber ?? '-' }}</p>
                                            </div>
                                            <div class="min-w-0 space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Quantity</p>
                                                <p class="text-sm font-medium">{{ batch.quantity }}</p>
                                            </div>
                                            <div class="min-w-0 space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Expiry</p>
                                                <p class="text-sm">{{ formatDateOnly(batch.expiryDate) }}</p>
                                            </div>
                                            <div class="min-w-0 space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                                                <div>
                                                    <span v-if="batch.expiryState" class="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium" :class="expiryBadgeClass(batch.expiryState)">{{ batch.expiryState }}</span>
                                                    <span v-else class="text-sm text-muted-foreground">{{ formatEnumLabel(batch.status) }}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent v-if="canManageItems" value="units" class="mt-0 min-w-0 space-y-4">
                                <p v-if="unitsLoading" class="text-sm text-muted-foreground">Loading units...</p>
                                <div v-else-if="units.length === 0" class="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                                    No units configured yet.
                                </div>
                                <div v-else class="overflow-hidden rounded-lg border">
                                    <div v-for="unit in units" :key="unit.id" class="border-b bg-background/70 p-3 last:border-b-0">
                                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            <div class="min-w-0 space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Unit</p>
                                                <p class="break-words text-sm font-medium">{{ unit.unitName || unit.unitCode || '-' }}</p>
                                            </div>
                                            <div class="min-w-0 space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Base quantity</p>
                                                <p class="text-sm font-medium">{{ unit.baseQuantity }}</p>
                                            </div>
                                            <div class="min-w-0 space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Role</p>
                                                <p class="text-xs">
                                                    <span v-if="unit.isBaseUnit" class="mr-2 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">Base</span>
                                                    <span v-if="unit.isDefaultSalesUnit" class="mr-2 inline-block rounded bg-sky-50 px-1.5 py-0.5 text-sky-700 dark:bg-sky-950 dark:text-sky-200">Default sales</span>
                                                    <span v-if="unit.isDefaultPurchaseUnit" class="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-200">Default purchase</span>
                                                    <span v-if="!unit.isBaseUnit && !unit.isDefaultSalesUnit && !unit.isDefaultPurchaseUnit" class="text-muted-foreground">Extra unit</span>
                                                </p>
                                            </div>
                                            <div class="min-w-0 space-y-1">
                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                                                <p class="text-xs">
                                                    <span :class="unit.isActive ? 'text-emerald-700' : 'text-muted-foreground'">{{ unit.isActive ? 'Active' : 'Inactive' }}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <p class="text-xs text-muted-foreground">Prices per unit are configured in <span class="font-medium">Billing Service Catalog</span>.</p>
                            </TabsContent>

                            <TabsContent v-if="canViewAudit" value="audit" class="mt-0 min-w-0 space-y-4">
                                <div class="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                                    <div class="grid gap-1">
                                        <Label for="item-audit-q">Action Text Search</Label>
                                        <Input id="item-audit-q" v-model="auditFilters.q" placeholder="item.updated, status.updated..." />
                                    </div>
                                    <div class="grid gap-1">
                                        <Label for="item-audit-action">Action (exact)</Label>
                                        <Input id="item-audit-action" v-model="auditFilters.action" placeholder="Optional exact action key" />
                                    </div>
                                    <div class="grid gap-1">
                                        <Label for="item-audit-actor-type">Actor Type</Label>
                                        <Select :model-value="toSelectValue(auditFilters.actorType)" @update:model-value="auditFilters.actorType = fromSelectValue(String($event ?? EMPTY))">
                                            <SelectTrigger id="item-audit-actor-type">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem :value="EMPTY">All</SelectItem>
                                                <SelectItem value="user">User</SelectItem>
                                                <SelectItem value="system">System</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-1">
                                        <Label for="item-audit-actor-id">Actor ID</Label>
                                        <Input id="item-audit-actor-id" v-model="auditFilters.actorId" inputmode="numeric" placeholder="Optional user id" />
                                    </div>
                                    <div class="grid gap-1">
                                        <Label for="item-audit-from">From</Label>
                                        <Input id="item-audit-from" v-model="auditFilters.from" type="datetime-local" />
                                    </div>
                                    <div class="grid gap-1">
                                        <Label for="item-audit-to">To</Label>
                                        <Input id="item-audit-to" v-model="auditFilters.to" type="datetime-local" />
                                    </div>
                                    <div class="grid gap-1">
                                        <Label for="item-audit-per-page">Rows Per Page</Label>
                                        <Select :model-value="String(auditFilters.perPage)" @update:model-value="auditFilters.perPage = Number($event)">
                                            <SelectTrigger id="item-audit-per-page">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="50">50</SelectItem>
                                                <SelectItem value="100">100</SelectItem>
                                                <SelectItem value="150">150</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="flex flex-wrap items-end gap-2">
                                        <Button size="sm" :disabled="auditLoading" @click="applyAuditFilters">{{ auditLoading ? 'Applying...' : 'Apply Filters' }}</Button>
                                        <Button size="sm" variant="outline" :disabled="auditLoading" @click="resetAuditFilters">Reset</Button>
                                        <Button size="sm" variant="outline" :disabled="auditLoading || auditExporting" @click="exportAuditLogsCsv">{{ auditExporting ? 'Preparing...' : 'Export CSV' }}</Button>
                                    </div>
                                </div>

                                <p v-if="auditLoading" class="text-sm text-muted-foreground">Loading audit logs...</p>
                                <Alert v-else-if="auditError" variant="destructive">
                                    <AlertTitle>Audit load issue</AlertTitle>
                                    <AlertDescription>{{ auditError }}</AlertDescription>
                                </Alert>
                                <div v-else-if="auditLogs.length === 0" class="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                                    No audit logs found for the current filters.
                                </div>
                                <div v-else class="overflow-hidden rounded-lg border">
                                    <div v-for="log in auditLogs" :key="log.id" class="border-b p-2 text-xs transition-colors last:border-b-0 hover:bg-muted/30">
                                        <p class="font-medium">{{ log.action }}</p>
                                        <p class="text-muted-foreground">{{ formatDateTime(log.createdAt) }} | {{ auditActorLabel(log) }}</p>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                                    <Button size="sm" variant="outline" :disabled="auditLoading || !auditMeta || auditMeta.currentPage <= 1" @click="goToAuditPage((auditMeta?.currentPage ?? 2) - 1)">Previous</Button>
                                    <p>Page {{ auditMeta?.currentPage ?? 1 }} of {{ auditMeta?.lastPage ?? 1 }} | {{ auditMeta?.total ?? auditLogs.length }} logs</p>
                                    <Button size="sm" variant="outline" :disabled="auditLoading || !auditMeta || auditMeta.currentPage >= auditMeta.lastPage" @click="goToAuditPage((auditMeta?.currentPage ?? 0) + 1)">Next</Button>
                                </div>
                            </TabsContent>
                        </div>
                    </ScrollArea>
                </Tabs>
            </Card>
        </template>
        </div>
    </AppLayout>
</template>

