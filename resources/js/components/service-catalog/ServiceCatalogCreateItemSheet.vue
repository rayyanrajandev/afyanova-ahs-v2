<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import CatalogLinkBadge from '@/components/shared/CatalogLinkBadge.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCreateServiceCatalogItem } from '@/composables/serviceCatalogIndex/useCreateServiceCatalogItem';
import { useServiceCatalogClinicalCatalogOptions } from '@/composables/serviceCatalogIndex/useServiceCatalogClinicalCatalogOptions';
import { useServiceCatalogDepartmentOptions } from '@/composables/serviceCatalogIndex/useServiceCatalogDepartmentOptions';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import { apiGet } from '@/lib/apiClient';
import {
    CLINICAL_CATALOG_SOURCES,
    FACILITY_TIER_OPTIONS,
    UNIT_OPTIONS,
    PHARMACY_UNIT_OPTIONS,
    type CatalogItem,
    type CatalogListResponse,
    type ClinicalCatalogLookupItem,
    type ClinicalCatalogType,
    type CreateIdentitySource,
    type StandardsCodes,
    billingServiceTypeFromClinicalCatalogType,
    clinicalCatalogGroupLabel,
    datePartFromDateTimeInput,
    mergeDateAndTimeInput,
    normalizeServiceCode,
    parseDecimalOrNull,
    parseMetadata,
    timePartFromDateTimeInput,
    toApiDateTime,
    windowRangeValidationMessage,
} from '@/lib/billingServiceCatalog';
import { SERVICE_TYPE_OPTIONS } from '@/lib/billingServiceCatalog';
import { generateRequestKey } from '@/lib/idempotency';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [item: CatalogItem];
}>();

const { activeCurrencyCode } = usePlatformCountryProfile();
const defaultCurrencyCode = computed(() => activeCurrencyCode.value || 'TZS');

const clinicalCatalogOptionsQuery = useServiceCatalogClinicalCatalogOptions();
const { optionsFor: departmentOptionsFor, query: departmentQuery } = useServiceCatalogDepartmentOptions();
const create = useCreateServiceCatalogItem();

const clinicalCatalogTypeFilter = ref<ClinicalCatalogType | 'all'>('all');
const requestKey = ref(generateRequestKey('billing-service-catalog-create'));
const fieldErrors = ref<Record<string, string[]>>({});
const submitError = ref<string | null>(null);

const form = reactive({
    identitySource: 'clinical' as CreateIdentitySource,
    clinicalCatalogItemId: '',
    serviceCode: '',
    serviceName: '',
    serviceType: '',
    departmentId: '',
    unit: '',
    basePrice: '',
    currencyCode: defaultCurrencyCode.value,
    taxRatePercent: '',
    isTaxable: 'false',
    effectiveFrom: '',
    effectiveTo: '',
    description: '',
    facilityTier: '',
    standardsLocal: '',
    standardsNhif: '',
    standardsMsd: '',
    standardsLoinc: '',
    standardsSnomedCt: '',
    standardsCpt: '',
    standardsIcd: '',
    metadataText: '',
    priceUnit: '',
    unitsPerPack: '',
});

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

function resetForm(): void {
    form.identitySource = 'clinical';
    form.clinicalCatalogItemId = '';
    clinicalCatalogTypeFilter.value = 'all';
    form.serviceCode = '';
    form.serviceName = '';
    form.serviceType = '';
    form.departmentId = '';
    form.unit = '';
    form.priceUnit = '';
    form.unitsPerPack = '';
    form.basePrice = '';
    form.currencyCode = defaultCurrencyCode.value;
    form.taxRatePercent = '';
    form.isTaxable = 'false';
    form.effectiveFrom = '';
    form.effectiveTo = '';
    form.description = '';
    form.facilityTier = '';
    applyStandardsCodesToForm(null);
    form.metadataText = '';
    familyPreviewItems.value = [];
    familyPreviewError.value = null;
    fieldErrors.value = {};
    submitError.value = null;
}

// --- Clinical catalog linking ---

function resolvedClinicalCatalogServiceCode(item: ClinicalCatalogLookupItem | null): string {
    if (!item) return '';
    return normalizeServiceCode(item.billingServiceCode ?? '') || normalizeServiceCode(item.code ?? '');
}

function findClinicalCatalogLookupItem(value: string): ClinicalCatalogLookupItem | null {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) return null;
    return (clinicalCatalogOptionsQuery.data.value ?? []).find((item) => String(item.id ?? '').trim().toLowerCase() === normalizedValue) ?? null;
}

const selectedClinicalCatalogItem = computed(() => findClinicalCatalogLookupItem(form.clinicalCatalogItemId));

const filteredClinicalCatalogItems = computed(() => {
    const items = clinicalCatalogOptionsQuery.data.value ?? [];
    if (clinicalCatalogTypeFilter.value === 'all') return items;
    return items.filter((item) => item.catalogType === clinicalCatalogTypeFilter.value);
});

