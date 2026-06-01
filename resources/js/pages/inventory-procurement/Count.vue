<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import InventoryBarcodeScanField from '@/components/inventory/InventoryBarcodeScanField.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import FacilityWorkspacePageHeader from '@/components/layout/FacilityWorkspacePageHeader.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { InventoryBarcodeItem } from '@/composables/useInventoryBarcodeLookup';
import { useInventoryMasterLookups } from '@/composables/useInventoryMasterLookups';
import { useInventoryProcurementAccess } from '@/composables/useInventoryProcurementAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import {
    buildCycleCountSessionReferenceOptions,
    CYCLE_COUNT_REASON_OPTIONS,
} from '@/lib/cycleCountReferences';
import { INVENTORY_PROCUREMENT_HOME_PATH } from '@/lib/inventoryProcurement';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { BreadcrumbItem } from '@/types';

type ApiError = Error & { payload?: { message?: string; errors?: Record<string, string[]> } };
type LookupItem = {
    id: string;
    itemName?: string | null;
    unit?: string | null;
    currentStock?: number | string | null;
    category?: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: INVENTORY_PROCUREMENT_HOME_PATH },
    { title: 'Cycle count', href: '/inventory-procurement/count' },
];

const { canRead, canReconcileStock, loadPermissions } = useInventoryProcurementAccess();
const { categoryRequiresExpiry, loadLookups } = useInventoryMasterLookups();

const itemId = ref('');
const selectedItem = ref<LookupItem | null>(null);
const submitting = ref(false);
const formError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const countForm = reactive({
    countedStock: '',
    sessionReference: '',
    reason: '',
    notes: '',
    occurredAt: '',
    largeVarianceConfirmed: false,
});

const LARGE_VARIANCE_PERCENT = 10;
const LARGE_VARIANCE_ABSOLUTE_FLOOR = 10;

const sessionReferenceOptions = buildCycleCountSessionReferenceOptions();

function fieldError(key: string): string | null {
    return fieldErrors.value[key]?.[0] ?? null;
}

const systemStock = computed(() => {
    const value = Number(selectedItem.value?.currentStock ?? 0);
    return Number.isFinite(value) ? value : 0;
});

const countedValue = computed(() => {
    const value = Number(countForm.countedStock);
    return Number.isFinite(value) ? value : null;
});

const variance = computed(() => {
    if (countedValue.value === null) {
        return null;
    }

    return countedValue.value - systemStock.value;
});

const absoluteVariance = computed(() => (variance.value === null ? null : Math.abs(variance.value)));
const largeVarianceThreshold = computed(() => Math.max(LARGE_VARIANCE_ABSOLUTE_FLOOR, systemStock.value * (LARGE_VARIANCE_PERCENT / 100)));
const requiresVarianceApproval = computed(() => (
    absoluteVariance.value !== null
    && absoluteVariance.value > 0
    && absoluteVariance.value >= largeVarianceThreshold.value
));

const unitLabel = computed(() => {
    const unit = selectedItem.value?.unit;
    return typeof unit === 'string' && unit.trim() ? unit.trim() : 'units';
});

const canSubmit = computed(() => (
    canReconcileStock.value
    && itemId.value.trim() !== ''
    && countForm.countedStock.trim() !== ''
    && countForm.reason.trim() !== ''
    && (!requiresVarianceApproval.value || countForm.largeVarianceConfirmed)
));

function onItemSelected(item: LookupItem | null): void {
    selectedItem.value = item;
}

function onBarcodeItemResolved(item: InventoryBarcodeItem): void {
    itemId.value = item.id;
    selectedItem.value = {
        id: item.id,
        itemName: item.itemName,
        unit: item.unit,
        currentStock: item.currentStock,
        category: item.category,
    };
}

async function submitCount(): Promise<void> {
    if (!canSubmit.value || submitting.value) {
        if (requiresVarianceApproval.value && !countForm.largeVarianceConfirmed) {
            notifyError('Large variance requires recount or supervisor approval before posting.');
        }
        return;
    }

    submitting.value = true;
    formError.value = null;
    fieldErrors.value = {};

    try {
        await apiRequestJson('POST', '/inventory-procurement/stock-movements/reconcile', {
            body: {
                itemId: itemId.value.trim(),
                countedStock: Number(countForm.countedStock),
                reason: countForm.reason.trim(),
                notes: countForm.notes.trim() || null,
                sessionReference: countForm.sessionReference.trim() || null,
                occurredAt: countForm.occurredAt || null,
            },
        });
        notifySuccess('Cycle count recorded — stock adjusted to match physical count.');
        itemId.value = '';
        selectedItem.value = null;
        countForm.countedStock = '';
        countForm.sessionReference = '';
        countForm.reason = '';
        countForm.notes = '';
        countForm.largeVarianceConfirmed = false;
    } catch (error) {
        const apiError = error as ApiError;
        fieldErrors.value = apiError.payload?.errors ?? {};
        formError.value = messageFromUnknown(error, 'Unable to record cycle count.');
        notifyError(formError.value);
    } finally {
        submitting.value = false;
    }
}

