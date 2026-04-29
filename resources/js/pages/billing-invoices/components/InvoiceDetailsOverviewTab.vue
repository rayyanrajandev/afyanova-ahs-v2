<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { TabsContent } from '@/components/ui/tabs';
import {
    amountToNumber,
    billingLineItemCoverageDecisionLabel,
    billingLineItemCoverageDecisionVariant,
    formatDate,
    formatPercent,
    invoiceLineItemCount,
    invoiceLineItems,
} from '../helpers';
import type {
    BillingInvoice,
    BillingInvoiceCoveragePosture,
    BillingInvoiceFinancePostingSummary,
    BillingInvoiceLineItem,
    InvoiceDetailsOperationalAction,
    InvoiceDetailsOperationalPanel,
} from '../types';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

type CoverageMetricBadge = {
    key: string;
    label: string;
    variant: BadgeVariant;
};

type FocusPanel = {
    heading: string;
    title: string;
    description: string;
    toneClass?: string;
    badgeLabel?: string;
    badgeVariant?: BadgeVariant;
};

type ActionOutcome = {
    invoiceId: string;
    title: string;
    message: string;
    tone: string;
};

type FinancialSnapshotRow = {
    key: string;
    label: string;
    value: string;
};

type FinancePostingCard = {
    key: string;
    label: string;
    value: string;
    helper: string;
};

interface Props {
    invoice: BillingInvoice;
    patientLabel: string;
    patientNumber: string | null;
    encounterContextLabel: string;
    sourceLabel: string | null;
    settlementRoutingTitle: string;
    settlementRoutingDescription: string;
    coveragePosture: BillingInvoiceCoveragePosture | null;
    coverageMetricBadges: CoverageMetricBadge[];
    focusPanel: FocusPanel | null;
    actionOutcome: ActionOutcome | null;
    operationalLockMessage: string | null;
    operationalPanel: InvoiceDetailsOperationalPanel | null;
    operationalActions: InvoiceDetailsOperationalAction[];
    actionLoadingId: string | null;
    financialSnapshotRows: FinancialSnapshotRow[];
    financePosting: BillingInvoiceFinancePostingSummary | null | undefined;
    financePostingLoading: boolean;
    financePostingError: string | null;
    financeInfrastructureAlert: string | null;
    financePostingCards: FinancePostingCard[];
    formatMoney: (
        value: number | string | null | undefined,
        currencyCode?: string | null | undefined,
    ) => string;
    previewText: (value: string | null) => string | null;
}

const props = defineProps<Props>();

const primaryOperationalAction = computed(
    () => props.operationalActions[0] ?? null,
);
const supportingOperationalActions = computed(() =>
    props.operationalActions.slice(1),
);

const financePostingBadgeVariant = computed<BadgeVariant>(() => {
    if (
        props.financePosting?.infrastructure &&
        (
            !props.financePosting.infrastructure.revenueRecognitionReady ||
            !props.financePosting.infrastructure.glPostingReady
        )
    ) {
        return 'outline';
    }

    return props.financePosting?.recognition.status === 'recognized'
        ? 'secondary'
        : 'outline';
});

const financePostingBadgeLabel = computed(() => {
    if (
        props.financePosting?.infrastructure &&
        (
            !props.financePosting.infrastructure.revenueRecognitionReady ||
            !props.financePosting.infrastructure.glPostingReady
        )
    ) {
        return 'Setup missing';
    }

    return props.financePosting?.recognition.status === 'recognized'
        ? 'Recognized'
        : 'Pending';
});

function copayLabel(): string {
    if (props.invoice.payerSummary?.copayType === 'fixed') {
        return props.formatMoney(
            props.invoice.payerSummary.copayAmount ?? 0,
            props.invoice.currencyCode,
        );
    }

    if (props.invoice.payerSummary?.copayType === 'percentage') {
        return `${formatPercent(
            amountToNumber(props.invoice.payerSummary.copayValue ?? null) ?? 0,
        )} | ${props.formatMoney(
            props.invoice.payerSummary.copayAmount ?? 0,
            props.invoice.currencyCode,
        )}`;
    }

    return 'None';
}

