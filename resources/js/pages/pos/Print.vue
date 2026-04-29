<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import DocumentShell from '@/components/documents/DocumentShell.vue';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/lib/labels';
import type { SharedDocumentBranding } from '@/types';

type PosSaleLineItem = {
    id: string;
    itemType: string | null;
    itemReference: string | null;
    itemCode: string | null;
    itemName: string | null;
    quantity: string | number | null;
    unitPrice: string | number | null;
    taxAmount: string | number | null;
    lineTotalAmount: string | number | null;
    notes: string | null;
    metadata: Record<string, unknown> | null;
};

type PosSalePayment = {
    id: string;
    paymentMethod: string | null;
    amountReceived: string | number | null;
    amountApplied: string | number | null;
    changeGiven: string | number | null;
    paymentReference: string | null;
    paidAt: string | null;
    note: string | null;
};

type PosSaleAdjustment = {
    id: string;
    adjustmentType: string | null;
    amount: string | number | null;
    paymentMethod: string | null;
    adjustmentReference: string | null;
    reasonCode: string | null;
    notes: string | null;
    processedAt: string | null;
};

type PosSaleDocument = {
    id: string;
    saleNumber: string | null;
    receiptNumber: string | null;
    saleChannel: string | null;
    customerType: string | null;
    customerName: string | null;
    customerReference: string | null;
    status: string | null;
    currencyCode: string | null;
    subtotalAmount: string | number | null;
    discountAmount: string | number | null;
    taxAmount: string | number | null;
    totalAmount: string | number | null;
    paidAmount: string | number | null;
    balanceAmount: string | number | null;
    changeAmount: string | number | null;
    soldAt: string | null;
    notes: string | null;
    register: { registerCode: string | null; registerName: string | null; location: string | null } | null;
    session: { sessionNumber: string | null; openedAt: string | null } | null;
    lineItems: PosSaleLineItem[] | null;
    payments: PosSalePayment[] | null;
    adjustments: PosSaleAdjustment[] | null;
};

type PosPatient = {
    patientNumber?: string | null;
    fullName?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    phone?: string | null;
};

type PosUser = {
    name?: string | null;
    email?: string | null;
};

const props = defineProps<{
    sale: PosSaleDocument;
    patient: PosPatient | null;
    completedBy: PosUser | null;
    documentBranding: SharedDocumentBranding;
    generatedAt: string | null;
}>();

const pageTitle = computed(() =>
    props.sale.receiptNumber?.trim()
        ? `POS Receipt ${props.sale.receiptNumber}`
        : (props.sale.saleNumber?.trim() ? `POS Sale ${props.sale.saleNumber}` : 'POS Receipt'),
);

const subtitle = computed(() => {
    const parts = [
        props.patient?.fullName || props.sale.customerName || null,
        props.patient?.patientNumber ? `Patient ${props.patient.patientNumber}` : null,
        props.sale.saleChannel ? formatEnumLabel(props.sale.saleChannel) : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' / ') : 'Cashier receipt and settlement summary';
});

const documentNumber = computed(() =>
    props.sale.receiptNumber?.trim() || props.sale.saleNumber?.trim() || 'Pending receipt',
);

const statusLabel = computed(() =>
    formatEnumLabel(props.sale.status || 'completed'),
);

const saleSummaryRows = computed(() => [
    ['Sale number', props.sale.saleNumber || 'N/A'],
    ['Receipt number', props.sale.receiptNumber || 'N/A'],
    ['Sold at', formatDateTime(props.sale.soldAt)],
    ['Channel', formatEnumLabel(props.sale.saleChannel || 'general_retail')],
    ['Customer type', formatEnumLabel(props.sale.customerType || 'anonymous')],
    ['Cashier', props.completedBy?.name || 'Not recorded'],
]);

const customerRows = computed(() => [
    ['Customer', props.patient?.fullName || props.sale.customerName || 'Walk-in customer'],
    ['Patient No.', props.patient?.patientNumber || 'N/A'],
    ['Reference', props.sale.customerReference || 'N/A'],
    ['Phone', props.patient?.phone || 'N/A'],
]);

const registerRows = computed(() => [
    ['Register', props.sale.register?.registerName || 'N/A'],
    ['Register code', props.sale.register?.registerCode || 'N/A'],
    ['Location', props.sale.register?.location || 'N/A'],
    ['Session', props.sale.session?.sessionNumber || 'N/A'],
]);

const totalsRows = computed(() => [
    ['Subtotal', formatMoney(props.sale.subtotalAmount, props.sale.currencyCode)],
    ['Discount', formatMoney(props.sale.discountAmount, props.sale.currencyCode)],
    ['Tax', formatMoney(props.sale.taxAmount, props.sale.currencyCode)],
    ['Total', formatMoney(props.sale.totalAmount, props.sale.currencyCode)],
    ['Paid', formatMoney(props.sale.paidAmount, props.sale.currencyCode)],
    ['Change', formatMoney(props.sale.changeAmount, props.sale.currencyCode)],
    ['Balance', formatMoney(props.sale.balanceAmount, props.sale.currencyCode)],
]);

