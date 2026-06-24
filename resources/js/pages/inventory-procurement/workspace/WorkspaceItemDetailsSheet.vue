<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatEnumLabel } from '@/lib/labels';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

function formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

const ws = useInventoryWorkspace();
</script>

<template>
<Sheet :open="ws.itemDetailsOpen" @update:open="ws.itemDetailsOpen = $event">
        <SheetContent side="right" variant="workspace" size="4xl" class="flex h-full min-h-0 flex-col">
            <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                <SheetTitle>{{ ws.itemDetails?.itemCode || 'Inventory item details' }}</SheetTitle>
                <SheetDescription>
                    {{ ws.itemDetails?.itemName || 'Review identity, stock, maintenance, and audit activity for this inventory item.' }}
                </SheetDescription>
                <div v-if="ws.itemDetails" class="mt-2 flex flex-wrap items-center gap-2">
                    <Button v-if="ws.canManageItems" size="sm" variant="default" class="h-8 gap-1.5 rounded-lg text-xs" @click="ws.itemDetailsTab = 'maintenance'">
                        <AppIcon name="pencil" class="size-3.5" />
                        Edit
                    </Button>
                    <Button v-if="ws.inventoryItemHasOpeningStock(ws.itemDetails) && ws.canSetOpeningStock" size="sm" variant="outline" class="h-8 gap-1.5 rounded-lg text-xs" @click="ws.openStockMovementCorrection(ws.itemDetails)">
                        <AppIcon name="pencil" class="size-3.5" />
                        Correct Opening Stock
                    </Button>
                    <Button size="sm" variant="outline" class="h-8 gap-1.5 rounded-lg text-xs" @click="ws.openDepartmentStockForItem(ws.itemDetails)">
                        <AppIcon name="building-2" class="size-3.5" />
                        Where issued?
                    </Button>
                </div>
            </SheetHeader>
            <div class="min-h-0 flex-1 overflow-hidden">
                <div v-if="ws.itemDetailsLoading" class="h-full overflow-y-auto p-4">
                    <div class="space-y-4">
                        <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            <div
                                v-for="label in ['Stock state', 'On hand', 'Default route']"
                                :key="label"
                                class="min-w-0 rounded-lg border bg-background/70 px-3 py-2"
                            >
                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ label }}</p>
                                <Skeleton class="mt-2 h-4 w-28" />
                                <Skeleton class="mt-1.5 h-3 w-40" />
                            </div>
                        </div>

                        <Card class="min-w-0">
                            <CardHeader class="pb-3">
                                <CardTitle class="text-base">Master Record</CardTitle>
                                <CardDescription>Core item identity and how this stock definition is classified in the system.</CardDescription>
                            </CardHeader>
                            <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <div
                                    v-for="label in ['Item code', 'Item name', 'Category', 'Subcategory', 'Stock unit', 'Clinical link']"
                                    :key="label"
                                    class="space-y-1"
                                >
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ label }}</p>
                                    <Skeleton class="h-4 w-32 max-w-full" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card class="min-w-0">
                            <CardHeader class="pb-3">
                                <CardTitle class="text-base">Handling &amp; Routing</CardTitle>
                                <CardDescription>Storage, manufacturer, and operational routing details used by stores workflows.</CardDescription>
                            </CardHeader>
                            <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                <div
                                    v-for="label in ['Manufacturer', 'Bin location', 'Storage conditions', 'Cold chain', 'Controlled substance', 'Dispensing unit']"
                                    :key="label"
                                    class="space-y-1"
                                >
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ label }}</p>
                                    <Skeleton class="h-4 w-28 max-w-full" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
                <Alert v-else-if="ws.itemDetailsError" variant="destructive" class="m-4">
                    <AlertTitle>Item load failed</AlertTitle>
                    <AlertDescription>{{ ws.itemDetailsError }}</AlertDescription>
                </Alert>
                <Tabs v-else-if="ws.itemDetails" v-model="ws.itemDetailsTab" class="flex h-full min-h-0 flex-col">
                    <div class="shrink-0 border-b bg-muted/5 px-4 py-2.5">
                            <div class="space-y-4">
                            <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                <div
                                    v-for="card in ws.itemDetailsSummaryCards"
                                    :key="card.key"
                                    class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5"
                                >
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ card.label }}</p>
                                    <div class="mt-0.5 space-y-0.5">
                                        <p class="min-w-0 text-sm font-semibold leading-4">{{ card.value }}</p>
                                        <p
                                            class="min-w-0 text-xs leading-4 text-muted-foreground line-clamp-1"
                                            :title="card.helper"
                                        >
                                            {{ card.helper }}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div class="pb-1">
                                <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-transparent p-0">
                                    <TabsTrigger value="overview" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Overview</TabsTrigger>
                                    <TabsTrigger value="stock" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Batches</TabsTrigger>
                                    <TabsTrigger v-if="ws.canManageItems" value="units" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Units</TabsTrigger>
                                    <TabsTrigger v-if="ws.canViewAudit" value="audit" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Audit</TabsTrigger>
                                </TabsList>
                            </div>
                        </div>
                    </div>

                    <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                        <div class="space-y-4 p-4">
                            <TabsContent value="overview" class="mt-0 min-w-0 space-y-4">
                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Master Record</CardTitle>
                                        <CardDescription>Core item identity and how this stock definition is classified in the system.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Item code</p>
                                            <p class="break-words text-sm font-medium">{{ ws.itemDetails.itemCode || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Item name</p>
                                            <p class="break-words text-sm font-medium">{{ ws.itemDetails.itemName || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Category</p>
                                            <p class="text-sm font-medium">{{ ws.itemDetails.category ? formatEnumLabel(ws.itemDetails.category) : 'Unclassified' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Subcategory</p>
                                            <p class="text-sm font-medium">{{ ws.itemDetails.subcategory ? formatEnumLabel(ws.itemDetails.subcategory) : 'Not assigned' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Stock unit</p>
                                            <p class="text-sm font-medium">{{ ws.itemDetails.unit || 'Not set' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Clinical link</p>
                                            <p class="break-words text-sm font-medium">
                                                {{ ws.itemDetails.clinicalCatalogItemId ? ws.clinicalCatalogLabel(ws.itemDetails.clinicalCatalogItemId) : 'No clinical definition link' }}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Handling &amp; Routing</CardTitle>
                                        <CardDescription>Storage, manufacturer, and operational routing details used by stores workflows.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Manufacturer</p>
                                            <p class="break-words text-sm font-medium">{{ ws.itemDetails.manufacturer || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Bin location</p>
                                            <p class="break-words text-sm font-medium">{{ ws.itemDetails.binLocation || 'Not assigned' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Storage conditions</p>
                                            <p class="text-sm font-medium">{{ ws.itemDetails.storageConditions ? formatEnumLabel(ws.itemDetails.storageConditions) : 'Not specified' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Cold chain</p>
                                            <p class="text-sm font-medium">{{ ws.itemDetails.requiresColdChain ? 'Required' : 'Not required' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Controlled substance</p>
                                            <p class="text-sm font-medium">
                                                {{ ws.itemDetails.isControlledSubstance ? (ws.itemDetails.controlledSubstanceSchedule || 'Yes') : 'No' }}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Standards &amp; Lifecycle</CardTitle>
                                        <CardDescription>Coding, scanning, and lifecycle timestamps used for finance, supply chain, and governance.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">VEN</p>
                                            <p class="text-sm font-medium">{{ ws.itemDetails.venClassification ? formatEnumLabel(ws.itemDetails.venClassification) : 'Not set' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">ABC</p>
                                            <p class="text-sm font-medium">{{ ws.itemDetails.abcClassification || 'Not set' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">MSD code</p>
                                            <p class="break-words text-sm font-medium">{{ ws.itemDetails.msdCode || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">NHIF code</p>
                                            <p class="break-words text-sm font-medium">{{ ws.itemDetails.nhifCode || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Barcode</p>
                                            <p class="break-words text-sm font-medium">{{ ws.itemDetails.barcode || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                                            <p class="text-sm font-medium">{{ ws.formatDateTime(ws.itemDetails.createdAt) }}</p>
                                        </div>
                                        <div class="space-y-1 sm:col-span-2 lg:col-span-3">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Last updated</p>
                                            <p class="text-sm font-medium">{{ ws.formatDateTime(ws.itemDetails.updatedAt) }}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card v-if="ws.itemDetails.genericName || ws.itemDetails.dosageForm || ws.itemDetails.strength || ws.itemDetails.dispensingUnit || ws.itemDetails.conversionFactor != null" class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Medicine Profile</CardTitle>
                                        <CardDescription>Only appears when the item carries medicine-specific formulary data.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Generic name</p>
                                            <p class="break-words text-sm font-medium">{{ ws.itemDetails.genericName || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Dosage form</p>
                                            <p class="text-sm font-medium">{{ ws.itemDetails.dosageForm || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Strength</p>
                                            <p class="text-sm font-medium">{{ ws.itemDetails.strength || 'Not recorded' }}</p>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Dispensing unit</p>
                                            <p class="text-sm font-medium">{{ ws.itemDetails.dispensingUnit || 'Not recorded' }}</p>
                                        </div>
                                        <div v-if="ws.itemDetails.conversionFactor != null" class="space-y-1 sm:col-span-2">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Unit conversion</p>
                                            <p class="text-sm font-medium">1 {{ ws.itemDetails.unit || 'stock unit' }} = {{ Number(ws.itemDetails.conversionFactor) }} {{ ws.itemDetails.dispensingUnit || 'dispensing unit' }}(s)</p>
                                        </div>
                                        <div v-else class="space-y-1">
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Conversion factor</p>
                                            <p class="text-sm font-medium">Not recorded</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="maintenance" class="mt-0 min-w-0 space-y-4">
                                <Alert v-if="!ws.canManageItems">
                                    <AlertTitle>Maintenance access restricted</AlertTitle>
                                    <AlertDescription>You can review this item, but update and status controls require inventory management permission.</AlertDescription>
                                </Alert>

                                <template v-else>
                                    <div class="flex items-center gap-2 mb-3">
                                        <Button size="sm" variant="outline" class="h-8 gap-1.5 text-xs" @click="ws.itemDetailsTab = 'overview'">
                                            <AppIcon name="chevron-left" class="size-3.5" />
                                            Back to Overview
                                        </Button>
                                    </div>
                                    <Card class="min-w-0">
                                        <CardHeader class="pb-3">
                                            <CardTitle class="text-base">Update Record</CardTitle>
                                            <CardDescription>Adjust the master stock definition without leaving the workspace.</CardDescription>
                                        </CardHeader>
                                        <CardContent class="space-y-4">
                                            <Alert v-if="Object.keys(ws.itemUpdateErrors).length > 0" variant="destructive">
                                                <AlertTitle>Item update needs review</AlertTitle>
                                                <AlertDescription>Review the highlighted fields and save again.</AlertDescription>
                                            </Alert>

                                            <div class="grid gap-4">
                                                <fieldset class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                                                    <legend class="px-2 text-xs font-medium text-muted-foreground">Basic Information</legend>
                                                    <FormFieldShell
                                                        input-id="inv-item-edit-category"
                                                        label="Category"
                                                        :error-message="ws.fieldError(ws.itemUpdateErrors, 'category')"
                                                    >
                                                        <Select :model-value="ws.itemUpdateForm.category || undefined" @update:model-value="ws.itemUpdateForm.category = String($event ?? '')">
                                                            <SelectTrigger class="w-full" :disabled="ws.itemUpdateSubmitting">
                                                                <SelectValue placeholder="Select category" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem v-for="cat in ws.itemCategoryOptions" :key="cat.value" :value="cat.value">{{ cat.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormFieldShell>
                                                    <SearchableSelectField
                                                        input-id="inv-item-edit-subcategory"
                                                        label="Subcategory"
                                                        v-model="ws.itemUpdateForm.subcategory"
                                                        :options="ws.updateSubcategoryOptions"
                                                        placeholder="Select subcategory"
                                                        search-placeholder="Search category subcategories"
                                                        empty-text="No matching subcategory. Type a custom value."
                                                        :disabled="ws.itemUpdateSubmitting || !ws.itemUpdateForm.category"
                                                        :allow-custom-value="true"
                                                        :error-message="ws.fieldError(ws.itemUpdateErrors, 'subcategory')"
                                                    />
                                                    <div v-if="ws.selectedUpdateCategory && ws.updateClinicalCatalogOptions.length > 0" class="sm:col-span-2">
                                                        <SearchableSelectField
                                                            input-id="inv-item-edit-clinical-catalog"
                                                            :label="ws.selectedUpdateCategory?.supportsMedicineDetails ? 'Clinical medicine' : 'Clinical catalog item'"
                                                            :model-value="ws.itemUpdateForm.clinicalCatalogItemId"
                                                            :options="ws.updateClinicalCatalogOptions"
                                                            :placeholder="ws.selectedUpdateCategory?.supportsMedicineDetails ? 'Select approved medicine' : 'Select linked clinical definition'"
                                                            search-placeholder="Search Clinical Care Catalogs"
                                                            empty-text="Create or activate this definition in Clinical Care Catalogs first."
                                                            :disabled="ws.itemUpdateSubmitting"
                                                            :required="ws.selectedUpdateCategory?.supportsMedicineDetails"
                                                            :error-message="ws.fieldError(ws.itemUpdateErrors, 'clinicalCatalogItemId')"
                                                            @update:model-value="ws.selectClinicalCatalogItem(ws.itemUpdateForm, String($event ?? ''))"
                                                        />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-code">Item Code</Label>
                                                        <Input id="inv-item-edit-code" v-model="ws.itemUpdateForm.itemCode" :disabled="ws.itemUpdateSubmitting" />
                                                        <p v-if="ws.fieldError(ws.itemUpdateErrors, 'itemCode')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'itemCode') }}</p>
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-name">Item Name</Label>
                                                        <Input id="inv-item-edit-name" v-model="ws.itemUpdateForm.itemName" :disabled="ws.itemUpdateSubmitting" />
                                                        <p v-if="ws.fieldError(ws.itemUpdateErrors, 'itemName')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'itemName') }}</p>
                                                    </div>
                                                    <FormFieldShell
                                                        input-id="inv-item-edit-manufacturer"
                                                        label="Manufacturer"
                                                    >
                                                        <Input id="inv-item-edit-manufacturer" v-model="ws.itemUpdateForm.manufacturer" :disabled="ws.itemUpdateSubmitting" />
                                                    </FormFieldShell>
                                                    <FormFieldShell
                                                        input-id="inv-item-edit-barcode"
                                                        label="Barcode"
                                                    >
                                                        <Input id="inv-item-edit-barcode" v-model="ws.itemUpdateForm.barcode" :disabled="ws.itemUpdateSubmitting" />
                                                    </FormFieldShell>
                                                    <Alert v-if="ws.selectedUpdateCategory" class="sm:col-span-2">
                                                        <AlertTitle class="flex flex-wrap items-center gap-2">
                                                            <span>{{ ws.selectedUpdateCategory.label }} workflow</span>
                                                            <Badge v-for="badge in ws.updateCategoryWorkflowBadges" :key="badge" variant="secondary">{{ badge }}</Badge>
                                                        </AlertTitle>
                                                        <AlertDescription>{{ ws.selectedUpdateCategory.description }}</AlertDescription>
                                                    </Alert>
                                                </fieldset>

                                                <fieldset v-if="ws.selectedUpdateCategory?.supportsMedicineDetails" class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                                                    <legend class="px-2 text-xs font-medium text-muted-foreground">Medicine Profile</legend>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-generic">Generic Name</Label>
                                                        <Input id="inv-item-edit-generic" v-model="ws.itemUpdateForm.genericName" :disabled="ws.itemUpdateSubmitting" />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-dosage">Dosage Form</Label>
                                                        <Input id="inv-item-edit-dosage" v-model="ws.itemUpdateForm.dosageForm" :disabled="ws.itemUpdateSubmitting" />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-strength">Strength</Label>
                                                        <Input id="inv-item-edit-strength" v-model="ws.itemUpdateForm.strength" :disabled="ws.itemUpdateSubmitting" />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-dispensing">Dispensing Unit</Label>
                                                        <Input id="inv-item-edit-dispensing" v-model="ws.itemUpdateForm.dispensingUnit" :disabled="ws.itemUpdateSubmitting" />
                                                    </div>
                                                    <div class="grid gap-1 sm:col-span-2">
                                                        <Label for="inv-item-edit-conversion">Conversion Factor</Label>
                                                        <Input id="inv-item-edit-conversion" v-model="ws.itemUpdateForm.conversionFactor" :disabled="ws.itemUpdateSubmitting" type="number" min="0" step="0.001" placeholder="How many dispensing units = 1 stock unit" />
                                                        <p class="text-xs text-muted-foreground">e.g. 100 if 1 bottle = 100 tablets</p>
                                                    </div>
                                                </fieldset>

                                                <fieldset v-if="ws.selectedUpdateCategory?.supportsStorageFields || ws.selectedUpdateCategory?.controlledSubstanceEligible" class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                                                    <legend class="px-2 text-xs font-medium text-muted-foreground">Handling &amp; Compliance</legend>
                                                    <div v-if="ws.selectedUpdateCategory?.supportsStorageFields" class="grid gap-1">
                                                        <Label for="inv-item-edit-storage">Storage Conditions</Label>
                                                        <Select :model-value="ws.toSelectValue(ws.itemUpdateForm.storageConditions)" @update:model-value="ws.itemUpdateForm.storageConditions = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                                            <SelectTrigger :disabled="ws.itemUpdateSubmitting">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">- Select -</SelectItem>
                                                                <SelectItem v-for="s in ws.storageConditionOptions" :key="s.value" :value="s.value">{{ s.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p v-if="ws.fieldError(ws.itemUpdateErrors, 'storageConditions')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'storageConditions') }}</p>
                                                    </div>
                                                    <div v-if="ws.selectedUpdateCategory?.supportsStorageFields" class="grid gap-1">
                                                        <Label>Temperature Handling</Label>
                                                        <label class="flex items-center gap-2 pt-2 text-sm">
                                                            <Checkbox :checked="ws.itemUpdateForm.requiresColdChain" :disabled="ws.itemUpdateSubmitting || Boolean(ws.selectedUpdateCategory?.requiresColdChain)" @update:checked="ws.itemUpdateForm.requiresColdChain = $event" />
                                                            {{ ws.selectedUpdateCategory?.requiresColdChain ? 'Cold chain required for this category' : 'Requires cold chain' }}
                                                        </label>
                                                        <p v-if="ws.fieldError(ws.itemUpdateErrors, 'requiresColdChain')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'requiresColdChain') }}</p>
                                                    </div>
                                                    <div v-if="ws.selectedUpdateCategory?.controlledSubstanceEligible" class="grid gap-1">
                                                        <Label>Controlled Substance</Label>
                                                        <label class="flex items-center gap-2 pt-2 text-sm">
                                                            <Checkbox :checked="ws.itemUpdateForm.isControlledSubstance" :disabled="ws.itemUpdateSubmitting" @update:checked="ws.itemUpdateForm.isControlledSubstance = $event" />
                                                            Controlled substance stock
                                                        </label>
                                                        <p v-if="ws.fieldError(ws.itemUpdateErrors, 'isControlledSubstance')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'isControlledSubstance') }}</p>
                                                    </div>
                                                    <div v-if="ws.itemUpdateForm.isControlledSubstance" class="grid gap-1">
                                                        <Label for="inv-item-edit-schedule">Schedule</Label>
                                                        <Select :model-value="ws.toSelectValue(ws.itemUpdateForm.controlledSubstanceSchedule)" @update:model-value="ws.itemUpdateForm.controlledSubstanceSchedule = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                                            <SelectTrigger :disabled="ws.itemUpdateSubmitting">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">- Select -</SelectItem>
                                                                <SelectItem v-for="schedule in ws.controlledSubstanceScheduleOptions" :key="schedule.value" :value="schedule.value">{{ schedule.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p v-if="ws.fieldError(ws.itemUpdateErrors, 'controlledSubstanceSchedule')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'controlledSubstanceSchedule') }}</p>
                                                    </div>
                                                    <Alert v-if="ws.selectedUpdateCategory?.requiresExpiryTracking" class="sm:col-span-2">
                                                        <AlertTitle>Batch and expiry tracking stay mandatory</AlertTitle>
                                                        <AlertDescription>Make sure the receiving workflow continues to capture batch or lot, expiry date, supplier, and warehouse for this item.</AlertDescription>
                                                    </Alert>
                                                </fieldset>

                                                <fieldset class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                                                    <legend class="px-2 text-xs font-medium text-muted-foreground">Classification &amp; Codes</legend>
                                                    <div v-if="!ws.selectedUpdateCategory || ws.selectedUpdateCategory.supportsClinicalClassification" class="grid gap-1">
                                                        <Label for="inv-item-edit-ven">VEN</Label>
                                                        <Select :model-value="ws.itemUpdateForm.venClassification || undefined" @update:model-value="ws.itemUpdateForm.venClassification = String($event ?? '')">
                                                            <SelectTrigger class="w-full" :disabled="ws.itemUpdateSubmitting">
                                                                <SelectValue placeholder="Select VEN classification" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem v-for="v in ws.venClassificationOptions" :key="v.value" :value="v.value">{{ v.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div v-if="!ws.selectedUpdateCategory || ws.selectedUpdateCategory.supportsClinicalClassification" class="grid gap-1">
                                                        <Label for="inv-item-edit-abc">ABC</Label>
                                                        <Select :model-value="ws.itemUpdateForm.abcClassification || undefined" @update:model-value="ws.itemUpdateForm.abcClassification = String($event ?? '')">
                                                            <SelectTrigger class="w-full" :disabled="ws.itemUpdateSubmitting">
                                                                <SelectValue placeholder="Select ABC classification" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem v-for="a in ws.abcClassificationOptions" :key="a.value" :value="a.value">{{ a.label }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-msd">MSD Code</Label>
                                                        <Input id="inv-item-edit-msd" v-model="ws.itemUpdateForm.msdCode" :disabled="ws.itemUpdateSubmitting" />
                                                    </div>
                                                    <div v-if="!ws.selectedUpdateCategory || ws.selectedUpdateCategory.supportsClinicalClassification" class="grid gap-1">
                                                        <Label for="inv-item-edit-nhif">NHIF Code</Label>
                                                        <Input id="inv-item-edit-nhif" v-model="ws.itemUpdateForm.nhifCode" :disabled="ws.itemUpdateSubmitting" />
                                                    </div>
                                                    <p v-if="ws.selectedUpdateCategory && !ws.selectedUpdateCategory.supportsClinicalClassification" class="text-xs text-muted-foreground sm:col-span-2">
                                                        This category uses operational coding only. Clinical classification and NHIF mapping stay hidden.
                                                    </p>
                                                </fieldset>

                                                <fieldset class="grid gap-2 rounded-lg border p-2 sm:grid-cols-2">
                                                    <legend class="px-2 text-xs font-medium text-muted-foreground">Stock Policy &amp; Defaults</legend>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-unit">Stock Unit</Label>
                                                        <Input id="inv-item-edit-unit" v-model="ws.itemUpdateForm.unit" :disabled="ws.itemUpdateSubmitting" />
                                                        <p v-if="ws.fieldError(ws.itemUpdateErrors, 'unit')" class="text-xs text-destructive">{{ ws.fieldError(ws.itemUpdateErrors, 'unit') }}</p>
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-bin">Bin Location</Label>
                                                        <Input id="inv-item-edit-bin" v-model="ws.itemUpdateForm.binLocation" :disabled="ws.itemUpdateSubmitting" />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label>Default Warehouse</Label>
                                                        <Popover :open="ws.updateItemWarehouseOpen" @update:open="ws.updateItemWarehouseOpen = $event">
                                                            <PopoverTrigger as-child>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    :disabled="ws.itemUpdateSubmitting"
                                                                        class="min-w-0 w-full justify-between font-normal"
                                                                    >
                                                                        <span :class="['truncate', ws.itemUpdateForm.defaultWarehouseId ? '' : 'text-muted-foreground']">
                                                                            {{ ws.itemUpdateForm.defaultWarehouseId ? (ws.warehouses.find(w => w.id === ws.itemUpdateForm.defaultWarehouseId)?.name ?? ws.itemUpdateForm.defaultWarehouseId) : '- Select warehouse -' }}
                                                                        </span>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-muted-foreground opacity-50"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent class="w-80 p-0" align="start">
                                                                <Command>
                                                                    <CommandInput placeholder="Search warehouse..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>No warehouse found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            <CommandItem
                                                                                value="__none__"
                                                                                @select="() => { ws.itemUpdateForm.defaultWarehouseId = ''; ws.updateItemWarehouseOpen = false }"
                                                                            >
                                                                                <span class="text-muted-foreground">- None -</span>
                                                                            </CommandItem>
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
                                                    <div class="grid gap-1">
                                                        <Label>Default Supplier</Label>
                                                        <Popover :open="ws.updateItemSupplierOpen" @update:open="ws.updateItemSupplierOpen = $event">
                                                            <PopoverTrigger as-child>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    :disabled="ws.itemUpdateSubmitting"
                                                                        class="min-w-0 w-full justify-between font-normal"
                                                                    >
                                                                        <span :class="['truncate', ws.itemUpdateForm.defaultSupplierId ? '' : 'text-muted-foreground']">
                                                                            {{ ws.itemUpdateForm.defaultSupplierId ? (ws.suppliers.find(s => s.id === ws.itemUpdateForm.defaultSupplierId)?.name ?? ws.itemUpdateForm.defaultSupplierId) : '- Select supplier -' }}
                                                                        </span>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-muted-foreground opacity-50"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>
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
                                                                                @select="() => { ws.itemUpdateForm.defaultSupplierId = ''; ws.updateItemSupplierOpen = false }"
                                                                            >
                                                                                <span class="text-muted-foreground">- None -</span>
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
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-reorder">Reorder Level</Label>
                                                        <Input id="inv-item-edit-reorder" v-model="ws.itemUpdateForm.reorderLevel" :disabled="ws.itemUpdateSubmitting" type="number" min="0" step="0.001" />
                                                    </div>
                                                    <div class="grid gap-1">
                                                        <Label for="inv-item-edit-max-stock">Max Stock Level</Label>
                                                        <Input id="inv-item-edit-max-stock" v-model="ws.itemUpdateForm.maxStockLevel" :disabled="ws.itemUpdateSubmitting" type="number" min="0" step="0.001" />
                                                    </div>
                                                </fieldset>
                                            </div>

                                            <div class="flex justify-end">
                                                <Button size="sm" :disabled="ws.itemUpdateSubmitting" @click="ws.submitItemUpdate">
                                                    {{ ws.itemUpdateSubmitting ? 'Saving...' : 'Save Item Changes' }}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>

                                </template>
                            </TabsContent>


                            <TabsContent value="stock" class="mt-0 min-w-0 space-y-4">
                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <CardTitle class="text-base">Batch Ledger</CardTitle>
                                                <CardDescription>Review tracked batch lines without leaving the item workspace.</CardDescription>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline">{{ ws.itemBatchesLoading ? 'Loading' : `${ws.itemBatches.length} recorded` }}</Badge>
                                                <Button v-if="ws.canManageItems" size="sm" variant="outline" class="gap-1" @click="ws.createBatchDialogOpen = true; ws.loadItemBatches(String(ws.itemDetails.id))">
                                                    <AppIcon name="plus" class="size-3" />
                                                    Add Batch
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent class="space-y-3">
                                        <p v-if="!ws.canManageItems" class="text-sm text-muted-foreground">Batch history is visible here, but adding or changing tracked stock requires inventory management access.</p>
                                        <div v-if="ws.itemBatchesLoading" class="text-sm text-muted-foreground">Loading batches...</div>
                                        <div v-else-if="ws.itemBatches.length === 0" class="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                                            No batches have been recorded for this item yet.
                                        </div>
                                        <div v-else class="overflow-hidden rounded-lg border">
                                            <div
                                                v-for="batch in ws.itemBatches"
                                                :key="batch.id"
                                                class="border-b bg-background/70 p-3 transition-colors last:border-b-0 hover:bg-muted/30"
                                            >
                                                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Batch #</p>
                                                        <p class="break-words font-mono text-sm">{{ batch.batchNumber }}</p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Lot #</p>
                                                        <p class="break-words text-sm">{{ batch.lotNumber ?? '-' }}</p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Quantity</p>
                                                        <p class="text-sm font-medium">{{ batch.quantity }}</p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Expiry</p>
                                                        <p class="text-sm">{{ formatDate(batch.expiryDate) }}</p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                                                        <div>
                                                            <span v-if="batch.expiryState" class="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium" :class="ws.expiryBadgeClass(batch.expiryState)">
                                                                {{ batch.expiryState }}
                                                            </span>
                                                            <span v-else class="text-sm text-muted-foreground">{{ formatEnumLabel(batch.status) }}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent v-if="ws.canManageItems" value="units" class="mt-0 min-w-0 space-y-4">
                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <CardTitle class="text-base">Selling Units</CardTitle>
                                                <CardDescription>Manage conversion units and per-unit pricing for this item.</CardDescription>
                                            </div>
                                            <Button size="sm" variant="outline" class="gap-1" @click="ws.openCreateUnitDialog">
                                                <AppIcon name="plus" class="size-3" />
                                                Add Unit
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent class="space-y-3">
                                        <p v-if="ws.itemUnitsLoading" class="text-sm text-muted-foreground">Loading units...</p>
                                        <div v-else-if="ws.itemUnits.length === 0" class="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                                            No units configured yet. Add the base unit and any selling units.
                                        </div>
                                        <div v-else class="overflow-hidden rounded-lg border">
                                            <div v-for="unit in ws.itemUnits" :key="unit.id" class="border-b bg-background/70 p-3 last:border-b-0">
                                                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Unit</p>
                                                        <p class="break-words text-sm font-medium">{{ unit.unitName || unit.unitCode || '-' }}</p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Base quantity</p>
                                                        <p class="text-sm font-medium">{{ unit.baseQuantity }}</p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Role</p>
                                                        <p class="text-xs">
                                                            <span v-if="unit.isBaseUnit" class="mr-2 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">Base</span>
                                                            <span v-if="unit.isDefaultSalesUnit" class="mr-2 inline-block rounded bg-sky-50 px-1.5 py-0.5 text-sky-700 dark:bg-sky-950 dark:text-sky-200">Default sales</span>
                                                            <span v-if="unit.isDefaultPurchaseUnit" class="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-200">Default purchase</span>
                                                            <span v-if="!unit.isBaseUnit && !unit.isDefaultSalesUnit && !unit.isDefaultPurchaseUnit" class="text-muted-foreground">Extra unit</span>
                                                        </p>
                                                    </div>
                                                    <div class="min-w-0 space-y-1">
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                                                        <p class="text-xs">
                                                            <span :class="unit.isActive ? 'text-emerald-700' : 'text-muted-foreground'">{{ unit.isActive ? 'Active' : 'Inactive' }}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <p class="text-xs text-muted-foreground">Prices per unit are configured in <span class="font-medium">Tariffs & services</span>.</p>
                            </TabsContent>

                            <TabsContent v-if="ws.canViewAudit" value="audit" class="mt-0 min-w-0 space-y-4">
                                <Card class="min-w-0">
                                    <CardHeader class="pb-3">
                                        <CardTitle class="text-base">Audit Trail</CardTitle>
                                        <CardDescription>Filter item changes by actor, time, and action without leaving the sheet.</CardDescription>
                                    </CardHeader>
                                    <CardContent class="space-y-3">
                                        <div class="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-q">Action Text Search</Label>
                                                <Input id="inv-item-audit-q" v-model="ws.itemAuditFilters.q" placeholder="item.updated, status.updated..." />
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-action">Action (exact)</Label>
                                                <Input id="inv-item-audit-action" v-model="ws.itemAuditFilters.action" placeholder="Optional exact action key" />
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-actor-type">Actor Type</Label>
                                                <Select :model-value="ws.toSelectValue(ws.itemAuditFilters.actorType)" @update:model-value="ws.itemAuditFilters.actorType = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem
                                                            v-for="option in ws.auditActorTypeOptions"
                                                            :key="`inv-item-audit-actor-type-${option.value || 'all'}`"
                                                            :value="ws.toSelectValue(option.value)"
                                                        >
                                                            {{ option.label }}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-actor-id">Actor ID</Label>
                                                <Input id="inv-item-audit-actor-id" v-model="ws.itemAuditFilters.actorId" inputmode="numeric" placeholder="Optional user id" />
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-from">From</Label>
                                                <Input id="inv-item-audit-from" v-model="ws.itemAuditFilters.from" type="datetime-local" />
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-to">To</Label>
                                                <Input id="inv-item-audit-to" v-model="ws.itemAuditFilters.to" type="datetime-local" />
                                            </div>
                                            <div class="grid gap-1">
                                                <Label for="inv-item-audit-per-page">Rows Per Page</Label>
                                                <Select :model-value="String(ws.itemAuditFilters.perPage)" @update:model-value="ws.itemAuditFilters.perPage = Number($event)">
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="10">10</SelectItem>
                                                        <SelectItem value="20">20</SelectItem>
                                                        <SelectItem value="50">50</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="flex flex-wrap items-end gap-2">
                                                <Button size="sm" :disabled="ws.itemAuditLoading" @click="ws.applyItemAuditFilters">
                                                    {{ ws.itemAuditLoading ? 'Applying...' : 'Apply Filters' }}
                                                </Button>
                                                <Button size="sm" variant="outline" :disabled="ws.itemAuditLoading" @click="ws.resetItemAuditFilters">
                                                    Reset
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    :disabled="ws.itemAuditLoading || ws.itemAuditExporting"
                                                    @click="ws.exportItemAuditLogsCsv"
                                                >
                                                    {{ ws.itemAuditExporting ? 'Preparing...' : 'Export CSV' }}
                                                </Button>
                                            </div>
                                        </div>

                                        <p v-if="ws.itemAuditLoading" class="text-sm text-muted-foreground">Loading audit logs...</p>
                                        <Alert v-else-if="ws.itemAuditError" variant="destructive">
                                            <AlertTitle>Audit load issue</AlertTitle>
                                            <AlertDescription>{{ ws.itemAuditError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="ws.itemAuditLogs.length === 0" class="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                                            No audit logs found for the current filters.
                                        </div>
                                        <div v-else class="overflow-hidden rounded-lg border">
                                            <div v-for="log in ws.itemAuditLogs" :key="log.id" class="border-b p-2 text-xs transition-colors last:border-b-0 hover:bg-muted/30">
                                                <p class="font-medium">{{ log.action }}</p>
                                                <p class="text-muted-foreground">{{ ws.formatDateTime(log.createdAt) }} | {{ ws.auditActorLabel(log) }}</p>
                                            </div>
                                        </div>

                                        <div class="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                :disabled="ws.itemAuditLoading || !ws.itemAuditMeta || ws.itemAuditMeta.currentPage <= 1"
                                                @click="ws.goToItemAuditPage((ws.itemAuditMeta?.currentPage ?? 2) - 1)"
                                            >
                                                Previous
                                            </Button>
                                            <p>
                                                Page {{ ws.itemAuditMeta?.currentPage ?? 1 }} of {{ ws.itemAuditMeta?.lastPage ?? 1 }}
                                                | {{ ws.itemAuditMeta?.total ?? ws.itemAuditLogs.length }} logs
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                :disabled="ws.itemAuditLoading || !ws.itemAuditMeta || ws.itemAuditMeta.currentPage >= ws.itemAuditMeta.lastPage"
                                                @click="ws.goToItemAuditPage((ws.itemAuditMeta?.currentPage ?? 0) + 1)"
                                            >
                                                Next
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </div>
                    </ScrollArea>
                </Tabs>
            </div>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.itemDetailsOpen = false">Close</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
