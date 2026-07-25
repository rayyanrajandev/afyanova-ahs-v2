<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCreateChargeableItem } from '@/composables/chargeableItems/useCreateChargeableItem';
import type { ChargeableItem } from '@/composables/chargeableItems/useChargeableItems';
import { useServiceCatalogClinicalCatalogOptions } from '@/composables/serviceCatalogIndex/useServiceCatalogClinicalCatalogOptions';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import { CLINICAL_CATALOG_SOURCES, clinicalCatalogGroupLabel, type ClinicalCatalogType } from '@/lib/billingServiceCatalog';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';
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

const identitySource = ref<'clinical' | 'standalone' | null>(null);
const clinicalCatalogTypeFilter = ref<ClinicalCatalogType | 'all'>('all');
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const createAnother = ref(false);

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
    category: '',
    defaultUnit: '',
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

const catalogType = computed(() => {
    if (identitySource.value === 'standalone') return standaloneCatalogType.value;
    if (identitySource.value === 'clinical') return clinicalCatalogTypeFilter.value;
    return 'all';
});

function chooseIdentitySource(source: 'clinical' | 'standalone'): void {
    identitySource.value = source;
}

function changeIdentitySource(): void {
    identitySource.value = null;
}

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
    identitySource.value = null;
    clinicalCatalogTypeFilter.value = 'all';
    standaloneCatalogType.value = 'consultation';
    form.clinicalCatalogItemId = '';
    form.code = '';
    form.name = '';
    form.category = '';
    form.defaultUnit = '';
    form.chargeModel = 'flat';
    form.currencyCode = defaultCurrencyCode.value;
    form.unitPrice = '';
    form.taxRatePercent = '';
    form.isTaxable = 'false';
    form.effectiveFrom = '';
    createAnother.value = false;
    submitError.value = null;
    fieldErrors.value = {};
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

/**
 * Keeps the sheet open after a successful create so admins can batch-add
 * several items without re-opening it each time. Clears only the
 * per-item identity/price fields -- catalog type, charge model, currency,
 * and taxable stay put since a batch is usually the same shape repeated.
 */
function resetFormForAnotherItem(): void {
    form.clinicalCatalogItemId = '';
    form.code = '';
    form.name = '';
    form.category = '';
    form.defaultUnit = '';
    form.unitPrice = '';
    form.taxRatePercent = '';
    form.effectiveFrom = '';
    fieldErrors.value = {};
}

const canSubmit = computed(() => {
    if (!identitySource.value) return false;
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
            category: form.category.trim() || null,
            defaultUnit: form.defaultUnit.trim() || null,
            currencyCode: form.currencyCode.trim().toUpperCase(),
            unitPrice: Number.parseFloat(String(form.unitPrice)),
            taxRatePercent: String(form.taxRatePercent).trim() ? Number.parseFloat(String(form.taxRatePercent)) : null,
            isTaxable: form.isTaxable === 'true',
            effectiveFrom: form.effectiveFrom.trim() || null,
        });
        emit('created', item);
        if (createAnother.value) {
            notifySuccess(`Created ${item.code || item.name}. Add another below.`);
            resetFormForAnotherItem();
        } else {
            open.value = false;
        }
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

                    <div v-if="!identitySource" class="grid gap-3">
                        <p class="text-sm font-medium text-foreground">How would you like to create this item?</p>
                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                class="group flex flex-col items-start gap-2.5 rounded-lg border-2 border-border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
                                @click="chooseIdentitySource('clinical')"
                            >
                                <span class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                                    <AppIcon name="book-open" class="size-5" />
                                </span>
                                <span class="text-sm font-semibold">From Catalog</span>
                                <span class="text-xs text-muted-foreground">Link an existing lab, radiology, theatre, procedure, or formulary definition.</span>
                            </button>
                            <button
                                type="button"
                                class="group flex flex-col items-start gap-2.5 rounded-lg border-2 border-border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
                                @click="chooseIdentitySource('standalone')"
                            >
                                <span class="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                                    <AppIcon name="tag" class="size-5" />
                                </span>
                                <span class="text-sm font-semibold">Standalone</span>
                                <span class="text-xs text-muted-foreground">Create a custom item for consultations or bed-days with no clinical catalog definition.</span>
                            </button>
                        </div>
                    </div>

                    <div v-else class="grid gap-4">
                        <div class="flex items-center justify-between">
                            <Button type="button" variant="outline" size="sm" class="h-8 gap-1.5 text-xs" @click="changeIdentitySource">
                                <AppIcon name="chevron-left" class="size-3.5" />
                                Change type
                            </Button>
                            <Badge variant="outline" class="gap-1.5">
                                <AppIcon :name="identitySource === 'clinical' ? 'book-open' : 'tag'" class="size-3" />
                                {{ identitySource === 'clinical' ? 'From Catalog' : 'Standalone' }}
                            </Badge>
                        </div>

                        <fieldset class="grid gap-3 rounded-lg border p-3">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Create billing item</legend>

                            <template v-if="identitySource === 'clinical'">
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
                            </template>

                            <template v-else>
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
                            </template>

                            <div class="grid grid-cols-2 gap-3">
                                <div class="grid gap-1.5">
                                    <Label for="chargeable-item-create-category">Category <span class="text-muted-foreground">(optional)</span></Label>
                                    <Input id="chargeable-item-create-category" v-model="form.category" placeholder="e.g. General, Specialist" />
                                    <p v-if="fieldError('category')" class="text-xs text-destructive">{{ fieldError('category') }}</p>
                                </div>
                                <div class="grid gap-1.5">
                                    <Label for="chargeable-item-create-default-unit">Default unit <span class="text-muted-foreground">(optional)</span></Label>
                                    <Input id="chargeable-item-create-default-unit" v-model="form.defaultUnit" placeholder="e.g. visit, day, test" />
                                    <p v-if="fieldError('defaultUnit')" class="text-xs text-destructive">{{ fieldError('defaultUnit') }}</p>
                                </div>
                            </div>
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
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 flex-row items-center justify-between border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <label v-if="identitySource" class="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox v-model="createAnother" />
                    Create another after saving
                </label>
                <div v-else />
                <div class="flex items-center gap-2">
                    <Button variant="outline" @click="open = false">Cancel</Button>
                    <Button :disabled="!canSubmit" @click="submit">
                        <Badge v-if="create.isPending.value" variant="secondary" class="mr-1">Saving…</Badge>
                        {{ create.isPending.value ? 'Creating…' : createAnother ? 'Create & add another' : 'Create chargeable item' }}
                    </Button>
                </div>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
