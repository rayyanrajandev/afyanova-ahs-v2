<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useSupplyChainPageApi } from '../supplyChainPageApi';

const ws = useSupplyChainPageApi();

function updateTransferReservationRevalidation(value: boolean | 'indeterminate') {
    ws.transferStatusForm.revalidateReservation = value === true;
}

function handleTransferReceiptVarianceTypeChange(line: { id: string }, value: string) {
    ws.transferStatusForm.receiptVarianceTypes[line.id] = value;
    if (value === 'full') {
        ws.transferStatusForm.receiptVarianceQuantities[line.id] = '';
        ws.transferStatusForm.receiptVarianceReasons[line.id] = '';
    }
}
</script>

<template>
<Sheet :open="ws.createTransferDialogOpen" @update:open="ws.createTransferDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Create Warehouse Transfer</SheetTitle>
                <SheetDescription>Move stock between warehouses with approval workflow.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <div class="grid gap-3 sm:grid-cols-2">
                    <div class="grid gap-2">
                        <Label for="trf-source">Source Warehouse</Label>
                        <Select :model-value="ws.toSelectValue(ws.transferForm.sourceWarehouseId)" @update:model-value="ws.transferForm.sourceWarehouseId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="trf-source" class="w-full">
                                <SelectValue placeholder="— Select —">
                                    {{ ws.warehouseLabel(ws.transferForm.sourceWarehouseId) }}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select —</SelectItem>
                            <SelectItem v-for="w in (ws.warehouses ?? [])" :key="w.id" :value="w.id" :text-value="ws.lookupOptionText(w)">{{ w.name }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="ws.fieldError(ws.transferErrors, 'sourceWarehouseId')" class="text-xs text-destructive">{{ ws.fieldError(ws.transferErrors, 'sourceWarehouseId') }}</p>
                    </div>
                    <div class="grid gap-2">
                        <Label for="trf-dest">Destination Warehouse</Label>
                        <Select :model-value="ws.toSelectValue(ws.transferForm.destinationWarehouseId)" @update:model-value="ws.transferForm.destinationWarehouseId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="trf-dest" class="w-full">
                                <SelectValue placeholder="— Select —">
                                    {{ ws.warehouseLabel(ws.transferForm.destinationWarehouseId) }}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select —</SelectItem>
                            <SelectItem v-for="w in (ws.warehouses ?? [])" :key="w.id" :value="w.id" :text-value="ws.lookupOptionText(w)">{{ w.name }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <p v-if="ws.fieldError(ws.transferErrors, 'destinationWarehouseId')" class="text-xs text-destructive">{{ ws.fieldError(ws.transferErrors, 'destinationWarehouseId') }}</p>
                    </div>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                    <div class="grid gap-2">
                        <Label for="trf-priority">Priority</Label>
                        <Select :model-value="ws.toSelectValue(ws.transferForm.priority)" @update:model-value="ws.transferForm.priority = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                            <SelectTrigger id="trf-priority">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem v-for="p in ws.PRIORITY_OPTIONS" :key="p.value" :value="p.value">{{ p.label }}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="grid gap-2">
                        <Label for="trf-reason">Reason</Label>
                        <Input id="trf-reason" v-model="ws.transferForm.reason" placeholder="Reason for transfer..." />
                    </div>
                </div>
                <div class="grid gap-2">
                    <Label for="trf-notes">Notes</Label>
                    <Input id="trf-notes" v-model="ws.transferForm.notes" placeholder="Optional notes..." />
                </div>

                <!-- Transfer Lines -->
                <fieldset class="grid gap-3 rounded-lg border p-3">
                    <legend class="text-sm font-medium">Items to Transfer</legend>
                    <div v-for="(line, idx) in ws.transferForm.lines" :key="idx" class="grid gap-2 rounded border p-2 sm:grid-cols-4">
                        <div class="grid gap-1">
                            <Label :for="'trf-line-item-' + idx">Item</Label>
                            <Select :model-value="ws.toSelectValue(line.itemId)" @update:model-value="ws.handleTransferLineItemChange(idx, String($event ?? ws.EMPTY_SELECT_VALUE))">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem :value="ws.EMPTY_SELECT_VALUE">— Select —</SelectItem>
                                <SelectItem v-for="it in ws.items" :key="it.id" :value="it.id">{{ it.itemCode }} — {{ it.itemName }}</SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="ws.fieldError(ws.transferErrors, `lines.${idx}.itemId`)" class="text-xs text-destructive">{{ ws.fieldError(ws.transferErrors, `lines.${idx}.itemId`) }}</p>
                        </div>
                        <div class="grid gap-1">
                            <Label :for="'trf-line-batch-' + idx">
                                Batch
                                <span v-if="ws.transferLineUsesBatchTracking(line)" class="text-destructive">*</span>
                            </Label>
                            <Select :model-value="ws.toSelectValue(line.batchId)" @update:model-value="line.batchId = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                                <SelectTrigger :disabled="Boolean(ws.transferBatchLoadingByItemId[line.itemId])">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem :value="ws.EMPTY_SELECT_VALUE">Select</SelectItem>
                                    <SelectItem
                                        v-for="batch in ws.transferLineBatches(line)"
                                        :key="batch.id"
                                        :value="batch.id"
                                        :text-value="batch.batchNumber ?? batch.id"
                                    >
                                        {{ ws.batchOptionLabel(batch) }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p v-if="ws.transferBatchLoadingByItemId[line.itemId]" class="text-xs text-muted-foreground">Loading batches...</p>
                            <p v-else-if="ws.transferLineUsesBatchTracking(line) && ws.transferLineBatches(line).length === 0" class="text-xs text-muted-foreground">No source batches found for this warehouse.</p>
                            <p v-if="ws.fieldError(ws.transferErrors, `lines.${idx}.batchId`)" class="text-xs text-destructive">{{ ws.fieldError(ws.transferErrors, `lines.${idx}.batchId`) }}</p>
                        </div>
                        <div class="grid gap-1">
                            <Label :for="'trf-line-qty-' + idx">Quantity</Label>
                            <Input :id="'trf-line-qty-' + idx" type="number" step="0.001" min="0.001" v-model="line.requestedQuantity" />
                            <p v-if="ws.fieldError(ws.transferErrors, `lines.${idx}.requestedQuantity`)" class="text-xs text-destructive">{{ ws.fieldError(ws.transferErrors, `lines.${idx}.requestedQuantity`) }}</p>
                        </div>
                        <div class="flex items-end gap-1">
                            <div class="grid flex-1 gap-1">
                                <Label :for="'trf-line-unit-' + idx">Unit</Label>
                                <Input :id="'trf-line-unit-' + idx" v-model="line.unit" placeholder="e.g. pcs" />
                            </div>
                            <Button v-if="ws.transferForm.lines.length > 1" size="sm" variant="ghost" class="text-destructive" @click="ws.removeTransferLine(idx)">
                                <AppIcon name="x" class="size-4" />
                            </Button>
                        </div>
                    </div>
                    <Button size="sm" variant="outline" @click="ws.addTransferLine">+ Add Line</Button>
                    <p v-if="ws.fieldError(ws.transferErrors, 'lines')" class="text-xs text-destructive">{{ ws.fieldError(ws.transferErrors, 'lines') }}</p>
                </fieldset>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.createTransferDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.transferSubmitting" @click="ws.submitCreateTransfer">
                    {{ ws.transferSubmitting ? 'Creating...' : 'Create Transfer' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.transferStatusDialogOpen" @update:open="ws.onTransferStatusDialogOpenChange">
        <SheetContent side="right" variant="action" size="lg">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>{{ ws.transferActionLabel(ws.transferStatusForm.newStatus || 'status_update') }}</SheetTitle>
                <SheetDescription>
                    <span v-if="ws.transferStatusSelectedTransfer?.transfer_number">
                        {{ ws.transferStatusSelectedTransfer.transfer_number }} •
                    </span>
                    Change status from <strong>{{ (ws.transferStatusForm.currentStatus ?? '').replace(/_/g, ' ') }}</strong> to <strong>{{ (ws.transferStatusForm.newStatus ?? '').replace(/_/g, ' ') }}</strong>.
                </SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
                <div class="px-6 py-4 grid gap-4">
                    <div v-if="ws.transferStatusContextLoading" class="rounded-lg border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                        Loading the latest transfer snapshot...
                    </div>

                    <template v-else>
                        <div v-if="ws.transferStatusSelectedTransfer" class="rounded-lg border bg-muted/20 px-3 py-3 grid gap-3">
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge :class="ws.transferStatusBadgeClass(ws.transferStatusSelectedTransfer.status)" class="text-[11px]">
                                    {{ (ws.transferStatusSelectedTransfer.status ?? '').replace(/_/g, ' ') }}
                                </Badge>
                                <Badge :class="ws.transferReservationStateBadgeClass(ws.transferStatusSelectedTransfer.reservationSummary?.state)" class="text-[11px]">
                                    {{ ws.transferReservationSummaryLabel(ws.transferStatusSelectedTransfer) }}
                                </Badge>
                                <Badge variant="outline" class="text-[11px]">
                                    {{ ws.transferPickSummaryLabel(ws.transferStatusSelectedTransfer) }}
                                </Badge>
                            </div>
                            <div v-if="ws.transferAttentionSignals(ws.transferStatusSelectedTransfer).length > 0" class="flex flex-wrap items-center gap-2">
                                <Badge
                                    v-for="signal in ws.transferAttentionSignals(ws.transferStatusSelectedTransfer)"
                                    :key="signal.key"
                                    :class="ws.transferAttentionBadgeClass(signal)"
                                    class="text-[11px]"
                                >
                                    {{ signal.label }}
                                </Badge>
                            </div>
                            <div class="grid gap-2">
                                <p class="text-sm font-medium">
                                    {{ ws.transferStatusSelectedTransfer.routeLabel ?? `${ws.warehouseLabel(ws.transferStatusSelectedTransfer.source_warehouse_id) ?? 'Unknown'} -> ${ws.warehouseLabel(ws.transferStatusSelectedTransfer.destination_warehouse_id) ?? 'Unknown'}` }}
                                </p>
                                <p v-if="ws.transferStatusSelectedTransfer.reason" class="text-xs text-muted-foreground">
                                    {{ ws.transferStatusSelectedTransfer.reason }}
                                </p>
                                <p v-if="ws.transferStatusSelectedTransfer.dispatchNoteNumber" class="text-xs text-muted-foreground">
                                    Dispatch note {{ ws.transferStatusSelectedTransfer.dispatchNoteNumber }}
                                </p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <Button
                                    v-if="ws.transferCanOpenPickSlip(ws.transferStatusSelectedTransfer)"
                                    size="sm"
                                    variant="outline"
                                    class="h-8 gap-1.5"
                                    @click="ws.openTransferPickSlip(ws.transferStatusSelectedTransfer)"
                                >
                                    <AppIcon name="clipboard-list" class="size-3.5" />
                                    Pick slip
                                </Button>
                                <Button
                                    v-if="ws.transferCanOpenDispatchNote(ws.transferStatusSelectedTransfer)"
                                    size="sm"
                                    variant="outline"
                                    class="h-8 gap-1.5"
                                    @click="ws.openTransferDispatchNote(ws.transferStatusSelectedTransfer)"
                                >
                                    <AppIcon name="file-text" class="size-3.5" />
                                    Dispatch note
                                </Button>
                            </div>
                        </div>

                        <div v-if="ws.transferStatusForm.newStatus === 'approved'" class="rounded-lg border bg-blue-50/70 px-3 py-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                            <p>Approval will place a stock hold on every transfer line so other workflows cannot claim the same quantity before dispatch.</p>
                            <div v-if="(ws.transferStatusSelectedTransfer?.lines ?? []).length" class="mt-3 grid gap-2">
                                <div
                                    v-for="(line, idx) in (ws.transferStatusSelectedTransfer?.lines ?? [])"
                                    :key="line.id"
                                    class="rounded-md border border-blue-200/70 bg-background/70 px-3 py-2 dark:border-blue-900/60"
                                >
                                    <p class="text-sm font-medium">{{ ws.transferLineLabel(line) }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        Requesting {{ ws.formatTransferQuantity(line.requested_quantity) }} {{ line.unit || 'units' }}
                                        <span v-if="line.batchNumber"> | Batch {{ line.batchNumber }}</span>
                                    </p>
                                    <p v-if="ws.fieldError(ws.transferStatusErrors, `lines.${idx}.requestedQuantity`)" class="mt-1 text-xs text-destructive">
                                        {{ ws.fieldError(ws.transferStatusErrors, `lines.${idx}.requestedQuantity`) }}
                                    </p>
                                    <p v-if="ws.fieldError(ws.transferStatusErrors, `lines.${idx}.batchId`)" class="mt-1 text-xs text-destructive">
                                        {{ ws.fieldError(ws.transferStatusErrors, `lines.${idx}.batchId`) }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div v-if="ws.transferStatusForm.newStatus === 'cancelled'" class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                            Cancelling this transfer releases any active stock hold and closes the workflow before dispatch.
                        </div>

                        <div v-if="ws.transferStatusForm.newStatus === 'rejected'" class="grid gap-2">
                            <Label for="trf-reject-reason">Rejection Reason</Label>
                            <Input id="trf-reject-reason" v-model="ws.transferStatusForm.rejectionReason" placeholder="Why is this transfer being rejected?" />
                            <p v-if="ws.fieldError(ws.transferStatusErrors, 'rejectionReason')" class="text-xs text-destructive">
                                {{ ws.fieldError(ws.transferStatusErrors, 'rejectionReason') }}
                            </p>
                        </div>

                        <div v-if="ws.transferStatusForm.newStatus === 'packed'" class="grid gap-3">
                            <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                                Confirm what the stores team actually picked and packed. This keeps dispatch working from a verified pack quantity instead of the original request.
                            </div>
                            <div
                                v-if="ws.transferDispatchNeedsRevalidation()"
                                class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
                            >
                                <p class="font-medium">The stock hold for this transfer expired and must be refreshed before packing.</p>
                                <p class="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
                                    Packing will re-check live stock and recreate the FEFO hold against current availability.
                                </p>
                                <label class="mt-3 flex items-start gap-2 rounded-md border border-amber-200/80 bg-background/80 px-3 py-2 text-sm text-foreground dark:border-amber-900/60 dark:bg-background/30">
                                    <Checkbox :model-value="ws.transferStatusForm.revalidateReservation" class="mt-0.5" @update:model-value="updateTransferReservationRevalidation" />
                                    <span>Refresh the expired stock hold and continue with packing.</span>
                                </label>
                                <p v-if="ws.fieldError(ws.transferStatusErrors, 'revalidateReservation')" class="mt-2 text-xs text-destructive">
                                    {{ ws.fieldError(ws.transferStatusErrors, 'revalidateReservation') }}
                                </p>
                            </div>
                            <div class="grid gap-2">
                                <Label for="trf-pack-notes">Pack Notes</Label>
                                <Textarea id="trf-pack-notes" v-model="ws.transferStatusForm.packNotes" rows="3" placeholder="Short shipment note, packing instructions, or handoff remarks" />
                                <p v-if="ws.fieldError(ws.transferStatusErrors, 'packNotes')" class="text-xs text-destructive">
                                    {{ ws.fieldError(ws.transferStatusErrors, 'packNotes') }}
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <div
                                    v-for="line in (ws.transferStatusSelectedTransfer?.lines ?? [])"
                                    :key="line.id"
                                    class="rounded-lg border px-3 py-3 grid gap-3"
                                >
                                    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-medium">{{ ws.transferLineLabel(line) }}</p>
                                            <p class="text-xs text-muted-foreground">
                                                Requested {{ ws.formatTransferQuantity(line.requested_quantity) }} {{ line.unit || 'units' }}
                                                <span v-if="line.batchNumber"> | Batch {{ line.batchNumber }}</span>
                                            </p>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge :class="ws.transferReservationStateBadgeClass(line.reservationState)" class="text-[11px]">
                                                {{ ws.transferReservationStateLabel(line.reservationState) }}
                                            </Badge>
                                            <Badge v-if="Number(line.reservedQuantity ?? 0) > 0" variant="outline" class="text-[11px]">
                                                Held {{ ws.formatTransferQuantity(line.reservedQuantity) }}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 md:grid-cols-3">
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Requested</p>
                                            <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.requested_quantity) }}</p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Held</p>
                                            <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.reservedQuantity) }}</p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Remaining to Pack</p>
                                            <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.packRemainingQuantity) }}</p>
                                        </div>
                                    </div>
                                    <div class="grid gap-2 md:max-w-xs">
                                        <Label :for="`trf-pack-${line.id}`">Packed Quantity</Label>
                                        <Input
                                            :id="`trf-pack-${line.id}`"
                                            v-model="ws.transferStatusForm.packedQuantities[line.id]"
                                            type="number"
                                            step="0.001"
                                            min="0"
                                        />
                                        <p v-if="ws.fieldError(ws.transferStatusErrors, `packedQuantities.${line.id}`)" class="text-xs text-destructive">
                                            {{ ws.fieldError(ws.transferStatusErrors, `packedQuantities.${line.id}`) }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="ws.transferStatusForm.newStatus === 'in_transit'" class="grid gap-3">
                            <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                                Confirm what is actually leaving the source warehouse. Dispatch uses packed quantities when they are available, so the stock ledger matches the prepared handoff.
                            </div>
                            <div
                                v-if="ws.transferDispatchNeedsRevalidation()"
                                class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
                            >
                                <p class="font-medium">The stock hold for this transfer expired and must be refreshed before dispatch.</p>
                                <p class="mt-1 text-xs text-amber-800/90 dark:text-amber-200/90">
                                    Dispatch will re-check live stock and recreate the FEFO hold against current availability.
                                    <span v-if="ws.transferStatusSelectedTransfer?.reservationSummary?.refreshRequiredSince || ws.transferStatusSelectedTransfer?.reservationSummary?.staleSince">
                                        Previous hold expired at {{
                                            ws.formatDateTime(
                                                ws.transferStatusSelectedTransfer.reservationSummary.refreshRequiredSince
                                                || ws.transferStatusSelectedTransfer.reservationSummary.staleSince,
                                            )
                                        }}.
                                    </span>
                                </p>
                                <label class="mt-3 flex items-start gap-2 rounded-md border border-amber-200/80 bg-background/80 px-3 py-2 text-sm text-foreground dark:border-amber-900/60 dark:bg-background/30">
                                    <Checkbox :model-value="ws.transferStatusForm.revalidateReservation" class="mt-0.5" @update:model-value="updateTransferReservationRevalidation" />
                                    <span>Refresh the expired stock hold and continue with dispatch.</span>
                                </label>
                                <p v-if="ws.fieldError(ws.transferStatusErrors, 'revalidateReservation')" class="mt-2 text-xs text-destructive">
                                    {{ ws.fieldError(ws.transferStatusErrors, 'revalidateReservation') }}
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <div
                                    v-for="(line, idx) in (ws.transferStatusSelectedTransfer?.lines ?? [])"
                                    :key="line.id"
                                    class="rounded-lg border px-3 py-3 grid gap-3"
                                >
                                    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-medium">{{ ws.transferLineLabel(line) }}</p>
                                            <p class="text-xs text-muted-foreground">
                                                Requested {{ ws.formatTransferQuantity(line.requested_quantity) }} {{ line.unit || 'units' }}
                                                <span v-if="line.batchNumber"> | Batch {{ line.batchNumber }}</span>
                                            </p>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge :class="ws.transferReservationStateBadgeClass(line.reservationState)" class="text-[11px]">
                                                {{ ws.transferReservationStateLabel(line.reservationState) }}
                                            </Badge>
                                            <Badge v-if="Number(line.reservedQuantity ?? 0) > 0" variant="outline" class="text-[11px]">
                                                Held {{ ws.formatTransferQuantity(line.reservedQuantity) }}
                                            </Badge>
                                            <Badge v-if="Number(line.staleReservedQuantity ?? 0) > 0" class="bg-amber-100 text-[11px] text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                                Expired {{ ws.formatTransferQuantity(line.staleReservedQuantity) }}
                                            </Badge>
                                            <Badge v-if="Number(line.expiredReleasedQuantity ?? 0) > 0" class="bg-rose-100 text-[11px] text-rose-800 dark:bg-rose-900 dark:text-rose-200">
                                                Refresh {{ ws.formatTransferQuantity(line.expiredReleasedQuantity) }}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 md:grid-cols-3">
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Requested</p>
                                            <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.requested_quantity) }}</p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                                {{ Number(line.packedQuantity ?? 0) > 0 ? 'Packed' : (line.isStaleReservation ? 'Expired Hold' : (line.needsReservationRefresh ? 'Refresh Hold' : 'Held')) }}
                                            </p>
                                            <p class="mt-1 text-sm font-semibold">
                                                {{ ws.formatTransferQuantity(Number(line.packedQuantity ?? 0) > 0 ? line.packedQuantity : (line.isStaleReservation ? line.staleReservedQuantity : (line.needsReservationRefresh ? line.expiredReleasedQuantity : line.reservedQuantity))) }}
                                            </p>
                                            <p v-if="line.isStaleReservation && line.staleSince" class="mt-1 text-[11px] text-muted-foreground">
                                                Expired {{ ws.formatDateTime(line.staleSince) }}
                                            </p>
                                            <p v-else-if="line.needsReservationRefresh && line.refreshRequiredSince" class="mt-1 text-[11px] text-muted-foreground">
                                                Released {{ ws.formatDateTime(line.refreshRequiredSince) }}
                                            </p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Remaining to Dispatch</p>
                                            <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.dispatchRemainingQuantity) }}</p>
                                        </div>
                                    </div>
                                    <div class="grid gap-2 md:max-w-xs">
                                        <Label :for="`trf-dispatch-${line.id}`">Dispatch Quantity</Label>
                                        <Input
                                            :id="`trf-dispatch-${line.id}`"
                                            v-model="ws.transferStatusForm.dispatchedQuantities[line.id]"
                                            type="number"
                                            step="0.001"
                                            min="0"
                                        />
                                        <p v-if="ws.fieldError(ws.transferStatusErrors, `dispatchedQuantities.${line.id}`)" class="text-xs text-destructive">
                                            {{ ws.fieldError(ws.transferStatusErrors, `dispatchedQuantities.${line.id}`) }}
                                        </p>
                                        <p v-if="ws.fieldError(ws.transferStatusErrors, `lines.${idx}.requestedQuantity`)" class="text-xs text-destructive">
                                            {{ ws.fieldError(ws.transferStatusErrors, `lines.${idx}.requestedQuantity`) }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-if="ws.transferStatusForm.newStatus === 'received'" class="grid gap-3">
                            <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                                Confirm what was accepted into destination stock. Any shortage, damage, wrong batch, or excess is captured as variance instead of being silently posted into inventory.
                            </div>
                            <div class="grid gap-2">
                                <Label for="trf-receiving-notes">Receiving Notes</Label>
                                <Textarea id="trf-receiving-notes" v-model="ws.transferStatusForm.receivingNotes" rows="3" placeholder="Condition on arrival, variance notes, or receiving remarks" />
                                <p v-if="ws.fieldError(ws.transferStatusErrors, 'receivingNotes')" class="text-xs text-destructive">
                                    {{ ws.fieldError(ws.transferStatusErrors, 'receivingNotes') }}
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <div
                                    v-for="(line, idx) in (ws.transferStatusSelectedTransfer?.lines ?? [])"
                                    :key="line.id"
                                    class="rounded-lg border px-3 py-3 grid gap-3"
                                >
                                    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-medium">{{ ws.transferLineLabel(line) }}</p>
                                            <p class="text-xs text-muted-foreground">
                                                Dispatched {{ ws.formatTransferQuantity(line.dispatched_quantity) }} {{ line.unit || 'units' }}
                                                <span v-if="line.batchNumber"> | Batch {{ line.batchNumber }}</span>
                                            </p>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge
                                                v-if="ws.transferReceiptVarianceNeedsDetails(line.id)"
                                                class="bg-amber-100 text-[11px] text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                            >
                                                {{ ws.transferReceiptVarianceType(line.id).replace(/_/g, ' ') }}
                                            </Badge>
                                            <Badge v-else variant="outline" class="text-[11px]">
                                                Full match
                                            </Badge>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 md:grid-cols-3">
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Dispatched</p>
                                            <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.dispatched_quantity) }}</p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Accepted to Stock</p>
                                            <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.received_quantity) }}</p>
                                        </div>
                                        <div class="rounded-md border bg-muted/10 px-3 py-2">
                                            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Reported on Arrival</p>
                                            <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.reportedReceivedQuantity ?? line.dispatched_quantity) }}</p>
                                        </div>
                                    </div>
                                    <div class="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]">
                                        <div class="grid gap-2">
                                            <Label :for="`trf-receive-${line.id}`">Accepted Quantity</Label>
                                            <Input
                                                :id="`trf-receive-${line.id}`"
                                                v-model="ws.transferStatusForm.receivedQuantities[line.id]"
                                                type="number"
                                                step="0.001"
                                                min="0"
                                            />
                                            <p v-if="ws.fieldError(ws.transferStatusErrors, `receivedQuantities.${line.id}`)" class="text-xs text-destructive">
                                                {{ ws.fieldError(ws.transferStatusErrors, `receivedQuantities.${line.id}`) }}
                                            </p>
                                            <p v-if="ws.fieldError(ws.transferStatusErrors, `lines.${idx}.receivedQuantity`)" class="text-xs text-destructive">
                                                {{ ws.fieldError(ws.transferStatusErrors, `lines.${idx}.receivedQuantity`) }}
                                            </p>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label :for="`trf-variance-type-${line.id}`">Variance Type</Label>
                                            <Select
                                                :model-value="ws.toSelectValue(ws.transferReceiptVarianceType(line.id))"
                                                @update:model-value="handleTransferReceiptVarianceTypeChange(line, String($event ?? ws.EMPTY_SELECT_VALUE))"
                                            >
                                                <SelectTrigger :id="`trf-variance-type-${line.id}`">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem
                                                        v-for="option in ws.TRANSFER_RECEIPT_VARIANCE_OPTIONS"
                                                        :key="`trf-receipt-variance-${line.id}-${option.value}`"
                                                        :value="option.value"
                                                    >
                                                        {{ option.label }}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p v-if="ws.fieldError(ws.transferStatusErrors, `receiptVarianceTypes.${line.id}`)" class="text-xs text-destructive">
                                                {{ ws.fieldError(ws.transferStatusErrors, `receiptVarianceTypes.${line.id}`) }}
                                            </p>
                                        </div>
                                        <div v-if="ws.transferReceiptVarianceNeedsDetails(line.id)" class="grid gap-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
                                            <div class="grid gap-2">
                                                <Label :for="`trf-variance-qty-${line.id}`">Variance Quantity</Label>
                                                <Input
                                                    :id="`trf-variance-qty-${line.id}`"
                                                    v-model="ws.transferStatusForm.receiptVarianceQuantities[line.id]"
                                                    type="number"
                                                    step="0.001"
                                                    min="0"
                                                />
                                                <p v-if="ws.fieldError(ws.transferStatusErrors, `receiptVarianceQuantities.${line.id}`)" class="text-xs text-destructive">
                                                    {{ ws.fieldError(ws.transferStatusErrors, `receiptVarianceQuantities.${line.id}`) }}
                                                </p>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label :for="`trf-variance-reason-${line.id}`">Variance Reason</Label>
                                                <Input
                                                    :id="`trf-variance-reason-${line.id}`"
                                                    v-model="ws.transferStatusForm.receiptVarianceReasons[line.id]"
                                                    placeholder="Why does this line not match dispatch?"
                                                />
                                                <p v-if="ws.fieldError(ws.transferStatusErrors, `receiptVarianceReasons.${line.id}`)" class="text-xs text-destructive">
                                                    {{ ws.fieldError(ws.transferStatusErrors, `receiptVarianceReasons.${line.id}`) }}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.transferStatusDialogOpen = false">Cancel</Button>
                <Button
                    :disabled="ws.transferStatusSubmitting || ws.transferStatusContextLoading || (ws.transferDispatchNeedsRevalidation() && !ws.transferStatusForm.revalidateReservation)"
                    @click="ws.submitTransferStatusUpdate"
                >
                    {{ ws.transferStatusSubmitting ? 'Saving...' : ws.transferActionLabel(ws.transferStatusForm.newStatus || 'confirm') }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.transferVarianceReviewDialogOpen" @update:open="ws.onTransferVarianceReviewDialogOpenChange">
        <SheetContent side="right" variant="form" size="3xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>{{ ws.transferVarianceReviewState(ws.transferVarianceReviewSelectedTransfer) === 'reviewed' ? 'Receipt Variance Review' : 'Review Receipt Variance' }}</SheetTitle>
                <SheetDescription>
                    Capture the operational follow-up for received transfer lines that did not match dispatch.
                </SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
                <div class="grid gap-4 px-4 py-4">
                    <div v-if="ws.transferVarianceReviewLoading" class="rounded-lg border bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                        Loading the latest variance details...
                    </div>
                    <template v-else>
                        <div class="rounded-lg border bg-muted/15 px-3 py-3">
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge
                                    v-if="ws.transferCanOpenVarianceReview(ws.transferVarianceReviewSelectedTransfer)"
                                    :class="ws.transferVarianceReviewBadgeClass(ws.transferVarianceReviewState(ws.transferVarianceReviewSelectedTransfer))"
                                    class="text-[11px]"
                                >
                                    {{ ws.transferVarianceReviewStateLabel(ws.transferVarianceReviewState(ws.transferVarianceReviewSelectedTransfer)) }}
                                </Badge>
                                <Badge variant="outline" class="text-[11px]">
                                    {{ ws.transferVarianceReviewSelectedTransfer?.receiptVarianceSummary?.lineCount ?? 0 }} variance lines
                                </Badge>
                                <Badge variant="outline" class="text-[11px]">
                                    {{ ws.formatTransferQuantity(ws.transferVarianceReviewSelectedTransfer?.receiptVarianceSummary?.quantity ?? 0) }} total variance
                                </Badge>
                            </div>
                            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>{{ ws.transferVarianceReviewSelectedTransfer?.transfer_number ?? 'Transfer' }}</span>
                                <span>{{ ws.transferVarianceReviewSelectedTransfer?.routeLabel ?? 'Unknown route' }}</span>
                                <span v-if="ws.transferVarianceReviewSelectedTransfer?.varianceReview?.reviewedAt">
                                    Reviewed {{ ws.formatDateTime(ws.transferVarianceReviewSelectedTransfer.varianceReview.reviewedAt) }}
                                </span>
                            </div>
                        </div>

                        <div
                            v-if="ws.transferVarianceReviewState(ws.transferVarianceReviewSelectedTransfer) !== 'reviewed'"
                            class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100"
                        >
                            Close this review after confirming the variance was understood and any store follow-up was handled.
                        </div>
                        <div
                            v-else
                            class="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-3 text-sm text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100"
                        >
                            This transfer variance was already reviewed. You can update the review note without changing the stock outcome.
                        </div>

                        <div class="grid gap-3">
                            <div
                                v-for="line in ws.transferVarianceReviewLines(ws.transferVarianceReviewSelectedTransfer)"
                                :key="line.id"
                                class="rounded-lg border px-3 py-3"
                            >
                                <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="space-y-1">
                                        <p class="text-sm font-medium">{{ ws.transferLineLabel(line) }}</p>
                                        <p class="text-xs text-muted-foreground">
                                            Dispatched {{ ws.formatTransferQuantity(line.dispatched_quantity) }} {{ line.unit || 'units' }}
                                            <span v-if="line.batchNumber"> | Batch {{ line.batchNumber }}</span>
                                        </p>
                                    </div>
                                    <Badge class="bg-amber-100 text-[11px] text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                        {{ String(line.receiptVarianceType ?? 'variance').replace(/_/g, ' ') }}
                                    </Badge>
                                </div>
                                <div class="mt-3 grid gap-3 md:grid-cols-4">
                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                        <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Dispatched</p>
                                        <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.dispatched_quantity) }}</p>
                                    </div>
                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                        <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Accepted</p>
                                        <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.received_quantity) }}</p>
                                    </div>
                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                        <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Variance Qty</p>
                                        <p class="mt-1 text-sm font-semibold">{{ ws.formatTransferQuantity(line.receiptVarianceQuantity) }}</p>
                                    </div>
                                    <div class="rounded-md border bg-muted/10 px-3 py-2">
                                        <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Reason</p>
                                        <p class="mt-1 text-sm font-semibold">{{ line.receiptVarianceReason || 'No reason recorded' }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="grid gap-2">
                            <Label for="trf-variance-review-notes">Review Note</Label>
                            <Textarea
                                id="trf-variance-review-notes"
                                v-model="ws.transferVarianceReviewForm.reviewNotes"
                                rows="4"
                                placeholder="Summarize what was checked, who was informed, and any operational follow-up."
                            />
                            <p v-if="ws.fieldError(ws.transferVarianceReviewErrors, 'reviewNotes')" class="text-xs text-destructive">
                                {{ ws.fieldError(ws.transferVarianceReviewErrors, 'reviewNotes') }}
                            </p>
                            <p v-if="ws.fieldError(ws.transferVarianceReviewErrors, 'reviewStatus')" class="text-xs text-destructive">
                                {{ ws.fieldError(ws.transferVarianceReviewErrors, 'reviewStatus') }}
                            </p>
                        </div>
                    </template>
                </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.transferVarianceReviewDialogOpen = false">Close</Button>
                <Button
                    :disabled="ws.transferVarianceReviewSubmitting || ws.transferVarianceReviewLoading"
                    @click="ws.submitTransferVarianceReview"
                >
                    {{
                        ws.transferVarianceReviewSubmitting
                            ? 'Saving...'
                            : (ws.transferVarianceReviewState(ws.transferVarianceReviewSelectedTransfer) === 'reviewed' ? 'Update Review' : 'Mark Reviewed')
                    }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>


