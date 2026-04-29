<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEnumLabel } from '@/lib/labels';

import { formatDateTime, formatPercent } from '../helpers';
import type { BillingFinancialControlsSummary } from '../types';

type BillingBoardFocusCard = {
    label: string;
    title: string;
    helper: string;
    toneClass: string;
};

type BillingOperationalQueueCounts = {
    cashierDaybook: number;
    claimPrep: number;
    reconciliation: number;
};

type BillingAgingBucketRow = {
    key: string;
    label: string;
    invoiceCount: number;
    balanceAmountTotal: number;
    barWidthPercent: number;
    barClass: string;
};

const props = defineProps<{
    canReadBillingInvoices: boolean;
    canReadBillingFinancialControls: boolean;
    billingPermissionsResolved: boolean;
    pageLoading: boolean;
    billingFinancialControlsWindowLabel: string;
    billingFinancialControlsAsOfLabel: string;
    financialSummaryCurrencyCode: string;
    billingFinancialControlsSummary: BillingFinancialControlsSummary | null;
    billingFinancialControlsLoading: boolean;
    billingFinancialControlsError: string | null;
    billingFinancialControlsExporting: boolean;
    billingOutstandingToneClass: string;
    billingAgingBucketRows: BillingAgingBucketRow[];
    billingDaybookToneClass: string;
    billingDaybookScopeLabel: string;
    billingVisiblePaymentActivityCount: number;
    billingOperationalQueueCounts: BillingOperationalQueueCounts;
    billingVisibleLatestPaymentAt: string | null;
    billingVisiblePaymentMethodMixLabel: string;
    billingVisiblePayerTypeMixLabel: string;
    billingOutstandingFollowUpCount: number;
    billingDaybookFocusCard: BillingBoardFocusCard;
    billingDenialPressureToneClass: string;
    billingDenialFocusCard: BillingBoardFocusCard;
    billingSettlementPressureToneClass: string;
    billingSettlementFocusCard: BillingBoardFocusCard;
    billingClaimsRejectedHref: string;
    billingClaimsPartialDenialsHref: string;
    billingClaimsPendingSettlementHref: string;
    billingClaimsOpenExceptionsHref: string;
    formatMoney: (value: string | number | null, currencyCode: string | null) => string;
}>();

const emit = defineEmits<{
    (e: 'refresh-summary'): void;
    (e: 'export-summary'): void;
    (e: 'open-cashier-daybook'): void;
    (e: 'work-outstanding-follow-up'): void;
    (e: 'open-claim-prep'): void;
    (e: 'open-reconciliation'): void;
}>();

const financialSummaryTopDenialReasons = computed(
    () => props.billingFinancialControlsSummary?.denials.topReasons ?? [],
);
</script>

