<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import DocumentShell from '@/components/documents/DocumentShell.vue';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/lib/labels';
import type { SharedDocumentBranding } from '@/types';

type TransferActor = {
    name?: string | null;
    email?: string | null;
} | null;

type TransferLine = {
    id: string;
    itemName?: string | null;
    itemCode?: string | null;
    batchNumber?: string | null;
    requested_quantity?: string | number | null;
    packedQuantity?: string | number | null;
    reservedQuantity?: string | number | null;
    dispatched_quantity?: string | number | null;
    received_quantity?: string | number | null;
    unit?: string | null;
    notes?: string | null;
};

type WarehouseTransferDocument = {
    id: string;
    transfer_number: string | null;
    dispatchNoteNumber?: string | null;
    dispatch_note_number?: string | null;
    routeLabel?: string | null;
    sourceWarehouseName?: string | null;
    destinationWarehouseName?: string | null;
    status?: string | null;
    priority?: string | null;
    reason?: string | null;
    notes?: string | null;
    packNotes?: string | null;
    pack_notes?: string | null;
    receiving_notes?: string | null;
    approved_at?: string | null;
    packed_at?: string | null;
    dispatched_at?: string | null;
    received_at?: string | null;
    reservationSummary?: {
        activeQuantity?: string | number | null;
        state?: string | null;
    } | null;
    pickingSummary?: {
        requestedQuantity?: string | number | null;
        packedQuantity?: string | number | null;
        dispatchedQuantity?: string | number | null;
        receivedQuantity?: string | number | null;
    } | null;
    lines?: TransferLine[] | null;
};

const props = defineProps<{
    documentType: 'pick_slip' | 'dispatch_note';
    transfer: WarehouseTransferDocument;
    requestedBy: TransferActor;
    approvedBy: TransferActor;
    packedBy: TransferActor;
    dispatchedBy: TransferActor;
    receivedBy: TransferActor;
    documentBranding: SharedDocumentBranding;
    generatedAt: string | null;
}>();

const isPickSlip = computed(() => props.documentType === 'pick_slip');

const pageTitle = computed(() =>
    isPickSlip.value
        ? `Pick Slip ${props.transfer.transfer_number || ''}`.trim()
        : `Dispatch Note ${(props.transfer.dispatchNoteNumber || props.transfer.dispatch_note_number || props.transfer.transfer_number || '').trim()}`.trim(),
);

const subtitle = computed(() =>
    props.transfer.routeLabel
    || [props.transfer.sourceWarehouseName, props.transfer.destinationWarehouseName].filter(Boolean).join(' / ')
    || 'Warehouse execution document',
);

const documentNumber = computed(() =>
    isPickSlip.value
        ? props.transfer.transfer_number || 'Pending transfer'
        : props.transfer.dispatchNoteNumber || props.transfer.dispatch_note_number || props.transfer.transfer_number || 'Pending dispatch note',
);

const statusLabel = computed(() => formatEnumLabel(props.transfer.status || 'draft'));

const lines = computed(() => props.transfer.lines ?? []);

const overviewRows = computed(() => [
    ['Priority', formatEnumLabel(props.transfer.priority || 'normal')],
    ['Hold state', formatEnumLabel(props.transfer.reservationSummary?.state || 'none')],
    ['Requested quantity', formatQuantity(props.transfer.pickingSummary?.requestedQuantity)],
    ['Packed quantity', formatQuantity(props.transfer.pickingSummary?.packedQuantity)],
    ['Dispatched quantity', formatQuantity(props.transfer.pickingSummary?.dispatchedQuantity)],
    ['Received quantity', formatQuantity(props.transfer.pickingSummary?.receivedQuantity)],
]);

const controlRows = computed(() => [
    ['Requested by', actorName(props.requestedBy)],
    ['Approved by', actorName(props.approvedBy)],
    ['Packed by', actorName(props.packedBy)],
    ['Dispatched by', actorName(props.dispatchedBy)],
    ['Received by', actorName(props.receivedBy)],
]);

const timelineRows = computed(() => [
    ['Approved at', formatDateTime(props.transfer.approved_at)],
    ['Packed at', formatDateTime(props.transfer.packed_at)],
    ['Dispatched at', formatDateTime(props.transfer.dispatched_at)],
    ['Received at', formatDateTime(props.transfer.received_at)],
]);

