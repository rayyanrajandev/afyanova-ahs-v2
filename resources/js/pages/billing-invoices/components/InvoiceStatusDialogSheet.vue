<script setup lang="ts">
import { toRef } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { billingPaymentMethodOptions, billingPaymentPayerTypeOptions } from '../constants';
import { formatDateTime } from '../helpers';

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

const statusDialogOpen = toRef(state, 'statusDialogOpen');
const statusDialogInvoice = toRef(state, 'statusDialogInvoice');
const statusDialogAction = toRef(state, 'statusDialogAction');
const statusDialogReason = toRef(state, 'statusDialogReason');
const statusDialogPaidAmount = toRef(state, 'statusDialogPaidAmount');
const statusDialogPaymentPayerType = toRef(
    state,
    'statusDialogPaymentPayerType',
);
const statusDialogPaymentMethod = toRef(state, 'statusDialogPaymentMethod');
const statusDialogPaymentReference = toRef(
    state,
    'statusDialogPaymentReference',
);
const statusDialogPaymentNote = toRef(state, 'statusDialogPaymentNote');
const statusDialogPaymentAtDate = toRef(state, 'statusDialogPaymentAtDate');
const statusDialogPaymentAtTime = toRef(state, 'statusDialogPaymentAtTime');
const statusDialogAdvancedSupportOpen = toRef(
    state,
    'statusDialogAdvancedSupportOpen',
);
const statusDialogReferenceDiagnosticsOpen = toRef(
    state,
    'statusDialogReferenceDiagnosticsOpen',
);
const statusDialogReferenceCopyToolsOpen = toRef(
    state,
    'statusDialogReferenceCopyToolsOpen',
);
const billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget = toRef(
    state,
    'billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget',
);