<template>
    <div
        v-if="canReadBillingInvoices && canReadBillingFinancialControls"
        id="billing-invoices-board"
        class="space-y-2.5"
    >
        <Card class="rounded-lg border-sidebar-border/70 bg-muted/20">
            <CardContent class="flex flex-col gap-2.5 p-3 md:flex-row md:items-start md:justify-between">
                <div class="space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-medium">Financial Controls</p>
                        <Badge variant="outline">
                            {{ billingFinancialControlsWindowLabel }}
                        </Badge>
                        <Badge variant="outline">
                            {{ financialSummaryCurrencyCode }}
                        </Badge>
                        <Badge
                            v-if="billingFinancialControlsSummary?.window.payerType"
                            variant="outline"
                        >
                            {{ formatEnumLabel(billingFinancialControlsSummary.window.payerType) }}
                        </Badge>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        Outstanding balance, aging, denial pressure, and settlement reconciliation for the selected billing scope.
                    </p>
                    <p class="text-xs text-muted-foreground">
                        {{ billingFinancialControlsAsOfLabel }}
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        class="h-8"
                        :disabled="billingFinancialControlsLoading"
                        @click="emit('refresh-summary')"
                    >
                        {{ billingFinancialControlsLoading ? 'Refreshing...' : 'Refresh Summary' }}
                    </Button>
                    <Button
                        size="sm"
                        class="h-8"
                        :disabled="billingFinancialControlsExporting || billingFinancialControlsLoading"
                        @click="emit('export-summary')"
                    >
                        {{ billingFinancialControlsExporting ? 'Preparing...' : 'Export CSV' }}
                    </Button>
                </div>
            </CardContent>
        </Card>

        <div class="grid gap-2.5 xl:grid-cols-10">
            <template v-if="billingFinancialControlsSummary">
                <Card :class="['rounded-lg xl:col-span-4', billingOutstandingToneClass]">
                    <CardHeader class="pb-1.5">
                        <CardTitle class="text-sm">
                            Outstanding Balance
                        </CardTitle>
                        <CardDescription class="text-xs">
                            Open billing exposure and overdue pressure
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-3 text-sm">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p class="text-xl font-semibold">
                                    {{ formatMoney(billingFinancialControlsSummary.outstanding.balanceAmountTotal, financialSummaryCurrencyCode) }}
                                </p>
                                <p class="text-xs text-muted-foreground" />
                            </div>
                            <div class="space-y-1">
                                <p class="text-xs text-muted-foreground">
                                    {{ billingFinancialControlsSummary.outstanding.invoiceCount }}
                                    invoice(s) currently carry open balance
                                </p>
                            </div>
                            <Badge variant="outline">
                                {{ billingFinancialControlsAsOfLabel }}
                            </Badge>
                        </div>
                        <div class="grid gap-2 sm:grid-cols-3">
                            <div class="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Overdue balance
                                </p>
                                <p class="mt-0.5 text-sm font-semibold">
                                    {{ formatMoney(billingFinancialControlsSummary.outstanding.overdueBalanceAmountTotal, financialSummaryCurrencyCode) }}
                                </p>
                            </div>
                            <div class="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Overdue invoices
                                </p>
                                <p class="mt-0.5 text-sm font-semibold">
                                    {{ billingFinancialControlsSummary.outstanding.overdueInvoiceCount }}
                                </p>
                            </div>
                            <div class="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                                <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                    Average overdue age
                                </p>
                                <p class="mt-0.5 text-sm font-semibold">
                                    {{ billingFinancialControlsSummary.outstanding.averageDaysOverdue }}
                                    <span class="text-xs font-normal text-muted-foreground">days</span>
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card class="rounded-lg border-sidebar-border/70 xl:col-span-6">
                    <CardHeader class="pb-1.5">
                        <CardTitle class="text-sm">
                            Aging Distribution
                        </CardTitle>
                        <CardDescription class="text-xs">
                            Where open balances are sitting across the current aging buckets
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-2">
                        <div
                            v-for="bucket in billingAgingBucketRows"
                            :key="bucket.key"
                            class="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 md:grid-cols-[minmax(0,1fr)_90px_140px]"
                        >
                            <div class="min-w-0">
                                <div class="flex items-center justify-between gap-2">
                                    <p class="truncate text-sm font-medium">
                                        {{ bucket.label }}
                                    </p>
                                    <span class="text-[11px] text-muted-foreground">
                                        {{ bucket.invoiceCount }} invoice(s)
                                    </span>
                                </div>
                                <div class="mt-2 h-2 rounded-full bg-muted/80">
                                    <div
                                        class="h-2 rounded-full transition-[width]"
                                        :class="bucket.barClass"
                                        :style="{ width: `${bucket.barWidthPercent}%` }"
                                    />
                                </div>
                            </div>
                            <div class="text-xs text-muted-foreground md:text-right">
                                Balance
                            </div>
                            <div class="text-xs font-medium md:text-right">
                                {{ formatMoney(bucket.balanceAmountTotal, financialSummaryCurrencyCode) }}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </template>

            <template v-else-if="billingFinancialControlsLoading">
                <Card
                    v-for="index in 4"
                    :key="`billing-financial-controls-skeleton-${index}`"
                    class="rounded-lg border-sidebar-border/70 xl:col-span-5"
                >
                    <CardHeader class="pb-2">
                        <Skeleton class="h-4 w-28" />
                        <Skeleton class="h-3 w-36" />
                    </CardHeader>
                    <CardContent class="space-y-2">
                        <Skeleton class="h-6 w-24" />
                        <Skeleton class="h-3 w-full" />
                        <Skeleton class="h-3 w-4/5" />
                    </CardContent>
                </Card>
            </template>

            <Card
                v-else
                class="rounded-lg border-sidebar-border/70 xl:col-span-12"
            >
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm">
                        Financial Controls
                    </CardTitle>
                    <CardDescription class="text-xs">
                        Reporting summary could not be loaded for the current billing scope.
                    </CardDescription>
                </CardHeader>
                <CardContent class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                        {{ billingFinancialControlsError ?? 'Unknown error while loading reporting aggregates.' }}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        class="h-7"
                        :disabled="billingFinancialControlsLoading"
                        @click="emit('refresh-summary')"
                    >
                        {{ billingFinancialControlsLoading ? 'Retrying...' : 'Retry' }}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        class="h-7"
                        :disabled="billingFinancialControlsExporting || billingFinancialControlsLoading"
                        @click="emit('export-summary')"
                    >
                        {{ billingFinancialControlsExporting ? 'Preparing export...' : 'Export CSV' }}
                    </Button>
                </CardContent>
            </Card>
        </div>
    </div>

    <div
        v-if="canReadBillingInvoices"
        class="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3"
    >
        <Card :class="['rounded-lg', billingDaybookToneClass]">
            <CardHeader class="pb-1.5">
                <CardTitle class="text-sm">
                    Cashier Daybook
                </CardTitle>
                <CardDescription class="text-xs">
                    {{ billingDaybookScopeLabel }}
                </CardDescription>
            </CardHeader>
            <CardContent class="space-y-2.5 text-sm">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-lg font-semibold">
                            {{ billingVisiblePaymentActivityCount }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            invoice(s) with visible payment activity on this page
                        </p>
                    </div>
                    <Badge variant="outline">
                        {{ billingOperationalQueueCounts.cashierDaybook }} queue item(s)
                    </Badge>
                </div>
                <div class="grid gap-2 text-xs text-muted-foreground">
                    <p>
                        Latest posted activity:
                        <span class="text-foreground">
                            {{
                                billingVisibleLatestPaymentAt
                                    ? formatDateTime(billingVisibleLatestPaymentAt)
                                    : 'No payment activity on this page yet.'
                            }}
                        </span>
                    </p>
                    <p>
                        Payment method mix:
                        <span class="text-foreground">
                            {{ billingVisiblePaymentMethodMixLabel }}
                        </span>
                    </p>
                    <p>
                        Payer mix:
                        <span class="text-foreground">
                            {{ billingVisiblePayerTypeMixLabel }}
                        </span>
                    </p>
                    <p>
                        Outstanding follow-up:
                        <span class="text-foreground">
                            {{ billingOutstandingFollowUpCount }}
                        </span>
                    </p>
                </div>
                <div :class="['rounded-lg border p-3', billingDaybookFocusCard.toneClass]">
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {{ billingDaybookFocusCard.label }}
                    </p>
                    <p class="mt-1 text-sm font-medium text-foreground">
                        {{ billingDaybookFocusCard.title }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        {{ billingDaybookFocusCard.helper }}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        class="h-8"
                        @click="emit('open-cashier-daybook')"
                    >
                        Open Cashier Daybook
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        class="h-8"
                        @click="emit('work-outstanding-follow-up')"
                    >
                        Work Outstanding Follow-up
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card
            v-if="canReadBillingFinancialControls"
            :class="['rounded-lg', billingDenialPressureToneClass]"
        >
            <CardHeader class="pb-1.5">
                <CardTitle class="text-sm">
                    Denial &amp; Rework Lane
                </CardTitle>
                <CardDescription class="text-xs">
                    Claims rejection pressure and rework entry points
                </CardDescription>
            </CardHeader>
            <CardContent class="space-y-2.5 text-sm">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-lg font-semibold">
                            {{ formatMoney(billingFinancialControlsSummary?.denials.deniedAmountTotal ?? 0, financialSummaryCurrencyCode) }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Rejected:
                            {{ billingFinancialControlsSummary?.denials.deniedClaimCount ?? 0 }}
                            |
                            Partial:
                            {{ billingFinancialControlsSummary?.denials.partialDeniedClaimCount ?? 0 }}
                        </p>
                    </div>
                    <Badge variant="outline">
                        {{ billingOperationalQueueCounts.claimPrep }} claim-prep invoice(s)
                    </Badge>
                </div>
                <div class="space-y-1 text-xs text-muted-foreground">
                    <template v-if="financialSummaryTopDenialReasons.length > 0">
                        <p
                            v-for="reason in financialSummaryTopDenialReasons.slice(0, 2)"
                            :key="reason.reason"
                        >
                            <span class="text-foreground">{{ reason.reason }}</span>
                            ({{ reason.claimCount }}) |
                            {{ formatMoney(reason.deniedAmountTotal, financialSummaryCurrencyCode) }}
                        </p>
                    </template>
                    <p v-else>
                        No denial reasons are captured in the current filter window.
                    </p>
                </div>
                <div :class="['rounded-lg border p-3', billingDenialFocusCard.toneClass]">
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {{ billingDenialFocusCard.label }}
                    </p>
                    <p class="mt-1 text-sm font-medium text-foreground">
                        {{ billingDenialFocusCard.title }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        {{ billingDenialFocusCard.helper }}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        class="h-8"
                        @click="emit('open-claim-prep')"
                    >
                        Open Claim Prep Queue
                    </Button>
                    <Button size="sm" variant="outline" class="h-8" as-child>
                        <Link :href="billingClaimsRejectedHref">
                            Work Rejected Claims
                        </Link>
                    </Button>
                    <Button size="sm" variant="outline" class="h-8" as-child>
                        <Link :href="billingClaimsPartialDenialsHref">
                            Review Partial Denials
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card
            v-if="canReadBillingFinancialControls"
            :class="['rounded-lg', billingSettlementPressureToneClass]"
        >
            <CardHeader class="pb-1.5">
                <CardTitle class="text-sm">
                    Settlement Reconciliation
                </CardTitle>
                <CardDescription class="text-xs">
                    Approved claims vs reconciliation backlog
                </CardDescription>
            </CardHeader>
            <CardContent class="space-y-2.5 text-sm">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-lg font-semibold">
                            {{ formatPercent(billingFinancialControlsSummary?.settlement.settlementRatePercent ?? 0) }}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Approved:
                            {{ formatMoney(billingFinancialControlsSummary?.settlement.approvedAmountTotal ?? 0, financialSummaryCurrencyCode) }}
                        </p>
                    </div>
                    <Badge variant="outline">
                        {{ billingOperationalQueueCounts.reconciliation }} reconciliation invoice(s)
                    </Badge>
                </div>
                <div class="grid gap-2 text-xs text-muted-foreground">
                    <p>
                        Settled:
                        <span class="text-foreground">
                            {{ formatMoney(billingFinancialControlsSummary?.settlement.settledAmountTotal ?? 0, financialSummaryCurrencyCode) }}
                        </span>
                    </p>
                    <p>
                        Pending settlement:
                        <span class="text-foreground">
                            {{ formatMoney(billingFinancialControlsSummary?.settlement.pendingSettlementAmount ?? 0, financialSummaryCurrencyCode) }}
                        </span>
                    </p>
                    <p>
                        Pending / Partial / Settled:
                        <span class="text-foreground">
                            {{ billingFinancialControlsSummary?.settlement.reconciliationStatusCounts.pending ?? 0 }}/{{ billingFinancialControlsSummary?.settlement.reconciliationStatusCounts.partial_settled ?? 0 }}/{{ billingFinancialControlsSummary?.settlement.reconciliationStatusCounts.settled ?? 0 }}
                        </span>
                    </p>
                </div>
                <div :class="['rounded-lg border p-3', billingSettlementFocusCard.toneClass]">
                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {{ billingSettlementFocusCard.label }}
                    </p>
                    <p class="mt-1 text-sm font-medium text-foreground">
                        {{ billingSettlementFocusCard.title }}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                        {{ billingSettlementFocusCard.helper }}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        class="h-8"
                        @click="emit('open-reconciliation')"
                    >
                        Open Reconciliation Queue
                    </Button>
                    <Button size="sm" variant="outline" class="h-8" as-child>
                        <Link :href="billingClaimsPendingSettlementHref">
                            Work Pending Reconciliation
                        </Link>
                    </Button>
                    <Button size="sm" variant="outline" class="h-8" as-child>
                        <Link :href="billingClaimsOpenExceptionsHref">
                            Review Exceptions
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>

    <Card
        v-else-if="billingPermissionsResolved && !pageLoading"
        id="billing-invoices-board"
        class="rounded-lg border-sidebar-border/70"
    >
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <AppIcon name="layout-dashboard" class="size-4 text-muted-foreground" />
                Billing Board
            </CardTitle>
            <CardDescription>
                Financial operations summaries require billing reporting access.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Alert variant="destructive">
                <AlertTitle>Board access restricted</AlertTitle>
                <AlertDescription>
                    Request <code>billing.financial-controls.read</code> to open the billing board and reporting summaries.
                </AlertDescription>
            </Alert>
        </CardContent>
    </Card>
</template>
