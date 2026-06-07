<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

<Sheet :open="createProcurementDialogOpen" @update:open="createProcurementDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="plus" class="size-5 text-muted-foreground" />
                    Create Procurement Request
                </SheetTitle>
                <SheetDescription>Request procurement for an existing or new inventory item.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-3 sm:grid-cols-2">
                <Alert v-if="ws.procurementForm.sourceSummary" class="sm:col-span-2 border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AppIcon name="activity" class="size-4" />
                    <AlertTitle>Raised from department shortage</AlertTitle>
                    <AlertDescription>
                        {{ ws.procurementForm.sourceSummary }}. The linked item and source trace are carried into the procurement request.
                        <span v-if="ws.fieldError(ws.procurementErrors, 'sourceDepartmentRequisitionLineId')" class="mt-1 block font-medium text-destructive">
                            {{ ws.fieldError(ws.procurementErrors, 'sourceDepartmentRequisitionLineId') }}
                        </span>
                    </AlertDescription>
                </Alert>
                <div class="grid gap-2 sm:col-span-2">
                    <Label for="inv-proc-item-id">Existing Inventory Item</Label>
                    <Input id="inv-proc-item-id" v-model="ws.procurementForm.itemId" :disabled="ws.procurementSubmitting || ws.procurementLockedToSource" placeholder="Use existing item UUID if known" />
                    <p v-if="ws.procurementUsesExistingItem" class="text-xs text-muted-foreground">
                        Linked request: item name, category, and unit come from the inventory master and should not be retyped.
                    </p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-item-name">Item Name</Label>
                    <Input id="inv-proc-item-name" v-model="ws.procurementForm.itemName" :disabled="ws.procurementSubmitting || ws.procurementUsesExistingItem" />
                    <p v-if="ws.fieldError(ws.procurementErrors, 'itemName')" class="text-xs text-destructive">{{ ws.fieldError(ws.procurementErrors, 'itemName') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-category">Category</Label>
                    <Input id="inv-proc-category" v-model="ws.procurementForm.category" :disabled="ws.procurementSubmitting || ws.procurementUsesExistingItem" />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-unit">Unit</Label>
                    <Input id="inv-proc-unit" v-model="ws.procurementForm.unit" :disabled="ws.procurementSubmitting || ws.procurementUsesExistingItem" />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-reorder-level">Reorder Level</Label>
                    <Input id="inv-proc-reorder-level" v-model="ws.procurementForm.reorderLevel" :disabled="ws.procurementSubmitting || ws.procurementUsesExistingItem" type="number" min="0" step="0.001" />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-req-qty">Requested Quantity</Label>
                    <Input id="inv-proc-req-qty" v-model="ws.procurementForm.requestedQuantity" :disabled="ws.procurementSubmitting" type="number" min="0" step="0.001" />
                    <p v-if="ws.fieldError(ws.procurementErrors, 'requestedQuantity')" class="text-xs text-destructive">{{ ws.fieldError(ws.procurementErrors, 'requestedQuantity') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-proc-unit-cost">Unit Cost Estimate</Label>
                    <Input id="inv-proc-unit-cost" v-model="ws.procurementForm.unitCostEstimate" :disabled="ws.procurementSubmitting" type="number" min="0" step="0.01" />
                </div>
                <SingleDatePopoverField input-id="inv-proc-needed-by" label="Needed By" v-model="ws.procurementForm.neededBy" :disabled="ws.procurementSubmitting" />
                <div class="grid gap-2">
                    <Label for="inv-proc-supplier">Preferred Supplier</Label>
                    <Select :model-value="ws.toSelectValue(ws.procurementForm.supplierId)" @update:model-value="ws.procurementForm.supplierId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                        <SelectTrigger class="w-full" :disabled="ws.procurementSubmitting">
                            <SelectValue placeholder="— Not specified —">
                                {{ ws.supplierLabel(ws.procurementForm.supplierId) }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Not specified —</SelectItem>
                        <SelectItem v-for="s in ws.suppliers" :key="s.id" :value="s.id" :text-value="ws.lookupOptionText(s)">{{ s.name }}{{ s.code ? ` (${s.code})` : '' }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="grid gap-2 sm:col-span-2">
                    <Label for="inv-proc-notes">Notes</Label>
                    <Textarea id="inv-proc-notes" v-model="ws.procurementForm.notes" :disabled="ws.procurementSubmitting" rows="3" />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="createProcurementDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.procurementSubmitting" class="gap-1.5" @click="ws.submitProcurementRequest">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ ws.procurementSubmitting ? 'Creating...' : 'Create Request' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
