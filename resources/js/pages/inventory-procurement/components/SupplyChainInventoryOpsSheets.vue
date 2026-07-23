<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import CatalogLinkBadge from '@/components/shared/CatalogLinkBadge.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { formatEnumLabel } from '@/lib/labels';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
<Sheet :open="ws.createItemDialogOpen" @update:open="ws.createItemDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                    Create Inventory Item
                </SheetTitle>
                <SheetDescription>Register an item in the catalog with stock policy baseline.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <div
                    v-if="ws.hasCreateItemDraftContent"
                    class="flex flex-col gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                    <div class="min-w-0">
                        <p class="font-medium">{{ ws.restoredCreateItemDraft ? 'Restored item draft' : 'Unsaved item draft' }}</p>
                        <p class="text-muted-foreground">This item draft stays only in this open page until you create it or start fresh.</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" class="h-7 self-start px-2 sm:self-center" @click="ws.discardCreateItemDraft">
                        Start fresh
                    </Button>
                </div>
                <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Start with category</legend>
                    <FormFieldShell
                        input-id="inv-item-category"
                        label="Category"
                        :error-message="ws.fieldError(ws.itemCreateErrors, 'category')"
                    >
                        <Select :model-value="ws.itemCreateForm.category || undefined" @update:model-value="ws.itemCreateForm.category = String($event ?? '')">
                            <SelectTrigger id="inv-item-category" class="w-full" :disabled="ws.itemCreateSubmitting">
                                                            <SelectValue placeholder="Select category first" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="cat in ws.itemCategoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <SearchableSelectField
                        input-id="inv-item-subcategory"
                        label="Subcategory"
                        v-model="ws.itemCreateForm.subcategory"
                        :options="ws.createSubcategoryOptions"
                        placeholder="Select subcategory"
                        search-placeholder="Search category subcategories"
                        empty-text="No matching subcategory. Type a custom value."
                        :disabled="ws.itemCreateSubmitting || !ws.itemCreateForm.category"
                        :allow-custom-value="true"
                        :error-message="ws.fieldError(ws.itemCreateErrors, 'subcategory')"
                    />
                    <p v-if="!ws.selectedCreateCategory" class="text-xs text-muted-foreground sm:col-span-2">
                        Select a category to reveal only the fields that belong to that physical inventory type.
                    </p>
                </fieldset>
                <!-- Basic Information -->
                <fieldset v-if="ws.selectedCreateCategory" class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground flex items-center gap-2">
                        Basic Information
                        <CatalogLinkBadge
                            v-if="ws.createIdentityLockedToCatalog && ws.createSelectedCatalogItem"
                            source="clinical_catalog"
                            :catalog-type="ws.createSelectedCatalogItem.catalogType"
                            :catalog-name="ws.createSelectedCatalogItem.name"
                            :catalog-code="ws.createSelectedCatalogItem.code"
                        />
                    </legend>
                    <div v-if="ws.selectedCreateCategory && ws.createClinicalCatalogOptions.length > 0" class="sm:col-span-2">
                        <SearchableSelectField
                            input-id="inv-item-clinical-catalog"
                            :label="ws.selectedCreateCategory?.supportsMedicineDetails ? 'Clinical medicine' : 'Clinical catalog item'"
                            :model-value="ws.itemCreateForm.clinicalCatalogItemId"
                            :options="ws.createClinicalCatalogOptions"
                            :placeholder="ws.selectedCreateCategory?.supportsMedicineDetails ? 'Select approved medicine' : 'Select linked clinical definition'"
                            search-placeholder="Search Clinical Catalog"
                            empty-text="Create or activate this definition in Clinical Catalog first."
                            :disabled="ws.itemCreateSubmitting"
                            :required="ws.selectedCreateCategory?.supportsMedicineDetails"
                            :error-message="ws.fieldError(ws.itemCreateErrors, 'clinicalCatalogItemId')"
                            @update:model-value="ws.selectClinicalCatalogItem(ws.itemCreateForm, String($event ?? ''))"
                        />
                    </div>
                    <Alert v-else-if="ws.createClinicalCatalogSelectionRequired" class="sm:col-span-2">
                        <AlertTitle>Clinical medicine is required first</AlertTitle>
                        <AlertDescription class="flex flex-wrap items-center gap-2">
                            <span>
                                No active approved medicines are available in the current scope, so this pharmaceutical item cannot be saved yet.
                            </span>
                            <Link href="/platform/admin/clinical-catalogs" class="font-medium text-primary underline underline-offset-4">
                                Open Clinical Catalog
                            </Link>
                        </AlertDescription>
                    </Alert>
                    <p v-if="ws.createIdentityLockedToCatalog" class="sm:col-span-2 text-xs text-muted-foreground">
                        Identity fields are synced from the clinical catalog and cannot be edited here. To change name, code, or dosage details, update the linked clinical definition.
                    </p>
                    <p v-else-if="ws.selectedCreateCategory?.supportsMedicineDetails && ws.createClinicalCatalogOptions.length > 0" class="sm:col-span-2 text-xs text-muted-foreground">
                        Select the approved medicine first. Code, name, strength, dosage form, dispensing unit, and standards codes load from the catalog.
                    </p>
                    <div class="grid gap-2">
                        <Label for="inv-item-code">Item Code</Label>
                        <Input id="inv-item-code" v-model="ws.itemCreateForm.itemCode" :disabled="ws.itemCreateSubmitting || ws.createIdentityLockedToCatalog" :class="ws.createIdentityLockedToCatalog ? 'bg-muted/50' : ''" />
                        <p v-if="ws.createIdentityLockedToCatalog" class="text-[11px] text-muted-foreground">From clinical catalog</p>
                        <p v-else-if="ws.fieldError(ws.itemCreateErrors, 'itemCode')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'itemCode') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-name">Item Name</Label>
                        <Input id="inv-item-name" v-model="ws.itemCreateForm.itemName" :disabled="ws.itemCreateSubmitting || ws.createIdentityLockedToCatalog" :class="ws.createIdentityLockedToCatalog ? 'bg-muted/50' : ''" />
                        <p v-if="ws.createIdentityLockedToCatalog" class="text-[11px] text-muted-foreground">From clinical catalog</p>
                        <p v-else-if="ws.fieldError(ws.itemCreateErrors, 'itemName')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'itemName') }}</p>
                    </div>
                    <FormFieldShell
                        input-id="inv-item-manufacturer"
                        label="Manufacturer"
                        :error-message="ws.fieldError(ws.itemCreateErrors, 'manufacturer')"
                    >
                        <Input id="inv-item-manufacturer" v-model="ws.itemCreateForm.manufacturer" :disabled="ws.itemCreateSubmitting" placeholder="e.g. Pfizer, GSK" />
                    </FormFieldShell>
                    <FormFieldShell
                        input-id="inv-item-barcode"
                        label="Barcode"
                        :error-message="ws.fieldError(ws.itemCreateErrors, 'barcode')"
                    >
                        <Input id="inv-item-barcode" v-model="ws.itemCreateForm.barcode" :disabled="ws.itemCreateSubmitting" placeholder="e.g. 6291234567890" />
                    </FormFieldShell>
                    <Alert v-if="ws.selectedCreateCategory" class="sm:col-span-2">
                        <AlertTitle class="flex flex-wrap items-center gap-2">
                            <span>{{ ws.selectedCreateCategory.label }} workflow</span>
                            <Badge v-for="badge in ws.createCategoryWorkflowBadges" :key="badge" variant="secondary">{{ badge }}</Badge>
                        </AlertTitle>
                        <AlertDescription>{{ ws.selectedCreateCategory.description }}</AlertDescription>
                    </Alert>
                </fieldset>

                <fieldset v-if="ws.selectedCreateCategory?.supportsMedicineDetails" class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Medicine Profile</legend>
                    <div class="grid gap-2">
                        <Label for="inv-item-generic-name">Generic Name</Label>
                        <Input id="inv-item-generic-name" v-model="ws.itemCreateForm.genericName" :disabled="ws.itemCreateSubmitting || ws.createIdentityLockedToCatalog" :class="ws.createIdentityLockedToCatalog ? 'bg-muted/50' : ''" placeholder="e.g. Paracetamol" />
                        <p v-if="ws.createIdentityLockedToCatalog" class="text-[11px] text-muted-foreground">From clinical catalog</p>
                        <p v-else-if="ws.fieldError(ws.itemCreateErrors, 'genericName')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'genericName') }}</p>
                    </div>
                    <ComboboxField
                        input-id="inv-item-dosage-form"
                        label="Dosage Form"
                        v-model="ws.itemCreateForm.dosageForm"
                        :options="ws.DOSAGE_FORM_OPTIONS"
                        placeholder="Select dosage form"
                        search-placeholder="Search tablet, capsule, syrup, injection..."
                        empty-text="No dosage form found."
                        :disabled="ws.itemCreateSubmitting || ws.createIdentityLockedToCatalog"
                        :error-message="ws.fieldError(ws.itemCreateErrors, 'dosageForm')"
                        :reserve-message-space="false"
                    />
                    <div class="grid gap-2">
                        <Label for="inv-item-strength">Strength</Label>
                        <Input id="inv-item-strength" v-model="ws.itemCreateForm.strength" :disabled="ws.itemCreateSubmitting || ws.createIdentityLockedToCatalog" :class="ws.createIdentityLockedToCatalog ? 'bg-muted/50' : ''" placeholder="e.g. 500mg, 250mg/5ml" />
                        <p v-if="ws.createIdentityLockedToCatalog" class="text-[11px] text-muted-foreground">From clinical catalog</p>
                        <p v-else-if="ws.fieldError(ws.itemCreateErrors, 'strength')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'strength') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-dispensing-unit">Dispensing Unit</Label>
                        <Input id="inv-item-dispensing-unit" v-model="ws.itemCreateForm.dispensingUnit" :disabled="ws.itemCreateSubmitting || ws.createIdentityLockedToCatalog" :class="ws.createIdentityLockedToCatalog ? 'bg-muted/50' : ''" placeholder="e.g. Tablet, ml" />
                        <p v-if="ws.createIdentityLockedToCatalog" class="text-[11px] text-muted-foreground">From clinical catalog</p>
                        <p v-else-if="ws.fieldError(ws.itemCreateErrors, 'dispensingUnit')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'dispensingUnit') }}</p>
                    </div>
                    <div class="grid gap-2 sm:col-span-2">
                        <Label for="inv-item-conversion-factor">Conversion Factor</Label>
                        <Input id="inv-item-conversion-factor" v-model="ws.itemCreateForm.conversionFactor" :disabled="ws.itemCreateSubmitting || ws.createIdentityLockedToCatalog" :class="ws.createIdentityLockedToCatalog ? 'bg-muted/50' : ''" type="number" min="0" step="0.001" placeholder="Stock to dispensing conversion" />
                        <p v-if="ws.createIdentityLockedToCatalog" class="text-[11px] text-muted-foreground">From clinical catalog</p>
                        <p v-else-if="ws.fieldError(ws.itemCreateErrors, 'conversionFactor')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'conversionFactor') }}</p>
                    </div>
                </fieldset>

                <fieldset v-if="ws.selectedCreateCategory?.supportsStorageFields || ws.selectedCreateCategory?.controlledSubstanceEligible" class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Handling &amp; Compliance</legend>
                    <div v-if="ws.selectedCreateCategory?.supportsStorageFields" class="grid gap-2 sm:col-span-2">
                        <Label for="inv-item-storage">Storage Conditions</Label>
                        <Select :model-value="ws.toSelectValue(ws.itemCreateForm.storageConditions)" @update:model-value="ws.itemCreateForm.storageConditions = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="inv-item-storage" class="w-full" :disabled="ws.itemCreateSubmitting">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select —</SelectItem>
                            <SelectItem v-for="s in ws.storageConditionOptions" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'storageConditions')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'storageConditions') }}</p>
                    </div>
                    <div v-if="ws.selectedCreateCategory?.supportsStorageFields" class="grid gap-2">
                        <Label>Temperature Handling</Label>
                        <label class="flex items-center gap-2 text-sm pt-2">
                            <Checkbox :checked="ws.itemCreateForm.requiresColdChain" :disabled="ws.itemCreateSubmitting || Boolean(ws.selectedCreateCategory?.requiresColdChain)" @update:checked="ws.itemCreateForm.requiresColdChain = $event" />
                            {{ ws.selectedCreateCategory?.requiresColdChain ? 'Cold chain required for this category' : 'Requires cold chain' }}
                        </label>
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'requiresColdChain')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'requiresColdChain') }}</p>
                    </div>
                    <div v-if="ws.selectedCreateCategory?.controlledSubstanceEligible" class="grid gap-2">
                        <Label>Controlled Substance</Label>
                        <label class="flex items-center gap-2 text-sm pt-2">
                            <Checkbox :checked="ws.itemCreateForm.isControlledSubstance" :disabled="ws.itemCreateSubmitting" @update:checked="ws.itemCreateForm.isControlledSubstance = $event" />
                            Controlled substance stock
                        </label>
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'isControlledSubstance')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'isControlledSubstance') }}</p>
                    </div>
                    <div v-if="ws.itemCreateForm.isControlledSubstance" class="grid gap-2">
                        <Label for="inv-item-schedule">Schedule</Label>
                        <Select :model-value="ws.toSelectValue(ws.itemCreateForm.controlledSubstanceSchedule)" @update:model-value="ws.itemCreateForm.controlledSubstanceSchedule = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="inv-item-schedule" class="w-full" :disabled="ws.itemCreateSubmitting">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select —</SelectItem>
                            <SelectItem v-for="schedule in ws.controlledSubstanceScheduleOptions" :key="schedule.value" :value="schedule.value">{{ schedule.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'controlledSubstanceSchedule')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'controlledSubstanceSchedule') }}</p>
                    </div>
                    <Alert v-if="ws.selectedCreateCategory?.requiresExpiryTracking" class="sm:col-span-2">
                        <AlertTitle>Batch onboarding follows item creation</AlertTitle>
                        <AlertDescription>Save the item first, then record batch or lot, expiry date, supplier, and warehouse on the first receipt.</AlertDescription>
                    </Alert>
                </fieldset>

                <fieldset v-if="ws.selectedCreateCategory" class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Classification &amp; Codes</legend>
                    <div v-if="!ws.selectedCreateCategory || ws.selectedCreateCategory.supportsClinicalClassification" class="grid gap-2">
                        <Label for="inv-item-ven">VEN Classification</Label>
                        <Select :model-value="ws.itemCreateForm.venClassification || undefined" @update:model-value="ws.itemCreateForm.venClassification = String($event ?? '')">
                            <SelectTrigger id="inv-item-ven" class="w-full" :disabled="ws.itemCreateSubmitting">
                                <SelectValue placeholder="Select VEN classification" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="v in ws.venClassificationOptions" :key="v.value" :value="v.value">{{ v.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'venClassification')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'venClassification') }}</p>
                    </div>
                    <div v-if="!ws.selectedCreateCategory || ws.selectedCreateCategory.supportsClinicalClassification" class="grid gap-2">
                        <Label for="inv-item-abc">ABC Classification</Label>
                        <Select :model-value="ws.itemCreateForm.abcClassification || undefined" @update:model-value="ws.itemCreateForm.abcClassification = String($event ?? '')">
                            <SelectTrigger id="inv-item-abc" class="w-full" :disabled="ws.itemCreateSubmitting">
                                <SelectValue placeholder="Select ABC classification" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="a in ws.abcClassificationOptions" :key="a.value" :value="a.value">{{ a.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'abcClassification')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'abcClassification') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-msd">MSD Code</Label>
                        <Input id="inv-item-msd" v-model="ws.itemCreateForm.msdCode" :disabled="ws.itemCreateSubmitting || ws.createIdentityLockedToCatalog" :class="ws.createIdentityLockedToCatalog ? 'bg-muted/50' : ''" placeholder="Medical Stores Department code" />
                        <p v-if="ws.createIdentityLockedToCatalog" class="text-[11px] text-muted-foreground">From clinical catalog</p>
                        <p v-else-if="ws.fieldError(ws.itemCreateErrors, 'msdCode')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'msdCode') }}</p>
                    </div>
                    <div v-if="!ws.selectedCreateCategory || ws.selectedCreateCategory.supportsClinicalClassification" class="grid gap-2">
                        <Label for="inv-item-nhif">NHIF Code</Label>
                        <Input id="inv-item-nhif" v-model="ws.itemCreateForm.nhifCode" :disabled="ws.itemCreateSubmitting || ws.createIdentityLockedToCatalog" :class="ws.createIdentityLockedToCatalog ? 'bg-muted/50' : ''" placeholder="NHIF tariff code" />
                        <p v-if="ws.createIdentityLockedToCatalog" class="text-[11px] text-muted-foreground">From clinical catalog</p>
                        <p v-else-if="ws.fieldError(ws.itemCreateErrors, 'nhifCode')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'nhifCode') }}</p>
                    </div>
                    <p v-if="ws.selectedCreateCategory && !ws.selectedCreateCategory.supportsClinicalClassification" class="sm:col-span-2 text-xs text-muted-foreground">
                        This category uses operational coding only. Clinical classification and NHIF mapping stay hidden.
                    </p>
                </fieldset>

                <fieldset v-if="ws.selectedCreateCategory" class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Stock Policy &amp; Defaults</legend>
                    <div class="grid gap-2">
                        <Label for="inv-item-unit">Stock Unit</Label>
                        <Input id="inv-item-unit" v-model="ws.itemCreateForm.unit" :disabled="ws.itemCreateSubmitting || ws.createIdentityLockedToCatalog" :class="ws.createIdentityLockedToCatalog ? 'bg-muted/50' : ''" placeholder="e.g. Box, Bottle, Piece" />
                        <p v-if="ws.createIdentityLockedToCatalog" class="text-[11px] text-muted-foreground">From clinical catalog</p>
                        <p v-else-if="ws.fieldError(ws.itemCreateErrors, 'unit')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'unit') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-bin-location">Bin Location</Label>
                        <Input id="inv-item-bin-location" v-model="ws.itemCreateForm.binLocation" :disabled="ws.itemCreateSubmitting" placeholder="e.g. A-03-12" />
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'binLocation')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'binLocation') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-default-warehouse">Default Warehouse <span class="text-destructive">*</span></Label>
                        <Popover :open="ws.createItemWarehouseOpen" @update:open="ws.createItemWarehouseOpen = $event">
                            <PopoverTrigger as-child>
                                <Button
                                    id="inv-item-default-warehouse"
                                    type="button"
                                    variant="outline"
                                    :disabled="ws.itemCreateSubmitting"
                                    class="w-full justify-between font-normal"
                                >
                                    <span :class="ws.itemCreateForm.defaultWarehouseId ? '' : 'text-muted-foreground'">
                                        {{ ws.itemCreateForm.defaultWarehouseId ? (ws.warehouseLabel(ws.itemCreateForm.defaultWarehouseId) ?? ws.itemCreateForm.defaultWarehouseId) : '— Select warehouse —' }}
                                    </span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground shrink-0 opacity-50"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent class="w-80 p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search warehouse..." />
                                    <CommandList>
                                        <CommandEmpty>No warehouse found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                v-for="warehouse in ws.warehouses"
                                                :key="warehouse.id"
                                                :value="warehouse.id"
                                                @select="() => { ws.itemCreateForm.defaultWarehouseId = warehouse.id; ws.createItemWarehouseOpen = false }"
                                            >
                                                <AppIcon v-if="ws.itemCreateForm.defaultWarehouseId === warehouse.id" name="circle-check-big" class="mr-2 mt-0.5 size-4 shrink-0 text-primary" />
                                                <span v-else class="mr-2 size-4 shrink-0" />
                                                <span class="flex min-w-0 flex-1 flex-col">
                                                    <span class="truncate">{{ warehouse.name }}</span>
                                                    <span v-if="warehouse.code" class="text-xs text-muted-foreground">{{ warehouse.code }}</span>
                                                </span>
                                            </CommandItem>
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <p class="text-xs text-muted-foreground">Required for stock availability, reservation, consumption, and movement posting.</p>
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'defaultWarehouseId')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'defaultWarehouseId') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-default-supplier">Default Supplier</Label>
                        <Popover :open="ws.createItemSupplierOpen" @update:open="ws.createItemSupplierOpen = $event">
                            <PopoverTrigger as-child>
                                <Button
                                    id="inv-item-default-supplier"
                                    type="button"
                                    variant="outline"
                                    :disabled="ws.itemCreateSubmitting"
                                    class="w-full justify-between font-normal"
                                >
                                    <span :class="ws.itemCreateForm.defaultSupplierId ? '' : 'text-muted-foreground'">
                                        {{ ws.itemCreateForm.defaultSupplierId ? (ws.supplierLabel(ws.itemCreateForm.defaultSupplierId) ?? ws.itemCreateForm.defaultSupplierId) : '— Select supplier —' }}
                                    </span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground shrink-0 opacity-50"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent class="w-80 p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search supplier..." />
                                    <CommandList>
                                        <CommandEmpty>No supplier found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="__none__"
                                                @select="() => { ws.itemCreateForm.defaultSupplierId = ''; ws.createItemSupplierOpen = false }"
                                            >
                                                <span class="text-muted-foreground">— None —</span>
                                            </CommandItem>
                                            <CommandItem
                                                v-for="supplier in ws.suppliers"
                                                :key="supplier.id"
                                                :value="supplier.id"
                                                @select="() => { ws.itemCreateForm.defaultSupplierId = supplier.id; ws.createItemSupplierOpen = false }"
                                            >
                                                <AppIcon v-if="ws.itemCreateForm.defaultSupplierId === supplier.id" name="circle-check-big" class="mr-2 mt-0.5 size-4 shrink-0 text-primary" />
                                                <span v-else class="mr-2 size-4 shrink-0" />
                                                <span class="flex min-w-0 flex-1 flex-col">
                                                    <span class="truncate">{{ supplier.name }}</span>
                                                    <span v-if="supplier.code" class="text-xs text-muted-foreground">{{ supplier.code }}</span>
                                                </span>
                                            </CommandItem>
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'defaultSupplierId')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'defaultSupplierId') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-reorder-level">Reorder Level</Label>
                        <Input id="inv-item-reorder-level" v-model="ws.itemCreateForm.reorderLevel" :disabled="ws.itemCreateSubmitting" type="number" min="0" step="0.001" placeholder="e.g. 100" />
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'reorderLevel')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'reorderLevel') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-item-max-stock-level">Max Stock Level</Label>
                        <Input id="inv-item-max-stock-level" v-model="ws.itemCreateForm.maxStockLevel" :disabled="ws.itemCreateSubmitting" type="number" min="0" step="0.001" placeholder="e.g. 1000" />
                        <p v-if="ws.fieldError(ws.itemCreateErrors, 'maxStockLevel')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemCreateErrors, 'maxStockLevel') }}</p>
                    </div>
                </fieldset>
            </div>
            </ScrollArea>
            <Alert v-if="ws.itemCreateRequestError || ws.itemCreateValidationMessages.length" variant="destructive" class="mx-4 mb-3 shrink-0">
                <AlertTitle>Create item needs attention</AlertTitle>
                <AlertDescription class="space-y-2">
                    <p v-if="ws.itemCreateRequestError">{{ ws.itemCreateRequestError }}</p>
                    <ul v-if="ws.itemCreateValidationMessages.length" class="space-y-1 pl-4 list-disc">
                        <li v-for="message in ws.itemCreateValidationMessages" :key="message" class="text-xs leading-5">
                            {{ message }}
                        </li>
                    </ul>
                </AlertDescription>
            </Alert>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <p v-if="ws.itemCreateSubmitReason && !ws.itemCreateRequestError && ws.itemCreateValidationMessages.length === 0" class="mr-auto text-xs text-muted-foreground">
                    {{ ws.itemCreateSubmitReason }}
                </p>
                <Button type="button" variant="outline" @click="ws.createItemDialogOpen = false">Cancel</Button>
                <Button type="button" :disabled="ws.itemCreateSubmitDisabled" class="gap-1.5" @click="ws.submitCreateItem">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ ws.itemCreateSubmitting ? 'Creating...' : 'Create Item' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.stockMovementDialogOpen" @update:open="ws.stockMovementDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="arrow-up-down" class="size-5 text-muted-foreground" />
                    {{ ws.stockMovementSheetTitle }}
                </SheetTitle>
                <SheetDescription>{{ ws.stockMovementSheetDescription }}</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
                <div class="px-6 py-5 grid gap-6">

                    <!-- Item selection -->
                    <div class="grid gap-4 rounded-lg border p-3">
                        <div class="grid gap-1">
                            <p class="text-sm font-medium">{{ ws.stockMovementOpeningBalanceMode ? 'Opening stock target' : 'Start with category and subcategory' }}</p>
                            <p class="text-xs text-muted-foreground">
                                {{ ws.stockMovementOpeningBalanceMode ? 'This item has no stock ledger yet, so this entry will initialize its day-0 on-hand balance.' : 'Scope the stock record first, then search only within that slice of inventory.' }}
                            </p>
                        </div>
                        <div class="grid gap-3 sm:grid-cols-2">
                            <FormFieldShell
                                input-id="inv-movement-category"
                                label="Category"
                                :error-message="ws.fieldError(ws.stockMovementErrors, 'category')"
                            >
                                <Select :model-value="ws.toSelectValue(ws.stockMovementForm.category)" @update:model-value="ws.stockMovementForm.category = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                    <SelectTrigger id="inv-movement-category" class="w-full" :disabled="ws.stockMovementSubmitting">
                                        <SelectValue placeholder="Select category first" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem :value="ws.EMPTY_SELECT_VALUE">Select category first</SelectItem>
                                        <SelectItem v-for="cat in ws.itemCategoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormFieldShell>
                            <SearchableSelectField
                                input-id="inv-movement-subcategory"
                                label="Subcategory (optional)"
                                v-model="ws.stockMovementForm.subcategory"
                                :options="ws.stockMovementSubcategoryOptions"
                                placeholder="Narrow by subcategory"
                                search-placeholder="Search subcategories"
                                empty-text="No matching subcategory. Leave blank to search the whole category."
                                :disabled="ws.stockMovementSubmitting || !ws.stockMovementForm.category"
                                :allow-custom-value="true"
                            />
                        </div>
                        <div class="grid gap-2">
                            <InventoryItemLookupField
                                input-id="inv-movement-item-id"
                                v-model="ws.stockMovementForm.itemId"
                                label="Item"
                                :placeholder="ws.stockMovementLookupBlockedReason ? 'Select category first' : `Search ${ws.stockMovementCategoryLabel}${ws.stockMovementForm.subcategory ? ` / ${ws.stockMovementSubcategoryLabel}` : ''}`"
                                :helper-text="ws.stockMovementLookupHelperText"
                                :category="ws.stockMovementForm.category || null"
                                :subcategory="ws.stockMovementForm.subcategory || null"
                                :browse-on-focus="true"
                                :disabled="ws.stockMovementSubmitting || Boolean(ws.stockMovementLookupBlockedReason)"
                                :error-message="ws.fieldError(ws.stockMovementErrors, 'itemId')"
                                @selected="ws.handleStockMovementItemSelected"
                            />
                        </div>

                        <Alert v-if="ws.stockMovementLookupBlockedReason" class="border-dashed">
                            <AlertTitle>Choose the stock slice first</AlertTitle>
                            <AlertDescription>{{ ws.stockMovementLookupBlockedReason }}</AlertDescription>
                        </Alert>

                        <!-- Selected item context + stock numbers -->
                        <div v-if="ws.stockMovementItem" class="rounded-lg border bg-muted/20 p-4">
                            <div class="flex flex-wrap items-start justify-between gap-3">
                                <div class="min-w-0 flex-1">
                                    <p class="font-semibold leading-tight">{{ ws.stockMovementItem.itemName || ws.stockMovementItem.itemCode }}</p>
                                    <p class="mt-0.5 text-xs text-muted-foreground">
                                        {{ ws.stockMovementItem.itemCode }}
                                        <template v-if="ws.stockMovementItem.category">&middot; {{ formatEnumLabel(ws.stockMovementItem.category) }}</template>
                                        <template v-if="ws.stockMovementItem.subcategory">&middot; {{ formatEnumLabel(ws.stockMovementItem.subcategory) }}</template>
                                        <template v-if="ws.stockMovementItem.unit">&middot; {{ ws.stockMovementItem.unit }}</template>
                                        <template v-if="ws.stockMovementItem.genericName">&middot; {{ ws.stockMovementItem.genericName }}</template>
                                    </p>
                                </div>
                            <div class="flex shrink-0 gap-1.5">
                                    <Badge v-if="ws.inventoryItemNeedsOpeningStock(ws.stockMovementItem)" variant="outline">Needs opening stock</Badge>
                                    <Badge v-if="ws.stockMovementItem.stockState" :class="ws.stockAlertBadgeClass(ws.stockMovementItem.stockState)">{{ ws.stockStateLabel(ws.stockMovementItem.stockState) }}</Badge>
                                    <Badge v-if="ws.stockMovementItem.status" variant="secondary">{{ formatEnumLabel(ws.stockMovementItem.status) }}</Badge>
                                </div>
                            </div>
                            <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div>
                                    <p class="text-[11px] text-muted-foreground">Store stock</p>
                                    <p class="text-xl font-bold tabular-nums">{{ ws.formatAmount(ws.stockMovementItem.currentStock ?? 0) }}</p>
                                </div>
                                <div>
                                    <p class="text-[11px] text-muted-foreground">Reorder at</p>
                                    <p class="text-xl font-bold tabular-nums text-muted-foreground">{{ ws.formatAmount(ws.stockMovementItem.reorderLevel ?? 0) }}</p>
                                </div>
                                <div>
                                    <p class="text-[11px] text-muted-foreground">Change</p>
                                    <p
                                        class="text-xl font-bold tabular-nums"
                                        :class="{
                                            'text-emerald-600 dark:text-emerald-400': ws.stockMovementSignedDelta !== null && ws.stockMovementSignedDelta > 0,
                                            'text-rose-600 dark:text-rose-400': ws.stockMovementSignedDelta !== null && ws.stockMovementSignedDelta < 0,
                                            'text-muted-foreground': ws.stockMovementSignedDelta === null,
                                        }"
                                    >{{ ws.stockMovementSignedDelta === null ? '—' : `${ws.stockMovementSignedDelta > 0 ? '+' : ''}${ws.formatAmount(ws.stockMovementSignedDelta)}` }}</p>
                                </div>
                                <div>
                                    <p class="text-[11px] text-muted-foreground">Projected</p>
                                    <p
                                        class="text-xl font-bold tabular-nums"
                                        :class="ws.stockMovementProjectedNegative ? 'text-rose-600 dark:text-rose-400' : ''"
                                    >{{ ws.stockMovementProjectedStock === null ? '—' : ws.formatAmount(ws.stockMovementProjectedStock) }}</p>
                                    <Badge v-if="ws.stockMovementProjectedState" :class="ws.stockAlertBadgeClass(ws.stockMovementProjectedState)" class="mt-1">{{ formatEnumLabel(ws.stockMovementProjectedState) }}</Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <!-- Movement type -->
                    <Alert v-if="ws.stockMovementOpeningBalanceMode" class="border-dashed">
                        <AlertTitle>Opening balance mode</AlertTitle>
                        <AlertDescription>
                            The system will post this as a stock receipt for setup only. It will not create a purchase, supplier expense, or department requisition.
                        </AlertDescription>
                    </Alert>

                    <div v-else class="grid gap-3">
                        <Label>Movement Type</Label>
                        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <button
                                v-for="opt in ws.movementTypeOptions"
                                :key="`stock-movement-type-${opt}`"
                                type="button"
                                class="rounded-lg border px-3 py-2.5 text-center text-sm font-medium transition-colors"
                                :class="ws.stockMovementForm.movementType === opt
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'"
                                @click="ws.stockMovementForm.movementType = opt"
                            >
                                {{ ws.stockMovementTypeMeta[opt].label }}
                            </button>
                        </div>
                        <div class="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                            <Badge variant="outline" class="shrink-0 mt-0.5">{{ ws.selectedStockMovementTypeMeta.impact }}</Badge>
                            <p class="text-muted-foreground">{{ ws.selectedStockMovementTypeMeta.description }}</p>
                        </div>
                        <p v-if="ws.fieldError(ws.stockMovementErrors, 'movementType')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'movementType') }}</p>
                    </div>

                    <template v-if="ws.stockMovementItem">

                    <!-- Quantity, direction & timing -->
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="inv-movement-quantity">Quantity *</Label>
                            <div class="relative">
                                <Input id="inv-movement-quantity" v-model="ws.stockMovementForm.quantity" :disabled="ws.stockMovementSubmitting" type="number" min="0.001" step="0.001" class="pr-14" />
                                <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{{ ws.stockMovementUnitLabel }}</span>
                            </div>
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'quantity')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'quantity') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="inv-movement-occurred-at">Occurred At</Label>
                            <Input id="inv-movement-occurred-at" v-model="ws.stockMovementForm.occurredAt" :disabled="ws.stockMovementSubmitting" type="datetime-local" />
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'occurredAt')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'occurredAt') }}</p>
                        </div>
                        <div v-if="ws.requiresAdjustmentDirection" class="grid gap-2 sm:col-span-2">
                            <Label>Adjustment Direction</Label>
                            <div class="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                                    :class="ws.stockMovementForm.adjustmentDirection === 'increase' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'border-border hover:bg-muted/50'"
                                    @click="ws.stockMovementForm.adjustmentDirection = 'increase'"
                                >+ Increase stock</button>
                                <button
                                    type="button"
                                    class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                                    :class="ws.stockMovementForm.adjustmentDirection === 'decrease' ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'border-border hover:bg-muted/50'"
                                    @click="ws.stockMovementForm.adjustmentDirection = 'decrease'"
                                >− Decrease stock</button>
                            </div>
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'adjustmentDirection')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'adjustmentDirection') }}</p>
                        </div>
                    </div>

                    <!-- Source & Destination — connected to real system entities -->
                    <!-- RECEIVE: Supplier → Warehouse -->
                    <div v-if="ws.stockMovementForm.movementType === 'receive'" class="grid gap-4 sm:grid-cols-2">
                        <div v-if="!ws.stockMovementOpeningBalanceMode" class="grid gap-2">
                            <Label for="inv-movement-source-supplier">Supplier (Source) <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="ws.toSelectValue(ws.stockMovementForm.sourceSupplierId)" @update:model-value="ws.stockMovementForm.sourceSupplierId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                <SelectTrigger id="inv-movement-source-supplier" class="w-full" :disabled="ws.stockMovementSubmitting">
                                    <SelectValue placeholder="— Select supplier —">
                                        {{ ws.supplierLabel(ws.stockMovementForm.sourceSupplierId) }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select supplier —</SelectItem>
                                <SelectItem v-for="s in ws.suppliers" :key="s.id" :value="s.id" :text-value="ws.lookupOptionText(s)">
                                    {{ s.name }}<template v-if="s.code"> ({{ s.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'sourceSupplierId')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'sourceSupplierId') }}</p>
                        </div>
                        <div class="grid gap-2" :class="ws.stockMovementOpeningBalanceMode ? 'sm:col-span-2' : ''">
                            <Label for="inv-movement-dest-warehouse">{{ ws.stockMovementOpeningBalanceMode ? 'Counted Into - Warehouse' : 'Stored In - Warehouse (Destination)' }} <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="ws.toSelectValue(ws.stockMovementForm.destinationWarehouseId)" @update:model-value="ws.stockMovementForm.destinationWarehouseId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                <SelectTrigger id="inv-movement-dest-warehouse" class="w-full" :disabled="ws.stockMovementSubmitting">
                                    <SelectValue placeholder="— Select warehouse —">
                                        {{ ws.warehouseLabel(ws.stockMovementForm.destinationWarehouseId) }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select warehouse —</SelectItem>
                                <SelectItem v-for="w in ws.warehouses" :key="w.id" :value="w.id" :text-value="ws.lookupOptionText(w)">
                                    {{ w.name }}<template v-if="w.code"> ({{ w.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'destinationWarehouseId')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'destinationWarehouseId') }}</p>
                        </div>
                    </div>

                    <!-- ISSUE: Warehouse → Department -->
                    <div v-else-if="ws.stockMovementForm.movementType === 'issue'" class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="inv-movement-src-warehouse-issue">Issued From — Warehouse (Source) <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="ws.toSelectValue(ws.stockMovementForm.sourceWarehouseId)" @update:model-value="ws.stockMovementForm.sourceWarehouseId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                <SelectTrigger id="inv-movement-src-warehouse-issue" class="w-full" :disabled="ws.stockMovementSubmitting">
                                    <SelectValue placeholder="— Select warehouse —">
                                        {{ ws.warehouseLabel(ws.stockMovementForm.sourceWarehouseId) }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select warehouse —</SelectItem>
                                <SelectItem v-for="w in ws.warehouses" :key="w.id" :value="w.id" :text-value="ws.lookupOptionText(w)">
                                    {{ w.name }}<template v-if="w.code"> ({{ w.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'sourceWarehouseId')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'sourceWarehouseId') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="inv-movement-dest-dept">Issued To — Department (Destination) <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="ws.toSelectValue(ws.stockMovementForm.destinationDepartmentId)" @update:model-value="ws.stockMovementForm.destinationDepartmentId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                <SelectTrigger id="inv-movement-dest-dept" class="w-full" :disabled="ws.stockMovementSubmitting">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select department —</SelectItem>
                                <SelectItem v-for="d in ws.departments" :key="d.id" :value="d.id">
                                    {{ d.name }}<template v-if="d.code"> ({{ d.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'destinationDepartmentId')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'destinationDepartmentId') }}</p>
                        </div>
                    </div>

                    <!-- TRANSFER: Warehouse → Warehouse -->
                    <div v-else-if="ws.stockMovementForm.movementType === 'transfer'" class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="inv-movement-src-warehouse-transfer">Transfer From — Warehouse (Source) <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="ws.toSelectValue(ws.stockMovementForm.sourceWarehouseId)" @update:model-value="ws.stockMovementForm.sourceWarehouseId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                <SelectTrigger id="inv-movement-src-warehouse-transfer" class="w-full" :disabled="ws.stockMovementSubmitting">
                                    <SelectValue placeholder="— Select warehouse —">
                                        {{ ws.warehouseLabel(ws.stockMovementForm.sourceWarehouseId) }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select warehouse —</SelectItem>
                                <SelectItem v-for="w in ws.warehouses" :key="w.id" :value="w.id" :text-value="ws.lookupOptionText(w)">
                                    {{ w.name }}<template v-if="w.code"> ({{ w.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'sourceWarehouseId')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'sourceWarehouseId') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="inv-movement-dest-warehouse-transfer">Transfer To — Warehouse (Destination) <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Select :model-value="ws.toSelectValue(ws.stockMovementForm.destinationWarehouseId)" @update:model-value="ws.stockMovementForm.destinationWarehouseId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                <SelectTrigger id="inv-movement-dest-warehouse-transfer" class="w-full" :disabled="ws.stockMovementSubmitting">
                                    <SelectValue placeholder="— Select warehouse —">
                                        {{ ws.warehouseLabel(ws.stockMovementForm.destinationWarehouseId) }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select warehouse —</SelectItem>
                                <SelectItem v-for="w in ws.warehouses" :key="w.id" :value="w.id" :text-value="ws.lookupOptionText(w)">
                                    {{ w.name }}<template v-if="w.code"> ({{ w.code }})</template>
                                </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'destinationWarehouseId')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'destinationWarehouseId') }}</p>
                        </div>
                    </div>

                    <div v-if="ws.stockMovementRequiresBatchSelection" class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2 sm:col-span-2">
                            <Label for="inv-movement-batch-id">Batch *</Label>
                            <Select :model-value="ws.toSelectValue(ws.stockMovementForm.batchId)" @update:model-value="ws.stockMovementForm.batchId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                <SelectTrigger id="inv-movement-batch-id" class="w-full" :disabled="ws.stockMovementSubmitting || ws.stockMovementBatchesLoading">
                                    <SelectValue placeholder="— Select batch —">
                                        {{ ws.selectedStockMovementBatch ? ws.batchOptionLabel(ws.selectedStockMovementBatch) : '' }}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select batch —</SelectItem>
                                    <SelectItem
                                        v-for="batch in ws.stockMovementFilteredBatches"
                                        :key="batch.id"
                                        :value="batch.id"
                                        :text-value="batch.batchNumber ?? batch.id"
                                    >
                                        {{ ws.batchOptionLabel(batch) }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="ws.stockMovementBatchesLoading" class="text-xs text-muted-foreground">Loading tracked batches...</p>
                            <p v-else-if="ws.stockMovementFilteredBatches.length === 0" class="text-xs text-muted-foreground">No eligible batches were found for this item and warehouse.</p>
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'batchId')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'batchId') }}</p>
                        </div>
                    </div>

                    <div v-else-if="ws.stockMovementRequiresBatchReceiptFields" class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="inv-movement-batch-number">Batch Number *</Label>
                            <Input id="inv-movement-batch-number" v-model="ws.stockMovementForm.batchNumber" :disabled="ws.stockMovementSubmitting" placeholder="Supplier batch number" />
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'batchNumber')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'batchNumber') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="inv-movement-lot-number">Lot Number</Label>
                            <Input id="inv-movement-lot-number" v-model="ws.stockMovementForm.lotNumber" :disabled="ws.stockMovementSubmitting" placeholder="Optional lot number" />
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'lotNumber')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'lotNumber') }}</p>
                        </div>
                        <SingleDatePopoverField
                            input-id="inv-movement-manufacture-date"
                            label="Manufacture Date"
                            v-model="ws.stockMovementForm.manufactureDate"
                            :disabled="ws.stockMovementSubmitting"
                            :error-message="ws.fieldError(ws.stockMovementErrors, 'manufactureDate')"
                        />
                        <SingleDatePopoverField
                            input-id="inv-movement-expiry-date"
                            label="Expiry Date"
                            v-model="ws.stockMovementForm.expiryDate"
                            :disabled="ws.stockMovementSubmitting"
                            :error-message="ws.fieldError(ws.stockMovementErrors, 'expiryDate')"
                        />
                        <div class="grid gap-2 sm:col-span-2">
                            <Label for="inv-movement-bin-location">Bin Location</Label>
                            <Input id="inv-movement-bin-location" v-model="ws.stockMovementForm.binLocation" :disabled="ws.stockMovementSubmitting" placeholder="Shelf, rack, or fridge position" />
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'binLocation')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'binLocation') }}</p>
                        </div>
                    </div>

                    <!-- Reason & notes -->
                    <div class="grid gap-4">
                        <div class="grid gap-2">
                            <Label for="inv-movement-reason">
                                Reason
                                <span v-if="ws.stockMovementReasonRequired" class="ml-1 text-xs text-destructive font-normal">* required</span>
                                <span v-else class="ml-1 text-xs text-muted-foreground font-normal">optional</span>
                            </Label>
                            <template v-if="ws.stockMovementOpeningBalanceMode">
                                <Select v-model="ws.stockMovementForm.reasonCode" :disabled="ws.stockMovementSubmitting">
                                    <SelectTrigger id="inv-movement-reason" class="w-full">
                                        <SelectValue placeholder="Select a reason" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem v-for="opt in ws.stockMovementReasonOptions" :key="opt.value" :value="opt.value">
                                            {{ opt.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </template>
                            <template v-else>
                                <Input
                                    id="inv-movement-reason"
                                    v-model="ws.stockMovementForm.reason"
                                    :disabled="ws.stockMovementSubmitting"
                                    :placeholder="ws.stockMovementReasonPlaceholder"
                                />
                            </template>
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'reason')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'reason') }}</p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="inv-movement-notes">Notes <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Textarea id="inv-movement-notes" v-model="ws.stockMovementForm.notes" :disabled="ws.stockMovementSubmitting" rows="3" placeholder="Batch reference, delivery note number, or handover context." />
                            <p v-if="ws.fieldError(ws.stockMovementErrors, 'notes')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockMovementErrors, 'notes') }}</p>
                        </div>
                    </div>

                    <!-- Alerts -->
                    <Alert v-if="ws.stockMovementProjectedNegative" variant="destructive">
                        <AlertTitle>Would go negative</AlertTitle>
                        <AlertDescription>Reduce quantity or receive stock first.</AlertDescription>
                    </Alert>

                    <Alert v-else-if="ws.stockMovementForm.movementType === 'transfer'" class="text-sm">
                        <AlertTitle>Transfer-out only</AlertTitle>
                        <AlertDescription>Decreases this store's stock. Use Warehouse Transfer for an approval trail.</AlertDescription>
                    </Alert>
                    </template>

                    <Alert v-else-if="!ws.stockMovementLookupBlockedReason" class="border-dashed">
                        <AlertTitle>Select an inventory item to continue</AlertTitle>
                        <AlertDescription>
                            Quantity, source and destination routing, batch handling, and notes appear after you choose a category and item.
                        </AlertDescription>
                    </Alert>

                </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.stockMovementDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.stockMovementSubmitDisabled" class="gap-1.5" @click="ws.submitStockMovement">
                    <AppIcon name="arrow-up-down" class="size-3.5" />
                    {{ ws.stockMovementSubmitting ? 'Saving...' : ws.stockMovementSubmitLabel }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.stockMovementCorrectionDialogOpen" @update:open="ws.stockMovementCorrectionDialogOpen = $event">
    <SheetContent side="right" variant="form" size="2xl">
        <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
            <SheetTitle class="flex items-center gap-2">
                <AppIcon name="pencil" class="size-5 text-muted-foreground" />
                Correct Opening Stock
            </SheetTitle>
            <SheetDescription>Adjust the opening balance for this item. A reversal entry will be created and a new corrected movement will replace it.</SheetDescription>
        </SheetHeader>
        <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-5 grid gap-6">
                <div v-if="ws.stockMovementCorrectionMovement" class="rounded-lg border bg-muted/20 p-4">
                    <p class="text-sm font-semibold">
                        {{ ws.stockMovementCorrectionItem?.itemName || ws.stockMovementCorrectionItem?.itemCode || 'Item' }}
                    </p>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                        Current opening stock quantity:
                        <span class="font-semibold text-foreground">{{ ws.formatAmount(ws.stockMovementCorrectionMovement.quantity) }}</span>
                        <template v-if="ws.stockMovementCorrectionItem?.unit">
                            {{ ws.stockMovementCorrectionItem.unit }}
                        </template>
                    </p>
                    <p v-if="ws.stockMovementCorrectionMovement.reason" class="mt-0.5 text-xs text-muted-foreground">
                        Reason: {{ ws.stockMovementCorrectionMovement.reason }}
                    </p>
                </div>

                <div class="grid gap-2">
                    <Label for="inv-correction-quantity">
                        Corrected Quantity *
                    </Label>
                    <div class="relative">
                        <Input
                            id="inv-correction-quantity"
                            v-model="ws.stockMovementCorrectionForm.quantity"
                            :disabled="ws.stockMovementCorrectionSubmitting"
                            type="number"
                            min="0.001"
                            step="0.001"
                            class="pr-14"
                        />
                        <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                            {{ ws.stockMovementCorrectionItem?.unit || 'units' }}
                        </span>
                    </div>
                    <p v-if="ws.fieldError(ws.stockMovementCorrectionErrors, 'quantity')" class="text-xs text-destructive">
                        {{ ws.fieldError(ws.stockMovementCorrectionErrors, 'quantity') }}
                    </p>
                </div>

                <div class="grid gap-2">
                    <Label for="inv-correction-reason">
                        Correction Reason *
                    </Label>
                    <Select v-model="ws.stockMovementCorrectionForm.reasonCode" :disabled="ws.stockMovementCorrectionSubmitting">
                        <SelectTrigger id="inv-correction-reason" class="w-full">
                            <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="opt in ws.correctionReasonOptions" :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        id="inv-correction-reason-detail"
                        v-model="ws.stockMovementCorrectionForm.reason"
                        :disabled="ws.stockMovementCorrectionSubmitting"
                        placeholder="Optional additional detail"
                        aria-label="Correction reason additional detail"
                        class="mt-2"
                    />
                    <p v-if="ws.fieldError(ws.stockMovementCorrectionErrors, 'reason')" class="text-xs text-destructive">
                        {{ ws.fieldError(ws.stockMovementCorrectionErrors, 'reason') }}
                    </p>
                </div>

                <Alert>
                    <AlertTitle>Audit trail</AlertTitle>
                    <AlertDescription>
                        The current opening stock entry will be marked as superseded. A reversal adjustment
                        will be created, followed by a new corrected opening stock entry. Both will appear
                        in the stock ledger.
                    </AlertDescription>
                </Alert>
            </div>
        </ScrollArea>
        <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
            <Button variant="outline" @click="ws.stockMovementCorrectionDialogOpen = false">Cancel</Button>
            <Button
                :disabled="ws.stockMovementCorrectionSubmitting || !ws.stockMovementCorrectionForm.quantity"
                class="gap-1.5"
                @click="ws.submitStockMovementCorrection"
            >
                <AppIcon name="pencil" class="size-3.5" />
                {{ ws.stockMovementCorrectionSubmitting ? 'Saving...' : 'Correct Opening Stock' }}
            </Button>
        </SheetFooter>
    </SheetContent>
</Sheet>

<Sheet :open="ws.reconcileDialogOpen" @update:open="ws.reconcileDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="shield-check" class="size-5 text-muted-foreground" />
                    Reconcile Stock Count
                </SheetTitle>
                <SheetDescription>Record physical count variance and automatically post a balanced stock adjustment entry.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-3 sm:grid-cols-2">
                <div class="grid gap-2 sm:col-span-2">
                    <InventoryItemLookupField
                        input-id="inv-reconcile-item-id"
                        v-model="ws.stockReconciliationForm.itemId"
                        label="Item"
                        placeholder="Search by name, code, or barcode"
                        :disabled="ws.stockReconciliationSubmitting"
                        :error-message="ws.fieldError(ws.stockReconciliationErrors, 'itemId')"
                        @selected="ws.handleStockReconciliationItemSelected"
                    />
                </div>
                <div v-if="ws.stockReconciliationUsesBatchTracking" class="grid gap-2">
                    <Label for="inv-reconcile-batch-id">Batch *</Label>
                    <Select :model-value="ws.toSelectValue(ws.stockReconciliationForm.batchId)" @update:model-value="ws.stockReconciliationForm.batchId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                        <SelectTrigger id="inv-reconcile-batch-id" class="w-full" :disabled="ws.stockReconciliationSubmitting || ws.stockReconciliationBatchesLoading">
                            <SelectValue placeholder="— Select batch —">
                                {{ ws.selectedStockReconciliationBatch ? ws.batchOptionLabel(ws.selectedStockReconciliationBatch) : '' }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select batch —</SelectItem>
                            <SelectItem
                                v-for="batch in ws.stockReconciliationBatchOptions"
                                :key="batch.id"
                                :value="batch.id"
                                :text-value="batch.batchNumber ?? batch.id"
                            >
                                {{ ws.batchOptionLabel(batch) }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="ws.stockReconciliationBatchesLoading" class="text-xs text-muted-foreground">Loading tracked batches...</p>
                    <p v-else-if="ws.stockReconciliationBatchOptions.length === 0" class="text-xs text-muted-foreground">No tracked batches are recorded for this item yet.</p>
                    <p v-if="ws.fieldError(ws.stockReconciliationErrors, 'batchId')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockReconciliationErrors, 'batchId') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label :for="ws.stockReconciliationUsesBatchTracking ? 'inv-reconcile-counted-batch-stock' : 'inv-reconcile-counted-stock'">
                        {{ ws.stockReconciliationUsesBatchTracking ? 'Counted Batch Quantity' : 'Counted Stock' }}
                    </Label>
                    <Input
                        v-if="ws.stockReconciliationUsesBatchTracking"
                        id="inv-reconcile-counted-batch-stock"
                        v-model="ws.stockReconciliationForm.countedBatchQuantity"
                        :disabled="ws.stockReconciliationSubmitting"
                        type="number"
                        min="0"
                        step="0.001"
                    />
                    <Input
                        v-else
                        id="inv-reconcile-counted-stock"
                        v-model="ws.stockReconciliationForm.countedStock"
                        :disabled="ws.stockReconciliationSubmitting"
                        type="number"
                        min="0"
                        step="0.001"
                    />
                    <p v-if="ws.fieldError(ws.stockReconciliationErrors, ws.stockReconciliationUsesBatchTracking ? 'countedBatchQuantity' : 'countedStock')" class="text-xs text-destructive">
                        {{ ws.fieldError(ws.stockReconciliationErrors, ws.stockReconciliationUsesBatchTracking ? 'countedBatchQuantity' : 'countedStock') }}
                    </p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-reconcile-session-reference">Session Reference</Label>
                    <Input id="inv-reconcile-session-reference" v-model="ws.stockReconciliationForm.sessionReference" :disabled="ws.stockReconciliationSubmitting" placeholder="Cycle count batch or sheet no." />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-reconcile-reason">Reason</Label>
                    <Input id="inv-reconcile-reason" v-model="ws.stockReconciliationForm.reason" :disabled="ws.stockReconciliationSubmitting" placeholder="Physical stock count variance" />
                    <p v-if="ws.fieldError(ws.stockReconciliationErrors, 'reason')" class="text-xs text-destructive">{{ ws.fieldError(ws.stockReconciliationErrors, 'reason') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-reconcile-occurred-at">Occurred At</Label>
                    <Input id="inv-reconcile-occurred-at" v-model="ws.stockReconciliationForm.occurredAt" :disabled="ws.stockReconciliationSubmitting" type="datetime-local" />
                </div>
                <div class="grid gap-2 sm:col-span-2">
                    <Label for="inv-reconcile-notes">Notes</Label>
                    <Textarea id="inv-reconcile-notes" v-model="ws.stockReconciliationForm.notes" :disabled="ws.stockReconciliationSubmitting" rows="3" />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.reconcileDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.stockReconciliationSubmitDisabled" class="gap-1.5" @click="ws.submitStockReconciliation">
                    <AppIcon name="shield-check" class="size-3.5" />
                    {{ ws.stockReconciliationSubmitting ? 'Saving...' : 'Record Reconciliation' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>


