<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useServiceCatalogDepartmentOptions } from '@/composables/serviceCatalogIndex/useServiceCatalogDepartmentOptions';
import { useUpdateServiceCatalogIdentity } from '@/composables/serviceCatalogWorkspace/useUpdateServiceCatalogIdentity';
import {
    FACILITY_TIER_OPTIONS,
    SERVICE_TYPE_OPTIONS,
    UNIT_OPTIONS,
    PHARMACY_UNIT_OPTIONS,
    type CatalogItem,
    type StandardsCodes,
} from '@/lib/billingServiceCatalog';
import { generateRequestKey } from '@/lib/idempotency';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown } from '@/lib/notify';

const props = defineProps<{
    item: CatalogItem;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    updated: [item: CatalogItem];
}>();

const form = reactive({
    serviceCode: '',
    serviceName: '',
    serviceType: '',
    departmentId: '',
    unit: '',
    facilityTier: '',
    standardsLocal: '',
    standardsNhif: '',
    standardsMsd: '',
    standardsLoinc: '',
    standardsSnomedCt: '',
    standardsCpt: '',
    standardsIcd: '',
});

const fieldErrors = ref<Record<string, string[]>>({});
const submitError = ref<string | null>(null);

function applyStandardsCodesToForm(codes: StandardsCodes | null | undefined): void {
    form.standardsLocal = String(codes?.LOCAL ?? '');
    form.standardsNhif = String(codes?.NHIF ?? '');
    form.standardsMsd = String(codes?.MSD ?? '');
    form.standardsLoinc = String(codes?.LOINC ?? '');
    form.standardsSnomedCt = String(codes?.SNOMED_CT ?? '');
    form.standardsCpt = String(codes?.CPT ?? '');
    form.standardsIcd = String(codes?.ICD ?? '');
}

function standardsCodesFromForm(): StandardsCodes | null {
    const codes: StandardsCodes = {
        LOCAL: form.standardsLocal.trim(),
        NHIF: form.standardsNhif.trim(),
        MSD: form.standardsMsd.trim(),
        LOINC: form.standardsLoinc.trim(),
        SNOMED_CT: form.standardsSnomedCt.trim(),
        CPT: form.standardsCpt.trim(),
        ICD: form.standardsIcd.trim(),
    };
    const compact = Object.fromEntries(Object.entries(codes).filter(([, value]) => String(value ?? '').trim() !== '')) as StandardsCodes;
    return Object.keys(compact).length > 0 ? compact : null;
}

function hydrate(item: CatalogItem): void {
    form.serviceCode = item.serviceCode ?? '';
    form.serviceName = item.serviceName ?? '';
    form.serviceType = item.serviceType ?? '';
    form.departmentId = item.departmentId ?? '';
    form.unit = item.unit ?? '';
    form.facilityTier = item.facilityTier ?? '';
    applyStandardsCodesToForm(item.codes);
    fieldErrors.value = {};
    submitError.value = null;
}

watch([open, () => props.item], ([isOpen, item]) => {
    if (isOpen) hydrate(item);
});

const { optionsFor: departmentOptionsFor } = useServiceCatalogDepartmentOptions();
const departmentOptions = computed(() => departmentOptionsFor(form.serviceType));

const serviceTypeSelectValue = computed({
    get: () => form.serviceType || '__none__',
    set: (value: string) => { form.serviceType = value === '__none__' ? '' : value; },
});
const unitSelectValue = computed({
    get: () => form.unit || '__none__',
    set: (value: string) => { form.unit = value === '__none__' ? '' : value; },
});
const facilityTierSelectValue = computed({
    get: () => form.facilityTier || '__none__',
    set: (value: string) => { form.facilityTier = value === '__none__' ? '' : value; },
});

const unitOptionsForServiceType = computed(() => (form.serviceType === 'pharmacy' ? PHARMACY_UNIT_OPTIONS : UNIT_OPTIONS));

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const update = useUpdateServiceCatalogIdentity();