const lineItems = computed(() => props.sale.lineItems ?? []);
const payments = computed(() => props.sale.payments ?? []);
const adjustments = computed(() => props.sale.adjustments ?? []);

function amountToNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    const parsed = Number.parseFloat(String(value ?? '0'));

    return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: string | number | null | undefined, currencyCode: string | null | undefined): string {
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

function lineSourceLabel(lineItem: PosSaleLineItem): string | null {
    const metadata = lineItem.metadata ?? null;
    if (!metadata) return null;

    const source = typeof metadata.source === 'string' ? metadata.source.trim() : '';
    const sourceKind = typeof metadata.sourceWorkflowKind === 'string' ? metadata.sourceWorkflowKind.trim() : '';
    const sourceId = typeof metadata.sourceWorkflowId === 'string' ? metadata.sourceWorkflowId.trim() : '';
    const category = typeof metadata.category === 'string' ? metadata.category.trim() : '';

    const parts = [
        sourceKind ? formatEnumLabel(sourceKind) : null,
        source ? formatEnumLabel(source) : null,
        category ? formatEnumLabel(category) : null,
        sourceId ? `Ref ${sourceId.slice(0, 8)}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' / ') : null;
}

function printDocument(): void {
    window.print();
}
</script>

<template>
    <Head :title="pageTitle" />

    <DocumentShell
        :document-branding="documentBranding"
        eyebrow="POS Receipt"
        title="Cash Sale Receipt"
        :subtitle="subtitle"
        :document-number="documentNumber"
        :status-label="statusLabel"
        :generated-at-label="generatedAt ? formatDateTime(generatedAt) : null"
        @print="printDocument"
    >
        <template #actions>
            <Button variant="outline" class="gap-2 print:hidden" @click="printDocument">
                Print
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <a :href="`/pos/sales/${sale.id}/pdf`">Download PDF</a>
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <Link href="/pos">Back to POS</Link>
            </Button>
        </template>

        <div class="space-y-4">
            <section class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div class="border border-slate-200 p-3">
                    <div class="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                                Receipt summary
                            </p>
                            <p class="mt-1.5 text-base font-semibold text-slate-950">
                                {{ patient?.fullName || sale.customerName || 'Walk-in customer' }}
                            </p>
                            <p class="mt-1 text-sm text-slate-600">
                                {{ formatEnumLabel(sale.customerType || 'anonymous') }}
                            </p>
                        </div>
                        <div class="text-sm sm:text-right">
                            <p class="font-semibold text-slate-950">
                                {{ formatMoney(sale.totalAmount, sale.currencyCode) }}
                            </p>
                            <p class="mt-1 text-slate-600">
                                {{ statusLabel }}
                            </p>
                        </div>
                    </div>

                    <dl class="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-slate-600">
                        <div v-for="[label, value] in saleSummaryRows" :key="`sale-summary-${label}`">
                            <dt class="text-xs uppercase tracking-[0.24em] text-slate-500">{{ label }}</dt>
                            <dd class="mt-1 font-medium text-slate-900">{{ value }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="border border-slate-200 p-3">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                        Totals
                    </p>
                    <dl class="mt-3 space-y-2">
                        <div
                            v-for="[label, value] in totalsRows"
                            :key="`sale-total-${label}`"
                            class="flex items-center justify-between gap-3 text-sm"
                        >
                            <dt class="text-slate-500">{{ label }}</dt>
                            <dd class="font-medium text-slate-950">{{ value }}</dd>
                        </div>
                    </dl>
                </div>
            </section>

            <section class="grid gap-3 lg:grid-cols-3">
                <div class="border border-slate-200 p-3">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                        Customer
                    </p>
                    <dl class="mt-3 space-y-2 text-sm">
                        <div
                            v-for="[label, value] in customerRows"
                            :key="`customer-row-${label}`"
                            class="flex items-center justify-between gap-3"
                        >
                            <dt class="text-slate-500">{{ label }}</dt>
                            <dd class="text-right font-medium text-slate-950">{{ value }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="border border-slate-200 p-3">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                        Register
                    </p>
                    <dl class="mt-3 space-y-2 text-sm">
                        <div
                            v-for="[label, value] in registerRows"
                            :key="`register-row-${label}`"
                            class="flex items-center justify-between gap-3"
                        >
                            <dt class="text-slate-500">{{ label }}</dt>
                            <dd class="text-right font-medium text-slate-950">{{ value }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="border border-slate-200 p-3">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                        Notes
                    </p>
                    <p class="mt-3 text-sm leading-6 text-slate-700">
                        {{ sale.notes || 'No cashier note was recorded for this sale.' }}
                    </p>
                </div>
            </section>

            <section class="border border-slate-200">
                <div class="border-b border-slate-200 px-3 py-2">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                        Sale lines
                    </p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-slate-200 text-sm">
                        <thead class="bg-slate-50">
                            <tr>
                                <th class="px-3 py-2 text-left font-medium text-slate-500">Item</th>
                                <th class="px-3 py-2 text-right font-medium text-slate-500">Qty</th>
                                <th class="px-3 py-2 text-right font-medium text-slate-500">Unit Price</th>
                                <th class="px-3 py-2 text-right font-medium text-slate-500">Tax</th>
                                <th class="px-3 py-2 text-right font-medium text-slate-500">Line Total</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr v-for="lineItem in lineItems" :key="lineItem.id">
                                <td class="px-3 py-3 align-top">
                                    <p class="font-medium text-slate-950">
                                        {{ lineItem.itemName || 'POS item' }}
                                    </p>
                                    <p class="mt-1 text-xs text-slate-500">
                                        {{ [lineItem.itemCode, formatEnumLabel(lineItem.itemType || 'manual')].filter(Boolean).join(' / ') || 'Manual line' }}
                                    </p>
                                    <p v-if="lineSourceLabel(lineItem)" class="mt-1 text-xs text-slate-500">
                                        {{ lineSourceLabel(lineItem) }}
                                    </p>
                                    <p v-if="lineItem.notes" class="mt-1 text-xs text-slate-500">
                                        {{ lineItem.notes }}
                                    </p>
                                </td>
                                <td class="px-3 py-3 text-right text-slate-700">
                                    {{ lineItem.quantity }}
                                </td>
                                <td class="px-3 py-3 text-right text-slate-700">
                                    {{ formatMoney(lineItem.unitPrice, sale.currencyCode) }}
                                </td>
                                <td class="px-3 py-3 text-right text-slate-700">
                                    {{ formatMoney(lineItem.taxAmount, sale.currencyCode) }}
                                </td>
                                <td class="px-3 py-3 text-right font-medium text-slate-950">
                                    {{ formatMoney(lineItem.lineTotalAmount, sale.currencyCode) }}
                                </td>
                            </tr>
                            <tr v-if="lineItems.length === 0">
                                <td colspan="5" class="px-3 py-4 text-center text-sm text-slate-500">
                                    No sale lines were recorded.
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div class="border border-slate-200">
                    <div class="border-b border-slate-200 px-3 py-2">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            Payments
                        </p>
                    </div>
                    <div class="divide-y divide-slate-100">
                        <div
                            v-for="payment in payments"
                            :key="payment.id"
                            class="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_auto_auto]"
                        >
                            <div>
                                <p class="font-medium text-slate-950">
                                    {{ formatEnumLabel(payment.paymentMethod || 'cash') }}
                                </p>
                                <p class="mt-1 text-xs text-slate-500">
                                    {{ payment.paymentReference || 'No payment reference' }}
                                </p>
                                <p v-if="payment.note" class="mt-1 text-xs text-slate-500">
                                    {{ payment.note }}
                                </p>
                            </div>
                            <div class="text-sm text-slate-700 sm:text-right">
                                <p>Received {{ formatMoney(payment.amountReceived, sale.currencyCode) }}</p>
                                <p>Applied {{ formatMoney(payment.amountApplied, sale.currencyCode) }}</p>
                            </div>
                            <div class="text-sm text-slate-700 sm:text-right">
                                <p>Change {{ formatMoney(payment.changeGiven, sale.currencyCode) }}</p>
                                <p>{{ formatDateTime(payment.paidAt) }}</p>
                            </div>
                        </div>
                        <div v-if="payments.length === 0" class="px-3 py-4 text-sm text-slate-500">
                            No payment rows were recorded.
                        </div>
                    </div>
                </div>

                <div class="border border-slate-200">
                    <div class="border-b border-slate-200 px-3 py-2">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            Sale adjustments
                        </p>
                    </div>
                    <div class="divide-y divide-slate-100">
                        <div
                            v-for="adjustment in adjustments"
                            :key="adjustment.id"
                            class="px-3 py-3"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div>
                                    <p class="font-medium text-slate-950">
                                        {{ formatEnumLabel(adjustment.adjustmentType || 'adjustment') }}
                                    </p>
                                    <p class="mt-1 text-xs text-slate-500">
                                        {{ [adjustment.reasonCode ? formatEnumLabel(adjustment.reasonCode) : null, adjustment.adjustmentReference].filter(Boolean).join(' / ') || 'Operational correction' }}
                                    </p>
                                    <p v-if="adjustment.notes" class="mt-1 text-xs text-slate-500">
                                        {{ adjustment.notes }}
                                    </p>
                                </div>
                                <div class="text-right text-sm text-slate-700">
                                    <p>{{ formatMoney(adjustment.amount, sale.currencyCode) }}</p>
                                    <p>{{ formatDateTime(adjustment.processedAt) }}</p>
                                </div>
                            </div>
                        </div>
                        <div v-if="adjustments.length === 0" class="px-3 py-4 text-sm text-slate-500">
                            No void or refund adjustments were recorded on this sale.
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </DocumentShell>
</template>
