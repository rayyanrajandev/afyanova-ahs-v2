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
import type { ChargeableItem, ChargeableItemPrice } from '@/composables/chargeableItems/useChargeableItems';
import { useUpdatePriceBookEntry } from '@/composables/chargeableItems/useUpdatePriceBookEntry';
import { messageFromUnknown } from '@/lib/notify';

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
    item: ChargeableItem | null;
    price: ChargeableItemPrice | null;
}>();

const emit = defineEmits<{
    updated: [item: ChargeableItem];
}>();

const updatePrice = useUpdatePriceBookEntry();
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const form = reactive({
    currencyCode: '',
    unitPrice: '',
    taxRatePercent: '',
    isTaxable: 'false',
    status: 'active',
    effectiveFrom: '',
    effectiveTo: '',
});

function populateForm(p: ChargeableItemPrice): void {
    form.currencyCode = p.currencyCode;
    form.unitPrice = String(p.unitPrice);
    form.taxRatePercent = p.taxRatePercent !== null ? String(p.taxRatePercent) : '';
    form.isTaxable = p.isTaxable ? 'true' : 'false';
    form.status = p.status;
    form.effectiveFrom = p.effectiveFrom ?? '';
    form.effectiveTo = p.effectiveTo ?? '';
    submitError.value = null;
    fieldErrors.value = {};
}

watch(() => props.price, (price) => {
    if (price) populateForm(price);
}, { immediate: true });

watch(open, (isOpen) => {
    if (isOpen && props.price) populateForm(props.price);
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const canSubmit = computed(() => {
    if (updatePrice.isPending.value) return false;
    if (!props.item || !props.price) return false;
    return String(form.unitPrice).trim() !== '' && form.currencyCode.trim() !== '';
});

async function submit(): Promise<void> {
    if (!props.item || !props.price) return;

    submitError.value = null;
    fieldErrors.value = {};

    try {
        const updated = await updatePrice.mutateAsync({
            chargeableItemId: props.item.id,
            priceId: props.price.id,
            currencyCode: form.currencyCode.trim().toUpperCase(),
            unitPrice: Number.parseFloat(String(form.unitPrice)),
            taxRatePercent: String(form.taxRatePercent).trim() ? Number.parseFloat(String(form.taxRatePercent)) : null,
            isTaxable: form.isTaxable === 'true',
            status: form.status,
            effectiveFrom: form.effectiveFrom.trim() || null,
            effectiveTo: form.effectiveTo.trim() || null,
        });
        emit('updated', updated);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update this price.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="lg">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="pencil" class="size-5 text-muted-foreground" />
                    Edit price
                </SheetTitle>
                <SheetDescription>
                    <span v-if="item">{{ item.code }} — {{ item.name }}</span>
                </SheetDescription>
            </SheetHeader>

            <div class="grid gap-4 px-6 py-4">
                <Alert v-if="submitError" variant="destructive">
                    <AlertTitle>Unable to update this price</AlertTitle>
                    <AlertDescription>{{ submitError }}</AlertDescription>
                </Alert>

                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-1.5">
                        <Label for="edit-price-currency">Currency</Label>
                        <Input id="edit-price-currency" v-model="form.currencyCode" maxlength="3" class="uppercase" />
                        <p v-if="fieldError('currencyCode')" class="text-xs text-destructive">{{ fieldError('currencyCode') }}</p>
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="edit-price-unit-price">Unit price</Label>
                        <Input id="edit-price-unit-price" v-model="form.unitPrice" type="number" min="0" step="0.01" />
                        <p v-if="fieldError('unitPrice')" class="text-xs text-destructive">{{ fieldError('unitPrice') }}</p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-1.5">
                        <Label for="edit-price-tax-rate">Tax rate %</Label>
                        <Input id="edit-price-tax-rate" v-model="form.taxRatePercent" type="number" min="0" max="100" step="0.01" />
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="edit-price-taxable">Taxable</Label>
                        <Select v-model="form.isTaxable">
                            <SelectTrigger id="edit-price-taxable" class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="false">No</SelectItem>
                                <SelectItem value="true">Yes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-1.5">
                        <Label for="edit-price-effective-from">Effective from</Label>
                        <Input id="edit-price-effective-from" v-model="form.effectiveFrom" type="date" />
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="edit-price-effective-to">Effective to</Label>
                        <Input id="edit-price-effective-to" v-model="form.effectiveTo" type="date" />
                    </div>
                </div>
                <div class="grid gap-1.5">
                    <Label for="edit-price-status">Status</Label>
                    <Select v-model="form.status">
                        <SelectTrigger id="edit-price-status" class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <SheetFooter class="shrink-0 flex-row items-center justify-end gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    <Badge v-if="updatePrice.isPending.value" variant="secondary" class="mr-1">Saving…</Badge>
                    {{ updatePrice.isPending.value ? 'Saving…' : 'Save changes' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
