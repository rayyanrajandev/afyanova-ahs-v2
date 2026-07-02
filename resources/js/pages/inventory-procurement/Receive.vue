<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import InventoryBarcodeScanField from '@/components/inventory/InventoryBarcodeScanField.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import FacilityWorkspacePageHeader from '@/components/layout/FacilityWorkspacePageHeader.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { InventoryBarcodeItem } from '@/composables/useInventoryBarcodeLookup';
import { useInventoryMasterLookups } from '@/composables/useInventoryMasterLookups';
import { useInventoryProcurementAccess } from '@/composables/useInventoryProcurementAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { INVENTORY_PROCUREMENT_HOME_PATH, supplyChainHref, procurementGrnPrintHref } from '@/lib/inventoryProcurement';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

type ApiError = Error & { payload?: { message?: string; errors?: Record<string, string[]> } };
type ProcurementRequest = Record<string, unknown>;
type LookupItem = {
    id: string;
    itemName?: string | null;
    category?: string | null;
    unit?: string | null;
    currentStock?: number | string | null;
};

const EMPTY_SELECT = '__empty__';
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
    { title: 'Receive stock', href: '/inventory-procurement/receive' },
];

const receiveMode = ref<'procurement' | 'direct'>('procurement');
const step = ref(1);

const {
    canRead,
    canCreateMovement,
    canUpdateRequestStatus,
    loadPermissions,
} = useInventoryProcurementAccess();

const {
    suppliers,
    warehouses,
    loadLookups,
    categoryRequiresExpiry,
    lookupLabel,
    lookupsLoading,
} = useInventoryMasterLookups();

const orderedRequests = ref<ProcurementRequest[]>([]);
const requestsLoading = ref(false);
const selectedRequest = ref<ProcurementRequest | null>(null);

const directItemId = ref('');
const directItem = ref<LookupItem | null>(null);

const submitting = ref(false);
const formError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const lastGrnRequestId = ref<string | null>(null);

const receiveForm = reactive({
    receivedQuantity: '',
    receivedUnitCost: '',
    warehouseId: '',
    sourceSupplierId: '',
    batchNumber: '',
    lotNumber: '',
    manufactureDate: '',
    expiryDate: '',
    binLocation: '',
    reason: '',
    notes: '',
    occurredAt: '',
});

function toSelect(value: string): string {
    return value.trim() === '' ? EMPTY_SELECT : value;
}

function fromSelect(value: string): string {
    return value === EMPTY_SELECT ? '' : value;
}

function fieldError(key: string): string | null {
    return fieldErrors.value[key]?.[0] ?? null;
}

const activeCategory = computed(() => {
    if (receiveMode.value === 'procurement') {
        return String(selectedRequest.value?.itemCategory ?? '');
    }

    return String(directItem.value?.category ?? '');
});

const requiresBatch = computed(() => categoryRequiresExpiry(activeCategory.value));

const canSubmitProcurement = computed(() => (
    canUpdateRequestStatus.value
    && canCreateMovement.value
    && selectedRequest.value
    && receiveForm.receivedQuantity.trim() !== ''
));

const canSubmitDirect = computed(() => (
    canCreateMovement.value
    && directItemId.value.trim() !== ''
    && receiveForm.receivedQuantity.trim() !== ''
    && receiveForm.reason.trim() !== ''
));

async function loadOrderedRequests(): Promise<void> {
    requestsLoading.value = true;
    try {
        const response = await apiRequestJson<{ data: ProcurementRequest[]; meta?: { total?: number } }>(
            'GET',
            '/inventory-procurement/procurement-requests',
            { query: { status: 'ordered', perPage: 25, sortBy: 'neededBy', sortDir: 'asc' } },
        );
        orderedRequests.value = response.data ?? [];
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to load orders awaiting receipt.'));
        orderedRequests.value = [];
    } finally {
        requestsLoading.value = false;
    }
}

