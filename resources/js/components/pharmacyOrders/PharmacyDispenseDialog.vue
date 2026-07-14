<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { PharmacyOrder, PharmacyOrderStatus } from '@/composables/pharmacyOrders/usePharmacyOrders';
import { usePharmacyMedicationAvailability } from '@/composables/pharmacyOrders/usePharmacyMedicationAvailability';

type Intent = 'preparation' | 'dispense' | null;

const props = withDefaults(
    defineProps<{
        open: boolean;
        order: PharmacyOrder | null;
        intent: Intent;
        loading?: boolean;
        error?: string | null;
    }>(),
    {
        loading: false,
        error: null,
    },
);

const emit = defineEmits<{
    'update:open': [value: boolean];
    submit: [
        payload: {
            status: PharmacyOrderStatus;
            quantityDispensed?: number | null;
            dispensedUnit?: string | null;
            dispensingNotes?: string | null;
        },
    ];
}>();

// The underlying <input type="number"> auto-casts to a number once the
// user types a value, even though it starts as the string prefill below —
// keep the ref's type wide enough to reflect that instead of assuming string.
const quantityDispensed = ref<string | number>('');
const dispensedUnit = ref('');
const dispensingNotes = ref('');

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        dispensingNotes.value = '';
        dispensedUnit.value = props.order?.dispensedUnit || props.order?.prescribedUnit || '';
        // Cumulative total dispensed so far, including this dispense — defaults to the
        // full prescribed quantity, matching UpdatePharmacyOrderStatusUseCase's own
        // behavior when quantityDispensed is omitted on a dispense transition.
        quantityDispensed.value = props.order?.quantityPrescribed !== null && props.order?.quantityPrescribed !== undefined
            ? String(props.order.quantityPrescribed)
            : '';
    },
);

// Reservation/FEFO-aware available stock for the medication about to be
// dispensed — shown regardless of intent (preparation or dispense), since
// knowing stock matters before either commitment. Re-resolved by
// medicationCode/medicationName every time the dialog opens, the same
// fuzzy match every dispense ultimately goes through server-side (there's
// no stable FK between a pharmacy order and a specific inventory item).
const medicationCode = computed(() => props.order?.medicationCode ?? null);
const medicationName = computed(() => props.order?.medicationName ?? null);
const availabilityEnabled = computed(() => props.open);
const availability = usePharmacyMedicationAvailability(medicationCode, medicationName, availabilityEnabled);

function toNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatQuantity(value: number | null): string {
    if (value === null) return '—';
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

const availableStock = computed(() => toNumber(availability.data.value?.currentStock));
const onHandStock = computed(() => toNumber(availability.data.value?.onHandStock));
const reservedOrBlocked = computed(() => {
    if (availableStock.value === null || onHandStock.value === null) return null;
    return Math.max(onHandStock.value - availableStock.value, 0);
});

// Matches the color-coded stock-state convention already established in
// inventory-procurement/stock-control/Index.vue, rather than inventing new
// colors for the same three states.
function stockStateBadgeClass(state: string | null | undefined): string {
    switch (state) {
        case 'out_of_stock':
            return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300';
        case 'low_stock':
            return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300';
        case 'healthy':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
        default:
            return 'border-border bg-muted/40 text-muted-foreground';
    }
}

function stockStateLabel(state: string | null | undefined): string {
    switch (state) {
        case 'out_of_stock':
            return 'Out of stock';
        case 'low_stock':
            return 'Low stock';
        case 'healthy':
            return 'Available';
        default:
            return 'Unknown';
    }
}

function meterColorClass(state: string | null | undefined): string {
    switch (state) {
        case 'out_of_stock':
            return 'bg-rose-500';
        case 'low_stock':
            return 'bg-amber-500';
        case 'healthy':
            return 'bg-emerald-500';
        default:
            return 'bg-muted-foreground/40';
    }
}

// No Progress/gauge primitive exists in this codebase — a plain scaled
// width is enough for this one usage site. Falls back to a sensible
// reference ceiling when the item has no configured max stock level, to
// avoid a divide-by-zero and give the bar a reasonable visual scale.
const meterPercent = computed(() => {
    if (availableStock.value === null) return 0;
    const maxStock = toNumber(availability.data.value?.maxStockLevel);
    const reorderLevel = toNumber(availability.data.value?.reorderLevel) ?? 0;
    const ceiling = maxStock && maxStock > 0 ? maxStock : Math.max(reorderLevel * 3, availableStock.value, 1);
    return Math.min(100, Math.round((availableStock.value / ceiling) * 100));
});

// Informational only — the server's own stock check at actual issue time
// remains the real, authoritative gate. This just avoids a pharmacist
// discovering the shortfall only after submitting.
const exceedsAvailableStock = computed(() => {
    if (props.intent !== 'dispense' || availableStock.value === null) return false;
    const requested = Number(String(quantityDispensed.value).trim());
    return Number.isFinite(requested) && requested > availableStock.value;
});

const config = computed(() => {
    if (props.intent === 'preparation') {
        return {
            title: 'Start preparation',
            description: 'Move this order into preparation.',
            buttonLabel: 'Start preparation',
        };
    }
    return {
        title: 'Dispense',
        description: 'Record the total quantity dispensed so far. Enter less than the prescribed quantity for a partial dispense.',
        buttonLabel: 'Confirm dispense',
    };
});

function submit(): void {
    if (props.intent === 'preparation') {
        emit('submit', { status: 'in_preparation' });
        return;
    }

    const trimmedQuantity = String(quantityDispensed.value).trim();
    const quantity = trimmedQuantity === '' ? null : Number(trimmedQuantity);
    const prescribed = props.order?.quantityPrescribed ?? null;
    const status: PharmacyOrderStatus =
        quantity !== null && prescribed !== null && quantity < prescribed ? 'partially_dispensed' : 'dispensed';

    emit('submit', {
        status,
        quantityDispensed: quantity,
        dispensedUnit: dispensedUnit.value.trim() || null,
        dispensingNotes: dispensingNotes.value.trim() || null,
    });
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent variant="action" size="lg">
            <DialogHeader>
                <DialogTitle>{{ config.title }}</DialogTitle>
                <DialogDescription>{{ config.description }}</DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <div class="rounded-lg border bg-muted/20 p-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order</p>
                    <p class="mt-2 text-sm font-medium text-foreground">
                        {{ order?.medicationName || order?.medicationCode || 'Pharmacy order' }}
                    </p>
                </div>

                <div class="rounded-lg border p-3">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dispense stock</p>
                        <Badge v-if="availability.data.value" variant="outline" :class="stockStateBadgeClass(availability.data.value.stockState)">
                            {{ stockStateLabel(availability.data.value.stockState) }}
                        </Badge>
                    </div>

                    <div v-if="availability.isPending.value" class="mt-2 space-y-2">
                        <Skeleton class="h-4 w-32" />
                        <Skeleton class="h-2 w-full" />
                    </div>

                    <Alert v-else-if="availability.isError.value" variant="destructive" class="mt-2">
                        <AlertDescription>Unable to load current stock{{ availability.error.value?.message ? `: ${availability.error.value.message}` : '.' }}</AlertDescription>
                    </Alert>

                    <p v-else-if="!availability.data.value" class="mt-2 text-xs text-muted-foreground">
                        No active stock match was found for this medication.
                    </p>

                    <template v-else>
                        <p class="mt-2 text-sm font-semibold text-foreground">
                            {{ formatQuantity(availableStock) }} {{ availability.data.value.unit || '' }} available to dispense
                        </p>
                        <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                class="h-full rounded-full transition-all"
                                :class="meterColorClass(availability.data.value.stockState)"
                                :style="{ width: meterPercent + '%' }"
                            />
                        </div>
                        <p v-if="reservedOrBlocked && reservedOrBlocked > 0" class="mt-1.5 text-xs text-muted-foreground">
                            {{ formatQuantity(onHandStock) }} on hand, {{ formatQuantity(reservedOrBlocked) }} reserved for other pending orders.
                        </p>
                    </template>
                </div>

                <template v-if="intent === 'dispense'">
                    <div class="grid grid-cols-2 gap-3">
                        <div class="grid gap-2">
                            <Label for="pharmacy-dispense-quantity">Quantity dispensed</Label>
                            <Input id="pharmacy-dispense-quantity" v-model="quantityDispensed" type="number" min="0" step="any" />
                        </div>
                        <div class="grid gap-2">
                            <Label for="pharmacy-dispense-unit">Unit</Label>
                            <Input id="pharmacy-dispense-unit" v-model="dispensedUnit" placeholder="e.g. tablets" />
                        </div>
                    </div>
                    <p v-if="order?.quantityPrescribed !== null" class="text-xs text-muted-foreground">
                        {{ order?.quantityPrescribed }} {{ order?.prescribedUnit }} prescribed in total.
                    </p>
                    <Alert v-if="exceedsAvailableStock" variant="destructive">
                        <AlertDescription>
                            This exceeds the currently available stock ({{ formatQuantity(availableStock) }} {{ availability.data.value?.unit }}). The server will reject the dispense if stock hasn't changed by submission.
                        </AlertDescription>
                    </Alert>
                    <div class="grid gap-2">
                        <Label for="pharmacy-dispense-notes">Dispensing notes (optional)</Label>
                        <Textarea id="pharmacy-dispense-notes" v-model="dispensingNotes" rows="3" />
                    </div>
                </template>

                <Alert v-if="error" variant="destructive">
                    <AlertDescription>{{ error }}</AlertDescription>
                </Alert>
            </div>

            <DialogFooter>
                <Button variant="outline" :disabled="loading" @click="emit('update:open', false)">Close</Button>
                <Button :disabled="loading" @click="submit">
                    {{ loading ? 'Saving...' : config.buttonLabel }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
