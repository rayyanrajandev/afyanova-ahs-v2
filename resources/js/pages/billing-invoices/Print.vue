<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import DocumentShell from '@/components/documents/DocumentShell.vue';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/lib/labels';
import type { SharedDocumentBranding } from '@/types';

type BillingInvoiceLineItem = {
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal?: number | null;
    serviceCode?: string | null;
    unit?: string | null;
    notes?: string | null;
};

type BillingInvoiceDocument = {
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    paymentDueAt: string | null;
    currencyCode: string | null;
    subtotalAmount: string | number | null;
    discountAmount: string | number | null;
    taxAmount: string | number | null;
    totalAmount: string | number | null;
    paidAmount: string | number | null;
    balanceAmount: string | number | null;
    lastPaymentAt: string | null;
    lastPaymentReference: string | null;
    pricingMode: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
    lineItems: BillingInvoiceLineItem[] | null;
};

type InvoicePerson = {
    patientNumber?: string | null;
    fullName?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    phone?: string | null;
};

type InvoiceAppointment = {
    appointmentNumber?: string | null;
    department?: string | null;
};

type InvoiceAdmission = {
    admissionNumber?: string | null;
    ward?: string | null;
    bed?: string | null;
};

type InvoicePayer = {
    payerName?: string | null;
    payerPlanName?: string | null;
    contractCode?: string | null;
    payerType?: string | null;
};

type InvoiceIssuer = {
    name?: string | null;
};

type InvoicePayment = {
    id: string;
    paymentAt: string | null;
    amount: string | number | null;
    payerType: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
    note: string | null;
};

const props = defineProps<{
    invoice: BillingInvoiceDocument;
    patient: InvoicePerson | null;
    appointment: InvoiceAppointment | null;
    admission: InvoiceAdmission | null;
    payer: InvoicePayer | null;
    issuedBy: InvoiceIssuer | null;
    payments: InvoicePayment[];
    canViewPaymentHistory: boolean;
    documentBranding: SharedDocumentBranding;
    generatedAt: string | null;
}>();

const pageTitle = computed(() =>
    props.invoice.invoiceNumber?.trim()
        ? `Invoice ${props.invoice.invoiceNumber}`
        : 'Billing Invoice',
);

const statusLabel = computed(() =>
    formatEnumLabel(props.invoice.status || 'draft'),
);

const lineItems = computed(() => props.invoice.lineItems ?? []);

const encounterSummary = computed(() => {
    const parts: string[] = [];

    if (props.appointment?.appointmentNumber) {
        parts.push(`Appointment ${props.appointment.appointmentNumber}`);
    }

    if (props.admission?.admissionNumber) {
        parts.push(`Admission ${props.admission.admissionNumber}`);
    }

    return parts.length > 0 ? parts.join(' | ') : 'No linked encounter';
});

const totalRows = computed(() => [
    ['Subtotal', formatMoney(props.invoice.subtotalAmount, props.invoice.currencyCode)],
    ['Discount', formatMoney(props.invoice.discountAmount, props.invoice.currencyCode)],
    ['Tax', formatMoney(props.invoice.taxAmount, props.invoice.currencyCode)],
    ['Grand Total', formatMoney(props.invoice.totalAmount, props.invoice.currencyCode)],
    ['Collected', formatMoney(props.invoice.paidAmount, props.invoice.currencyCode)],
    ['Outstanding', formatMoney(props.invoice.balanceAmount, props.invoice.currencyCode)],
]);

const compactPayerLabel = computed(() => {
    if (props.payer?.payerName?.trim()) return props.payer.payerName;
    if (props.payer?.payerType?.trim()) return formatEnumLabel(props.payer.payerType);
    return 'Self pay / direct billing';
});

const compactContextRows = computed(() => [
    ['Patient', props.patient?.fullName || 'Unknown patient'],
    ['Patient No.', props.patient?.patientNumber || 'N/A'],
    ['Invoice Date', formatDate(props.invoice.invoiceDate)],
    ['Due Date', formatDate(props.invoice.paymentDueAt)],
    ['Payer', compactPayerLabel.value],
    ['Encounter', encounterSummary.value],
]);

function amountToNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    const parsed = Number.parseFloat(String(value ?? '0'));

    return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: string | number | null | undefined, currencyCode: string | null): string {
    const amount = amountToNumber(value);
    const currency = (currencyCode || 'TZS').trim().toUpperCase() || 'TZS';

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

function formatDate(value: string | null | undefined): string {
    if (!value) return 'N/A';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return new Intl.DateTimeFormat('en-TZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(date);
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

function lineItemTotal(lineItem: BillingInvoiceLineItem): number {
    const explicitTotal = amountToNumber(lineItem.lineTotal ?? null);

    return explicitTotal > 0
        ? explicitTotal
        : amountToNumber(lineItem.quantity) * amountToNumber(lineItem.unitPrice);
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
        title="Invoice"
        :subtitle="encounterSummary"
        :document-number="invoice.invoiceNumber || 'Draft invoice'"
        :status-label="statusLabel"
        :generated-at-label="generatedAt ? formatDateTime(generatedAt) : null"
        @print="printDocument"
    >
        <template #actions>
            <Button variant="outline" class="gap-2 print:hidden" @click="printDocument">
                Print
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <a :href="`/billing-invoices/${invoice.id}/pdf`">Download PDF</a>
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <Link href="/billing-invoices">Back to Billing</Link>
            </Button>
        </template>

        <div class="space-y-4">
            <section class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div class="border border-slate-200 p-3">
                    <div class="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                                Invoice summary
                            </p>
                            <p class="mt-1.5 text-base font-semibold text-slate-950">
                                {{ patient?.fullName || 'Unknown patient' }}
                            </p>
                            <p class="mt-1 text-sm text-slate-600">
                                {{ compactPayerLabel }}
                            </p>
                        </div>
                        <div class="text-sm sm:text-right">
                            <p class="font-semibold text-slate-950">
                                {{ formatMoney(invoice.totalAmount, invoice.currencyCode) }}
                            </p>
                            <p class="mt-1 text-slate-600">
                                {{ statusLabel }}
                            </p>
                        </div>
                    </div>

                    <dl class="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-slate-600">
                        <div
                            v-for="[label, value] in compactContextRows"
                            :key="`compact-context-row-${label}`"
                            class="flex items-start justify-between gap-3 border border-slate-200 px-2.5 py-2"
                        >
                            <dt>{{ label }}</dt>
                            <dd class="text-right font-medium text-slate-900">
                                {{ value }}
                            </dd>
                        </div>
                    </dl>
                </div>

                <aside class="border border-slate-200 p-3">
                    <h2 class="text-sm font-semibold text-slate-950">Totals</h2>
                    <dl class="mt-3 space-y-2 text-sm">
                        <div
                            v-for="[label, value] in totalRows"
                            :key="`total-row-${label}`"
                            class="flex items-center justify-between gap-3"
                        >
                            <dt class="text-slate-600">{{ label }}</dt>
                            <dd class="font-medium text-slate-950">
                                {{ value }}
                            </dd>
                        </div>
                    </dl>

                    <div
                        v-if="invoice.statusReason || invoice.lastPaymentReference"
                        class="mt-4 space-y-2 border-t border-slate-200 pt-3"
                    >
                        <div v-if="invoice.statusReason">
                            <p class="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                                Status note
                            </p>
                            <p class="mt-1 text-sm leading-6 text-slate-700">
                                {{ invoice.statusReason }}
                            </p>
                        </div>
                        <div v-if="invoice.lastPaymentReference">
                            <p class="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                                Last payment ref
                            </p>
                            <p class="mt-1 text-sm leading-6 text-slate-700">
                                {{ invoice.lastPaymentReference }}
                            </p>
                        </div>
                    </div>
                </aside>
            </section>

            <section class="overflow-hidden border border-slate-200">
                <div class="border-b border-slate-200 px-3 py-2.5 sm:px-4">
                    <h2 class="text-sm font-semibold text-slate-950">Invoice Lines</h2>
                    <p class="mt-1 text-xs text-slate-500">
                        {{ lineItems.length }} line item{{ lineItems.length === 1 ? '' : 's' }} included on this invoice.
                    </p>
                </div>

                <div v-if="lineItems.length === 0" class="px-3 py-5 text-sm text-slate-500 sm:px-4">
                    No line items were recorded for this invoice.
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-slate-200 text-sm">
                        <thead class="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                                <th class="px-3 py-2.5 sm:px-4">Description</th>
                                <th class="px-3 py-2.5 text-right sm:px-4">Qty</th>
                                <th class="px-3 py-2.5 text-right sm:px-4">Unit Price</th>
                                <th class="px-3 py-2.5 text-right sm:px-4">Line Total</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            <tr v-for="(lineItem, index) in lineItems" :key="`${invoice.id}-line-${index}`">
                                <td class="px-3 py-2.5 align-top sm:px-4">
                                    <p class="font-medium text-slate-950">
                                        {{ lineItem.description || `Line ${index + 1}` }}
                                    </p>
                                    <p
                                        v-if="lineItem.serviceCode || lineItem.unit"
                                        class="mt-1 text-xs leading-5 text-slate-500"
                                    >
                                        <span v-if="lineItem.serviceCode">Code: {{ lineItem.serviceCode }}</span>
                                        <span v-if="lineItem.serviceCode && lineItem.unit"> | </span>
                                        <span v-if="lineItem.unit">Unit: {{ lineItem.unit }}</span>
                                    </p>
                                </td>
                                <td class="px-3 py-2.5 text-right align-top text-slate-700 sm:px-4">
                                    {{ amountToNumber(lineItem.quantity) }}
                                </td>
                                <td class="px-3 py-2.5 text-right align-top text-slate-700 sm:px-4">
                                    {{ formatMoney(lineItem.unitPrice, invoice.currencyCode) }}
                                </td>
                                <td class="px-3 py-2.5 text-right align-top font-medium text-slate-950 sm:px-4">
                                    {{ formatMoney(lineItemTotal(lineItem), invoice.currencyCode) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </DocumentShell>
</template>
