<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateServiceCatalogRevision } from '@/composables/serviceCatalogWorkspace/useCreateServiceCatalogRevision';
import {
    datePartFromDateTimeInput,
    formatDateTime,
    formatMoney,
    mergeDateAndTimeInput,
    metadataHasContent,
    metadataToFormText,
    parseDecimalOrNull,
    parseMetadata,
    tariffWindowLabel,
    timePartFromDateTimeInput,
    toApiDateTime,
    windowRangeValidationMessage,
    type CatalogItem,
} from '@/lib/billingServiceCatalog';
import { generateRequestKey } from '@/lib/idempotency';
import { messageFromUnknown } from '@/lib/notify';

const props = defineProps<{
    item: CatalogItem;
}>();

const emit = defineEmits<{
    created: [item: CatalogItem];
}>();

const form = reactive({
    basePrice: '',
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
    form.taxRatePercent = item.taxRatePercent ?? '';
    form.isTaxable = item.isTaxable === null ? '' : (item.isTaxable ? 'true' : 'false');
    form.effectiveFrom = '';
    form.effectiveTo = '';
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

const draftReady = computed(() => form.basePrice.trim() !== '' && form.effectiveFrom.trim() !== '');
const draftSummary = computed(() => {
    const basePrice = form.basePrice.trim();
    const effectiveFrom = toApiDateTime(form.effectiveFrom);
    const effectiveTo = toApiDateTime(form.effectiveTo);
    if (!basePrice && !effectiveFrom && !effectiveTo) return 'No new price version drafted';
    return `${formatMoney(basePrice || null, props.item.currencyCode)} | ${tariffWindowLabel(effectiveFrom, effectiveTo)}`;
});

const governanceMessage = computed(() => {
    if (windowValidationMessage.value) return windowValidationMessage.value;
    const startAt = toApiDateTime(form.effectiveFrom);
    if (!startAt) return 'Choose when the new price version starts. The current version will close automatically one second before that time.';
    return `The current price version will close automatically one second before ${formatDateTime(startAt)}. Use this only for a real pricing, tax, or lifecycle change.`;
});

const showTechnicalMetadata = computed(() => metadataHasContent(props.item.metadata) || form.metadataText.trim() !== '');

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const create = useCreateServiceCatalogRevision();

async function submit(): Promise<void> {
    if (create.isPending.value) return;

    submitError.value = null;
    fieldErrors.value = {};

    const basePrice = parseDecimalOrNull(form.basePrice);
    const taxRatePercent = parseDecimalOrNull(form.taxRatePercent);
    const metadata = parseMetadata(form.metadataText);

    const localErrors: Record<string, string[]> = {};
    if (basePrice === null || basePrice === 'invalid') localErrors.basePrice = ['Revision base price must be a valid non-negative number.'];
    if (!form.effectiveFrom.trim()) localErrors.effectiveFrom = ['Revision effective from is required.'];
    if (taxRatePercent === 'invalid') localErrors.taxRatePercent = ['Tax rate must be a valid non-negative number.'];
    if (metadata === 'invalid') localErrors.metadata = ['System integration notes must be a valid JSON object.'];
    if (windowValidationMessage.value) localErrors.effectiveTo = [windowValidationMessage.value];

    if (Object.keys(localErrors).length > 0) {
        fieldErrors.value = localErrors;
        return;
    }

    try {
        const item = await create.mutateAsync({
            itemId: String(props.item.id),
            basePrice: basePrice as number,
            taxRatePercent: taxRatePercent as number | null,
            isTaxable: form.isTaxable === 'true' ? true : form.isTaxable === 'false' ? false : null,
            effectiveFrom: toApiDateTime(form.effectiveFrom),
            effectiveTo: toApiDateTime(form.effectiveTo),
            description: form.description.trim() || null,
            metadata: metadata === 'invalid' ? null : metadata,
            idempotencyKey: generateRequestKey('billing-service-catalog-revision'),
        });
        emit('created', item);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: { errors?: Record<string, string[]> } };
        if (apiError.status === 422 && apiError.payload?.errors) {
            fieldErrors.value = apiError.payload.errors;
        } else {
            submitError.value = messageFromUnknown(error, 'Unable to create the new price version.');
        }
    }
}
</script>

<template>
    <div class="space-y-4">
        <fieldset class="grid gap-3 rounded-lg border p-3">
            <legend class="flex items-center gap-2 px-2 text-sm font-medium text-muted-foreground">
                New price version
                <Badge :variant="draftReady ? 'secondary' : 'outline'">{{ draftReady ? 'Ready to create' : 'Setup in progress' }}</Badge>
            </legend>
            <p class="text-xs text-muted-foreground">
                Create the next price window without overwriting the current live version.
                Current: {{ formatMoney(item.basePrice, item.currencyCode) }} · Draft: {{ draftSummary }}
            </p>

            <div class="grid gap-3 md:grid-cols-2">
                <FormFieldShell input-id="revision-base-price" label="New base price" :error-message="fieldError('basePrice')">
                    <Input id="revision-base-price" v-model="form.basePrice" inputmode="decimal" />
                </FormFieldShell>
                <div class="grid gap-3 sm:grid-cols-2">
                    <SingleDatePopoverField input-id="revision-effective-from-date" label="New price starts" v-model="effectiveFromDate" :error-message="fieldError('effectiveFrom')" />
                    <TimePopoverField input-id="revision-effective-from-time" label="Start time" v-model="effectiveFromTime" />
                </div>
                <FormFieldShell input-id="revision-tax-rate" label="Tax rate %" :error-message="fieldError('taxRatePercent')">
                    <Input id="revision-tax-rate" v-model="form.taxRatePercent" inputmode="decimal" />
                </FormFieldShell>
                <div class="grid gap-3 sm:grid-cols-2">
                    <SingleDatePopoverField input-id="revision-effective-to-date" label="New price ends" v-model="effectiveToDate" :error-message="fieldError('effectiveTo')" />
                    <TimePopoverField input-id="revision-effective-to-time" label="End time" v-model="effectiveToTime" />
                </div>
                <FormFieldShell input-id="revision-taxable" label="Taxable">
                    <Select v-model="taxableSelectValue">
                        <SelectTrigger id="revision-taxable" class="w-full"><SelectValue placeholder="N/A" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">N/A</SelectItem>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                    </Select>
                </FormFieldShell>
                <p class="rounded-lg border bg-muted/10 px-3 py-2 text-xs text-muted-foreground md:col-span-2">{{ governanceMessage }}</p>
                <FormFieldShell input-id="revision-description" label="Change notes" container-class="md:col-span-2">
                    <Textarea id="revision-description" v-model="form.description" class="min-h-16" />
                </FormFieldShell>
            </div>

            <details v-if="showTechnicalMetadata" class="rounded-lg border border-dashed bg-muted/10 p-3">
                <summary class="cursor-pointer text-sm font-medium">System integration notes (technical)</summary>
                <FormFieldShell input-id="revision-metadata" label="Integration payload" container-class="mt-3" :error-message="fieldError('metadata')">
                    <Textarea id="revision-metadata" v-model="form.metadataText" class="min-h-20 font-mono text-xs" />
                </FormFieldShell>
            </details>

            <Alert v-if="submitError" variant="destructive"><AlertDescription>{{ submitError }}</AlertDescription></Alert>
        </fieldset>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p class="text-xs text-muted-foreground">Keeps the current price auditable while preparing the next billing window.</p>
            <Button class="gap-1.5" :disabled="create.isPending.value || Boolean(windowValidationMessage)" @click="submit">
                <AppIcon :name="create.isPending.value ? 'loader-circle' : 'plus'" :class="create.isPending.value ? 'size-3.5 animate-spin' : 'size-3.5'" />
                {{ create.isPending.value ? 'Creating version...' : 'Create new version' }}
            </Button>
        </div>
    </div>
</template>