const actionLoadingId = view.actionLoadingId;
const billingClaimReferenceMergePreviewCopyChunkTargetBytes = view.billingClaimReferenceMergePreviewCopyChunkTargetBytes;
const billingClaimReferenceMergePreviewFullPreservedKeysChunkError = view.billingClaimReferenceMergePreviewFullPreservedKeysChunkError;
const billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage = view.billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage;
const billingClaimReferenceMergePreviewFullPreservedKeysError = view.billingClaimReferenceMergePreviewFullPreservedKeysError;
const billingClaimReferenceMergePreviewFullPreservedKeysJsonError = view.billingClaimReferenceMergePreviewFullPreservedKeysJsonError;
const billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage = view.billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage;
const billingClaimReferenceMergePreviewFullPreservedKeysMessage = view.billingClaimReferenceMergePreviewFullPreservedKeysMessage;
const billingClaimReferenceMergePreviewPreservedKeysPreviewLimit = view.billingClaimReferenceMergePreviewPreservedKeysPreviewLimit;
const billingClaimReferenceOverrideEnvelopeError = view.billingClaimReferenceOverrideEnvelopeError;
const billingClaimReferenceOverrideEnvelopeMessage = view.billingClaimReferenceOverrideEnvelopeMessage;
const billingClaimReferenceOverrideMergeSafeEnvError = view.billingClaimReferenceOverrideMergeSafeEnvError;
const billingClaimReferenceOverrideMergeSafeEnvMessage = view.billingClaimReferenceOverrideMergeSafeEnvMessage;
const billingClaimReferenceOverrideShellExportsError = view.billingClaimReferenceOverrideShellExportsError;
const billingClaimReferenceOverrideShellExportsMessage = view.billingClaimReferenceOverrideShellExportsMessage;
const billingClaimReferenceOverrideSnippetError = view.billingClaimReferenceOverrideSnippetError;
const billingClaimReferenceOverrideSnippetMessage = view.billingClaimReferenceOverrideSnippetMessage;
const billingClaimReferenceTelemetrySnapshotError = view.billingClaimReferenceTelemetrySnapshotError;
const billingClaimReferenceTelemetrySnapshotMessage = view.billingClaimReferenceTelemetrySnapshotMessage;
const billingClaimReferenceValidationPolicy = view.billingClaimReferenceValidationPolicy;
const billingClaimReferenceValidationTelemetry = view.billingClaimReferenceValidationTelemetry;
const billingClaimReferenceValidationTelemetryInactivityMinutes = view.billingClaimReferenceValidationTelemetryInactivityMinutes;
const billingClaimReferenceValidationTelemetryMaxSessionAgeHours = view.billingClaimReferenceValidationTelemetryMaxSessionAgeHours;
const billingClaimReferenceValidationTelemetryWindowMinutes = view.billingClaimReferenceValidationTelemetryWindowMinutes;
const copyingBillingClaimReferenceMergePreviewFullPreservedKeys = view.copyingBillingClaimReferenceMergePreviewFullPreservedKeys;
const copyingBillingClaimReferenceMergePreviewFullPreservedKeysChunk = view.copyingBillingClaimReferenceMergePreviewFullPreservedKeysChunk;
const copyingBillingClaimReferenceMergePreviewFullPreservedKeysJson = view.copyingBillingClaimReferenceMergePreviewFullPreservedKeysJson;
const copyingBillingClaimReferenceOverrideEnvelope = view.copyingBillingClaimReferenceOverrideEnvelope;
const copyingBillingClaimReferenceOverrideMergeSafeEnv = view.copyingBillingClaimReferenceOverrideMergeSafeEnv;
const copyingBillingClaimReferenceOverrideShellExports = view.copyingBillingClaimReferenceOverrideShellExports;
const copyingBillingClaimReferenceOverrideSnippet = view.copyingBillingClaimReferenceOverrideSnippet;
const copyingBillingClaimReferenceTelemetrySnapshot = view.copyingBillingClaimReferenceTelemetrySnapshot;
const statusDialogAmountHelper = view.statusDialogAmountHelper;
const statusDialogClaimReferenceFormatHint = view.statusDialogClaimReferenceFormatHint;
const statusDialogClaimReferenceFormatInvalid = view.statusDialogClaimReferenceFormatInvalid;
const statusDialogClaimReferenceFrequentFailureHint = view.statusDialogClaimReferenceFrequentFailureHint;
const statusDialogClaimReferenceRequired = view.statusDialogClaimReferenceRequired;
const statusDialogClaimReferenceTelemetryEnvDiagnosticMessages = view.statusDialogClaimReferenceTelemetryEnvDiagnosticMessages;
const statusDialogClaimReferenceTelemetryHasData = view.statusDialogClaimReferenceTelemetryHasData;
const statusDialogClaimReferenceTelemetryLastFailureLabel = view.statusDialogClaimReferenceTelemetryLastFailureLabel;
const statusDialogClaimReferenceTelemetryLastFailureReasonLabel = view.statusDialogClaimReferenceTelemetryLastFailureReasonLabel;
const statusDialogClaimReferenceTelemetryLastUpdatedLabel = view.statusDialogClaimReferenceTelemetryLastUpdatedLabel;
const statusDialogClaimReferenceTelemetryOverrideBashExportLine = view.statusDialogClaimReferenceTelemetryOverrideBashExportLine;
const statusDialogClaimReferenceTelemetryOverrideCoverageSummary = view.statusDialogClaimReferenceTelemetryOverrideCoverageSummary;
const statusDialogClaimReferenceTelemetryOverrideEnvLine = view.statusDialogClaimReferenceTelemetryOverrideEnvLine;
const statusDialogClaimReferenceTelemetryOverrideGuidance = view.statusDialogClaimReferenceTelemetryOverrideGuidance;
const statusDialogClaimReferenceTelemetryOverrideMergePreview = view.statusDialogClaimReferenceTelemetryOverrideMergePreview;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtFirstBoundary = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtFirstBoundary;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtLastBoundary = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtLastBoundary;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkBytesPreviewLabel = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkBytesPreviewLabel;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentBytes = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentBytes;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentIndex = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentIndex;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextBytes = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextBytes;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextIndex = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextIndex;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkQuickJumpVisible = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkQuickJumpVisible;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysLabel = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysLabel;
const statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysOmittedCount = view.statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysOmittedCount;
const statusDialogClaimReferenceTelemetryOverrideMergeSafeEnvLine = view.statusDialogClaimReferenceTelemetryOverrideMergeSafeEnvLine;
const statusDialogClaimReferenceTelemetryOverrideMergeSafeParseWarning = view.statusDialogClaimReferenceTelemetryOverrideMergeSafeParseWarning;
const statusDialogClaimReferenceTelemetryOverrideMergeTemplateWithPlaceholder = view.statusDialogClaimReferenceTelemetryOverrideMergeTemplateWithPlaceholder;
const statusDialogClaimReferenceTelemetryOverridePowerShellExportLine = view.statusDialogClaimReferenceTelemetryOverridePowerShellExportLine;
const statusDialogClaimReferenceTelemetryOverrideResolutionSummary = view.statusDialogClaimReferenceTelemetryOverrideResolutionSummary;
const statusDialogClaimReferenceTelemetryOverridesParseDiagnosticMessage = view.statusDialogClaimReferenceTelemetryOverridesParseDiagnosticMessage;
const statusDialogClaimReferenceTelemetryOverridesQualityDiagnosticMessages = view.statusDialogClaimReferenceTelemetryOverridesQualityDiagnosticMessages;
const statusDialogClaimReferenceTelemetryOverrideTargetSuggestions = view.statusDialogClaimReferenceTelemetryOverrideTargetSuggestions;
const statusDialogClaimReferenceTelemetryPayerFailures = view.statusDialogClaimReferenceTelemetryPayerFailures;
const statusDialogClaimReferenceTelemetryPolicySourceSummary = view.statusDialogClaimReferenceTelemetryPolicySourceSummary;
const statusDialogClaimReferenceTelemetryProfileNormalizationSummary = view.statusDialogClaimReferenceTelemetryProfileNormalizationSummary;
const statusDialogClaimReferenceTelemetryProfilePrecedenceSummary = view.statusDialogClaimReferenceTelemetryProfilePrecedenceSummary;
const statusDialogClaimReferenceTelemetryProfileProvenanceSummary = view.statusDialogClaimReferenceTelemetryProfileProvenanceSummary;
const statusDialogClaimReferenceTelemetryProfileSelectionMismatchMessage = view.statusDialogClaimReferenceTelemetryProfileSelectionMismatchMessage;
const statusDialogClaimReferenceTelemetryReasonCounts = view.statusDialogClaimReferenceTelemetryReasonCounts;
const statusDialogClaimReferenceTelemetryRecentWindowFailures = view.statusDialogClaimReferenceTelemetryRecentWindowFailures;
const statusDialogClaimReferenceTelemetrySessionStartedLabel = view.statusDialogClaimReferenceTelemetrySessionStartedLabel;
const statusDialogClaimReferenceTemplateLike = view.statusDialogClaimReferenceTemplateLike;
const statusDialogCurrencyCode = view.statusDialogCurrencyCode;
const statusDialogDescription = view.statusDialogDescription;
const statusDialogError = view.statusDialogError;
const statusDialogExecutionPreviewCards = view.statusDialogExecutionPreviewCards;
const statusDialogInsuranceClaimMethodHint = view.statusDialogInsuranceClaimMethodHint;
const statusDialogLastActivityLabel = view.statusDialogLastActivityLabel;
const statusDialogNeedsReason = view.statusDialogNeedsReason;
const statusDialogOperationBadgeLabel = view.statusDialogOperationBadgeLabel;
const statusDialogOutstandingAmount = view.statusDialogOutstandingAmount;
const statusDialogPaidAmountFieldLabel = view.statusDialogPaidAmountFieldLabel;
const statusDialogPaidAmountRequired = view.statusDialogPaidAmountRequired;
const statusDialogPaymentAtFieldLabel = view.statusDialogPaymentAtFieldLabel;
const statusDialogPaymentMethodFieldLabel = view.statusDialogPaymentMethodFieldLabel;
const statusDialogPaymentMethodSmartDefaultHint = view.statusDialogPaymentMethodSmartDefaultHint;
const statusDialogPaymentNoteFieldLabel = view.statusDialogPaymentNoteFieldLabel;
const statusDialogPaymentNoteHelper = view.statusDialogPaymentNoteHelper;
const statusDialogPaymentNotePlaceholder = view.statusDialogPaymentNotePlaceholder;
const statusDialogPaymentPayerTypeFieldLabel = view.statusDialogPaymentPayerTypeFieldLabel;
const statusDialogPaymentPayerTypeHelper = view.statusDialogPaymentPayerTypeHelper;
const statusDialogPaymentReferenceControlHint = view.statusDialogPaymentReferenceControlHint;
const statusDialogPaymentReferenceFieldLabel = view.statusDialogPaymentReferenceFieldLabel;
const statusDialogPaymentReferenceHelper = view.statusDialogPaymentReferenceHelper;
const statusDialogPaymentReferencePlaceholder = view.statusDialogPaymentReferencePlaceholder;
const statusDialogPaymentReferenceRequired = view.statusDialogPaymentReferenceRequired;
const statusDialogPaymentReferenceSkeletonChips = view.statusDialogPaymentReferenceSkeletonChips;
const statusDialogPaymentReferenceSkeletonHelper = view.statusDialogPaymentReferenceSkeletonHelper;
const statusDialogPaymentRouteQuickActionLabel = view.statusDialogPaymentRouteQuickActionLabel;
const statusDialogPaymentRouteQuickActions = view.statusDialogPaymentRouteQuickActions;
const statusDialogPaymentSectionTitle = view.statusDialogPaymentSectionTitle;
const statusDialogProjectedBalance = view.statusDialogProjectedBalance;
const statusDialogProjectedPaidAmount = view.statusDialogProjectedPaidAmount;
const statusDialogReasonSectionTitle = view.statusDialogReasonSectionTitle;
const statusDialogReferenceCopyToolsLabel = view.statusDialogReferenceCopyToolsLabel;
const statusDialogReferenceDiagnosticsDescription = view.statusDialogReferenceDiagnosticsDescription;
const statusDialogReferenceDiagnosticsLabel = view.statusDialogReferenceDiagnosticsLabel;
const statusDialogReferenceSupportDescription = view.statusDialogReferenceSupportDescription;
const statusDialogReferenceSupportLabel = view.statusDialogReferenceSupportLabel;
const statusDialogRouteControlCards = view.statusDialogRouteControlCards;
const statusDialogSettlementBadgeLabel = view.statusDialogSettlementBadgeLabel;
const statusDialogSettlementBadgeVariant = view.statusDialogSettlementBadgeVariant;
const statusDialogSettlementNoticeLines = view.statusDialogSettlementNoticeLines;
const statusDialogSettlementNoticeVariant = view.statusDialogSettlementNoticeVariant;
const statusDialogSettlementSectionDescription = view.statusDialogSettlementSectionDescription;
const statusDialogSettlementSectionTitle = view.statusDialogSettlementSectionTitle;
const statusDialogSettlementSummaryRows = view.statusDialogSettlementSummaryRows;
const statusDialogShowsPaidAmount = view.statusDialogShowsPaidAmount;
const statusDialogSubmitButtonLabel = view.statusDialogSubmitButtonLabel;
const statusDialogSubmitLoadingLabel = view.statusDialogSubmitLoadingLabel;
const statusDialogTitle = view.statusDialogTitle;
const statusDialogUsesThirdPartySettlement = view.statusDialogUsesThirdPartySettlement;