onMounted(async () => {
    await loadPermissions();
    if (canRead.value) {
        await loadLookups();
    }
});
</script>

<template>
    <Head title="Cycle count" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <Alert v-if="!canRead" variant="destructive">
                <AlertTitle>Access restricted</AlertTitle>
                <AlertDescription>You do not have permission to record cycle counts.</AlertDescription>
            </Alert>

            <template v-else>
                <FacilityWorkspacePageHeader
                    title="Cycle count"
                    description="Record a physical stock count; large variances require recount or supervisor approval before posting."
                    icon="check-circle"
                    :back-href="INVENTORY_PROCUREMENT_HOME_PATH"
                    back-label="Supply chain home"
                />

                <Card class="w-full rounded-lg shadow-sm">
                    <CardContent class="space-y-4 pt-6">
                        <div v-if="!canReconcileStock" class="text-sm text-muted-foreground">
                            Stock reconciliation permission is required for cycle counts.
                        </div>
                        <template v-else>
                            <InventoryBarcodeScanField
                                input-id="count-barcode"
                                label="Scan item barcode"
                                helper-text="Scan labelled stock or search the item master below."
                                @resolved="onBarcodeItemResolved"
                            />
                            <InventoryItemLookupField
                                v-model="itemId"
                                input-id="count-item"
                                label="Store item *"
                                browse-on-focus
                                @selected="onItemSelected"
                            />

                            <Card v-if="selectedItem" class="shadow-none">
                                <CardHeader class="pb-2">
                                    <CardTitle class="text-base">{{ selectedItem.itemName }}</CardTitle>
                                    <CardDescription>
                                        System on-hand: {{ systemStock }} {{ unitLabel }}
                                        <template v-if="categoryRequiresExpiry(selectedItem.category)"> · batch-tracked category</template>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent class="grid gap-4">
                                    <div class="grid gap-1.5">
                                        <Label>Physical count *</Label>
                                        <Input v-model="countForm.countedStock" type="number" min="0" step="0.001" />
                                        <p v-if="fieldError('countedStock')" class="text-xs text-destructive">{{ fieldError('countedStock') }}</p>
                                    </div>
                                    <div
                                        v-if="variance !== null"
                                        class="rounded-md border px-3 py-2 text-sm"
                                        :class="variance === 0 ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : requiresVarianceApproval ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'"
                                    >
                                        Variance: <strong>{{ variance > 0 ? '+' : '' }}{{ variance }}</strong> {{ unitLabel }}
                                        <span v-if="requiresVarianceApproval" class="block pt-1 text-xs">
                                            Recount or supervisor approval required before posting this adjustment.
                                        </span>
                                    </div>
                                    <label v-if="requiresVarianceApproval" class="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm">
                                        <input
                                            v-model="countForm.largeVarianceConfirmed"
                                            type="checkbox"
                                            class="mt-1 rounded border"
                                        />
                                        <span>
                                            Recount completed or supervisor approved this large variance.
                                            <span class="block text-xs text-muted-foreground">Add the approver or recount sheet reference below.</span>
                                        </span>
                                    </label>
                                    <div v-else-if="variance === 0" class="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">
                                        No adjustment will be posted because physical count matches system stock.
                                    </div>
                                    <SearchableSelectField
                                        input-id="count-session-reference"
                                        v-model="countForm.sessionReference"
                                        label="Count session reference"
                                        :options="sessionReferenceOptions"
                                        placeholder="Select this week’s count session"
                                        search-placeholder="Search weekly, monthly, spot, ABC…"
                                        helper-text="Pick a standard session ID or type your facility’s sheet number."
                                        :allow-custom-value="true"
                                        empty-text="No preset matched — press Enter to use your text."
                                    />
                                    <SearchableSelectField
                                        input-id="count-reason"
                                        v-model="countForm.reason"
                                        label="Reason *"
                                        :options="CYCLE_COUNT_REASON_OPTIONS"
                                        placeholder="Select count reason"
                                        search-placeholder="Search scheduled, spot check, audit…"
                                        :error-message="fieldError('reason')"
                                        :allow-custom-value="true"
                                        empty-text="No preset matched — press Enter to use your text."
                                    />
                                    <div class="grid gap-1.5">
                                        <Label>Notes</Label>
                                        <Textarea v-model="countForm.notes" class="min-h-14" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Alert v-if="formError" variant="destructive">
                                <AlertDescription>{{ formError }}</AlertDescription>
                            </Alert>

                            <Button class="gap-1.5" :disabled="submitting || !canSubmit" @click="submitCount">
                                <AppIcon name="check-circle" class="size-4" />
                                {{ submitting ? 'Saving…' : 'Post count adjustment' }}
                            </Button>
                        </template>
                    </CardContent>
                </Card>
            </template>
        </div>
    </AppLayout>
</template>
