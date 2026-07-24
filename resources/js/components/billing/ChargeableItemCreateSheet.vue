<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCreateChargeableItem } from '@/composables/chargeableItems/useCreateChargeableItem';
import type { ChargeableItem } from '@/composables/chargeableItems/useChargeableItems';
import { useServiceCatalogClinicalCatalogOptions } from '@/composables/serviceCatalogIndex/useServiceCatalogClinicalCatalogOptions';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import { CLINICAL_CATALOG_SOURCES, clinicalCatalogGroupLabel, type ClinicalCatalogType } from '@/lib/billingServiceCatalog';
import { messageFromUnknown } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';

/**
 * Standalone create Sheet for the new pricing engine's chargeable_items +
 * price_book_entries — deliberately leaner than
 * ServiceCatalogCreateItemSheet.vue (that table has ~25 fields; this one
 * has ~10). Reuses the same identitySource: clinical | standalone toggle
 * concept, backed by the existing clinical-catalog lookup composable.
 */
const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
    created: [item: ChargeableItem];
}>();

const { activeCurrencyCode } = usePlatformCountryProfile();
const defaultCurrencyCode = computed(() => activeCurrencyCode.value || 'TZS');

const clinicalCatalogOptionsQuery = useServiceCatalogClinicalCatalogOptions();
const create = useCreateChargeableItem();

const identitySource = ref<'clinical' | 'standalone'>('clinical');
const clinicalCatalogTypeFilter = ref<ClinicalCatalogType | 'all'>('all');
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const CHARGE_MODEL_OPTIONS = [
    { value: 'flat', label: 'Flat' },
    { value: 'per_unit', label: 'Per unit' },
    { value: 'per_day', label: 'Per day' },
    { value: 'per_hour', label: 'Per hour' },
] as const;

const form = reactive({
    clinicalCatalogItemId: '',
    code: '',
    name: '',
    chargeModel: 'flat' as string,
    currencyCode: defaultCurrencyCode.value,
    unitPrice: '',
    taxRatePercent: '',
    isTaxable: 'false',
    effectiveFrom: '',
});

const standaloneCatalogTypeOptions = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'bed_day', label: 'Bed-day' },
] as const;
const standaloneCatalogType = ref<string>('consultation');

const catalogType = computed(() => (identitySource.value === 'clinical' ? clinicalCatalogTypeFilter.value : standaloneCatalogType.value));

const clinicalCatalogItemOptions = computed<SearchableSelectOption[]>(() =>
    (clinicalCatalogOptionsQuery.data.value ?? [])
        .filter((item) => clinicalCatalogTypeFilter.value === 'all' || item.catalogType === clinicalCatalogTypeFilter.value)
        .map((item): SearchableSelectOption | null => {
            const value = item.id?.trim();
            if (!value) return null;
            return {
                value,
                label: item.code ? `${item.code} — ${item.name ?? 'Unnamed'}` : (item.name ?? 'Unnamed'),
                description: clinicalCatalogGroupLabel(item.catalogType),
                group: clinicalCatalogGroupLabel(item.catalogType),
            };
        })
        .filter((option): option is SearchableSelectOption => option !== null),
);

const selectedClinicalCatalogItem = computed(() =>
    (clinicalCatalogOptionsQuery.data.value ?? []).find((item) => item.id === form.clinicalCatalogItemId) ?? null,
);

watch(open, (isOpen) => {
    if (!isOpen) return;
    identitySource.value = 'clinical';
    clinicalCatalogTypeFilter.value = 'all';
    standaloneCatalogType.value = 'consultation';
    form.clinicalCatalogItemId = '';
    form.code = '';
    form.name = '';
    form.chargeModel = 'flat';
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
    if (create.isPending.value) return false;
    if (String(form.unitPrice).trim() === '' || !form.currencyCode.trim()) return false;
    if (identitySource.value === 'clinical') return form.clinicalCatalogItemId.trim() !== '';
    return form.code.trim() !== '' && form.name.trim() !== '';
});

