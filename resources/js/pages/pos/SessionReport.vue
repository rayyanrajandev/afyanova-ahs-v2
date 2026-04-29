<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import DocumentShell from '@/components/documents/DocumentShell.vue';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/lib/labels';
import type { SharedDocumentBranding } from '@/types';

type PosRegisterSessionDocument = {
    id: string;
    sessionNumber: string | null;
    status: string | null;
    openedAt: string | null;
    closedAt: string | null;
    openingCashAmount: string | number | null;
    closingCashAmount: string | number | null;
    expectedCashAmount: string | number | null;
    discrepancyAmount: string | number | null;
    grossSalesAmount: string | number | null;
    totalDiscountAmount: string | number | null;
    totalTaxAmount: string | number | null;
    cashNetSalesAmount: string | number | null;
    nonCashSalesAmount: string | number | null;
    saleCount: number | null;
    voidCount: number | null;
    refundCount: number | null;
    adjustmentAmount: string | number | null;
    cashAdjustmentAmount: string | number | null;
    nonCashAdjustmentAmount: string | number | null;
    openingNote: string | null;
    closingNote: string | null;
    register: { registerCode: string | null; registerName: string | null; location: string | null; defaultCurrencyCode?: string | null } | null;
    closeoutPreview: {
        expectedCashAmount: string | number | null;
        grossSalesAmount: string | number | null;
        totalDiscountAmount: string | number | null;
        totalTaxAmount: string | number | null;
        cashNetSalesAmount: string | number | null;
        nonCashSalesAmount: string | number | null;
        saleCount: number | null;
        voidCount: number | null;
        refundCount: number | null;
        adjustmentAmount: string | number | null;
        cashAdjustmentAmount: string | number | null;
        nonCashAdjustmentAmount: string | number | null;
    } | null;
};

type PosSaleSummary = {
    id: string;
    saleNumber: string | null;
    receiptNumber: string | null;
    saleChannel: string | null;
    customerName: string | null;
    customerType: string | null;
    status: string | null;
    totalAmount: string | number | null;
    paidAmount: string | number | null;
    changeAmount: string | number | null;
    soldAt: string | null;
};

type PosAdjustment = {
    id: string;
    adjustmentNumber: string | null;
    adjustmentType: string | null;
    amount: string | number | null;
    paymentMethod: string | null;
    adjustmentReference: string | null;
    reasonCode: string | null;
    notes: string | null;
    processedAt: string | null;
};

type BreakdownRow = {
    saleChannel?: string | null;
    paymentMethod?: string | null;
    saleCount?: number | null;
    paymentCount?: number | null;
    subtotalAmount?: string | number | null;
    discountAmount?: string | number | null;
    taxAmount?: string | number | null;
    totalAmount?: string | number | null;
    paidAmount?: string | number | null;
    changeAmount?: string | number | null;
    amountReceived?: string | number | null;
    amountApplied?: string | number | null;
    changeGiven?: string | number | null;
};

type PosUser = {
    name?: string | null;
    email?: string | null;
};

const props = defineProps<{
    session: PosRegisterSessionDocument;
    openedBy: PosUser | null;
    closedBy: PosUser | null;
    sales: PosSaleSummary[];
    adjustments: PosAdjustment[];
    channelBreakdown: BreakdownRow[];
    paymentBreakdown: BreakdownRow[];
    documentBranding: SharedDocumentBranding;
    generatedAt: string | null;
}>();

const currencyCode = computed(() => props.session.register?.defaultCurrencyCode || 'TZS');
const reportMetrics = computed(() => props.session.closeoutPreview ?? props.session);
const pageTitle = computed(() =>
    props.session.sessionNumber?.trim()
        ? `POS Session Report ${props.session.sessionNumber}`
        : 'POS Session Report',
);
const subtitle = computed(() =>
    [
        props.session.register?.registerName || null,
        props.session.register?.location || null,
        props.session.status ? formatEnumLabel(props.session.status) : null,
    ].filter(Boolean).join(' / ') || 'Cashier shift activity and reconciliation report',
);
const documentNumber = computed(() => props.session.sessionNumber?.trim() || props.session.id);
const statusLabel = computed(() => formatEnumLabel(props.session.status || 'open'));

const overviewRows = computed(() => [
    ['Register', props.session.register?.registerName || 'N/A'],
    ['Register code', props.session.register?.registerCode || 'N/A'],
    ['Location', props.session.register?.location || 'N/A'],
    ['Opened at', formatDateTime(props.session.openedAt)],
    ['Closed at', formatDateTime(props.session.closedAt)],
    ['Opened by', props.openedBy?.name || 'Not recorded'],
    ['Closed by', props.closedBy?.name || (props.session.closedAt ? 'Not recorded' : 'Session still open')],
]);

