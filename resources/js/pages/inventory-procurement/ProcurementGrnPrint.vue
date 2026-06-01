<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import DocumentShell from '@/components/documents/DocumentShell.vue';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/lib/labels';
import { INVENTORY_PROCUREMENT_HOME_PATH, procurementGrnPdfHref } from '@/lib/inventoryProcurement';
import type { SharedDocumentBranding } from '@/types';

type DocumentActor = {
    name?: string | null;
    email?: string | null;
} | null;

type ProcurementRequestDocument = {
    id: string;
    requestNumber?: string | null;
    purchaseOrderNumber?: string | null;
    itemCode?: string | null;
    itemName?: string | null;
    itemCategory?: string | null;
    itemUnit?: string | null;
    requestedQuantity?: string | number | null;
    orderedQuantity?: string | number | null;
    receivedQuantity?: string | number | null;
    unitCostEstimate?: string | number | null;
    receivedUnitCost?: string | number | null;
    totalCostEstimate?: string | number | null;
    supplierName?: string | null;
    status?: string | null;
    neededBy?: string | null;
    approvedAt?: string | null;
    orderedAt?: string | null;
    receivedAt?: string | null;
    receivingNotes?: string | null;
    notes?: string | null;
};

const props = defineProps<{
    request: ProcurementRequestDocument;
    receivingWarehouseName?: string | null;
    requestedBy: DocumentActor;
    approvedBy: DocumentActor;
    receivedBy: DocumentActor;
    documentBranding: SharedDocumentBranding;
    generatedAt: string | null;
}>();

const pageTitle = computed(() => `GRN ${props.request.requestNumber ?? props.request.purchaseOrderNumber ?? ''}`.trim());

const documentNumber = computed(
    () => props.request.requestNumber ?? props.request.purchaseOrderNumber ?? 'Procurement receipt',
);

const subtitle = computed(() => {
    const parts = [props.request.itemName, props.request.supplierName].filter(Boolean);

    return parts.length > 0 ? parts.join(' · ') : 'Goods received into store';
});

const lineTotal = computed(() => {
    const qty = amountToNumber(props.request.receivedQuantity);
    const unit = amountToNumber(props.request.receivedUnitCost ?? props.request.unitCostEstimate);

    if (qty <= 0 || unit <= 0) {
        return null;
    }

    return qty * unit;
});

const overviewRows = computed(() => [
    ['Item code', props.request.itemCode ?? '—'],
    ['Category', formatEnumLabel(String(props.request.itemCategory ?? '—'))],
    ['Supplier', props.request.supplierName ?? '—'],
    ['Store location', props.receivingWarehouseName ?? '—'],
    ['Ordered quantity', formatQuantity(props.request.orderedQuantity ?? props.request.requestedQuantity)],
    ['Received quantity', formatQuantity(props.request.receivedQuantity)],
    ['Unit cost', formatMoney(props.request.receivedUnitCost ?? props.request.unitCostEstimate)],
    ['Line total', lineTotal.value != null ? formatMoney(lineTotal.value) : '—'],
]);

const workflowRows = computed(() => [
    ['Requested by', actorName(props.requestedBy)],
    ['Approved by', actorName(props.approvedBy)],
    ['Received by', actorName(props.receivedBy)],
]);

const timelineRows = computed(() => [
    ['Needed by', formatDate(props.request.neededBy)],
    ['Approved at', formatDateTime(props.request.approvedAt)],
    ['Ordered at', formatDateTime(props.request.orderedAt)],
    ['Received at', formatDateTime(props.request.receivedAt)],
]);

function actorName(actor: DocumentActor): string {
    return actor?.name?.trim() || 'Not recorded';
}

function amountToNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    const parsed = Number.parseFloat(String(value ?? '0'));

    return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantity(value: string | number | null | undefined): string {
    const unit = props.request.itemUnit?.trim() || 'units';

    return `${amountToNumber(value).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    })} ${unit}`;
}

function formatMoney(value: string | number | null | undefined): string {
    const amount = amountToNumber(value);
    if (amount <= 0) {
        return '—';
    }

    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string | null | undefined): string {
    if (!value) {
        return 'Not recorded';
    }

    const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(date.getTime())) {
        return 'Not recorded';
    }

    return new Intl.DateTimeFormat('en-TZ', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) {
        return 'Not recorded';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Not recorded';
    }

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
        eyebrow="Goods Received Note"
        title="Goods Received Note"
        :subtitle="subtitle"
        :document-number="documentNumber"
        status-label="Received"
        :generated-at-label="generatedAt ? formatDateTime(generatedAt) : null"
        @print="printDocument"
    >
        <template #actions>
            <Button variant="outline" class="gap-2 print:hidden" @click="printDocument">
                <AppIcon name="printer" class="size-3.5" />
                Print
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <a :href="procurementGrnPdfHref(request.id)">Download PDF</a>
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <Link :href="INVENTORY_PROCUREMENT_HOME_PATH">Supply chain home</Link>
            </Button>
        </template>

        <div class="space-y-4">
            <section class="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_320px]">
                <div class="border border-slate-200 p-3">
                    <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Receipt summary</p>
                    <p class="mt-1.5 text-base font-semibold text-slate-950">{{ request.itemName ?? 'Store item' }}</p>
                    <p v-if="request.purchaseOrderNumber" class="mt-1 text-sm text-slate-600">
                        PO {{ request.purchaseOrderNumber }}
                    </p>
                    <table class="mt-3 w-full text-sm">
                        <tbody>
                            <tr
                                v-for="[label, value] in overviewRows"
                                :key="label"
                                class="border-t border-slate-100 first:border-t-0"
                            >
                                <td class="py-1.5 pr-3 text-slate-500">{{ label }}</td>
                                <td class="py-1.5 font-medium text-slate-900">{{ value }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="space-y-3">
                    <div class="border border-slate-200 p-3">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Workflow</p>
                        <table class="mt-2 w-full text-sm">
                            <tbody>
                                <tr v-for="[label, value] in workflowRows" :key="label" class="border-t border-slate-100 first:border-t-0">
                                    <td class="py-1.5 pr-3 text-slate-500">{{ label }}</td>
                                    <td class="py-1.5 text-slate-900">{{ value }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="border border-slate-200 p-3">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Timeline</p>
                        <table class="mt-2 w-full text-sm">
                            <tbody>
                                <tr v-for="[label, value] in timelineRows" :key="label" class="border-t border-slate-100 first:border-t-0">
                                    <td class="py-1.5 pr-3 text-slate-500">{{ label }}</td>
                                    <td class="py-1.5 text-slate-900">{{ value }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section v-if="request.receivingNotes || request.notes" class="border border-slate-200 p-3 text-sm text-slate-700">
                <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Notes</p>
                <p v-if="request.receivingNotes" class="mt-2 whitespace-pre-wrap">{{ request.receivingNotes }}</p>
                <p v-if="request.notes" class="mt-2 whitespace-pre-wrap text-slate-600">{{ request.notes }}</p>
            </section>

            <p class="text-xs text-slate-500 print:text-[10px]">
                This note confirms goods were received into facility store stock. Retain with supplier delivery documentation.
            </p>
        </div>
    </DocumentShell>
</template>
