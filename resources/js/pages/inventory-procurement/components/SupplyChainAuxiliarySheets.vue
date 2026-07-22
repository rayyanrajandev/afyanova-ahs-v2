<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatEnumLabel } from '@/lib/labels';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();
</script>

<template>
<Sheet :open="ws.createBatchDialogOpen" @update:open="ws.createBatchDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="package" class="size-5 text-muted-foreground" />
                    Add Batch / Lot
                </SheetTitle>
                <SheetDescription>Record a new batch for {{ ws.itemDetails?.itemName ?? 'this item' }}.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-3 sm:grid-cols-2">
                <div class="grid gap-2">
                    <Label for="inv-batch-number">Batch Number</Label>
                    <Input id="inv-batch-number" v-model="ws.batchForm.batchNumber" :disabled="ws.batchCreateSubmitting" />
                    <p v-if="ws.fieldError(ws.batchCreateErrors, 'batchNumber')" class="text-xs text-destructive">{{ ws.fieldError(ws.batchCreateErrors, 'batchNumber') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-batch-lot">Lot Number</Label>
                    <Input id="inv-batch-lot" v-model="ws.batchForm.lotNumber" :disabled="ws.batchCreateSubmitting" />
                </div>
                <SingleDatePopoverField
                    input-id="inv-batch-manufacture"
                    label="Manufacture Date"
                    v-model="ws.batchForm.manufactureDate"
                    :disabled="ws.batchCreateSubmitting"
                />
                <SingleDatePopoverField
                    input-id="inv-batch-expiry"
                    label="Expiry Date"
                    v-model="ws.batchForm.expiryDate"
                    :disabled="ws.batchCreateSubmitting"
                    :error-message="ws.fieldError(ws.batchCreateErrors, 'expiryDate')"
                />
                <div class="grid gap-2">
                    <Label for="inv-batch-quantity">Quantity</Label>
                    <Input id="inv-batch-quantity" v-model="ws.batchForm.quantity" :disabled="ws.batchCreateSubmitting" type="number" min="0" step="0.001" />
                    <p v-if="ws.fieldError(ws.batchCreateErrors, 'quantity')" class="text-xs text-destructive">{{ ws.fieldError(ws.batchCreateErrors, 'quantity') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="inv-batch-unit-cost">Unit Cost</Label>
                    <Input id="inv-batch-unit-cost" v-model="ws.batchForm.unitCost" :disabled="ws.batchCreateSubmitting" type="number" min="0" step="0.01" />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-batch-bin">Bin Location</Label>
                    <Input id="inv-batch-bin" v-model="ws.batchForm.binLocation" :disabled="ws.batchCreateSubmitting" placeholder="e.g. A-03-12" />
                </div>
                <div class="grid gap-2">
                    <Label for="inv-batch-warehouse">Warehouse ID</Label>
                    <Input id="inv-batch-warehouse" v-model="ws.batchForm.warehouseId" :disabled="ws.batchCreateSubmitting" placeholder="Optional UUID" />
                </div>
                <div class="grid gap-2 sm:col-span-2">
                    <Label for="inv-batch-supplier">Supplier ID</Label>
                    <Input id="inv-batch-supplier" v-model="ws.batchForm.supplierId" :disabled="ws.batchCreateSubmitting" placeholder="Optional UUID" />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="flex-wrap gap-2 shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.createBatchDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.batchCreateSubmitting" class="gap-1.5" @click="ws.submitCreateBatch">
                    <AppIcon name="plus" class="size-3.5" />
                    {{ ws.batchCreateSubmitting ? 'Creating...' : 'Create Batch' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.createLeadTimeDialogOpen" @update:open="ws.createLeadTimeDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Record Supplier Order</SheetTitle>
                <SheetDescription>Track a new order to measure supplier lead time.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <div class="grid gap-2">
                    <Label for="lt-supplier">Supplier</Label>
                    <Select :model-value="ws.toSelectValue(ws.leadTimeForm.supplierId)" @update:model-value="ws.leadTimeForm.supplierId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                        <SelectTrigger id="lt-supplier" class="w-full">
                            <SelectValue placeholder="— Select —">
                                {{ ws.supplierLabel(ws.leadTimeForm.supplierId) }}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select —</SelectItem>
                        <SelectItem v-for="s in (ws.suppliers ?? [])" :key="s.id" :value="s.id" :text-value="ws.lookupOptionText(s)">{{ s.name }}</SelectItem>
                        </SelectContent>
                    </Select>
                    <p v-if="ws.fieldError(ws.leadTimeErrors, 'supplierId')" class="text-xs text-destructive">{{ ws.fieldError(ws.leadTimeErrors, 'supplierId') }}</p>
                </div>
                <div class="grid gap-2">
                    <Label for="lt-item">Item (optional)</Label>
                    <Select :model-value="ws.toSelectValue(ws.leadTimeForm.itemId)" @update:model-value="ws.leadTimeForm.itemId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                        <SelectTrigger id="lt-item">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem :value="ws.EMPTY_SELECT_VALUE">— All ws.items —</SelectItem>
                        <SelectItem v-for="it in ws.items" :key="it.id" :value="it.id">{{ it.itemCode }} — {{ it.itemName }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="grid gap-2 sm:grid-cols-2">
                    <SingleDatePopoverField
                        input-id="lt-order-date"
                        label="Order Date"
                        v-model="ws.leadTimeForm.orderDate"
                        :error-message="ws.fieldError(ws.leadTimeErrors, 'orderDate')"
                    />
                    <SingleDatePopoverField input-id="lt-expected-date" label="Expected Delivery" v-model="ws.leadTimeForm.expectedDeliveryDate" />
                </div>
                <div class="grid gap-2">
                    <Label for="lt-qty-ordered">Quantity Ordered</Label>
                    <Input id="lt-qty-ordered" type="number" step="0.001" min="0" v-model="ws.leadTimeForm.quantityOrdered" />
                </div>
                <div class="grid gap-2">
                    <Label for="lt-notes">Notes</Label>
                    <Input id="lt-notes" v-model="ws.leadTimeForm.notes" placeholder="Optional notes..." />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.createLeadTimeDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.leadTimeSubmitting" @click="ws.submitCreateLeadTime">
                    {{ ws.leadTimeSubmitting ? 'Saving...' : 'Record Order' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.recordDeliveryDialogOpen" @update:open="ws.recordDeliveryDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Record Delivery</SheetTitle>
                <SheetDescription>Record the actual delivery date and received quantity.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <SingleDatePopoverField
                    input-id="del-date"
                    label="Actual Delivery Date"
                    v-model="ws.deliveryForm.actualDeliveryDate"
                    :error-message="ws.fieldError(ws.deliveryErrors, 'actualDeliveryDate')"
                />
                <div class="grid gap-2">
                    <Label for="del-qty">Quantity Received</Label>
                    <Input id="del-qty" type="number" step="0.001" min="0" v-model="ws.deliveryForm.quantityReceived" />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.recordDeliveryDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.deliverySubmitting" @click="ws.submitRecordDelivery">
                    {{ ws.deliverySubmitting ? 'Recording...' : 'Record Delivery' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.barcodeScannerOpen" @update:open="ws.barcodeScannerOpen = $event">
        <SheetContent side="right" variant="action" size="md">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="search" class="size-4" />
                    Barcode Lookup
                </SheetTitle>
                <SheetDescription>Scan or type a barcode to look up inventory ws.items.</SheetDescription>
            </SheetHeader>
            <div class="px-6 py-4 grid gap-4">
                <div class="grid gap-2">
                    <Label for="bc-input">Barcode</Label>
                    <div class="flex gap-2">
                        <Input
                            id="bc-input"
                            v-model="ws.barcodeInput"
                            placeholder="Scan or type barcode..."
                            autofocus
                            @keydown="ws.onBarcodeKeydown"
                        />
                        <Button :disabled="ws.barcodeLookupLoading || !ws.barcodeInput.trim()" @click="ws.lookupBarcode">
                            {{ ws.barcodeLookupLoading ? '...' : 'Lookup' }}
                        </Button>
                    </div>
                </div>
                <Alert v-if="ws.barcodeLookupError" variant="destructive">
                    <AlertDescription>{{ ws.barcodeLookupError }}</AlertDescription>
                </Alert>
                <Card v-if="ws.barcodeLookupResult" class="bg-muted/30">
                    <CardContent class="grid gap-2 p-3 text-sm">
                        <div class="flex items-center justify-between">
                            <span class="font-medium">{{ ws.barcodeLookupResult.item_name }}</span>
                            <Badge variant="outline">{{ ws.barcodeLookupResult.item_code }}</Badge>
                        </div>
                        <Separator />
                        <div class="grid grid-cols-2 gap-y-1 text-xs">
                            <span class="text-muted-foreground">Category:</span>
                            <span>{{ ws.barcodeLookupResult.category ? formatEnumLabel(ws.barcodeLookupResult.category) : '—' }}</span>
                            <span class="text-muted-foreground">Store Stock:</span>
                            <span class="font-medium">{{ ws.barcodeLookupResult.current_stock }} {{ ws.barcodeLookupResult.unit || '' }}</span>
                            <span class="text-muted-foreground">Barcode:</span>
                            <span class="font-mono">{{ ws.barcodeLookupResult.barcode }}</span>
                            <span class="text-muted-foreground">NHIF Code:</span>
                            <span>{{ ws.barcodeLookupResult.nhif_code || '—' }}</span>
                            <span class="text-muted-foreground">MSD Code:</span>
                            <span>{{ ws.barcodeLookupResult.msd_code || '—' }}</span>
                            <span class="text-muted-foreground">ABC/VEN:</span>
                            <span>{{ ws.barcodeLookupResult.abc_classification || '—' }}/{{ ws.barcodeLookupResult.ven_classification || '—' }}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.barcodeScannerOpen = false; ws.barcodeInput = ''; ws.barcodeLookupResult = null; ws.barcodeLookupError = ''">Close</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>