async function submit(): Promise<void> {
    if (update.isPending.value) return;

    submitError.value = null;
    fieldErrors.value = {};

    const localErrors: Record<string, string[]> = {};
    if (!form.serviceCode.trim()) localErrors.serviceCode = ['Service code is required.'];
    if (!form.serviceName.trim()) localErrors.serviceName = ['Service name is required.'];
    if (Object.keys(localErrors).length > 0) {
        fieldErrors.value = localErrors;
        return;
    }

    try {
        const item = await update.mutateAsync({
            itemId: String(props.item.id),
            serviceCode: form.serviceCode.trim(),
            serviceName: form.serviceName.trim(),
            serviceType: form.serviceType.trim() || null,
            departmentId: form.departmentId.trim() || null,
            unit: form.unit.trim() || null,
            facilityTier: form.facilityTier.trim() || null,
            codes: standardsCodesFromForm(),
            idempotencyKey: generateRequestKey('billing-service-catalog-identity'),
        });
        emit('updated', item);
        open.value = false;
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: { errors?: Record<string, string[]> } };
        if (apiError.status === 422 && apiError.payload?.errors) {
            fieldErrors.value = apiError.payload.errors;
        } else {
            submitError.value = messageFromUnknown(error, 'Unable to update service details.');
        }
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>Edit service details</SheetTitle>
                <SheetDescription>{{ item.serviceName || item.serviceCode || 'Standalone billing service' }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <Alert v-if="submitError" variant="destructive"><AlertDescription>{{ submitError }}</AlertDescription></Alert>

                <div class="grid gap-3 md:grid-cols-2">
                    <FormFieldShell input-id="edit-identity-service-code" label="Service code" :error-message="fieldError('serviceCode')">
                        <Input id="edit-identity-service-code" v-model="form.serviceCode" />
                    </FormFieldShell>
                    <FormFieldShell input-id="edit-identity-service-name" label="Service name" :error-message="fieldError('serviceName')">
                        <Input id="edit-identity-service-name" v-model="form.serviceName" />
                    </FormFieldShell>
                    <FormFieldShell input-id="edit-identity-service-type" label="Service type">
                        <Select v-model="serviceTypeSelectValue">
                            <SelectTrigger id="edit-identity-service-type" class="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Select type</SelectItem>
                                <SelectItem v-for="option in SERVICE_TYPE_OPTIONS" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <ComboboxField
                        input-id="edit-identity-department"
                        label="Department"
                        v-model="form.departmentId"
                        :options="departmentOptions"
                        placeholder="Select department"
                        search-placeholder="Search department code or name"
                        :error-message="fieldError('departmentId')"
                        empty-text="No departments matched this search."
                    />
                    <FormFieldShell input-id="edit-identity-unit" label="Billing unit">
                        <Select v-model="unitSelectValue">
                            <SelectTrigger id="edit-identity-unit" class="w-full"><SelectValue placeholder="Select unit" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">Select unit</SelectItem>
                                <SelectItem v-for="option in unitOptionsForServiceType" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                </div>

                <details class="rounded-lg border bg-muted/10 p-3">
                    <summary class="cursor-pointer text-sm font-medium">Advanced / Standards</summary>
                    <div class="mt-3 grid gap-3 md:grid-cols-2">
                        <FormFieldShell input-id="edit-identity-facility-tier" label="Minimum facility tier">
                            <Select v-model="facilityTierSelectValue">
                                <SelectTrigger id="edit-identity-facility-tier" class="w-full"><SelectValue placeholder="All tiers" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">All tiers</SelectItem>
                                    <SelectItem v-for="tier in FACILITY_TIER_OPTIONS" :key="tier.value" :value="tier.value">{{ tier.label }}</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormFieldShell>
                        <FormFieldShell input-id="edit-identity-local-code" label="Local code"><Input id="edit-identity-local-code" v-model="form.standardsLocal" /></FormFieldShell>
                        <FormFieldShell input-id="edit-identity-nhif-code" label="NHIF code"><Input id="edit-identity-nhif-code" v-model="form.standardsNhif" /></FormFieldShell>
                        <FormFieldShell input-id="edit-identity-msd-code" label="MSD code"><Input id="edit-identity-msd-code" v-model="form.standardsMsd" /></FormFieldShell>
                        <FormFieldShell input-id="edit-identity-loinc-code" label="LOINC"><Input id="edit-identity-loinc-code" v-model="form.standardsLoinc" /></FormFieldShell>
                        <FormFieldShell input-id="edit-identity-snomed-code" label="SNOMED CT"><Input id="edit-identity-snomed-code" v-model="form.standardsSnomedCt" /></FormFieldShell>
                        <FormFieldShell input-id="edit-identity-cpt-code" label="CPT"><Input id="edit-identity-cpt-code" v-model="form.standardsCpt" /></FormFieldShell>
                        <FormFieldShell input-id="edit-identity-icd-code" label="ICD"><Input id="edit-identity-icd-code" v-model="form.standardsIcd" /></FormFieldShell>
                    </div>
                </details>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" :disabled="update.isPending.value" @click="open = false">Cancel</Button>
                <Button class="gap-1.5" :disabled="update.isPending.value" @click="submit">
                    <AppIcon :name="update.isPending.value ? 'loader-circle' : 'check'" :class="update.isPending.value ? 'size-3.5 animate-spin' : 'size-3.5'" />
                    {{ update.isPending.value ? 'Saving...' : 'Save changes' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