function actorName(actor: TransferActor): string {
    return actor?.name?.trim() || 'Not recorded';
}

function amountToNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    const parsed = Number.parseFloat(String(value ?? '0'));

    return Number.isFinite(parsed) ? parsed : 0;
}

function formatQuantity(value: string | number | null | undefined): string {
    return amountToNumber(value).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not recorded';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not recorded';

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
        :eyebrow="isPickSlip ? 'Warehouse Pick Slip' : 'Warehouse Dispatch Note'"
        :title="isPickSlip ? 'Pick Slip' : 'Dispatch Note'"
        :subtitle="subtitle"
        :document-number="documentNumber"
        :status-label="statusLabel"
        :generated-at-label="generatedAt ? formatDateTime(generatedAt) : null"
        @print="printDocument"
    >
        <template #actions>
            <Button variant="outline" class="gap-2 print:hidden" @click="printDocument">
                <AppIcon name="printer" class="size-3.5" />
                Print
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <a :href="isPickSlip ? `/inventory-procurement/warehouse-transfers/${transfer.id}/pick-slip.pdf` : `/inventory-procurement/warehouse-transfers/${transfer.id}/dispatch-note.pdf`">
                    Download PDF
                </a>
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <Link href="/inventory-procurement">Back to Inventory</Link>
            </Button>
        </template>

        <div class="space-y-4">
            <section class="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_320px]">
                <div class="border border-slate-200 p-3">
                    <div class="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                                Transfer summary
                            </p>
                            <p class="mt-1.5 text-base font-semibold text-slate-950">
                                {{ transfer.routeLabel || 'Warehouse route' }}
                            </p>
                            <p v-if="transfer.reason" class="mt-1 text-sm text-slate-600">
                                {{ transfer.reason }}
                            </p>
                        </div>
                        <div class="text-sm sm:text-right">
                            <p class="font-semibold text-slate-950">
                                {{ statusLabel }}
                            </p>
                            <p class="mt-1 text-slate-600">
                                {{ formatEnumLabel(transfer.priority || 'normal') }} priority
                            </p>
                        </div>
                    </div>

                    <dl class="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-slate-600">
                        <div
                            v-for="[label, value] in overviewRows"
                            :key="`transfer-overview-${label}`"
                            class="flex items-start justify-between gap-3 border border-slate-200 px-2.5 py-2"
                        >
                            <dt>{{ label }}</dt>
                            <dd class="text-right font-medium text-slate-900">
                                {{ value }}
                            </dd>
                        </div>
                    </dl>

                    <div v-if="transfer.notes || transfer.packNotes || transfer.pack_notes || transfer.receiving_notes" class="mt-4 grid gap-3 border-t border-slate-200 pt-3 text-sm text-slate-700">
                        <div v-if="transfer.notes">
                            <p class="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Transfer note</p>
                            <p class="mt-1 leading-6">{{ transfer.notes }}</p>
                        </div>
                        <div v-if="transfer.packNotes || transfer.pack_notes">
                            <p class="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Pack note</p>
                            <p class="mt-1 leading-6">{{ transfer.packNotes || transfer.pack_notes }}</p>
                        </div>
                        <div v-if="transfer.receiving_notes">
                            <p class="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Receiving note</p>
                            <p class="mt-1 leading-6">{{ transfer.receiving_notes }}</p>
                        </div>
                    </div>
                </div>

                <aside class="grid gap-3">
                    <div class="border border-slate-200 p-3">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            Workflow owners
                        </p>
                        <dl class="mt-3 space-y-2 text-sm">
                            <div
                                v-for="[label, value] in controlRows"
                                :key="`transfer-control-${label}`"
                                class="flex items-center justify-between gap-3"
                            >
                                <dt class="text-slate-600">{{ label }}</dt>
                                <dd class="text-right font-medium text-slate-950">{{ value }}</dd>
                            </div>
                        </dl>
                    </div>

                    <div class="border border-slate-200 p-3">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            Timeline
                        </p>
                        <dl class="mt-3 space-y-2 text-sm">
                            <div
                                v-for="[label, value] in timelineRows"
                                :key="`transfer-time-${label}`"
                                class="flex items-center justify-between gap-3"
                            >
                                <dt class="text-slate-600">{{ label }}</dt>
                                <dd class="text-right font-medium text-slate-950">{{ value }}</dd>
                            </div>
                        </dl>
                    </div>
                </aside>
            </section>

            <section class="overflow-hidden border border-slate-200">
                <div class="border-b border-slate-200 px-3 py-2.5 sm:px-4">
                    <h2 class="text-sm font-semibold text-slate-950">
                        {{ isPickSlip ? 'Pick lines' : 'Dispatch lines' }}
                    </h2>
                    <p class="mt-1 text-xs text-slate-500">
                        {{ lines.length }} line item{{ lines.length === 1 ? '' : 's' }} on this transfer.
                    </p>
                </div>

                <div v-if="lines.length === 0" class="px-3 py-5 text-sm text-slate-500 sm:px-4">
                    No transfer lines were recorded.
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-slate-200 text-sm">
                        <thead class="bg-white text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                            <tr>
                                <th class="px-3 py-2.5 sm:px-4">Item</th>
                                <th class="px-3 py-2.5 sm:px-4">Batch</th>
                                <th class="px-3 py-2.5 text-right sm:px-4">Requested</th>
                                <th v-if="isPickSlip" class="px-3 py-2.5 text-right sm:px-4">Held</th>
                                <th class="px-3 py-2.5 text-right sm:px-4">{{ isPickSlip ? 'Packed' : 'Dispatched' }}</th>
                                <th v-if="!isPickSlip" class="px-3 py-2.5 text-right sm:px-4">Received</th>
                                <th class="px-3 py-2.5 sm:px-4">Unit</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            <tr v-for="line in lines" :key="line.id">
                                <td class="px-3 py-2.5 align-top sm:px-4">
                                    <p class="font-medium text-slate-950">
                                        {{ line.itemName || 'Transfer item' }}
                                    </p>
                                    <p v-if="line.itemCode" class="mt-1 text-xs text-slate-500">
                                        {{ line.itemCode }}
                                    </p>
                                    <p v-if="line.notes" class="mt-1 text-xs text-slate-500">
                                        {{ line.notes }}
                                    </p>
                                </td>
                                <td class="px-3 py-2.5 align-top text-slate-700 sm:px-4">
                                    {{ line.batchNumber || 'Untracked' }}
                                </td>
                                <td class="px-3 py-2.5 text-right align-top text-slate-700 sm:px-4">
                                    {{ formatQuantity(line.requested_quantity) }}
                                </td>
                                <td v-if="isPickSlip" class="px-3 py-2.5 text-right align-top text-slate-700 sm:px-4">
                                    {{ formatQuantity(line.reservedQuantity) }}
                                </td>
                                <td class="px-3 py-2.5 text-right align-top font-medium text-slate-950 sm:px-4">
                                    {{ formatQuantity(isPickSlip ? line.packedQuantity : line.dispatched_quantity) }}
                                </td>
                                <td v-if="!isPickSlip" class="px-3 py-2.5 text-right align-top text-slate-700 sm:px-4">
                                    {{ formatQuantity(line.received_quantity) }}
                                </td>
                                <td class="px-3 py-2.5 align-top text-slate-700 sm:px-4">
                                    {{ line.unit || 'units' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="grid gap-3 md:grid-cols-3">
                <div class="border border-dashed border-slate-300 px-3 py-6">
                    <p class="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                        {{ isPickSlip ? 'Picked by' : 'Prepared by' }}
                    </p>
                    <p class="mt-10 text-sm text-slate-500">Name / signature</p>
                </div>
                <div class="border border-dashed border-slate-300 px-3 py-6">
                    <p class="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                        {{ isPickSlip ? 'Checked by' : 'Dispatched by' }}
                    </p>
                    <p class="mt-10 text-sm text-slate-500">Name / signature</p>
                </div>
                <div class="border border-dashed border-slate-300 px-3 py-6">
                    <p class="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                        {{ isPickSlip ? 'Released to pack' : 'Received by destination' }}
                    </p>
                    <p class="mt-10 text-sm text-slate-500">Name / signature</p>
                </div>
            </section>
        </div>
    </DocumentShell>
</template>