function selectRequest(request: ProcurementRequest): void {
    selectedRequest.value = request;
    formError.value = null;
    fieldErrors.value = {};
    receiveForm.receivedQuantity = String(request.orderedQuantity ?? request.requestedQuantity ?? '');
    receiveForm.receivedUnitCost = request.unitCostEstimate != null ? String(request.unitCostEstimate) : '';
    receiveForm.warehouseId = String(request.receivingWarehouseId ?? '');
    receiveForm.notes = String(request.receivingNotes ?? request.notes ?? '');
    receiveForm.reason = '';
    receiveForm.batchNumber = '';
    receiveForm.lotNumber = '';
    receiveForm.manufactureDate = '';
    receiveForm.expiryDate = '';
    receiveForm.binLocation = '';
    receiveForm.occurredAt = '';
    step.value = 2;
}

function resetDirectItem(): void {
    directItemId.value = '';
    directItem.value = null;
    receiveForm.receivedQuantity = '';
    receiveForm.reason = '';
    receiveForm.notes = '';
    receiveForm.sourceSupplierId = '';
    receiveForm.warehouseId = '';
    receiveForm.batchNumber = '';
    receiveForm.expiryDate = '';
    step.value = 1;
}

function onDirectItemSelected(item: LookupItem | null): void {
    directItem.value = item;
    if (item) {
        step.value = 2;
    }
}

function onBarcodeItemResolved(item: InventoryBarcodeItem): void {
    directItemId.value = item.id;
    directItem.value = {
        id: item.id,
        itemName: item.itemName,
        category: item.category,
        unit: item.unit,
        currentStock: item.currentStock,
    };
    step.value = 2;
}

async function submitProcurementReceive(): Promise<void> {
    if (!selectedRequest.value || !canSubmitProcurement.value || submitting.value) {
        return;
    }

    submitting.value = true;
    formError.value = null;
    fieldErrors.value = {};

    try {
        const response = await apiRequestJson<{ data: ProcurementRequest }>(
            'POST',
            `/inventory-procurement/procurement-requests/${selectedRequest.value.id}/receive`,
            {
                body: {
                    receivedQuantity: Number(receiveForm.receivedQuantity),
                    receivedUnitCost: receiveForm.receivedUnitCost.trim() === '' ? null : Number(receiveForm.receivedUnitCost),
                    warehouseId: receiveForm.warehouseId.trim() || null,
                    batchNumber: receiveForm.batchNumber.trim() || null,
                    lotNumber: receiveForm.lotNumber.trim() || null,
                    manufactureDate: receiveForm.manufactureDate || null,
                    expiryDate: receiveForm.expiryDate || null,
                    binLocation: receiveForm.binLocation.trim() || null,
                    reason: receiveForm.reason.trim() || null,
                    notes: receiveForm.notes.trim() || null,
                    occurredAt: receiveForm.occurredAt || null,
                },
            },
        );
        const receivedId = String(response.data?.id ?? selectedRequest.value.id ?? '').trim();
        lastGrnRequestId.value = receivedId || null;
        notifySuccess('Goods received into store stock.');
        selectedRequest.value = null;
        step.value = 1;
        await loadOrderedRequests();
    } catch (error) {
        const apiError = error as ApiError;
        fieldErrors.value = apiError.payload?.errors ?? {};
        formError.value = messageFromUnknown(error, 'Unable to confirm receipt.');
        notifyError(formError.value);
    } finally {
        submitting.value = false;
    }
}