async function submit(): Promise<void> {
    submitError.value = null;
    fieldErrors.value = {};

    try {
        const item = await create.mutateAsync({
            catalogType: catalogType.value === 'all' ? 'lab_test' : catalogType.value,
            chargeModel: form.chargeModel,
            clinicalCatalogItemId: identitySource.value === 'clinical' ? form.clinicalCatalogItemId.trim() : null,
            code: identitySource.value === 'standalone' ? form.code.trim() : null,
            name: identitySource.value === 'standalone' ? form.name.trim() : null,
            currencyCode: form.currencyCode.trim().toUpperCase(),
            unitPrice: Number.parseFloat(String(form.unitPrice)),
            taxRatePercent: String(form.taxRatePercent).trim() ? Number.parseFloat(String(form.taxRatePercent)) : null,
            isTaxable: form.isTaxable === 'true',
            effectiveFrom: form.effectiveFrom.trim() || null,
        });
        emit('created', item);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to create this chargeable item.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="plus" class="size-5 text-muted-foreground" />
                    New chargeable item
                </SheetTitle>
                <SheetDescription>
                    Link an existing clinical catalog definition, or create a standalone item for consultations and bed-days.
                </SheetDescription>
            </SheetHeader>

            <ScrollArea class="min-h-0 flex-1">
                <div class="grid gap-4 px-6 py-4">
                    <Alert v-if="submitError" variant="destructive">
                        <AlertTitle>Unable to create this chargeable item</AlertTitle>
                        <AlertDescription>{{ submitError }}</AlertDescription>
                    </Alert>

                    <fieldset class="grid gap-3 rounded-lg border p-3">
                        <legend class="px-2 text-sm font-medium text-muted-foreground">Source</legend>
                        <Tabs v-model="identitySource" class="space-y-3">
                            <TabsList class="grid h-9 w-full grid-cols-2">
                                <TabsTrigger value="clinical" class="text-xs sm:text-sm">Clinical catalog</TabsTrigger>
                                <TabsTrigger value="standalone" class="text-xs sm:text-sm">Standalone</TabsTrigger>
                            </TabsList>

                            <TabsContent value="clinical" class="mt-0 space-y-3">
                                <div class="grid gap-1.5">
                                    <Label for="chargeable-item-create-catalog-type">Catalog type</Label>
                                    <Select v-model="clinicalCatalogTypeFilter">
                                        <SelectTrigger id="chargeable-item-create-catalog-type" class="w-full">
                                            <SelectValue placeholder="All catalogs" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All catalogs</SelectItem>
                                            <SelectItem v-for="source in CLINICAL_CATALOG_SOURCES" :key="source.type" :value="source.type">
                                                {{ source.label }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <SearchableSelectField
                                    input-id="chargeable-item-create-clinical-item"
                                    label="Clinical definition"
                                    required
                                    v-model="form.clinicalCatalogItemId"
                                    :options="clinicalCatalogItemOptions"
                                    placeholder="Lab, radiology, theatre, or formulary item"
                                    search-placeholder="Search code or name"
                                    empty-text="No matching clinical definition found."
                                    :error-message="fieldError('clinicalCatalogItemId')"
                                />
                                <div v-if="selectedClinicalCatalogItem" class="rounded-md border bg-muted/30 px-3 py-2">
                                    <p class="truncate text-sm font-medium">{{ selectedClinicalCatalogItem.name || 'Unnamed definition' }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ selectedClinicalCatalogItem.code || 'No code' }}
                                        <span class="text-border"> · </span>
                                        {{ clinicalCatalogGroupLabel(selectedClinicalCatalogItem.catalogType) }}
                                    </p>
                                </div>
                            </TabsContent>

                            <TabsContent value="standalone" class="mt-0 space-y-3">
                                <p class="text-xs text-muted-foreground">For consultations and bed-days, which have no clinical catalog definition.</p>
                                <div class="grid gap-1.5">
                                    <Label for="chargeable-item-create-standalone-type">Catalog type</Label>
                                    <Select v-model="standaloneCatalogType">
                                        <SelectTrigger id="chargeable-item-create-standalone-type" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="option in standaloneCatalogTypeOptions" :key="option.value" :value="option.value">
                                                {{ option.label }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid grid-cols-2 gap-3">
                                    <div class="grid gap-1.5">
                                        <Label for="chargeable-item-create-code">Code</Label>
                                        <Input id="chargeable-item-create-code" v-model="form.code" placeholder="CONSULT-CO-OPD" />
                                        <p v-if="fieldError('code')" class="text-xs text-destructive">{{ fieldError('code') }}</p>
                                    </div>
                                    <div class="grid gap-1.5">
                                        <Label for="chargeable-item-create-name">Name</Label>
                                        <Input id="chargeable-item-create-name" v-model="form.name" placeholder="CO Consultation OPD" />
                                        <p v-if="fieldError('name')" class="text-xs text-destructive">{{ fieldError('name') }}</p>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </fieldset>

                    <fieldset class="grid gap-3 rounded-lg border p-3">
                        <legend class="px-2 text-sm font-medium text-muted-foreground">Price</legend>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="grid gap-1.5">
                                <Label for="chargeable-item-create-charge-model">Charge model</Label>
                                <Select v-model="form.chargeModel">
                                    <SelectTrigger id="chargeable-item-create-charge-model" class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="option in CHARGE_MODEL_OPTIONS" :key="option.value" :value="option.value">
                                            {{ option.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-1.5">
                                <Label for="chargeable-item-create-currency">Currency</Label>
                                <Input id="chargeable-item-create-currency" v-model="form.currencyCode" maxlength="3" class="uppercase" />
                                <p v-if="fieldError('currencyCode')" class="text-xs text-destructive">{{ fieldError('currencyCode') }}</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="grid gap-1.5">
                                <Label for="chargeable-item-create-unit-price">Unit price</Label>
                                <Input id="chargeable-item-create-unit-price" v-model="form.unitPrice" type="number" min="0" step="0.01" />
                                <p v-if="fieldError('unitPrice')" class="text-xs text-destructive">{{ fieldError('unitPrice') }}</p>
                            </div>
                            <div class="grid gap-1.5">
                                <Label for="chargeable-item-create-tax-rate">Tax rate %</Label>
                                <Input id="chargeable-item-create-tax-rate" v-model="form.taxRatePercent" type="number" min="0" max="100" step="0.01" />
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="grid gap-1.5">
                                <Label for="chargeable-item-create-taxable">Taxable</Label>
                                <Select v-model="form.isTaxable">
                                    <SelectTrigger id="chargeable-item-create-taxable" class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="false">No</SelectItem>
                                        <SelectItem value="true">Yes</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-1.5">
                                <Label for="chargeable-item-create-effective-from">Effective from</Label>
                                <Input id="chargeable-item-create-effective-from" v-model="form.effectiveFrom" type="date" />
                            </div>
                        </div>
                    </fieldset>
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    <Badge v-if="create.isPending.value" variant="secondary" class="mr-1">Saving…</Badge>
                    {{ create.isPending.value ? 'Creating…' : 'Create chargeable item' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