const clinicalCatalogItemOptions = computed<SearchableSelectOption[]>(() =>
    [...filteredClinicalCatalogItems.value]
        .sort((left, right) => {
            const leftGroup = clinicalCatalogGroupLabel(left.catalogType);
            const rightGroup = clinicalCatalogGroupLabel(right.catalogType);
            if (leftGroup !== rightGroup) return leftGroup.localeCompare(rightGroup);
            const leftLabel = `${left.name ?? ''} ${left.code ?? ''}`.trim();
            const rightLabel = `${right.name ?? ''} ${right.code ?? ''}`.trim();
            return leftLabel.localeCompare(rightLabel);
        })
        .map((item) => {
            const code = String(item.code ?? '').trim();
            const name = String(item.name ?? '').trim();
            const billingServiceCode = resolvedClinicalCatalogServiceCode(item);
            const linkedBillingItem = item.billingLink?.item;
            const linkSummary = linkedBillingItem
                ? `Already linked to tariff ${linkedBillingItem.serviceCode ?? billingServiceCode ?? 'NO-CODE'}`
                : billingServiceCode
                    ? `Billing code ${billingServiceCode}`
                    : 'Billing code will fall back to the clinical code';

            return {
                value: String(item.id ?? '').trim(),
                label: code ? `${code} - ${name || 'Unnamed item'}` : (name || 'Unnamed item'),
                description: [linkSummary, item.category ? formatEnumLabel(item.category) : null, item.unit ? formatEnumLabel(item.unit) : null]
                    .filter((value): value is string => Boolean(value && value.trim()))
                    .join(' | '),
                keywords: [code, name, billingServiceCode, item.category ?? '', item.unit ?? '', clinicalCatalogGroupLabel(item.catalogType)].filter((value) => value.trim().length > 0),
                group: clinicalCatalogGroupLabel(item.catalogType),
            } satisfies SearchableSelectOption;
        }),
);

const clinicalCatalogHelperText = computed(() => {
    if (clinicalCatalogOptionsQuery.isLoading.value) return 'Loading active clinical definitions across lab, radiology, theatre, and formulary catalogs...';
    if (clinicalCatalogOptionsQuery.isError.value) return 'Clinical catalog lookup is unavailable right now. Use standalone mode only for true billing-only services.';
    if (!(clinicalCatalogOptionsQuery.data.value ?? []).length) return 'No active clinical definitions are available yet. Add them in Clinical Catalog first.';
    if (!filteredClinicalCatalogItems.value.length) return `No active ${clinicalCatalogGroupLabel(clinicalCatalogTypeFilter.value).toLowerCase()} definitions are available yet.`;
    return 'Select the existing clinical definition first. Service code and service name will be filled automatically from that record.';
});

const clinicalCatalogEmptyText = computed(() => {
    if (clinicalCatalogOptionsQuery.isLoading.value) return 'Loading clinical definitions...';
    if (!(clinicalCatalogOptionsQuery.data.value ?? []).length) return 'No active clinical definitions are available.';
    if (!filteredClinicalCatalogItems.value.length) return `No active ${clinicalCatalogGroupLabel(clinicalCatalogTypeFilter.value).toLowerCase()} definitions are available.`;
    return 'No clinical definition matched this search.';
});

const linkedClinicalModeLocked = computed(() =>
    !clinicalCatalogOptionsQuery.isLoading.value
    && (clinicalCatalogOptionsQuery.isError.value || (clinicalCatalogOptionsQuery.data.value ?? []).length === 0),
);

const clinicalFallbackCodeMessage = computed(() => {
    const item = selectedClinicalCatalogItem.value;
    if (!item) return null;
    if (normalizeServiceCode(item.billingServiceCode ?? '')) return null;
    const fallbackCode = normalizeServiceCode(item.code ?? '');
    if (!fallbackCode) return 'This clinical definition has no billing service code or clinical code yet. Set a code before saving a tariff.';
    return `This clinical definition does not have an explicit billing service code yet, so the tariff will use the clinical code ${fallbackCode}.`;
});

function applyClinicalCatalogSelection(item: ClinicalCatalogLookupItem | null): void {
    if (!item) return;

    form.serviceCode = resolvedClinicalCatalogServiceCode(item);
    form.serviceName = String(item.name ?? '').trim();

    const recommendedServiceType = billingServiceTypeFromClinicalCatalogType(item.catalogType);
    if (recommendedServiceType) form.serviceType = recommendedServiceType;

    const departmentId = String(item.departmentId ?? '').trim();
    if (departmentId) form.departmentId = departmentId;

    const unit = String(item.unit ?? '').trim();
    if (unit) form.unit = unit;

    const meta = item.metadata ?? {};
    const priceUnit = String(meta.priceUnit ?? meta.price_unit ?? item.unit ?? '').trim();
    if (priceUnit) form.priceUnit = priceUnit;

    if (recommendedServiceType === 'pharmacy' && !form.basePrice.trim()) form.basePrice = '0';

    form.facilityTier = String(item.facilityTier ?? '').trim();
    applyStandardsCodesToForm(item.codes);
    if (!form.description.trim()) form.description = String(item.description ?? '').trim();
}