const closeInvoiceStatusDialog = actions.closeInvoiceStatusDialog;
const submitInvoiceStatusDialog = actions.submitInvoiceStatusDialog;
const applyStatusDialogPaymentRouteQuickAction = actions.applyStatusDialogPaymentRouteQuickAction;
const fillStatusDialogPaidAmountQuick = actions.fillStatusDialogPaidAmountQuick;
const applyStatusDialogPaymentReferenceSkeleton = actions.applyStatusDialogPaymentReferenceSkeleton;
const copyBillingClaimReferenceTelemetrySnapshot = actions.copyBillingClaimReferenceTelemetrySnapshot;
const copyBillingClaimReferenceOverrideSnippet = actions.copyBillingClaimReferenceOverrideSnippet;
const copyBillingClaimReferenceOverrideEnvelope = actions.copyBillingClaimReferenceOverrideEnvelope;
const copyBillingClaimReferenceOverrideShellExports = actions.copyBillingClaimReferenceOverrideShellExports;
const copyBillingClaimReferenceOverrideMergeSafeEnv = actions.copyBillingClaimReferenceOverrideMergeSafeEnv;
const copyBillingClaimReferenceMergePreviewFullPreservedKeys = actions.copyBillingClaimReferenceMergePreviewFullPreservedKeys;
const copyBillingClaimReferenceMergePreviewFullPreservedKeysJson = actions.copyBillingClaimReferenceMergePreviewFullPreservedKeysJson;
const copyBillingClaimReferenceMergePreviewFullPreservedKeysChunk = actions.copyBillingClaimReferenceMergePreviewFullPreservedKeysChunk;
const resetBillingClaimReferenceMergePreviewFullPreservedKeysChunkCursor = actions.resetBillingClaimReferenceMergePreviewFullPreservedKeysChunkCursor;
const jumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk = actions.jumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk;
const quickJumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk = actions.quickJumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk;
const resetBillingClaimReferenceValidationTelemetry = actions.resetBillingClaimReferenceValidationTelemetry;

const formatMoney = helpers.formatMoney;
const shortId = helpers.shortId;
</script>

