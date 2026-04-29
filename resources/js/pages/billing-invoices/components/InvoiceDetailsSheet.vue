<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { toRef } from 'vue';

import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatEnumLabel } from '@/lib/labels';

import { statusVariant } from '../helpers';
import InvoiceDetailsAuditTab from './InvoiceDetailsAuditTab.vue';
import InvoiceDetailsOverviewTab from './InvoiceDetailsOverviewTab.vue';
import InvoiceDetailsWorkflowsTab from './InvoiceDetailsWorkflowsTab.vue';

const props = defineProps({
    state: { type: Object, required: true },
    view: { type: Object, required: true },
    actions: { type: Object, required: true },
    helpers: { type: Object, required: true },
});

const state = props.state as Record<string, any>;
const view = props.view as Record<string, any>;
const actions = props.actions as Record<string, any>;
const helpers = props.helpers as Record<string, any>;

const invoiceDetailsSheetOpen = toRef(state, 'invoiceDetailsSheetOpen');
const invoiceDetailsInvoice = toRef(state, 'invoiceDetailsInvoice');
const invoiceDetailsSheetTab = toRef(state, 'invoiceDetailsSheetTab');
const invoiceDetailsPaymentsFiltersOpen = toRef(
    state,
    'invoiceDetailsPaymentsFiltersOpen',
);
const invoiceDetailsAuditFiltersOpen = toRef(
    state,
    'invoiceDetailsAuditFiltersOpen',
);

const invoiceDetailsSheetDescription = view.invoiceDetailsSheetDescription;
const invoiceDetailsUsesThirdPartySettlement =
    view.invoiceDetailsUsesThirdPartySettlement;
const invoiceDetailsAmountSummary = view.invoiceDetailsAmountSummary;
const canViewBillingInvoiceAuditLogs = view.canViewBillingInvoiceAuditLogs;
const invoiceDetailsAuditLogsMeta = view.invoiceDetailsAuditLogsMeta;
const invoiceDetailsAuditLogs = view.invoiceDetailsAuditLogs;
const invoiceDetailsSettlementRoutingTitle =
    view.invoiceDetailsSettlementRoutingTitle;
const invoiceDetailsSettlementRoutingDescription =
    view.invoiceDetailsSettlementRoutingDescription;
const invoiceDetailsCoveragePosture = view.invoiceDetailsCoveragePosture;
const invoiceDetailsCoverageMetricBadges =
    view.invoiceDetailsCoverageMetricBadges;
const invoiceDetailsFocusPanel = view.invoiceDetailsFocusPanel;
const invoiceDetailsActionOutcome = view.invoiceDetailsActionOutcome;
const invoiceDetailsOperationalLockMessage =
    view.invoiceDetailsOperationalLockMessage;
const invoiceDetailsOperationalPanel = view.invoiceDetailsOperationalPanel;
const invoiceDetailsOperationalActions =
    view.invoiceDetailsOperationalActions;
const actionLoadingId = view.actionLoadingId;
const invoiceDetailsFinancialSnapshotRows =
    view.invoiceDetailsFinancialSnapshotRows;
const invoiceDetailsFinancePosting = view.invoiceDetailsFinancePosting;
const invoiceDetailsFinancePostingLoading =
    view.invoiceDetailsFinancePostingLoading;
const invoiceDetailsFinancePostingError =
    view.invoiceDetailsFinancePostingError;
const invoiceDetailsFinanceInfrastructureAlert =
    view.invoiceDetailsFinanceInfrastructureAlert;
const invoiceDetailsFinancePostingCards =
    view.invoiceDetailsFinancePostingCards;
const invoiceDetailsWorkflowStepCards =
    view.invoiceDetailsWorkflowStepCards;
const invoiceDetailsExecutionControlCards =
    view.invoiceDetailsExecutionControlCards;
const invoiceDetailsExecutionChecklist =
    view.invoiceDetailsExecutionChecklist;
const invoiceDetailsLedgerTitle = view.invoiceDetailsLedgerTitle;
const invoiceDetailsLedgerDescription =
    view.invoiceDetailsLedgerDescription;
const invoiceDetailsLedgerRestrictedTitle =
    view.invoiceDetailsLedgerRestrictedTitle;
