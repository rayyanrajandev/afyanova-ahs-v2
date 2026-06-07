<script setup lang="ts">
import BillingInvoiceLookupField from '@/components/billing/BillingInvoiceLookupField.vue';
import ClaimsInsuranceCaseLookupField from '@/components/claims/ClaimsInsuranceCaseLookupField.vue';
import ClinicalContextBanner from '@/components/domain/clinical/ClinicalContextBanner.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import InventoryItemLookupField from '@/components/inventory/InventoryItemLookupField.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();
</script>

<template>
<Sheet :open="ws.createClaimLinkDialogOpen" @update:open="ws.createClaimLinkDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Link Dispensed Item to Claim</SheetTitle>
                <SheetDescription>Record a dispensed inventory item for NHIF/insurance claim submission.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <ClinicalContextBanner
                    title="Dispensing reimbursement context"
                    description="Confirm the dispensed item, patient, and claim or invoice linkage before creating the reimbursement trace."
                    :patient-name="ws.claimLinkPatientContextLabel"
                    :patient-meta="ws.claimLinkPatientContextMeta"
                    :context-label="ws.claimLinkItemContextLabel"
                    :context-meta="ws.claimLinkWorkflowContextMeta"
                    :status-label="ws.claimLinkContextStatusLabel"
                    :status-variant="ws.claimLinkContextStatusVariant"
                    tone="muted"
                >
                    <div class="grid gap-2 lg:grid-cols-2">
                        <div class="rounded-md border bg-background/80 px-3 py-2">
                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                Item context
                            </p>
                            <p class="mt-1 text-sm font-medium text-foreground">
                                {{ ws.claimLinkItemContextLabel }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                {{ ws.claimLinkItemContextMeta }}
                            </p>
                        </div>
                        <div class="rounded-md border bg-background/80 px-3 py-2">
                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                Reimbursement path
                            </p>
                            <p class="mt-1 text-sm font-medium text-foreground">
                                {{ ws.claimLinkWorkflowContextLabel }}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                {{ ws.claimLinkWorkflowContextMeta }}
                            </p>
                        </div>
                    </div>
                </ClinicalContextBanner>
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-2">
                        <InventoryItemLookupField
                            input-id="cl-item-id"
                            v-model="ws.claimLinkForm.itemId"
                            label="Item *"
                            helper-text="Search the inventory catalogue for the dispensed item."
                            :error-message="ws.claimLinkErrors.itemId?.[0] ?? null"
                            @selected="ws.handleClaimLinkItemSelected"
                        />
                    </div>
                    <div class="grid gap-2">
                        <PatientLookupField
                            input-id="cl-patient-id"
                            v-model="ws.claimLinkForm.patientId"
                            label="Patient"
                            helper-text="Search the patient directory for the dispensed patient."
                            :error-message="ws.claimLinkErrors.patientId?.[0] ?? null"
                        />
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-3">
                    <div class="grid gap-2">
                        <Label for="cl-qty">Qty Dispensed *</Label>
                        <Input id="cl-qty" v-model="ws.claimLinkForm.quantityDispensed" type="number" step="0.001" min="0.001" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="cl-unit">Unit</Label>
                        <Input id="cl-unit" v-model="ws.claimLinkForm.unit" placeholder="e.g. tablets" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="cl-cost">Unit Cost</Label>
                        <Input id="cl-cost" v-model="ws.claimLinkForm.unitCost" type="number" step="0.01" min="0" />
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-2">
                        <Label for="cl-nhif">NHIF Code</Label>
                        <Input id="cl-nhif" v-model="ws.claimLinkForm.nhifCode" placeholder="NHIF item code" />
                    </div>
                    <div class="grid gap-2">
                        <Label for="cl-payer-type">Payer Type</Label>
                        <Select :model-value="ws.toSelectValue(ws.claimLinkForm.payerType)" @update:model-value="ws.claimLinkForm.payerType = ws.fromSelectValue(String($event ?? ws.EMPTY_SELECT_VALUE))">
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem :value="ws.EMPTY_SELECT_VALUE">Select...</SelectItem>
                            <SelectItem value="insurance">Insurance</SelectItem>
                            <SelectItem value="government">Government (NHIF)</SelectItem>
                            <SelectItem value="employer">Employer</SelectItem>
                            <SelectItem value="self_pay">Self Pay</SelectItem>
                            <SelectItem value="donor">Donor</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div class="grid gap-2">
                    <Label for="cl-payer-name">Payer Name</Label>
                    <Input id="cl-payer-name" v-model="ws.claimLinkForm.payerName" placeholder="e.g. NHIF Tanzania" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-2">
                        <ClaimsInsuranceCaseLookupField
                            input-id="cl-claim-id"
                            v-model="ws.claimLinkForm.insuranceClaimId"
                            label="Insurance claim"
                            helper-text="Search an existing claims case to inherit payer and invoice context."
                            @selected="ws.handleClaimLinkClaimsCaseSelected"
                        />
                    </div>
                    <div class="grid gap-2">
                        <BillingInvoiceLookupField
                            input-id="cl-invoice-id"
                            v-model="ws.claimLinkForm.billingInvoiceId"
                            label="Billing invoice"
                            helper-text="Search the billing ledger and link the dispensed item to the matching invoice."
                            :statuses="['issued', 'partially_paid']"
                            @selected="ws.handleClaimLinkInvoiceSelected"
                        />
                    </div>
                </div>
                <div class="grid gap-2">
                    <Label for="cl-notes">Notes</Label>
                    <Textarea id="cl-notes" v-model="ws.claimLinkForm.notes" rows="2" />
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.createClaimLinkDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.claimLinkSubmitting" @click="ws.submitCreateClaimLink">
                    {{ ws.claimLinkSubmitting ? 'Creating...' : 'Create Link' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

<Sheet :open="ws.createMsdOrderDialogOpen" @update:open="ws.createMsdOrderDialogOpen = $event">
        <SheetContent side="right" variant="form" size="4xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle>Create MSD Electronic Order</SheetTitle>
                <SheetDescription>Start from shortages or reorder signals, then review MSD codes and quantities before submission.</SheetDescription>
            </SheetHeader>
            <ScrollArea class="min-h-0 flex-1">
            <div class="px-6 py-4 grid gap-4">
                <div class="grid grid-cols-2 gap-3">
                    <div class="grid gap-2">
                        <Label for="msd-facility">Facility MSD Code</Label>
                        <Input id="msd-facility" v-model="ws.msdOrderForm.facilityMsdCode" placeholder="MSD customer code" />
                    </div>
                    <SingleDatePopoverField
                        input-id="msd-order-date"
                        label="Order Date *"
                        v-model="ws.msdOrderForm.orderDate"
                        :error-message="ws.msdOrderErrors.orderDate?.[0] ?? null"
                    />
                </div>
                <SingleDatePopoverField input-id="msd-expected-date" label="Expected Delivery Date" v-model="ws.msdOrderForm.expectedDeliveryDate" />

                <Separator />
                <div class="grid gap-2 rounded-lg border bg-muted/10 p-3">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p class="text-sm font-medium">Draft from live supply signals</p>
                            <p class="text-xs text-muted-foreground">Use known MSD item codes from shortages or reorder policy instead of typing every line manually.</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                class="h-8 text-xs"
                                :disabled="ws.shortageMsdDraftLines.length === 0"
                                @click="ws.openMsdOrderFromDraft(ws.shortageMsdDraftLines, 'shortage queue')"
                            >
                                Shortages ({{ ws.shortageMsdDraftLines.length }})
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                class="h-8 text-xs"
                                :disabled="ws.lowStockMsdDraftLines.length === 0"
                                @click="ws.openMsdOrderFromDraft(ws.lowStockMsdDraftLines, 'low-stock reorder policy')"
                            >
                                Low stock ({{ ws.lowStockMsdDraftLines.length }})
                            </Button>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-between">
                    <Label class="text-sm font-medium">Order Lines</Label>
                    <Button variant="outline" size="sm" class="h-7 text-xs" @click="ws.addMsdOrderLine">+ Add Line</Button>
                </div>
                <div v-for="(line, idx) in ws.msdOrderForm.lines" :key="idx" class="grid grid-cols-5 items-end gap-2 rounded border p-2">
                    <div class="grid gap-1">
                        <Label class="text-[10px]">MSD Code *</Label>
                        <Input v-model="line.msdCode" placeholder="MSD code" class="h-8 text-xs" />
                    </div>
                    <div class="grid gap-1">
                        <Label class="text-[10px]">Item Name *</Label>
                        <Input v-model="line.itemName" placeholder="Item name" class="h-8 text-xs" />
                    </div>
                    <div class="grid gap-1">
                        <Label class="text-[10px]">Qty *</Label>
                        <Input v-model="line.quantity" type="number" min="0.001" step="0.001" class="h-8 text-xs" />
                    </div>
                    <div class="grid gap-1">
                        <Label class="text-[10px]">Unit *</Label>
                        <Input v-model="line.unit" placeholder="e.g. packs" class="h-8 text-xs" />
                    </div>
                    <div class="flex items-end gap-1">
                        <div class="grid flex-1 gap-1">
                            <Label class="text-[10px]">Cost</Label>
                            <Input v-model="line.unitCost" type="number" min="0" step="0.01" class="h-8 text-xs" />
                        </div>
                        <Button v-if="ws.msdOrderForm.lines.length > 1" variant="ghost" size="sm" class="h-8 w-8 shrink-0 text-destructive" @click="ws.removeMsdOrderLine(idx)">×</Button>
                    </div>
                </div>

                <div class="grid gap-2">
                    <Label for="msd-notes">Notes</Label>
                    <Textarea id="msd-notes" v-model="ws.msdOrderForm.notes" rows="2" />
                </div>
                <div class="flex items-center gap-2">
                    <input id="msd-submit-now" v-model="ws.msdOrderForm.submitImmediately" type="checkbox" class="rounded border" />
                    <Label for="msd-submit-now" class="text-sm">Submit to MSD immediately</Label>
                </div>
            </div>
            </ScrollArea>
            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="ws.createMsdOrderDialogOpen = false">Cancel</Button>
                <Button :disabled="ws.msdOrderSubmitting" @click="ws.submitCreateMsdOrder">
                    {{ ws.msdOrderSubmitting ? 'Creating...' : 'Create Order' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