<template>
            <Sheet
                :open="statusDialogOpen"
                @update:open="
                    (open) =>
                        open
                            ? (statusDialogOpen = true)
                            : closeInvoiceStatusDialog()
                "
            >
                <SheetContent side="right" variant="workspace" size="6xl">
                    <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <SheetTitle class="flex items-center gap-2">
                                    <span>{{ statusDialogTitle }}</span>
                                    <Badge variant="outline" class="text-[11px]">
                                        {{ statusDialogOperationBadgeLabel }}
                                    </Badge>
                                </SheetTitle>
                                <SheetDescription class="mt-1">{{ statusDialogDescription }}</SheetDescription>
                            </div>
                            <Badge v-if="statusDialogInvoice" variant="outline" class="shrink-0 font-mono text-xs">
                                {{ statusDialogInvoice.invoiceNumber || shortId(statusDialogInvoice.id) }}
                            </Badge>
                        </div>
                        <div v-if="statusDialogInvoice" class="grid grid-cols-4 gap-2">
                            <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                                <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total</p>
                                <p class="text-sm font-bold tabular-nums text-foreground">
                                    {{ formatMoney(statusDialogInvoice.totalAmount, statusDialogInvoice.currencyCode) }}
                                </p>
                            </div>
                            <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                                <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Paid</p>
                                <p class="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                    {{ formatMoney(statusDialogInvoice.paidAmount, statusDialogInvoice.currencyCode) }}
                                </p>
                            </div>
                            <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                                <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Outstanding</p>
                                <p class="text-sm font-bold tabular-nums" :class="statusDialogOutstandingAmount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'">
                                    {{ formatMoney(statusDialogOutstandingAmount, statusDialogCurrencyCode) }}
                                </p>
                            </div>
                            <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                                <p class="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    {{ statusDialogInvoice.lastPaymentReference ? statusDialogLastActivityLabel : 'Currency' }}
                                </p>
                                <p class="truncate text-sm font-bold tabular-nums text-foreground">
                                    {{ statusDialogInvoice.lastPaymentReference || statusDialogInvoice.currencyCode || 'N/A' }}
                                </p>
                            </div>
                        </div>
                    </SheetHeader>

                    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                        <div class="space-y-3">

                        <div
                            v-if="statusDialogSettlementSummaryRows.length"
                            class="space-y-3 rounded-lg border p-4"
                        >
                            <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <p class="text-sm font-medium">
                                        {{ statusDialogSettlementSectionTitle }}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ statusDialogSettlementSectionDescription }}
                                    </p>
                                </div>
                                <Badge :variant="statusDialogSettlementBadgeVariant">
                                    {{ statusDialogSettlementBadgeLabel }}
                                </Badge>
                            </div>
                            <div class="grid gap-3 md:grid-cols-3">
                                <div
                                    v-for="row in statusDialogSettlementSummaryRows"
                                    :key="`billing-status-settlement-${row.key}`"
                                    class="rounded-lg bg-muted/30 p-3"
                                >
                                    <p class="text-[11px] uppercase tracking-wide text-muted-foreground">
                                        {{ row.title }}
                                    </p>
                                    <p class="mt-1 text-sm font-medium text-foreground">
                                        {{ row.value }}
                                    </p>
                                </div>
                            </div>
                            <Alert
                                v-if="statusDialogSettlementNoticeLines.length > 0"
                                :variant="statusDialogSettlementNoticeVariant"
                                class="py-2"
                            >
                                <AlertDescription class="space-y-1 text-sm leading-5">
                                    <p
                                        v-for="line in statusDialogSettlementNoticeLines"
                                        :key="`billing-status-settlement-note-${line}`"
                                    >
                                        {{ line }}
                                    </p>
                                </AlertDescription>
                            </Alert>
                        </div>

                        <div
                            v-if="statusDialogExecutionPreviewCards.length"
                            class="grid gap-2 md:grid-cols-2 md:items-start xl:grid-cols-4"
                        >
                            <div
                                v-for="card in statusDialogExecutionPreviewCards"
                                :key="`billing-status-execution-${card.title}`"
                                class="rounded-lg bg-background/80 p-3"
                            >
                                <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                    {{ card.title }}
                                </p>
                                <p
                                    class="mt-2 text-sm font-semibold"
                                    :class="card.valueClass ?? 'text-foreground'"
                                >
                                    {{ card.value }}
                                </p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{ card.helper }}
                                </p>
                            </div>
                        </div>

                        <div
                            v-if="statusDialogRouteControlCards.length"
                            class="rounded-lg border p-3"
                        >
                            <div class="flex items-center justify-between gap-2">
                                <p class="text-sm font-medium">Route control</p>
                                <Badge variant="outline" class="rounded-lg">
                                    Route-aware
                                </Badge>
                            </div>
                            <div class="mt-3 grid gap-2 md:grid-cols-2 md:items-start xl:grid-cols-4">
                                <div
                                    v-for="card in statusDialogRouteControlCards"
                                    :key="`billing-status-route-control-${card.title}`"
                                    class="rounded-lg bg-muted/30 p-3"
                                >
                                    <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                        {{ card.title }}
                                    </p>
                                    <p
                                        class="mt-2 text-sm font-semibold"
                                        :class="card.valueClass ?? 'text-foreground'"
                                    >
                                        {{ card.value }}
                                    </p>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        {{ card.helper }}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div v-if="statusDialogShowsPaidAmount" class="space-y-3 rounded-lg border p-4">
                            <p class="text-sm font-medium">{{ statusDialogPaymentSectionTitle }}</p>

                            <div class="space-y-2 rounded-lg bg-muted/30 p-3">
                                <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                    {{ statusDialogPaymentRouteQuickActionLabel }}
                                </p>
                                <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                    <button
                                        v-for="route in statusDialogPaymentRouteQuickActions"
                                        :key="`status-dialog-route-${route.key}`"
                                        type="button"
                                        class="rounded-lg border px-3 py-2 text-left transition-colors"
                                        :class="
                                            statusDialogPaymentPayerType === route.payerType &&
                                            statusDialogPaymentMethod === route.paymentMethod
                                                ? 'border-primary/40 bg-primary/5 shadow-sm'
                                                : 'border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20'
                                        "
                                        @click="
                                            applyStatusDialogPaymentRouteQuickAction(
                                                route.payerType,
                                                route.paymentMethod,
                                            )
                                        "
                                    >
                                        <p class="text-sm font-medium text-foreground">
                                            {{ route.label }}
                                        </p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{ route.helper }}
                                        </p>
                                    </button>
                                </div>
                            </div>

                            <div class="space-y-3 rounded-lg bg-muted/30 p-3">
                            <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Amount and posting effect</p>
                            <div class="grid gap-2">
                            <Label for="billing-status-paid-amount">
                                {{ statusDialogPaidAmountFieldLabel }}
                            </Label>
                            <Input
                                id="billing-status-paid-amount"
                                v-model="statusDialogPaidAmount"
                                type="number"
                                min="0"
                                step="0.01"
                                :placeholder="
                                    statusDialogPaidAmountRequired
                                        ? 'Required'
                                        : 'Leave blank to auto-set full total'
                                "
                            />
                            <p
                                v-if="statusDialogAmountHelper"
                                class="text-xs text-muted-foreground"
                            >
                                {{ statusDialogAmountHelper }}
                            </p>
                            <div class="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    @click="fillStatusDialogPaidAmountQuick('current')"
                                >
                                    Use Current Paid
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    @click="fillStatusDialogPaidAmountQuick('outstanding')"
                                >
                                    Add Outstanding
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    type="button"
                                    @click="fillStatusDialogPaidAmountQuick('full')"
                                >
                                    Use Full Total
                                </Button>
                            </div>
                            <div
                                class="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground"
                            >
                                <p>
                                    Projected Paid:
                                    <span class="font-medium text-foreground">
                                        {{
                                            formatMoney(
                                                statusDialogProjectedPaidAmount,
                                                statusDialogCurrencyCode,
                                            )
                                        }}
                                    </span>
                                </p>
                                <p>
                                    Projected Balance:
                                    <span
                                        class="font-medium"
                                        :class="
                                            statusDialogProjectedBalance !== null &&
                                            statusDialogProjectedBalance > 0
                                                ? 'text-amber-600 dark:text-amber-300'
                                                : 'text-foreground'
                                        "
                                    >
                                        {{
                                            formatMoney(
                                                statusDialogProjectedBalance,
                                                statusDialogCurrencyCode,
                                            )
                                        }}
                                    </span>
                                </p>
                                <p
                                    v-if="
                                        (statusDialogAction === 'record_payment' ||
                                            statusDialogAction === 'partially_paid') &&
                                        statusDialogProjectedBalance !== null &&
                                        statusDialogProjectedBalance <= 0
                                    "
                                    class="mt-1 text-amber-700 dark:text-amber-300"
                                >
                                    This payment fully settles the invoice. Status will update to
                                    <span class="font-medium">Paid</span>
                                    automatically.
                                </p>
                            </div>
                        </div>
                        </div>

                            <div class="space-y-3 rounded-lg bg-muted/30 p-3">
                            <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Posting controls</p>
                            <div class="grid gap-3 sm:grid-cols-2">
                            <div class="grid gap-2">
                                <Label for="billing-status-payment-payer-type">
                                    {{ statusDialogPaymentPayerTypeFieldLabel }}
                                </Label>
                                <Select
                                    :model-value="statusDialogPaymentPayerType || 'unselected'"
                                    @update:model-value="
                                        statusDialogPaymentPayerType =
                                            $event === 'unselected' ? '' : String($event ?? '')
                                    "
                                >
                                    <SelectTrigger id="billing-status-payment-payer-type" class="w-full">
                                        <SelectValue placeholder="Select payer type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unselected">
                                            Select payer type
                                        </SelectItem>
                                        <SelectItem
                                        v-for="option in billingPaymentPayerTypeOptions"
                                        :key="`payer-type-${option.value}`"
                                        :value="option.value"
                                        >
                                            {{ option.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p
                                    v-if="statusDialogPaymentPayerTypeHelper"
                                    class="text-xs text-muted-foreground"
                                >
                                    {{ statusDialogPaymentPayerTypeHelper }}
                                </p>
                                <p
                                    v-if="statusDialogUsesThirdPartySettlement"
                                    class="text-xs text-muted-foreground"
                                >
                                    Third-party route: record payer remittance here. Patient cash collections happen in
                                    cashier workflow, not in this settlement step.
                                </p>
                            </div>
                            <div class="grid gap-2">
                                <Label for="billing-status-payment-method">
                                    {{ statusDialogPaymentMethodFieldLabel }}
                                </Label>
                                <Select
                                    :model-value="statusDialogPaymentMethod || 'unselected'"
                                    @update:model-value="
                                        statusDialogPaymentMethod =
                                            $event === 'unselected' ? '' : String($event ?? '')
                                    "
                                >
                                    <SelectTrigger id="billing-status-payment-method" class="w-full">
                                        <SelectValue placeholder="Select payment method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unselected">
                                            Select payment method
                                        </SelectItem>
                                        <SelectItem
                                        v-for="option in billingPaymentMethodOptions"
                                        :key="`payment-method-${option.value}`"
                                        :value="option.value"
                                        >
                                            {{ option.label }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p
                                    v-if="statusDialogPaymentMethodSmartDefaultHint"
                                    class="text-xs text-muted-foreground"
                                >
                                    {{ statusDialogPaymentMethodSmartDefaultHint }}
                                </p>
                                <p
                                    v-if="statusDialogInsuranceClaimMethodHint"
                                    class="text-xs text-amber-700 dark:text-amber-300"
                                >
                                    {{ statusDialogInsuranceClaimMethodHint }}
                                </p>
                            </div>
                            <div class="grid gap-3 sm:grid-cols-2 sm:col-span-2">
                                <SingleDatePopoverField
                                    input-id="billing-status-payment-date"
                                    v-model="statusDialogPaymentAtDate"
                                    :label="`${statusDialogPaymentAtFieldLabel} Date`"
                                    helper-text="Use the business date for this collection or settlement."
                                />
                                <TimePopoverField
                                    input-id="billing-status-payment-time"
                                    v-model="statusDialogPaymentAtTime"
                                    :label="`${statusDialogPaymentAtFieldLabel} Time`"
                                    helper-text="Defaults to current local time and supports back-entry."
                                />
                            </div>
                            </div>
                            </div>
                            <div class="space-y-3 rounded-lg bg-muted/30 p-3">
                            <p class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Control reference and note</p>
                            <div class="grid gap-3 sm:grid-cols-2">
                            <div class="grid gap-2 sm:col-span-2">
                                <Label for="billing-status-payment-reference">
                                    {{ statusDialogPaymentReferenceFieldLabel }}
                                    <span
                                        v-if="statusDialogPaymentReferenceRequired"
                                        class="text-destructive"
                                    >
                                        *
                                    </span>
                                </Label>
                                <Input
                                    id="billing-status-payment-reference"
                                    v-model="statusDialogPaymentReference"
                                    :placeholder="statusDialogPaymentReferencePlaceholder"
                                />
                                <p
                                    v-if="statusDialogPaymentReferenceHelper"
                                    class="text-xs"
                                    :class="
                                        statusDialogPaymentReferenceRequired
                                            ? 'text-amber-700 dark:text-amber-300'
                                            : 'text-muted-foreground'
                                    "
                                >
                                    {{ statusDialogPaymentReferenceHelper }}
                                </p>
                                <p
                                    v-if="statusDialogPaymentReferenceControlHint"
                                    class="text-xs text-muted-foreground"
                                >
                                    {{ statusDialogPaymentReferenceControlHint }}
                                </p>
                                <p
                                    v-if="statusDialogClaimReferenceFormatHint"
                                    class="text-xs text-muted-foreground"
                                >
                                    {{ statusDialogClaimReferenceFormatHint }}
                                </p>
                                <div
                                    v-if="statusDialogPaymentReferenceSkeletonChips.length > 0"
                                    class="flex flex-wrap items-center gap-2"
                                >
                                    <Button
                                        v-for="chip in statusDialogPaymentReferenceSkeletonChips"
                                        :key="`payment-ref-chip-${chip.label}`"
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        class="h-7 px-2 text-xs"
                                        @click="applyStatusDialogPaymentReferenceSkeleton(chip.value)"
                                    >
                                        {{ chip.label }}
                                    </Button>
                                    <span class="text-xs text-muted-foreground">
                                        {{ statusDialogPaymentReferenceSkeletonHelper }}
                                    </span>
                                </div>
                                <p
                                    v-if="statusDialogClaimReferenceTemplateLike"
                                    class="text-xs text-destructive"
                                >
                                    Reference looks like an unresolved template. Replace with the actual payer-issued control number.
                                </p>
                                <p
                                    v-if="statusDialogClaimReferenceFormatInvalid"
                                    class="text-xs text-destructive"
                                >
                                    Claim/control reference format looks invalid. Use the format hint above.
                                </p>
                                <p
                                    v-if="statusDialogClaimReferenceFrequentFailureHint"
                                    class="text-xs text-amber-700 dark:text-amber-300"
                                >
                                    {{ statusDialogClaimReferenceFrequentFailureHint }}
                                </p>
                                <div
                                    v-if="statusDialogClaimReferenceRequired"
                                    class="sm:col-span-2"
                                >
                                    <div class="rounded-lg border p-3">
                                        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <p class="font-medium text-foreground">
                                                    Reference support
                                                </p>
                                                <p class="mt-1 text-xs text-muted-foreground">
                                                    {{ statusDialogReferenceSupportDescription }}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                class="gap-1.5"
                                                @click="
                                                    statusDialogAdvancedSupportOpen =
                                                        !statusDialogAdvancedSupportOpen
                                                "
                                            >
                                                <AppIcon
                                                    :name="
                                                        statusDialogAdvancedSupportOpen
                                                            ? 'chevron-up'
                                                            : 'chevron-down'
                                                    "
                                                    class="size-3.5"
                                                />
                                                {{ statusDialogReferenceSupportLabel }}
                                            </Button>
                                        </div>
                                        <div v-if="statusDialogAdvancedSupportOpen" class="pt-3">
                                            <div class="rounded-lg bg-muted/30 p-3">
                                                <div
                                                    class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                                                >
                                                    <div class="space-y-1">
                                                        <p class="text-sm font-medium text-foreground">
                                                            Troubleshooting diagnostics
                                                        </p>
                                                        <p class="text-xs text-muted-foreground">
                                                            {{ statusDialogReferenceDiagnosticsDescription }}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        class="gap-1.5 self-start"
                                                        @click="
                                                            statusDialogReferenceDiagnosticsOpen =
                                                                !statusDialogReferenceDiagnosticsOpen
                                                        "
                                                    >
                                                        <AppIcon
                                                            :name="
                                                                statusDialogReferenceDiagnosticsOpen
                                                                    ? 'chevron-up'
                                                                    : 'chevron-down'
                                                            "
                                                            class="size-3.5"
                                                        />
                                                        {{ statusDialogReferenceDiagnosticsLabel }}
                                                    </Button>
                                                </div>
                                                <p
                                                    v-if="statusDialogClaimReferenceTelemetryHasData"
                                                    class="mt-3 text-xs text-amber-700 dark:text-amber-300"
                                                >
                                                    Recent reference validation failures were recorded in this session.
                                                </p>
                                                <p
                                                    v-else
                                                    class="mt-3 text-xs text-muted-foreground"
                                                >
                                                    No session failures are recorded right now.
                                                </p>
                                                <p class="mt-2 text-xs text-muted-foreground">
                                                    Detailed diagnostics are scrollable when opened.
                                                </p>
                                                <div
                                                    v-if="statusDialogReferenceDiagnosticsOpen"
                                                    class="pt-3"
                                                >
                                            <div
                                                class="max-h-[360px] overflow-y-auto rounded-md bg-muted/30 p-2 pr-2 text-xs text-muted-foreground"
                                            >
                                    <div class="flex flex-col gap-2">
                                        <div class="flex items-center justify-between gap-2">
                                            <p class="font-medium text-foreground">
                                                Reference Validation (Session)
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                @click="
                                                    statusDialogReferenceCopyToolsOpen =
                                                        !statusDialogReferenceCopyToolsOpen
                                                "
                                            >
                                                {{ statusDialogReferenceCopyToolsLabel }}
                                            </Button>
                                        </div>
                                        <div
                                            v-if="statusDialogReferenceCopyToolsOpen"
                                            class="flex flex-wrap items-center gap-1.5"
                                        >
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                :disabled="
                                                    !statusDialogClaimReferenceTelemetryHasData ||
                                                    copyingBillingClaimReferenceTelemetrySnapshot
                                                "
                                                @click="copyBillingClaimReferenceTelemetrySnapshot"
                                            >
                                                {{
                                                    copyingBillingClaimReferenceTelemetrySnapshot
                                                        ? 'Copying...'
                                                        : 'Copy Snapshot'
                                                }}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                :disabled="
                                                    copyingBillingClaimReferenceOverrideEnvelope
                                                "
                                                @click="copyBillingClaimReferenceOverrideEnvelope"
                                            >
                                                {{
                                                    copyingBillingClaimReferenceOverrideEnvelope
                                                        ? 'Copying...'
                                                        : 'Copy Override Env'
                                                }}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                :disabled="
                                                    copyingBillingClaimReferenceOverrideMergeSafeEnv
                                                "
                                                @click="copyBillingClaimReferenceOverrideMergeSafeEnv"
                                            >
                                                {{
                                                    copyingBillingClaimReferenceOverrideMergeSafeEnv
                                                        ? 'Copying...'
                                                        : 'Copy Merge-safe Env'
                                                }}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                :disabled="
                                                    copyingBillingClaimReferenceMergePreviewFullPreservedKeys ||
                                                    statusDialogClaimReferenceTelemetryOverrideMergePreview
                                                        .preservedProfileCount === 0
                                                "
                                                @click="copyBillingClaimReferenceMergePreviewFullPreservedKeys"
                                            >
                                                {{
                                                    copyingBillingClaimReferenceMergePreviewFullPreservedKeys
                                                        ? 'Copying...'
                                                        : 'Copy Full Keys'
                                                }}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                :disabled="
                                                    copyingBillingClaimReferenceMergePreviewFullPreservedKeysJson ||
                                                    statusDialogClaimReferenceTelemetryOverrideMergePreview
                                                        .preservedProfileCount === 0
                                                "
                                                @click="
                                                    copyBillingClaimReferenceMergePreviewFullPreservedKeysJson
                                                "
                                            >
                                                {{
                                                    copyingBillingClaimReferenceMergePreviewFullPreservedKeysJson
                                                        ? 'Copying...'
                                                        : 'Copy Full Keys JSON'
                                                }}
                                            </Button>
                                            <Button
                                                v-if="
                                                    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible
                                                "
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                :disabled="
                                                    copyingBillingClaimReferenceMergePreviewFullPreservedKeysChunk ||
                                                    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount ===
                                                        0
                                                "
                                                @click="
                                                    copyBillingClaimReferenceMergePreviewFullPreservedKeysChunk
                                                "
                                            >
                                                {{
                                                    copyingBillingClaimReferenceMergePreviewFullPreservedKeysChunk
                                                        ? 'Copying...'
                                                        : 'Copy in Chunks'
                                                }}
                                            </Button>
                                            <Button
                                                v-if="
                                                    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible
                                                "
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                :disabled="
                                                    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount ===
                                                    0
                                                "
                                                @click="
                                                    resetBillingClaimReferenceMergePreviewFullPreservedKeysChunkCursor
                                                "
                                            >
                                                Reset Chunk Cursor
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                :disabled="
                                                    copyingBillingClaimReferenceOverrideShellExports
                                                "
                                                @click="copyBillingClaimReferenceOverrideShellExports"
                                            >
                                                {{
                                                    copyingBillingClaimReferenceOverrideShellExports
                                                        ? 'Copying...'
                                                        : 'Copy Shell Exports'
                                                }}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                :disabled="
                                                    copyingBillingClaimReferenceOverrideSnippet
                                                "
                                                @click="copyBillingClaimReferenceOverrideSnippet"
                                            >
                                                {{
                                                    copyingBillingClaimReferenceOverrideSnippet
                                                        ? 'Copying...'
                                                        : 'Copy Override Snippet'
                                                }}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                class="h-7 px-2 text-xs"
                                                :disabled="!statusDialogClaimReferenceTelemetryHasData"
                                                @click="resetBillingClaimReferenceValidationTelemetry"
                                            >
                                                Reset
                                            </Button>
                                        </div>
                                    </div>
                                    <p class="mt-1">
                                        Recent (last
                                        {{ billingClaimReferenceValidationTelemetryWindowMinutes }}m):
                                        <span class="font-medium text-foreground">
                                            {{ statusDialogClaimReferenceTelemetryRecentWindowFailures }}
                                        </span>
                                        | Total:
                                        <span class="font-medium text-foreground">
                                            {{ billingClaimReferenceValidationTelemetry.totalFailures }}
                                        </span>
                                    </p>
                                    <p>
                                        Missing:
                                        <span class="font-medium text-foreground">
                                            {{ statusDialogClaimReferenceTelemetryReasonCounts.missing }}
                                        </span>
                                        | Template:
                                        <span class="font-medium text-foreground">
                                            {{ statusDialogClaimReferenceTelemetryReasonCounts.template }}
                                        </span>
                                        | Format:
                                        <span class="font-medium text-foreground">
                                            {{ statusDialogClaimReferenceTelemetryReasonCounts.format }}
                                        </span>
                                    </p>
                                    <p v-if="statusDialogClaimReferenceTelemetryPayerFailures > 0">
                                        Current payer failures:
                                        <span class="font-medium text-foreground">
                                            {{ statusDialogClaimReferenceTelemetryPayerFailures }}
                                        </span>
                                    </p>
                                    <p v-if="statusDialogClaimReferenceTelemetryLastFailureLabel">
                                        Last failure:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryLastFailureReasonLabel
                                            }}
                                        </span>
                                        at
                                        <span class="font-medium text-foreground">
                                            {{ statusDialogClaimReferenceTelemetryLastFailureLabel }}
                                        </span>
                                    </p>
                                    <p v-if="statusDialogClaimReferenceTelemetrySessionStartedLabel">
                                        Session started:
                                        <span class="font-medium text-foreground">
                                            {{ statusDialogClaimReferenceTelemetrySessionStartedLabel }}
                                        </span>
                                    </p>
                                    <p v-if="statusDialogClaimReferenceTelemetryLastUpdatedLabel">
                                        Last updated:
                                        <span class="font-medium text-foreground">
                                            {{ statusDialogClaimReferenceTelemetryLastUpdatedLabel }}
                                        </span>
                                    </p>
                                    <p
                                        v-if="!statusDialogClaimReferenceTelemetryHasData"
                                        class="text-xs text-muted-foreground"
                                    >
                                        No validation failures recorded in this session.
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Policy profile:
                                        <span class="font-medium text-foreground">
                                            {{ billingClaimReferenceValidationPolicy.profileKey }}
                                        </span>
                                        .
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Profile provenance:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryProfileProvenanceSummary
                                            }}
                                        </span>
                                        .
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Profile normalization:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryProfileNormalizationSummary
                                            }}
                                        </span>
                                        .
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Profile precedence:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryProfilePrecedenceSummary
                                            }}
                                        </span>
                                        .
                                    </p>
                                    <p class="break-all text-xs text-muted-foreground">
                                        Copy-ready override env line:
                                        <span class="font-mono text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideEnvLine
                                            }}
                                        </span>
                                    </p>
                                    <p class="break-all text-xs text-muted-foreground">
                                        Merge-safe override env line:
                                        <span class="font-mono text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergeSafeEnvLine
                                            }}
                                        </span>
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Merge preview: preserves
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreview.preservedProfileCount
                                            }}
                                        </span>
                                        parsed existing profile entries; selected profile action:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreview.selectedProfileAction
                                            }}
                                        </span>
                                        .
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            statusDialogClaimReferenceTelemetryOverrideMergePreview.selectedProfileConfirmation
                                        }}
                                    </p>
                                    <p class="break-all text-xs text-muted-foreground">
                                        Merge preview preserved profile keys:
                                        <span class="font-mono text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysLabel
                                            }}
                                        </span>
                                    </p>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergePreview.preservedProfileCount >
                                            0
                                        "
                                        class="text-xs text-muted-foreground"
                                    >
                                        Use
                                        <span class="font-medium text-foreground">
                                            Copy Full Keys
                                        </span>
                                        for the untruncated preserved-key list, or
                                        <span class="font-medium text-foreground">
                                            Copy Full Keys JSON
                                        </span>
                                        for automation-friendly JSON array output.
                                    </p>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergePreview.preservedProfileCount >
                                            0
                                        "
                                        class="text-xs text-muted-foreground"
                                    >
                                        Full keys payload size:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics.chars
                                            }}
                                            chars /
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics.bytes
                                            }}
                                            bytes
                                        </span>
                                        (newline),
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics.chars
                                            }}
                                            chars /
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics.bytes
                                            }}
                                            bytes
                                        </span>
                                        (JSON).
                                    </p>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics.warning
                                        "
                                        class="text-xs text-amber-700 dark:text-amber-300"
                                    >
                                        {{
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics.warning
                                        }}
                                    </p>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics.warning
                                        "
                                        class="text-xs text-amber-700 dark:text-amber-300"
                                    >
                                        {{
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics.warning
                                        }}
                                    </p>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible
                                        "
                                        class="text-xs text-muted-foreground"
                                    >
                                        Chunk helper:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount
                                            }}
                                        </span>
                                        chunks at target
                                        <span class="font-medium text-foreground">
                                            {{
                                                billingClaimReferenceMergePreviewCopyChunkTargetBytes
                                            }}
                                        </span>
                                        bytes. Use
                                        <span class="font-medium text-foreground">
                                            Copy in Chunks
                                        </span>
                                        for staged transfer when clipboard or paste limits are strict.
                                    </p>
                                    <div
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible &&
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount >
                                                0
                                        "
                                        class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                                    >
                                        <span>Go to chunk #:</span>
                                        <Input
                                            v-model="
                                                billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget
                                            "
                                            class="h-7 w-20 text-xs"
                                            inputmode="numeric"
                                            placeholder="1"
                                            @keydown.enter.prevent="
                                                jumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk
                                            "
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-7 px-2 text-xs"
                                            @click="
                                                jumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk
                                            "
                                        >
                                            Go
                                        </Button>
                                        <span>
                                            Range:
                                            <span class="font-medium text-foreground">
                                                1-{{
                                                    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount
                                                }}
                                            </span>
                                        </span>
                                    </div>
                                    <div
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkQuickJumpVisible
                                        "
                                        class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                                    >
                                        <span>Quick jump:</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-7 px-2 text-xs"
                                            :disabled="
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtFirstBoundary
                                            "
                                            @click="
                                                quickJumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk(
                                                    'first',
                                                )
                                            "
                                        >
                                            First
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-7 px-2 text-xs"
                                            :disabled="
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtLastBoundary
                                            "
                                            @click="
                                                quickJumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk(
                                                    'last',
                                                )
                                            "
                                        >
                                            Last
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-7 px-2 text-xs"
                                            :disabled="
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtFirstBoundary
                                            "
                                            @click="
                                                quickJumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk(
                                                    'prev5',
                                                )
                                            "
                                        >
                                            Prev -5
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-7 px-2 text-xs"
                                            :disabled="
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtLastBoundary
                                            "
                                            @click="
                                                quickJumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk(
                                                    'next5',
                                                )
                                            "
                                        >
                                            Next +5
                                        </Button>
                                    </div>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible &&
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount >
                                                0
                                        "
                                        class="text-xs text-muted-foreground"
                                    >
                                        Chunk sequence: current
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentIndex
                                            }}
                                        </span>
                                        <span class="font-medium text-foreground">
                                            ({{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentBytes
                                            }}
                                            bytes)
                                        </span>
                                        | next
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextIndex
                                            }}
                                        </span>
                                        <span class="font-medium text-foreground">
                                            ({{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextBytes
                                            }}
                                            bytes)
                                        </span>
                                        .
                                    </p>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible &&
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount >
                                                0
                                        "
                                        class="text-xs text-muted-foreground"
                                    >
                                        Chunk payload bytes:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkBytesPreviewLabel
                                            }}
                                        </span>
                                    </p>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysOmittedCount >
                                            0
                                        "
                                        class="text-xs text-muted-foreground"
                                    >
                                        Showing first
                                        {{
                                            billingClaimReferenceMergePreviewPreservedKeysPreviewLimit
                                        }}
                                        preserved keys in preview; omitted:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysOmittedCount
                                            }}
                                        </span>
                                        .
                                    </p>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideMergeSafeParseWarning
                                        "
                                        class="text-xs text-amber-700 dark:text-amber-300"
                                    >
                                        {{
                                            statusDialogClaimReferenceTelemetryOverrideMergeSafeParseWarning
                                        }}
                                        Copy output includes this warning before the generated line.
                                    </p>
                                    <p class="break-all text-xs text-muted-foreground">
                                        Merge template (placeholder):
                                        <span class="font-mono text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideMergeTemplateWithPlaceholder
                                            }}
                                        </span>
                                    </p>
                                    <div class="space-y-1 break-all text-xs text-muted-foreground">
                                        <p>
                                            PowerShell export:
                                            <span class="font-mono text-foreground">
                                                {{
                                                    statusDialogClaimReferenceTelemetryOverridePowerShellExportLine
                                                }}
                                            </span>
                                        </p>
                                        <p>
                                            bash export:
                                            <span class="font-mono text-foreground">
                                                {{
                                                    statusDialogClaimReferenceTelemetryOverrideBashExportLine
                                                }}
                                            </span>
                                        </p>
                                    </div>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryProfileSelectionMismatchMessage
                                        "
                                        class="text-xs text-amber-700 dark:text-amber-300"
                                    >
                                        {{
                                            statusDialogClaimReferenceTelemetryProfileSelectionMismatchMessage
                                        }}
                                    </p>
                                    <div
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverrideTargetSuggestions.length >
                                            0
                                        "
                                        class="space-y-1 text-xs text-amber-700 dark:text-amber-300"
                                    >
                                        <p class="font-medium">
                                            Override target suggestions:
                                        </p>
                                        <p
                                            v-for="suggestion in statusDialogClaimReferenceTelemetryOverrideTargetSuggestions"
                                            :key="`billing-claim-policy-override-target-suggestion-${suggestion}`"
                                        >
                                            {{ suggestion }}
                                        </p>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        Override resolution:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideResolutionSummary
                                            }}
                                        </span>
                                        .
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Override coverage:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryOverrideCoverageSummary
                                            }}
                                        </span>
                                        .
                                    </p>
                                    <p
                                        v-if="statusDialogClaimReferenceTelemetryOverrideGuidance"
                                        class="text-xs text-amber-700 dark:text-amber-300"
                                    >
                                        {{
                                            statusDialogClaimReferenceTelemetryOverrideGuidance
                                        }}
                                    </p>
                                    <p
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverridesParseDiagnosticMessage
                                        "
                                        class="text-xs text-amber-700 dark:text-amber-300"
                                    >
                                        {{
                                            statusDialogClaimReferenceTelemetryOverridesParseDiagnosticMessage
                                        }}
                                    </p>
                                    <div
                                        v-if="
                                            statusDialogClaimReferenceTelemetryOverridesQualityDiagnosticMessages.length >
                                            0
                                        "
                                        class="space-y-1 text-xs text-amber-700 dark:text-amber-300"
                                    >
                                        <p class="font-medium">
                                            Policy override quality warnings:
                                        </p>
                                        <p
                                            v-for="warning in statusDialogClaimReferenceTelemetryOverridesQualityDiagnosticMessages"
                                            :key="`billing-claim-policy-override-quality-warning-${warning}`"
                                        >
                                            {{ warning }}
                                        </p>
                                    </div>
                                    <div
                                        v-if="
                                            statusDialogClaimReferenceTelemetryEnvDiagnosticMessages.length >
                                            0
                                        "
                                        class="space-y-1 text-xs text-amber-700 dark:text-amber-300"
                                    >
                                        <p class="font-medium">
                                            Policy env parse warnings:
                                        </p>
                                        <p
                                            v-for="warning in statusDialogClaimReferenceTelemetryEnvDiagnosticMessages"
                                            :key="`billing-claim-policy-env-warning-${warning}`"
                                        >
                                            {{ warning }}
                                        </p>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        Policy source:
                                        <span class="font-medium text-foreground">
                                            {{
                                                statusDialogClaimReferenceTelemetryPolicySourceSummary
                                            }}
                                        </span>
                                        .
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Auto-clears after
                                        {{ billingClaimReferenceValidationTelemetryInactivityMinutes }}m
                                        inactivity or
                                        {{ billingClaimReferenceValidationTelemetryMaxSessionAgeHours }}h
                                        session age.
                                    </p>
                                    <p
                                        v-if="billingClaimReferenceTelemetrySnapshotMessage"
                                        class="text-xs"
                                        :class="
                                            billingClaimReferenceTelemetrySnapshotError
                                                ? 'text-destructive'
                                                : 'text-emerald-700 dark:text-emerald-300'
                                        "
                                    >
                                        {{ billingClaimReferenceTelemetrySnapshotMessage }}
                                    </p>
                                    <p
                                        v-if="billingClaimReferenceOverrideSnippetMessage"
                                        class="text-xs"
                                        :class="
                                            billingClaimReferenceOverrideSnippetError
                                                ? 'text-destructive'
                                                : 'text-emerald-700 dark:text-emerald-300'
                                        "
                                    >
                                        {{ billingClaimReferenceOverrideSnippetMessage }}
                                    </p>
                                    <p
                                        v-if="billingClaimReferenceOverrideEnvelopeMessage"
                                        class="text-xs"
                                        :class="
                                            billingClaimReferenceOverrideEnvelopeError
                                                ? 'text-destructive'
                                                : 'text-emerald-700 dark:text-emerald-300'
                                        "
                                    >
                                        {{ billingClaimReferenceOverrideEnvelopeMessage }}
                                    </p>
                                    <p
                                        v-if="billingClaimReferenceOverrideMergeSafeEnvMessage"
                                        class="text-xs"
                                        :class="
                                            billingClaimReferenceOverrideMergeSafeEnvError
                                                ? 'text-destructive'
                                                : 'text-emerald-700 dark:text-emerald-300'
                                        "
                                    >
                                        {{ billingClaimReferenceOverrideMergeSafeEnvMessage }}
                                    </p>
                                    <p
                                        v-if="
                                            billingClaimReferenceMergePreviewFullPreservedKeysMessage
                                        "
                                        class="text-xs"
                                        :class="
                                            billingClaimReferenceMergePreviewFullPreservedKeysError
                                                ? 'text-destructive'
                                                : 'text-emerald-700 dark:text-emerald-300'
                                        "
                                    >
                                        {{
                                            billingClaimReferenceMergePreviewFullPreservedKeysMessage
                                        }}
                                    </p>
                                    <p
                                        v-if="
                                            billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage
                                        "
                                        class="text-xs"
                                        :class="
                                            billingClaimReferenceMergePreviewFullPreservedKeysJsonError
                                                ? 'text-destructive'
                                                : 'text-emerald-700 dark:text-emerald-300'
                                        "
                                    >
                                        {{
                                            billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage
                                        }}
                                    </p>
                                    <p
                                        v-if="
                                            billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage
                                        "
                                        class="text-xs"
                                        :class="
                                            billingClaimReferenceMergePreviewFullPreservedKeysChunkError
                                                ? 'text-destructive'
                                                : 'text-emerald-700 dark:text-emerald-300'
                                        "
                                    >
                                        {{
                                            billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage
                                        }}
                                    </p>
                                    <p
                                        v-if="billingClaimReferenceOverrideShellExportsMessage"
                                        class="text-xs"
                                        :class="
                                            billingClaimReferenceOverrideShellExportsError
                                                ? 'text-destructive'
                                                : 'text-emerald-700 dark:text-emerald-300'
                                        "
                                    >
                                        {{ billingClaimReferenceOverrideShellExportsMessage }}
                                    </p>
                                </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="grid gap-2 sm:col-span-2">
                                <Label for="billing-status-payment-note">
                                    {{ statusDialogPaymentNoteFieldLabel }}
                                </Label>
                                <Textarea
                                    id="billing-status-payment-note"
                                    v-model="statusDialogPaymentNote"
                                    class="min-h-20"
                                    :placeholder="statusDialogPaymentNotePlaceholder"
                                />
                                <p class="text-xs text-muted-foreground">
                                    {{ statusDialogPaymentNoteHelper }}
                                </p>
                            </div>
                            </div>
                            </div>
                        </div>
                    </div>

                        <div v-if="statusDialogNeedsReason" class="space-y-3 rounded-lg bg-muted/30 p-4">
                            <p class="text-sm font-medium">{{ statusDialogReasonSectionTitle }}</p>
                            <div class="grid gap-2">
                            <Label for="billing-status-reason">
                                {{
                                    statusDialogAction === 'cancelled'
                                        ? 'Cancellation Reason'
                                        : 'Void Reason'
                                }}
                            </Label>
                            <Textarea
                                id="billing-status-reason"
                                v-model="statusDialogReason"
                                class="min-h-24"
                                placeholder="Required reason"
                            />
                        </div>

                        <Alert v-if="statusDialogError" variant="destructive">
                            <AlertTitle>Action validation</AlertTitle>
                            <AlertDescription>{{ statusDialogError }}</AlertDescription>
                        </Alert>
                    </div>

                        </div>
                    </div>

                    <SheetFooter class="mt-auto shrink-0 border-t bg-background px-6 py-4">
                        <div class="flex items-center justify-between gap-2">
                            <Button
                                variant="outline"
                                :disabled="Boolean(actionLoadingId)"
                                @click="closeInvoiceStatusDialog"
                            >
                                Cancel
                            </Button>
                            <Button
                                :variant="
                                    statusDialogAction === 'cancelled' || statusDialogAction === 'voided'
                                        ? 'destructive'
                                        : 'default'
                                "
                                :disabled="Boolean(actionLoadingId)"
                                @click="submitInvoiceStatusDialog"
                            >
                                {{
                                    actionLoadingId
                                        ? statusDialogSubmitLoadingLabel
                                        : statusDialogSubmitButtonLabel
                                }}
                            </Button>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
</template>