const invoiceDetailsLedgerRestrictedDescription =
    view.invoiceDetailsLedgerRestrictedDescription;
const invoiceDetailsLedgerQuickFilters =
    view.invoiceDetailsLedgerQuickFilters;
const invoiceDetailsLedgerDateTitle = view.invoiceDetailsLedgerDateTitle;
const invoiceDetailsLedgerDateHelper = view.invoiceDetailsLedgerDateHelper;
const invoiceDetailsLedgerSearchPlaceholder =
    view.invoiceDetailsLedgerSearchPlaceholder;
const invoiceDetailsLedgerSnapshotCards =
    view.invoiceDetailsLedgerSnapshotCards;
const invoiceDetailsLedgerActiveFilters =
    view.invoiceDetailsLedgerActiveFilters;
const invoiceDetailsLedgerEmptyStateLabel =
    view.invoiceDetailsLedgerEmptyStateLabel;
const invoiceDetailsLedgerEntryLabel =
    view.invoiceDetailsLedgerEntryLabel;
const canViewBillingPaymentHistory =
    view.canViewBillingPaymentHistory;
const invoiceDetailsPaymentsMeta = view.invoiceDetailsPaymentsMeta;
const invoiceDetailsPaymentsLoading = view.invoiceDetailsPaymentsLoading;
const invoiceDetailsPaymentsError = view.invoiceDetailsPaymentsError;
const invoiceDetailsPayments = view.invoiceDetailsPayments;
const invoiceDetailsPaymentsFilters = view.invoiceDetailsPaymentsFilters;
const paymentReversalSubmitting = view.paymentReversalSubmitting;
const invoiceDetailsWorkflowLinks = view.invoiceDetailsWorkflowLinks;
const invoiceDetailsAuditSummary = view.invoiceDetailsAuditSummary;
const invoiceDetailsAuditHasActiveFilters =
    view.invoiceDetailsAuditHasActiveFilters;
const invoiceDetailsAuditActiveFilters =
    view.invoiceDetailsAuditActiveFilters;
const invoiceDetailsAuditLogsFilters =
    view.invoiceDetailsAuditLogsFilters;
const invoiceDetailsAuditLogsLoading =
    view.invoiceDetailsAuditLogsLoading;
const invoiceDetailsAuditLogsExporting =
    view.invoiceDetailsAuditLogsExporting;
const invoiceDetailsAuditLogsError = view.invoiceDetailsAuditLogsError;
const invoiceDetailsAuditExportJobsFilters =
    view.invoiceDetailsAuditExportJobsFilters;
const invoiceDetailsAuditExportJobsLoading =
    view.invoiceDetailsAuditExportJobsLoading;
const invoiceDetailsAuditExportJobsError =
    view.invoiceDetailsAuditExportJobsError;
const invoiceDetailsAuditExportJobs =
    view.invoiceDetailsAuditExportJobs;
const invoiceDetailsAuditExportJobsMeta =
    view.invoiceDetailsAuditExportJobsMeta;
const invoiceDetailsAuditExportJobSummary =
    view.invoiceDetailsAuditExportJobSummary;
const invoiceDetailsAuditExportOpsHint =
    view.invoiceDetailsAuditExportOpsHint;
const invoiceDetailsAuditExportHandoffMessage =
    view.invoiceDetailsAuditExportHandoffMessage;
const invoiceDetailsAuditExportHandoffError =
    view.invoiceDetailsAuditExportHandoffError;
const invoiceDetailsAuditExportPinnedHandoffJob =
    view.invoiceDetailsAuditExportPinnedHandoffJob;
const invoiceDetailsAuditExportFocusJobId =
    view.invoiceDetailsAuditExportFocusJobId;
const invoiceDetailsAuditExportRetryingJobId =
    view.invoiceDetailsAuditExportRetryingJobId;
const invoiceDetailsPrimaryOperationalAction =
    view.invoiceDetailsPrimaryOperationalAction;

const closeInvoiceDetailsSheet = actions.closeInvoiceDetailsSheet;
const openInvoicePrintPreview = actions.openInvoicePrintPreview;
const loadInvoiceDetailsPayments = actions.loadInvoiceDetailsPayments;
const submitInvoiceDetailsPaymentsFilters =
    actions.submitInvoiceDetailsPaymentsFilters;
