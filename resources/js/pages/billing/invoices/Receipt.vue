<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import DocumentShell from '@/components/documents/DocumentShell.vue';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/lib/labels';
import type { SharedDocumentBranding } from '@/types';

type ReceiptInvoice = {
    id: string;
    invoiceNumber: string | null;
    currencyCode: string | null;
    balanceAmount: string | number | null;
};

type ReceiptPayment = {
    id: string;
    paymentAt: string | null;
    amount: string | number | null;
    cumulativePaidAmount: string | number | null;
    payerType: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
    note: string | null;
};

type ReceiptPerson = {
    patientNumber?: string | null;
    fullName?: string | null;
};

type ReceiptRecordedBy = {
    name?: string | null;
};

const props = defineProps<{
    invoice: ReceiptInvoice;
    payment: ReceiptPayment;
    patient: ReceiptPerson | null;
    recordedBy: ReceiptRecordedBy | null;
    documentBranding: SharedDocumentBranding;
    generatedAt: string | null;
}>();

const pageTitle = computed(() =>
    props.invoice.invoiceNumber?.trim() ? `Receipt — ${props.invoice.invoiceNumber}` : 'Payment Receipt',
);

const payerLabel = computed(() => {
    if (props.payment.payerType?.trim()) return formatEnumLabel(props.payment.payerType);
    return 'Self pay / direct billing';
});

const contextRows = computed(() => [
    ['Patient', props.patient?.fullName || 'Unknown patient'],
    ['Patient No.', props.patient?.patientNumber || 'N/A'],
    ['Invoice No.', props.invoice.invoiceNumber || 'Draft invoice'],
    ['Payment Date', formatDateTime(props.payment.paymentAt)],
    ['Payer', payerLabel.value],
    ['Received By', props.recordedBy?.name || 'N/A'],
]);

const paymentRows = computed(() => [
    ['Amount Paid', formatMoney(props.payment.amount)],
    ['Method', formatEnumLabel(props.payment.paymentMethod || '')],
    ['Reference', props.payment.paymentReference || 'N/A'],
    ['Running Paid Total', formatMoney(props.payment.cumulativePaidAmount)],
    ['Invoice Balance', formatMoney(props.invoice.balanceAmount)],
]);

function amountToNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number.parseFloat(String(value ?? '0'));
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: string | number | null | undefined): string {
    const amount = amountToNumber(value);
    const currency = (props.invoice.currencyCode || 'TZS').trim().toUpperCase() || 'TZS';

    try {
        return new Intl.NumberFormat('en-TZ', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return new Intl.DateTimeFormat('en-TZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

function printDocument() {
    window.print();
}
</script>

<template>
    <Head :title="pageTitle" />

    <DocumentShell
        :document-branding="documentBranding"
        eyebrow="Billing Document"
        title="Payment Receipt"
        :subtitle="invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : 'Draft invoice'"
        :document-number="payment.id"
        :generated-at-label="generatedAt ? formatDateTime(generatedAt) : null"
        @print="printDocument"
    >
        <template #actions>
            <Button variant="outline" class="gap-2 print:hidden" @click="printDocument">
                <AppIcon name="printer" class="size-3.5" />
                Print
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <a :href="`/billing/${invoice.id}/payments/${payment.id}/receipt/pdf`" class="inline-flex items-center gap-2">
                    <AppIcon name="download" class="size-3.5" />
                    Download PDF
                </a>
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <Link href="/billing">Back to Billing</Link>
            </Button>
        </template>

        <div class="space-y-4">
            <section class="grid gap-3 lg:grid-cols-2">
                <div class="border border-slate-200 p-3">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Receipt summary</p>
                    <dl class="mt-3 grid gap-2 text-sm text-slate-600">
                        <div
                            v-for="[label, value] in contextRows"
                            :key="`context-row-${label}`"
                            class="flex items-start justify-between gap-3 border border-slate-200 px-2.5 py-2"
                        >
                            <dt>{{ label }}</dt>
                            <dd class="text-right font-medium text-slate-900">{{ value }}</dd>
                        </div>
                    </dl>
                </div>

                <aside class="border border-slate-200 p-3">
                    <h2 class="text-sm font-semibold text-slate-950">Payment</h2>
                    <dl class="mt-3 space-y-2 text-sm">
                        <div
                            v-for="[label, value] in paymentRows"
                            :key="`payment-row-${label}`"
                            class="flex items-center justify-between gap-3"
                        >
                            <dt class="text-slate-600">{{ label }}</dt>
                            <dd class="font-medium text-slate-950">{{ value }}</dd>
                        </div>
                    </dl>

                    <div v-if="payment.note" class="mt-4 space-y-1 border-t border-slate-200 pt-3">
                        <p class="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Note</p>
                        <p class="text-sm leading-6 text-slate-700">{{ payment.note }}</p>
                    </div>
                </aside>
            </section>

            <p class="text-xs text-slate-500">
                This receipt confirms the payment above was received against the invoice noted. It does not itself constitute a tax
                invoice — see the invoice document for the full tax breakdown.
            </p>
        </div>
    </DocumentShell>
</template>