function clearClinicalCatalogSelection(): void {
    form.clinicalCatalogItemId = '';
    if (form.identitySource === 'clinical') {
        form.serviceCode = '';
        form.serviceName = '';
        form.facilityTier = '';
        form.priceUnit = '';
        applyStandardsCodesToForm(null);
    }
}

// --- Duplicate service-code family preview ---

const familyPreviewLoading = ref(false);
const familyPreviewError = ref<string | null>(null);
const familyPreviewItems = ref<CatalogItem[]>([]);
let familyPreviewRequestSequence = 0;
let familyPreviewDebounceHandle: ReturnType<typeof setTimeout> | null = null;

async function loadFamilyPreview(serviceCode: string): Promise<void> {
    const normalizedServiceCode = normalizeServiceCode(serviceCode);
    if (!normalizedServiceCode) {
        familyPreviewItems.value = [];
        familyPreviewError.value = null;
        familyPreviewLoading.value = false;
        return;
    }

    const requestSequence = ++familyPreviewRequestSequence;
    familyPreviewLoading.value = true;
    familyPreviewError.value = null;

    try {
        const response = await apiGet<CatalogListResponse>('/billing-service-catalog/items', {
            q: normalizedServiceCode,
            perPage: 20,
            page: 1,
            sortBy: 'effectiveFrom',
            sortDir: 'desc',
        });
        if (requestSequence !== familyPreviewRequestSequence) return;
        familyPreviewItems.value = (response.data ?? []).filter((item) => normalizeServiceCode(item.serviceCode ?? '') === normalizedServiceCode);
    } catch (error) {
        if (requestSequence !== familyPreviewRequestSequence) return;
        familyPreviewItems.value = [];
        familyPreviewError.value = messageFromUnknown(error, 'Unable to check the existing tariff family.');
    } finally {
        if (requestSequence === familyPreviewRequestSequence) familyPreviewLoading.value = false;
    }
}

const familyPreviewPrimary = computed(() => familyPreviewItems.value[0] ?? null);
const familyAlreadyExists = computed(() => familyPreviewItems.value.length > 0);
const familyVersionCount = computed(() => familyPreviewItems.value.length);

// --- Derived fields ---

const departmentOptions = computed(() => departmentOptionsFor(form.serviceType));

const departmentHelperText = computed(() => {
    if (departmentQuery.isLoading.value) return 'Loading live department list...';
    if (!departmentQuery.data.value?.length) return 'Department directory is currently unavailable. Refresh the page after department setup is confirmed.';
    if (form.serviceType.trim()) return `Showing departments matched to ${formatEnumLabel(form.serviceType)} first.`;
    return 'Search the hospital department list by code or name.';
});

const basePriceHelperText = computed(() => (
    // Inventory-based auto-pricing (BillingInvoiceLineItemAutoPricingResolver::resolveMedicineUnitPrice())
    // only fires when a catalog item carries an inventory_item_id, which nothing currently sets — so this
    // amount is the price actually charged today, not a fallback. Don't restore the old "fallback default"
    // wording without wiring that link up first.
    form.serviceType === 'pharmacy' ? 'This is the price actually charged for this medicine. Inventory-based pricing is not wired up yet.' : undefined
));

const serviceTypeSelectValue = computed({
    get: () => form.serviceType || '__none__',
    set: (value: string) => { form.serviceType = value === '__none__' ? '' : value; },
});
const unitSelectValue = computed({
    get: () => form.unit || '__none__',
    set: (value: string) => { form.unit = value === '__none__' ? '' : value; },
});
const taxableSelectValue = computed({
    get: () => form.isTaxable || '__none__',
    set: (value: string) => { form.isTaxable = value === '__none__' ? '' : value; },
});
const priceUnitSelectValue = computed({
    get: () => form.priceUnit || '__none__',
    set: (value: string) => { form.priceUnit = value === '__none__' ? '' : value; },
});
const facilityTierSelectValue = computed({
    get: () => form.facilityTier || '__none__',
    set: (value: string) => { form.facilityTier = value === '__none__' ? '' : value; },
});