const totalsRows = computed(() => [
    ['Opening cash', formatMoney(props.session.openingCashAmount, currencyCode.value)],
    ['Expected cash', formatMoney(reportMetrics.value.expectedCashAmount, currencyCode.value)],
    ['Counted cash', formatMoney(props.session.closingCashAmount, currencyCode.value)],
    ['Variance', formatMoney(props.session.discrepancyAmount, currencyCode.value)],
    ['Gross sales', formatMoney(reportMetrics.value.grossSalesAmount, currencyCode.value)],
    ['Discount', formatMoney(reportMetrics.value.totalDiscountAmount, currencyCode.value)],
    ['Tax', formatMoney(reportMetrics.value.totalTaxAmount, currencyCode.value)],
    ['Cash sales', formatMoney(reportMetrics.value.cashNetSalesAmount, currencyCode.value)],
    ['Non-cash sales', formatMoney(reportMetrics.value.nonCashSalesAmount, currencyCode.value)],
    ['Adjustments', formatMoney(reportMetrics.value.adjustmentAmount, currencyCode.value)],
]);

const activityRows = computed(() => [
    ['Sales', String(reportMetrics.value.saleCount ?? 0)],
    ['Refunds', String(reportMetrics.value.refundCount ?? 0)],
    ['Voids', String(reportMetrics.value.voidCount ?? 0)],
    ['Captured sale rows', String(props.sales.length)],
    ['Adjustment rows', String(props.adjustments.length)],
]);

function amountToNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number.parseFloat(String(value ?? '0'));
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: string | number | null | undefined, code: string | null | undefined): string {
    const amount = amountToNumber(value);
    const currency = (code || 'TZS').trim().toUpperCase() || 'TZS';

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

function printDocument(): void {
    window.print();
}
</script>

<template>
    <Head :title="pageTitle" />

    <DocumentShell
        :document-branding="documentBranding"
        eyebrow="POS Session Report"
        title="Cashier Shift Report"
        :subtitle="subtitle"
        :document-number="documentNumber"
        :status-label="statusLabel"
        :generated-at-label="generatedAt ? formatDateTime(generatedAt) : null"
        @print="printDocument"
    >
        <template #actions>
            <Button variant="outline" class="gap-2 print:hidden" @click="printDocument">Print</Button>
            <Button as-child variant="outline" class="print:hidden">
                <a :href="`/pos/sessions/${session.id}/report.pdf`">Download PDF</a>
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <Link href="/pos">Back to POS</Link>
            </Button>
        </template>

        <div class="space-y-4">
            <section class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div class="border border-slate-200 p-3">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Session overview</p>
                    <dl class="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
                        <div v-for="[label, value] in overviewRows" :key="`overview-${label}`">
                            <dt class="text-xs uppercase tracking-[0.24em] text-slate-500">{{ label }}</dt>
                            <dd class="mt-1 font-medium text-slate-900">{{ value }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="border border-slate-200 p-3">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Activity snapshot</p>
                    <dl class="mt-3 space-y-2 text-sm">
                        <div v-for="[label, value] in activityRows" :key="`activity-${label}`" class="flex items-center justify-between gap-3">
                            <dt class="text-slate-500">{{ label }}</dt>
                            <dd class="font-medium text-slate-950">{{ value }}</dd>
                        </div>
                    </dl>
                </div>
            </section>

            <section class="border border-slate-200 p-3">
                <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Settlement totals</p>
                <dl class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5 text-sm">
                    <div v-for="[label, value] in totalsRows" :key="`total-${label}`">
                        <dt class="text-xs uppercase tracking-[0.24em] text-slate-500">{{ label }}</dt>
                        <dd class="mt-1 font-medium text-slate-900">{{ value }}</dd>
                    </div>
                </dl>
                <div v-if="session.openingNote || session.closingNote" class="mt-4 grid gap-3 md:grid-cols-2 text-sm">
                    <div v-if="session.openingNote" class="border border-slate-200 p-3">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Opening note</p>
                        <p class="mt-2 text-slate-700">{{ session.openingNote }}</p>
                    </div>
                    <div v-if="session.closingNote" class="border border-slate-200 p-3">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Closing note</p>
                        <p class="mt-2 text-slate-700">{{ session.closingNote }}</p>
                    </div>
                </div>
            </section>

            <section class="grid gap-3 lg:grid-cols-2">
                <div class="border border-slate-200 p-3">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Channel breakdown</p>
                    <div class="mt-3 overflow-x-auto">
                        <table class="min-w-full text-sm">
                            <thead class="text-left text-slate-500">
                                <tr>
                                    <th class="pb-2 pr-4">Channel</th>
                                    <th class="pb-2 pr-4">Sales</th>
                                    <th class="pb-2 pr-4">Total</th>
                                    <th class="pb-2">Paid</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in channelBreakdown" :key="row.saleChannel || 'unknown'" class="border-t border-slate-200">
                                    <td class="py-2 pr-4 font-medium text-slate-900">{{ formatEnumLabel(row.saleChannel || 'unknown') }}</td>
                                    <td class="py-2 pr-4">{{ row.saleCount ?? 0 }}</td>
                                    <td class="py-2 pr-4">{{ formatMoney(row.totalAmount, currencyCode) }}</td>
                                    <td class="py-2">{{ formatMoney(row.paidAmount, currencyCode) }}</td>
                                </tr>
                                <tr v-if="channelBreakdown.length === 0">
                                    <td colspan="4" class="py-3 text-slate-500">No sale rows were recorded for this session.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="border border-slate-200 p-3">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Payment method breakdown</p>
                    <div class="mt-3 overflow-x-auto">
                        <table class="min-w-full text-sm">
                            <thead class="text-left text-slate-500">
                                <tr>
                                    <th class="pb-2 pr-4">Method</th>
                                    <th class="pb-2 pr-4">Entries</th>
                                    <th class="pb-2 pr-4">Received</th>
                                    <th class="pb-2">Applied</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in paymentBreakdown" :key="row.paymentMethod || 'unknown'" class="border-t border-slate-200">
                                    <td class="py-2 pr-4 font-medium text-slate-900">{{ formatEnumLabel(row.paymentMethod || 'unknown') }}</td>
                                    <td class="py-2 pr-4">{{ row.paymentCount ?? 0 }}</td>
                                    <td class="py-2 pr-4">{{ formatMoney(row.amountReceived, currencyCode) }}</td>
                                    <td class="py-2">{{ formatMoney(row.amountApplied, currencyCode) }}</td>
                                </tr>
                                <tr v-if="paymentBreakdown.length === 0">
                                    <td colspan="4" class="py-3 text-slate-500">No payment rows were recorded for this session.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section class="border border-slate-200 p-3">
                <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Sales ledger</p>
                <div class="mt-3 overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead class="text-left text-slate-500">
                            <tr>
                                <th class="pb-2 pr-4">Sale</th>
                                <th class="pb-2 pr-4">Channel</th>
                                <th class="pb-2 pr-4">Customer</th>
                                <th class="pb-2 pr-4">Status</th>
                                <th class="pb-2 pr-4">Total</th>
                                <th class="pb-2">Sold at</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="sale in sales" :key="sale.id" class="border-t border-slate-200 align-top">
                                <td class="py-2 pr-4">
                                    <div class="font-medium text-slate-900">{{ sale.receiptNumber || sale.saleNumber || 'Sale row' }}</div>
                                    <div class="text-xs text-slate-500">{{ sale.saleNumber || 'No sale number' }}</div>
                                </td>
                                <td class="py-2 pr-4">{{ formatEnumLabel(sale.saleChannel || 'unknown') }}</td>
                                <td class="py-2 pr-4">{{ sale.customerName || formatEnumLabel(sale.customerType || 'anonymous') }}</td>
                                <td class="py-2 pr-4">{{ formatEnumLabel(sale.status || 'completed') }}</td>
                                <td class="py-2 pr-4">{{ formatMoney(sale.totalAmount, currencyCode) }}</td>
                                <td class="py-2">{{ formatDateTime(sale.soldAt) }}</td>
                            </tr>
                            <tr v-if="sales.length === 0">
                                <td colspan="6" class="py-3 text-slate-500">No sales were recorded in this session.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="border border-slate-200 p-3">
                <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Adjustments</p>
                <div class="mt-3 overflow-x-auto">
                    <table class="min-w-full text-sm">
                        <thead class="text-left text-slate-500">
                            <tr>
                                <th class="pb-2 pr-4">Type</th>
                                <th class="pb-2 pr-4">Reason</th>
                                <th class="pb-2 pr-4">Amount</th>
                                <th class="pb-2 pr-4">Method</th>
                                <th class="pb-2">Processed at</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="adjustment in adjustments" :key="adjustment.id" class="border-t border-slate-200">
                                <td class="py-2 pr-4 font-medium text-slate-900">{{ formatEnumLabel(adjustment.adjustmentType || 'unknown') }}</td>
                                <td class="py-2 pr-4">{{ [adjustment.reasonCode ? formatEnumLabel(adjustment.reasonCode) : null, adjustment.adjustmentReference, adjustment.notes].filter(Boolean).join(' / ') || 'Operational correction' }}</td>
                                <td class="py-2 pr-4">{{ formatMoney(adjustment.amount, currencyCode) }}</td>
                                <td class="py-2 pr-4">{{ formatEnumLabel(adjustment.paymentMethod || 'n/a') }}</td>
                                <td class="py-2">{{ formatDateTime(adjustment.processedAt) }}</td>
                            </tr>
                            <tr v-if="adjustments.length === 0">
                                <td colspan="5" class="py-3 text-slate-500">No session adjustments were recorded.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </DocumentShell>
</template>
