<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatEnumLabel } from '@/lib/labels';
import type { BillingInvoice } from '@/composables/billingCashierQueue/useBillingPatientInvoices';

/**
 * A quick, in-place look at an invoice's line items and totals — no
 * navigation away, no extra API call (the workspace already has every field
 * this needs in memory). "Print" hands off to the existing modern document
 * infra (billing-invoices/{id}/print, DocumentShell-based) rather than
 * duplicating it here.
 */
const props = defineProps<{
    invoice: BillingInvoice;
}>();

const emit = defineEmits<{
    close: [];
}>();

const open = ref(true);
watch(open, (val) => {
    if (!val) emit('close');
});

function statusVariant(status: string): 'outline' | 'default' | 'secondary' | 'destructive' {
    switch (status) {
        case 'draft': return 'outline';
        case 'issued': return 'default';
        case 'partially_paid': return 'secondary';
        case 'paid': return 'default';
        case 'cancelled': return 'destructive';
        case 'voided': return 'destructive';
        default: return 'outline';
    }
}

function formatMoney(amount: number | undefined | null, currencyCode?: string | null): string {
    const val = amount ?? 0;
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    return `${formatted} ${currencyCode || 'TZS'}`;
}

function lineItemTotal(item: { quantity: number; unitPrice: number }): number {
    return item.quantity * item.unitPrice;
}

// The backend column is nullable — a missing invoice.lineItems means the
// same thing as an empty one ("no line items were recorded").
const lineItems = computed(() => props.invoice.lineItems ?? []);

const totalRows = computed(() => [
    ['Subtotal', formatMoney(props.invoice.subtotalAmount, props.invoice.currencyCode)],
    ['Discount', formatMoney(props.invoice.discountAmount, props.invoice.currencyCode)],
    ['Tax', formatMoney(props.invoice.taxAmount, props.invoice.currencyCode)],
    ['Grand Total', formatMoney(props.invoice.totalAmount, props.invoice.currencyCode)],
    ['Paid', formatMoney(props.invoice.paidAmount, props.invoice.currencyCode)],
    ['Balance', formatMoney(props.invoice.balanceAmount, props.invoice.currencyCode)],
]);
</script>

<template>
    <Sheet v-model:open="open">
        <SheetContent side="right" variant="form" size="xl">
            <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                <div class="flex items-center gap-2">
                    <SheetTitle>{{ invoice.invoiceNumber || 'Draft invoice' }}</SheetTitle>
                    <Badge :variant="statusVariant(invoice.status)" class="text-[10px]">{{ formatEnumLabel(invoice.status) }}</Badge>
                </div>
                <SheetDescription>
                    {{ invoice.invoiceDate }}
                    <span v-if="invoice.paymentDueAt"> · Due {{ invoice.paymentDueAt }}</span>
                </SheetDescription>
            </SheetHeader>

            <div class="flex-1 space-y-4 overflow-y-auto p-4">
                <div>
                    <h3 class="mb-2 text-xs font-medium text-muted-foreground">Line items</h3>
                    <div v-if="lineItems.length === 0" class="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                        No line items were recorded for this invoice.
                    </div>
                    <div v-else class="overflow-hidden rounded-lg border">
                        <table class="w-full text-sm">
                            <thead class="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th class="px-3 py-2 font-medium">Description</th>
                                    <th class="px-3 py-2 text-right font-medium">Qty</th>
                                    <th class="px-3 py-2 text-right font-medium">Unit price</th>
                                    <th class="px-3 py-2 text-right font-medium">Line total</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                <tr v-for="(item, idx) in lineItems" :key="idx">
                                    <td class="px-3 py-2 align-top">
                                        <p class="font-medium">{{ item.description }}</p>
                                        <p v-if="item.serviceCode" class="text-xs text-muted-foreground">Code: {{ item.serviceCode }}</p>
                                    </td>
                                    <td class="px-3 py-2 text-right align-top tabular-nums">{{ item.quantity }}</td>
                                    <td class="px-3 py-2 text-right align-top tabular-nums">{{ formatMoney(item.unitPrice, invoice.currencyCode) }}</td>
                                    <td class="px-3 py-2 text-right align-top font-medium tabular-nums">{{ formatMoney(lineItemTotal(item), invoice.currencyCode) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="rounded-lg border p-3">
                    <h3 class="mb-2 text-xs font-medium text-muted-foreground">Totals</h3>
                    <dl class="space-y-1.5 text-sm">
                        <div v-for="[label, value] in totalRows" :key="label" class="flex items-center justify-between">
                            <dt class="text-muted-foreground">{{ label }}</dt>
                            <dd class="font-medium tabular-nums">{{ value }}</dd>
                        </div>
                    </dl>
                </div>

                <div v-if="invoice.notes" class="rounded-lg border p-3">
                    <h3 class="mb-1 text-xs font-medium text-muted-foreground">Notes</h3>
                    <p class="text-sm">{{ invoice.notes }}</p>
                </div>
            </div>

            <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                <Button variant="outline" @click="emit('close')">Close</Button>
                <Button as-child>
                    <a :href="`/billing/${invoice.id}/print`" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5">
                        <AppIcon name="printer" class="size-3.5" />
                        Print
                    </a>
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
