<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { formatEnumLabel } from '@/lib/labels';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
    <Sheet :open="ws.itemDetailsOpen" @update:open="(open) => ws.requestItemDetailsOpenChange(open)">
        <SheetContent side="right" variant="workspace" size="3xl" class="flex h-full min-h-0 flex-col">
            <SheetHeader class="shrink-0 border-b px-6 py-3 text-left pr-12">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 space-y-1">
                        <SheetTitle class="flex min-w-0 items-center gap-2 text-base">
                            <AppIcon name="package" class="size-4 shrink-0 text-muted-foreground" />
                            <span class="min-w-0 truncate">{{ ws.itemDetails?.itemName || 'Inventory item details' }}</span>
                        </SheetTitle>
                        <SheetDescription class="flex items-center gap-1.5 text-xs">
                            <span>{{ ws.itemDetails?.itemCode || 'No code' }}</span>
                            <span>·</span>
                            <span>{{ ws.itemDetails?.category ? formatEnumLabel(ws.itemDetails.category) : 'No category' }}</span>
                            <span>·</span>
                            <span>{{ ws.itemDetails?.unit || 'No unit' }}</span>
                        </SheetDescription>
                    </div>
                    <div class="flex shrink-0 items-center gap-1.5">
                        <Badge v-if="ws.itemDetailsLoading" variant="secondary" class="gap-1.5">
                            <AppIcon name="loader-circle" class="size-3 animate-spin" />
                        </Badge>
                        <Badge v-if="ws.itemDetails?.clinicalCatalogItemId" variant="default" class="gap-1">
                            <AppIcon name="check-circle" class="size-3" />
                            Catalog
                        </Badge>
                        <Badge v-else variant="outline">Manual</Badge>
                        <Badge v-if="ws.itemDetails?.stockState" variant="secondary" class="capitalize">
                            {{ ws.stockStateLabel(ws.itemDetails.stockState) }}
                        </Badge>
                    </div>
                </div>
            </SheetHeader>
            <template v-if="ws.itemDetailsLoading">
                <div class="space-y-4 p-6">
                    <div class="grid gap-3 sm:grid-cols-3">
                        <div v-for="i in 3" :key="i" class="rounded-lg border bg-background/70 px-4 py-3">
                            <Skeleton class="h-3 w-24" />
                            <Skeleton class="mt-2 h-5 w-32" />
                            <Skeleton class="mt-1.5 h-3 w-20" />
                        </div>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div v-for="i in 6" :key="i" class="rounded-lg border bg-background/70 px-3 py-2.5">
                            <Skeleton class="h-3 w-20" />
                            <Skeleton class="mt-1 h-4 w-40" />
                            <Skeleton class="mt-1 h-3 w-28" />
                        </div>
                    </div>
                </div>
            </template>
            <Alert v-else-if="ws.itemDetailsError" variant="destructive" class="m-4">
                <AlertTitle>Item load failed</AlertTitle>
                <AlertDescription>{{ ws.itemDetailsError }}</AlertDescription>
            </Alert>
            <Tabs
                v-else-if="ws.itemDetails"
                :model-value="ws.itemDetailsTab"
                class="flex min-h-0 flex-1 flex-col"
                @update:model-value="(v) => (ws.itemDetailsTab = String(v))"
            >
                <TabsList class="mx-6 mt-3 grid w-auto grid-cols-2">
                    <TabsTrigger value="maintenance" class="gap-1.5 text-xs">
                        <AppIcon name="pencil" class="size-3" />
                        View
                    </TabsTrigger>
                    <TabsTrigger value="status" class="gap-1.5 text-xs">
                        <AppIcon name="shield-check" class="size-3" />
                        Status
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="maintenance" class="m-0 flex min-h-0 flex-1 flex-col">
                    <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                        <fieldset :disabled="!ws.canManageItems" class="contents">
                        <div class="grid gap-4 px-6 py-4">
                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="flex items-center gap-2 px-2 text-sm font-medium text-muted-foreground">
                                    Basic Information
                                    <CatalogLinkBadge
                                        v-if="ws.updateIdentityLockedToCatalog && ws.updateSelectedCatalogItem"
                                        source="clinical_catalog"
                                        :catalog-type="ws.updateSelectedCatalogItem.catalogType"
                                        :catalog-name="ws.updateSelectedCatalogItem.name"
                                        :catalog-code="ws.updateSelectedCatalogItem.code"
                                    />
                                </legend>
                                <div v-if="ws.selectedUpdateCategory?.supportsMedicineDetails && ws.updateClinicalCatalogOptions.length > 0 && !ws.updateIdentityLockedToCatalog" class="sm:col-span-2">
                                    <SearchableSelectField
                                        input-id="inv-item-edit-clinical-catalog"
                                        label="Clinical medicine"
                                        :model-value="ws.itemUpdateForm.clinicalCatalogItemId"
                                        :options="ws.updateClinicalCatalogOptions"
                                        placeholder="Select approved medicine to link"
                                        search-placeholder="Search Clinical Catalog"
                                        empty-text="Create or activate this definition in Clinical Catalog first."
                                        :disabled="ws.itemUpdateSubmitting"
                                        :error-message="ws.fieldError(ws.itemUpdateErrors, 'clinicalCatalogItemId')"
                                        @update:model-value="ws.selectClinicalCatalogItem(ws.itemUpdateForm, String($event ?? ''))"
                                    />
                                    <p class="mt-1 text-xs text-muted-foreground">Linking loads code, name, strength, dosage form, and dispensing unit from the catalog and locks them here.</p>
                                </div>
                                <Alert v-else-if="ws.selectedUpdateCategory?.supportsMedicineDetails && !ws.updateIdentityLockedToCatalog && ws.updateClinicalCatalogOptions.length === 0" class="sm:col-span-2">
                                    <AlertTitle>No active approved medicines available</AlertTitle>
                                    <AlertDescription class="flex flex-wrap items-center gap-2">
                                        <span>This item will stay unlinked until a matching definition exists in Clinical Catalog.</span>
                                        <Link href="/platform/admin/clinical-catalogs" class="font-medium text-primary underline underline-offset-4">
                                            Open Clinical Catalog
                                        </Link>
                                    </AlertDescription>
                                </Alert>
                                <div v-if="ws.updateIdentityLockedToCatalog" class="sm:col-span-2 rounded-md border bg-muted/30 p-3">
                                    <p class="mb-2 text-xs text-muted-foreground">Synced from the clinical catalog. To change these values, update the linked clinical definition.</p>
                                    <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                                        <div>
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">Item Code</dt>
                                            <dd class="font-medium">{{ ws.itemUpdateForm.itemCode || '—' }}</dd>
                                        </div>
                                        <div>
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">Item Name</dt>
                                            <dd class="font-medium">{{ ws.itemUpdateForm.itemName || '—' }}</dd>
                                        </div>
                                        <div v-if="ws.itemUpdateForm.genericName">
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">Generic Name</dt>
                                            <dd class="font-medium">{{ ws.itemUpdateForm.genericName }}</dd>
                                        </div>
                                        <div v-if="ws.itemUpdateForm.dosageForm">
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">Dosage Form</dt>
                                            <dd class="font-medium">{{ ws.itemUpdateForm.dosageForm }}</dd>
                                        </div>
                                        <div v-if="ws.itemUpdateForm.strength">
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">Strength</dt>
                                            <dd class="font-medium">{{ ws.itemUpdateForm.strength }}</dd>
                                        </div>
                                        <div v-if="ws.itemUpdateForm.dispensingUnit">
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">Dispensing Unit</dt>
                                            <dd class="font-medium">{{ ws.itemUpdateForm.dispensingUnit }}</dd>
                                        </div>
                                        <div v-if="ws.itemUpdateForm.conversionFactor">
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">Conversion Factor</dt>
                                            <dd class="font-medium">{{ ws.itemUpdateForm.conversionFactor }}</dd>
                                        </div>
                                        <div v-if="ws.itemUpdateForm.unit">
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">Stock Unit</dt>
                                            <dd class="font-medium">{{ ws.itemUpdateForm.unit }}</dd>
                                        </div>
                                        <div v-if="ws.itemUpdateForm.msdCode">
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">MSD Code</dt>
                                            <dd class="font-medium">{{ ws.itemUpdateForm.msdCode }}</dd>
                                        </div>
                                        <div v-if="ws.itemUpdateForm.nhifCode">
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">NHIF Code</dt>
                                            <dd class="font-medium">{{ ws.itemUpdateForm.nhifCode }}</dd>
                                        </div>
                                        <div v-if="ws.updateSelectedCatalogItem?.isControlledSubstance">
                                            <dt class="text-[11px] uppercase tracking-wide text-muted-foreground">Controlled Substance</dt>
                                            <dd class="font-medium">{{ ws.updateSelectedCatalogItem.controlledSubstanceSchedule ? ws.formatEnumLabel(ws.updateSelectedCatalogItem.controlledSubstanceSchedule) : 'Yes' }}</dd>
                                        </div>
                                    </dl>
                                </div>
                                <div v-if="!ws.updateIdentityLockedToCatalog && !ws.selectedUpdateCategory?.supportsMedicineDetails" class="grid gap-2">
                                    <Label for="inv-item-edit-code">Item Code</Label>
                                    <Input id="inv-item-edit-code" v-model="ws.itemUpdateForm.itemCode" :disabled="ws.itemUpdateSubmitting" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'itemCode')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'itemCode') }}</p>
                                </div>
                                <div v-if="!ws.updateIdentityLockedToCatalog && !ws.selectedUpdateCategory?.supportsMedicineDetails" class="grid gap-2">
                                    <Label for="inv-item-edit-name">Item Name</Label>
                                    <Input id="inv-item-edit-name" v-model="ws.itemUpdateForm.itemName" :disabled="ws.itemUpdateSubmitting" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'itemName')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'itemName') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-item-edit-category">Category</Label>
                                    <Select :model-value="ws.itemUpdateForm.category || undefined" @update:model-value="ws.itemUpdateForm.category = String($event ?? '')">
                                        <SelectTrigger id="inv-item-edit-category" class="w-full" :disabled="ws.itemUpdateSubmitting">
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="cat in ws.itemCategoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'category')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'category') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-item-edit-manufacturer">Manufacturer</Label>
                                    <Input id="inv-item-edit-manufacturer" v-model="ws.itemUpdateForm.manufacturer" :disabled="ws.itemUpdateSubmitting" placeholder="e.g. Pfizer, GSK" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'manufacturer')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'manufacturer') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-item-edit-barcode">Barcode</Label>
                                    <Input id="inv-item-edit-barcode" v-model="ws.itemUpdateForm.barcode" :disabled="ws.itemUpdateSubmitting" placeholder="e.g. 6291234567890" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'barcode')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'barcode') }}</p>
                                </div>
                            </fieldset>

                            <fieldset
                                v-if="ws.selectedUpdateCategory?.supportsMedicineDetails && (!ws.updateIdentityLockedToCatalog || !ws.itemUpdateForm.conversionFactor)"
                                class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
                            >
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Medicine Profile</legend>
                                <p v-if="!ws.updateIdentityLockedToCatalog" class="sm:col-span-2 text-xs text-muted-foreground">
                                    Generic name, dosage form, strength, and dispensing unit come from the linked medicine above and appear here once one is selected.
                                </p>
                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="inv-item-edit-conversion-factor">Conversion Factor</Label>
                                    <Input id="inv-item-edit-conversion-factor" v-model="ws.itemUpdateForm.conversionFactor" :disabled="ws.itemUpdateSubmitting" type="number" min="0" step="0.001" placeholder="Stock to dispensing conversion" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'conversionFactor')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'conversionFactor') }}</p>
                                    <p v-if="ws.updateIdentityLockedToCatalog" class="text-[11px] text-muted-foreground">Not set on the linked medicine. Define it once via a packaging template in Clinical Catalog admin to reuse it across facilities, or set it here for this item only.</p>
                                </div>
                            </fieldset>

                            <fieldset v-if="ws.selectedUpdateCategory?.supportsStorageFields || ws.selectedUpdateCategory?.controlledSubstanceEligible" class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Handling &amp; Compliance</legend>
                                <div v-if="ws.selectedUpdateCategory?.supportsStorageFields" class="grid gap-2 sm:col-span-2">
                                    <Label for="inv-item-edit-storage">Storage Conditions</Label>
                                    <Select :model-value="ws.toSelectValue(ws.itemUpdateForm.storageConditions)" @update:model-value="ws.itemUpdateForm.storageConditions = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                        <SelectTrigger id="inv-item-edit-storage" class="w-full" :disabled="ws.itemUpdateSubmitting">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select —</SelectItem>
                                            <SelectItem v-for="s in ws.storageConditionOptions" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'storageConditions')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'storageConditions') }}</p>
                                </div>
                                <div v-if="ws.selectedUpdateCategory?.supportsStorageFields" class="grid gap-2">
                                    <Label>Temperature Handling</Label>
                                    <label class="flex items-center gap-2 pt-2 text-sm">
                                        <Checkbox :model-value="ws.itemUpdateForm.requiresColdChain" :disabled="ws.itemUpdateSubmitting || Boolean(ws.selectedUpdateCategory?.requiresColdChain) || !ws.canManageCompliance" @update:model-value="(value) => (ws.itemUpdateForm.requiresColdChain = value === true)" />
                                        {{ ws.selectedUpdateCategory?.requiresColdChain ? 'Cold chain required for this category' : 'Requires cold chain' }}
                                    </label>
                                    <p v-if="!ws.selectedUpdateCategory?.requiresColdChain && !ws.canManageCompliance" class="text-[11px] text-muted-foreground">Requires the compliance permission to change</p>
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'requiresColdChain')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'requiresColdChain') }}</p>
                                </div>
                                <div v-if="ws.selectedUpdateCategory?.controlledSubstanceEligible" class="grid gap-2 sm:col-span-2">
                                    <Label>Controlled Substance</Label>
                                    <p v-if="ws.updateSelectedCatalogItem" class="text-sm font-medium">
                                        {{ ws.updateSelectedCatalogItem.isControlledSubstance ? (ws.updateSelectedCatalogItem.controlledSubstanceSchedule ? ws.formatEnumLabel(ws.updateSelectedCatalogItem.controlledSubstanceSchedule) : 'Yes') : 'No' }}
                                    </p>
                                    <p class="text-[11px] text-muted-foreground">
                                        Set on the linked Clinical Catalog medicine, not per inventory item. Manage it in Clinical Catalog admin.
                                    </p>
                                </div>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Classification &amp; Codes</legend>
                                <div v-if="!ws.selectedUpdateCategory || ws.selectedUpdateCategory.supportsClinicalClassification" class="grid gap-2">
                                    <Label for="inv-item-edit-ven">VEN Classification</Label>
                                    <Select :model-value="ws.itemUpdateForm.venClassification || undefined" @update:model-value="ws.itemUpdateForm.venClassification = String($event ?? '')">
                                        <SelectTrigger id="inv-item-edit-ven" class="w-full" :disabled="ws.itemUpdateSubmitting">
                                            <SelectValue placeholder="Select VEN classification" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="v in ws.venClassificationOptions" :key="v.value" :value="v.value">{{ v.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'venClassification')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'venClassification') }}</p>
                                </div>
                                <div v-if="!ws.selectedUpdateCategory || ws.selectedUpdateCategory.supportsClinicalClassification" class="grid gap-2">
                                    <Label for="inv-item-edit-abc">ABC Classification</Label>
                                    <Select :model-value="ws.itemUpdateForm.abcClassification || undefined" @update:model-value="ws.itemUpdateForm.abcClassification = String($event ?? '')">
                                        <SelectTrigger id="inv-item-edit-abc" class="w-full" :disabled="ws.itemUpdateSubmitting">
                                            <SelectValue placeholder="Select ABC classification" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="a in ws.abcClassificationOptions" :key="a.value" :value="a.value">{{ a.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'abcClassification')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'abcClassification') }}</p>
                                </div>
                                <div v-if="!ws.updateIdentityLockedToCatalog" class="grid gap-2">
                                    <Label for="inv-item-edit-msd">MSD Code</Label>
                                    <Input id="inv-item-edit-msd" v-model="ws.itemUpdateForm.msdCode" :disabled="ws.itemUpdateSubmitting" placeholder="Medical Stores Department code" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'msdCode')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'msdCode') }}</p>
                                </div>
                                <div v-if="(!ws.selectedUpdateCategory || ws.selectedUpdateCategory.supportsClinicalClassification) && !ws.updateIdentityLockedToCatalog" class="grid gap-2">
                                    <Label for="inv-item-edit-nhif">NHIF Code</Label>
                                    <Input id="inv-item-edit-nhif" v-model="ws.itemUpdateForm.nhifCode" :disabled="ws.itemUpdateSubmitting" placeholder="NHIF tariff code" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'nhifCode')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'nhifCode') }}</p>
                                </div>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Stock Policy &amp; Defaults</legend>
                                <div v-if="!ws.updateIdentityLockedToCatalog" class="grid gap-2">
                                    <Label for="inv-item-edit-unit">Stock Unit</Label>
                                    <Input id="inv-item-edit-unit" v-model="ws.itemUpdateForm.unit" :disabled="ws.itemUpdateSubmitting" placeholder="e.g. Box, Bottle, Piece" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'unit')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'unit') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-item-edit-bin-location">Bin Location</Label>
                                    <Input id="inv-item-edit-bin-location" v-model="ws.itemUpdateForm.binLocation" :disabled="ws.itemUpdateSubmitting" placeholder="e.g. A-03-12" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'binLocation')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'binLocation') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-item-edit-default-warehouse">Default Warehouse</Label>
                                    <Popover :open="ws.updateItemWarehouseOpen" @update:open="ws.updateItemWarehouseOpen = $event">
                                        <PopoverTrigger as-child>
                                            <Button id="inv-item-edit-default-warehouse" type="button" variant="outline" :disabled="ws.itemUpdateSubmitting" class="w-full justify-between font-normal">
                                                <span :class="ws.itemUpdateForm.defaultWarehouseId ? '' : 'text-muted-foreground'">
                                                    {{ ws.itemUpdateForm.defaultWarehouseId ? (ws.warehouseLabel(ws.itemUpdateForm.defaultWarehouseId) ?? ws.itemUpdateForm.defaultWarehouseId) : '— Select warehouse —' }}
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
                                                            @select="() => { ws.itemUpdateForm.defaultWarehouseId = warehouse.id; ws.updateItemWarehouseOpen = false }"
                                                        >
                                                            <AppIcon v-if="ws.itemUpdateForm.defaultWarehouseId === warehouse.id" name="circle-check-big" class="mr-2 mt-0.5 size-4 shrink-0 text-primary" />
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
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'defaultWarehouseId')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'defaultWarehouseId') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-item-edit-default-supplier">Default Supplier</Label>
                                    <Popover :open="ws.updateItemSupplierOpen" @update:open="ws.updateItemSupplierOpen = $event">
                                        <PopoverTrigger as-child>
                                            <Button id="inv-item-edit-default-supplier" type="button" variant="outline" :disabled="ws.itemUpdateSubmitting" class="w-full justify-between font-normal">
                                                <span :class="ws.itemUpdateForm.defaultSupplierId ? '' : 'text-muted-foreground'">
                                                    {{ ws.itemUpdateForm.defaultSupplierId ? (ws.supplierLabel(ws.itemUpdateForm.defaultSupplierId) ?? ws.itemUpdateForm.defaultSupplierId) : '— Select supplier —' }}
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
                                                        <CommandItem value="__none__" @select="() => { ws.itemUpdateForm.defaultSupplierId = ''; ws.updateItemSupplierOpen = false }">
                                                            <span class="text-muted-foreground">— None —</span>
                                                        </CommandItem>
                                                        <CommandItem
                                                            v-for="supplier in ws.suppliers"
                                                            :key="supplier.id"
                                                            :value="supplier.id"
                                                            @select="() => { ws.itemUpdateForm.defaultSupplierId = supplier.id; ws.updateItemSupplierOpen = false }"
                                                        >
                                                            <AppIcon v-if="ws.itemUpdateForm.defaultSupplierId === supplier.id" name="circle-check-big" class="mr-2 mt-0.5 size-4 shrink-0 text-primary" />
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
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'defaultSupplierId')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'defaultSupplierId') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-item-edit-reorder-level">Reorder Level</Label>
                                    <Input id="inv-item-edit-reorder-level" v-model="ws.itemUpdateForm.reorderLevel" :disabled="ws.itemUpdateSubmitting" type="number" min="0" step="0.001" placeholder="e.g. 100" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'reorderLevel')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'reorderLevel') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-item-edit-max-stock-level">Max Stock Level</Label>
                                    <Input id="inv-item-edit-max-stock-level" v-model="ws.itemUpdateForm.maxStockLevel" :disabled="ws.itemUpdateSubmitting" type="number" min="0" step="0.001" placeholder="e.g. 1000" />
                                    <p v-if="ws.fieldError(ws.itemUpdateErrors, 'maxStockLevel')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'maxStockLevel') }}</p>
                                </div>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3">
                                <legend class="flex w-full items-center justify-between gap-2 px-2 text-sm font-medium text-muted-foreground">
                                    <span>Packaging Units</span>
                                    <Button type="button" variant="outline" size="sm" class="gap-1.5 h-7 px-2 text-xs" @click="ws.openCreateUnitDialog()">
                                        <AppIcon name="plus" class="size-3.5" />
                                        Add unit
                                    </Button>
                                </legend>
                                <p class="px-2 text-xs text-muted-foreground">
                                    How this item is bought and sold in practice -- e.g. stocked as tablets, purchased by the box. The base unit comes from Stock Unit above and can't be edited here.
                                </p>
                                <div v-if="ws.itemUnitsLoading" class="px-2 text-xs text-muted-foreground">Loading packaging units...</div>
                                <div v-else-if="ws.itemUnits.length === 0" class="px-2 text-xs text-muted-foreground">No packaging units yet -- add one to record how this item is purchased or sold beyond the base unit.</div>
                                <ul v-else class="grid gap-2">
                                    <li
                                        v-for="unit in ws.itemUnits"
                                        :key="unit.id"
                                        class="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
                                    >
                                        <div class="flex min-w-0 flex-wrap items-center gap-2">
                                            <span class="text-sm font-medium">{{ unit.unitName }}</span>
                                            <span v-if="unit.unitCode" class="text-xs text-muted-foreground">({{ unit.unitCode }})</span>
                                            <span class="text-xs text-muted-foreground">1 {{ unit.unitName }} = {{ unit.baseQuantity }} {{ ws.itemUpdateForm.unit || 'base unit' }}</span>
                                            <Badge v-if="unit.isBaseUnit" variant="secondary">Base unit</Badge>
                                            <Badge v-if="unit.isDefaultSalesUnit" variant="outline">Default sales</Badge>
                                            <Badge v-if="unit.isDefaultPurchaseUnit" variant="outline">Default purchase</Badge>
                                        </div>
                                        <div v-if="!unit.isBaseUnit" class="flex shrink-0 items-center gap-1">
                                            <Button type="button" variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="ws.openEditUnitDialog(unit)">Edit</Button>
                                            <Button type="button" variant="ghost" size="sm" class="h-7 px-2 text-xs text-destructive hover:text-destructive" @click="ws.submitDeactivateUnit(unit.id)">Deactivate</Button>
                                        </div>
                                    </li>
                                </ul>
                            </fieldset>

                            <Alert v-if="ws.itemUpdateValidationMessages.length" variant="destructive">
                                <AlertTitle>Before you save</AlertTitle>
                                <AlertDescription>
                                    <ul class="list-inside list-disc space-y-1">
                                        <li v-for="message in ws.itemUpdateValidationMessages" :key="message" class="text-xs leading-5">{{ message }}</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </div>
                        </fieldset>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="status" class="m-0 flex min-h-0 flex-1 flex-col">
                    <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                        <fieldset :disabled="!ws.canManageItems" class="contents">
                        <div class="grid gap-4 px-6 py-4">
                            <fieldset class="grid gap-3 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Item Status</legend>
                                <div class="grid gap-2">
                                    <Label for="inv-item-status">Status</Label>
                                    <Select v-model="ws.itemStatusForm.status">
                                        <SelectTrigger id="inv-item-status" class="w-full" :disabled="ws.itemStatusSubmitting">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem v-for="option in ws.itemStatusOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="inv-item-status-reason">Reason</Label>
                                    <Textarea id="inv-item-status-reason" v-model="ws.itemStatusForm.reason" :disabled="ws.itemStatusSubmitting" rows="3" placeholder="Why is this item's status changing? (optional)" />
                                </div>
                            </fieldset>
                            <Alert v-if="ws.itemStatusError" variant="destructive">
                                <AlertTitle>Status update failed</AlertTitle>
                                <AlertDescription>{{ ws.itemStatusError }}</AlertDescription>
                            </Alert>
                        </div>
                        </fieldset>
                    </ScrollArea>
                </TabsContent>
            </Tabs>
            <SheetFooter class="shrink-0 gap-2 border-t px-4 py-3 sm:px-6">
                <template v-if="ws.itemDetailsTab === 'maintenance' && ws.canManageItems">
                    <Button variant="outline" :disabled="ws.itemUpdateSubmitting" @click="ws.requestItemDetailsOpenChange(false, () => (ws.itemDetailsTab = 'maintenance'))">Cancel</Button>
                    <Button :disabled="ws.itemUpdateSubmitDisabled" class="gap-1.5" @click="ws.submitItemUpdate">
                        <AppIcon name="check" class="size-3.5" />
                        {{ ws.itemUpdateSubmitting ? 'Saving...' : 'Save changes' }}
                    </Button>
                </template>
                <template v-else-if="ws.itemDetailsTab === 'status' && ws.canManageItems">
                    <Button variant="outline" :disabled="ws.itemStatusSubmitting" @click="ws.requestItemDetailsOpenChange(false, () => (ws.itemDetailsTab = 'maintenance'))">Cancel</Button>
                    <Button :disabled="ws.itemStatusSubmitting" class="gap-1.5" @click="ws.submitItemStatus">
                        <AppIcon name="shield-check" class="size-3.5" />
                        {{ ws.itemStatusSubmitting ? 'Updating...' : 'Update status' }}
                    </Button>
                </template>
                <template v-else>
                    <Button v-if="ws.itemDetails" as-child class="gap-1.5">
                        <Link :href="`/inventory-procurement/items/${ws.itemDetails.id}`">
                            <AppIcon name="arrow-up-right" class="size-3.5" />
                            View Full Details
                        </Link>
                    </Button>
                    <Button variant="outline" @click="ws.requestItemDetailsOpenChange(false)">Close</Button>
                </template>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <LeaveWorkflowDialog
        :open="ws.itemDetailsDiscardConfirmOpen"
        title="Discard unsaved changes?"
        description="This item still has unsaved edit or status changes. Keep editing to preserve them, or discard the changes."
        stay-label="Keep editing"
        leave-label="Discard changes"
        @update:open="ws.itemDetailsDiscardConfirmOpen = false"
        @confirm="ws.confirmItemDetailsDiscard"
    />
</template>


