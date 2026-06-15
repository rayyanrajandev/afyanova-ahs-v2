<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();
</script>

<template>
<Sheet :open="ws.createRequisitionDialogOpen" @update:open="ws.createRequisitionDialogOpen = $event">
        <SheetContent side="right" variant="form" size="6xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="clipboard-list" class="size-5 text-muted-foreground" />
                    Create Department Requisition
                </SheetTitle>
                <SheetDescription>Submit an internal request for inventory items from a hospital department.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Request Details</legend>
                    <FormFieldShell
                        input-id="inv-req-dept"
                        label="Requesting Department"
                        :helper-text="ws.requisitionDepartmentHelperText"
                        :error-message="ws.fieldError(ws.reqCreateErrors, 'requestingDepartment')"
                    >
                        <Select :model-value="ws.toSelectValue(ws.reqForm.requestingDepartmentId)" @update:model-value="ws.updateRequisitionDepartment(String($event ?? ws.EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="inv-req-dept" class="w-full" :disabled="ws.reqCreateSubmitting || !ws.canSelectAnyRequisitionDepartment">
                                <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">Select department</SelectItem>
                                <SelectItem v-for="department in ws.requisitionDepartmentOptions" :key="department.id" :value="department.id" :text-value="ws.lookupOptionText(department)">
                                    {{ ws.lookupOptionText(department) }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <FormFieldShell
                        input-id="inv-req-warehouse"
                        label="Issuing Warehouse"
                        helper-text="Store location expected to issue the requested stock."
                        :error-message="ws.fieldError(ws.reqCreateErrors, 'issuingWarehouseId')"
                    >
                        <Select :model-value="ws.toSelectValue(ws.reqForm.issuingWarehouseId)" @update:model-value="ws.reqForm.issuingWarehouseId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="inv-req-warehouse" class="w-full" :disabled="ws.reqCreateSubmitting">
                                <SelectValue placeholder="Select warehouse" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">Select warehouse</SelectItem>
                                <SelectItem v-for="warehouse in ws.warehouses" :key="warehouse.id" :value="warehouse.id" :text-value="ws.lookupOptionText(warehouse)">
                                    {{ ws.lookupOptionText(warehouse) }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <FormFieldShell input-id="inv-req-dept-code" label="Department Code">
                        <Input id="inv-req-dept-code" :model-value="ws.selectedRequisitionDepartment?.code ?? 'Not selected'" disabled class="bg-muted/40" />
                    </FormFieldShell>
                    <FormFieldShell input-id="inv-req-warehouse-code" label="Warehouse Code">
                        <Input id="inv-req-warehouse-code" :model-value="ws.selectedRequisitionWarehouse?.code ?? 'Not selected'" disabled class="bg-muted/40" />
                    </FormFieldShell>
                    <FormFieldShell input-id="inv-req-priority" label="Priority">
                        <Select :model-value="ws.toSelectValue(ws.reqForm.priority)" @update:model-value="ws.reqForm.priority = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="inv-req-priority" class="w-full" :disabled="ws.reqCreateSubmitting">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="p in ws.REQUISITION_PRIORITIES" :key="p.value" :value="p.value">{{ p.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <SingleDatePopoverField input-id="inv-req-needed-by" label="Needed By" v-model="ws.reqForm.neededBy" :disabled="ws.reqCreateSubmitting" :error-message="ws.fieldError(ws.reqCreateErrors, 'neededBy')" />
                    <FormFieldShell input-id="inv-req-notes" label="Notes" class="sm:col-span-2">
                        <Input id="inv-req-notes" v-model="ws.reqForm.notes" :disabled="ws.reqCreateSubmitting" />
                    </FormFieldShell>
                </fieldset>

                <fieldset class="rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Requested Items</legend>
                    <div class="space-y-2">
                        <div v-for="(line, idx) in ws.reqForm.lines" :key="idx" class="rounded-lg border bg-muted/10 p-3">
                            <div class="grid gap-3 xl:grid-cols-[minmax(24rem,2fr)_7.5rem_7.5rem_minmax(14rem,1fr)_2.5rem] xl:items-start">
                            <div class="min-w-0">
                                <InventoryItemLookupField
                                    :input-id="`inv-req-line-item-${idx}`"
                                    v-model="line.itemId"
                                    :label="idx === 0 ? 'Inventory item' : 'Inventory item'"
                                    placeholder="Search item name, code, barcode..."
                                    helper-text="Search inventory master data."
                                    :error-message="ws.fieldError(ws.reqCreateErrors, `lines.${idx}.itemId`)"
                                    :disabled="ws.reqCreateSubmitting || !ws.selectedRequisitionDepartmentId"
                                    :requesting-department-id="ws.selectedRequisitionDepartmentId"
                                    browse-on-focus
                                    @selected="item => ws.handleReqLineItemSelected(idx, item)"
                                />
                            </div>
                            <FormFieldShell
                                :input-id="`inv-req-line-qty-${idx}`"
                                label="Qty"
                                :error-message="ws.fieldError(ws.reqCreateErrors, `lines.${idx}.requestedQuantity`)"
                            >
                                <Input :id="`inv-req-line-qty-${idx}`" v-model="line.requestedQuantity" :disabled="ws.reqCreateSubmitting" type="number" min="0" step="0.001" class="text-xs" />
                            </FormFieldShell>
                            <FormFieldShell
                                :input-id="`inv-req-line-unit-${idx}`"
                                label="Unit"
                                :error-message="ws.fieldError(ws.reqCreateErrors, `lines.${idx}.unit`)"
                            >
                                <Input :id="`inv-req-line-unit-${idx}`" v-model="line.unit" :disabled="ws.reqCreateSubmitting" placeholder="Auto" class="text-xs" />
                            </FormFieldShell>
                            <FormFieldShell :input-id="`inv-req-line-notes-${idx}`" label="Notes">
                                <Input :id="`inv-req-line-notes-${idx}`" v-model="line.notes" :disabled="ws.reqCreateSubmitting" class="text-xs" />
                            </FormFieldShell>
                            <Button v-if="ws.reqForm.lines.length > 1" size="sm" variant="ghost" class="mt-5 h-9 self-start" @click="ws.removeReqLine(idx)">
                                <AppIcon name="circle-x" class="size-3.5 text-destructive" />
                            </Button>
                            <div v-else class="hidden h-9 w-9 lg:block" />
                            </div>
                        </div>
                        <Button size="sm" variant="outline" class="gap-1" @click="ws.addReqLine">
                            <AppIcon name="plus" class="size-3" />
                            Add Line
                        </Button>
                    </div>
                    <p v-if="ws.fieldError(ws.reqCreateErrors, 'lines')" class="mt-1 text-xs text-destructive">{{ ws.fieldError(ws.reqCreateErrors, 'lines') }}</p>
                </fieldset>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.createRequisitionDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.reqCreateSubmitting" class="gap-1.5" @click="ws.submitCreateRequisition">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ ws.reqCreateSubmitting ? 'Creating...' : 'Create Requisition' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.createProcurementDialogOpen" @update:open="ws.createProcurementDialogOpen = $event">
        <SheetContent side="right" variant="form" size="6xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="clipboard-list" class="size-5 text-muted-foreground" />
                    Create Procurement Request
                </SheetTitle>
                <SheetDescription>Request supplier procurement for an inventory item from master data.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <Alert v-if="ws.procurementForm.sourceSummary" class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AppIcon name="activity" class="size-4" />
                    <AlertTitle>Raised from department shortage</AlertTitle>
                    <AlertDescription>
                        {{ ws.procurementForm.sourceSummary }}. The linked item and source trace are carried into the procurement request.
                        <span v-if="ws.fieldError(ws.procurementErrors, 'sourceDepartmentRequisitionLineId')" class="mt-1 block font-medium text-destructive">
                            {{ ws.fieldError(ws.procurementErrors, 'sourceDepartmentRequisitionLineId') }}
                        </span>
                    </AlertDescription>
                </Alert>

                <fieldset class="rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Inventory Item</legend>
                    <div class="grid gap-3">
                        <InventoryItemLookupField
                            input-id="inv-proc-item-id"
                            v-model="ws.procurementForm.itemId"
                            label="Inventory item"
                            placeholder="Search item name, code, barcode..."
                            helper-text="Search inventory master data. Item details are loaded from the catalogue."
                            browse-on-focus
                            :disabled="ws.procurementSubmitting || ws.procurementLockedToSource"
                            :error-message="ws.fieldError(ws.procurementErrors, 'itemId')"
                            @selected="item => ws.handleProcurementItemSelected(item)"
                        />

                        <Alert v-if="ws.procurementForm.itemId && ws.activeRequestsForItem.length > 0" class="border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                            <AppIcon name="info" class="size-4" />
                            <AlertTitle>Active requests for this item</AlertTitle>
                            <AlertDescription>
                                <div class="mt-2 space-y-1 text-xs">
                                    <div v-for="req in ws.activeRequestsForItem" :key="req.requestNumber" class="flex justify-between gap-2">
                                        <span>{{ req.requestNumber }} · {{ req.quantity }} {{ req.unit }}</span>
                                        <span class="text-blue-700 dark:text-blue-200">{{ req.status }}</span>
                                    </div>
                                </div>
                            </AlertDescription>
                        </Alert>

                        <div class="grid gap-3 sm:grid-cols-2">
                            <FormFieldShell input-id="inv-proc-item-code" label="Item Code">
                                <Input
                                    id="inv-proc-item-code"
                                    :model-value="ws.selectedProcurementItem?.itemCode ?? 'Not selected'"
                                    disabled
                                    class="bg-muted/40"
                                />
                            </FormFieldShell>
                            <FormFieldShell input-id="inv-proc-item-category" label="Category">
                                <Input
                                    id="inv-proc-item-category"
                                    :model-value="ws.selectedProcurementItem?.category ? ws.formatEnumLabel(ws.selectedProcurementItem.category) : 'Not selected'"
                                    disabled
                                    class="bg-muted/40"
                                />
                            </FormFieldShell>
                            <FormFieldShell input-id="inv-proc-item-unit" label="Unit">
                                <Input
                                    id="inv-proc-item-unit"
                                    :model-value="(ws.selectedProcurementItem?.unit ?? ws.procurementForm.unit) || 'Not selected'"
                                    disabled
                                    class="bg-muted/40"
                                />
                            </FormFieldShell>
                            <FormFieldShell input-id="inv-proc-item-reorder" label="Reorder Level">
                                <Input
                                    id="inv-proc-item-reorder"
                                    :model-value="(ws.selectedProcurementItem?.reorderLevel ?? ws.procurementForm.reorderLevel) || '—'"
                                    disabled
                                    class="bg-muted/40"
                                />
                            </FormFieldShell>
                            <FormFieldShell input-id="inv-proc-item-stock" label="Current Stock" class="sm:col-span-2">
                                <Input
                                    id="inv-proc-item-stock"
                                    :model-value="ws.selectedProcurementItem?.currentStock ?? '—'"
                                    disabled
                                    class="bg-muted/40"
                                />
                            </FormFieldShell>
                        </div>
                    </div>
                </fieldset>

                <fieldset class="grid gap-3 sm:grid-cols-2 rounded-lg border p-3">
                    <legend class="px-2 text-sm font-medium text-muted-foreground">Request Details</legend>
                    <FormFieldShell
                        input-id="inv-proc-req-qty"
                        label="Requested Quantity"
                        helper-text="Quantity to procure from the supplier."
                        :error-message="ws.fieldError(ws.procurementErrors, 'requestedQuantity')"
                    >
                        <Input
                            id="inv-proc-req-qty"
                            v-model="ws.procurementForm.requestedQuantity"
                            :disabled="ws.procurementSubmitting"
                            type="number"
                            min="0"
                            step="0.001"
                        />
                    </FormFieldShell>
                    <FormFieldShell
                        input-id="inv-proc-unit-cost"
                        label="Unit Cost Estimate"
                        helper-text="Optional estimate for budget and approval routing."
                        :error-message="ws.fieldError(ws.procurementErrors, 'unitCostEstimate')"
                    >
                        <Input
                            id="inv-proc-unit-cost"
                            v-model="ws.procurementForm.unitCostEstimate"
                            :disabled="ws.procurementSubmitting"
                            type="number"
                            min="0"
                            step="0.01"
                        />
                    </FormFieldShell>
                    <SingleDatePopoverField
                        input-id="inv-proc-needed-by"
                        label="Needed By"
                        v-model="ws.procurementForm.neededBy"
                        :disabled="ws.procurementSubmitting"
                        :error-message="ws.fieldError(ws.procurementErrors, 'neededBy')"
                    />
                    <FormFieldShell
                        input-id="inv-proc-supplier"
                        label="Preferred Supplier"
                        helper-text="Optional supplier preference for this request."
                        :error-message="ws.fieldError(ws.procurementErrors, 'supplierId')"
                    >
                        <Select
                            :model-value="ws.toSelectValue(ws.procurementForm.supplierId)"
                            @update:model-value="ws.procurementForm.supplierId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))"
                        >
                            <SelectTrigger id="inv-proc-supplier" class="w-full" :disabled="ws.procurementSubmitting">
                                <SelectValue placeholder="Not specified">
                                    {{ ws.supplierLabel(ws.procurementForm.supplierId) || 'Not specified' }}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">Not specified</SelectItem>
                                <SelectItem
                                    v-for="supplier in ws.suppliers"
                                    :key="supplier.id"
                                    :value="supplier.id"
                                    :text-value="ws.lookupOptionText(supplier)"
                                >
                                    {{ ws.lookupOptionText(supplier) }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </FormFieldShell>
                    <FormFieldShell input-id="inv-proc-notes" label="Notes" class="sm:col-span-2">
                        <Textarea
                            id="inv-proc-notes"
                            v-model="ws.procurementForm.notes"
                            :disabled="ws.procurementSubmitting"
                            rows="3"
                            placeholder="Additional context for approvers or suppliers"
                        />
                    </FormFieldShell>
                </fieldset>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.createProcurementDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.procurementSubmitDisabled" class="gap-1.5" @click="ws.submitProcurementRequest">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ ws.procurementSubmitting ? 'Creating...' : 'Create Request' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