function lineItemTotal(lineItem: BillingInvoiceLineItem): number {
    return (
        lineItem.lineTotal ??
        (amountToNumber(lineItem.quantity) ?? 0) *
            (amountToNumber(lineItem.unitPrice) ?? 0)
    );
}
</script>

<template>
    <TabsContent value="overview" class="mt-0 space-y-4">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm">
            <div class="flex items-center gap-1.5">
                <AppIcon name="user" class="size-3.5 text-muted-foreground" />
                <span class="font-medium">{{ patientLabel }}</span>
                <span v-if="patientNumber" class="text-xs text-muted-foreground">
                    ({{ patientNumber }})
                </span>
            </div>
            <Separator orientation="vertical" class="!h-4" />
            <div class="flex items-center gap-1.5">
                <AppIcon name="stethoscope" class="size-3.5 text-muted-foreground" />
                <span class="text-xs text-muted-foreground">{{ encounterContextLabel }}</span>
            </div>
            <Separator
                v-if="sourceLabel"
                orientation="vertical"
                class="!h-4"
            />
            <span v-if="sourceLabel" class="text-xs text-muted-foreground">
                Source: {{ sourceLabel }}
            </span>
            <Separator orientation="vertical" class="!h-4" />
            <div class="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Invoiced {{ formatDate(invoice.invoiceDate) }}</span>
                <span>Due {{ formatDate(invoice.paymentDueAt) }}</span>
                <span>{{ invoice.currencyCode || 'N/A' }}</span>
            </div>
        </div>

        <Collapsible
            v-if="invoice.payerSummary || invoice.claimReadiness"
            :default-open="true"
            class="rounded-lg border"
        >
            <CollapsibleTrigger class="flex w-full items-center justify-between p-3 transition-colors hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180">
                <div class="flex items-center gap-2">
                    <p class="text-sm font-medium">{{ settlementRoutingTitle }}</p>
                    <Badge
                        :variant="coveragePosture?.badgeVariant ?? 'outline'"
                        class="text-[10px]"
                    >
                        {{ coveragePosture?.label || 'Settlement posture' }}
                    </Badge>
                </div>
                <AppIcon name="chevron-down" class="size-4 text-muted-foreground transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div class="space-y-3 border-t px-3 pb-3 pt-2">
                    <p class="text-xs text-muted-foreground">
                        {{ settlementRoutingDescription }}
                    </p>

                    <div class="grid grid-cols-4 gap-2">
                        <div class="rounded-lg bg-muted/30 px-3 py-2.5">
                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Settlement Path
                            </p>
                            <p class="mt-1 text-sm font-medium text-foreground">
                                {{
                                    invoice.payerSummary?.contractName ||
                                    invoice.payerSummary?.payerName ||
                                    invoice.payerSummary?.settlementPath ||
                                    'Self-pay'
                                }}
                            </p>
                        </div>
                        <div class="rounded-lg bg-muted/30 px-3 py-2.5">
                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Expected Payer
                            </p>
                            <p class="mt-1 text-sm font-medium text-foreground">
                                {{ formatMoney(invoice.payerSummary?.expectedPayerAmount ?? 0, invoice.currencyCode) }}
                            </p>
                        </div>
                        <div class="rounded-lg bg-muted/30 px-3 py-2.5">
                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Expected Patient
                            </p>
                            <p class="mt-1 text-sm font-medium text-foreground">
                                {{
                                    formatMoney(
                                        invoice.payerSummary?.expectedPatientAmount ??
                                            invoice.totalAmount ??
                                            0,
                                        invoice.currencyCode,
                                    )
                                }}
                            </p>
                        </div>
                        <div class="rounded-lg bg-muted/30 px-3 py-2.5">
                            <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Claim Exposure
                            </p>
                            <p class="mt-1 text-sm font-medium text-foreground">
                                {{
                                    formatMoney(
                                        invoice.claimReadiness?.expectedClaimAmount ??
                                            invoice.payerSummary?.expectedPayerAmount ??
                                            0,
                                        invoice.currencyCode,
                                    )
                                }}
                            </p>
                        </div>
                    </div>

                    <div
                        v-if="invoice.payerSummary"
                        class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                    >
                        <Badge variant="outline">
                            Coverage
                            {{
                                formatPercent(
                                    amountToNumber(
                                        invoice.payerSummary.coveragePercent ?? null,
                                    ) ?? 0,
                                )
                            }}
                        </Badge>
                        <Badge variant="outline">
                            Copay {{ copayLabel() }}
                        </Badge>
                        <Badge
                            v-if="invoice.payerSummary.requiresPreAuthorization"
                            variant="outline"
                        >
                            Pre-authorization required
                        </Badge>
                        <Badge
                            v-if="invoice.payerSummary.claimSubmissionDueAt"
                            variant="outline"
                        >
                            Claim due
                            {{ formatDate(invoice.payerSummary.claimSubmissionDueAt) }}
                        </Badge>
                        <Badge
                            v-for="badge in coverageMetricBadges"
                            :key="`invoice-details-coverage-${badge.key}`"
                            :variant="badge.variant"
                        >
                            {{ badge.label }}
                        </Badge>
                    </div>

                    <Alert
                        v-if="
                            invoice.claimReadiness &&
                            invoice.claimReadiness.blockingReasons.length > 0
                        "
                        variant="destructive"
                        class="py-2"
                    >
                        <AlertTitle>Claim blockers</AlertTitle>
                        <AlertDescription class="space-y-1 text-sm leading-5">
                            <p
                                v-for="reason in invoice.claimReadiness.blockingReasons"
                                :key="`invoice-claim-block-${reason}`"
                            >
                                {{ reason }}
                            </p>
                        </AlertDescription>
                    </Alert>
                    <Alert
                        v-else-if="
                            invoice.claimReadiness &&
                            invoice.claimReadiness.guidance.length > 0
                        "
                        class="py-2"
                    >
                        <AlertDescription class="space-y-1 text-sm leading-5">
                            <p
                                v-for="guidance in invoice.claimReadiness.guidance"
                                :key="`invoice-claim-guidance-${guidance}`"
                            >
                                {{ guidance }}
                            </p>
                        </AlertDescription>
                    </Alert>
                </div>
            </CollapsibleContent>
        </Collapsible>

        <div class="grid gap-3">
            <div class="rounded-lg bg-muted/30 p-4">
                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {{ focusPanel?.heading || 'Invoice summary' }}
                </p>
                <p class="mt-1.5 text-sm font-semibold text-foreground">
                    {{ focusPanel?.title }}
                </p>
                <p class="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {{ focusPanel?.description }}
                </p>
                <Alert
                    v-if="actionOutcome && actionOutcome.invoiceId === invoice.id"
                    class="mt-3 py-2"
                >
                    <AlertTitle>{{ actionOutcome.title }}</AlertTitle>
                    <AlertDescription>
                        {{ actionOutcome.message }}
                    </AlertDescription>
                </Alert>
                <Alert
                    v-else-if="operationalLockMessage"
                    class="mt-3 bg-muted/20"
                >
                    <AlertTitle>Draft maintenance locked</AlertTitle>
                    <AlertDescription class="text-sm leading-5">
                        {{ operationalLockMessage }}
                    </AlertDescription>
                </Alert>
            </div>

            <div
                v-if="operationalPanel"
                class="rounded-lg border p-4"
            >
                <div class="flex items-center justify-between gap-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {{ operationalPanel.heading }}
                    </p>
                    <Badge
                        v-if="focusPanel?.badgeLabel"
                        variant="outline"
                        class="text-[11px]"
                    >
                        {{ focusPanel.badgeLabel }}
                    </Badge>
                </div>
                <p class="mt-1.5 text-sm font-semibold text-foreground">
                    {{ operationalPanel.title }}
                </p>
                <p class="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {{ operationalPanel.description }}
                </p>
                <div
                    v-if="operationalPanel.cards?.length"
                    class="mt-3 grid gap-2 sm:grid-cols-2"
                >
                    <div
                        v-for="card in operationalPanel.cards"
                        :key="`bil-operational-card-${card.id}`"
                        class="rounded-lg bg-muted/30 px-3 py-2.5"
                    >
                        <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {{ card.title }}
                        </p>
                        <p class="mt-1 text-sm font-semibold text-foreground">
                            {{ card.value }}
                        </p>
                        <p class="mt-0.5 text-xs text-muted-foreground">
                            {{ card.helper }}
                        </p>
                    </div>
                </div>
                <div
                    v-if="operationalActions.length > 0"
                    class="mt-3 flex flex-wrap items-center gap-2"
                >
                    <template v-if="primaryOperationalAction">
                        <Button
                            v-if="primaryOperationalAction.href"
                            :variant="primaryOperationalAction.variant"
                            size="sm"
                            class="gap-1.5"
                            as-child
                        >
                            <Link :href="primaryOperationalAction.href">
                                <AppIcon :name="primaryOperationalAction.icon" class="size-3.5" />
                                {{ primaryOperationalAction.label }}
                            </Link>
                        </Button>
                        <Button
                            v-else
                            :variant="primaryOperationalAction.variant"
                            size="sm"
                            :disabled="actionLoadingId === invoice.id"
                            class="gap-1.5"
                            @click="primaryOperationalAction.onClick?.()"
                        >
                            <AppIcon :name="primaryOperationalAction.icon" class="size-3.5" />
                            {{ primaryOperationalAction.label }}
                        </Button>
                    </template>
                    <template
                        v-for="action in supportingOperationalActions"
                        :key="`bil-operational-quick-${action.key}`"
                    >
                        <Button
                            v-if="action.href"
                            size="sm"
                            :variant="action.variant === 'default' ? 'outline' : action.variant"
                            class="gap-1.5"
                            as-child
                        >
                            <Link :href="action.href">
                                <AppIcon :name="action.icon" class="size-3.5" />
                                {{ action.label }}
                            </Link>
                        </Button>
                        <Button
                            v-else
                            size="sm"
                            :variant="action.variant === 'default' ? 'outline' : action.variant"
                            :disabled="actionLoadingId === invoice.id"
                            class="gap-1.5"
                            @click="action.onClick?.()"
                        >
                            <AppIcon :name="action.icon" class="size-3.5" />
                            {{ action.label }}
                        </Button>
                    </template>
                </div>
            </div>
        </div>

        <div class="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <div class="rounded-lg border p-4">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <p class="text-sm font-medium">Financial snapshot</p>
                    <Badge variant="outline">
                        {{ invoiceLineItemCount(invoice) }}
                        {{ invoiceLineItemCount(invoice) === 1 ? 'line' : 'lines' }}
                    </Badge>
                </div>
                <div class="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <div
                        v-for="row in financialSnapshotRows"
                        :key="`invoice-financial-snapshot-${row.key}`"
                        class="rounded-lg bg-muted/30 px-3 py-2.5"
                    >
                        <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {{ row.label }}
                        </p>
                        <p class="mt-1 text-sm font-semibold text-foreground">
                            {{ row.value }}
                        </p>
                    </div>
                </div>
            </div>
            <div class="rounded-lg border p-4">
                <div class="flex items-start justify-between gap-3">
                    <p class="text-sm font-medium text-foreground">Finance posting</p>
                    <Badge :variant="financePostingBadgeVariant">
                        {{ financePostingBadgeLabel }}
                    </Badge>
                </div>
                <div
                    v-if="financePostingLoading"
                    class="mt-4 space-y-2"
                >
                    <Skeleton class="h-14 rounded-lg" />
                    <Skeleton class="h-14 rounded-lg" />
                </div>
                <Alert
                    v-else-if="financePostingError"
                    variant="destructive"
                    class="mt-4 rounded-lg"
                >
                    <AlertTitle>Finance posting unavailable</AlertTitle>
                    <AlertDescription>
                        {{ financePostingError }}
                    </AlertDescription>
                </Alert>
                <div v-else class="mt-4 space-y-2">
                    <Alert
                        v-if="financeInfrastructureAlert"
                        variant="destructive"
                        class="rounded-lg"
                    >
                        <AlertTitle>Finance setup incomplete</AlertTitle>
                        <AlertDescription>
                            {{ financeInfrastructureAlert }}
                        </AlertDescription>
                    </Alert>
                    <div
                        v-for="card in financePostingCards"
                        :key="`bil-finance-posting-${card.key}`"
                        class="rounded-lg bg-muted/30 px-3 py-2.5"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                    {{ card.label }}
                                </p>
                                <p class="mt-1 text-sm font-semibold text-foreground">
                                    {{ card.value }}
                                </p>
                            </div>
                            <p class="max-w-[12rem] text-right text-xs text-muted-foreground">
                                {{ card.helper }}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <Collapsible :default-open="true" class="rounded-lg border">
            <CollapsibleTrigger class="flex w-full items-center justify-between p-4 transition-colors hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180">
                <div class="flex items-center gap-2">
                    <p class="text-sm font-medium">Line Items</p>
                    <Badge variant="secondary" class="h-5 min-w-5 px-1.5 text-[10px]">
                        {{ invoiceLineItemCount(invoice) }}
                    </Badge>
                </div>
                <AppIcon name="chevron-down" class="size-4 text-muted-foreground transition-transform duration-200" />
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div class="px-4 pb-4 pt-2">
                    <p class="mb-2 text-xs text-muted-foreground">
                        Service evidence, negotiated pricing, and authorization posture stay visible here.
                    </p>

                    <div
                        v-if="invoiceLineItemCount(invoice) === 0"
                        class="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground"
                    >
                        No line items recorded.
                    </div>
                    <div v-else class="mt-3 space-y-2">
                        <div
                            v-for="(lineItem, lineIndex) in invoiceLineItems(invoice)"
                            :key="`${invoice.id}-detail-line-${lineIndex}`"
                            class="rounded-lg bg-muted/30 p-3"
                        >
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div class="min-w-0 space-y-2">
                                    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div class="min-w-0">
                                            <p class="text-sm font-medium text-foreground">
                                                {{ lineItem.description || `Line ${lineIndex + 1}` }}
                                            </p>
                                            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                <span>Line {{ lineIndex + 1 }}</span>
                                                <span v-if="lineItem.serviceCode">Code: {{ lineItem.serviceCode }}</span>
                                                <span v-if="lineItem.unit">Unit: {{ lineItem.unit }}</span>
                                            </div>
                                        </div>
                                        <div class="text-left sm:text-right lg:hidden">
                                            <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                                Line total
                                            </p>
                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                {{ formatMoney(lineItemTotal(lineItem), invoice.currencyCode) }}
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        v-if="
                                            lineItem.coverage?.decision ||
                                            lineItem.authorization?.required ||
                                            lineItem.pricingSource === 'payer_contract_price_override'
                                        "
                                        class="flex flex-wrap items-center gap-1.5"
                                    >
                                        <Badge
                                            v-if="lineItem.coverage?.decision"
                                            :variant="billingLineItemCoverageDecisionVariant(lineItem.coverage?.decision)"
                                        >
                                            {{ billingLineItemCoverageDecisionLabel(lineItem.coverage?.decision) }}
                                        </Badge>
                                        <Badge
                                            v-if="lineItem.coverage?.selectedRuleCode"
                                            variant="outline"
                                        >
                                            Rule {{ lineItem.coverage?.selectedRuleCode }}
                                        </Badge>
                                        <Badge
                                            v-if="lineItem.authorization?.required"
                                            :variant="lineItem.authorization?.autoApproved ? 'secondary' : 'outline'"
                                        >
                                            {{
                                                lineItem.authorization?.autoApproved
                                                    ? 'Authorization auto-approved'
                                                    : 'Authorization required'
                                            }}
                                        </Badge>
                                        <Badge
                                            v-if="lineItem.pricingSource === 'payer_contract_price_override'"
                                            variant="secondary"
                                        >
                                            Negotiated price
                                        </Badge>
                                    </div>
                                    <div class="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                        <span class="font-medium text-foreground">
                                            {{ amountToNumber(lineItem.quantity) ?? 0 }}
                                        </span>
                                        x
                                        <span class="font-medium text-foreground">
                                            {{ formatMoney(lineItem.unitPrice, invoice.currencyCode) }}
                                        </span>
                                        per unit
                                    </div>
                                    <p
                                        v-if="previewText(lineItem.notes ?? null)"
                                        class="text-xs text-muted-foreground"
                                    >
                                        {{ previewText(lineItem.notes ?? null) }}
                                    </p>
                                </div>
                                <div class="hidden min-w-[10rem] text-right lg:block">
                                    <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                        Line total
                                    </p>
                                    <p class="mt-1 text-base font-semibold text-foreground">
                                        {{ formatMoney(lineItemTotal(lineItem), invoice.currencyCode) }}
                                    </p>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        Qty {{ amountToNumber(lineItem.quantity) ?? 0 }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    </TabsContent>
</template>
