<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateServiceCatalogPricing } from '@/composables/serviceCatalogWorkspace/useUpdateServiceCatalogPricing';
import {
    datePartFromDateTimeInput,
    formatMoney,
    mergeDateAndTimeInput,
    metadataHasContent,
    metadataToFormText,
    parseDecimalOrNull,
    parseMetadata,
    timePartFromDateTimeInput,
    toApiDateTime,
    toDateTimeInput,
    windowRangeValidationMessage,
    type CatalogItem,
} from '@/lib/billingServiceCatalog';
import { generateRequestKey } from '@/lib/idempotency';
import { messageFromUnknown } from '@/lib/notify';

const props = defineProps<{
    item: CatalogItem;
    canManage: boolean;
}>();

const emit = defineEmits<{
    updated: [item: CatalogItem];
    openStatus: [];
}>();

const form = reactive({
    basePrice: '',
    currencyCode: '',
    taxRatePercent: '',
    isTaxable: '',
    effectiveFrom: '',
    effectiveTo: '',
    description: '',
    metadataText: '',
});

const fieldErrors = ref<Record<string, string[]>>({});
const submitError = ref<string | null>(null);

function hydrate(item: CatalogItem): void {
    form.basePrice = item.basePrice ?? '';
    form.currencyCode = item.currencyCode ?? '';
    form.taxRatePercent = item.taxRatePercent ?? '';
    form.isTaxable = item.isTaxable === null ? '' : (item.isTaxable ? 'true' : 'false');
    form.effectiveFrom = toDateTimeInput(item.effectiveFrom);
    form.effectiveTo = toDateTimeInput(item.effectiveTo);
    form.description = item.description ?? '';
    form.metadataText = metadataToFormText(item.metadata);
    fieldErrors.value = {};
    submitError.value = null;
}

watch(() => props.item, hydrate, { immediate: true });

const taxableSelectValue = computed({
    get: () => form.isTaxable || '__none__',
    set: (value: string) => { form.isTaxable = value === '__none__' ? '' : value; },
});

const effectiveFromDate = computed({
    get: () => datePartFromDateTimeInput(form.effectiveFrom),
    set: (value: string) => { form.effectiveFrom = mergeDateAndTimeInput(value, timePartFromDateTimeInput(form.effectiveFrom), '00:00'); },
});
const effectiveFromTime = computed({
    get: () => timePartFromDateTimeInput(form.effectiveFrom),
    set: (value: string) => { form.effectiveFrom = mergeDateAndTimeInput(datePartFromDateTimeInput(form.effectiveFrom), value, '00:00'); },
});
const effectiveToDate = computed({
    get: () => datePartFromDateTimeInput(form.effectiveTo),
    set: (value: string) => { form.effectiveTo = mergeDateAndTimeInput(value, timePartFromDateTimeInput(form.effectiveTo), '23:59'); },
});
const effectiveToTime = computed({
    get: () => timePartFromDateTimeInput(form.effectiveTo),
    set: (value: string) => { form.effectiveTo = mergeDateAndTimeInput(datePartFromDateTimeInput(form.effectiveTo), value, '23:59'); },
});

const windowValidationMessage = computed(() => windowRangeValidationMessage(form.effectiveFrom, form.effectiveTo));
const showTechnicalMetadata = computed(() => metadataHasContent(props.item.metadata) || form.metadataText.trim() !== '');

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const update = useUpdateServiceCatalogPricing();

async function submit(): Promise<void> {
    if (!props.canManage || update.isPending.value) return;

    submitError.value = null;
    fieldErrors.value = {};

    const basePrice = parseDecimalOrNull(form.basePrice);
    const taxRatePercent = parseDecimalOrNull(form.taxRatePercent);
    const metadata = parseMetadata(form.metadataText);

    const localErrors: Record<string, string[]> = {};
    if (basePrice === null || basePrice === 'invalid') localErrors.basePrice = ['Base price must be a valid non-negative number.'];
    if (!form.currencyCode.trim()) localErrors.currencyCode = ['Currency code is required.'];
    if (taxRatePercent === 'invalid') localErrors.taxRatePercent = ['Tax rate must be a valid non-negative number.'];
    if (metadata === 'invalid') localErrors.metadata = ['System integration notes must be a valid JSON object.'];
    if (windowValidationMessage.value) localErrors.effectiveTo = [windowValidationMessage.value];

    if (Object.keys(localErrors).length > 0) {
        fieldErrors.value = localErrors;
        return;
    }

    try {
        const item = await update.mutateAsync({
            itemId: String(props.item.id),
            basePrice: basePrice as number,
            currencyCode: form.currencyCode.trim().toUpperCase(),
            taxRatePercent: taxRatePercent as number | null,
            isTaxable: form.isTaxable === 'true' ? true : form.isTaxable === 'false' ? false : null,
            effectiveFrom: toApiDateTime(form.effectiveFrom),
            effectiveTo: toApiDateTime(form.effectiveTo),
            description: form.description.trim() || null,
            metadata: metadata === 'invalid' ? null : metadata,
            idempotencyKey: generateRequestKey('billing-service-catalog-pricing'),
        });
        emit('updated', item);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: { errors?: Record<string, string[]> } };
        if (apiError.status === 422 && apiError.payload?.errors) {
            fieldErrors.value = apiError.payload.errors;
        } else {
            submitError.value = messageFromUnknown(error, 'Unable to update service pricing.');
        }
    }
}
</script>