const identitySourceTabsValue = computed({
    get: () => form.identitySource,
    set: (value: string) => { form.identitySource = value === 'standalone' ? 'standalone' : 'clinical'; },
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

const identitySummary = computed(() => {
    const code = form.serviceCode.trim();
    const name = form.serviceName.trim();
    const item = selectedClinicalCatalogItem.value;

    if (form.identitySource === 'clinical' && item) {
        const sourceLabel = clinicalCatalogGroupLabel(item.catalogType);
        if (code && name) return `${sourceLabel} | ${code} | ${name}`;
    }
    if (!code && !name) return form.identitySource === 'clinical' ? 'No clinical definition selected' : 'No service identity drafted';
    if (code && name) return `${code} | ${name}`;
    return code || name;
});

// --- Readiness checklist (item 3 fix: this now actually renders) ---

type ChecklistStep = { key: string; label: string; helper: string; complete: boolean };

const checklist = computed<ChecklistStep[]>(() => {
    const hasIdentity = form.serviceCode.trim() !== '' && form.serviceName.trim() !== '';
    const parsedBasePrice = parseDecimalOrNull(form.basePrice);
    const hasBaseTariff = parsedBasePrice !== null && parsedBasePrice !== 'invalid' && form.currencyCode.trim() !== '';
    const hasLifecyclePlan = form.effectiveFrom.trim() !== '' || form.effectiveTo.trim() !== '' || form.description.trim() !== '';

    return [
        { key: 'identity', label: 'Define service identity', helper: 'Stable code, name, and classification for downstream billing and clinical mappings.', complete: hasIdentity },
        { key: 'tariff', label: 'Set base price', helper: 'Default price, currency, and tax posture for this service.', complete: hasBaseTariff },
        { key: 'lifecycle', label: 'Plan lifecycle', helper: 'Effective window and notes so the price can start or stop cleanly.', complete: hasLifecyclePlan },
    ];
});

const blockers = computed(() => {
    const messages: string[] = [];
    if (form.identitySource === 'clinical' && !selectedClinicalCatalogItem.value) {
        messages.push(
            clinicalCatalogOptionsQuery.isError.value
                ? 'Clinical catalog lookup is unavailable. Restore catalog access or switch to standalone billing service for a true billing-only item.'
                : 'Select the clinical catalog item first so this tariff inherits the correct care definition.',
        );
    }
    if (familyAlreadyExists.value) {
        messages.push('This service code already exists in the current scope. Open the existing tariff family and create a new version instead of creating another base record.');
    }
    if (windowValidationMessage.value) messages.push(windowValidationMessage.value);
    return messages;
});

const ready = computed(() => (
    checklist.value.every((step) => step.complete)
    && blockers.value.length === 0
    && !(familyPreviewLoading.value && form.serviceCode.trim() !== '')
));

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

// --- Lifecycle ---

watch(open, (isOpen) => {
    if (!isOpen) return;
    resetForm();
    requestKey.value = generateRequestKey('billing-service-catalog-create');
    if (linkedClinicalModeLocked.value) form.identitySource = 'standalone';
});

watch(linkedClinicalModeLocked, (locked) => {
    if (locked && form.identitySource === 'clinical') form.identitySource = 'standalone';
});

watch(() => form.clinicalCatalogItemId, (value) => {
    if (!value.trim()) return;
    const item = findClinicalCatalogLookupItem(value);
    if (item) applyClinicalCatalogSelection(item);
});

watch(clinicalCatalogTypeFilter, (catalogType) => {
    const item = selectedClinicalCatalogItem.value;
    if (!item || catalogType === 'all' || item.catalogType === catalogType) return;
    clearClinicalCatalogSelection();
});

watch(() => form.serviceType, (serviceType) => {
    if (serviceType !== 'pharmacy') {
        form.priceUnit = '';
        form.unitsPerPack = '';
    }
    if (!serviceType) form.unit = '';
});

watch(() => [open.value, normalizeServiceCode(form.serviceCode)] as const, ([isOpen, serviceCode]) => {
    if (familyPreviewDebounceHandle !== null) {
        clearTimeout(familyPreviewDebounceHandle);
        familyPreviewDebounceHandle = null;
    }
    if (!isOpen || !serviceCode) {
        familyPreviewItems.value = [];
        familyPreviewError.value = null;
        familyPreviewLoading.value = false;
        return;
    }
    familyPreviewDebounceHandle = setTimeout(() => void loadFamilyPreview(serviceCode), 250);
});

function parseBoolean(value: string): boolean | null {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
}

async function submit(): Promise<void> {
    if (create.isPending.value) return;

    submitError.value = null;
    fieldErrors.value = {};

    const basePrice = parseDecimalOrNull(form.basePrice);
    const taxRatePercent = parseDecimalOrNull(form.taxRatePercent);
    const unitsPerPack = form.unitsPerPack.trim() ? Number.parseInt(form.unitsPerPack.trim(), 10) : null;
    const metadata = parseMetadata(form.metadataText);

    const localErrors: Record<string, string[]> = {};
    if (form.identitySource === 'clinical' && !form.clinicalCatalogItemId.trim()) {
        localErrors.clinicalCatalogItemId = ['Select the clinical catalog item that this tariff belongs to.'];
    }
    if (!form.serviceCode.trim()) localErrors.serviceCode = ['Service code is required.'];
    if (!form.serviceName.trim()) localErrors.serviceName = ['Service name is required.'];
    if (basePrice === null || basePrice === 'invalid') localErrors.basePrice = ['Base price must be a valid non-negative number.'];
    if (!form.currencyCode.trim()) localErrors.currencyCode = ['Currency code is required.'];
    if (taxRatePercent === 'invalid') localErrors.taxRatePercent = ['Tax rate must be a valid non-negative number.'];
    if (unitsPerPack !== null && (Number.isNaN(unitsPerPack) || unitsPerPack < 1)) localErrors.unitsPerPack = ['Units per pack must be a positive whole number.'];
    if (metadata === 'invalid') localErrors.metadata = ['System integration notes must be a valid JSON object.'];
    if (familyAlreadyExists.value) localErrors.serviceCode = ['Service code already exists in the current scope. Open the existing tariff family and create a new version instead.'];
    if (windowValidationMessage.value) localErrors.effectiveTo = [windowValidationMessage.value];

    if (Object.keys(localErrors).length > 0) {
        fieldErrors.value = localErrors;
        return;
    }

    try {
        const item = await create.mutateAsync({
            clinicalCatalogItemId: form.identitySource === 'clinical' ? (form.clinicalCatalogItemId.trim() || null) : null,
            serviceCode: form.serviceCode.trim(),
            serviceName: form.serviceName.trim(),
            serviceType: form.serviceType.trim() || null,
            departmentId: form.departmentId.trim() || null,
            unit: form.unit.trim() || null,
            basePrice: basePrice as number,
            currencyCode: form.currencyCode.trim().toUpperCase(),
            taxRatePercent: taxRatePercent as number | null,
            isTaxable: parseBoolean(form.isTaxable),
            effectiveFrom: toApiDateTime(form.effectiveFrom),
            effectiveTo: toApiDateTime(form.effectiveTo),
            description: form.description.trim() || null,
            facilityTier: form.facilityTier.trim() || null,
            codes: standardsCodesFromForm(),
            priceUnit: form.priceUnit.trim() || null,
            unitsPerPack: unitsPerPack && !Number.isNaN(unitsPerPack) ? unitsPerPack : null,
            metadata: metadata === 'invalid' ? null : metadata,
            idempotencyKey: requestKey.value,
        });

        notifySuccess('Service catalog item created.');
        emit('created', item);
        open.value = false;
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: { errors?: Record<string, string[]> } };
        if (apiError.status === 422 && apiError.payload?.errors) {
            fieldErrors.value = apiError.payload.errors;
        } else {
            submitError.value = messageFromUnknown(error, 'Unable to create service catalog item.');
            notifyError(submitError.value);
        }
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="workspace" size="4xl" class="flex h-full min-h-0 flex-col">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="plus" class="size-5 text-muted-foreground" />
                    Add service price
                </SheetTitle>
                <SheetDescription>
                    Link a clinical service or enter a standalone code, then set the hospital base price and effective window.
                </SheetDescription>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                    <Badge :variant="ready ? 'secondary' : 'outline'">{{ ready ? 'Ready to save' : 'Incomplete' }}</Badge>
                    <Badge v-if="form.serviceCode.trim()" variant="outline" class="max-w-full truncate font-normal">{{ identitySummary }}</Badge>
                </div>
            </SheetHeader>

            <ScrollArea class="min-h-0 flex-1">
                <div class="grid gap-4 px-6 py-4">
                    <Alert v-if="linkedClinicalModeLocked" class="border-amber-500/30 bg-amber-500/10">
                        <AlertTitle class="text-amber-900 dark:text-amber-200">Clinical catalog unavailable</AlertTitle>
                        <AlertDescription class="text-xs text-amber-800 dark:text-amber-300">
                            Add care definitions in Clinical Catalog first, or switch to standalone for billing-only services.
                        </AlertDescription>
                    </Alert>

                    <fieldset class="grid gap-3 rounded-lg border p-3">
                        <legend class="px-2 text-sm font-medium text-muted-foreground">Source</legend>
                        <Tabs v-model="identitySourceTabsValue" class="space-y-3">
                            <TabsList class="grid h-9 w-full grid-cols-2">
                                <TabsTrigger value="clinical" :disabled="linkedClinicalModeLocked" class="text-xs sm:text-sm">Clinical catalog</TabsTrigger>
                                <TabsTrigger value="standalone" class="text-xs sm:text-sm">Standalone</TabsTrigger>
                            </TabsList>

                            <TabsContent value="clinical" class="mt-0 space-y-3">
                                <div class="grid gap-1.5">
                                    <Label for="create-price-clinical-catalog-type">Catalog type</Label>
                                    <Select v-model="clinicalCatalogTypeFilter">
                                        <SelectTrigger id="create-price-clinical-catalog-type" class="w-full">
                                            <SelectValue placeholder="All catalogs" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All catalogs</SelectItem>
                                            <SelectItem v-for="source in CLINICAL_CATALOG_SOURCES" :key="source.type" :value="source.type">{{ source.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <ComboboxField
                                    input-id="create-price-clinical-catalog-item"
                                    label="Clinical definition"
                                    required
                                    v-model="form.clinicalCatalogItemId"
                                    :options="clinicalCatalogItemOptions"
                                    placeholder="Lab, radiology, theatre, or formulary item"
                                    search-placeholder="Search code, name, or billing code"
                                    :helper-text="clinicalCatalogHelperText"
                                    :error-message="fieldError('clinicalCatalogItemId')"
                                    :empty-text="clinicalCatalogEmptyText"
                                />
                                <div v-if="clinicalCatalogOptionsQuery.isError.value" class="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                                    <p class="text-destructive">Clinical catalog lookup is unavailable right now.</p>
                                    <Button size="sm" variant="outline" @click="() => clinicalCatalogOptionsQuery.refetch()">Retry</Button>
                                </div>
                                <div v-else-if="selectedClinicalCatalogItem" class="flex items-start justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                                    <div class="min-w-0 space-y-0.5">
                                        <p class="truncate text-sm font-medium">{{ selectedClinicalCatalogItem.name || 'Unnamed definition' }}</p>
                                        <p class="text-xs text-muted-foreground">
                                            {{ selectedClinicalCatalogItem.code || 'No code' }}
                                            <span class="text-border"> · </span>
                                            {{ clinicalCatalogGroupLabel(selectedClinicalCatalogItem.catalogType) }}
                                            <span v-if="resolvedClinicalCatalogServiceCode(selectedClinicalCatalogItem)">
                                                <span class="text-border"> · </span>
                                                Billing {{ resolvedClinicalCatalogServiceCode(selectedClinicalCatalogItem) }}
                                            </span>
                                        </p>
                                        <p v-if="clinicalFallbackCodeMessage" class="text-xs text-amber-700 dark:text-amber-300">{{ clinicalFallbackCodeMessage }}</p>
                                    </div>
                                    <Button size="sm" variant="ghost" class="shrink-0" @click="clearClinicalCatalogSelection">Clear</Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="standalone" class="mt-0">
                                <p class="text-xs text-muted-foreground">For consultations, admissions, and other charges without a clinical catalog definition.</p>
                            </TabsContent>
                        </Tabs>
                    </fieldset>

                    <fieldset class="grid gap-3 rounded-lg border p-3">
                        <legend class="flex items-center gap-2 px-2 text-sm font-medium text-muted-foreground">
                            Service identity
                            <CatalogLinkBadge
                                v-if="form.identitySource === 'clinical' && selectedClinicalCatalogItem"
                                source="clinical_catalog"
                                :catalog-type="selectedClinicalCatalogItem.catalogType"
                                :catalog-name="selectedClinicalCatalogItem.name"
                                :catalog-code="selectedClinicalCatalogItem.code"
                            />
                        </legend>
                        <div class="grid grid-cols-6 gap-3">
                            <FormFieldShell input-id="create-price-service-code" label="Service code" required container-class="col-span-6 sm:col-span-2"
                                :helper-text="form.identitySource === 'clinical' ? 'From clinical definition.' : 'One stable code per service family.'"
                                :error-message="fieldError('serviceCode')">
                                <Input id="create-price-service-code" v-model="form.serviceCode" placeholder="CONSULT-OPD-001" :disabled="form.identitySource === 'clinical'" />
                            </FormFieldShell>
                            <FormFieldShell input-id="create-price-service-name" label="Service name" required container-class="col-span-6 sm:col-span-2"
                                :helper-text="form.identitySource === 'clinical' ? 'From clinical definition.' : 'Name on bills and reports.'"
                                :error-message="fieldError('serviceName')">
                                <Input id="create-price-service-name" v-model="form.serviceName" placeholder="OPD Consultation" :disabled="form.identitySource === 'clinical'" />
                            </FormFieldShell>
                            <FormFieldShell input-id="create-price-service-type" label="Service type" container-class="col-span-6 sm:col-span-2">
                                <Select v-model="serviceTypeSelectValue">
                                    <SelectTrigger id="create-price-service-type" class="w-full"><SelectValue placeholder="Select service type" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">No service type yet</SelectItem>
                                        <SelectItem v-for="option in SERVICE_TYPE_OPTIONS" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormFieldShell>
                            <ComboboxField
                                input-id="create-price-department"
                                label="Department"
                                v-model="form.departmentId"
                                :options="departmentOptions"
                                container-class="col-span-6 sm:col-span-3"
                                placeholder="Select department"
                                search-placeholder="Search department code or name"
                                :helper-text="departmentHelperText"
                                :error-message="fieldError('departmentId')"
                                empty-text="No departments matched this search."
                            />
                            <FormFieldShell input-id="create-price-unit" label="Billing unit" container-class="col-span-6 sm:col-span-3">
                                <Select v-model="unitSelectValue">
                                    <SelectTrigger id="create-price-unit" class="w-full"><SelectValue placeholder="Select billing unit" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">No billing unit yet</SelectItem>
                                        <SelectItem v-for="option in UNIT_OPTIONS" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormFieldShell>
                            <FormFieldShell v-if="form.serviceType === 'pharmacy'" input-id="create-price-pharmacy-unit" label="Pharmacy unit" container-class="col-span-6 sm:col-span-3">
                                <Select v-model="priceUnitSelectValue">
                                    <SelectTrigger id="create-price-pharmacy-unit" class="w-full"><SelectValue placeholder="Select unit" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">No pharmacy unit</SelectItem>
                                        <SelectItem v-for="option in PHARMACY_UNIT_OPTIONS" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormFieldShell>
                            <FormFieldShell v-if="form.serviceType === 'pharmacy'" input-id="create-price-units-per-pack" label="Units per pack" container-class="col-span-6 sm:col-span-3" :error-message="fieldError('unitsPerPack')">
                                <Input id="create-price-units-per-pack" v-model="form.unitsPerPack" inputmode="numeric" placeholder="e.g. 30" />
                            </FormFieldShell>
                        </div>

                        <Alert v-if="familyPreviewError" variant="destructive" class="text-sm">
                            <AlertDescription>{{ familyPreviewError }}</AlertDescription>
                        </Alert>
                        <div v-else-if="familyPreviewLoading && form.serviceCode.trim()" class="flex items-center gap-2 text-xs text-muted-foreground">
                            <AppIcon name="loader-circle" class="size-3.5 animate-spin" />
                            Checking whether this service code already has a tariff family…
                        </div>
                        <Alert v-else-if="familyAlreadyExists" variant="destructive">
                            <AlertTitle>Service code already in use</AlertTitle>
                            <AlertDescription class="space-y-2 text-xs">
                                <p>{{ familyPreviewPrimary?.serviceName || 'Unnamed service' }} already has {{ familyVersionCount }} version{{ familyVersionCount === 1 ? '' : 's' }}. Create a new version instead of another base record.</p>
                            </AlertDescription>
                        </Alert>
                    </fieldset>

                    <fieldset class="grid gap-3 rounded-lg border p-3">
                        <legend class="px-2 text-sm font-medium text-muted-foreground">Pricing</legend>
                        <div class="grid grid-cols-6 gap-3">
                            <FormFieldShell input-id="create-price-base-price" label="Amount" required container-class="col-span-6 sm:col-span-3" :helper-text="basePriceHelperText" :error-message="fieldError('basePrice')">
                                <Input id="create-price-base-price" v-model="form.basePrice" inputmode="decimal" placeholder="25000" />
                            </FormFieldShell>
                            <FormFieldShell input-id="create-price-currency" label="Currency" required container-class="col-span-6 sm:col-span-3" :error-message="fieldError('currencyCode')">
                                <Input id="create-price-currency" v-model="form.currencyCode" maxlength="3" />
                            </FormFieldShell>
                            <FormFieldShell input-id="create-price-tax-rate" label="Tax rate %" container-class="col-span-6 sm:col-span-3" :error-message="fieldError('taxRatePercent')">
                                <Input id="create-price-tax-rate" v-model="form.taxRatePercent" inputmode="decimal" placeholder="0" />
                            </FormFieldShell>
                            <FormFieldShell input-id="create-price-taxable" label="Taxable" container-class="col-span-6 sm:col-span-3">
                                <Select v-model="taxableSelectValue">
                                    <SelectTrigger id="create-price-taxable" class="w-full"><SelectValue placeholder="Tax posture" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">Not set</SelectItem>
                                        <SelectItem value="true">Yes</SelectItem>
                                        <SelectItem value="false">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormFieldShell>
                        </div>
                    </fieldset>

                    <fieldset class="grid gap-3 rounded-lg border p-3">
                        <legend class="px-2 text-sm font-medium text-muted-foreground">Effective window</legend>
                        <div class="grid grid-cols-6 gap-3">
                            <div class="col-span-6 sm:col-span-3">
                                <SingleDatePopoverField input-id="create-price-effective-from-date" label="Start date" v-model="effectiveFromDate" :error-message="fieldError('effectiveFrom')" />
                            </div>
                            <div class="col-span-6 sm:col-span-3">
                                <TimePopoverField input-id="create-price-effective-from-time" label="Start time" v-model="effectiveFromTime" :disabled="!effectiveFromDate" />
                            </div>
                            <div class="col-span-6 sm:col-span-3">
                                <SingleDatePopoverField input-id="create-price-effective-to-date" label="End date" v-model="effectiveToDate" helper-text="Leave blank for open-ended." :error-message="fieldError('effectiveTo')" />
                            </div>
                            <div class="col-span-6 sm:col-span-3">
                                <TimePopoverField input-id="create-price-effective-to-time" label="End time" v-model="effectiveToTime" :disabled="!effectiveToDate" />
                            </div>
                            <FormFieldShell input-id="create-price-description" label="Notes (optional)" container-class="col-span-6">
                                <Textarea id="create-price-description" v-model="form.description" class="min-h-20" placeholder="Registration or audit context" />
                            </FormFieldShell>
                        </div>
                        <p v-if="windowValidationMessage" class="text-xs text-destructive">{{ windowValidationMessage }}</p>
                    </fieldset>

                    <div class="grid gap-3 sm:grid-cols-2">
                        <details class="rounded-lg border p-3">
                            <summary class="cursor-pointer text-sm font-medium text-muted-foreground">Billing standards (optional)</summary>
                            <div class="mt-3 grid grid-cols-2 gap-3">
                                <FormFieldShell input-id="create-price-facility-tier" label="Minimum facility tier" container-class="col-span-2">
                                    <Select v-model="facilityTierSelectValue">
                                        <SelectTrigger id="create-price-facility-tier" class="w-full"><SelectValue placeholder="All tiers" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">All tiers</SelectItem>
                                            <SelectItem v-for="tier in FACILITY_TIER_OPTIONS" :key="tier.value" :value="tier.value">{{ tier.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormFieldShell>
                                <FormFieldShell input-id="create-price-local-code" label="Local code">
                                    <Input id="create-price-local-code" v-model="form.standardsLocal" />
                                </FormFieldShell>
                                <FormFieldShell input-id="create-price-nhif-code" label="NHIF code">
                                    <Input id="create-price-nhif-code" v-model="form.standardsNhif" />
                                </FormFieldShell>
                                <FormFieldShell input-id="create-price-msd-code" label="MSD code">
                                    <Input id="create-price-msd-code" v-model="form.standardsMsd" />
                                </FormFieldShell>
                                <FormFieldShell input-id="create-price-loinc-code" label="LOINC">
                                    <Input id="create-price-loinc-code" v-model="form.standardsLoinc" />
                                </FormFieldShell>
                                <FormFieldShell input-id="create-price-snomed-code" label="SNOMED CT">
                                    <Input id="create-price-snomed-code" v-model="form.standardsSnomedCt" />
                                </FormFieldShell>
                                <FormFieldShell input-id="create-price-cpt-code" label="CPT">
                                    <Input id="create-price-cpt-code" v-model="form.standardsCpt" />
                                </FormFieldShell>
                                <FormFieldShell input-id="create-price-icd-code" label="ICD">
                                    <Input id="create-price-icd-code" v-model="form.standardsIcd" />
                                </FormFieldShell>
                            </div>
                        </details>

                        <details class="rounded-lg border p-3">
                            <summary class="cursor-pointer text-sm font-medium text-muted-foreground">System integration notes (technical)</summary>
                            <p class="mt-2 text-xs text-muted-foreground">For IT or integration teams only. Hospital billing staff can ignore this section.</p>
                            <FormFieldShell input-id="create-price-metadata" label="Integration payload" container-class="mt-3" :error-message="fieldError('metadata')">
                                <Textarea id="create-price-metadata" v-model="form.metadataText" class="min-h-24 font-mono text-xs" placeholder='{"key": "value"}' />
                            </FormFieldShell>
                        </details>
                    </div>
                </div>
            </ScrollArea>

            <!-- Item 3 fix: the readiness checklist is now actually visible, right above the Save button. -->
            <div class="shrink-0 border-t bg-muted/20 px-6 py-3">
                <p class="mb-2 text-xs font-medium text-muted-foreground">Before you save</p>
                <ul class="space-y-1.5">
                    <li v-for="step in checklist" :key="step.key" class="flex items-start gap-2 text-xs">
                        <AppIcon name="check-circle" :class="step.complete ? 'mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400' : 'mt-0.5 size-3.5 shrink-0 text-muted-foreground/40'" />
                        <span>
                            <span :class="step.complete ? 'text-foreground' : 'font-medium text-foreground'">{{ step.label }}</span>
                            <span class="text-muted-foreground"> — {{ step.helper }}</span>
                        </span>
                    </li>
                </ul>
                <ul v-if="blockers.length" class="mt-2 list-disc space-y-1 pl-4">
                    <li v-for="message in blockers" :key="message" class="text-xs leading-5 text-destructive">{{ message }}</li>
                </ul>
                <p v-if="submitError" class="mt-2 text-xs text-destructive">{{ submitError }}</p>
            </div>

            <SheetFooter class="shrink-0 gap-2 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button type="button" variant="outline" :disabled="create.isPending.value" @click="open = false">Cancel</Button>
                <Button type="button" :disabled="create.isPending.value || !ready" class="gap-1.5" @click="submit">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ create.isPending.value ? 'Saving...' : 'Save new price' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
