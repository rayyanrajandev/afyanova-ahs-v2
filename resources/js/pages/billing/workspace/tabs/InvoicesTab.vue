<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatEnumLabel } from '@/lib/labels';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { BillingInvoice } from '@/composables/billingCashierQueue/useBillingPatientInvoices';
import InvoicePreviewSheet from '../sheets/InvoicePreviewSheet.vue';
import PaymentSheet from '../sheets/PaymentSheet.vue';

const props = defineProps<{
    invoices: BillingInvoice[];
    patientId: string;
    focusInvoiceId?: string | null;
    recordPayment: (input: { invoiceId: string; amount: number; paymentMethod: string; paymentReference: string }) => Promise<any>;
    issueInvoice: (invoiceId: string) => Promise<any>;
    invalidate: (patientId: string | null) => void;
}>();

/**
 * Deep-link entry point from patientChartModuleHref('/billing', ...,
 * { focusInvoiceId }) — the Patient Chart's Billing tab links straight to
 * one invoice. Scrolls to and highlights that invoice once it's rendered.
 */
async function scrollToFocusedInvoice(): Promise<void> {
    const id = props.focusInvoiceId;
    if (!id || !props.invoices.some((inv) => inv.id === id)) return;
    await nextTick();
    document.getElementById(`billing-invoice-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

onMounted(scrollToFocusedInvoice);
watch(() => props.invoices, scrollToFocusedInvoice);

const selectedInvoiceIds = ref<Set<string>>(new Set());
const showPaymentSheet = ref(false);
const paymentInvoice = ref<BillingInvoice | null>(null);
const previewInvoice = ref<BillingInvoice | null>(null);

function toggleInvoiceSelection(invoiceId: string): void {
    const next = new Set(selectedInvoiceIds.value);
    if (next.has(invoiceId)) next.delete(invoiceId);
    else next.add(invoiceId);
    selectedInvoiceIds.value = next;
}

const selectedUnpaidInvoices = computed(() =>
    props.invoices.filter((inv) => selectedInvoiceIds.value.has(inv.id) && inv.balanceAmount > 0 && inv.status !== 'cancelled' && inv.status !== 'voided'),
);

function openPaymentDialog(invoice: BillingInvoice): void {
    paymentInvoice.value = invoice;
    showPaymentSheet.value = true;
}

function openPreview(invoice: BillingInvoice): void {
    previewInvoice.value = invoice;
}

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

function formatMoney(amount: number, currencyCode?: string | null): string {
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    return `${formatted} ${currencyCode || 'TZS'}`;
}

async function handleIssueInvoice(invoiceId: string): Promise<void> {
    try {
        await props.issueInvoice(invoiceId);
        notifySuccess('Invoice issued.');
        props.invalidate(props.patientId);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to issue invoice.');
    }
}

function handlePaymentComplete(): void {
    showPaymentSheet.value = false;
    paymentInvoice.value = null;
    props.invalidate(props.patientId);
}
</script>

<template>
    <div class="space-y-3">
        <div
            v-for="invoice in invoices"
            :id="`billing-invoice-${invoice.id}`"
            :key="invoice.id"
            :class="['rounded-lg border p-3 transition-colors', invoice.id === focusInvoiceId ? 'border-primary ring-2 ring-primary/40' : '']"
        >
            <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-2">
                    <Checkbox
                        v-if="invoice.balanceAmount > 0 && invoice.status !== 'draft' && invoice.status !== 'cancelled' && invoice.status !== 'voided'"
                        :checked="selectedInvoiceIds.has(invoice.id)"
                        class="mt-0.5"
                        @update:checked="toggleInvoiceSelection(invoice.id)"
                    />
                    <div>
                        <div class="flex items-center gap-2">
                            <p class="text-sm font-medium">{{ invoice.invoiceNumber || 'Draft' }}</p>
                            <Badge :variant="statusVariant(invoice.status)" class="text-[10px]">{{ formatEnumLabel(invoice.status) }}</Badge>
                        </div>
                        <p class="mt-0.5 text-xs text-muted-foreground">
                            {{ invoice.invoiceDate }}
                            <span v-if="invoice.paymentDueAt"> · Due {{ invoice.paymentDueAt }}</span>
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-sm font-semibold tabular-nums">{{ formatMoney(invoice.totalAmount, invoice.currencyCode) }}</p>
                    <p v-if="invoice.balanceAmount > 0" class="text-xs text-destructive tabular-nums">Balance: {{ formatMoney(invoice.balanceAmount, invoice.currencyCode) }}</p>
                </div>
            </div>

            <div v-if="(invoice.lineItems ?? []).length > 0" class="mt-2 space-y-1">
                <div v-for="(item, idx) in (invoice.lineItems ?? []).slice(0, 3)" :key="idx" class="flex items-center justify-between text-xs text-muted-foreground">
                    <span class="truncate">{{ item.description }}</span>
                    <span class="tabular-nums">{{ formatMoney(item.unitPrice * item.quantity, invoice.currencyCode) }}</span>
                </div>
                <p v-if="(invoice.lineItems ?? []).length > 3" class="text-xs text-muted-foreground">+{{ (invoice.lineItems ?? []).length - 3 }} more items</p>
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-2">
                <Button
                    v-if="invoice.status === 'draft'"
                    size="sm"
                    variant="outline"
                    @click="handleIssueInvoice(invoice.id)"
                >
                    Issue Invoice
                </Button>
                <Button
                    v-else-if="invoice.balanceAmount > 0 && invoice.status !== 'cancelled' && invoice.status !== 'voided'"
                    size="sm"
                    @click="openPaymentDialog(invoice)"
                >
                    Record Payment
                </Button>
                <Badge v-else-if="invoice.balanceAmount <= 0" variant="default" class="text-[10px]">Paid</Badge>

                <Button size="sm" variant="ghost" class="gap-1.5" @click="openPreview(invoice)">
                    <AppIcon name="eye" class="size-3.5" />
                    Preview
                </Button>
                <Button size="sm" variant="ghost" class="gap-1.5" as-child>
                    <a :href="`/billing-invoices/${invoice.id}/print`" target="_blank" rel="noopener">
                        <AppIcon name="printer" class="size-3.5" />
                        Print
                    </a>
                </Button>
            </div>
        </div>
    </div>

    <PaymentSheet
        v-if="showPaymentSheet && paymentInvoice"
        :invoice="paymentInvoice"
        :patient-id="patientId"
        :record-payment="recordPayment"
        @complete="handlePaymentComplete"
        @close="showPaymentSheet = false"
    />

    <InvoicePreviewSheet
        v-if="previewInvoice"
        :invoice="previewInvoice"
        @close="previewInvoice = null"
    />
</template>