async function submitDirectReceive(): Promise<void> {
    if (!canSubmitDirect.value || submitting.value) {
        return;
    }

    submitting.value = true;
    formError.value = null;
    fieldErrors.value = {};

    try {
        await apiRequestJson('POST', '/inventory-procurement/stock-movements', {
            body: {
                itemId: directItemId.value.trim(),
                movementType: 'receive',
                sourceSupplierId: receiveForm.sourceSupplierId.trim() || null,
                destinationWarehouseId: receiveForm.warehouseId.trim() || null,
                quantity: Number(receiveForm.receivedQuantity),
                batchNumber: requiresBatch.value ? (receiveForm.batchNumber.trim() || null) : null,
                lotNumber: requiresBatch.value ? (receiveForm.lotNumber.trim() || null) : null,
                manufactureDate: requiresBatch.value ? (receiveForm.manufactureDate || null) : null,
                expiryDate: requiresBatch.value ? (receiveForm.expiryDate || null) : null,
                binLocation: requiresBatch.value ? (receiveForm.binLocation.trim() || null) : null,
                reason: receiveForm.reason.trim() || 'Store receipt',
                notes: receiveForm.notes.trim() || null,
                occurredAt: receiveForm.occurredAt || null,
            },
        });
        notifySuccess('Stock received.');
        resetDirectItem();
    } catch (error) {
        const apiError = error as ApiError;
        fieldErrors.value = apiError.payload?.errors ?? {};
        formError.value = messageFromUnknown(error, 'Unable to record receipt.');
        notifyError(formError.value);
    } finally {
        submitting.value = false;
    }
}

watch(receiveMode, () => {
    step.value = 1;
    selectedRequest.value = null;
    resetDirectItem();
    formError.value = null;
    fieldErrors.value = {};
    lastGrnRequestId.value = null;
});

onMounted(async () => {
    await loadPermissions();
    if (!canRead.value) {
        return;
    }

    await Promise.all([loadLookups(), loadOrderedRequests()]);
});
</script>

