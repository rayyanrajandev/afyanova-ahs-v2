<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import SupplyChainTaskShell from '@/pages/inventory-procurement/components/SupplyChainTaskShell.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useInventoryMasterLookups } from '@/composables/useInventoryMasterLookups';
import { useInventoryProcurementAccess } from '@/composables/useInventoryProcurementAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
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
});

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

const unitLabel = computed(() => {
    const unit = selectedItem.value?.unit;
    return typeof unit === 'string' && unit.trim() ? unit.trim() : 'units';
});

const canSubmit = computed(() => (
    canReconcileStock.value
    && itemId.value.trim() !== ''
    && countForm.countedStock.trim() !== ''
    && countForm.reason.trim() !== ''
));

function onItemSelected(item: LookupItem | null): void {
    selectedItem.value = item;
    if (item && countForm.countedStock.trim() === '') {
        countForm.countedStock = String(item.currentStock ?? '');
    }
}

async function submitCount(): Promise<void> {
    if (!canSubmit.value || submitting.value) {
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
        <div class="flex h-full flex-1 flex-col gap-4 p-4 md:p-6">
            <Alert v-if="!canRead" variant="destructive">
                <AlertTitle>Access restricted</AlertTitle>
                <AlertDescription>You do not have permission to record cycle counts.</AlertDescription>
            </Alert>

            <SupplyChainTaskShell
                v-else
                title="Cycle count"
                description="Record a physical stock count and post the variance to the ledger — use after ward audits or store checks."
                icon="check-circle"
                :breadcrumbs="breadcrumbs"
            >
                <div v-if="!canReconcileStock" class="text-sm text-muted-foreground">
                    Stock reconciliation permission is required for cycle counts.
                </div>
                <div v-else class="mx-auto max-w-xl space-y-4">
                    <InventoryItemLookupField
                        v-model="itemId"
                        input-id="count-item"
                        label="Store item *"
                        browse-on-focus
                        @selected="onItemSelected"
                    />

                    <Card v-if="selectedItem">
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
                                :class="variance === 0 ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'"
                            >
                                Variance: <strong>{{ variance > 0 ? '+' : '' }}{{ variance }}</strong> {{ unitLabel }}
                            </div>
                            <div class="grid gap-1.5">
                                <Label>Count session reference</Label>
                                <Input v-model="countForm.sessionReference" placeholder="e.g. COUNT-2026-W12-A" />
                            </div>
                            <div class="grid gap-1.5">
                                <Label>Reason *</Label>
                                <Input v-model="countForm.reason" placeholder="Cycle count, spot check, audit…" />
                                <p v-if="fieldError('reason')" class="text-xs text-destructive">{{ fieldError('reason') }}</p>
                            </div>
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
                </div>
            </SupplyChainTaskShell>
        </div>
    </AppLayout>
</template>