<template>
    <div class="space-y-4">
        <fieldset class="grid gap-3 rounded-lg border p-3">
            <legend class="px-2 text-sm font-medium text-muted-foreground">Current price setup</legend>
            <p class="text-xs text-muted-foreground">
                {{ formatMoney(item.basePrice, item.currencyCode) }} — for the live base price only. Use payer contracts for
                insurer-specific rates; use New Version for lifecycle changes.
            </p>

            <div class="grid gap-3 md:grid-cols-4">
                <FormFieldShell input-id="pricing-base-price" label="Base price" :error-message="fieldError('basePrice')">
                    <Input id="pricing-base-price" v-model="form.basePrice" inputmode="decimal" :disabled="!canManage" />
                </FormFieldShell>
                <FormFieldShell input-id="pricing-currency" label="Currency" :error-message="fieldError('currencyCode')">
                    <Input id="pricing-currency" v-model="form.currencyCode" maxlength="3" :disabled="!canManage" />
                </FormFieldShell>
                <FormFieldShell input-id="pricing-tax-rate" label="Tax rate %" :error-message="fieldError('taxRatePercent')">
                    <Input id="pricing-tax-rate" v-model="form.taxRatePercent" inputmode="decimal" :disabled="!canManage" />
                </FormFieldShell>
                <FormFieldShell input-id="pricing-taxable" label="Taxable">
                    <Select v-model="taxableSelectValue" :disabled="!canManage">
                        <SelectTrigger id="pricing-taxable" class="w-full"><SelectValue placeholder="N/A" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">N/A</SelectItem>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                    </Select>
                </FormFieldShell>
                <SingleDatePopoverField input-id="pricing-effective-from-date" label="Effective from" v-model="effectiveFromDate" :disabled="!canManage" />
                <TimePopoverField input-id="pricing-effective-from-time" label="Start time" v-model="effectiveFromTime" :disabled="!canManage" />
                <SingleDatePopoverField input-id="pricing-effective-to-date" label="Effective to" v-model="effectiveToDate" :disabled="!canManage" />
                <TimePopoverField input-id="pricing-effective-to-time" label="End time" v-model="effectiveToTime" :disabled="!canManage" />
                <FormFieldShell input-id="pricing-description" label="Description" container-class="md:col-span-4">
                    <Textarea id="pricing-description" v-model="form.description" class="min-h-20" :disabled="!canManage" />
                </FormFieldShell>
            </div>

            <p v-if="windowValidationMessage" class="text-xs text-destructive">{{ windowValidationMessage }}</p>

            <details v-if="showTechnicalMetadata" class="rounded-lg border border-dashed bg-muted/10 p-3">
                <summary class="cursor-pointer text-sm font-medium">System integration notes (technical)</summary>
                <FormFieldShell input-id="pricing-metadata" label="Integration payload" container-class="mt-3" :error-message="fieldError('metadata')">
                    <Textarea id="pricing-metadata" v-model="form.metadataText" class="min-h-24 font-mono text-xs" :disabled="!canManage" />
                </FormFieldShell>
            </details>

            <Alert v-if="submitError" variant="destructive"><AlertDescription>{{ submitError }}</AlertDescription></Alert>
        </fieldset>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button size="sm" variant="outline" @click="emit('openStatus')">Open status</Button>
            <Button v-if="canManage" :disabled="update.isPending.value || Boolean(windowValidationMessage)" @click="submit">
                {{ update.isPending.value ? 'Saving...' : 'Save current price' }}
            </Button>
        </div>
    </div>
</template>
