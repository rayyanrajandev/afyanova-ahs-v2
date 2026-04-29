<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import DocumentShell from '@/components/documents/DocumentShell.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatEnumLabel } from '@/lib/labels';
import type { SharedDocumentBranding } from '@/types';

type ClaimsInsuranceDocument = {
    id: string;
    claimNumber: string | null;
    invoiceId: string | null;
    patientId: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    payerType: string | null;
    payerName: string | null;
    payerReference: string | null;
    claimAmount: string | number | null;
    currencyCode: string | null;
    submittedAt: string | null;
    adjudicatedAt: string | null;
    approvedAmount: string | number | null;
    rejectedAmount: string | number | null;
    settledAmount: string | number | null;
    reconciliationShortfallAmount: string | number | null;
    settledAt: string | null;
    settlementReference: string | null;
    decisionReason: string | null;
    notes: string | null;
    status: string | null;
    reconciliationStatus: string | null;
    reconciliationExceptionStatus: string | null;
    reconciliationFollowUpStatus: string | null;
    reconciliationFollowUpDueAt: string | null;
    reconciliationFollowUpNote: string | null;
    reconciliationFollowUpUpdatedAt: string | null;
    reconciliationNotes: string | null;
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type ClaimPerson = {
    patientNumber?: string | null;
    fullName?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    phone?: string | null;
    email?: string | null;
};

type ClaimAppointment = {
    appointmentNumber?: string | null;
    department?: string | null;
    scheduledAt?: string | null;
    reason?: string | null;
    status?: string | null;
};

type ClaimAdmission = {
    admissionNumber?: string | null;
    ward?: string | null;
    bed?: string | null;
    admittedAt?: string | null;
    status?: string | null;
};

type ClaimInvoice = {
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
    currencyCode?: string | null;
    totalAmount?: string | number | null;
    paidAmount?: string | number | null;
    balanceAmount?: string | number | null;
    paymentDueAt?: string | null;
    lastPaymentAt?: string | null;
    lastPaymentReference?: string | null;
    pricingMode?: string | null;
    status?: string | null;
    statusReason?: string | null;
    lineItemCount?: number | null;
};

type ClaimFollowUpOwner = {
    name?: string | null;
    email?: string | null;
};

const props = defineProps<{
    claim: ClaimsInsuranceDocument;
    invoice: ClaimInvoice | null;
    patient: ClaimPerson | null;
    appointment: ClaimAppointment | null;
    admission: ClaimAdmission | null;
    followUpOwner: ClaimFollowUpOwner | null;
    documentBranding: SharedDocumentBranding;
    generatedAt: string | null;
}>();

const pageTitle = computed(() =>
    props.claim.claimNumber?.trim()
        ? `Claim Dossier ${props.claim.claimNumber}`
        : 'Claim Dossier',
);

const statusLabel = computed(() => {
    const labels = [
        props.claim.status ? formatEnumLabel(props.claim.status) : null,
        props.claim.reconciliationStatus ? formatEnumLabel(props.claim.reconciliationStatus) : null,
    ].filter((value): value is string => Boolean(value));

    return labels.length > 0 ? labels.join(' / ') : 'Draft';
});

const subtitle = computed(() => {
    const parts: string[] = [];

    if (props.claim.payerName) {
        parts.push(props.claim.payerName);
    } else if (props.claim.payerType) {
        parts.push(formatEnumLabel(props.claim.payerType));
    }

    if (props.invoice?.invoiceNumber) {
        parts.push(`Invoice ${props.invoice.invoiceNumber}`);
    }

    if (props.patient?.patientNumber) {
        parts.push(`Patient ${props.patient.patientNumber}`);
    }

    return parts.length > 0
        ? parts.join(' | ')
        : 'Claim lifecycle, adjudication, settlement, and recovery context';
});

const patientRows = computed(() => [
    ['Patient No.', props.patient?.patientNumber || 'N/A'],
    ['Gender', props.patient?.gender ? formatEnumLabel(props.patient.gender) : 'N/A'],
    ['Date of Birth', formatDate(props.patient?.dateOfBirth || null)],
    ['Phone', props.patient?.phone || 'N/A'],
    ['Email', props.patient?.email || 'N/A'],
]);

const claimRows = computed(() => [
    ['Invoice Link', props.invoice?.invoiceNumber || props.claim.invoiceId || 'N/A'],
    ['Payer Type', props.claim.payerType ? formatEnumLabel(props.claim.payerType) : 'N/A'],
    ['Payer Ref.', props.claim.payerReference || 'N/A'],
    ['Submitted', formatDateTime(props.claim.submittedAt)],
    ['Adjudicated', formatDateTime(props.claim.adjudicatedAt)],
    ['Settled', formatDateTime(props.claim.settledAt)],
]);

const encounterRows = computed(() => [
    ['Appointment', props.appointment?.appointmentNumber || 'No linked appointment'],
    ['Department', props.appointment?.department || 'N/A'],
    ['Appointment Time', formatDateTime(props.appointment?.scheduledAt || null)],
    ['Admission', props.admission?.admissionNumber || 'No linked admission'],
    ['Ward / Bed', props.admission ? `${props.admission.ward || 'N/A'} / ${props.admission.bed || 'N/A'}` : 'N/A'],
    ['Admitted At', formatDateTime(props.admission?.admittedAt || null)],
]);

const invoiceRows = computed(() => [
    ['Invoice Status', props.invoice?.status ? formatEnumLabel(props.invoice.status) : 'N/A'],
    ['Pricing Mode', props.invoice?.pricingMode ? formatEnumLabel(props.invoice.pricingMode) : 'N/A'],
    ['Line Items', String(props.invoice?.lineItemCount ?? 0)],
    ['Payment Due', formatDate(props.invoice?.paymentDueAt || null)],
    ['Last Payment', formatDateTime(props.invoice?.lastPaymentAt || null)],
    ['Payment Ref.', props.invoice?.lastPaymentReference || 'N/A'],
]);

const financialCards = computed(() => [
    {
        id: 'claim',
        label: 'Claimed',
        value: formatMoney(props.claim.claimAmount, props.claim.currencyCode),
        helper: 'Amount captured from the linked invoice at claim creation.',
    },
    {
        id: 'approved',
        label: 'Approved',
        value: formatMoney(props.claim.approvedAmount, props.claim.currencyCode),
        helper: 'Adjudicated value accepted by the payer.',
    },
    {
        id: 'rejected',
        label: 'Rejected',
        value: formatMoney(props.claim.rejectedAmount, props.claim.currencyCode),
        helper: 'Value denied during adjudication or partial approval.',
    },
    {
        id: 'settled',
        label: 'Settled',
        value: formatMoney(props.claim.settledAmount, props.claim.currencyCode),
        helper: 'Cash recovery already reconciled into the claim.',
    },
    {
        id: 'shortfall',
        label: 'Shortfall',
        value: formatMoney(props.claim.reconciliationShortfallAmount, props.claim.currencyCode),
        helper: 'Outstanding recovery gap after reconciliation.',
    },
    {
        id: 'invoice-balance',
        label: 'Invoice Balance',
        value: formatMoney(props.invoice?.balanceAmount, props.invoice?.currencyCode || props.claim.currencyCode),
        helper: 'Balance still visible on the billing invoice.',
    },
]);

const noteCards = computed(() => [
    {
        id: 'decision',
        title: 'Decision rationale',
        body: props.claim.decisionReason || props.claim.statusReason || 'No decision rationale recorded.',
    },
    {
        id: 'reconciliation',
        title: 'Reconciliation notes',
        body: props.claim.reconciliationNotes || 'No reconciliation notes recorded.',
    },
    {
        id: 'follow-up',
        title: 'Follow-up note',
        body: props.claim.reconciliationFollowUpNote || 'No follow-up note recorded.',
    },
    {
        id: 'general',
        title: 'General notes',
        body: props.claim.notes || props.invoice?.statusReason || 'No general operational notes recorded.',
    },
]);

const timelineItems = computed(() => [
    {
        id: 'created',
        title: 'Claim created',
        at: props.claim.createdAt,
        description: 'Case was opened from billing context and queued for review.',
    },
    {
        id: 'submitted',
        title: 'Submitted to payer',
        at: props.claim.submittedAt,
        description: 'Submission moved the claim into payer-facing processing.',
    },
    {
        id: 'adjudicated',
        title: 'Payer decision recorded',
        at: props.claim.adjudicatedAt,
        description: 'Approval, denial, or partial decision was captured.',
    },
    {
        id: 'settled',
        title: 'Settlement reconciled',
        at: props.claim.settledAt,
        description: 'Recovered value was posted against the claim settlement workflow.',
    },
    {
        id: 'follow-up',
        title: 'Follow-up checkpoint',
        at: props.claim.reconciliationFollowUpDueAt,
        description: props.claim.reconciliationExceptionStatus === 'open'
            ? 'Recovery exception remains active and needs follow-up.'
            : 'No open exception currently blocks the claim.',
    },
]);

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

function printDocument() {
    window.print();
}
</script>

<template>
    <Head :title="pageTitle" />

    <DocumentShell
        :document-branding="documentBranding"
        eyebrow="Claims & Insurance"
        title="Claim Dossier"
        :subtitle="subtitle"
        :document-number="claim.claimNumber || claim.id"
        :status-label="statusLabel"
        :generated-at-label="generatedAt ? formatDateTime(generatedAt) : null"
        @print="printDocument"
    >
        <template #actions>
            <Button variant="outline" class="gap-2 print:hidden" @click="printDocument">
                Print dossier
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <a :href="`/claims-insurance/${claim.id}/pdf`">Download dossier PDF</a>
            </Button>
            <Button as-child variant="outline" class="print:hidden">
                <Link href="/claims-insurance">Back to Claims Workspace</Link>
            </Button>
        </template>

        <div class="space-y-6">
            <section class="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div class="grid gap-4 sm:grid-cols-2">
                    <div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            Patient
                        </p>
                        <p class="mt-2 text-lg font-semibold text-slate-950">
                            {{ patient?.fullName || 'Unknown patient' }}
                        </p>
                        <dl class="mt-3 space-y-2 text-sm text-slate-600">
                            <div
                                v-for="[label, value] in patientRows"
                                :key="`patient-row-${label}`"
                                class="flex items-start justify-between gap-3"
                            >
                                <dt>{{ label }}</dt>
                                <dd class="text-right font-medium text-slate-900">
                                    {{ value }}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div class="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                                    Billing & Payer Handoff
                                </p>
                                <p class="mt-2 text-lg font-semibold text-slate-950">
                                    {{ claim.payerName || 'Unassigned payer' }}
                                </p>
                            </div>
                            <Badge variant="outline">
                                {{ claim.payerType ? formatEnumLabel(claim.payerType) : 'N/A' }}
                            </Badge>
                        </div>
                        <dl class="mt-3 space-y-2 text-sm text-slate-600">
                            <div
                                v-for="[label, value] in claimRows"
                                :key="`claim-row-${label}`"
                                class="flex items-start justify-between gap-3"
                            >
                                <dt>{{ label }}</dt>
                                <dd class="text-right font-medium text-slate-900">
                                    {{ value }}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <div class="rounded-[28px] border border-emerald-950 bg-[linear-gradient(145deg,#022c22_0%,#0f172a_100%)] p-5 text-white">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="text-xs font-medium uppercase tracking-[0.28em] text-emerald-100/80">
                                Settlement Snapshot
                            </p>
                            <p class="mt-2 text-lg font-semibold">
                                {{ statusLabel }}
                            </p>
                            <p class="mt-2 text-sm text-emerald-50/80">
                                {{ claim.reconciliationExceptionStatus === 'open' ? 'Recovery exception open' : 'No open recovery exception' }}
                            </p>
                        </div>
                        <Badge variant="secondary" class="border-white/20 bg-white/10 text-white">
                            {{ claim.claimNumber || 'Draft claim' }}
                        </Badge>
                    </div>

                    <div class="mt-5 grid gap-3 sm:grid-cols-3">
                        <div class="rounded-lg border border-white/10 bg-white/5 p-3">
                            <p class="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Claimed</p>
                            <p class="mt-2 text-lg font-semibold">
                                {{ formatMoney(claim.claimAmount, claim.currencyCode) }}
                            </p>
                        </div>
                        <div class="rounded-lg border border-white/10 bg-white/5 p-3">
                            <p class="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Approved</p>
                            <p class="mt-2 text-lg font-semibold">
                                {{ formatMoney(claim.approvedAmount, claim.currencyCode) }}
                            </p>
                        </div>
                        <div class="rounded-lg border border-white/10 bg-white/5 p-3">
                            <p class="text-xs uppercase tracking-[0.2em] text-emerald-100/70">Settled</p>
                            <p class="mt-2 text-lg font-semibold">
                                {{ formatMoney(claim.settledAmount, claim.currencyCode) }}
                            </p>
                            <p class="mt-1 text-xs text-emerald-50/70">
                                {{ claim.settlementReference ? `Ref ${claim.settlementReference}` : 'No settlement reference recorded' }}
                            </p>
                        </div>
                    </div>

                    <div class="mt-5 grid gap-3 border-t border-white/10 pt-4 text-sm text-emerald-50/85 sm:grid-cols-2">
                        <div>
                            <p class="text-xs uppercase tracking-[0.2em] text-emerald-100/60">Follow-up</p>
                            <p class="mt-1 font-medium text-white">
                                {{ claim.reconciliationFollowUpStatus ? formatEnumLabel(claim.reconciliationFollowUpStatus) : 'N/A' }}
                            </p>
                            <p class="mt-1 text-xs text-emerald-50/70">
                                {{ claim.reconciliationFollowUpDueAt ? `Due ${formatDateTime(claim.reconciliationFollowUpDueAt)}` : 'No follow-up due date set' }}
                            </p>
                        </div>
                        <div>
                            <p class="text-xs uppercase tracking-[0.2em] text-emerald-100/60">Recovery Owner</p>
                            <p class="mt-1 font-medium text-white">
                                {{ followUpOwner?.name || documentBranding.issuedByName }}
                            </p>
                            <p class="mt-1 text-xs text-emerald-50/70">
                                {{ followUpOwner?.email || documentBranding.supportEmail || 'No direct contact captured' }}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section class="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <div class="space-y-4">
                    <div class="rounded-lg border border-slate-200 p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                                    Encounter Context
                                </p>
                                <p class="mt-2 text-base font-semibold text-slate-950">
                                    {{ appointment?.appointmentNumber || admission?.admissionNumber || 'No linked encounter' }}
                                </p>
                            </div>
                            <Badge variant="outline">
                                {{ appointment?.status ? formatEnumLabel(appointment.status) : admission?.status ? formatEnumLabel(admission.status) : 'N/A' }}
                            </Badge>
                        </div>
                        <dl class="mt-3 space-y-2 text-sm text-slate-600">
                            <div
                                v-for="[label, value] in encounterRows"
                                :key="`encounter-row-${label}`"
                                class="flex items-start justify-between gap-3"
                            >
                                <dt>{{ label }}</dt>
                                <dd class="text-right font-medium text-slate-900">
                                    {{ value }}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div class="rounded-lg border border-slate-200 p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                                    Billing Invoice
                                </p>
                                <p class="mt-2 text-base font-semibold text-slate-950">
                                    {{ invoice?.invoiceNumber || claim.invoiceId || 'No linked invoice' }}
                                </p>
                            </div>
                            <Badge variant="secondary">
                                {{ invoice?.status ? formatEnumLabel(invoice.status) : 'N/A' }}
                            </Badge>
                        </div>
                        <dl class="mt-3 space-y-2 text-sm text-slate-600">
                            <div
                                v-for="[label, value] in invoiceRows"
                                :key="`invoice-row-${label}`"
                                class="flex items-start justify-between gap-3"
                            >
                                <dt>{{ label }}</dt>
                                <dd class="text-right font-medium text-slate-900">
                                    {{ value }}
                                </dd>
                            </div>
                        </dl>
                        <div class="mt-4 grid gap-3 sm:grid-cols-3">
                            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Total</p>
                                <p class="mt-2 text-sm font-semibold text-slate-950">
                                    {{ formatMoney(invoice?.totalAmount, invoice?.currencyCode || claim.currencyCode) }}
                                </p>
                            </div>
                            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Collected</p>
                                <p class="mt-2 text-sm font-semibold text-slate-950">
                                    {{ formatMoney(invoice?.paidAmount, invoice?.currencyCode || claim.currencyCode) }}
                                </p>
                            </div>
                            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p class="text-xs uppercase tracking-[0.2em] text-slate-500">Balance</p>
                                <p class="mt-2 text-sm font-semibold text-slate-950">
                                    {{ formatMoney(invoice?.balanceAmount, invoice?.currencyCode || claim.currencyCode) }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="space-y-4">
                    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <div v-for="card in financialCards" :key="card.id" class="rounded-lg border border-slate-200 bg-white p-4">
                            <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                                {{ card.label }}
                            </p>
                            <p class="mt-2 text-lg font-semibold text-slate-950">
                                {{ card.value }}
                            </p>
                            <p class="mt-2 text-xs leading-5 text-slate-500">
                                {{ card.helper }}
                            </p>
                        </div>
                    </div>

                    <div class="grid gap-4 lg:grid-cols-2">
                        <div
                            v-for="card in noteCards"
                            :key="card.id"
                            class="rounded-lg border border-slate-200 bg-slate-50/80 p-4"
                        >
                            <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                                {{ card.title }}
                            </p>
                            <p class="mt-3 text-sm leading-6 text-slate-700">
                                {{ card.body }}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section class="rounded-lg border border-slate-200 p-5">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p class="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                            Timeline
                        </p>
                        <p class="mt-2 text-base font-semibold text-slate-950">
                            Claim lifecycle checkpoints
                        </p>
                    </div>
                    <Badge variant="outline">
                        {{ timelineItems.length }} milestones
                    </Badge>
                </div>

                <div class="mt-5 grid gap-4 xl:grid-cols-5">
                    <div
                        v-for="item in timelineItems"
                        :key="item.id"
                        class="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                    >
                        <div class="flex items-center justify-between gap-3">
                            <p class="text-sm font-semibold text-slate-950">
                                {{ item.title }}
                            </p>
                            <Badge :variant="item.at ? 'default' : 'outline'">
                                {{ item.at ? 'Done' : 'Pending' }}
                            </Badge>
                        </div>
                        <p class="mt-3 text-sm font-medium text-slate-900">
                            {{ formatDateTime(item.at) }}
                        </p>
                        <p class="mt-2 text-xs leading-5 text-slate-500">
                            {{ item.description }}
                        </p>
                    </div>
                </div>
            </section>
        </div>
    </DocumentShell>
</template>