const resetInvoiceDetailsPaymentsFilters =
    actions.resetInvoiceDetailsPaymentsFilters;
const applyInvoiceDetailsPaymentQuickFilter =
    actions.applyInvoiceDetailsPaymentQuickFilter;
const openPaymentReversalDialog = actions.openPaymentReversalDialog;
const loadInvoiceDetailsAuditLogs =
    actions.loadInvoiceDetailsAuditLogs;
const submitInvoiceDetailsAuditLogsFilters =
    actions.submitInvoiceDetailsAuditLogsFilters;
const resetInvoiceDetailsAuditLogsFilters =
    actions.resetInvoiceDetailsAuditLogsFilters;
const exportInvoiceAuditLogsCsv = actions.exportInvoiceAuditLogsCsv;
const loadInvoiceAuditExportJobs = actions.loadInvoiceAuditExportJobs;
const submitInvoiceDetailsAuditExportJobsFilters =
    actions.submitInvoiceDetailsAuditExportJobsFilters;
const resetInvoiceDetailsAuditExportJobsFilters =
    actions.resetInvoiceDetailsAuditExportJobsFilters;
const downloadInvoiceAuditExportJob =
    actions.downloadInvoiceAuditExportJob;
const retryInvoiceAuditExportJob = actions.retryInvoiceAuditExportJob;
const prevInvoiceDetailsAuditExportJobsPage =
    actions.prevInvoiceDetailsAuditExportJobsPage;
const nextInvoiceDetailsAuditExportJobsPage =
    actions.nextInvoiceDetailsAuditExportJobsPage;
const toggleInvoiceDetailsAuditLogExpanded =
    actions.toggleInvoiceDetailsAuditLogExpanded;
const prevInvoiceDetailsAuditLogsPage =
    actions.prevInvoiceDetailsAuditLogsPage;
const nextInvoiceDetailsAuditLogsPage =
    actions.nextInvoiceDetailsAuditLogsPage;

const formatMoney = helpers.formatMoney;
const shortId = helpers.shortId;
const previewText = helpers.previewText;
const invoicePatientLabel = helpers.invoicePatientLabel;
const invoicePatientNumber = helpers.invoicePatientNumber;
const invoiceEncounterContextLabel =
    helpers.invoiceEncounterContextLabel;
const invoiceSourceLabel = helpers.invoiceSourceLabel;
const billingPaymentCanBeReversed =
    helpers.billingPaymentCanBeReversed;
const auditLogActionLabel = helpers.auditLogActionLabel;
const auditLogActorLabel = helpers.auditLogActorLabel;
const invoiceDetailsAuditActorTypeLabel =
    helpers.invoiceDetailsAuditActorTypeLabel;
const invoiceDetailsAuditChangeSummary =
    helpers.invoiceDetailsAuditChangeSummary;
const invoiceDetailsAuditChangeKeys =
    helpers.invoiceDetailsAuditChangeKeys;
const invoiceDetailsAuditMetadataPreview =
    helpers.invoiceDetailsAuditMetadataPreview;
const auditLogEntries = helpers.auditLogEntries;
const formatAuditLogJson = helpers.formatAuditLogJson;
const isInvoiceDetailsAuditLogExpanded =
    helpers.isInvoiceDetailsAuditLogExpanded;

function refreshInvoiceDetailsPayments(): void {
    if (!invoiceDetailsInvoice.value) return;
    void loadInvoiceDetailsPayments(invoiceDetailsInvoice.value.id);
}

function toggleInvoiceDetailsPaymentsFilters(): void {
    invoiceDetailsPaymentsFiltersOpen.value =
        !invoiceDetailsPaymentsFiltersOpen.value;
}

function refreshInvoiceDetailsAuditLogs(): void {
    if (!invoiceDetailsInvoice.value) return;
    void loadInvoiceDetailsAuditLogs(invoiceDetailsInvoice.value.id);
}

function toggleInvoiceDetailsAuditFilters(): void {
    invoiceDetailsAuditFiltersOpen.value =
        !invoiceDetailsAuditFiltersOpen.value;
}

