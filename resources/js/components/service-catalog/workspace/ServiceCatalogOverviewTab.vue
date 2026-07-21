<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    canManage: boolean;
}>();

const emit = defineEmits<{
    updated: [item: CatalogItem];
    openNewVersion: [];
}>();

const identityLocked = computed(() => Boolean(props.item.clinicalCatalogItemId));

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

watch(() => props.item, hydrate, { immediate: true });

const { optionsFor: departmentOptionsFor } = useServiceCatalogDepartmentOptions();
const departmentOptions = computed(() => departmentOptionsFor(form.serviceType));

const serviceTypeSelectValue = computed({
    get: () => form.serviceType || '__none__',
    set: (value: string) => { form.serviceType = value === '__none__' ? '' : value; },
});
const unitSelectValue = computed({
    get: () => form.unit || '__none__',
    set: (value: string) => {
        form.unit = value === '__none__' ? '' : value;
        if (!value || value === '__none__') form.unit = '';
    },
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
    if (!props.canManage || identityLocked.value || update.isPending.value) return;

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
    <div class="space-y-4">
        <Alert v-if="identityLocked">
            <AlertTitle>Synced from Clinical Catalog</AlertTitle>
            <AlertDescription>Identity fields are managed by the linked clinical definition and cannot be edited here. Update the source in Clinical Catalog instead.</AlertDescription>
        </Alert>

        <Alert v-if="!identityLocked && (item.linkWarning || (item.standardsWarnings?.length ?? 0) > 0)">
            <AlertTitle>Governance review</AlertTitle>
            <AlertDescription class="space-y-1">
                <p v-if="item.linkWarning">{{ item.linkWarning }}</p>
                <p v-for="warning in item.standardsWarnings ?? []" :key="warning">{{ warning }}</p>
            </AlertDescription>
        </Alert>

        <fieldset class="grid gap-3 rounded-lg border p-3">
            <legend class="px-2 text-sm font-medium text-muted-foreground">Service identity</legend>
            <div class="grid gap-3 md:grid-cols-3">
                <FormFieldShell input-id="overview-service-code" label="Service code" :error-message="fieldError('serviceCode')">
                    <Input id="overview-service-code" v-model="form.serviceCode" :disabled="!canManage || identityLocked" />
                </FormFieldShell>
                <FormFieldShell input-id="overview-service-name" label="Service name" container-class="md:col-span-2" :error-message="fieldError('serviceName')">
                    <Input id="overview-service-name" v-model="form.serviceName" :disabled="!canManage || identityLocked" />
                </FormFieldShell>
                <FormFieldShell input-id="overview-service-type" label="Service type">
                    <Select v-model="serviceTypeSelectValue" :disabled="!canManage || identityLocked">
                        <SelectTrigger id="overview-service-type" class="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Select type</SelectItem>
                            <SelectItem v-for="option in SERVICE_TYPE_OPTIONS" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                        </SelectContent>
                    </Select>
                </FormFieldShell>
                <ComboboxField
                    input-id="overview-department"
                    label="Department"
                    v-model="form.departmentId"
                    :options="departmentOptions"
                    placeholder="Select department"
                    search-placeholder="Search department code or name"
                    :error-message="fieldError('departmentId')"
                    empty-text="No departments matched this search."
                    :disabled="!canManage || identityLocked"
                />
                <FormFieldShell input-id="overview-unit" label="Billing unit">
                    <Select v-model="unitSelectValue" :disabled="!canManage || identityLocked">
                        <SelectTrigger id="overview-unit" class="w-full"><SelectValue placeholder="Select unit" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Select unit</SelectItem>
                            <SelectItem v-for="option in unitOptionsForServiceType" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                        </SelectContent>
                    </Select>
                </FormFieldShell>
            </div>

            <details class="rounded-lg border bg-muted/10 p-3">
                <summary class="cursor-pointer text-sm font-medium">Advanced / Standards</summary>
                <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <FormFieldShell input-id="overview-facility-tier" label="Minimum facility tier">
                        <Select v-model="facilityTierSelectValue" :disabled="!canManage || identityLocked">
                            <SelectTrigger id="overview-facility-tier" class="w-full"><SelectValue placeholder="All tiers" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">All tiers</SelectItem>
                                <SelectItem v-for="tier in FACILITY_TIER_OPTIONS" :key="tier.value" :value="tier.value">{{ tier.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <FormFieldShell input-id="overview-local-code" label="Local code"><Input id="overview-local-code" v-model="form.standardsLocal" :disabled="!canManage || identityLocked" /></FormFieldShell>
                    <FormFieldShell input-id="overview-nhif-code" label="NHIF code"><Input id="overview-nhif-code" v-model="form.standardsNhif" :disabled="!canManage || identityLocked" /></FormFieldShell>
                    <FormFieldShell input-id="overview-msd-code" label="MSD code"><Input id="overview-msd-code" v-model="form.standardsMsd" :disabled="!canManage || identityLocked" /></FormFieldShell>
                    <FormFieldShell input-id="overview-loinc-code" label="LOINC"><Input id="overview-loinc-code" v-model="form.standardsLoinc" :disabled="!canManage || identityLocked" /></FormFieldShell>
                    <FormFieldShell input-id="overview-snomed-code" label="SNOMED CT"><Input id="overview-snomed-code" v-model="form.standardsSnomedCt" :disabled="!canManage || identityLocked" /></FormFieldShell>
                    <FormFieldShell input-id="overview-cpt-code" label="CPT"><Input id="overview-cpt-code" v-model="form.standardsCpt" :disabled="!canManage || identityLocked" /></FormFieldShell>
                    <FormFieldShell input-id="overview-icd-code" label="ICD"><Input id="overview-icd-code" v-model="form.standardsIcd" :disabled="!canManage || identityLocked" /></FormFieldShell>
                </div>
            </details>

            <Alert v-if="submitError" variant="destructive"><AlertDescription>{{ submitError }}</AlertDescription></Alert>
        </fieldset>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Badge variant="outline">Clinical linkage: {{ identityLocked ? 'Linked' : 'Standalone' }}</Badge>
            <div class="flex items-center gap-2">
                <Button size="sm" variant="outline" @click="emit('openNewVersion')">Open new version</Button>
                <Button v-if="canManage" :disabled="update.isPending.value || identityLocked" @click="submit">
                    {{ update.isPending.value ? 'Saving...' : 'Save service details' }}
                </Button>
            </div>
        </div>
    </div>
</template>