<template>
    <Head title="Receive stock" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <Alert v-if="!canRead" variant="destructive">
                <AlertTitle>Access restricted</AlertTitle>
                <AlertDescription>You do not have permission to receive stock.</AlertDescription>
            </Alert>

            <template v-else>
                <FacilityWorkspacePageHeader
                    title="Receive stock"
                    description="Confirm deliveries against purchase orders first; use exception receipt only when stock arrives outside the procurement queue."
                    icon="clipboard-list"
                    :back-href="INVENTORY_PROCUREMENT_HOME_PATH"
                    back-label="Supply chain home"
                >
                    <template #actions>
                        <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="requestsLoading" @click="loadOrderedRequests">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            {{ requestsLoading ? 'Refreshing…' : 'Refresh' }}
                        </Button>
                    </template>
                </FacilityWorkspacePageHeader>

                <Card class="rounded-lg shadow-sm">
                <CardContent class="pt-6">
                <Tabs v-model="receiveMode" class="gap-4">
                    <TabsList class="grid h-auto w-full max-w-md grid-cols-2">
                        <TabsTrigger value="procurement" class="text-xs sm:text-sm">Orders awaiting receipt</TabsTrigger>
                        <TabsTrigger value="direct" class="text-xs sm:text-sm">Exception receipt</TabsTrigger>
                    </TabsList>

                    <TabsContent value="procurement" class="mt-0 space-y-4">
                        <div v-if="!canUpdateRequestStatus || !canCreateMovement" class="text-sm text-muted-foreground">
                            You need procurement receive and stock movement permissions for this flow.
                        </div>

                        <template v-else>
                            <Alert v-if="lastGrnRequestId" class="border-primary/30 bg-primary/5">
                                <AlertTitle>Receipt recorded</AlertTitle>
                                <AlertDescription class="flex flex-wrap items-center gap-2">
                                    Print a goods received note for filing with the delivery paperwork.
                                    <Button variant="outline" size="sm" class="h-8" as-child>
                                        <Link :href="procurementGrnPrintHref(lastGrnRequestId)">Open GRN</Link>
                                    </Button>
                                    <Button variant="ghost" size="sm" class="h-8" @click="lastGrnRequestId = null">Dismiss</Button>
                                </AlertDescription>
                            </Alert>

                            <div v-if="step === 1" class="space-y-3">
                                <p class="text-sm text-muted-foreground">Select an order in <strong>Ordered</strong> status awaiting delivery.</p>
                                <div v-if="requestsLoading" class="space-y-2">
                                    <Skeleton v-for="n in 3" :key="n" class="h-16 w-full" />
                                </div>
                                <div v-else-if="orderedRequests.length === 0" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                                    No orders waiting for receipt.
                                    <Button variant="link" class="h-auto p-0 text-primary" as-child>
                                        <Link :href="supplyChainHref({ section: 'procurement' })">Open procurement page</Link>
                                    </Button>
                                </div>
                                <div v-else class="space-y-2">
                                    <button
                                        v-for="request in orderedRequests"
                                        :key="String(request.id)"
                                        type="button"
                                        class="flex w-full flex-col gap-1 rounded-lg border px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
                                        @click="selectRequest(request)"
                                    >
                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                            <span class="font-medium">{{ request.requestNumber ?? 'Request' }}</span>
                                            <Badge variant="outline">{{ formatEnumLabel(String(request.status ?? 'ordered')) }}</Badge>
                                        </div>
                                        <span class="text-sm text-muted-foreground">{{ request.itemName ?? 'Item' }}</span>
                                        <span class="text-xs text-muted-foreground">
                                            Qty {{ request.orderedQuantity ?? request.requestedQuantity }} {{ request.unit ?? '' }}
                                            <template v-if="request.neededBy"> · needed {{ String(request.neededBy).slice(0, 10) }}</template>
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div v-else class="space-y-4">
                                <Button variant="ghost" size="sm" class="h-8 gap-1 px-2" @click="step = 1; selectedRequest = null">
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Back to orders
                                </Button>
                                <Card>
                                    <CardHeader class="pb-2">
                                        <CardTitle class="text-base">{{ selectedRequest?.itemName ?? 'Receipt' }}</CardTitle>
                                        <CardDescription>{{ selectedRequest?.requestNumber }} · confirm quantities and store location</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-4 sm:grid-cols-2">
                                        <div class="grid gap-1.5">
                                            <Label>Received quantity *</Label>
                                            <Input v-model="receiveForm.receivedQuantity" type="number" min="0.001" step="0.001" />
                                            <p v-if="fieldError('receivedQuantity')" class="text-xs text-destructive">{{ fieldError('receivedQuantity') }}</p>
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label>Unit cost</Label>
                                            <Input v-model="receiveForm.receivedUnitCost" type="number" min="0" step="0.01" />
                                        </div>
                                        <div class="grid gap-1.5 sm:col-span-2">
                                            <Label>Store into warehouse</Label>
                                            <Select :model-value="toSelect(receiveForm.warehouseId)" @update:model-value="receiveForm.warehouseId = fromSelect(String($event))">
                                                <SelectTrigger class="w-full"><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="EMPTY_SELECT">Select warehouse</SelectItem>
                                                    <SelectItem v-for="w in warehouses" :key="w.id" :value="w.id">{{ lookupLabel(warehouses, w.id) }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <template v-if="requiresBatch">
                                            <div class="grid gap-1.5 sm:col-span-2">
                                                <Label>Batch number *</Label>
                                                <Input v-model="receiveForm.batchNumber" />
                                                <p v-if="fieldError('batchNumber')" class="text-xs text-destructive">{{ fieldError('batchNumber') }}</p>
                                            </div>
                                            <SingleDatePopoverField v-model="receiveForm.expiryDate" input-id="recv-expiry" label="Expiry date *" :error-message="fieldError('expiryDate')" />
                                        </template>
                                        <div class="grid gap-1.5 sm:col-span-2">
                                            <Label>Delivery notes</Label>
                                            <Textarea v-model="receiveForm.notes" class="min-h-16" placeholder="Delivery note reference, condition on arrival…" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Alert v-if="formError" variant="destructive">
                                    <AlertDescription>{{ formError }}</AlertDescription>
                                </Alert>
                                <Button class="gap-1.5" :disabled="submitting || !canSubmitProcurement" @click="submitProcurementReceive">
                                    <AppIcon name="check-circle" class="size-4" />
                                    {{ submitting ? 'Receiving…' : 'Confirm receipt' }}
                                </Button>
                            </div>
                        </template>
                    </TabsContent>

                    <TabsContent value="direct" class="mt-0 space-y-4">
                        <div v-if="!canCreateMovement" class="text-sm text-muted-foreground">
                            You need stock movement permission to post direct receipts.
                        </div>
                        <template v-else>
                            <Alert class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                                <AlertTitle>Exception receipt</AlertTitle>
                                <AlertDescription>
                                    Use this only for donations, opening balances, emergency replenishment, or deliveries not yet represented by a purchase order. A reason is required for audit.
                                </AlertDescription>
                            </Alert>
                            <div v-if="step === 1" class="max-w-xl space-y-3">
                                <InventoryBarcodeScanField
                                    input-id="receive-direct-barcode"
                                    label="Scan item barcode"
                                    helper-text="Fast path for labelled stock — or search the item master below."
                                    @resolved="onBarcodeItemResolved"
                                />
                                <InventoryItemLookupField
                                    v-model="directItemId"
                                    input-id="receive-direct-item"
                                    label="Store item *"
                                    helper-text="Search the item master — create new items in the workspace if needed."
                                    browse-on-focus
                                    @selected="onDirectItemSelected"
                                />
                            </div>
                            <div v-else class="space-y-4">
                                <Button variant="ghost" size="sm" class="h-8 gap-1 px-2" @click="resetDirectItem">
                                    <AppIcon name="chevron-left" class="size-3.5" />
                                    Change item
                                </Button>
                                <Card>
                                    <CardHeader class="pb-2">
                                        <CardTitle class="text-base">{{ directItem?.itemName ?? 'Direct receipt' }}</CardTitle>
                                        <CardDescription>Posts an audited exception receive movement to increase on-hand stock.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-4 sm:grid-cols-2">
                                        <div class="grid gap-1.5">
                                            <Label>Quantity *</Label>
                                            <Input v-model="receiveForm.receivedQuantity" type="number" min="0.001" step="0.001" />
                                            <p v-if="fieldError('quantity')" class="text-xs text-destructive">{{ fieldError('quantity') }}</p>
                                        </div>
                                        <div class="grid gap-1.5">
                                            <Label>Supplier</Label>
                                            <Select
                                                :model-value="toSelect(receiveForm.sourceSupplierId)"
                                                :disabled="lookupsLoading"
                                                @update:model-value="receiveForm.sourceSupplierId = fromSelect(String($event))"
                                            >
                                                <SelectTrigger class="w-full"><SelectValue placeholder="Optional" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="EMPTY_SELECT">None</SelectItem>
                                                    <SelectItem v-for="s in suppliers" :key="s.id" :value="s.id">{{ lookupLabel(suppliers, s.id) }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-1.5 sm:col-span-2">
                                            <Label>Warehouse</Label>
                                            <Select
                                                :model-value="toSelect(receiveForm.warehouseId)"
                                                @update:model-value="receiveForm.warehouseId = fromSelect(String($event))"
                                            >
                                                <SelectTrigger class="w-full"><SelectValue placeholder="Where stock is stored" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="EMPTY_SELECT">Select warehouse</SelectItem>
                                                    <SelectItem v-for="w in warehouses" :key="w.id" :value="w.id">{{ lookupLabel(warehouses, w.id) }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <template v-if="requiresBatch">
                                            <div class="grid gap-1.5">
                                                <Label>Batch number *</Label>
                                                <Input v-model="receiveForm.batchNumber" />
                                            </div>
                                            <SingleDatePopoverField v-model="receiveForm.expiryDate" input-id="direct-expiry" label="Expiry date *" />
                                        </template>
                                        <div class="grid gap-1.5 sm:col-span-2">
                                        <Label>Exception reason *</Label>
                                        <Input v-model="receiveForm.reason" placeholder="Donation, opening balance, emergency supply…" />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Button class="gap-1.5" :disabled="submitting || !canSubmitDirect" @click="submitDirectReceive">
                                    <AppIcon name="check-circle" class="size-4" />
                                    {{ submitting ? 'Saving…' : 'Receive into store' }}
                                </Button>
                            </div>
                        </template>
                    </TabsContent>
                </Tabs>
                </CardContent>
                </Card>
            </template>
        </div>
    </AppLayout>
</template>
