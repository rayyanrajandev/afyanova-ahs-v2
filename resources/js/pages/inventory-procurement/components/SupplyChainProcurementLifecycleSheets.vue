<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
<Sheet :open="ws.placeOrderDialogOpen" @update:open="ws.placeOrderDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Place Purchase Order</SheetTitle>
                <SheetDescription>{{ ws.placeOrderRequest?.requestNumber ?? 'Request' }}</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-5 grid gap-5">
                <Alert v-if="ws.placeOrderRequest?.sourceDepartmentRequisitionId" class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AppIcon name="activity" class="size-4" />
                    <AlertTitle>Replenishes a department shortage</AlertTitle>
                    <AlertDescription>
                        After receiving this stock into store, reopen {{ ws.procurementSourceLabel(ws.placeOrderRequest) }} and complete the remaining issue to the department.
                    </AlertDescription>
                </Alert>

                <!-- Request context -->
                <div class="rounded-lg border bg-muted/20 p-4 grid gap-2 text-sm">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p class="font-medium leading-tight">{{ ws.placeOrderRequest?.itemName ?? ws.placeOrderRequest?.item?.itemName ?? 'Item' }}</p>
                            <p class="text-xs text-muted-foreground mt-0.5">{{ ws.placeOrderRequest?.requestNumber ?? '' }}</p>
                        </div>
                        <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">Approved</span>
                    </div>
                    <div class="grid grid-cols-3 gap-3 pt-1 border-t text-xs text-muted-foreground">
                        <div>
                            <p class="font-medium text-foreground">{{ ws.placeOrderRequest?.requestedQuantity ?? '—' }}</p>
                            <p>Requested qty</p>
                        </div>
                        <div>
                            <p class="font-medium text-foreground">{{ ws.placeOrderRequest?.unitCostEstimate != null ? `TZS ${Number(ws.placeOrderRequest.unitCostEstimate).toLocaleString()}` : '—' }}</p>
                            <p>Unit cost est.</p>
                        </div>
                        <div>
                            <p class="font-medium text-foreground">{{ ws.placeOrderRequest?.neededBy ?? '—' }}</p>
                            <p>Needed by</p>
                        </div>
                    </div>
                </div>

                <!-- PO Number + Ordered Quantity -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-1.5">
                        <Label for="inv-place-order-number">PO Number <span class="text-destructive">*</span></Label>
                        <Input id="inv-place-order-number" v-model="ws.placeOrderForm.purchaseOrderNumber" placeholder="PO-2026-0001" />
                        <p v-if="ws.fieldError(ws.placeOrderErrors, 'purchaseOrderNumber')" class="text-xs text-destructive">{{ ws.fieldError(ws.placeOrderErrors, 'purchaseOrderNumber') }}</p>
                    </div>
                    <div class="grid gap-1.5">
                        <Label for="inv-place-order-qty">Ordered Quantity <span class="text-destructive">*</span></Label>
                        <Input id="inv-place-order-qty" v-model="ws.placeOrderForm.orderedQuantity" type="number" min="0" step="0.001" />
                        <p v-if="ws.fieldError(ws.placeOrderErrors, 'orderedQuantity')" class="text-xs text-destructive">{{ ws.fieldError(ws.placeOrderErrors, 'orderedQuantity') }}</p>
                    </div>
                </div>

                <!-- Supplier -->
                <div class="grid gap-1.5">
                    <Label for="inv-place-order-supplier">Supplier</Label>
                    <Select :model-value="ws.toSelectValue(ws.placeOrderForm.supplierId)" @update:model-value="ws.placeOrderForm.supplierId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                        <SelectTrigger class="w-full">
                            <SelectValue placeholder="— Not specified —">
                                {{ ws.supplierLabel(ws.placeOrderForm.supplierId) }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Not specified —</SelectItem>
                        <SelectItem v-for="s in ws.suppliers" :key="s.id" :value="s.id" :text-value="ws.lookupOptionText(s)">{{ s.name }}{{ s.code ? ` (${s.code})` : '' }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <p class="text-xs text-muted-foreground">Pre-filled from the purchase request. Change if directing to a different supplier.</p>
                </div>

                <!-- Unit Cost + Needed By -->
                <div class="grid grid-cols-2 gap-4">
                    <div class="grid gap-1.5">
                        <Label for="inv-place-order-unit-cost">Unit Cost Estimate</Label>
                        <Input id="inv-place-order-unit-cost" v-model="ws.placeOrderForm.unitCostEstimate" type="number" min="0" step="0.01" />
                        <p v-if="ws.fieldError(ws.placeOrderErrors, 'unitCostEstimate')" class="text-xs text-destructive">{{ ws.fieldError(ws.placeOrderErrors, 'unitCostEstimate') }}</p>
                    </div>
                    <SingleDatePopoverField input-id="inv-place-order-needed-by" label="Needed By" v-model="ws.placeOrderForm.neededBy" />
                </div>

                <!-- Notes -->
                <div class="grid gap-1.5">
                    <Label for="inv-place-order-notes">Notes</Label>
                    <Textarea id="inv-place-order-notes" v-model="ws.placeOrderForm.notes" rows="3" />
                </div>

                <Alert v-if="ws.placeOrderError" variant="destructive">
                    <AlertDescription>{{ ws.placeOrderError }}</AlertDescription>
                </Alert>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.placeOrderDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.placeOrderSubmitting" class="gap-1.5" @click="ws.submitPlaceOrder">
                    <AppIcon name="shopping-cart" class="size-3.5" />
                    {{ ws.placeOrderSubmitting ? 'Placing...' : 'Place Order' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.receiveDialogOpen" @update:open="ws.receiveDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Receive Goods</SheetTitle>
                <SheetDescription>Record physical receipt against procurement request {{ ws.receiveRequest?.requestNumber ?? '' }}</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-5 grid gap-5">
                <Alert v-if="ws.receiveRequest?.sourceDepartmentRequisitionId" class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AppIcon name="activity" class="size-4" />
                    <AlertTitle>Department shortage handoff</AlertTitle>
                    <AlertDescription>
                        This receipt replenishes {{ ws.procurementSourceLabel(ws.receiveRequest) }}. Once saved, use Complete Issue from the procurement row or Shortages to issue the remaining quantity.
                    </AlertDescription>
                </Alert>

                <!-- Request context -->
                <div class="rounded-lg border bg-muted/20 p-4 grid gap-2 text-sm">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p class="font-semibold">{{ ws.receiveRequest?.itemName || ws.receiveRequest?.itemId }}</p>
                            <p class="text-xs text-muted-foreground mt-0.5">
                                {{ ws.receiveRequest?.requestNumber }}
                                <template v-if="ws.receiveRequest?.purchaseOrderNumber"> &middot; PO: {{ ws.receiveRequest.purchaseOrderNumber }}</template>
                                <template v-if="ws.receiveRequest?.supplierName"> &middot; {{ ws.receiveRequest.supplierName }}</template>
                            </p>
                        </div>
                        <Badge variant="outline">{{ formatEnumLabel(ws.receiveRequest?.status ?? '') }}</Badge>
                    </div>
                    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 mt-1">
                        <div>
                            <p class="text-[11px] text-muted-foreground">Ordered Qty</p>
                            <p class="font-semibold tabular-nums">{{ ws.receiveRequest?.orderedQuantity ?? ws.receiveRequest?.requestedQuantity ?? '—' }}</p>
                        </div>
                        <div>
                            <p class="text-[11px] text-muted-foreground">Unit Cost Est.</p>
                            <p class="font-semibold tabular-nums">{{ ws.receiveRequest?.unitCostEstimate ? ws.formatAmount(ws.receiveRequest.unitCostEstimate) : '—' }}</p>
                        </div>
                        <div>
                            <p class="text-[11px] text-muted-foreground">Needed By</p>
                            <p class="font-semibold">{{ ws.receiveRequest?.neededBy ?? '—' }}</p>
                        </div>
                    </div>
                </div>

                <Separator />

                <!-- Received unit + quantity + actual unit cost -->
                <div class="grid gap-4 sm:grid-cols-3">
                    <div class="grid gap-2">
                        <Label for="inv-receive-unit">Received Unit</Label>
                        <Select :model-value="(ws.receiveForm as any).receivedUnit || undefined" @update:model-value="(ws.receiveForm as any).receivedUnit = ($event ?? '')">
                            <SelectTrigger class="w-full">
                                <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">Base / default</SelectItem>
                                <SelectItem v-for="u in (ws as any).receiveItemUnits ?? []" :key="u.id ?? u.unitName" :value="u.unitName">{{ u.unitName }} ({{ u.baseQuantity }} {{ ws.receiveRequest?.unit ?? 'base' }})</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-receive-qty">Received Quantity *</Label>
                        <Input id="inv-receive-qty" v-model="ws.receiveForm.receivedQuantity" type="number" min="0.001" step="0.001" />
                        <p v-if="ws.fieldError(ws.receiveErrors, 'receivedQuantity')" class="text-xs text-destructive">{{ ws.fieldError(ws.receiveErrors, 'receivedQuantity') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-receive-unit-cost">Actual Unit Cost <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                        <Input id="inv-receive-unit-cost" v-model="ws.receiveForm.receivedUnitCost" type="number" min="0" step="0.01" placeholder="Actual cost from delivery note" />
                        <p v-if="ws.fieldError(ws.receiveErrors, 'receivedUnitCost')" class="text-xs text-destructive">{{ ws.fieldError(ws.receiveErrors, 'receivedUnitCost') }}</p>
                    </div>
                </div>

                <!-- Destination warehouse -->
                <div class="grid gap-2">
                    <Label for="inv-receive-warehouse-id">Received Into — Warehouse <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                    <Select :model-value="ws.toSelectValue(ws.receiveForm.warehouseId)" @update:model-value="ws.receiveForm.warehouseId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                        <SelectTrigger class="w-full">
                            <SelectValue placeholder="— Select warehouse —">
                                {{ ws.warehouseLabel(ws.receiveForm.warehouseId) }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select warehouse —</SelectItem>
                        <SelectItem v-for="w in ws.warehouses" :key="w.id" :value="w.id" :text-value="ws.lookupOptionText(w)">
                            {{ w.name }}<template v-if="w.code"> ({{ w.code }})</template>
                        </SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="ws.fieldError(ws.receiveErrors, 'warehouseId')" class="text-xs text-destructive">{{ ws.fieldError(ws.receiveErrors, 'warehouseId') }}</p>
                </div>

                <div v-if="ws.receiveRequiresBatchTracking" class="grid gap-4 rounded-lg border border-border/70 bg-muted/20 p-4">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <p class="text-sm font-medium">Batch receipt details</p>
                            <p class="text-xs text-muted-foreground">
                                {{ ws.receiveTrackedCategory?.label ?? 'Expiry-sensitive stock' }} must enter stores with batch and expiry traceability.
                            </p>
                        </div>
                        <Badge variant="secondary" class="shrink-0">Batch tracked</Badge>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="inv-receive-batch-number">Batch Number *</Label>
                            <Input id="inv-receive-batch-number" v-model="ws.receiveForm.batchNumber" placeholder="e.g. BATCH-2026-001" />
                            <p v-if="ws.fieldError(ws.receiveErrors, 'batchNumber')" class="text-xs text-destructive">{{ ws.fieldError(ws.receiveErrors, 'batchNumber') }}</p>
                        </div>
                        <SingleDatePopoverField
                            input-id="inv-receive-expiry-date"
                            label="Expiry Date *"
                            v-model="ws.receiveForm.expiryDate"
                            :error-message="ws.fieldError(ws.receiveErrors, 'expiryDate')"
                        />
                    </div>

                    <div class="grid gap-4 sm:grid-cols-3">
                        <div class="grid gap-2">
                            <Label for="inv-receive-lot-number">Lot Number <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Input id="inv-receive-lot-number" v-model="ws.receiveForm.lotNumber" placeholder="Supplier lot reference" />
                            <p v-if="ws.fieldError(ws.receiveErrors, 'lotNumber')" class="text-xs text-destructive">{{ ws.fieldError(ws.receiveErrors, 'lotNumber') }}</p>
                        </div>
                        <SingleDatePopoverField
                            input-id="inv-receive-manufacture-date"
                            label="Manufacture Date"
                            helper-text="Optional"
                            v-model="ws.receiveForm.manufactureDate"
                            :error-message="ws.fieldError(ws.receiveErrors, 'manufactureDate')"
                        />
                        <div class="grid gap-2">
                            <Label for="inv-receive-bin-location">Bin Location <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                            <Input id="inv-receive-bin-location" v-model="ws.receiveForm.binLocation" placeholder="Rack / shelf / cold-room bin" />
                            <p v-if="ws.fieldError(ws.receiveErrors, 'binLocation')" class="text-xs text-destructive">{{ ws.fieldError(ws.receiveErrors, 'binLocation') }}</p>
                        </div>
                    </div>
                </div>

                <!-- Timing + reason -->
                <div class="grid gap-4 sm:grid-cols-2">
                    <div class="grid gap-2">
                        <Label for="inv-receive-occurred-at">Delivery Date &amp; Time <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                        <Input id="inv-receive-occurred-at" v-model="ws.receiveForm.occurredAt" type="datetime-local" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="inv-receive-reason">Reason <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                        <Input id="inv-receive-reason" v-model="ws.receiveForm.reason" placeholder="e.g. Regular delivery, Emergency supply" />
                    </div>
                </div>

                <!-- Notes -->
                <div class="grid gap-2">
                    <Label for="inv-receive-notes">Notes <span class="text-xs font-normal text-muted-foreground">optional</span></Label>
                    <Textarea id="inv-receive-notes" v-model="ws.receiveForm.notes" rows="3" placeholder="Delivery note number, batch reference, condition on receipt..." />
                </div>

                <Alert v-if="ws.receiveError" variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{{ ws.receiveError }}</AlertDescription>
                </Alert>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.receiveDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.receiveSubmitting" class="gap-1.5" @click="ws.submitReceiveGoods">
                    <AppIcon name="package-check" class="size-3.5" />
                    {{ ws.receiveSubmitting ? 'Receiving...' : 'Confirm Receipt' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.statusDialogOpen" @update:open="ws.statusDialogOpen = $event">
        <SheetContent side="right" variant="action" size="lg">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Update Procurement Status</SheetTitle>
                <SheetDescription>{{ ws.statusRequest?.requestNumber ?? 'Request' }}</SheetDescription>
            </SheetHeader>
            <div class="px-6 py-4 space-y-3">
                <div class="space-y-1">
                    <Label>Status</Label>
                    <Select :model-value="ws.toSelectValue(ws.statusValue)" @update:model-value="ws.statusValue = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem v-for="item in ws.procurementManualStatusOptions" :key="item" :value="item">{{ formatEnumLabel(item) }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="space-y-1">
                    <Label>Reason</Label>
                    <Input v-model="ws.statusReason" placeholder="Required for rejected/cancelled" />
                </div>
                <p v-if="ws.statusError" class="text-xs text-red-600">{{ ws.statusError }}</p>
            </div>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.statusDialogOpen = false">Close</Button>
                <Button :disabled="ws.statusSubmitting" @click="ws.submitStatusUpdate">{{ ws.statusSubmitting ? 'Saving...' : 'Save' }}</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.detailsOpen" @update:open="ws.detailsOpen = $event">
        <SheetContent side="right" variant="workspace">
            <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                <SheetTitle>Procurement Request Details</SheetTitle>
                <SheetDescription>{{ ws.detailsRequest?.requestNumber }}</SheetDescription>
            </SheetHeader>
            <div class="px-6 py-4 space-y-4">
                <Alert v-if="ws.detailsRequest?.sourceDepartmentRequisitionId" class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    <AppIcon name="activity" class="size-4" />
                    <AlertTitle>Raised from department shortage</AlertTitle>
                    <AlertDescription>
                        {{ ws.procurementSourceLabel(ws.detailsRequest) }} | Line {{ ws.detailsRequest.sourceDepartmentRequisitionLineId || 'N/A' }}
                    </AlertDescription>
                    <Button
                        size="sm"
                        variant="outline"
                        class="mt-3 bg-background/80"
                        :disabled="ws.sourceRequisitionOpeningId === String(ws.detailsRequest?.id)"
                        @click="ws.openSourceRequisitionFromProcurement(ws.detailsRequest)"
                    >
                        {{ ws.sourceRequisitionOpeningId === String(ws.detailsRequest?.id) ? 'Opening...' : 'Open source requisition' }}
                    </Button>
                </Alert>
                <div class="grid gap-2 text-sm sm:grid-cols-2">
                    <p><span class="text-muted-foreground">Request Number:</span> {{ ws.detailsRequest?.requestNumber }}</p>
                    <p><span class="text-muted-foreground">PO Number:</span> {{ ws.detailsRequest?.purchaseOrderNumber || 'N/A' }}</p>
                    <p><span class="text-muted-foreground">Status:</span> {{ formatEnumLabel(ws.detailsRequest?.status ?? 'n/a') }}</p>
                    <p><span class="text-muted-foreground">Item ID:</span> {{ ws.detailsRequest?.itemId }}</p>
                    <p><span class="text-muted-foreground">Requested Qty:</span> {{ ws.detailsRequest?.requestedQuantity }}</p>
                    <p><span class="text-muted-foreground">Ordered Qty:</span> {{ ws.detailsRequest?.orderedQuantity ?? 'N/A' }}</p>
                    <p><span class="text-muted-foreground">Received Qty:</span> {{ ws.detailsRequest?.receivedQuantity ?? 'N/A' }}</p>
                    <p><span class="text-muted-foreground">Unit Cost:</span> {{ ws.formatAmount(ws.detailsRequest?.unitCostEstimate) }}</p>
                    <p><span class="text-muted-foreground">Received Unit Cost:</span> {{ ws.formatAmount(ws.detailsRequest?.receivedUnitCost) }}</p>
                    <p><span class="text-muted-foreground">Total Est:</span> {{ ws.formatAmount(ws.detailsRequest?.totalCostEstimate) }}</p>
                    <p><span class="text-muted-foreground">Needed By:</span> {{ ws.formatDateOnly(ws.detailsRequest?.neededBy) }}</p>
                    <p><span class="text-muted-foreground">Supplier:</span> {{ ws.detailsRequest?.supplierName || ws.supplierLabel(ws.detailsRequest?.supplierId) || 'N/A' }}</p>
                    <p v-if="ws.detailsRequest?.sourceDepartmentRequisitionId"><span class="text-muted-foreground">Source Approved:</span> {{ ws.detailsRequest?.sourceLineApprovedQuantity ?? 'N/A' }} {{ ws.detailsRequest?.sourceLineUnit ?? '' }}</p>
                    <p v-if="ws.detailsRequest?.sourceDepartmentRequisitionId"><span class="text-muted-foreground">Source Issued:</span> {{ ws.detailsRequest?.sourceLineIssuedQuantity ?? 'N/A' }} {{ ws.detailsRequest?.sourceLineUnit ?? '' }}</p>
                    <p><span class="text-muted-foreground">Receiving Warehouse ID:</span> {{ ws.detailsRequest?.receivingWarehouseId || 'N/A' }}</p>
                    <p><span class="text-muted-foreground">Approved At:</span> {{ ws.formatDateTime(ws.detailsRequest?.approvedAt) }}</p>
                    <p><span class="text-muted-foreground">Ordered At:</span> {{ ws.formatDateTime(ws.detailsRequest?.orderedAt) }}</p>
                    <p><span class="text-muted-foreground">Received At:</span> {{ ws.formatDateTime(ws.detailsRequest?.receivedAt) }}</p>
                </div>
                <div class="rounded border p-3 text-sm">
                    <p class="font-medium">Status Reason</p>
                    <p class="text-muted-foreground">{{ ws.detailsRequest?.statusReason || 'N/A' }}</p>
                </div>
                <div class="rounded border p-3 text-sm">
                    <p class="font-medium">Receiving Notes</p>
                    <p class="text-muted-foreground">{{ ws.detailsRequest?.receivingNotes || 'N/A' }}</p>
                </div>
                <div class="rounded border p-3 text-sm">
                    <p class="font-medium">Audit Logs</p>
                    <Alert v-if="!ws.canViewAudit" variant="destructive" class="mt-2">
                        <AlertTitle>Audit Access Restricted</AlertTitle>
                        <AlertDescription>Request <code>inventory.procurement.view-audit-logs</code> permission.</AlertDescription>
                    </Alert>
                    <div v-else class="mt-2 space-y-3">
                        <div class="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-q">Action Text Search</Label>
                                <Input id="inv-details-audit-q" v-model="ws.detailsAuditFilters.q" placeholder="status.updated, created, approved..." />
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-action">Action (exact)</Label>
                                <Input id="inv-details-audit-action" v-model="ws.detailsAuditFilters.action" placeholder="Optional exact action key" />
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-actor-type">Actor Type</Label>
                                <Select :model-value="ws.toSelectValue(ws.detailsAuditFilters.actorType)" @update:model-value="ws.detailsAuditFilters.actorType = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem
                                        v-for="option in ws.auditActorTypeOptions"
                                        :key="`inv-audit-actor-type-${option.value || 'all'}`"
                                        :value="ws.toSelectValue(option.value)"
                                    >
                                        {{ option.label }}
                                    </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-actor-id">Actor ID</Label>
                                <Input id="inv-details-audit-actor-id" v-model="ws.detailsAuditFilters.actorId" inputmode="numeric" placeholder="Optional user id" />
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-from">From</Label>
                                <Input id="inv-details-audit-from" v-model="ws.detailsAuditFilters.from" type="datetime-local" />
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-to">To</Label>
                                <Input id="inv-details-audit-to" v-model="ws.detailsAuditFilters.to" type="datetime-local" />
                            </div>
                            <div class="grid gap-1">
                                <Label for="inv-details-audit-per-page">Rows Per Page</Label>
                                <Select :model-value="String(ws.detailsAuditFilters.perPage)" @update:model-value="ws.detailsAuditFilters.perPage = Number($event)">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                    <SelectItem value="150">150</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="flex flex-wrap items-end gap-2">
                                <Button size="sm" :disabled="ws.detailsAuditLoading" @click="ws.applyDetailsAuditFilters">
                                    {{ ws.detailsAuditLoading ? 'Applying...' : 'Apply Filters' }}
                                </Button>
                                <Button size="sm" variant="outline" :disabled="ws.detailsAuditLoading" @click="ws.resetDetailsAuditFilters">
                                    Reset
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    :disabled="ws.detailsAuditLoading || ws.detailsAuditExporting"
                                    @click="ws.exportDetailsAuditLogsCsv"
                                >
                                    {{ ws.detailsAuditExporting ? 'Preparing...' : 'Export CSV' }}
                                </Button>
                            </div>
                        </div>
                        <p v-if="ws.detailsAuditLoading" class="text-muted-foreground">Loading audit logs...</p>
                        <p v-else-if="ws.detailsAuditError" class="text-red-600">{{ ws.detailsAuditError }}</p>
                        <p v-else-if="ws.detailsAuditLogs.length === 0" class="text-muted-foreground">No audit logs found for current filters.</p>
                        <div v-else class="overflow-hidden rounded-lg border">
                            <div v-for="log in ws.detailsAuditLogs" :key="log.id" class="border-b p-2 text-xs transition-colors last:border-b-0 hover:bg-muted/30">
                                <p class="font-medium">{{ log.action }}</p>
                                <p class="text-muted-foreground">{{ ws.formatDateTime(log.createdAt) }} | {{ ws.auditActorLabel(log) }}</p>
                            </div>
                        </div>
                        <div class="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                            <Button
                                size="sm"
                                variant="outline"
                                :disabled="ws.detailsAuditLoading || !ws.detailsAuditMeta || ws.detailsAuditMeta.currentPage <= 1"
                                @click="ws.goToDetailsAuditPage((ws.detailsAuditMeta?.currentPage ?? 2) - 1)"
                            >
                                Previous
                            </Button>
                            <p>
                                Page {{ ws.detailsAuditMeta?.currentPage ?? 1 }} of {{ ws.detailsAuditMeta?.lastPage ?? 1 }}
                                | {{ ws.detailsAuditMeta?.total ?? ws.detailsAuditLogs.length }} logs
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                :disabled="ws.detailsAuditLoading || !ws.detailsAuditMeta || ws.detailsAuditMeta.currentPage >= ws.detailsAuditMeta.lastPage"
                                @click="ws.goToDetailsAuditPage((ws.detailsAuditMeta?.currentPage ?? 0) + 1)"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.detailsOpen = false">Close</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>


