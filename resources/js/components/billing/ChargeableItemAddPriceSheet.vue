<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ChargeableItem } from '@/composables/chargeableItems/useChargeableItems';
import { useCreatePriceBookEntry } from '@/composables/chargeableItems/useCreatePriceBookEntry';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import { messageFromUnknown } from '@/lib/notify';

/**
 * Adds a new price_book_entries row to an existing chargeable item --
 * ChargeableItemController::storePrice(), the "new price version" action
 * ServicePriceWorkspaceV2.vue's full version-history UI covers for the old
 * catalog. No versioning workspace exists yet for the new engine (Phase 4
 * scope), so this is deliberately just "add one more active price row."
 */
const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
    item: ChargeableItem | null;
}>();

const emit = defineEmits<{
    added: [item: ChargeableItem];
}>();

const { activeCurrencyCode } = usePlatformCountryProfile();
const defaultCurrencyCode = computed(() => activeCurrencyCode.value || 'TZS');

const createPrice = useCreatePriceBookEntry();
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const form = reactive({
    currencyCode: defaultCurrencyCode.value,
    unitPrice: '',
    taxRatePercent: '',
    isTaxable: 'false',
    effectiveFrom: '',
});

watch(open, (isOpen) => {
    if (!isOpen) return;
    form.currencyCode = defaultCurrencyCode.value;
    form.unitPrice = '';
    form.taxRatePercent = '';
    form.isTaxable = 'false';
    form.effectiveFrom = '';
    submitError.value = null;
    fieldErrors.value = {};
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const canSubmit = computed(() => {
    if (createPrice.isPending.value) return false;
    if (!props.item) return false;
    return String(form.unitPrice).trim() !== '' && form.currencyCode.trim() !== '';
});

async function submit(): Promise<void> {
    if (!props.item) return;

    submitError.value = null;
    fieldErrors.value = {};

    try {
        const updated = await createPrice.mutateAsync({
            chargeableItemId: props.item.id,
            currencyCode: form.currencyCode.trim().toUpperCase(),
            unitPrice: Number.parseFloat(String(form.unitPrice)),
            taxRatePercent: String(form.taxRatePercent).trim() ? Number.parseFloat(String(form.taxRatePercent)) : null,
            isTaxable: form.isTaxable === 'true',
            effectiveFrom: form.effectiveFrom.trim() || null,
        });
        emit('added', updated);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to add a price for this chargeable item.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="lg">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="banknote" class="size-5 text-muted-foreground" />
                    Add price
                </SheetTitle>
                <SheetDescription>
                    <span v-if="item">{{ item.code }} — {{ item.name }}</span>
                </SheetDescription>
            </SheetHeader>

            <div class="grid gap-4 px-6 py-4">
                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to add this price</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>

                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-1.5">
                        <Label for="chargeable-item-price-currency">Currency</Label>
                        <Input id="chargeable-item-price-currency" v-model="form.currencyCode" maxlength="3" class="uppercase" />
                        <p v-if="fieldError('currencyCode')" class="text-xs text-destructive">{{ fieldError('currencyCode') }}</p>
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="chargeable-item-price-unit-price">Unit price</Label>
                        <Input id="chargeable-item-price-unit-price" v-model="form.unitPrice" type="number" min="0" step="0.01" />
                        <p v-if="fieldError('unitPrice')" class="text-xs text-destructive">{{ fieldError('unitPrice') }}</p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-1.5">
                        <Label for="chargeable-item-price-tax-rate">Tax rate %</Label>
                        <Input id="chargeable-item-price-tax-rate" v-model="form.taxRatePercent" type="number" min="0" max="100" step="0.01" />
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="chargeable-item-price-taxable">Taxable</Label>
                        <Select v-model="form.isTaxable">
                            <SelectTrigger id="chargeable-item-price-taxable" class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="false">No</SelectItem>
                                <SelectItem value="true">Yes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div class="grid gap-1.5">
                    <Label for="chargeable-item-price-effective-from">Effective from</Label>
                    <Input id="chargeable-item-price-effective-from" v-model="form.effectiveFrom" type="date" />
                </div>
            </div>

            <SheetFooter class="shrink-0 flex-row items-center justify-end gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    <Badge v-if="createPrice.isPending.value" variant="secondary" class="mr-1">Saving…</Badge>
                    {{ createPrice.isPending.value ? 'Saving…' : 'Add price' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