function refreshInvoiceAuditExportJobs(): void {
    if (!invoiceDetailsInvoice.value) return;
    void loadInvoiceAuditExportJobs(invoiceDetailsInvoice.value.id);
}

function printCurrentInvoice(): void {
    if (!invoiceDetailsInvoice.value) return;
    openInvoicePrintPreview(invoiceDetailsInvoice.value);
}
</script>

<template>
    <Sheet
        :open="invoiceDetailsSheetOpen"
        @update:open="
            (open) =>
                open
                    ? (invoiceDetailsSheetOpen = true)
                    : closeInvoiceDetailsSheet()
        "
    >
        <SheetContent side="right" variant="workspace" size="6xl">
            <SheetHeader
                class="shrink-0 space-y-3 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <SheetTitle class="flex items-center gap-2">
                            <span>Invoice Details</span>
                            <Badge
                                v-if="invoiceDetailsInvoice"
                                :variant="statusVariant(invoiceDetailsInvoice.status)"
                                class="text-[11px]"
                            >
                                {{ formatEnumLabel(invoiceDetailsInvoice.status) }}
                            </Badge>
                        </SheetTitle>
                        <SheetDescription class="mt-1">
                            {{ invoiceDetailsSheetDescription }}
                        </SheetDescription>
                    </div>
                    <Badge
                        v-if="invoiceDetailsInvoice"
                        variant="outline"
                        class="shrink-0 font-mono text-xs"
                    >
                        {{
                            invoiceDetailsInvoice.invoiceNumber ||
                            shortId(invoiceDetailsInvoice.id)
                        }}
                    </Badge>
                </div>
                <div v-if="invoiceDetailsInvoice" class="grid grid-cols-4 gap-2">
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                            Total
                        </p>
                        <p class="text-sm font-bold tabular-nums text-foreground">
                            {{
                                formatMoney(
                                    invoiceDetailsInvoice.totalAmount,
                                    invoiceDetailsInvoice.currencyCode,
                                )
                            }}
                        </p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                            {{
                                invoiceDetailsUsesThirdPartySettlement
                                    ? 'Settled'
                                    : 'Paid'
                            }}
                        </p>
                        <p
                            class="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400"
                        >
                            {{
                                formatMoney(
                                    invoiceDetailsAmountSummary.paid,
                                    invoiceDetailsInvoice.currencyCode,
                                )
                            }}
                        </p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                            Balance
                        </p>
                        <p
                            class="text-sm font-bold tabular-nums"
                            :class="
                                invoiceDetailsAmountSummary.balance &&
                                invoiceDetailsAmountSummary.balance > 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-foreground'
                            "
                        >
                            {{
                                invoiceDetailsAmountSummary.balance !== null
                                    ? formatMoney(
                                          invoiceDetailsAmountSummary.balance,
                                          invoiceDetailsInvoice.currencyCode,
                                      )
                                    : 'N/A'
                            }}
                        </p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p
                            class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                        >
                            Progress
                        </p>
                        <div class="mt-1 flex items-center gap-2">
                            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                    class="h-full rounded-full bg-primary transition-all"
                                    :style="{
                                        width: `${invoiceDetailsAmountSummary.settlementPercent}%`,
                                    }"
                                />
                            </div>
                            <span class="text-xs font-bold tabular-nums text-foreground">
                                {{ invoiceDetailsAmountSummary.settlementPercent }}%
                            </span>
                        </div>
                    </div>
                </div>
            </SheetHeader>

            <div v-if="invoiceDetailsInvoice" class="flex min-h-0 flex-1 flex-col">
                <Tabs
                    v-model="invoiceDetailsSheetTab"
                    class="flex min-h-0 flex-1 flex-col gap-0"
                >
                    <div
                        class="shrink-0 border-b bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
                    >
                        <TabsList class="grid h-auto w-full grid-cols-3">
                            <TabsTrigger
                                value="overview"
                                class="inline-flex items-center gap-1.5 text-xs sm:text-sm"
                            >
                                <AppIcon name="layout-grid" class="size-3.5" />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger
                                value="workflows"
                                class="inline-flex items-center gap-1.5 text-xs sm:text-sm"
                            >
                                <AppIcon name="activity" class="size-3.5" />
                                Workflows
                            </TabsTrigger>
                            <TabsTrigger
                                value="audit"
                                class="inline-flex items-center gap-1.5 text-xs sm:text-sm"
                            >
                                <AppIcon name="file-text" class="size-3.5" />
                                Audit
                                <Badge
                                    v-if="canViewBillingInvoiceAuditLogs"
                                    variant="secondary"
                                    class="h-4 min-w-4 px-1 text-[10px]"
                                >
                                    {{
                                        invoiceDetailsAuditLogsMeta?.total ??
                                        invoiceDetailsAuditLogs.length
                                    }}
                                </Badge>
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="space-y-4 p-6">
                            <InvoiceDetailsOverviewTab
                                :invoice="invoiceDetailsInvoice"
                                :patient-label="invoicePatientLabel(invoiceDetailsInvoice)"
                                :patient-number="invoicePatientNumber(invoiceDetailsInvoice)"
                                :encounter-context-label="
                                    invoiceEncounterContextLabel(invoiceDetailsInvoice)
                                "
                                :source-label="invoiceSourceLabel(invoiceDetailsInvoice)"
                                :settlement-routing-title="invoiceDetailsSettlementRoutingTitle"
                                :settlement-routing-description="
                                    invoiceDetailsSettlementRoutingDescription
                                "
                                :coverage-posture="invoiceDetailsCoveragePosture"
                                :coverage-metric-badges="invoiceDetailsCoverageMetricBadges"
                                :focus-panel="invoiceDetailsFocusPanel"
                                :action-outcome="invoiceDetailsActionOutcome"
                                :operational-lock-message="
                                    invoiceDetailsOperationalLockMessage
                                "
                                :operational-panel="invoiceDetailsOperationalPanel"
                                :operational-actions="invoiceDetailsOperationalActions"
                                :action-loading-id="actionLoadingId"
                                :financial-snapshot-rows="
                                    invoiceDetailsFinancialSnapshotRows
                                "
                                :finance-posting="invoiceDetailsFinancePosting"
                                :finance-posting-loading="
                                    invoiceDetailsFinancePostingLoading
                                "
                                :finance-posting-error="
                                    invoiceDetailsFinancePostingError
                                "
                                :finance-infrastructure-alert="
                                    invoiceDetailsFinanceInfrastructureAlert
                                "
                                :finance-posting-cards="
                                    invoiceDetailsFinancePostingCards
                                "
                                :format-money="formatMoney"
                                :preview-text="previewText"
                            />

                            <InvoiceDetailsWorkflowsTab
                                :invoice="invoiceDetailsInvoice"
                                :operational-panel="invoiceDetailsOperationalPanel"
                                :coverage-posture="invoiceDetailsCoveragePosture"
                                :workflow-step-cards="invoiceDetailsWorkflowStepCards"
                                :execution-control-cards="
                                    invoiceDetailsExecutionControlCards
                                "
                                :execution-checklist="
                                    invoiceDetailsExecutionChecklist
                                "
                                :ledger-title="invoiceDetailsLedgerTitle"
                                :ledger-description="invoiceDetailsLedgerDescription"
                                :ledger-restricted-title="
                                    invoiceDetailsLedgerRestrictedTitle
                                "
                                :ledger-restricted-description="
                                    invoiceDetailsLedgerRestrictedDescription
                                "
                                :ledger-quick-filters="
                                    invoiceDetailsLedgerQuickFilters
                                "
                                :ledger-date-title="invoiceDetailsLedgerDateTitle"
                                :ledger-date-helper="invoiceDetailsLedgerDateHelper"
                                :ledger-search-placeholder="
                                    invoiceDetailsLedgerSearchPlaceholder
                                "
                                :ledger-snapshot-cards="
                                    invoiceDetailsLedgerSnapshotCards
                                "
                                :ledger-active-filters="
                                    invoiceDetailsLedgerActiveFilters
                                "
                                :ledger-empty-state-label="
                                    invoiceDetailsLedgerEmptyStateLabel
                                "
                                :ledger-entry-label="
                                    invoiceDetailsLedgerEntryLabel
                                "
                                :can-view-billing-payment-history="
                                    canViewBillingPaymentHistory
                                "
                                :payments-meta="invoiceDetailsPaymentsMeta"
                                :payments-loading="invoiceDetailsPaymentsLoading"
                                :payments-error="invoiceDetailsPaymentsError"
                                :payments="invoiceDetailsPayments"
                                :payments-filters="invoiceDetailsPaymentsFilters"
                                :payments-filters-open="
                                    invoiceDetailsPaymentsFiltersOpen
                                "
                                :payment-reversal-submitting="
                                    paymentReversalSubmitting
                                "
                                :workflow-links="invoiceDetailsWorkflowLinks"
                                :format-money="formatMoney"
                                :preview-text="previewText"
                                :short-id="shortId"
                                :billing-payment-can-be-reversed="
                                    billingPaymentCanBeReversed
                                "
                                @refresh-payments="refreshInvoiceDetailsPayments"
                                @toggle-payments-filters="
                                    toggleInvoiceDetailsPaymentsFilters
                                "
                                @submit-payments-filters="
                                    submitInvoiceDetailsPaymentsFilters
                                "
                                @reset-payments-filters="
                                    resetInvoiceDetailsPaymentsFilters()
                                "
                                @apply-quick-filter="applyInvoiceDetailsPaymentQuickFilter"
                                @open-payment-reversal="openPaymentReversalDialog"
                            />

                            <InvoiceDetailsAuditTab
                                :can-view-billing-invoice-audit-logs="
                                    canViewBillingInvoiceAuditLogs
                                "
                                :audit-summary="invoiceDetailsAuditSummary"
                                :audit-has-active-filters="
                                    invoiceDetailsAuditHasActiveFilters
                                "
                                :audit-active-filters="
                                    invoiceDetailsAuditActiveFilters
                                "
                                :audit-filters-open="invoiceDetailsAuditFiltersOpen"
                                :audit-logs-filters="invoiceDetailsAuditLogsFilters"
                                :audit-logs-loading="invoiceDetailsAuditLogsLoading"
                                :audit-logs-exporting="
                                    invoiceDetailsAuditLogsExporting
                                "
                                :audit-logs-error="invoiceDetailsAuditLogsError"
                                :audit-logs="invoiceDetailsAuditLogs"
                                :audit-logs-meta="invoiceDetailsAuditLogsMeta"
                                :audit-export-jobs-filters="
                                    invoiceDetailsAuditExportJobsFilters
                                "
                                :audit-export-jobs-loading="
                                    invoiceDetailsAuditExportJobsLoading
                                "
                                :audit-export-jobs-error="
                                    invoiceDetailsAuditExportJobsError
                                "
                                :audit-export-jobs="invoiceDetailsAuditExportJobs"
                                :audit-export-jobs-meta="
                                    invoiceDetailsAuditExportJobsMeta
                                "
                                :audit-export-job-summary="
                                    invoiceDetailsAuditExportJobSummary
                                "
                                :audit-export-ops-hint="
                                    invoiceDetailsAuditExportOpsHint
                                "
                                :audit-export-handoff-message="
                                    invoiceDetailsAuditExportHandoffMessage
                                "
                                :audit-export-handoff-error="
                                    invoiceDetailsAuditExportHandoffError
                                "
                                :audit-export-pinned-handoff-job="
                                    invoiceDetailsAuditExportPinnedHandoffJob
                                "
                                :audit-export-focus-job-id="
                                    invoiceDetailsAuditExportFocusJobId
                                "
                                :audit-export-retrying-job-id="
                                    invoiceDetailsAuditExportRetryingJobId
                                "
                                :audit-log-action-label="auditLogActionLabel"
                                :audit-log-actor-label="auditLogActorLabel"
                                :audit-actor-type-label="
                                    invoiceDetailsAuditActorTypeLabel
                                "
                                :audit-change-summary="
                                    invoiceDetailsAuditChangeSummary
                                "
                                :audit-change-keys="invoiceDetailsAuditChangeKeys"
                                :audit-metadata-preview="
                                    invoiceDetailsAuditMetadataPreview
                                "
                                :audit-log-entries="auditLogEntries"
                                :format-audit-log-json="formatAuditLogJson"
                                :is-audit-log-expanded="
                                    isInvoiceDetailsAuditLogExpanded
                                "
                                @refresh-audit-logs="refreshInvoiceDetailsAuditLogs"
                                @toggle-audit-filters="
                                    toggleInvoiceDetailsAuditFilters
                                "
                                @submit-audit-logs-filters="
                                    submitInvoiceDetailsAuditLogsFilters
                                "
                                @reset-audit-logs-filters="
                                    resetInvoiceDetailsAuditLogsFilters()
                                "
                                @export-audit-logs-csv="exportInvoiceAuditLogsCsv"
                                @refresh-audit-export-jobs="
                                    refreshInvoiceAuditExportJobs
                                "
                                @submit-audit-export-jobs-filters="
                                    submitInvoiceDetailsAuditExportJobsFilters
                                "
                                @reset-audit-export-jobs-filters="
                                    resetInvoiceDetailsAuditExportJobsFilters()
                                "
                                @download-audit-export-job="
                                    downloadInvoiceAuditExportJob
                                "
                                @retry-audit-export-job="
                                    retryInvoiceAuditExportJob
                                "
                                @prev-audit-export-jobs-page="
                                    prevInvoiceDetailsAuditExportJobsPage
                                "
                                @next-audit-export-jobs-page="
                                    nextInvoiceDetailsAuditExportJobsPage
                                "
                                @toggle-audit-log-expanded="
                                    toggleInvoiceDetailsAuditLogExpanded
                                "
                                @prev-audit-logs-page="
                                    prevInvoiceDetailsAuditLogsPage
                                "
                                @next-audit-logs-page="
                                    nextInvoiceDetailsAuditLogsPage
                                "
                            />
                        </div>
                    </ScrollArea>
                </Tabs>
            </div>
            <div v-else class="flex min-h-0 flex-1 items-center justify-center p-6">
                <div class="w-full max-w-md space-y-3">
                    <Skeleton class="h-24 w-full" />
                    <Skeleton class="h-24 w-full" />
                    <Skeleton class="h-24 w-full" />
                </div>
            </div>

            <SheetFooter
                class="shrink-0 border-t bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            >
                <div class="flex w-full items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <Button variant="outline" size="sm" @click="closeInvoiceDetailsSheet">
                            Close
                        </Button>
                    </div>
                    <div class="flex items-center gap-2">
                        <Button
                            v-if="invoiceDetailsInvoice"
                            variant="outline"
                            size="sm"
                            class="gap-1.5"
                            @click="printCurrentInvoice"
                        >
                            <AppIcon name="file-text" class="size-3.5" />
                            Print Invoice
                        </Button>
                        <Button
                            v-if="
                                invoiceDetailsPrimaryOperationalAction &&
                                invoiceDetailsPrimaryOperationalAction.href
                            "
                            :variant="
                                invoiceDetailsPrimaryOperationalAction.variant ||
                                'default'
                            "
                            size="sm"
                            class="gap-1.5"
                            as-child
                        >
                            <Link :href="invoiceDetailsPrimaryOperationalAction.href">
                                <AppIcon
                                    v-if="invoiceDetailsPrimaryOperationalAction.icon"
                                    :name="invoiceDetailsPrimaryOperationalAction.icon"
                                    class="size-3.5"
                                />
                                {{ invoiceDetailsPrimaryOperationalAction.label }}
                            </Link>
                        </Button>
                        <Button
                            v-else-if="invoiceDetailsPrimaryOperationalAction"
                            :variant="
                                invoiceDetailsPrimaryOperationalAction.variant ||
                                'default'
                            "
                            size="sm"
                            :disabled="actionLoadingId === invoiceDetailsInvoice?.id"
                            class="gap-1.5"
                            @click="
                                invoiceDetailsPrimaryOperationalAction.onClick?.()
                            "
                        >
                            <AppIcon
                                v-if="invoiceDetailsPrimaryOperationalAction.icon"
                                :name="invoiceDetailsPrimaryOperationalAction.icon"
                                class="size-3.5"
                            />
                            {{ invoiceDetailsPrimaryOperationalAction.label }}
                        </Button>
                    </div>
                </div>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
