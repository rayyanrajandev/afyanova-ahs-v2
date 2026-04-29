<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import LinkedContextLookupField from '@/components/context/LinkedContextLookupField.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
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
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import {
    auditActionDisplayLabel,
    auditActorDisplayName,
    buildAuditMetadataPreview,
} from '@/lib/audit';
import { patientChartHref } from '@/lib/patientChart';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePendingWorkflowLeaveGuard } from '@/composables/usePendingWorkflowLeaveGuard';
import { useWorkflowDraftPersistence } from '@/composables/useWorkflowDraftPersistence';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import AppLayout from '@/layouts/AppLayout.vue';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import BillingBoardView from './components/BillingBoardView.vue';
import BillingCreateAccessRestrictedCard from './components/BillingCreateAccessRestrictedCard.vue';
import BillingCreateChargeCapturePanel from './components/BillingCreateChargeCapturePanel.vue';
import BillingCreateChargesSummary from './components/BillingCreateChargesSummary.vue';
import BillingCreateContextDialog from './components/BillingCreateContextDialog.vue';
import BillingCreateContextSummary from './components/BillingCreateContextSummary.vue';
import BillingCreateCoveragePanel from './components/BillingCreateCoveragePanel.vue';
import BillingCreateFinalizePanel from './components/BillingCreateFinalizePanel.vue';
import BillingCreateLineItemsFallback from './components/BillingCreateLineItemsFallback.vue';
import BillingCreateLineItemsSidebar from './components/BillingCreateLineItemsSidebar.vue';
import BillingCreateSelectedLineEditor from './components/BillingCreateSelectedLineEditor.vue';
import BillingCreateStageActions from './components/BillingCreateStageActions.vue';
import BillingCreateWorkflowLinksBar from './components/BillingCreateWorkflowLinksBar.vue';
import BillingCreateWorkspaceHeader from './components/BillingCreateWorkspaceHeader.vue';
import BillingQueueControlBar from './components/BillingQueueControlBar.vue';
import BillingQueueFiltersPanels from './components/BillingQueueFiltersPanels.vue';
import BillingQueueTable from './components/BillingQueueTable.vue';
import BillingQueueToolbar from './components/BillingQueueToolbar.vue';
import BillingWorkspaceAlerts from './components/BillingWorkspaceAlerts.vue';
import BillingWorkspaceHeader from './components/BillingWorkspaceHeader.vue';
import InvoiceDetailsSheet from './components/InvoiceDetailsSheet.vue';
import InvoiceEditDraftSheet from './components/InvoiceEditDraftSheet.vue';
import InvoiceStatusDialogSheet from './components/InvoiceStatusDialogSheet.vue';
import PaymentReversalDialog from './components/PaymentReversalDialog.vue';
import { useBillingFinancialControls } from './composables/useBillingFinancialControls';
import { useBillingPermissions } from './composables/useBillingPermissions';
import { usePaymentReversal } from './composables/usePaymentReversal';
import {
    compactVisitCoverageSummary,
    financialClassLabel,
    isThirdPartyFinancialClass,
    normalizeFinancialClass,
} from '@/lib/financialCoverage';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import {
    billingPaymentPayerTypeOptions,
    billingPaymentMethodOptions,
    billingReferenceSampleDateToken,
    billingPaymentMethodsRequiringReference,
    billingPayerTypesRequiringClaimReference,
    billingClaimReferenceFormatPattern,
    billingClaimReferenceFormatExamples,
    billingClaimReferenceExamplesByPayer,
    billingClaimReferencePlaceholderTokens,
    billingAuditActionOptions,
    billingAuditActorTypeOptions,
    auditExportStatusGroupOptions,
    billingClaimReferenceValidationPolicyDefaults,
} from './constants';
import {
    parseClaimReferencePolicyPositiveInt,
    resolveClaimReferencePolicyEnvValue,
    parseClaimReferencePolicyOverridesEnv,
    parseAuditExportStatusGroup,
    stringValue,
    parseOptionalNumber,
    buildClaimReferenceTemplateCandidates,
    isTemplateLikeClaimReference,
    claimReferenceFailureReasonLabel,
    claimReferencePolicySourceLabel,
    claimReferencePolicyOverrideResolutionLabel,
    claimReferencePolicyFieldLabel,
    claimReferencePolicyProfileProvenanceLabel,
    claimReferencePolicyCodeNormalizationLabel,
    claimReferencePolicyEnvDiagnosticMessage,
    claimReferencePolicyOverridesParseDiagnosticMessage,
    claimReferencePolicyOverridesQualityDiagnosticMessage,
    formatDate,
    formatDateTime,
    defaultLocalDateTime,
    localDateTimeDatePart,
    localDateTimeTimePart,
    mergeLocalDateAndTimeParts,
    amountToNumber,
    formatPercent,
    statusVariant,
    invoiceQueueDetailsLabel,
    billingPaymentPayerTypeLabel,
    billingPaymentMethodLabel,
    billingPaymentOperationalProofText,
    billingPaymentEntryType,
    billingPaymentIsReversal,
    billingPaymentMetaLabel,
    billingPaymentOperatorLabel,
    billingPaymentRecordedAt,
    billingInvoiceSettlementFinancialClass,
    billingInvoiceSettlementMode,
    billingInvoiceSettlementPathLabel,
    billingInvoiceAuthorizationSummary,
    billingInvoiceCoverageSummary,
    billingInvoiceCoveragePosture,
    billingInvoiceCoverageMetricBadges,
    billingInvoiceFinancePostingBadges,
    billingInvoiceClaimPostureLabel,
    billingLineItemCoverageDecisionLabel,
    billingLineItemCoverageDecisionVariant,
    billingInvoicePreferredPaymentPayerType,
    billingInvoiceQueuePaidLabel,
    billingInvoiceQueueLastActivityLabel,
    billingInvoiceQueueLaneLabel,
    billingInvoiceMatchesQueueLaneFilter,
    billingInvoiceThirdPartyPhase,
    billingInvoiceThirdPartyPhaseLabel,
    billingInvoiceMatchesThirdPartyPhaseFilter,
    billingInvoiceStatusActionLabel,
    billingInvoiceQueueNextStep,
    billingInvoiceQueueActionLeadDetails,
    invoiceContextHref,
    invoiceClaimWorkflowIsAvailable,
    invoiceClaimCreateHref,
    invoiceClaimsQueueHref,
    billingInvoiceQueueClaimsActionCue,
    billingInvoiceIssueHandoff,
    buildBillingDraftExecutionPreview,
    invoiceBackToAppointmentsHref,
    invoiceLineItems,
    invoiceLineItemCount,
    escapeForPowerShellSingleQuotedString,
    escapeForBashSingleQuotedString,
    billingClaimReferenceMergePreviewPayloadWarningThresholdBytes,
    billingClaimReferenceMergePreviewPayloadHighWarningThresholdBytes,
    billingClaimReferenceMergePreviewCopyChunkTargetBytes,
    billingClaimReferencePayloadUtf8ByteLength,
    billingClaimReferenceMergePreviewPayloadDiagnostics,
    buildBillingClaimReferenceMergePreviewKeyChunks,
} from './helpers';
import type {
    ScopeData,
    BillingInvoice,
    BillingInvoiceFinanceLedgerSummary,
    BillingInvoiceFinancePostingSummary,
    BillingInvoiceLineItemPriceOverride,
    BillingInvoiceLineItemCoverage,
    BillingInvoiceAuthorizationSummary,
    BillingInvoiceCoverageSummary,
    BillingInvoicePriceOverrideSummary,
    BillingInvoiceLineItemAuthorization,
    BillingInvoiceLineItem,
    BillingChargeCaptureCandidate,
    BillingChargeCaptureCandidateListResponse,
    BillingInvoiceVisitCoverage,
    BillingInvoiceListResponse,
    BillingInvoiceStatusCounts,
    BillingInvoiceStatusCountsResponse,
    PatientSummary,
    PatientResponse,
    AppointmentSummary,
    AdmissionSummary,
    AppointmentResponse,
    AdmissionResponse,
    LinkedContextListResponse,
    ValidationErrorResponse,
    SearchForm,
    BillingWorkspaceView,
    CreateContextLinkSource,
    CreateContextEditorTab,
    InvoiceDetailsTab,
    InvoiceWorkflowLink,
    InvoiceDetailsOperationalCard,
    InvoiceDetailsOperationalPanel,
    InvoiceDetailsOperationalAction,
    BillingDialogPreviewCard,
    BillingServiceCatalogItem,
    BillingPayerContract,
    BillingPayerContractListResponse,
    BillingInvoicePayerSummary,
    BillingInvoiceClaimReadiness,
    BillingInvoicePayerPreview,
    BillingInvoiceCoveragePosture,
    BillingDraftExecutionPreview,
    BillingServiceCatalogListResponse,
    CreateForm,
    BillingCreateCoverageMode,
    BillingQueueLaneFilter,
    BillingQueueThirdPartyPhaseFilter,
    BillingInvoicePayment,
    BillingInvoicePaymentListResponse,
    BillingInvoiceAuditLog,
    BillingInvoiceAuditLogListResponse,
    BillingInvoiceAuditExportJob,
    BillingInvoiceAuditExportJobResponse,
    BillingInvoiceAuditExportJobListResponse,
    AuditExportJobStatusSummary,
    AuditExportStatusGroup,
    RecordBillingInvoicePaymentResponse,
    InvoiceDetailsPaymentsFilterForm,
    InvoiceDetailsAuditLogsFilterForm,
    InvoiceDetailsAuditExportJobsFilterForm,
    BillingAuditExportRetryHandoffContext,
    BillingAuditExportRetryResumeTelemetry,
    BillingAuditExportRetryResumeTelemetryEventContext,
    BillingClaimReferenceValidationFailureReason,
    BillingClaimReferenceValidationTelemetry,
    BillingClaimReferenceValidationPolicySource,
    BillingClaimReferenceValidationPolicyOverrideResolution,
    BillingClaimReferenceValidationPolicyEnvDiagnostic,
    BillingClaimReferenceValidationPolicyOverridesParseDiagnostic,
    BillingClaimReferenceValidationPolicyOverridesQualityDiagnostic,
    BillingClaimReferenceValidationPolicyNumeric,
    BillingClaimReferenceValidationPolicyField,
    BillingClaimReferenceValidationPolicyCoverage,
    BillingClaimReferenceValidationPolicyProfileProvenance,
    BillingClaimReferenceValidationPolicyProfileContext,
    BillingClaimReferenceValidationPolicySelectionMismatch,
    BillingClaimReferenceValidationPolicyOverride,
    BillingClaimReferenceValidationPolicy,
    BillingInvoiceLineItemDraft,
    BillingInvoiceStatusAction,
} from './types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing Invoices', href: '/billing-invoices' },
];
const { activeCurrencyCode, loadCountryProfile } = usePlatformCountryProfile();
const defaultBillingCurrencyCode = computed(() => activeCurrencyCode.value || 'TZS');

const pageLoading = ref(true);
const listLoading = ref(false);
const createLoading = ref(false);
const createBillingDraftPreviewLoading = ref(false);
const createBillingDraftPreviewInvoice = ref<BillingInvoice | null>(null);
const createBillingDraftPreviewError = ref<string | null>(null);
const actionLoadingId = ref<string | null>(null);
const listErrors = ref<string[]>([]);
const actionMessage = ref<string | null>(null);
const createMessage = ref<string | null>(null);
const createErrors = ref<Record<string, string[]>>({});
const createContextActiveDraft = ref<BillingInvoice | null>(null);
const createContextActiveDraftLoading = ref(false);
const createContextActiveDraftError = ref<string | null>(null);
const scope = ref<ScopeData | null>(null);
const invoices = ref<BillingInvoice[]>([]);
const pagination = ref<BillingInvoiceListResponse['meta'] | null>(null);
const billingInvoiceStatusCounts = ref<BillingInvoiceStatusCounts | null>(null);
const patientDirectory = ref<Record<string, PatientSummary>>({});
const unavailablePatientIds = ref<Record<string, true>>({});
const advancedFiltersSheetOpen = ref(false);
const mobileFiltersDrawerOpen = ref(false);
const compactQueueRows = useLocalStorageBoolean('opd.queueRows.compact', false);
const billingQueueLaneFilter = ref<BillingQueueLaneFilter>('all');
const billingQueueThirdPartyPhaseFilter =
    ref<BillingQueueThirdPartyPhaseFilter>('all');
const billingQueueSearchInput = ref<
    HTMLInputElement | { $el?: Element | null } | null
>(null);
const invoiceDetailsSheetOpen = ref(false);
const invoiceDetailsInvoice = ref<BillingInvoice | null>(null);
const invoiceDetailsActionOutcome = ref<{
    invoiceId: string;
    title: string;
    message: string;
    tone: 'default' | 'secondary';
} | null>(null);
const invoiceDetailsPayments = ref<BillingInvoicePayment[]>([]);
const invoiceDetailsPaymentsMeta = ref<BillingInvoicePaymentListResponse['meta'] | null>(
    null,
);
const invoiceDetailsFinancePosting = ref<BillingInvoiceFinancePostingSummary | null>(null);
const invoiceDetailsFinancePostingLoading = ref(false);
const invoiceDetailsFinancePostingError = ref<string | null>(null);
const invoiceDetailsAuditLogs = ref<BillingInvoiceAuditLog[]>([]);
const invoiceDetailsAuditLogsMeta = ref<BillingInvoiceAuditLogListResponse['meta'] | null>(
    null,
);
const invoiceDetailsAuditExportJobs = ref<BillingInvoiceAuditExportJob[]>([]);
const invoiceDetailsAuditExportJobsMeta = ref<BillingInvoiceAuditExportJobListResponse['meta'] | null>(
    null,
);
const invoiceDetailsPaymentsFilters = reactive<InvoiceDetailsPaymentsFilterForm>({
    q: '',
    payerType: '',
    paymentMethod: '',
    from: '',
    to: '',
    perPage: 20,
});
const invoiceDetailsPaymentsFiltersOpen = ref(false);
const invoiceDetailsAuditLogsFilters = reactive<InvoiceDetailsAuditLogsFilterForm>({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    perPage: 20,
    page: 1,
});
const invoiceDetailsAuditExportJobsFilters = reactive<InvoiceDetailsAuditExportJobsFilterForm>(
    {
        statusGroup: 'all',
        perPage: 8,
        page: 1,
    },
);
const invoiceDetailsPaymentsLoading = ref(false);
const invoiceDetailsPaymentsError = ref<string | null>(null);
const invoiceDetailsAuditLogsLoading = ref(false);
const invoiceDetailsAuditLogsExporting = ref(false);
const invoiceDetailsAuditLogsError = ref<string | null>(null);
const invoiceDetailsAuditExportJobsLoading = ref(false);
const invoiceDetailsAuditExportJobsError = ref<string | null>(null);
const invoiceDetailsAuditExportRetryingJobId = ref<string | null>(null);
const invoiceDetailsAuditExportFocusJobId = ref<string | null>(null);
const invoiceDetailsAuditExportPinnedHandoffJob = ref<BillingInvoiceAuditExportJob | null>(
    null,
);
const invoiceDetailsAuditExportHandoffMessage = ref<string | null>(null);
const invoiceDetailsAuditExportHandoffError = ref(false);
const invoiceDetailsSheetTab = ref<InvoiceDetailsTab>('overview');
const invoiceDetailsAuditFiltersOpen = ref(false);
const invoiceDetailsExpandedAuditLogIds = ref<string[]>([]);
const {
    billingPermissionsResolved,
    canRecordBillingPayments,
    canViewBillingPaymentHistory,
    canViewBillingInvoiceAuditLogs,
    canReverseBillingPayments,
    canCreateBillingInvoices,
    canReadBillingInvoices,
    canIssueBillingInvoices,
    canUpdateDraftBillingInvoices,
    canVoidBillingInvoices,
    canCancelBillingInvoices,
    canReadBillingFinancialControls,
    canReadBillingServiceCatalog,
    canReadBillingPayerContracts,
    canReadAppointments,
    canReadAdmissions,
    canReadMedicalRecords,
    canCreateLaboratoryOrders,
    canCreatePharmacyOrders,
    canCreateTheatreProcedures,
    canReadClaimsInsurance,
    canCreateClaimsInsurance,
    canOperateBillingWorkflow,
    canManageBillingWorkflowExceptions,
    hasBillingExecutionSurface,
    loadBillingPermissions: resolveBillingPermissions,
} = useBillingPermissions();

const {
    billingFinancialControlsSummary,
    billingFinancialControlsLoading,
    billingFinancialControlsError,
    billingFinancialControlsExporting,
    loadFinancialControlsSummary: resolveFinancialControlsSummary,
    exportFinancialControlsSummaryCsv: triggerFinancialControlsSummaryCsvExport,
} = useBillingFinancialControls();

const billingServiceCatalogLoading = ref(false);
const billingServiceCatalogError = ref<string | null>(null);
const billingServiceCatalogItems = ref<BillingServiceCatalogItem[]>([]);
const billingPayerContractsLoading = ref(false);
const billingPayerContractsError = ref<string | null>(null);
const billingPayerContracts = ref<BillingPayerContract[]>([]);
const billingPayerContractsLoaded = ref(false);

function resetBillingPayerContractsState() {
    billingPayerContracts.value = [];
    billingPayerContractsError.value = null;
    billingPayerContractsLoading.value = false;
    billingPayerContractsLoaded.value = false;
}

const billingChargeCaptureLoading = ref(false);
const billingChargeCaptureError = ref<string | null>(null);
const billingChargeCaptureCandidates = ref<BillingChargeCaptureCandidate[]>([]);
const billingChargeCaptureMeta = ref<BillingChargeCaptureCandidateListResponse['meta'] | null>(null);
const importedChargeCaptureCandidateIds = ref<string[]>([]);
const statusDialogOpen = ref(false);
const statusDialogAdvancedSupportOpen = ref(false);
const statusDialogReferenceDiagnosticsOpen = ref(false);
const statusDialogReferenceCopyToolsOpen = ref(false);
const statusDialogInvoice = ref<BillingInvoice | null>(null);
const statusDialogAction = ref<BillingInvoiceStatusAction | null>(null);
const statusDialogReason = ref('');
const statusDialogPaidAmount = ref('');
const statusDialogPaymentPayerType = ref('');
const statusDialogPaymentMethod = ref('');
const statusDialogPaymentReference = ref('');
const statusDialogPaymentNote = ref('');
const statusDialogPaymentAt = ref('');
const statusDialogPaymentAtDate = computed({
    get: () => localDateTimeDatePart(statusDialogPaymentAt.value),
    set: (value: string) => {
        statusDialogPaymentAt.value = mergeLocalDateAndTimeParts(
            String(value ?? ''),
            localDateTimeTimePart(statusDialogPaymentAt.value),
            statusDialogPaymentAt.value,
        );
    },
});
const statusDialogPaymentAtTime = computed({
    get: () => localDateTimeTimePart(statusDialogPaymentAt.value),
    set: (value: string) => {
        statusDialogPaymentAt.value = mergeLocalDateAndTimeParts(
            localDateTimeDatePart(statusDialogPaymentAt.value),
            String(value ?? ''),
            statusDialogPaymentAt.value,
        );
    },
});
const statusDialogError = ref<string | null>(null);
const statusDialogPaymentMethodManualOverride = ref(false);
const statusDialogPaymentMethodAutoSelected = ref(false);
const statusDialogInitializingPaymentMetadata = ref(false);
const statusDialogApplyingPaymentMethodAutoSelect = ref(false);
let billingLineItemDraftCounter = 0;
const editDialogOpen = ref(false);
const editDialogInvoiceId = ref<string | null>(null);
const editDialogInvoiceLabel = ref('Billing Invoice');
const editDialogSourceInvoice = ref<BillingInvoice | null>(null);
const editDialogLoading = ref(false);
const editDialogError = ref<string | null>(null);
const {
    paymentReversalDialogOpen,
    paymentReversalDialogInvoice,
    paymentReversalDialogPayment,
    paymentReversalDialogError,
    paymentReversalSubmitting,
    billingPaymentCanBeReversed,
    openPaymentReversalDialog,
    handlePaymentReversalDialogOpenChange,
    clearPaymentReversalDialogError,
    submitPaymentReversalDialog,
} = usePaymentReversal({
    apiRequest,
    invoiceDetailsInvoice,
    invoiceDetailsPayments,
    canReverseBillingPayments,
    canViewBillingPaymentHistory,
    canViewBillingInvoiceAuditLogs,
    loadInvoiceDetailsPayments,
    loadInvoiceDetailsAuditLogs,
    reloadQueueAndSummary,
    formatMoney,
});
const editDialogFieldErrors = ref<Record<string, string[]>>({});
const editBillingDraftPreviewLoading = ref(false);
const editBillingDraftPreviewInvoice = ref<BillingInvoice | null>(null);
const editBillingDraftPreviewError = ref<string | null>(null);
const editForm = reactive({
    billingPayerContractId: '',
    invoiceDate: '',
    currencyCode: defaultBillingCurrencyCode.value,
    subtotalAmount: '',
    discountAmount: '',
    taxAmount: '',
    paymentDueAt: '',
    notes: '',
    lineItems: [createBillingLineItemDraft()],
});

const pendingPatientLookupIds = new Set<string>();
let searchDebounceTimer: number | null = null;
let createBillingDraftPreviewDebounceTimer: number | null = null;
let editBillingDraftPreviewDebounceTimer: number | null = null;
let createContextActiveDraftDebounceTimer: number | null = null;
let createBillingDraftPreviewRequestKey = '';
let editBillingDraftPreviewRequestKey = '';
let createContextActiveDraftRequestKey = '';

const today = new Date().toISOString().slice(0, 10);

const searchForm = reactive<SearchForm>({
    q: queryParam('q'),
    patientId: queryParam('patientId'),
    status: queryParam('status'),
    statusIn: queryMultiParam('statusIn[]', 'statusIn'),
    currencyCode: queryParam('currencyCode'),
    from: queryDateParam('from', today),
    to: queryDateParam('to'),
    paymentActivityFrom: queryDateParam('paymentActivityFrom'),
    paymentActivityTo: queryDateParam('paymentActivityTo'),
    perPage: queryPerPageParam('perPage', 10, [10, 25, 50]),
    page: queryPositiveIntParam('page', 1),
});
const auditExportRetryHandoffJobId = queryParam('auditExportJobId');
const auditExportRetryHandoffAction = queryParam('auditAction').toLowerCase();
const auditExportRetryHandoffStatusGroup = parseAuditExportStatusGroup(
    queryParam('auditExportStatusGroup'),
);
const auditExportRetryHandoffPage = queryPositiveIntParam('auditExportPage', 1);
const auditExportRetryHandoffPerPage = queryPositiveIntParam(
    'auditExportPerPage',
    8,
    1,
    50,
);
const auditExportRetryHandoffPending = ref(
    auditExportRetryHandoffAction === 'retry' &&
        auditExportRetryHandoffJobId !== '',
);
const auditExportRetryHandoffCompletedMessage = ref<string | null>(null);
const billingAuditExportRetryHandoffSessionKey =
    'opd.billing.auditExportRetry.lastHandoff';
const billingAuditExportRetryTelemetrySessionKey =
    'opd.billing.auditExportRetry.resumeTelemetry';
const billingClaimReferenceValidationTelemetrySessionKey =
    'opd.billing.claimReference.validationTelemetry';

const billingClaimReferenceValidationPolicyBase = {
    windowMinutes: resolveClaimReferencePolicyEnvValue(
        import.meta.env.VITE_BILLING_CLAIM_REF_TELEMETRY_WINDOW_MINUTES,
        billingClaimReferenceValidationPolicyDefaults.windowMinutes,
        5,
        720,
        'VITE_BILLING_CLAIM_REF_TELEMETRY_WINDOW_MINUTES',
    ),
    inactivityMinutes: resolveClaimReferencePolicyEnvValue(
        import.meta.env.VITE_BILLING_CLAIM_REF_TELEMETRY_INACTIVITY_MINUTES,
        billingClaimReferenceValidationPolicyDefaults.inactivityMinutes,
        5,
        1440,
        'VITE_BILLING_CLAIM_REF_TELEMETRY_INACTIVITY_MINUTES',
    ),
    maxSessionAgeHours: resolveClaimReferencePolicyEnvValue(
        import.meta.env.VITE_BILLING_CLAIM_REF_TELEMETRY_MAX_SESSION_AGE_HOURS,
        billingClaimReferenceValidationPolicyDefaults.maxSessionAgeHours,
        1,
        72,
        'VITE_BILLING_CLAIM_REF_TELEMETRY_MAX_SESSION_AGE_HOURS',
    ),
    frequentFailureThreshold: resolveClaimReferencePolicyEnvValue(
        import.meta.env.VITE_BILLING_CLAIM_REF_TELEMETRY_FREQUENT_FAILURE_THRESHOLD,
        billingClaimReferenceValidationPolicyDefaults.frequentFailureThreshold,
        1,
        20,
        'VITE_BILLING_CLAIM_REF_TELEMETRY_FREQUENT_FAILURE_THRESHOLD',
    ),
} as const;

const billingClaimReferenceValidationPolicyOverridesParsed =
    parseClaimReferencePolicyOverridesEnv(
        String(
            import.meta.env
                .VITE_BILLING_CLAIM_REF_TELEMETRY_POLICY_OVERRIDES ?? '',
        ),
    );
const billingClaimReferenceValidationPolicyOverrides =
    billingClaimReferenceValidationPolicyOverridesParsed.overrides;
const billingClaimReferenceValidationPolicyOverridesParseDiagnostic =
    billingClaimReferenceValidationPolicyOverridesParsed.diagnostic;
const billingClaimReferenceValidationPolicyOverridesQualityDiagnostics =
    billingClaimReferenceValidationPolicyOverridesParsed.qualityDiagnostics;

const billingClaimReferenceValidationPolicyProfileContext =
    computed<BillingClaimReferenceValidationPolicyProfileContext>(() => {
        const facilityCodeRaw = scope.value?.facility?.code ?? null;
        const tenantCodeRaw = scope.value?.tenant?.code ?? null;
        const facilityCode = facilityCodeRaw?.trim().toLowerCase() || null;
        const tenantCode = tenantCodeRaw?.trim().toLowerCase() || null;

        if (facilityCode) {
            return {
                key: facilityCode,
                provenance: 'facility_code_hit',
                facilityCodeRaw,
                tenantCodeRaw,
                facilityCode,
                tenantCode,
            };
        }

        if (tenantCode) {
            return {
                key: tenantCode,
                provenance: 'tenant_code_hit',
                facilityCodeRaw,
                tenantCodeRaw,
                facilityCode,
                tenantCode,
            };
        }

        return {
            key: 'default',
            provenance: 'default_scope',
            facilityCodeRaw,
            tenantCodeRaw,
            facilityCode,
            tenantCode,
        };
    });

const billingClaimReferenceValidationPolicyProfileKey = computed(
    () => billingClaimReferenceValidationPolicyProfileContext.value.key,
);

const billingClaimReferenceValidationPolicy = computed<BillingClaimReferenceValidationPolicy>(
    () => {
        const profileContext = billingClaimReferenceValidationPolicyProfileContext.value;
        const profileKey = profileContext.key;
        const hasExactProfileOverride = Object.prototype.hasOwnProperty.call(
            billingClaimReferenceValidationPolicyOverrides,
            profileKey,
        );
        const hasDefaultOverride = Object.prototype.hasOwnProperty.call(
            billingClaimReferenceValidationPolicyOverrides,
            'default',
        );
        const override =
            (hasExactProfileOverride
                ? billingClaimReferenceValidationPolicyOverrides[profileKey]
                : undefined) ??
            (!hasExactProfileOverride && hasDefaultOverride
                ? billingClaimReferenceValidationPolicyOverrides.default
                : undefined) ??
            null;
        const overrideResolution: BillingClaimReferenceValidationPolicyOverrideResolution =
            hasExactProfileOverride
                ? 'exact_profile_override'
                : hasDefaultOverride
                  ? 'default_override_fallback'
                  : 'no_override';
        const overrideMatchedKey = hasExactProfileOverride
            ? profileKey
            : hasDefaultOverride
              ? 'default'
              : null;
        const alternateProfileKey =
            profileContext.provenance === 'facility_code_hit'
                ? profileContext.tenantCode
                : profileContext.provenance === 'tenant_code_hit'
                  ? profileContext.facilityCode
                  : null;
        const alternateProfileProvenance:
            | BillingClaimReferenceValidationPolicyProfileProvenance
            | null =
            profileContext.provenance === 'facility_code_hit'
                ? 'tenant_code_hit'
                : profileContext.provenance === 'tenant_code_hit'
                  ? 'facility_code_hit'
                  : null;
        const hasAlternateExactOverride =
            alternateProfileKey !== null &&
            alternateProfileKey !== profileKey &&
            Object.prototype.hasOwnProperty.call(
                billingClaimReferenceValidationPolicyOverrides,
                alternateProfileKey,
            );
        const profileSelectionMismatch: BillingClaimReferenceValidationPolicySelectionMismatch | null =
            !hasExactProfileOverride &&
            hasAlternateExactOverride &&
            alternateProfileKey !== null &&
            alternateProfileProvenance !== null
                ? {
                      selectedKey: profileKey,
                      selectedProvenance: profileContext.provenance,
                      alternateKey: alternateProfileKey,
                      alternateProvenance: alternateProfileProvenance,
                  }
                : null;

        const windowMinutes =
            override?.windowMinutes ?? billingClaimReferenceValidationPolicyBase.windowMinutes.value;
        const inactivityMinutes =
            override?.inactivityMinutes ??
            billingClaimReferenceValidationPolicyBase.inactivityMinutes.value;
        const maxSessionAgeHours =
            override?.maxSessionAgeHours ??
            billingClaimReferenceValidationPolicyBase.maxSessionAgeHours.value;
        const frequentFailureThreshold =
            override?.frequentFailureThreshold ??
            billingClaimReferenceValidationPolicyBase.frequentFailureThreshold.value;

        const sources = {
            windowMinutes:
                override?.windowMinutes !== undefined
                    ? ('profile_override' as const)
                    : billingClaimReferenceValidationPolicyBase.windowMinutes.source,
            inactivityMinutes:
                override?.inactivityMinutes !== undefined
                    ? ('profile_override' as const)
                    : billingClaimReferenceValidationPolicyBase.inactivityMinutes.source,
            maxSessionAgeHours:
                override?.maxSessionAgeHours !== undefined
                    ? ('profile_override' as const)
                    : billingClaimReferenceValidationPolicyBase.maxSessionAgeHours.source,
            frequentFailureThreshold:
                override?.frequentFailureThreshold !== undefined
                    ? ('profile_override' as const)
                    : billingClaimReferenceValidationPolicyBase
                          .frequentFailureThreshold.source,
        };
        const overrideCoverageEntries: Array<{
            field: BillingClaimReferenceValidationPolicyField;
            explicit: boolean;
        }> = [
            {
                field: 'windowMinutes',
                explicit: override?.windowMinutes !== undefined,
            },
            {
                field: 'inactivityMinutes',
                explicit: override?.inactivityMinutes !== undefined,
            },
            {
                field: 'maxSessionAgeHours',
                explicit: override?.maxSessionAgeHours !== undefined,
            },
            {
                field: 'frequentFailureThreshold',
                explicit: override?.frequentFailureThreshold !== undefined,
            },
        ];
        const overrideCoverage: BillingClaimReferenceValidationPolicyCoverage = {
            explicitFields: overrideCoverageEntries
                .filter((entry) => entry.explicit)
                .map((entry) => entry.field),
            inheritedFields: overrideCoverageEntries
                .filter((entry) => !entry.explicit)
                .map((entry) => entry.field),
        };

        const overallSource: BillingClaimReferenceValidationPolicySource =
            sources.windowMinutes === 'profile_override' ||
            sources.inactivityMinutes === 'profile_override' ||
            sources.maxSessionAgeHours === 'profile_override' ||
            sources.frequentFailureThreshold === 'profile_override'
                ? 'profile_override'
                : sources.windowMinutes === 'env' ||
                    sources.inactivityMinutes === 'env' ||
                    sources.maxSessionAgeHours === 'env' ||
                    sources.frequentFailureThreshold === 'env'
                  ? 'env'
                  : 'default';
        const envDiagnostics = [
            billingClaimReferenceValidationPolicyBase.windowMinutes.diagnostic,
            billingClaimReferenceValidationPolicyBase.inactivityMinutes.diagnostic,
            billingClaimReferenceValidationPolicyBase.maxSessionAgeHours.diagnostic,
            billingClaimReferenceValidationPolicyBase.frequentFailureThreshold
                .diagnostic,
        ].filter(
            (
                diagnostic,
            ): diagnostic is BillingClaimReferenceValidationPolicyEnvDiagnostic =>
                diagnostic !== null,
        );

        return {
            windowMinutes,
            inactivityMinutes,
            maxSessionAgeHours,
            frequentFailureThreshold,
            profileKey,
            profileProvenance: profileContext.provenance,
            profileProvenanceContext: {
                facilityCodeRaw: profileContext.facilityCodeRaw,
                tenantCodeRaw: profileContext.tenantCodeRaw,
                facilityCode: profileContext.facilityCode,
                tenantCode: profileContext.tenantCode,
            },
            profileSelectionMismatch,
            overrideResolution,
            overrideMatchedKey,
            envDiagnostics,
            overridesParseDiagnostic:
                billingClaimReferenceValidationPolicyOverridesParseDiagnostic,
            overridesQualityDiagnostics:
                billingClaimReferenceValidationPolicyOverridesQualityDiagnostics,
            overrideCoverage,
            sources: {
                overall: overallSource,
                ...sources,
            },
        };
    },
);

const billingClaimReferenceValidationTelemetryWindowMs = computed(
    () => billingClaimReferenceValidationPolicy.value.windowMinutes * 60000,
);
const billingClaimReferenceValidationTelemetryInactivityMs = computed(
    () => billingClaimReferenceValidationPolicy.value.inactivityMinutes * 60000,
);
const billingClaimReferenceValidationTelemetryMaxSessionAgeMs = computed(
    () => billingClaimReferenceValidationPolicy.value.maxSessionAgeHours * 3600000,
);
const billingClaimReferenceValidationTelemetryWindowMinutes = computed(
    () => billingClaimReferenceValidationPolicy.value.windowMinutes,
);
const billingClaimReferenceValidationTelemetryInactivityMinutes = computed(
    () => billingClaimReferenceValidationPolicy.value.inactivityMinutes,
);
const billingClaimReferenceValidationTelemetryMaxSessionAgeHours = computed(
    () => billingClaimReferenceValidationPolicy.value.maxSessionAgeHours,
);
const billingClaimReferenceValidationFrequentThreshold = computed(
    () => billingClaimReferenceValidationPolicy.value.frequentFailureThreshold,
);
const lastBillingAuditExportRetryHandoff = ref<BillingAuditExportRetryHandoffContext | null>(
    null,
);
const resumingBillingAuditExportRetryHandoff = ref(false);
const billingAuditExportRetryResumeTelemetry = ref<BillingAuditExportRetryResumeTelemetry>(
    {
        attempts: 0,
        successes: 0,
        failures: 0,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
    },
);
const billingClaimReferenceValidationTelemetry = ref<BillingClaimReferenceValidationTelemetry>(
    {
        sessionStartedAt: null,
        lastUpdatedAt: null,
        totalFailures: 0,
        recentWindowFailures: 0,
        recentWindowStartedAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
        byReason: {},
        byPayerType: {},
        byPaymentMethod: {},
    },
);
const copyingBillingClaimReferenceTelemetrySnapshot = ref(false);
const billingClaimReferenceTelemetrySnapshotMessage = ref<string | null>(null);
const billingClaimReferenceTelemetrySnapshotError = ref(false);
const copyingBillingClaimReferenceOverrideSnippet = ref(false);
const billingClaimReferenceOverrideSnippetMessage = ref<string | null>(null);
const billingClaimReferenceOverrideSnippetError = ref(false);
const copyingBillingClaimReferenceOverrideEnvelope = ref(false);
const billingClaimReferenceOverrideEnvelopeMessage = ref<string | null>(null);
const billingClaimReferenceOverrideEnvelopeError = ref(false);
const copyingBillingClaimReferenceOverrideShellExports = ref(false);
const billingClaimReferenceOverrideShellExportsMessage = ref<string | null>(null);
const billingClaimReferenceOverrideShellExportsError = ref(false);
const copyingBillingClaimReferenceOverrideMergeSafeEnv = ref(false);
const billingClaimReferenceOverrideMergeSafeEnvMessage = ref<string | null>(null);
const billingClaimReferenceOverrideMergeSafeEnvError = ref(false);
const copyingBillingClaimReferenceMergePreviewFullPreservedKeys = ref(false);
const billingClaimReferenceMergePreviewFullPreservedKeysMessage = ref<string | null>(
    null,
);
const billingClaimReferenceMergePreviewFullPreservedKeysError = ref(false);
const copyingBillingClaimReferenceMergePreviewFullPreservedKeysJson = ref(false);
const billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage = ref<string | null>(
    null,
);
const billingClaimReferenceMergePreviewFullPreservedKeysJsonError = ref(false);
const copyingBillingClaimReferenceMergePreviewFullPreservedKeysChunk = ref(false);
const billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage = ref<string | null>(
    null,
);
const billingClaimReferenceMergePreviewFullPreservedKeysChunkError = ref(false);
const billingClaimReferenceMergePreviewFullPreservedKeysChunkCursor = ref(0);
const billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget = ref('');

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function replaceUrlQueryParam(name: string, value: string | null): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (value && value.trim() !== '') {
        url.searchParams.set(name, value.trim());
    } else {
        url.searchParams.delete(name);
    }

    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

function queryMultiParam(...names: string[]): string[] {
    if (typeof window === 'undefined') return [];

    const params = new URLSearchParams(window.location.search);
    const values = names.flatMap((name) =>
        params
            .getAll(name)
            .map((value) => value.trim())
            .filter(Boolean),
    );

    return [...new Set(values)];
}

function queryDateParam(name: string, fallback = ''): string {
    const value = queryParam(name);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function queryPositiveIntParam(
    name: string,
    fallback: number,
    min = 1,
    max = Number.POSITIVE_INFINITY,
): number {
    const raw = queryParam(name);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < min) return fallback;
    return Math.min(parsed, max);
}

function queryPerPageParam(
    name: string,
    fallback: number,
    allowed: number[],
): number {
    const parsed = queryPositiveIntParam(name, fallback, 1, 500);
    return allowed.includes(parsed) ? parsed : fallback;
}

function syncBillingQueueFiltersToUrl(): void {
    if (typeof window === 'undefined') return;

    const currentUrl = new URL(window.location.href);
    const params = new URLSearchParams();

    const q = searchForm.q.trim();
    if (q) params.set('q', q);

    const patientId = searchForm.patientId.trim();
    if (patientId) params.set('patientId', patientId);

    if (searchForm.status) {
        params.set('status', searchForm.status);
    } else {
        const statusInValues = [
            ...new Set(
                searchForm.statusIn
                    .map((value) => value.trim())
                    .filter(Boolean),
            ),
        ].sort();
        statusInValues.forEach((value) => params.append('statusIn[]', value));
    }

    const currencyCode = searchForm.currencyCode.trim();
    if (currencyCode) params.set('currencyCode', currencyCode);

    if (searchForm.from && searchForm.from !== today) {
        params.set('from', searchForm.from);
    }
    if (searchForm.to) params.set('to', searchForm.to);
    if (searchForm.paymentActivityFrom) {
        params.set('paymentActivityFrom', searchForm.paymentActivityFrom);
    }
    if (searchForm.paymentActivityTo) {
        params.set('paymentActivityTo', searchForm.paymentActivityTo);
    }

    if (searchForm.perPage !== 10) params.set('perPage', String(searchForm.perPage));
    if (searchForm.page > 1) params.set('page', String(searchForm.page));
    if (billingWorkspaceView.value === 'create') {
        params.set('tab', 'new');
        if (createWorkspaceDraftInvoiceId.value.trim()) {
            params.set('draftInvoiceId', createWorkspaceDraftInvoiceId.value.trim());
        }
    } else if (billingWorkspaceView.value === 'board') {
        params.set('tab', 'board');
    }

    // Keep non-queue context and handoff parameters until dedicated cleanup runs.
    const passthroughKeys = [
        'appointmentId',
        'admissionId',
        'auditExportJobId',
        'auditAction',
        'auditExportStatusGroup',
        'auditExportPage',
        'auditExportPerPage',
        'focusInvoiceId',
        'from',
    ];
    passthroughKeys.forEach((key) => {
        const values = currentUrl.searchParams.getAll(key);
        values.forEach((value) => {
            const trimmedValue = value.trim();
            if (trimmedValue !== '') params.append(key, trimmedValue);
        });
    });

    const nextQuery = params.toString();
    const nextUrl = `${currentUrl.pathname}${nextQuery ? `?${nextQuery}` : ''}${currentUrl.hash}`;
    const existingUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    if (nextUrl !== existingUrl) {
        window.history.replaceState(window.history.state, '', nextUrl);
    }
}

function createEmptyBillingClaimReferenceValidationTelemetry(): BillingClaimReferenceValidationTelemetry {
    return {
        sessionStartedAt: null,
        lastUpdatedAt: null,
        totalFailures: 0,
        recentWindowFailures: 0,
        recentWindowStartedAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
        byReason: {},
        byPayerType: {},
        byPaymentMethod: {},
    };
}

function isBillingClaimReferenceValidationTelemetryStale(
    telemetry: BillingClaimReferenceValidationTelemetry,
): boolean {
    const nowMs = Date.now();
    const sessionStartedAtMs = telemetry.sessionStartedAt
        ? Date.parse(telemetry.sessionStartedAt)
        : Number.NaN;
    const lastUpdatedAtMs = telemetry.lastUpdatedAt
        ? Date.parse(telemetry.lastUpdatedAt)
        : Number.NaN;
    const lastFailureAtMs = telemetry.lastFailureAt
        ? Date.parse(telemetry.lastFailureAt)
        : Number.NaN;

    const referenceActivityMs = Number.isFinite(lastUpdatedAtMs)
        ? lastUpdatedAtMs
        : Number.isFinite(lastFailureAtMs)
          ? lastFailureAtMs
          : Number.isFinite(sessionStartedAtMs)
            ? sessionStartedAtMs
            : Number.NaN;

    if (
        Number.isFinite(sessionStartedAtMs) &&
        nowMs - sessionStartedAtMs >
            billingClaimReferenceValidationTelemetryMaxSessionAgeMs.value
    ) {
        return true;
    }

    if (
        Number.isFinite(referenceActivityMs) &&
        nowMs - referenceActivityMs >
            billingClaimReferenceValidationTelemetryInactivityMs.value
    ) {
        return true;
    }

    return false;
}

function readBillingClaimReferenceValidationTelemetryFromSession(): BillingClaimReferenceValidationTelemetry {
    if (typeof window === 'undefined') {
        return createEmptyBillingClaimReferenceValidationTelemetry();
    }

    try {
        const raw = window.sessionStorage.getItem(
            billingClaimReferenceValidationTelemetrySessionKey,
        );
        if (!raw) return createEmptyBillingClaimReferenceValidationTelemetry();

        const parsed = JSON.parse(raw) as Partial<BillingClaimReferenceValidationTelemetry>;
        if (!parsed || typeof parsed !== 'object') {
            return createEmptyBillingClaimReferenceValidationTelemetry();
        }

        const normalized: BillingClaimReferenceValidationTelemetry = {
            sessionStartedAt:
                typeof parsed.sessionStartedAt === 'string'
                    ? parsed.sessionStartedAt
                    : null,
            lastUpdatedAt:
                typeof parsed.lastUpdatedAt === 'string'
                    ? parsed.lastUpdatedAt
                    : null,
            totalFailures: Math.max(Number(parsed.totalFailures) || 0, 0),
            recentWindowFailures: Math.max(Number(parsed.recentWindowFailures) || 0, 0),
            recentWindowStartedAt:
                typeof parsed.recentWindowStartedAt === 'string'
                    ? parsed.recentWindowStartedAt
                    : null,
            lastFailureAt:
                typeof parsed.lastFailureAt === 'string'
                    ? parsed.lastFailureAt
                    : null,
            lastFailureReason:
                parsed.lastFailureReason === 'missing' ||
                parsed.lastFailureReason === 'template' ||
                parsed.lastFailureReason === 'format'
                    ? parsed.lastFailureReason
                    : null,
            byReason:
                parsed.byReason && typeof parsed.byReason === 'object'
                    ? parsed.byReason
                    : {},
            byPayerType:
                parsed.byPayerType && typeof parsed.byPayerType === 'object'
                    ? parsed.byPayerType
                    : {},
            byPaymentMethod:
                parsed.byPaymentMethod && typeof parsed.byPaymentMethod === 'object'
                    ? parsed.byPaymentMethod
                    : {},
        };

        if (isBillingClaimReferenceValidationTelemetryStale(normalized)) {
            clearBillingClaimReferenceValidationTelemetryFromSession();
            return createEmptyBillingClaimReferenceValidationTelemetry();
        }

        return normalized;
    } catch {
        return createEmptyBillingClaimReferenceValidationTelemetry();
    }
}

function persistBillingClaimReferenceValidationTelemetry() {
    if (typeof window === 'undefined') return;

    try {
        const nowIso = new Date().toISOString();
        billingClaimReferenceValidationTelemetry.value = {
            ...billingClaimReferenceValidationTelemetry.value,
            sessionStartedAt:
                billingClaimReferenceValidationTelemetry.value.sessionStartedAt ??
                nowIso,
            lastUpdatedAt: nowIso,
        };
        window.sessionStorage.setItem(
            billingClaimReferenceValidationTelemetrySessionKey,
            JSON.stringify(billingClaimReferenceValidationTelemetry.value),
        );
    } catch {
        // Ignore storage write failures and keep in-memory state.
    }
}

function clearBillingClaimReferenceValidationTelemetryFromSession() {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.removeItem(
            billingClaimReferenceValidationTelemetrySessionKey,
        );
    } catch {
        // Ignore storage cleanup failures.
    }
}

function pruneBillingClaimReferenceValidationTelemetryIfStale() {
    if (
        !isBillingClaimReferenceValidationTelemetryStale(
            billingClaimReferenceValidationTelemetry.value,
        )
    ) {
        return;
    }

    billingClaimReferenceValidationTelemetry.value =
        createEmptyBillingClaimReferenceValidationTelemetry();
    clearBillingClaimReferenceValidationTelemetryFromSession();
    billingClaimReferenceTelemetrySnapshotMessage.value = null;
    billingClaimReferenceTelemetrySnapshotError.value = false;
    billingClaimReferenceOverrideSnippetMessage.value = null;
    billingClaimReferenceOverrideSnippetError.value = false;
    billingClaimReferenceOverrideEnvelopeMessage.value = null;
    billingClaimReferenceOverrideEnvelopeError.value = false;
    billingClaimReferenceOverrideShellExportsMessage.value = null;
    billingClaimReferenceOverrideShellExportsError.value = false;
    billingClaimReferenceOverrideMergeSafeEnvMessage.value = null;
    billingClaimReferenceOverrideMergeSafeEnvError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysJsonError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkCursor.value = 0;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget.value = '';
}

function resetBillingClaimReferenceValidationTelemetry() {
    billingClaimReferenceValidationTelemetry.value =
        createEmptyBillingClaimReferenceValidationTelemetry();
    persistBillingClaimReferenceValidationTelemetry();
    billingClaimReferenceTelemetrySnapshotMessage.value = null;
    billingClaimReferenceTelemetrySnapshotError.value = false;
    billingClaimReferenceOverrideSnippetMessage.value = null;
    billingClaimReferenceOverrideSnippetError.value = false;
    billingClaimReferenceOverrideEnvelopeMessage.value = null;
    billingClaimReferenceOverrideEnvelopeError.value = false;
    billingClaimReferenceOverrideShellExportsMessage.value = null;
    billingClaimReferenceOverrideShellExportsError.value = false;
    billingClaimReferenceOverrideMergeSafeEnvMessage.value = null;
    billingClaimReferenceOverrideMergeSafeEnvError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysJsonError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkCursor.value = 0;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget.value = '';
}

function incrementClaimReferenceTelemetryCounter(
    counters: Record<string, number>,
    key: string,
): Record<string, number> {
    return {
        ...counters,
        [key]: (counters[key] ?? 0) + 1,
    };
}

function recordBillingClaimReferenceValidationFailure(
    reason: BillingClaimReferenceValidationFailureReason,
    payerType?: string | null,
    paymentMethod?: string | null,
) {
    pruneBillingClaimReferenceValidationTelemetryIfStale();

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();
    const current = billingClaimReferenceValidationTelemetry.value;

    const recentStartedAtMs = current.recentWindowStartedAt
        ? Date.parse(current.recentWindowStartedAt)
        : Number.NaN;
    const withinRecentWindow =
        Number.isFinite(recentStartedAtMs) &&
        nowMs - recentStartedAtMs <=
            billingClaimReferenceValidationTelemetryWindowMs.value;

    const nextRecentWindowStartedAt = withinRecentWindow
        ? current.recentWindowStartedAt
        : nowIso;
    const nextRecentWindowFailures =
        (withinRecentWindow ? current.recentWindowFailures : 0) + 1;

    const normalizedPayerType = (payerType ?? '').trim().toLowerCase();
    const normalizedMethod = (paymentMethod ?? '').trim().toLowerCase();

    billingClaimReferenceValidationTelemetry.value = {
        ...current,
        totalFailures: current.totalFailures + 1,
        recentWindowFailures: nextRecentWindowFailures,
        recentWindowStartedAt: nextRecentWindowStartedAt,
        lastFailureAt: nowIso,
        lastFailureReason: reason,
        byReason: incrementClaimReferenceTelemetryCounter(current.byReason, reason),
        byPayerType: normalizedPayerType
            ? incrementClaimReferenceTelemetryCounter(
                  current.byPayerType,
                  normalizedPayerType,
              )
            : current.byPayerType,
        byPaymentMethod: normalizedMethod
            ? incrementClaimReferenceTelemetryCounter(
                  current.byPaymentMethod,
                  normalizedMethod,
              )
            : current.byPaymentMethod,
    };
    persistBillingClaimReferenceValidationTelemetry();
}

async function writeTextToClipboard(text: string) {
    if (
        typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
    ) {
        await navigator.clipboard.writeText(text);
        return;
    }

    if (typeof document === 'undefined') {
        throw new Error('Clipboard API unavailable.');
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);

    if (!copied) {
        throw new Error('Clipboard copy fallback failed.');
    }
}

function readBillingAuditExportRetryHandoffFromSession(): BillingAuditExportRetryHandoffContext | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(
            billingAuditExportRetryHandoffSessionKey,
        );
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<BillingAuditExportRetryHandoffContext>;
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.targetInvoiceId || !parsed.jobId) return null;

        return {
            targetInvoiceId: String(parsed.targetInvoiceId),
            jobId: String(parsed.jobId),
            statusGroup: parseAuditExportStatusGroup(String(parsed.statusGroup ?? 'all')),
            page: Math.max(Number(parsed.page) || 1, 1),
            perPage: Math.max(Math.min(Number(parsed.perPage) || 8, 50), 1),
            savedAt:
                typeof parsed.savedAt === 'string' && parsed.savedAt.trim() !== ''
                    ? parsed.savedAt
                    : new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

function persistBillingAuditExportRetryHandoff(
    context: BillingAuditExportRetryHandoffContext,
) {
    if (typeof window === 'undefined') return;

    lastBillingAuditExportRetryHandoff.value = context;
    try {
        window.sessionStorage.setItem(
            billingAuditExportRetryHandoffSessionKey,
            JSON.stringify(context),
        );
    } catch {
        // Ignore storage write failures and keep in-memory state.
    }
}

function clearLastBillingAuditExportRetryHandoff() {
    lastBillingAuditExportRetryHandoff.value = null;
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.removeItem(billingAuditExportRetryHandoffSessionKey);
    } catch {
        // Ignore storage cleanup failures.
    }
}

function readBillingAuditExportRetryResumeTelemetryFromSession(): BillingAuditExportRetryResumeTelemetry {
    if (typeof window === 'undefined') {
        return {
            attempts: 0,
            successes: 0,
            failures: 0,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastFailureReason: null,
        };
    }

    try {
        const raw = window.sessionStorage.getItem(
            billingAuditExportRetryTelemetrySessionKey,
        );
        if (!raw) {
            return {
                attempts: 0,
                successes: 0,
                failures: 0,
                lastAttemptAt: null,
                lastSuccessAt: null,
                lastFailureAt: null,
                lastFailureReason: null,
            };
        }

        const parsed = JSON.parse(raw) as Partial<BillingAuditExportRetryResumeTelemetry>;
        if (!parsed || typeof parsed !== 'object') {
            return {
                attempts: 0,
                successes: 0,
                failures: 0,
                lastAttemptAt: null,
                lastSuccessAt: null,
                lastFailureAt: null,
                lastFailureReason: null,
            };
        }

        return {
            attempts: Math.max(Number(parsed.attempts) || 0, 0),
            successes: Math.max(Number(parsed.successes) || 0, 0),
            failures: Math.max(Number(parsed.failures) || 0, 0),
            lastAttemptAt:
                typeof parsed.lastAttemptAt === 'string'
                    ? parsed.lastAttemptAt
                    : null,
            lastSuccessAt:
                typeof parsed.lastSuccessAt === 'string'
                    ? parsed.lastSuccessAt
                    : null,
            lastFailureAt:
                typeof parsed.lastFailureAt === 'string'
                    ? parsed.lastFailureAt
                    : null,
            lastFailureReason:
                typeof parsed.lastFailureReason === 'string'
                    ? parsed.lastFailureReason
                    : null,
        };
    } catch {
        return {
            attempts: 0,
            successes: 0,
            failures: 0,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastFailureReason: null,
        };
    }
}

function persistBillingAuditExportRetryResumeTelemetry() {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(
            billingAuditExportRetryTelemetrySessionKey,
            JSON.stringify(billingAuditExportRetryResumeTelemetry.value),
        );
    } catch {
        // Ignore storage write failures and keep in-memory state.
    }
}

function publishBillingAuditExportRetryResumeTelemetryEvent(
    event: 'attempt' | 'success' | 'failure' | 'reset',
    failureReason?: string | null,
    context?: BillingAuditExportRetryResumeTelemetryEventContext | null,
) {
    void apiRequest('POST', '/platform/audit-export-jobs/retry-resume-telemetry/events', {
        body: {
            module: 'billing',
            event,
            failureReason: failureReason ?? null,
            targetResourceId: context?.targetResourceId ?? null,
            exportJobId: context?.exportJobId ?? null,
            handoffStatusGroup: context?.handoffStatusGroup ?? null,
            handoffPage: context?.handoffPage ?? null,
            handoffPerPage: context?.handoffPerPage ?? null,
        },
    }).catch(() => {
        // Keep queue resume UX resilient if telemetry API is unavailable.
    });
}

function recordBillingAuditExportRetryResumeAttempt(
    context?: BillingAuditExportRetryResumeTelemetryEventContext | null,
) {
    billingAuditExportRetryResumeTelemetry.value = {
        ...billingAuditExportRetryResumeTelemetry.value,
        attempts: billingAuditExportRetryResumeTelemetry.value.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
    };
    persistBillingAuditExportRetryResumeTelemetry();
    publishBillingAuditExportRetryResumeTelemetryEvent('attempt', null, context);
}

function recordBillingAuditExportRetryResumeSuccess(
    context?: BillingAuditExportRetryResumeTelemetryEventContext | null,
) {
    billingAuditExportRetryResumeTelemetry.value = {
        ...billingAuditExportRetryResumeTelemetry.value,
        successes: billingAuditExportRetryResumeTelemetry.value.successes + 1,
        lastSuccessAt: new Date().toISOString(),
        lastFailureReason: null,
    };
    persistBillingAuditExportRetryResumeTelemetry();
    publishBillingAuditExportRetryResumeTelemetryEvent('success', null, context);
}

function recordBillingAuditExportRetryResumeFailure(
    reason: string,
    context?: BillingAuditExportRetryResumeTelemetryEventContext | null,
) {
    billingAuditExportRetryResumeTelemetry.value = {
        ...billingAuditExportRetryResumeTelemetry.value,
        failures: billingAuditExportRetryResumeTelemetry.value.failures + 1,
        lastFailureAt: new Date().toISOString(),
        lastFailureReason: reason,
    };
    persistBillingAuditExportRetryResumeTelemetry();
    publishBillingAuditExportRetryResumeTelemetryEvent('failure', reason, context);
}

function resetBillingAuditExportRetryResumeTelemetry() {
    billingAuditExportRetryResumeTelemetry.value = {
        attempts: 0,
        successes: 0,
        failures: 0,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
    };
    persistBillingAuditExportRetryResumeTelemetry();
    publishBillingAuditExportRetryResumeTelemetryEvent('reset');
}

lastBillingAuditExportRetryHandoff.value =
    readBillingAuditExportRetryHandoffFromSession();
billingAuditExportRetryResumeTelemetry.value =
    readBillingAuditExportRetryResumeTelemetryFromSession();
billingClaimReferenceValidationTelemetry.value =
    readBillingClaimReferenceValidationTelemetryFromSession();

const initialCreateRouteContext = Object.freeze({
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
});
const SOURCE_WORKFLOW_KIND_LABELS = {
    appointment_consultation: 'Consultation',
    laboratory_order: 'Laboratory order',
    pharmacy_order: 'Pharmacy order',
    radiology_order: 'Radiology order',
    theatre_procedure: 'Theatre procedure',
} as const;
type SourceWorkflowKind = keyof typeof SOURCE_WORKFLOW_KIND_LABELS;
type SourceWorkflowContext = {
    kind: SourceWorkflowKind;
    id: string;
    label: string;
};

function resolveSourceWorkflowContext(): SourceWorkflowContext | null {
    const kind = queryParam('sourceWorkflowKind').trim();
    const id = queryParam('sourceWorkflowId').trim();

    if (!kind || !id) return null;
    if (!(kind in SOURCE_WORKFLOW_KIND_LABELS)) return null;

    return {
        kind: kind as SourceWorkflowKind,
        id,
        label: queryParam('sourceWorkflowLabel').trim(),
    };
}

function sourceWorkflowKindLabel(kind: SourceWorkflowKind): string {
    return SOURCE_WORKFLOW_KIND_LABELS[kind] ?? 'Source order';
}

function sourceWorkflowDisplayRef(context: SourceWorkflowContext): string {
    if (context.label.trim()) return context.label.trim();
    return shortId(context.id);
}

const initialSourceWorkflowContext = Object.freeze(resolveSourceWorkflowContext());
const initialSourceWorkflowNote = initialSourceWorkflowContext
    ? `Source: [${initialSourceWorkflowContext.kind}] ${sourceWorkflowDisplayRef(initialSourceWorkflowContext)} (id: ${initialSourceWorkflowContext.id})`
    : '';
const hasSourceWorkflowContext = computed(
    () => Boolean(initialSourceWorkflowContext),
);
const sourceWorkflowSummary = computed(() =>
    initialSourceWorkflowContext
        ? `${sourceWorkflowKindLabel(initialSourceWorkflowContext.kind)} | ${sourceWorkflowDisplayRef(initialSourceWorkflowContext)}`
        : '',
);
const sourceWorkflowKindBadge = computed(() =>
    initialSourceWorkflowContext
        ? sourceWorkflowKindLabel(initialSourceWorkflowContext.kind)
        : '',
);
const sourceWorkflowReference = computed(() =>
    initialSourceWorkflowContext
        ? sourceWorkflowDisplayRef(initialSourceWorkflowContext)
        : '',
);
const sourceWorkflowHref = computed(() => {
    if (!initialSourceWorkflowContext) return '';

    const params = new URLSearchParams();
    let base = '';

    switch (initialSourceWorkflowContext.kind) {
        case 'appointment_consultation':
            base = '/appointments';
            params.set('focusAppointmentId', initialSourceWorkflowContext.id);
            break;
        case 'laboratory_order':
            base = '/laboratory-orders';
            params.set('focusOrderId', initialSourceWorkflowContext.id);
            break;
        case 'pharmacy_order':
            base = '/pharmacy-orders';
            params.set('focusOrderId', initialSourceWorkflowContext.id);
            break;
        case 'radiology_order':
            base = '/radiology-orders';
            params.set('focusOrderId', initialSourceWorkflowContext.id);
            break;
        case 'theatre_procedure':
            base = '/theatre-procedures';
            params.set('focusProcedureId', initialSourceWorkflowContext.id);
            break;
        default:
            return '';
    }

    if (openedFromPatientChart) params.set('from', 'patient-chart');

    const queryString = params.toString();
    return queryString ? `${base}?${queryString}` : base;
});

const createForm = reactive<CreateForm>({
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
    billingPayerContractId: '',
    invoiceDate: today,
    currencyCode: defaultBillingCurrencyCode.value,
    subtotalAmount: '',
    discountAmount: '',
    taxAmount: '',
    paidAmount: '',
    paymentDueAt: '',
    notes: initialSourceWorkflowNote,
    lineItems: [createBillingLineItemDraft()],
});
const createWorkspaceDraftInvoiceId = ref(queryParam('draftInvoiceId'));
const createWorkspaceDraftInvoiceLabel = ref('');
const createWorkspaceIsEditingDraft = computed(
    () => createWorkspaceDraftInvoiceId.value.trim() !== '',
);
const createContextActiveDraftSignature = computed(() => {
    if (
        billingWorkspaceView.value !== 'create'
        || createWorkspaceIsEditingDraft.value
        || !canReadBillingInvoices.value
    ) {
        return '';
    }

    const patientId = createForm.patientId.trim();
    if (!patientId) {
        return '';
    }

    return JSON.stringify({
        patientId,
        appointmentId: createForm.appointmentId.trim(),
        admissionId: createForm.admissionId.trim(),
        billingPayerContractId: createForm.billingPayerContractId.trim(),
        currencyCode: invoiceDraftCurrencyCode(createForm.currencyCode),
    });
});
const createWorkspaceTitle = computed(() =>
    createWorkspaceIsEditingDraft.value
        ? 'Continue Draft Billing'
        : 'Create Billing Draft',
);
const createWorkspaceDescription = computed(() => {
    if (!createWorkspaceIsEditingDraft.value) {
        return 'Confirm billing context first, then build a governed draft invoice without losing the current patient handoff.';
    }

    const draftLabel =
        createWorkspaceDraftInvoiceLabel.value.trim() || 'this draft invoice';

    return `Continue ${draftLabel} in the full billing workspace so you can add missed charges, adjust lines, and save draft changes before issue.`;
});
const createWorkspaceModeBadgeLabel = computed(() =>
    createWorkspaceIsEditingDraft.value ? 'Draft workspace' : 'New draft',
);
const createContextActiveDraftLabel = computed(() =>
    createContextActiveDraft.value?.invoiceNumber?.trim()
        || 'active draft invoice',
);
const createContextActiveDraftSummary = computed(() => {
    const draft = createContextActiveDraft.value;
    if (!draft) return '';

    const parts = [
        draft.updatedAt ? `Updated ${formatDateTime(draft.updatedAt)}` : null,
        draft.totalAmount !== null && draft.totalAmount !== undefined
            ? formatMoney(draft.totalAmount, draft.currencyCode || defaultBillingCurrencyCode.value)
            : null,
        draft.lineItems?.length
            ? `${draft.lineItems.length} line${draft.lineItems.length === 1 ? '' : 's'}`
            : null,
    ].filter((value): value is string => Boolean(value));

    return parts.join(' | ');
});
const createContextActiveDraftDescription = computed(() => {
    const draftLabel = createContextActiveDraftLabel.value;

    if (hasPendingCreateWorkflow.value) {
        return `An active draft already exists for this patient billing context. Saving here will continue ${draftLabel} instead of creating a second draft.`;
    }

    return `An active draft already exists for this patient billing context. Continue ${draftLabel} so all new billable lines stay in one governed draft.`;
});
const createWorkspaceReviewStepDescription = computed(() =>
    createWorkspaceIsEditingDraft.value
        ? 'Review the updated lines, dates, and adjustments before saving draft changes.'
        : 'Review lines, dates, and adjustments before saving the draft invoice.',
);
const createWorkspaceSubmitLabel = computed(() =>
    createWorkspaceIsEditingDraft.value
        ? 'Save Draft Changes'
        : 'Save Draft',
);
const createWorkspaceSubmitLoadingLabel = computed(() =>
    createWorkspaceIsEditingDraft.value ? 'Saving draft...' : 'Creating draft...',
);
const createCoverageModeOverride = ref<BillingCreateCoverageMode | null>(null);
const createInvoiceStage = ref<'context' | 'charges' | 'finalize'>('context');
const canContinueCreateContextStage = computed(() =>
    Boolean(createForm.patientId.trim()),
);
const createLineItemWorkspaceTab = ref<'capture' | 'compose'>(
    createForm.patientId.trim() ? 'capture' : 'compose',
);
const activeCreateLineItemKey = ref('');
const BILLING_CREATE_DRAFT_STORAGE_KEY =
    'ahs.billing-invoices.create-draft.v1';

function billingCreateDraftMatchesInitialContext(
    draft: CreateForm,
): boolean {
    if (
        initialCreateRouteContext.patientId
        && draft.patientId.trim() !== initialCreateRouteContext.patientId
    ) {
        return false;
    }

    if (
        initialCreateRouteContext.appointmentId
        && draft.appointmentId.trim() !== initialCreateRouteContext.appointmentId
    ) {
        return false;
    }

    if (
        initialCreateRouteContext.admissionId
        && draft.admissionId.trim() !== initialCreateRouteContext.admissionId
    ) {
        return false;
    }

    return true;
}

const BILLING_CREATE_LEAVE_TITLE = 'Leave invoice creation?';
const BILLING_CREATE_LEAVE_DESCRIPTION = 'Invoice creation is still in progress. Stay here to finish the draft, or leave this page and restart it later.';
const hasPendingCreateWorkflow = computed(() => {
    const notesValue = stringValue(createForm.notes).trim();
    const initialNotesValue = initialSourceWorkflowNote.trim();
    const notesChanged = initialNotesValue
        ? notesValue !== initialNotesValue
        : notesValue !== '';
    const currentContractId = stringValue(createForm.billingPayerContractId).trim();
    const inheritedContractId = createCoverageAutoLinkedContractId.value.trim();
    const billingPayerContractChanged = inheritedContractId
        ? currentContractId !== inheritedContractId
        : currentContractId !== '';

    return Boolean(
        createCoverageModeOverride.value !== null
        || createForm.invoiceDate !== today
        || stringValue(createForm.currencyCode).trim().toUpperCase() !== defaultBillingCurrencyCode.value
        || stringValue(createForm.discountAmount).trim()
        || stringValue(createForm.taxAmount).trim()
        || stringValue(createForm.paymentDueAt).trim()
        || billingPayerContractChanged
        || notesChanged
        || createForm.lineItems.some((item) => !lineItemIsEffectivelyEmpty(item)),
    );
});
const {
    confirmOpen: createLeaveConfirmOpen,
    confirmLeave: confirmPendingCreateWorkflowLeave,
    cancelLeave: cancelPendingCreateWorkflowLeave,
} = usePendingWorkflowLeaveGuard({
    shouldBlock: hasPendingCreateWorkflow,
    isSubmitting: createLoading,
    blockBrowserUnload: false,
});

const billingWorkspaceView = ref<BillingWorkspaceView>(
    queryParam('focusInvoiceId')
        ? 'queue'
        : queryParam('tab') === 'new'
        ? 'create'
        : queryParam('tab') === 'board'
          ? 'board'
          : (createForm.patientId.trim() !== '' &&
                (createForm.appointmentId.trim() !== '' ||
                    createForm.admissionId.trim() !== ''))
            ? 'create'
            : 'queue',
);
const billingQueueBootstrapComplete = ref(false);
const billingBoardBootstrapComplete = ref(false);
const billingCreateBootstrapComplete = ref(false);
const {
    clearPersistedDraft: clearPersistedBillingCreateDraft,
} = useWorkflowDraftPersistence<CreateForm>({
    key: BILLING_CREATE_DRAFT_STORAGE_KEY,
    shouldPersist: hasPendingCreateWorkflow,
    capture: () => ({
        patientId: createForm.patientId,
        appointmentId: createForm.appointmentId,
        admissionId: createForm.admissionId,
        billingPayerContractId: createForm.billingPayerContractId,
        invoiceDate: createForm.invoiceDate,
        currencyCode: createForm.currencyCode,
        subtotalAmount: '',
        discountAmount: createForm.discountAmount,
        taxAmount: createForm.taxAmount,
        paidAmount: '',
        paymentDueAt: createForm.paymentDueAt,
        notes: createForm.notes,
        lineItems: createForm.lineItems.map((item) => ({
            ...item,
        })),
    }),
    restore: (draft) => {
        createForm.patientId = stringValue(draft.patientId);
        createForm.appointmentId = stringValue(draft.appointmentId);
        createForm.admissionId = stringValue(draft.admissionId);
        createForm.billingPayerContractId = stringValue(draft.billingPayerContractId);
        createForm.invoiceDate = stringValue(draft.invoiceDate);
        createForm.currencyCode = stringValue(draft.currencyCode);
        createForm.subtotalAmount = '';
        createForm.discountAmount = stringValue(draft.discountAmount);
        createForm.taxAmount = stringValue(draft.taxAmount);
        createForm.paidAmount = '';
        createForm.paymentDueAt = stringValue(draft.paymentDueAt);
        createForm.notes = stringValue(draft.notes);
        if (!createForm.notes.trim() && initialSourceWorkflowNote) {
            createForm.notes = initialSourceWorkflowNote;
        }
        createForm.lineItems = Array.isArray(draft.lineItems) && draft.lineItems.length > 0
            ? draft.lineItems.map((item) => ({
                ...createBillingLineItemDraft(),
                ...item,
            }))
            : [createBillingLineItemDraft()];
        syncImportedChargeCaptureCandidateIdsFromLineItems();
    },
    canRestore: billingCreateDraftMatchesInitialContext,
    onRestored: () => {
        createMessage.value =
            'Restored your in-progress invoice draft on this device.';
        setBillingWorkspaceView('create');
    },
});

function applyBillingCurrencyDefaults(): void {
    const currencyCode = defaultBillingCurrencyCode.value;

    if (!createForm.currencyCode.trim() || createForm.currencyCode.trim().toUpperCase() === 'TZS') {
        createForm.currencyCode = currencyCode;
    }

    if (!editForm.currencyCode.trim() || editForm.currencyCode.trim().toUpperCase() === 'TZS') {
        editForm.currencyCode = currencyCode;
    }
}

function contextCreateHref(path: string, options?: { includeTabNew?: boolean }) {
    const params = new URLSearchParams();
    const recordId = queryParam('recordId');

    if (path === '/medical-records' && recordId) {
        params.set('recordId', recordId);
    } else if (options?.includeTabNew) {
        params.set('tab', 'new');
    }

    const patientId = createForm.patientId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (patientId) params.set('patientId', patientId);
    if (appointmentId) params.set('appointmentId', appointmentId);
    if (admissionId) params.set('admissionId', admissionId);
    if (recordId && path !== '/medical-records') params.set('recordId', recordId);
    if (openedFromPatientChart) params.set('from', 'patient-chart');

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

const hasCreateMedicalRecordContext = computed(
    () => queryParam('recordId') !== '',
);

const consultationContextHref = computed(() =>
    contextCreateHref('/medical-records', {
        includeTabNew: true,
    }),
);

const consultationReturnLabel = computed(() =>
    hasCreateMedicalRecordContext.value
        ? 'Back to Current Consultation'
        : 'Back to Consultation',
);

const consultationWorkflowLabel = computed(() =>
    hasCreateMedicalRecordContext.value
        ? 'Back to Current Consultation'
        : 'New Consultation',
);

function focusBillingQueueSearch() {
    nextTick(() => {
        const refValue = billingQueueSearchInput.value;
        const element =
            refValue instanceof HTMLInputElement
                ? refValue
                : refValue?.$el instanceof Element
                  ? refValue.$el.querySelector('input')
                  : null;

        element?.focus();
        element?.select();
    });
}

function scrollToBillingQueue() {
    document.getElementById('billing-invoices-queue')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
}

function scrollToBillingBoard() {
    document.getElementById('billing-invoices-board')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
}

function scrollToCreateBillingInvoice() {
    document.getElementById('create-billing-invoice')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
    });
}

function initialCreateContextEditorTab(): CreateContextEditorTab {
    return !initialCreateRouteContext.patientId.trim()
        ? 'patient'
        : initialCreateRouteContext.admissionId.trim()
          ? 'admission'
          : initialCreateRouteContext.appointmentId.trim()
            ? 'appointment'
            : 'patient';
}

function clearCreateWorkspaceDraftTarget() {
    createWorkspaceDraftInvoiceId.value = '';
    createWorkspaceDraftInvoiceLabel.value = '';
}

function resetCreateWorkspaceToInitialContext() {
    clearCreateWorkspaceDraftTarget();
    createPatientContextLocked.value = openedFromClinicalContext.value;
    createForm.patientId = initialCreateRouteContext.patientId;
    createForm.appointmentId = initialCreateRouteContext.appointmentId;
    createForm.admissionId = initialCreateRouteContext.admissionId;
    createForm.billingPayerContractId = '';
    createForm.invoiceDate = today;
    createForm.currencyCode = defaultBillingCurrencyCode.value;
    createForm.subtotalAmount = '';
    createForm.discountAmount = '';
    createForm.taxAmount = '';
    createForm.paidAmount = '';
    createForm.paymentDueAt = '';
    createForm.notes = initialSourceWorkflowNote;
    createForm.lineItems = [createBillingLineItemDraft()];
    createCoverageModeOverride.value = null;
    createInvoiceStage.value = 'context';
    createLineItemWorkspaceTab.value = createForm.patientId.trim() ? 'capture' : 'compose';
    activeCreateLineItemKey.value = '';
    importedChargeCaptureCandidateIds.value = [];
    createContextEditorTab.value = initialCreateContextEditorTab();
    resetCreateMessages();
}

function populateCreateWorkspaceFromInvoice(invoice: BillingInvoice) {
    createWorkspaceDraftInvoiceId.value = invoice.id;
    createWorkspaceDraftInvoiceLabel.value = invoice.invoiceNumber ?? 'Draft invoice';
    createPatientContextLocked.value = true;
    createForm.patientId = invoice.patientId ?? '';
    createForm.appointmentId = invoice.appointmentId ?? '';
    createForm.admissionId = invoice.admissionId ?? '';
    createForm.billingPayerContractId = invoice.billingPayerContractId ?? '';
    createForm.invoiceDate = dateOnlyString(invoice.invoiceDate) || today;
    createForm.currencyCode =
        (invoice.currencyCode?.trim() || defaultBillingCurrencyCode.value).toUpperCase();
    createForm.subtotalAmount = '';
    createForm.discountAmount =
        amountToNumber(invoice.discountAmount ?? null) !== null
            ? String(amountToNumber(invoice.discountAmount ?? null))
            : '';
    createForm.taxAmount =
        amountToNumber(invoice.taxAmount ?? null) !== null
            ? String(amountToNumber(invoice.taxAmount ?? null))
            : '';
    createForm.paidAmount = '';
    createForm.paymentDueAt = dateOnlyString(invoice.paymentDueAt);
    createForm.notes = invoice.notes ?? '';
    createForm.lineItems =
        invoiceLineItems(invoice).length > 0
            ? invoiceLineItems(invoice).map(lineItemDraftFromInvoiceLineItem)
            : [createBillingLineItemDraft()];
    createCoverageModeOverride.value = null;
    createInvoiceStage.value = createForm.patientId.trim() ? 'charges' : 'context';
    createLineItemWorkspaceTab.value = createForm.patientId.trim() ? 'capture' : 'compose';
    activeCreateLineItemKey.value = '';
    syncImportedChargeCaptureCandidateIdsFromLineItems();
    createContextEditorTab.value = createForm.admissionId.trim()
        ? 'admission'
        : createForm.appointmentId.trim()
          ? 'appointment'
          : 'patient';
    resetCreateMessages();
}

function openDraftBillingWorkspace(invoice: BillingInvoice) {
    if ((invoice.status ?? '').trim().toLowerCase() !== 'draft') {
        notifyError('Only draft invoices can be reopened in the charge workspace.');
        return;
    }

    closeInvoiceDetailsSheet();
    closeEditInvoiceDialog();
    populateCreateWorkspaceFromInvoice(invoice);
    setBillingWorkspaceView('create', { scroll: true });
}

function setBillingWorkspaceView(
    view: BillingWorkspaceView,
    options?: { focusSearch?: boolean; scroll?: boolean },
) {
    billingWorkspaceView.value = view;
    syncBillingQueueFiltersToUrl();

    if (view === 'queue') {
        if (!billingQueueBootstrapComplete.value && !listLoading.value) {
            void reloadQueueAndSummary();
        }
        if (options?.scroll) {
            nextTick(() => scrollToBillingQueue());
        }
        if (options?.focusSearch) {
            focusBillingQueueSearch();
        }
        return;
    }

    if (view === 'board') {
        if (
            (!billingQueueBootstrapComplete.value ||
                !billingBoardBootstrapComplete.value) &&
            !listLoading.value &&
            !billingFinancialControlsLoading.value
        ) {
            void reloadQueueAndSummary();
        }
        if (options?.scroll) {
            nextTick(() => scrollToBillingBoard());
        }
        return;
    }

    if (!billingCreateBootstrapComplete.value && !billingServiceCatalogLoading.value) {
        void loadBillingServiceCatalog();
    }
    if (!billingPayerContractsLoaded.value && !billingPayerContractsLoading.value) {
        void loadBillingPayerContracts();
    }
    if (!billingChargeCaptureLoading.value) {
        void loadBillingChargeCaptureCandidates();
    }
    if (options?.scroll) {
        nextTick(() => scrollToCreateBillingInvoice());
    }
}

function openBillingBoardWorkspace() {
    setBillingWorkspaceView('board');
}

function openCreateBillingWorkspace() {
    if (createWorkspaceIsEditingDraft.value) {
        resetCreateWorkspaceToInitialContext();
    }
    setBillingWorkspaceView('create');
}

function invoiceContextHref(
    invoice: BillingInvoice,
    path: string,
    options?: { includeTabNew?: boolean },
) {
    const params = new URLSearchParams();

    if (options?.includeTabNew) {
        params.set('tab', 'new');
    }

    if (invoice.patientId) params.set('patientId', invoice.patientId);
    if (invoice.appointmentId) params.set('appointmentId', invoice.appointmentId);
    if (invoice.admissionId) params.set('admissionId', invoice.admissionId);

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

function invoicePaymentPlanCreateHref(invoice: BillingInvoice): string {
    const params = new URLSearchParams();
    params.set('billingInvoiceId', invoice.id);

    return `/billing-payment-plans?${params.toString()}`;
}

function invoiceCorporateRunHref(invoice: BillingInvoice): string {
    const params = new URLSearchParams();

    if (invoice.billingPayerContractId) {
        params.set('billingPayerContractId', invoice.billingPayerContractId);
    }

    params.set('billingInvoiceId', invoice.id);

    if (invoice.invoiceDate) {
        params.set('invoiceDate', invoice.invoiceDate);
    }

    params.set('openRunDialog', '1');

    return `/billing-corporate?${params.toString()}`;
}

function billingInvoiceQueueActionRailLabel(
    invoice: BillingInvoice | null | undefined,
): string {
    if (!invoice) return 'Invoice actions';

    const status = (invoice.status ?? '').trim().toLowerCase();
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const coveragePosture = billingInvoiceCoveragePosture(invoice);

    if (status === 'draft') {
        return 'Draft actions';
    }

    if (
        (status === 'issued' || status === 'partially_paid')
        && usesThirdPartySettlement
        && coveragePosture?.state === 'coverage_review_required'
    ) {
        return 'Coverage review';
    }

    if (
        (status === 'issued' || status === 'partially_paid')
        && usesThirdPartySettlement
        && (
            coveragePosture?.state === 'coverage_exception'
            || coveragePosture?.state === 'no_claim_route'
        )
    ) {
        return 'Coverage exception';
    }

    if (
        (status === 'issued' || status === 'partially_paid')
        && usesThirdPartySettlement
        && (
            coveragePosture?.state === 'preauthorization_required'
            || coveragePosture?.state === 'authorization_required'
        )
    ) {
        return 'Authorization follow-up';
    }

    if (
        (status === 'issued' || status === 'partially_paid')
        && usesThirdPartySettlement
        && billingInvoiceThirdPartyPhase(invoice) === 'remittance_reconciliation'
    ) {
        return 'Reconciliation actions';
    }

    if (
        (status === 'issued' || status === 'partially_paid') &&
        usesThirdPartySettlement &&
        billingInvoiceShouldPrioritizeClaimsAction(invoice)
    ) {
        return 'Claim prep actions';
    }

    if (status === 'issued' || status === 'partially_paid') {
        return usesThirdPartySettlement ? 'Third-party actions' : 'Cashier actions';
    }

    return 'Review actions';
}

function billingInvoiceQueueClaimsAction(
    invoice: BillingInvoice | null | undefined,
): { label: string; href: string } | null {
    if (!invoice || billingInvoiceSettlementMode(invoice) !== 'third_party') {
        return null;
    }

    if (canCreateClaimsInsurance.value && invoiceClaimWorkflowIsAvailable(invoice)) {
        return {
            label: invoice.claimReadiness?.ready ? 'Create Claim' : 'Prepare Claim',
            href: invoiceClaimCreateHref(invoice),
        };
    }

    if (canReadClaimsInsurance.value) {
        return {
            label: 'Claims Queue',
            href: invoiceClaimsQueueHref(invoice),
        };
    }

    return null;
}

function billingInvoiceShouldPrioritizeClaimsAction(
    invoice: BillingInvoice | null | undefined,
): boolean {
    if (!invoice) return false;

    const status = (invoice.status ?? '').trim().toLowerCase();
    if (status !== 'issued' && status !== 'partially_paid') return false;

    return billingInvoiceQueueClaimsAction(invoice) !== null;
}

const openedFromPatientChart = queryParam('from') === 'patient-chart';
const patientChartQueueRouteContext = Object.freeze({
    patientId: initialCreateRouteContext.patientId.trim(),
    appointmentId: initialCreateRouteContext.appointmentId.trim(),
    admissionId: initialCreateRouteContext.admissionId.trim(),
});
const patientChartQueueRoutePatientAvailable = computed(() =>
    patientChartQueueRouteContext.patientId !== '' &&
    !isUnavailablePatientId(patientChartQueueRouteContext.patientId),
);
const patientChartQueueFocusLocked = ref(
    openedFromPatientChart && patientChartQueueRouteContext.patientId !== '',
);
const createPatientChartHref = computed(() => patientChartHref(createForm.patientId.trim(), {
    tab: 'orders',
    appointmentId: createForm.appointmentId.trim() || null,
    admissionId: createForm.admissionId.trim() || null,
}));
const patientChartQueueReturnHref = computed(() => {
    if (!openedFromPatientChart || !patientChartQueueRoutePatientAvailable.value) {
        return null;
    }

    return patientChartHref(patientChartQueueRouteContext.patientId, {
        tab: 'orders',
        appointmentId: patientChartQueueRouteContext.appointmentId || null,
        admissionId: patientChartQueueRouteContext.admissionId || null,
    });
});
const isPatientChartQueueFocusApplied = computed(() =>
    patientChartQueueFocusLocked.value &&
    patientChartQueueRouteContext.patientId !== '' &&
    searchForm.patientId.trim() === patientChartQueueRouteContext.patientId,
);

const openedFromClinicalContext = computed(() => {
    const hasRoutePatient = initialCreateRouteContext.patientId.trim() !== '';
    const hasRouteVisit =
        initialCreateRouteContext.appointmentId.trim() !== '' ||
        initialCreateRouteContext.admissionId.trim() !== '';

    if (openedFromPatientChart) return hasRoutePatient;

    return hasRoutePatient && (hasRouteVisit || Boolean(initialSourceWorkflowContext));
});
const createPatientContextLocked = ref(openedFromClinicalContext.value);
const createContextDialogOpen = ref(false);
const createContextDialogInitialSelection = reactive({
    patientId: createForm.patientId.trim(),
    appointmentId: createForm.appointmentId.trim(),
    admissionId: createForm.admissionId.trim(),
});
const createContextEditorTab = ref<CreateContextEditorTab>(
    !createForm.patientId.trim()
        ? 'patient'
        : createForm.admissionId.trim()
          ? 'admission'
          : createForm.appointmentId.trim()
            ? 'appointment'
            : 'patient',
);
const createAppointmentSummary = ref<AppointmentSummary | null>(null);
const createAppointmentSummaryLoading = ref(false);
const createAppointmentSummaryError = ref<string | null>(null);
const createAdmissionSummary = ref<AdmissionSummary | null>(null);
const createAdmissionSummaryLoading = ref(false);
const createAdmissionSummaryError = ref<string | null>(null);
const createAppointmentSuggestions = ref<AppointmentSummary[]>([]);
const createAdmissionSuggestions = ref<AdmissionSummary[]>([]);
const createAppointmentSuggestionsLoading = ref(false);
const createAdmissionSuggestionsLoading = ref(false);
const createAppointmentSuggestionsError = ref<string | null>(null);
const createAdmissionSuggestionsError = ref<string | null>(null);
const createAppointmentLinkSource = ref<CreateContextLinkSource>(
    createForm.appointmentId.trim() ? 'route' : 'none',
);
const createAdmissionLinkSource = ref<CreateContextLinkSource>(
    createForm.admissionId.trim() ? 'route' : 'none',
);
const createContextAutoLinkSuppressed = reactive({
    appointment: false,
    admission: false,
});
const createCoverageAutoLinkedContractId = ref('');
const createVisitCoverage = computed<BillingInvoiceVisitCoverage | null>(() =>
    visitCoverageFromSummary(createAdmissionSummary.value ?? createAppointmentSummary.value),
);
const createVisitCoverageSummary = computed(() =>
    createVisitCoverage.value ? compactVisitCoverageSummary(createVisitCoverage.value) : null,
);
const createVisitCoverageContract = computed(() =>
    billingPayerContractById(createVisitCoverage.value?.billingPayerContractId ?? null),
);
const createVisitCoverageContractLabel = computed(() =>
    createVisitCoverageContract.value
        ? payerContractOptionLabel(createVisitCoverageContract.value)
        : null,
);
let createAppointmentSummaryRequestId = 0;
let createAdmissionSummaryRequestId = 0;
let createContextSuggestionsRequestId = 0;
let pendingCreateAppointmentLinkSource: CreateContextLinkSource | null = null;
let pendingCreateAdmissionLinkSource: CreateContextLinkSource | null = null;

if (createForm.patientId.trim()) {
    searchForm.patientId = createForm.patientId.trim();
}

function csrfToken(): string | null {
    const element = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    );
    return element?.content ?? null;
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: {
        query?: Record<string, string | number | boolean | string[] | null | undefined>;
        body?: Record<string, unknown>;
    },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);

    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value
                .map((item) => String(item).trim())
                .filter(Boolean)
                .forEach((item) => url.searchParams.append(key, item));
            return;
        }
        if (value === null || value === undefined || value === '') return;
        if (typeof value === 'boolean') {
            url.searchParams.set(key, value ? '1' : '0');
            return;
        }
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), {
        method,
        credentials: 'same-origin',
        headers,
        body,
    });

    const payload = (await response
        .json()
        .catch(() => ({}))) as ValidationErrorResponse;

    if (!response.ok) {
        const error = new Error(
            payload.message ?? `${response.status} ${response.statusText}`,
        ) as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

function createFieldError(key: string): string | null {
    return createErrors.value[key]?.[0] ?? null;
}

function resetCreateMessages() {
    createMessage.value = null;
    createErrors.value = {};
}

function goToPreviousCreateStage() {
    createInvoiceStage.value =
        createInvoiceStage.value === 'finalize' ? 'charges' : 'context';
}

function goToCreateChargesStage() {
    createInvoiceStage.value = 'charges';
}

function goToCreateFinalizeStage() {
    createInvoiceStage.value = 'finalize';
}

function clearCreateContextActiveDraftDebounce() {
    if (createContextActiveDraftDebounceTimer !== null) {
        window.clearTimeout(createContextActiveDraftDebounceTimer);
        createContextActiveDraftDebounceTimer = null;
    }
}

function resetCreateContextActiveDraftLookup() {
    createContextActiveDraft.value = null;
    createContextActiveDraftLoading.value = false;
    createContextActiveDraftError.value = null;
}

function billingInvoiceMatchesCreateContextDraft(invoice: BillingInvoice): boolean {
    return (invoice.patientId ?? '').trim() === createForm.patientId.trim()
        && (invoice.appointmentId ?? '').trim() === createForm.appointmentId.trim()
        && (invoice.admissionId ?? '').trim() === createForm.admissionId.trim()
        && (invoice.billingPayerContractId ?? '').trim() === createForm.billingPayerContractId.trim()
        && invoiceDraftCurrencyCode(invoice.currencyCode) === invoiceDraftCurrencyCode(createForm.currencyCode)
        && (invoice.status ?? '').trim().toLowerCase() === 'draft';
}

async function loadCreateContextActiveDraft(signature: string) {
    if (!signature) {
        resetCreateContextActiveDraftLookup();
        return;
    }

    createContextActiveDraftLoading.value = true;
    createContextActiveDraftError.value = null;

    try {
        const response = await apiRequest<BillingInvoiceListResponse>(
            'GET',
            '/billing-invoices',
            {
                query: {
                    patientId: createForm.patientId.trim(),
                    status: 'draft',
                    currencyCode: invoiceDraftCurrencyCode(createForm.currencyCode),
                    page: 1,
                    perPage: 25,
                    sortBy: 'updatedAt',
                    sortDir: 'desc',
                },
            },
        );

        if (createContextActiveDraftRequestKey !== signature) {
            return;
        }

        createContextActiveDraft.value = [...response.data]
            .filter((invoice) => billingInvoiceMatchesCreateContextDraft(invoice))
            .sort((left, right) => {
                const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
                const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();

                return rightTime - leftTime;
            })[0] ?? null;
    } catch (error) {
        if (createContextActiveDraftRequestKey !== signature) {
            return;
        }

        createContextActiveDraft.value = null;
        createContextActiveDraftError.value = messageFromUnknown(
            error,
            'Unable to check for an active draft in this billing context.',
        );
    } finally {
        if (createContextActiveDraftRequestKey === signature) {
            createContextActiveDraftLoading.value = false;
        }
    }
}

function continueCreateContextActiveDraft() {
    if (!createContextActiveDraft.value) return;

    openDraftBillingWorkspace(createContextActiveDraft.value);
}

async function previewCreateContextActiveDraft() {
    if (!createContextActiveDraft.value) return;

    await openInvoiceDetailsSheet(createContextActiveDraft.value);
}

function isForbiddenError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        Number((error as { status?: number }).status) === 403
    );
}

function isNotFoundError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        Number((error as { status?: number }).status) === 404
    );
}

function isUnavailablePatientId(patientId: string | null | undefined): boolean {
    const normalizedId = patientId?.trim?.() ?? '';
    return normalizedId !== '' && Boolean(unavailablePatientIds.value[normalizedId]);
}

function forgetPatientSummary(patientId: string): void {
    const normalizedId = patientId.trim();
    if (!normalizedId) return;

    const nextDirectory = { ...patientDirectory.value };
    delete nextDirectory[normalizedId];
    patientDirectory.value = nextDirectory;
}

function handleUnavailablePatientContext(patientId: string): void {
    const normalizedId = patientId.trim();
    if (!normalizedId) return;

    const alreadyMarkedUnavailable = Boolean(
        unavailablePatientIds.value[normalizedId],
    );

    unavailablePatientIds.value = {
        ...unavailablePatientIds.value,
        [normalizedId]: true,
    };
    forgetPatientSummary(normalizedId);

    let queueChanged = false;

    if (searchForm.patientId.trim() === normalizedId) {
        searchForm.patientId = '';
        searchForm.page = 1;
        queueChanged = true;
    }

    if (
        patientChartQueueFocusLocked.value &&
        patientChartQueueRouteContext.patientId === normalizedId
    ) {
        patientChartQueueFocusLocked.value = false;
        queueChanged = true;
    }

    if (queueChanged) {
        syncBillingQueueFiltersToUrl();
        if (
            billingWorkspaceView.value === 'queue' &&
            canReadBillingInvoices.value &&
            !listLoading.value
        ) {
            void reloadQueueAndSummary();
        }
    }

    if (createForm.patientId.trim() === normalizedId) {
        unlockCreatePatientContext();
        createForm.patientId = '';
        clearPersistedBillingCreateDraft();
    }

    if (!alreadyMarkedUnavailable) {
        notifyError(
            'Billing cleared a stale patient context because the patient record is no longer available.',
        );
    }
}

async function hydratePatientSummary(patientId: string) {
    const normalizedId = patientId.trim();
    if (
        !normalizedId ||
        unavailablePatientIds.value[normalizedId] ||
        patientDirectory.value[normalizedId] ||
        pendingPatientLookupIds.has(normalizedId)
    ) {
        return;
    }

    pendingPatientLookupIds.add(normalizedId);

    try {
        const response = await apiRequest<PatientResponse>(
            'GET',
            `/patients/${normalizedId}`,
        );
        patientDirectory.value = {
            ...patientDirectory.value,
            [normalizedId]: response.data,
        };
    } catch (error) {
        if (isNotFoundError(error)) {
            handleUnavailablePatientContext(normalizedId);
        }
        // Keep the create flow usable even if hydration fails.
    } finally {
        pendingPatientLookupIds.delete(normalizedId);
    }
}

function setCreateAppointmentLink(
    value: string,
    source: CreateContextLinkSource,
) {
    pendingCreateAppointmentLinkSource = source;
    createForm.appointmentId = value;
}

function setCreateAdmissionLink(value: string, source: CreateContextLinkSource) {
    pendingCreateAdmissionLinkSource = source;
    createForm.admissionId = value;
}

function resetCreateContextSuggestions() {
    createAppointmentSuggestions.value = [];
    createAdmissionSuggestions.value = [];
    createAppointmentSuggestionsLoading.value = false;
    createAdmissionSuggestionsLoading.value = false;
    createAppointmentSuggestionsError.value = null;
    createAdmissionSuggestionsError.value = null;
}

function clearCreateAppointmentLink(options?: {
    suppressAuto?: boolean;
    focusEditor?: boolean;
}) {
    const shouldSuppress =
        options?.suppressAuto ?? createAppointmentLinkSource.value === 'auto';
    if (shouldSuppress) {
        createContextAutoLinkSuppressed.appointment = true;
    }

    createAppointmentSummary.value = null;
    createAppointmentSummaryError.value = null;
    createAppointmentSummaryLoading.value = false;
    setCreateAppointmentLink('', 'none');

    if (options?.focusEditor ?? true) {
        createContextEditorTab.value = 'appointment';
    }
}

function clearCreateAdmissionLink(options?: {
    suppressAuto?: boolean;
    focusEditor?: boolean;
}) {
    const shouldSuppress =
        options?.suppressAuto ?? createAdmissionLinkSource.value === 'auto';
    if (shouldSuppress) {
        createContextAutoLinkSuppressed.admission = true;
    }

    createAdmissionSummary.value = null;
    createAdmissionSummaryError.value = null;
    createAdmissionSummaryLoading.value = false;
    setCreateAdmissionLink('', 'none');

    if (options?.focusEditor ?? true) {
        createContextEditorTab.value = 'admission';
    }
}

function unlockCreatePatientContext() {
    createPatientContextLocked.value = false;
    clearCreateClinicalLinks();
    createContextEditorTab.value = 'patient';
}

function setCreateCoverageMode(mode: BillingCreateCoverageMode) {
    createCoverageModeOverride.value =
        mode === suggestedCreateCoverageMode.value ? null : mode;

    if (mode === 'self_pay') {
        createForm.billingPayerContractId = '';
        createCoverageAutoLinkedContractId.value = '';
        return;
    }

    const inheritedContractId =
        createVisitCoverage.value?.billingPayerContractId?.trim() ?? '';

    if (!createForm.billingPayerContractId.trim() && inheritedContractId) {
        createForm.billingPayerContractId = inheritedContractId;
        createCoverageAutoLinkedContractId.value = inheritedContractId;
    }
}

function openCreateContextDialog(
    tab: CreateContextEditorTab = 'patient',
    options?: { unlockPatient?: boolean },
) {
    if (options?.unlockPatient) {
        unlockCreatePatientContext();
    }

    createContextEditorTab.value = tab;
    createContextDialogOpen.value = true;
}

function openCreateContextDialogForValidationErrors(
    errors: Record<string, string[]>,
) {
    if (errors.patientId?.length) {
        openCreateContextDialog('patient');
        return;
    }

    if (errors.appointmentId?.length) {
        openCreateContextDialog('appointment');
        return;
    }

    if (errors.admissionId?.length) {
        openCreateContextDialog('admission');
    }
}

function closeCreateContextDialogAfterSelection(
    kind: 'patientId' | 'appointmentId' | 'admissionId',
    selected:
        | {
              id: string;
              patientNumber?: string | null;
              firstName?: string | null;
              middleName?: string | null;
              lastName?: string | null;
          }
        | null,
) {
    if (!createContextDialogOpen.value || !selected) return;

    const nextId = selected.id?.trim?.() ?? '';
    if (!nextId) return;

    if (kind === 'patientId') {
        patientDirectory.value = {
            ...patientDirectory.value,
            [nextId]: {
                id: nextId,
                patientNumber: selected.patientNumber ?? null,
                firstName: selected.firstName ?? null,
                middleName: selected.middleName ?? null,
                lastName: selected.lastName ?? null,
            },
        };
    }

    if (createContextDialogInitialSelection[kind] === nextId) return;

    createContextDialogOpen.value = false;
}

function clearCreateClinicalLinks() {
    clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
    clearCreateAdmissionLink({ suppressAuto: false, focusEditor: false });
}

function selectSuggestedAppointment(
    appointment: AppointmentSummary,
    options?: {
        source?: Extract<CreateContextLinkSource, 'auto' | 'manual'>;
        focusEditor?: boolean;
    },
) {
    createAppointmentSummary.value = appointment;
    createAppointmentSummaryError.value = null;
    createAppointmentSummaryLoading.value = false;
    setCreateAppointmentLink(appointment.id, options?.source ?? 'manual');

    if (options?.source === 'auto') {
        createContextAutoLinkSuppressed.appointment = false;
    }

    if (options?.focusEditor) {
        createContextEditorTab.value = 'appointment';
    }
}

function selectSuggestedAdmission(
    admission: AdmissionSummary,
    options?: {
        source?: Extract<CreateContextLinkSource, 'auto' | 'manual'>;
        focusEditor?: boolean;
    },
) {
    createAdmissionSummary.value = admission;
    createAdmissionSummaryError.value = null;
    createAdmissionSummaryLoading.value = false;
    setCreateAdmissionLink(admission.id, options?.source ?? 'manual');

    if (options?.source === 'auto') {
        createContextAutoLinkSuppressed.admission = false;
    }

    if (options?.focusEditor) {
        createContextEditorTab.value = 'admission';
    }
}

function maybeAutoLinkCreateContextSuggestions() {
    if (
        !createForm.appointmentId.trim() &&
        !createContextAutoLinkSuppressed.appointment &&
        createAppointmentSuggestions.value.length === 1
    ) {
        selectSuggestedAppointment(createAppointmentSuggestions.value[0], {
            source: 'auto',
        });
    }

    if (
        !createForm.admissionId.trim() &&
        !createContextAutoLinkSuppressed.admission &&
        createAdmissionSuggestions.value.length === 1
    ) {
        selectSuggestedAdmission(createAdmissionSuggestions.value[0], {
            source: 'auto',
        });
    }
}

async function loadCreateAppointmentSummary(appointmentId: string) {
    const normalizedId = appointmentId.trim();
    const requestId = ++createAppointmentSummaryRequestId;

    if (!normalizedId) {
        createAppointmentSummary.value = null;
        createAppointmentSummaryError.value = null;
        createAppointmentSummaryLoading.value = false;
        applyVisitCoverageToCreateInvoice(createAdmissionSummary.value);
        return;
    }

    if (
        createAppointmentSummary.value?.id === normalizedId &&
        !createAppointmentSummaryError.value
    ) {
        createAppointmentSummaryLoading.value = false;
        return;
    }

    createAppointmentSummaryLoading.value = true;
    createAppointmentSummaryError.value = null;

    try {
        const response = await apiRequest<AppointmentResponse>(
            'GET',
            `/appointments/${normalizedId}`,
        );

        if (requestId !== createAppointmentSummaryRequestId) return;

        createAppointmentSummary.value = response.data;
        applyVisitCoverageToCreateInvoice(response.data);

        const linkedPatientId = response.data.patientId?.trim() ?? '';
        if (linkedPatientId !== '') {
            if (!createForm.patientId.trim()) {
                createForm.patientId = linkedPatientId;
            }
            void hydratePatientSummary(linkedPatientId);
        }
    } catch (error) {
        if (requestId !== createAppointmentSummaryRequestId) return;

        createAppointmentSummary.value = null;
        createAppointmentSummaryError.value = messageFromUnknown(
            error,
            'Unable to load appointment context.',
        );
    } finally {
        if (requestId === createAppointmentSummaryRequestId) {
            createAppointmentSummaryLoading.value = false;
        }
    }
}

async function loadCreateAdmissionSummary(admissionId: string) {
    const normalizedId = admissionId.trim();
    const requestId = ++createAdmissionSummaryRequestId;

    if (!normalizedId) {
        createAdmissionSummary.value = null;
        createAdmissionSummaryError.value = null;
        createAdmissionSummaryLoading.value = false;
        applyVisitCoverageToCreateInvoice(createAppointmentSummary.value);
        return;
    }

    if (
        createAdmissionSummary.value?.id === normalizedId &&
        !createAdmissionSummaryError.value
    ) {
        createAdmissionSummaryLoading.value = false;
        return;
    }

    createAdmissionSummaryLoading.value = true;
    createAdmissionSummaryError.value = null;

    try {
        const response = await apiRequest<AdmissionResponse>(
            'GET',
            `/admissions/${normalizedId}`,
        );

        if (requestId !== createAdmissionSummaryRequestId) return;

        createAdmissionSummary.value = response.data;
        applyVisitCoverageToCreateInvoice(response.data);

        const linkedPatientId = response.data.patientId?.trim() ?? '';
        if (linkedPatientId !== '') {
            if (!createForm.patientId.trim()) {
                createForm.patientId = linkedPatientId;
            }
            void hydratePatientSummary(linkedPatientId);
        }
    } catch (error) {
        if (requestId !== createAdmissionSummaryRequestId) return;

        createAdmissionSummary.value = null;
        createAdmissionSummaryError.value = messageFromUnknown(
            error,
            'Unable to load admission context.',
        );
    } finally {
        if (requestId === createAdmissionSummaryRequestId) {
            createAdmissionSummaryLoading.value = false;
        }
    }
}

function visitCoverageFromSummary(
    summary: AppointmentSummary | AdmissionSummary | null,
): BillingInvoiceVisitCoverage | null {
    if (!summary) return null;

    return {
        source: 'admissionNumber' in summary ? 'admission' : 'appointment',
        sourceId: summary.id,
        sourceNumber: 'admissionNumber' in summary
            ? summary.admissionNumber
            : summary.appointmentNumber,
        financialClass: normalizeFinancialClass(summary.financialClass),
        billingPayerContractId: summary.billingPayerContractId ?? null,
        coverageReference: summary.coverageReference ?? null,
        coverageNotes: summary.coverageNotes ?? null,
    };
}

function applyVisitCoverageToCreateInvoice(
    summary: AppointmentSummary | AdmissionSummary | null,
): void {
    const coverage = visitCoverageFromSummary(summary);
    const inheritedContractId = coverage?.billingPayerContractId?.trim() ?? '';
    const currentContractId = createForm.billingPayerContractId.trim();
    const previousAutoContractId = createCoverageAutoLinkedContractId.value.trim();

    if (inheritedContractId === '') {
        if (previousAutoContractId !== '' && currentContractId === previousAutoContractId) {
            createForm.billingPayerContractId = '';
        }
        createCoverageAutoLinkedContractId.value = '';
        return;
    }

    if (currentContractId === '' || currentContractId === previousAutoContractId) {
        createForm.billingPayerContractId = inheritedContractId;
        createCoverageAutoLinkedContractId.value = inheritedContractId;
    }
}

async function loadCreateContextSuggestions(patientId: string) {
    const normalizedId = patientId.trim();
    const requestId = ++createContextSuggestionsRequestId;

    if (!normalizedId) {
        resetCreateContextSuggestions();
        return;
    }

    createAppointmentSuggestionsLoading.value = true;
    createAdmissionSuggestionsLoading.value = true;
    createAppointmentSuggestionsError.value = null;
    createAdmissionSuggestionsError.value = null;

    const [appointmentsResult, admissionsResult] = await Promise.allSettled([
        apiRequest<LinkedContextListResponse<AppointmentSummary>>(
            'GET',
            '/appointments',
            {
                query: {
                    patientId: normalizedId,
                    perPage: 3,
                    page: 1,
                    sortBy: 'scheduledAt',
                    sortDir: 'desc',
                },
            },
        ),
        apiRequest<LinkedContextListResponse<AdmissionSummary>>(
            'GET',
            '/admissions',
            {
                query: {
                    patientId: normalizedId,
                    status: 'admitted',
                    perPage: 3,
                    page: 1,
                    sortBy: 'admittedAt',
                    sortDir: 'desc',
                },
            },
        ),
    ]);

    if (requestId !== createContextSuggestionsRequestId) return;

    if (appointmentsResult.status === 'fulfilled') {
        createAppointmentSuggestions.value = (
            appointmentsResult.value.data ?? []
        ).filter(
            (appointment) =>
                (appointment.patientId?.trim() ?? '') === normalizedId &&
                activeBillingAppointmentStatuses.includes(
                    (appointment.status?.trim().toLowerCase() ?? ''),
                ),
        );
        createAppointmentSuggestionsError.value = null;
    } else {
        createAppointmentSuggestions.value = [];
        createAppointmentSuggestionsError.value = isForbiddenError(
            appointmentsResult.reason,
        )
            ? null
            : messageFromUnknown(
                  appointmentsResult.reason,
                  'Unable to load appointment suggestions.',
              );
    }

    if (admissionsResult.status === 'fulfilled') {
        createAdmissionSuggestions.value = (
            admissionsResult.value.data ?? []
        ).filter(
            (admission) =>
                (admission.patientId?.trim() ?? '') === normalizedId &&
                (admission.status?.trim().toLowerCase() ?? '') === 'admitted',
        );
        createAdmissionSuggestionsError.value = null;
    } else {
        createAdmissionSuggestions.value = [];
        createAdmissionSuggestionsError.value = isForbiddenError(
            admissionsResult.reason,
        )
            ? null
            : messageFromUnknown(
                  admissionsResult.reason,
                  'Unable to load admission suggestions.',
              );
    }

    createAppointmentSuggestionsLoading.value = false;
    createAdmissionSuggestionsLoading.value = false;
    maybeAutoLinkCreateContextSuggestions();
}

async function loadScope() {
    try {
        const response = await apiRequest<{ data: ScopeData }>(
            'GET',
            '/platform/access-scope',
        );
        scope.value = response.data;
    } catch (error) {
        listErrors.value.push(
            `Scope: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

async function loadBillingPermissions() {
    await resolveBillingPermissions({
        apiRequest,
        billingWorkspaceView,
        syncBillingQueueFiltersToUrl,
        resetBillingPayerContractsState,
    });
}

function registerBillingQueueSearchInput(
    value: HTMLInputElement | { $el?: Element | null } | null,
) {
    billingQueueSearchInput.value = value;
}

async function hydrateVisiblePatients(rows: BillingInvoice[]) {
    const ids = [
        ...new Set(
            rows
                .map((row) => row.patientId)
                .filter((id): id is string => Boolean(id)),
        ),
    ];
    const uncachedIds = ids.filter(
        (id) => !patientDirectory.value[id] && !pendingPatientLookupIds.has(id),
    );

    if (uncachedIds.length === 0) return;

    uncachedIds.forEach((id) => pendingPatientLookupIds.add(id));

    const results = await Promise.allSettled(
        uncachedIds.map((id) =>
            apiRequest<PatientResponse>('GET', `/patients/${id}`),
        ),
    );

    const nextDirectory = { ...patientDirectory.value };
    results.forEach((result, index) => {
        const id = uncachedIds[index];
        pendingPatientLookupIds.delete(id);
        if (result.status !== 'fulfilled') return;
        nextDirectory[id] = result.value.data;
    });
    patientDirectory.value = nextDirectory;
}

async function loadInvoices() {
    if (!canReadBillingInvoices.value) {
        invoices.value = [];
        pagination.value = null;
        listLoading.value = false;
        pageLoading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];

    try {
        const response = await apiRequest<BillingInvoiceListResponse>(
            'GET',
            '/billing-invoices',
            {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    status: searchForm.status || null,
                    'statusIn[]':
                        !searchForm.status && searchForm.statusIn.length > 0
                            ? searchForm.statusIn
                            : null,
                    currencyCode: searchForm.currencyCode.trim() || null,
                    from: searchForm.from
                        ? `${searchForm.from} 00:00:00`
                        : null,
                    to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                    paymentActivityFrom: searchForm.paymentActivityFrom
                        ? `${searchForm.paymentActivityFrom} 00:00:00`
                        : null,
                    paymentActivityTo: searchForm.paymentActivityTo
                        ? `${searchForm.paymentActivityTo} 23:59:59`
                        : null,
                    page: searchForm.page,
                    perPage: searchForm.perPage,
                    sortBy: 'invoiceDate',
                    sortDir: 'desc',
                },
            },
        );

        invoices.value = response.data;
        pagination.value = response.meta;
        void hydrateVisiblePatients(response.data);
    } catch (error) {
        invoices.value = [];
        pagination.value = null;
        listErrors.value.push(
            error instanceof Error
                ? error.message
                : 'Unable to load billing invoices.',
        );
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}

async function loadInvoiceStatusCounts() {
    if (!canReadBillingInvoices.value) {
        billingInvoiceStatusCounts.value = null;
        return;
    }

    try {
        const response = await apiRequest<BillingInvoiceStatusCountsResponse>(
            'GET',
            '/billing-invoices/status-counts',
            {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    currencyCode: searchForm.currencyCode.trim() || null,
                    from: searchForm.from
                        ? `${searchForm.from} 00:00:00`
                        : null,
                    to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                    paymentActivityFrom: searchForm.paymentActivityFrom
                        ? `${searchForm.paymentActivityFrom} 00:00:00`
                        : null,
                    paymentActivityTo: searchForm.paymentActivityTo
                        ? `${searchForm.paymentActivityTo} 23:59:59`
                        : null,
                },
            },
        );
        billingInvoiceStatusCounts.value = response.data;
    } catch {
        billingInvoiceStatusCounts.value = null;
    }
}

async function loadFinancialControlsSummary() {
    await resolveFinancialControlsSummary({
        apiRequest,
        searchForm,
        canReadBillingFinancialControls,
        billingBoardBootstrapComplete,
    });
}

function exportFinancialControlsSummaryCsv() {
    triggerFinancialControlsSummaryCsvExport({
        searchForm,
        canReadBillingFinancialControls,
    });
}

async function reloadQueueAndSummary() {
    syncBillingQueueFiltersToUrl();
    const tasks: Promise<unknown>[] = [
        loadInvoices(),
        loadInvoiceStatusCounts(),
    ];

    if (billingWorkspaceView.value === 'board') {
        tasks.push(loadFinancialControlsSummary());
    }

    await Promise.all(tasks);
    billingQueueBootstrapComplete.value = true;
}

async function refreshPage() {
    clearSearchDebounce();
    pageLoading.value = true;
    billingQueueBootstrapComplete.value = false;
    billingBoardBootstrapComplete.value = false;
    billingCreateBootstrapComplete.value = false;
    await Promise.all([loadScope(), loadBillingPermissions(), loadCountryProfile()]);
    applyBillingCurrencyDefaults();
    if (billingWorkspaceView.value === 'create') {
        await Promise.all([
            loadBillingServiceCatalog(),
            loadBillingPayerContracts(),
            loadBillingChargeCaptureCandidates(),
        ]);
        await applyDraftWorkspaceFromQuery();
    } else {
        await reloadQueueAndSummary();
    }
    await applyBillingAuditExportRetryHandoff();
    await applyFocusedInvoiceFromQuery();

    if (billingWorkspaceView.value === 'create') {
        pageLoading.value = false;
    }
}

async function createInvoice() {
    if (createLoading.value) return;

    createLoading.value = true;
    resetCreateMessages();
    listErrors.value = [];

    if (createExceptionChargeLinesMissingReason.value.length > 0) {
        createErrors.value = {
            lineItems: [
                'Exception charges require a justification in the line note before invoice creation.',
            ],
        };
        createInvoiceStage.value = 'charges';
        createLineItemWorkspaceTab.value = 'compose';
        ensureActiveCreateLineItem(createExceptionChargeLinesMissingReason.value[0]?.key ?? null);
        createLoading.value = false;
        return;
    }

    try {
        const lineItems = normalizedCreateLineItems();
        const autoPriceLineItems = billingCreateUsesCatalogPricing.value;
        const resolvedSubtotalAmount =
            lineItems.length > 0 ? createLineItemsSubtotal.value : '';
        const editingDraftInvoiceId = createWorkspaceDraftInvoiceId.value.trim();

        if (editingDraftInvoiceId) {
            const response = await apiRequest<{ data: BillingInvoice }>(
                'PATCH',
                `/billing-invoices/${editingDraftInvoiceId}`,
                {
                    body: {
                        billingPayerContractId:
                            createForm.billingPayerContractId.trim() || null,
                        invoiceDate: createForm.invoiceDate,
                        currencyCode: createForm.currencyCode.trim().toUpperCase(),
                        subtotalAmount: resolvedSubtotalAmount,
                        discountAmount: parseOptionalNumber(createForm.discountAmount),
                        taxAmount: parseOptionalNumber(createForm.taxAmount),
                        paymentDueAt: createForm.paymentDueAt.trim() || null,
                        notes: createForm.notes.trim() || null,
                        lineItems: lineItems.length > 0 ? lineItems : null,
                    },
                },
            );

            const updatedInvoiceLabel =
                response.data.invoiceNumber ??
                (createWorkspaceDraftInvoiceLabel.value || 'billing invoice draft');
            const updatedInvoiceSettlementMode =
                billingInvoiceSettlementMode(response.data) === 'third_party'
                    ? 'Issue it next to continue payer settlement.'
                    : 'Issue it next to continue cashier collection.';
            createMessage.value = `Saved changes to ${updatedInvoiceLabel}. ${updatedInvoiceSettlementMode}`;
            notifySuccess(createMessage.value);

            const updatedPatientId = response.data.patientId ?? createForm.patientId.trim();
            resetCreateWorkspaceToInitialContext();
            clearPersistedBillingCreateDraft();
            searchForm.q = '';
            searchForm.patientId = updatedPatientId ?? '';
            searchForm.status = 'draft';
            searchForm.statusIn = [];
            searchForm.currencyCode = '';
            searchForm.from = today;
            searchForm.to = '';
            searchForm.paymentActivityFrom = '';
            searchForm.paymentActivityTo = '';
            searchForm.page = 1;
            searchForm.q = response.data.invoiceNumber?.trim() || response.data.id;
            setBillingWorkspaceView('queue', { focusSearch: true });
            await reloadQueueAndSummary();
            await openInvoiceDetailsSheet(response.data);
        } else {
            const response = await apiRequest<{
                data: BillingInvoice;
                meta?: {
                    draftReused?: boolean;
                };
            }>(
                'POST',
                '/billing-invoices',
                {
                    body: {
                        patientId: createForm.patientId.trim(),
                        appointmentId: createForm.appointmentId.trim() || null,
                        admissionId: createForm.admissionId.trim() || null,
                        billingPayerContractId:
                            createForm.billingPayerContractId.trim() || null,
                        invoiceDate: createForm.invoiceDate,
                        currencyCode: createForm.currencyCode.trim().toUpperCase(),
                        autoPriceLineItems,
                        subtotalAmount: resolvedSubtotalAmount,
                        discountAmount: parseOptionalNumber(createForm.discountAmount),
                        taxAmount: parseOptionalNumber(createForm.taxAmount),
                        paidAmount: null,
                        paymentDueAt: createForm.paymentDueAt.trim() || null,
                        notes: createForm.notes.trim() || null,
                        lineItems: lineItems.length > 0 ? lineItems : null,
                    },
                },
            );

            const createdInvoiceLabel = response.data.invoiceNumber ?? 'billing invoice draft';
            const createdInvoiceSettlementMode =
                billingInvoiceSettlementMode(response.data) === 'third_party'
                    ? 'Issue it next to start payer settlement.'
                    : 'Issue it next to start cashier collection.';
            createMessage.value = response.meta?.draftReused
                ? `Continued ${createdInvoiceLabel}. Added the new billable lines into the active draft for this patient context. ${createdInvoiceSettlementMode}`
                : `Created ${createdInvoiceLabel} as a draft. ${createdInvoiceSettlementMode}`;
            if (createMessage.value) notifySuccess(createMessage.value);
            const createdPatientId = response.data.patientId ?? createForm.patientId.trim();
            resetCreateWorkspaceToInitialContext();
            createForm.patientId = '';
            createForm.notes = '';
            createLineItemWorkspaceTab.value = createdPatientId ? 'capture' : 'compose';
            clearPersistedBillingCreateDraft();
            searchForm.q = '';
            searchForm.patientId = createdPatientId ?? '';
            searchForm.status = 'draft';
            searchForm.statusIn = [];
            searchForm.currencyCode = '';
            searchForm.from = today;
            searchForm.to = '';
            searchForm.paymentActivityFrom = '';
            searchForm.paymentActivityTo = '';
            searchForm.page = 1;
            searchForm.q =
                response.data.invoiceNumber?.trim()
                || response.data.id;
            setBillingWorkspaceView('queue', { focusSearch: true });
            await reloadQueueAndSummary();
            await openInvoiceDetailsSheet(response.data);
        }
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            openCreateContextDialogForValidationErrors(createErrors.value);
        } else {
            notifyError(apiError.message ?? 'Unable to create billing invoice.');
        }
    } finally {
        createLoading.value = false;
    }
}

function openInvoiceStatusDialog(
    invoice: BillingInvoice,
    status: BillingInvoiceStatusAction,
) {
    pruneBillingClaimReferenceValidationTelemetryIfStale();

    statusDialogInitializingPaymentMetadata.value = true;
    statusDialogInvoice.value = invoice;
    statusDialogAction.value = status;
    statusDialogError.value = null;
    statusDialogReason.value =
        status === 'cancelled' || status === 'voided'
            ? (invoice.statusReason ?? '')
            : '';
    if (status === 'partially_paid' || status === 'record_payment') {
        statusDialogPaidAmount.value =
            invoice.paidAmount === null || invoice.paidAmount === undefined
                ? ''
                : String(invoice.paidAmount);
    } else if (status === 'paid') {
        statusDialogPaidAmount.value =
            invoice.totalAmount === null || invoice.totalAmount === undefined
                ? ''
                : String(invoice.totalAmount);
    } else {
        statusDialogPaidAmount.value = '';
    }
    statusDialogPaymentPayerType.value = billingInvoicePreferredPaymentPayerType(invoice);
    statusDialogPaymentMethod.value = invoice.lastPaymentMethod ?? '';
    statusDialogPaymentReference.value = invoice.lastPaymentReference ?? '';
    statusDialogPaymentNote.value = '';
    statusDialogPaymentMethodManualOverride.value = false;
    statusDialogPaymentMethodAutoSelected.value = false;
    statusDialogPaymentAt.value =
        status === 'partially_paid' ||
        status === 'paid' ||
        status === 'record_payment'
            ? defaultLocalDateTime()
            : '';
    statusDialogAdvancedSupportOpen.value = false;
    statusDialogReferenceDiagnosticsOpen.value = false;
    statusDialogReferenceCopyToolsOpen.value = false;
    maybeAutoSelectStatusDialogPaymentMethod();
    statusDialogInitializingPaymentMetadata.value = false;
    statusDialogOpen.value = true;
}

function closeInvoiceStatusDialog() {
    statusDialogOpen.value = false;
    statusDialogAdvancedSupportOpen.value = false;
    statusDialogReferenceDiagnosticsOpen.value = false;
    statusDialogReferenceCopyToolsOpen.value = false;
    statusDialogError.value = null;
    statusDialogPaymentPayerType.value = '';
    statusDialogPaymentMethod.value = '';
    statusDialogPaymentReference.value = '';
    statusDialogPaymentNote.value = '';
    statusDialogPaymentAt.value = '';
    statusDialogPaymentMethodManualOverride.value = false;
    statusDialogPaymentMethodAutoSelected.value = false;
    statusDialogInitializingPaymentMetadata.value = false;
    statusDialogApplyingPaymentMethodAutoSelect.value = false;
    billingClaimReferenceTelemetrySnapshotMessage.value = null;
    billingClaimReferenceTelemetrySnapshotError.value = false;
    billingClaimReferenceOverrideSnippetMessage.value = null;
    billingClaimReferenceOverrideSnippetError.value = false;
    billingClaimReferenceOverrideEnvelopeMessage.value = null;
    billingClaimReferenceOverrideEnvelopeError.value = false;
    billingClaimReferenceOverrideShellExportsMessage.value = null;
    billingClaimReferenceOverrideShellExportsError.value = false;
    billingClaimReferenceOverrideMergeSafeEnvMessage.value = null;
    billingClaimReferenceOverrideMergeSafeEnvError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysJsonError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = false;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkCursor.value = 0;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget.value = '';
}

const statusDialogTitle = computed(() => {
    return billingInvoiceStatusActionLabel(
        statusDialogInvoice.value,
        statusDialogAction.value,
    );
});

const statusDialogOperationBadgeLabel = computed(() => {
    const action = statusDialogAction.value;
    const usesThirdPartySettlement = statusDialogUsesThirdPartySettlement.value;

    if (action === 'issued') {
        return usesThirdPartySettlement ? 'Draft release to settlement' : 'Draft release to collection';
    }

    if (action === 'record_payment' || action === 'partially_paid') {
        return usesThirdPartySettlement ? 'Settlement entry' : 'Collection entry';
    }

    if (action === 'paid') {
        return usesThirdPartySettlement ? 'Settlement closure' : 'Collection closure';
    }

    if (action === 'cancelled') return 'Cancellation';
    if (action === 'voided') return 'Void exception';

    return 'Billing action';
});

const statusDialogOperationHelper = computed(() => {
    const action = statusDialogAction.value;
    const usesThirdPartySettlement = statusDialogUsesThirdPartySettlement.value;
    const issueHandoff = billingInvoiceIssueHandoff(statusDialogInvoice.value);

    if (action === 'issued') {
        return issueHandoff?.afterStepHelper
            ?? (usesThirdPartySettlement
                ? 'This releases the draft into active payer settlement and claims follow-up.'
                : 'This releases the draft into active cashier collection.');
    }

    if (action === 'record_payment' || action === 'partially_paid') {
        return usesThirdPartySettlement
            ? 'Record the latest remittance, patient-share, or settlement movement against the active invoice.'
            : 'Record the latest cashier collection against the active invoice.';
    }

    if (action === 'paid') {
        return usesThirdPartySettlement
            ? 'Close the invoice once the final settlement position is confirmed.'
            : 'Close the invoice once the final collection position is confirmed.';
    }

    if (action === 'cancelled' || action === 'voided') {
        return 'This removes the invoice from active billing workflow and keeps the closure decision in audit history.';
    }

    return null;
});

const statusDialogDescription = computed(() => {
    const invoice = statusDialogInvoice.value;
    const action = statusDialogAction.value;
    if (!invoice || !action) return 'Update billing invoice status.';
    const invoiceLabel = invoice.invoiceNumber ?? 'billing invoice';
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const issueHandoff = billingInvoiceIssueHandoff(invoice);
    if (action === 'issued')
        return issueHandoff
            ? `Release ${invoiceLabel} so it moves straight into ${issueHandoff.afterStepValue.toLowerCase()}.`
            : usesThirdPartySettlement
              ? `Release ${invoiceLabel} into active settlement so payer follow-up and claim work can begin.`
              : `Release ${invoiceLabel} into active collection so cashier collection can begin.`;
    if (action === 'record_payment')
        return usesThirdPartySettlement
            ? `Record the latest settlement entry for ${invoiceLabel}. Enter the cumulative paid amount so payer and patient follow-up stay aligned.`
            : `Record the latest collection for ${invoiceLabel}. Enter the cumulative paid amount so balance and status update correctly.`;
    if (action === 'partially_paid')
        return usesThirdPartySettlement
            ? `Update the cumulative amount settled for ${invoiceLabel} while third-party follow-up remains open.`
            : `Update the cumulative amount collected for ${invoiceLabel} while settlement remains open.`;
    if (action === 'paid')
        return `Close ${invoiceLabel} as fully paid. Leave paid amount blank to use the full invoice total automatically.`;
    if (action === 'cancelled')
        return `A cancellation reason is required before closing ${invoiceLabel} as cancelled.`;
    return `A void reason is required before removing ${invoiceLabel} from active settlement.`;
});

const statusDialogLastActivityLabel = computed(() =>
    statusDialogUsesThirdPartySettlement.value
        ? 'Last Settlement Entry'
        : 'Last Collection Entry',
);

const statusDialogActionToneClass = computed(() => {
    const action = statusDialogAction.value;
    if (action === 'cancelled' || action === 'voided') {
        return 'border-destructive/30 border-l-4 border-l-destructive/70 bg-destructive/10 dark:border-destructive/40 dark:border-l-destructive/60 dark:bg-destructive/15';
    }
    if (action === 'issued') {
        return 'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30';
    }
    if (action === 'record_payment' || action === 'partially_paid') {
        return 'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30';
    }
    if (action === 'paid') {
        return 'border-emerald-200/80 border-l-4 border-l-emerald-400/70 bg-muted/20 dark:border-emerald-500/30 dark:border-l-emerald-400/50 dark:bg-muted/30';
    }
    return 'border-border bg-muted/20';
});

const statusDialogSummaryCards = computed(() => {
    const invoice = statusDialogInvoice.value;
    const action = statusDialogAction.value;
    if (!invoice || !action) return [];
    const issueHandoff = billingInvoiceIssueHandoff(invoice);

    const normalizedStatus = (invoice.status ?? '').trim().toLowerCase();
    const currentStepHelper =
        normalizedStatus === 'draft'
            ? 'Invoice is still editable and not yet active for collection.'
            : normalizedStatus === 'issued'
              ? 'Invoice is open for cashier collection or payer settlement.'
              : normalizedStatus === 'partially_paid'
                ? 'Invoice remains open because some balance is still outstanding.'
                : normalizedStatus === 'paid'
                  ? 'Invoice is already fully settled and mainly available for audit or correction.'
                  : 'Invoice is closed and no longer active for collection.';

    const actionHelper =
        action === 'issued'
            ? 'Release this invoice into active collection.'
            : action === 'record_payment'
              ? 'Capture the next cashier or payer collection.'
              : action === 'partially_paid'
                ? 'Update cumulative settlement while keeping the invoice open.'
                : action === 'paid'
                  ? 'Close the invoice with a final settlement entry.'
                  : action === 'cancelled'
                    ? 'Close the invoice and stop further collection.'
                    : 'Remove the invoice from active settlement and record why.';

    const projectedBalance = statusDialogProjectedBalance.value;
    const afterStepValue =
        action === 'issued'
            ? (issueHandoff?.afterStepValue ?? 'Collection lane opens')
            : action === 'record_payment' || action === 'partially_paid'
              ? projectedBalance !== null && projectedBalance <= 0
                ? 'Invoice closes as paid'
                : 'Balance recalculates'
              : action === 'paid'
                ? 'Settlement closes'
                : action === 'cancelled'
                  ? 'Collection stops'
                  : 'Invoice is removed';

    const afterStepHelper =
        action === 'issued'
            ? (issueHandoff?.afterStepHelper
                ?? 'Cashier collection or payer follow-up becomes the active workflow.')
            : action === 'record_payment' || action === 'partially_paid'
              ? projectedBalance !== null && projectedBalance <= 0
                ? 'This entry fully settles the invoice and moves it into paid state.'
                : 'The remaining balance stays open for further cashier or payer collection.'
              : action === 'paid'
                ? 'Invoice moves into fully paid state for history and audit review.'
                : action === 'cancelled'
                  ? 'Invoice closes as cancelled and leaves the active collection queue.'
                  : 'Void closes the invoice as a billing exception for audit follow-up.';

    return [
        {
            id: 'current-step',
            title: 'Current step',
            value: formatEnumLabel(invoice.status),
            helper: currentStepHelper,
            badgeVariant: 'outline',
        },
        {
            id: 'this-action',
            title: 'This action',
            value: billingInvoiceStatusActionLabel(invoice, action),
            helper: actionHelper,
            badgeVariant:
                action === 'cancelled' || action === 'voided'
                    ? 'destructive'
                    : 'secondary',
        },
        {
            id: 'after-step',
            title: 'After this step',
            value: afterStepValue,
            helper: afterStepHelper,
            badgeVariant: 'outline',
        },
    ];
});
const statusDialogSettlementBadgeLabel = computed(() =>
    billingInvoiceClaimPostureLabel(statusDialogInvoice.value),
);
const statusDialogSettlementBadgeVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    const invoice = statusDialogInvoice.value;
    if (invoice?.claimReadiness?.ready) return 'secondary';
    if (invoice?.claimReadiness?.claimEligible) return 'outline';
    if (billingInvoiceSettlementMode(invoice) === 'third_party') return 'outline';
    return 'default';
});
const statusDialogUsesThirdPartySettlement = computed(
    () => billingInvoiceSettlementMode(statusDialogInvoice.value) === 'third_party',
);
const statusDialogSettlementSectionTitle = computed(() =>
    statusDialogUsesThirdPartySettlement.value
        ? 'Who pays and where this goes'
        : 'Billing path',
);
const statusDialogSettlementSectionDescription = computed(() =>
    statusDialogUsesThirdPartySettlement.value
        ? 'Keep this entry aligned with the patient share and third-party route already attached to the invoice.'
        : 'This invoice stays in direct patient collection unless billing responsibility changes later.',
);
const statusDialogSettlementSummaryRows = computed(() => {
    const invoice = statusDialogInvoice.value;
    if (!invoice) return [];

    const currencyCode =
        invoice.currencyCode?.trim()?.toUpperCase() || defaultBillingCurrencyCode.value;

    return [
        {
            key: 'path',
            title: 'Billing path',
            value: billingInvoiceSettlementPathLabel(invoice),
        },
        {
            key: 'payer',
            title: 'Third-party share',
            value: formatMoney(
                invoice.payerSummary?.expectedPayerAmount ?? 0,
                currencyCode,
            ),
        },
        {
            key: 'patient',
            title: 'Patient share',
            value: formatMoney(
                invoice.payerSummary?.expectedPatientAmount ?? invoice.totalAmount ?? 0,
                currencyCode,
            ),
        },
    ];
});
const statusDialogSettlementNoticeLines = computed(() => {
    const invoice = statusDialogInvoice.value;
    if (!invoice) return [];
    const issueHandoff = billingInvoiceIssueHandoff(invoice);

    if (statusDialogAction.value === 'issued' && issueHandoff) {
        return [issueHandoff.afterStepHelper];
    }

    if ((invoice.claimReadiness?.blockingReasons.length ?? 0) > 0) {
        return invoice.claimReadiness?.blockingReasons ?? [];
    }

    if ((invoice.claimReadiness?.guidance.length ?? 0) > 0) {
        return invoice.claimReadiness?.guidance ?? [];
    }

    if (billingInvoiceSettlementMode(invoice) === 'third_party') {
        return [
            'This invoice is on a third-party settlement path. Record payer remittance or approved patient share against the same settlement context.',
        ];
    }

    return [
        'This invoice is self-pay. Cashier or direct patient collection is the expected next lane after issue.',
    ];
});
const statusDialogSettlementNoticeVariant = computed<
    'default' | 'destructive'
>(() =>
    (statusDialogInvoice.value?.claimReadiness?.blockingReasons.length ?? 0) > 0
        ? 'destructive'
        : 'default',
);

function statusDialogQueueAfterSubmitState(
    invoice: BillingInvoice,
    action: BillingInvoiceStatusAction,
    projectedBalance: number | null,
): { value: string; helper: string } {
    const issueHandoff = billingInvoiceIssueHandoff(invoice);
    const usesThirdPartySettlement = billingInvoiceSettlementMode(invoice) === 'third_party';

    if (action === 'issued') {
        return {
            value: issueHandoff?.afterStepValue ?? 'Active billing queue',
            helper:
                issueHandoff?.afterStepHelper
                ?? 'This invoice becomes active in the billing queue immediately after release.',
        };
    }

    if (action === 'record_payment' || action === 'partially_paid') {
        if (projectedBalance !== null && projectedBalance <= 0) {
            return {
                value: 'Paid history & audit',
                helper: 'The invoice closes as paid after this entry posts.',
            };
        }

        return {
            value: usesThirdPartySettlement
                ? 'Open settlement follow-up'
                : 'Cashier balance follow-up',
            helper: usesThirdPartySettlement
                ? 'Third-party follow-up stays active until the remaining balance closes.'
                : 'Cashier collection stays open until the remaining balance reaches zero.',
        };
    }

    if (action === 'paid') {
        return {
            value: 'Paid history & audit',
            helper: 'This invoice leaves active collection and stays available for history, print, and audit.',
        };
    }

    if (action === 'cancelled') {
        return {
            value: 'Cancelled exception trail',
            helper: 'Collection stops and the invoice stays visible for exception review and audit.',
        };
    }

    return {
        value: 'Void exception trail',
        helper: 'The invoice is removed from active settlement and stays available for audit follow-up.',
    };
}

const statusDialogExecutionPreviewCards = computed<BillingDialogPreviewCard[]>(() => {
    const invoice = statusDialogInvoice.value;
    const action = statusDialogAction.value;
    if (!invoice || !action) return [];

    const projectedBalance = statusDialogProjectedBalance.value;
    const currentQueueStep = billingInvoiceQueueNextStep(invoice);
    const queueAfterSubmit = statusDialogQueueAfterSubmitState(invoice, action, projectedBalance);

    const financialEffect =
        action === 'issued'
            ? {
                  value: 'No ledger movement',
                  helper: 'Issue changes workflow state only. Money is still unchanged until collection or settlement posts.',
              }
            : action === 'record_payment' || action === 'partially_paid'
              ? {
                    value: formatMoney(projectedBalance, statusDialogCurrencyCode.value),
                    helper: 'Projected balance after this cumulative payment update is saved.',
                    valueClass:
                        projectedBalance !== null && projectedBalance > 0
                            ? 'text-amber-600 dark:text-amber-300'
                            : undefined,
                }
              : action === 'paid'
                ? {
                      value: formatMoney(0, statusDialogCurrencyCode.value),
                      helper: 'This action closes the balance and marks the invoice as fully settled.',
                  }
                : {
                      value: 'Collection stops',
                      helper:
                          action === 'cancelled'
                              ? 'No further collection should continue on this invoice after cancellation.'
                              : 'Void removes this invoice from active billing operations.',
                  };

    const correctionPath =
        action === 'record_payment' || action === 'partially_paid' || action === 'paid'
            ? {
                  value: 'Payment reversal',
                  helper: 'Ledger entries stay immutable. Later corrections happen through governed reversal entries in payment history.',
              }
            : action === 'issued'
              ? {
                    value: currentQueueStep?.title ?? 'Status control',
                    helper:
                        'If release was incorrect, use governed status actions before further collection or claim work continues.',
                }
              : {
                    value: 'Audit-required follow-up',
                    helper: 'Destructive billing actions rely on the recorded reason and audit trail for any later correction.',
                };

    const reasonOrReference =
        action === 'cancelled' || action === 'voided'
            ? {
                  value: 'Reason required',
                  helper: 'A clear cancellation or void reason is mandatory for audit and operational review.',
              }
            : action === 'record_payment' || action === 'partially_paid' || action === 'paid'
              ? {
                    value: statusDialogPaymentReferenceRequired.value
                        ? 'Reference required'
                        : 'Reference recommended',
                    helper: statusDialogPaymentReferenceRequired.value
                        ? 'This settlement route requires a reference before the payment can be posted safely.'
                        : 'Capture the latest transaction or remittance reference so reconciliation stays clean.',
                }
              : {
                    value: 'Handoff ready',
                    helper: 'This release is driven by queue routing and claim/cashier posture, not by payment metadata.',
                };

    return [
        {
            title: 'Queue after submit',
            value: queueAfterSubmit.value,
            helper: queueAfterSubmit.helper,
        },
        {
            title: 'Financial effect',
            value: financialEffect.value,
            helper: financialEffect.helper,
            valueClass: financialEffect.valueClass,
        },
        {
            title: 'Correction path',
            value: correctionPath.value,
            helper: correctionPath.helper,
        },
        {
            title: 'Control check',
            value: reasonOrReference.value,
            helper: reasonOrReference.helper,
        },
    ];
});

const statusDialogRouteControlCards = computed<BillingDialogPreviewCard[]>(() => {
    const invoice = statusDialogInvoice.value;
    const action = statusDialogAction.value;
    if (!invoice || !action) return [];

    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const thirdPartyPhase = billingInvoiceThirdPartyPhase(invoice);
    const coveragePosture = billingInvoiceCoveragePosture(invoice);
    const payerLabel =
        (invoice.payerSummary?.payerName ?? '').trim()
        || billingPaymentPayerTypeLabel(invoice.payerSummary?.payerType ?? null);
    const paymentPayerType =
        statusDialogPaymentPayerType.value.trim()
        || invoice.payerSummary?.payerType
        || null;
    const paymentMethod = statusDialogPaymentMethod.value.trim() || null;
    const methodLabel = billingPaymentMethodLabel(paymentMethod);
    const dueLabel = invoice.payerSummary?.claimSubmissionDueAt
        ? formatDate(invoice.payerSummary.claimSubmissionDueAt)
        : invoice.payerSummary?.claimSubmissionDeadlineDays
          ? `${invoice.payerSummary.claimSubmissionDeadlineDays} day claim window`
          : null;
    const settlementCycleLabel = invoice.payerSummary?.settlementCycleDays
        ? `${invoice.payerSummary.settlementCycleDays} day settlement cycle`
        : null;
    const queueAfterSubmit = statusDialogQueueAfterSubmitState(
        invoice,
        action,
        statusDialogProjectedBalance.value,
    );

    let workspaceValue = 'Cashier collection';
    let workspaceHelper = 'Cashier collection remains the operational home for the next step on this invoice.';
    let proofValue = 'Receipt and posting trail';
    let proofHelper =
        'Carry the exact receipt, cashier posting note, or operator reference that supports this invoice movement.';
    let timingValue = 'Same business shift';
    let timingHelper = 'Use the business date and current shift so cashier and ledger control stay aligned.';
    const correctionValue = 'Governed reversal only';
    let correctionHelper =
        action === 'issued'
            ? 'If release was wrong, use governed status control before any payment or claim posting happens.'
            : 'If the posting is wrong later, correct it through immutable ledger reversal rather than overwriting history.';

    if (action === 'issued') {
        workspaceValue = queueAfterSubmit.value ?? 'Operational billing queue';
        workspaceHelper = queueAfterSubmit.value
            ? `${queueAfterSubmit.value} becomes the active workspace as soon as release is saved.`
            : 'The next operational billing queue becomes active immediately after release.';

        if (usesThirdPartySettlement) {
            if (coveragePosture?.state === 'manual_review') {
                proofValue = 'Coverage review basis';
                proofHelper =
                    'Carry the manual coverage note, excluded-service explanation, or patient-share basis before claim work continues.';
                timingValue = 'Before claim prep resumes';
                timingHelper =
                    'Clear the coverage decision first so payer follow-up does not proceed under the wrong route.';
            } else if (coveragePosture?.state === 'no_claim_route') {
                proofValue = 'Exception and split-bill basis';
                proofHelper =
                    'Carry the no-claim-route decision, exclusion reason, or split-billing basis before payer follow-up continues.';
                timingValue = 'Before more settlement posts';
                timingHelper =
                    'Exception handling owns the next step until the claim path or patient-share route is corrected.';
            } else if (
                invoice.claimReadiness?.requiresPreAuthorization
                || invoice.claimReadiness?.requiresManualAuthorization
            ) {
                proofValue = 'Authorization proof';
                proofHelper =
                    'Carry the guarantee letter, approval number, or payer authorization trail before claim release continues.';
                timingValue = 'Before claim release';
                timingHelper =
                    'Authorization follow-up must close before clean submission or settlement posting continues.';
            } else if (thirdPartyPhase === 'remittance_reconciliation') {
                proofValue = 'Remittance and control reference';
                proofHelper =
                    'Carry the remittance advice, payer control number, or bank proof that matches this invoice exactly.';
                timingValue = settlementCycleLabel ?? 'Current reconciliation cycle';
                timingHelper =
                    'Keep payer remittance and patient-share follow-up aligned until the balance closes.';
            } else {
                proofValue = 'Claim submission pack';
                proofHelper = dueLabel
                    ? `Carry the payer control number, attachments, and contract context before the ${dueLabel} submission target slips.`
                    : 'Carry the payer control number, guarantee, and contract context into claim prep or submission.';
                timingValue = dueLabel ?? 'Current claim window';
                timingHelper =
                    'Keep the invoice moving inside the payer submission window and do not let it drift back into manual follow-up.';
            }
        } else {
            proofValue = paymentMethod === 'mobile_money'
                ? 'Mobile money transaction ID'
                : 'Receipt and cashier trail';
            proofHelper = billingPaymentOperationalProofText(paymentPayerType, paymentMethod);
        }
    } else if (usesThirdPartySettlement) {
        if (coveragePosture?.state === 'manual_review') {
            workspaceValue = 'Coverage review';
            workspaceHelper =
                'Manual payer coverage review is the active operational owner until the claim route is cleared again.';
            proofValue = 'Coverage decision trail';
            proofHelper =
                'Keep the review basis, excluded-service note, and patient-share split decision together with this posting.';
            timingValue = 'Before next payer posting';
            timingHelper =
                'Do not continue payer settlement or submission until the manual review decision is explicit.';
        } else if (coveragePosture?.state === 'no_claim_route') {
            workspaceValue = 'Coverage exception follow-up';
            workspaceHelper =
                'Exception handling owns the next step until claim routing and patient-share posture are corrected.';
            proofValue = 'Exception basis';
            proofHelper =
                'Keep the exclusion reason, split-bill basis, or patient-share guarantee with the invoice before more follow-up is posted.';
            timingValue = 'Before route is reopened';
            timingHelper =
                'Resolve the exception before more payer-side activity is posted against the invoice.';
        } else if (
            invoice.claimReadiness?.requiresPreAuthorization
            || invoice.claimReadiness?.requiresManualAuthorization
        ) {
            workspaceValue = 'Authorization follow-up';
            workspaceHelper =
                'Payer authorization remains the governing lane before clean claim release or settlement continuation.';
            proofValue = 'Authorization pack';
            proofHelper =
                'Keep approval number, guarantee letter, and service-level authorization proof attached to this invoice context.';
            timingValue = 'Before release or next remittance';
            timingHelper =
                'Authorization must close before more payer follow-up is treated as clean and claim-safe.';
        } else if (thirdPartyPhase === 'remittance_reconciliation') {
            workspaceValue = 'Remittance & reconciliation';
            workspaceHelper =
                'Reconciliation remains the active workspace while payer remittance and patient-share balances are being matched.';
            proofValue = methodLabel;
            proofHelper = billingPaymentOperationalProofText(paymentPayerType, paymentMethod);
            timingValue = settlementCycleLabel ?? 'Current remittance cycle';
            timingHelper =
                'Keep remittance timing and patient-share follow-up aligned so the open balance does not drift.';
            correctionHelper =
                'Any wrong settlement entry should be corrected through governed reversal while keeping payer and patient-share money separate.';
        } else {
            workspaceValue = invoice.claimReadiness?.ready ? 'Claim submission' : 'Claim prep';
            workspaceHelper = invoice.claimReadiness?.ready
                ? 'The invoice is claim-ready and should move through submission or payer-side follow-up without losing its contract context.'
                : 'Claim prep remains active while payer follow-up and readiness checks continue.';
            proofValue = 'Claim control pack';
            proofHelper = billingPaymentOperationalProofText(paymentPayerType, paymentMethod);
            timingValue = dueLabel ?? 'Current claim window';
            timingHelper =
                'Keep the claim or payer control number attached before this invoice moves deeper into claim handling.';
        }
    } else {
        workspaceValue = paymentMethod === 'mobile_money'
            ? 'Cashier mobile-money follow-up'
            : 'Cashier collection';
        workspaceHelper =
            'Cashier remains the active operational owner until the self-pay balance reaches zero or a governed correction is needed.';
        proofValue = methodLabel;
        proofHelper = billingPaymentOperationalProofText(paymentPayerType, paymentMethod);
    }

    return [
        {
            title: 'Next workspace',
            value: workspaceValue,
            helper: workspaceHelper,
        },
        {
            title: 'Proof to carry',
            value: proofValue,
            helper: proofHelper,
        },
        {
            title: 'Timing target',
            value: timingValue,
            helper: timingHelper,
        },
        {
            title: 'Correction discipline',
            value: correctionValue,
            helper: correctionHelper,
        },
    ];
});

const statusDialogFooterGuidance = computed(() => {
    const action = statusDialogAction.value;
    const cards = statusDialogExecutionPreviewCards.value;
    const queueCard = cards[0];
    const correctionCard = cards[2];

    if (!action) return 'Review the action impact before saving this billing change.';

    if (action === 'issued') {
        return `${queueCard?.value ?? 'The next billing queue'} becomes active immediately after release.`;
    }

    if (action === 'record_payment' || action === 'partially_paid' || action === 'paid') {
        return `${correctionCard?.value ?? 'Payment history'} remains the correction path after this immutable ledger entry is saved.`;
    }

    return 'This action is audit-sensitive. Keep the recorded reason precise and operationally clear.';
});

const statusDialogPaymentSectionTitle = computed(() =>
    statusDialogAction.value === 'paid'
        ? 'Close with final entry'
        : statusDialogUsesThirdPartySettlement.value
          ? 'Record settlement entry'
          : 'Record collection entry',
);

const statusDialogPaymentSectionDescription = computed(() => {
    const action = statusDialogAction.value;
    const invoice = statusDialogInvoice.value;
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    if (action === 'record_payment') {
        return usesThirdPartySettlement
            ? 'Enter the new cumulative paid amount and capture the payer or patient settlement metadata for this remittance entry.'
            : 'Enter the new cumulative paid amount and the payment metadata for this collection entry.';
    }
    if (action === 'partially_paid') {
        return usesThirdPartySettlement
            ? 'Update cumulative settlement while leaving the invoice open for the remaining payer or patient balance.'
            : 'Update the cumulative paid amount while leaving the invoice open for the remaining balance.';
    }
    if (action === 'paid') {
        return usesThirdPartySettlement
            ? 'Confirm the final cumulative paid amount and the closing settlement metadata for the completed payer path.'
            : 'Confirm the final cumulative paid amount and the closing settlement metadata.';
    }
    return null;
});

const statusDialogPaidAmountFieldLabel = computed(() => {
    if (!statusDialogShowsPaidAmount.value) return 'Amount';

    if (statusDialogUsesThirdPartySettlement.value) {
        return statusDialogPaidAmountRequired.value
            ? 'Cumulative Settled Amount'
            : 'Final Settled Amount (Optional)';
    }

    return statusDialogPaidAmountRequired.value
        ? 'Cumulative Collected Amount'
        : 'Final Collected Amount (Optional)';
});

const statusDialogSubmitButtonLabel = computed(() => {
    const action = statusDialogAction.value;
    if (!action) return 'Update Billing Invoice';

    if (action === 'issued') {
        return statusDialogUsesThirdPartySettlement.value
            ? 'Release to Settlement'
            : 'Release to Collection';
    }

    if (action === 'record_payment') {
        return statusDialogUsesThirdPartySettlement.value
            ? 'Save Settlement Entry'
            : 'Save Collection Entry';
    }

    if (action === 'partially_paid') {
        return statusDialogUsesThirdPartySettlement.value
            ? 'Update Settlement Position'
            : 'Update Collection Position';
    }

    if (action === 'paid') {
        return statusDialogUsesThirdPartySettlement.value
            ? 'Close as Settled'
            : 'Close as Paid';
    }

    return billingInvoiceStatusActionLabel(statusDialogInvoice.value, action);
});

const statusDialogSubmitLoadingLabel = computed(() => {
    const action = statusDialogAction.value;

    if (action === 'issued') return 'Releasing...';
    if (action === 'record_payment' || action === 'partially_paid') {
        return statusDialogUsesThirdPartySettlement.value
            ? 'Saving settlement...'
            : 'Saving collection...';
    }
    if (action === 'paid') return 'Closing invoice...';
    if (action === 'cancelled') return 'Cancelling...';
    if (action === 'voided') return 'Voiding...';

    return 'Updating...';
});

const statusDialogReasonSectionTitle = computed(() =>
    statusDialogAction.value === 'cancelled'
        ? 'Cancellation note'
        : 'Void note',
);

const statusDialogReasonSectionDescription = computed(() =>
    statusDialogAction.value === 'cancelled'
        ? 'Explain why collection is being closed as cancelled for this invoice.'
        : 'Explain why this invoice should be voided and removed from active settlement.',
);

const statusDialogNeedsReason = computed(
    () =>
        statusDialogAction.value === 'cancelled' ||
        statusDialogAction.value === 'voided',
);

const statusDialogShowsPaidAmount = computed(
    () =>
        statusDialogAction.value === 'record_payment' ||
        statusDialogAction.value === 'partially_paid' ||
        statusDialogAction.value === 'paid',
);

const statusDialogPaidAmountRequired = computed(
    () =>
        statusDialogAction.value === 'record_payment' ||
        statusDialogAction.value === 'partially_paid',
);

const statusDialogCurrencyCode = computed(
    () =>
        statusDialogInvoice.value?.currencyCode?.trim()?.toUpperCase() ||
        defaultBillingCurrencyCode.value,
);

const statusDialogTotalAmount = computed(() =>
    amountToNumber(statusDialogInvoice.value?.totalAmount ?? null),
);

const statusDialogCurrentPaidAmount = computed(() =>
    amountToNumber(statusDialogInvoice.value?.paidAmount ?? null) ?? 0,
);

const statusDialogOutstandingAmount = computed(() => {
    const invoice = statusDialogInvoice.value;
    if (!invoice) return null;

    const explicitBalance = amountToNumber(invoice.balanceAmount ?? null);
    if (explicitBalance !== null) return Math.max(explicitBalance, 0);

    const total = statusDialogTotalAmount.value;
    if (total === null) return null;
    return Math.max(total - statusDialogCurrentPaidAmount.value, 0);
});

const statusDialogPaidAmountParsed = computed<number | null>(() => {
    if (!statusDialogShowsPaidAmount.value) return null;
    const trimmedAmount = statusDialogPaidAmount.value.trim();
    if (trimmedAmount === '') return null;
    const parsed = Number(trimmedAmount);
    return Number.isFinite(parsed) ? parsed : null;
});

const statusDialogProjectedPaidAmount = computed<number | null>(() => {
    if (!statusDialogShowsPaidAmount.value) return null;

    const parsed = statusDialogPaidAmountParsed.value;
    if (parsed !== null) return parsed;

    if (statusDialogAction.value === 'paid') {
        return statusDialogTotalAmount.value;
    }

    return null;
});

const statusDialogProjectedBalance = computed<number | null>(() => {
    const total = statusDialogTotalAmount.value;
    const projectedPaid = statusDialogProjectedPaidAmount.value;

    if (total === null || projectedPaid === null) return null;
    return total - projectedPaid;
});

const statusDialogIncomingPaymentAmount = computed<number | null>(() => {
    const projectedPaid = statusDialogProjectedPaidAmount.value;
    if (projectedPaid === null) return null;
    return Math.max(projectedPaid - statusDialogCurrentPaidAmount.value, 0);
});

const statusDialogAmountHelper = computed(() => {
    if (!statusDialogShowsPaidAmount.value) return null;

    const action = statusDialogAction.value;
    if (action === 'record_payment' || action === 'partially_paid') {
        return 'Enter the cumulative amount received so far. If 10,000 was already captured and 5,000 is received now, enter 15,000.';
    }

    return 'Leave blank to use the full invoice total, or enter the final cumulative paid amount if closure differs slightly.';
});

const statusDialogRequiresPaymentMetadata = computed(
    () => statusDialogShowsPaidAmount.value,
);
const statusDialogPaymentPayerTypeFieldLabel = computed(() =>
    statusDialogUsesThirdPartySettlement.value ? 'Received From' : 'Collected From',
);
const statusDialogPaymentMethodFieldLabel = computed(() =>
    statusDialogUsesThirdPartySettlement.value ? 'Settlement Method' : 'Collection Method',
);
const statusDialogPaymentAtFieldLabel = computed(() =>
    statusDialogUsesThirdPartySettlement.value ? 'Settled At' : 'Collected At',
);
const statusDialogPaymentPreviewCards = computed<BillingDialogPreviewCard[]>(() => {
    if (!statusDialogShowsPaidAmount.value) return [];

    const currency = statusDialogCurrencyCode.value;
    const projectedBalance = statusDialogProjectedBalance.value;

    return [
        {
            title: 'Current paid',
            value: formatMoney(statusDialogCurrentPaidAmount.value, currency),
            helper: statusDialogUsesThirdPartySettlement.value
                ? 'Already settled on this invoice.'
                : 'Already collected on this invoice.',
        },
        {
            title: statusDialogUsesThirdPartySettlement.value
                ? 'Incoming settlement'
                : 'Incoming collection',
            value: formatMoney(statusDialogIncomingPaymentAmount.value, currency),
            helper: 'Difference from the current paid amount before this ledger entry.',
        },
        {
            title: 'Projected balance',
            value: formatMoney(projectedBalance, currency),
            helper:
                projectedBalance !== null && projectedBalance <= 0
                    ? 'This entry settles the invoice and moves it to paid.'
                    : 'This is the balance that remains after the entry posts.',
            valueClass:
                projectedBalance !== null && projectedBalance > 0
                    ? 'text-amber-600 dark:text-amber-300'
                    : undefined,
        },
        {
            title: 'Posting route',
            value: [
                statusDialogSelectedPaymentPayerTypeLabel.value ?? 'Select payer route',
                statusDialogSelectedPaymentMethodLabel.value ?? 'Select method',
            ].join(' / '),
            helper: statusDialogPaymentReferenceRequired.value
                ? 'Reference capture is required before this payment can post.'
                : 'Payer route and method drive the immutable ledger trail.',
        },
    ];
});
const statusDialogPostingSnapshotCards = computed<BillingDialogPreviewCard[]>(() => {
    if (!statusDialogShowsPaidAmount.value) return [];

    const reference = statusDialogPaymentReference.value.trim();
    const postingAt = statusDialogPaymentAt.value.trim();

    return [
        {
            title: 'Collected from',
            value: statusDialogSelectedPaymentPayerTypeLabel.value ?? 'Choose payer route',
            helper: statusDialogUsesThirdPartySettlement.value
                ? 'Payer-side settlement owner for this ledger entry.'
                : 'Cashier-side source for this collection entry.',
        },
        {
            title: 'Method',
            value: statusDialogSelectedPaymentMethodLabel.value ?? 'Choose method',
            helper: reference
                ? 'Method and reference will stay together in the immutable ledger trail.'
                : 'Method selection drives the control proof expected before submit.',
        },
        {
            title: 'Control reference',
            value: reference || (statusDialogPaymentReferenceRequired.value ? 'Required before submit' : 'Optional'),
            helper: statusDialogPaymentReferenceRequired.value
                ? 'This route cannot post without a valid control or transaction reference.'
                : 'Add a reference when available to strengthen reconciliation later.',
            valueClass:
                !reference && statusDialogPaymentReferenceRequired.value
                    ? 'text-amber-600 dark:text-amber-300'
                    : undefined,
        },
        {
            title: 'Posting time',
            value: postingAt ? formatDateTime(postingAt) : 'Not set',
            helper: postingAt
                ? 'Business date and time that will be stored on the payment ledger entry.'
                : 'Confirm the business date and time before posting.',
        },
    ];
});
const statusDialogPostingChecklistItems = computed(() => {
    if (!statusDialogShowsPaidAmount.value) return [] as string[];

    const items: string[] = [];
    const paymentMethod = statusDialogPaymentMethod.value.trim();

    if (statusDialogUsesThirdPartySettlement.value) {
        items.push(
            'Confirm this posting belongs to payer settlement or remittance follow-up, not direct patient cashier collection.',
        );

        if (statusDialogClaimReferenceRequired.value) {
            items.push(
                'Use the payer-issued claim, control, or remittance number before posting the settlement entry.',
            );
        }

        if (paymentMethod === 'bank_transfer') {
            items.push(
                'Match the bank transfer or deposit advice to this invoice before posting payer settlement.',
            );
        } else if (paymentMethod === 'cheque') {
            items.push(
                'Record the cheque number and keep the supporting bank/issuer details in the settlement note.',
            );
        } else if (paymentMethod === 'insurance_claim') {
            items.push(
                'Keep the claim/remittance control number aligned with the payer document that finance will reconcile later.',
            );
        }
    } else {
        items.push(
            'Confirm the patient-share amount received now and keep the cumulative amount accurate before posting.',
        );

        if (paymentMethod === 'cash') {
            items.push(
                'Use the cashier receipt/daybook number if one has already been issued for this collection.',
            );
        } else if (paymentMethod === 'mobile_money') {
            items.push(
                'Capture the telecom transaction ID exactly as received from M-Pesa, Airtel Money, Tigo Pesa, or HaloPesa.',
            );
        } else if (paymentMethod === 'card') {
            items.push(
                'Use the POS approval code or terminal reference from the printed slip.',
            );
        } else if (paymentMethod === 'bank_transfer') {
            items.push(
                'Check the bank transfer or deposit slip reference before final cashier posting.',
            );
        } else if (paymentMethod === 'waiver') {
            items.push(
                'Waiver posting should include approval reference and a short note describing the approving authority or policy basis.',
            );
        }
    }

    return items;
});
const statusDialogPaymentReferenceFieldLabel = computed(() => {
    if (statusDialogClaimReferenceRequired.value) return 'Claim / Remittance Reference';
    return statusDialogUsesThirdPartySettlement.value
        ? 'Settlement Reference'
        : 'Payment Reference';
});
const statusDialogPaymentNoteFieldLabel = computed(() =>
    statusDialogUsesThirdPartySettlement.value ? 'Settlement Note' : 'Collection Note',
);
const statusDialogPaymentNotePlaceholder = computed(() =>
    statusDialogUsesThirdPartySettlement.value
        ? 'Optional settlement note (remittance batch, payer follow-up, patient-share context...)'
        : 'Optional collection note (cashier handoff, reconciliation context, partial payment note...)',
);
const statusDialogPaymentNoteHelper = computed(() =>
    statusDialogUsesThirdPartySettlement.value
        ? 'Stored in the immutable payment ledger entry for this settlement.'
        : 'Stored in the immutable payment ledger entry for this collection.',
);
const statusDialogReferenceSupportLabel = computed(() =>
    statusDialogAdvancedSupportOpen.value
        ? 'Hide reference support'
        : 'Show reference support',
);
const statusDialogReferenceSupportDescription = computed(() =>
    statusDialogUsesThirdPartySettlement.value
        ? 'Open only if you need help validating or troubleshooting claim/control references for this settlement.'
        : 'Open only if you need extra help with reconciliation references for this collection entry.',
);
const statusDialogReferenceDiagnosticsLabel = computed(() =>
    statusDialogReferenceDiagnosticsOpen.value
        ? 'Hide troubleshooting diagnostics'
        : 'Show troubleshooting diagnostics',
);
const statusDialogReferenceCopyToolsLabel = computed(() =>
    statusDialogReferenceCopyToolsOpen.value
        ? 'Hide copy tools'
        : 'Show copy tools',
);
const statusDialogReferenceDiagnosticsDescription = computed(() => {
    if (statusDialogClaimReferenceTelemetryHasData.value) {
        return statusDialogUsesThirdPartySettlement.value
            ? 'Recent reference validation failures were recorded in this session. Open diagnostics for telemetry, override guidance, and copy tools.'
            : 'Recent reconciliation reference validation failures were recorded in this session. Open diagnostics for telemetry and copy tools.';
    }

    return statusDialogUsesThirdPartySettlement.value
        ? 'No recent validation failures are recorded. Open diagnostics only when you need policy telemetry or override copy tools for payer troubleshooting.'
        : 'No recent validation failures are recorded. Open diagnostics only when you need extra telemetry or copy tools for collection troubleshooting.';
});

const statusDialogPaymentPayerTypeLabel = computed(() => {
    const value = statusDialogInvoice.value?.lastPaymentPayerType ?? null;
    if (!value) return null;
    const match = billingPaymentPayerTypeOptions.find((option) => option.value === value);
    return match?.label ?? formatEnumLabel(value);
});

const statusDialogPaymentMethodLabel = computed(() => {
    const value = statusDialogInvoice.value?.lastPaymentMethod ?? null;
    if (!value) return null;
    const match = billingPaymentMethodOptions.find((option) => option.value === value);
    return match?.label ?? formatEnumLabel(value);
});

const statusDialogSelectedPaymentPayerTypeLabel = computed(() => {
    const value = statusDialogPaymentPayerType.value.trim();
    if (!value) return null;
    const match = billingPaymentPayerTypeOptions.find((option) => option.value === value);
    return match?.label ?? formatEnumLabel(value);
});

const statusDialogSelectedPaymentMethodLabel = computed(() => {
    const value = statusDialogPaymentMethod.value.trim();
    if (!value) return null;
    const match = billingPaymentMethodOptions.find((option) => option.value === value);
    return match?.label ?? formatEnumLabel(value);
});
const statusDialogPaymentRouteQuickActions = computed(() => {
    const preferredPayerType = statusDialogPreferredPaymentPayerType.value;

    if (statusDialogUsesThirdPartySettlement.value) {
        return [
            {
                key: 'insurance-claim',
                label: 'Claim route',
                helper: 'Insurance claim / remittance reference',
                payerType: preferredPayerType,
                paymentMethod: 'insurance_claim',
            },
            {
                key: 'bank-transfer',
                label: 'Bank transfer',
                helper: 'Direct payer settlement through bank',
                payerType: preferredPayerType,
                paymentMethod: 'bank_transfer',
            },
            {
                key: 'cheque',
                label: 'Cheque',
                helper: 'Cheque settlement or manual remittance',
                payerType: preferredPayerType,
                paymentMethod: 'cheque',
            },
            {
                key: 'other-third-party',
                label: 'Other settlement',
                helper: 'Non-standard payer settlement',
                payerType: preferredPayerType,
                paymentMethod: 'other',
            },
        ] as const;
    }

    return [
        {
            key: 'cash',
            label: 'Cash',
            helper: 'Front-desk or cashier cash collection',
            payerType: 'self_pay',
            paymentMethod: 'cash',
        },
        {
            key: 'mobile-money',
            label: 'Mobile money',
            helper: 'M-Pesa, Airtel Money, Tigo Pesa, HaloPesa',
            payerType: 'self_pay',
            paymentMethod: 'mobile_money',
        },
        {
            key: 'card',
            label: 'Card',
            helper: 'POS or card terminal collection',
            payerType: 'self_pay',
            paymentMethod: 'card',
        },
        {
            key: 'bank-transfer',
            label: 'Bank transfer',
            helper: 'Bank deposit or transfer confirmation',
            payerType: 'self_pay',
            paymentMethod: 'bank_transfer',
        },
        {
            key: 'waiver',
            label: 'Waiver',
            helper: 'Governed patient-share waiver entry',
            payerType: 'self_pay',
            paymentMethod: 'waiver',
        },
    ] as const;
});
const statusDialogPaymentRouteQuickActionLabel = computed(() =>
    statusDialogUsesThirdPartySettlement.value
        ? 'Common settlement routes'
        : 'Common cashier routes',
);
const statusDialogPaymentRouteQuickActionDescription = computed(() =>
    statusDialogUsesThirdPartySettlement.value
        ? 'Use the fastest payer settlement route for this invoice.'
        : 'Use the common Tanzania cashier collection routes without re-entering the payer path each time.',
);

const statusDialogClaimReferenceRequired = computed(
    () =>
        statusDialogShowsPaidAmount.value &&
        billingPayerTypesRequiringClaimReference.has(
            statusDialogPaymentPayerType.value.trim(),
        ),
);

const statusDialogPaymentReferenceRequired = computed(
    () =>
        statusDialogShowsPaidAmount.value &&
        (billingPaymentMethodsRequiringReference.has(
            statusDialogPaymentMethod.value.trim(),
        ) ||
            statusDialogClaimReferenceRequired.value),
);

const statusDialogPaymentReferenceHelper = computed(() => {
    if (!statusDialogShowsPaidAmount.value) return null;
    if (
        statusDialogClaimReferenceRequired.value &&
        statusDialogSelectedPaymentMethodLabel.value
    ) {
        return `Reference is required for ${statusDialogSelectedPaymentPayerTypeLabel.value ?? 'this payer type'} settlements. Include the claim/control number for ${statusDialogSelectedPaymentMethodLabel.value}.`;
    }
    if (statusDialogClaimReferenceRequired.value) {
        return `Reference is required for ${statusDialogSelectedPaymentPayerTypeLabel.value ?? 'this payer type'} settlements.`;
    }
    if (statusDialogPaymentReferenceRequired.value) {
        return `Reference is required for ${statusDialogSelectedPaymentMethodLabel.value ?? 'this payment method'} to support reconciliation.`;
    }
    return 'Capture the latest payment transaction reference for cashier reconciliation.';
});

const statusDialogPaymentReferencePlaceholder = computed(() => {
    if (!statusDialogClaimReferenceRequired.value) {
        return 'Receipt number, mobile transaction ID, claim reference...';
    }
    const payerType = statusDialogPaymentPayerType.value.trim();
    const payerExamples =
        billingClaimReferenceExamplesByPayer[
            payerType as keyof typeof billingClaimReferenceExamplesByPayer
        ] ?? billingClaimReferenceFormatExamples;
    return `Claim/control number (e.g. ${payerExamples[0]})`;
});

const statusDialogPaymentReferenceControlHint = computed(() => {
    if (!statusDialogShowsPaidAmount.value) return null;

    const paymentMethod = statusDialogPaymentMethod.value.trim();

    switch (paymentMethod) {
        case 'mobile_money':
            return 'Use the telecom transaction ID from M-Pesa, Airtel Money, Tigo Pesa, or HaloPesa. Do not use an internal note as the payment reference.';
        case 'cash':
            return 'Use the cashier receipt or daybook receipt number when one is issued for this collection.';
        case 'card':
            return 'Use the POS approval code or card terminal reference printed on the slip.';
        case 'bank_transfer':
            return 'Use the bank transfer/deposit reference from the slip, teller, or bank confirmation message.';
        case 'cheque':
            return 'Use the cheque number as the payment reference and capture bank details in the note when needed.';
        case 'waiver':
            return 'Waiver entries should carry the approval case reference and note the approving authority for audit.';
        case 'insurance_claim':
            return 'Use the payer-issued claim, control, or remittance reference that the insurer will use during submission or settlement follow-up.';
        default:
            return null;
    }
});

const statusDialogClaimReferenceFormatHint = computed(() => {
    if (!statusDialogClaimReferenceRequired.value) return null;
    const payerType = statusDialogPaymentPayerType.value.trim();
    const payerExamples =
        billingClaimReferenceExamplesByPayer[
            payerType as keyof typeof billingClaimReferenceExamplesByPayer
        ] ?? billingClaimReferenceFormatExamples;
    return `Format hint: 6-120 chars, start with letter/number; allowed separators: -, /, _, ., :. Examples: ${payerExamples.join(' or ')}.`;
});

const statusDialogClaimReferenceFormatInvalid = computed(() => {
    if (!statusDialogClaimReferenceRequired.value) return false;
    const reference = statusDialogPaymentReference.value.trim();
    if (!reference) return false;
    if (isTemplateLikeClaimReference(reference, statusDialogPaymentPayerType.value.trim())) {
        return false;
    }
    return !billingClaimReferenceFormatPattern.test(reference);
});

const statusDialogClaimReferenceTemplateLike = computed(() => {
    if (!statusDialogClaimReferenceRequired.value) return false;
    const reference = statusDialogPaymentReference.value.trim();
    if (!reference) return false;
    return isTemplateLikeClaimReference(
        reference,
        statusDialogPaymentPayerType.value.trim(),
    );
});

const statusDialogClaimReferenceFrequentFailureHint = computed(() => {
    if (!statusDialogClaimReferenceRequired.value) return null;

    const telemetry = billingClaimReferenceValidationTelemetry.value;
    const recentWindowStartedAtMs = telemetry.recentWindowStartedAt
        ? Date.parse(telemetry.recentWindowStartedAt)
        : Number.NaN;
    const withinRecentWindow =
        Number.isFinite(recentWindowStartedAtMs) &&
        Date.now() - recentWindowStartedAtMs <=
            billingClaimReferenceValidationTelemetryWindowMs.value;
    if (
        !withinRecentWindow ||
        telemetry.recentWindowFailures <
            billingClaimReferenceValidationFrequentThreshold.value
    ) {
        return null;
    }

    const payerType = statusDialogPaymentPayerType.value.trim().toLowerCase();
    const payerTypeFailureCount = payerType
        ? telemetry.byPayerType[payerType] ?? 0
        : 0;

    if (payerType && payerTypeFailureCount >= 2) {
        return `Repeated claim-reference validation failures detected for ${statusDialogSelectedPaymentPayerTypeLabel.value ?? 'this payer type'} in this session. Use quick-fill templates and confirm payer-issued control number before submit.`;
    }

    return 'Repeated claim-reference validation failures detected in this session. Use quick-fill templates and verify payer-issued control numbers before submit.';
});

const statusDialogClaimReferenceTelemetryHasData = computed(
    () => billingClaimReferenceValidationTelemetry.value.totalFailures > 0,
);

const statusDialogClaimReferenceTelemetryRecentWindowFailures = computed(() => {
    const telemetry = billingClaimReferenceValidationTelemetry.value;
    const startedAtMs = telemetry.recentWindowStartedAt
        ? Date.parse(telemetry.recentWindowStartedAt)
        : Number.NaN;
    const withinRecentWindow =
        Number.isFinite(startedAtMs) &&
        Date.now() - startedAtMs <=
            billingClaimReferenceValidationTelemetryWindowMs.value;
    if (!withinRecentWindow) return 0;
    return telemetry.recentWindowFailures;
});

const statusDialogClaimReferenceTelemetryReasonCounts = computed(() => {
    const byReason = billingClaimReferenceValidationTelemetry.value.byReason;
    return {
        missing: byReason.missing ?? 0,
        template: byReason.template ?? 0,
        format: byReason.format ?? 0,
    };
});

const statusDialogClaimReferenceTelemetryPayerFailures = computed(() => {
    const payerType = statusDialogPaymentPayerType.value.trim().toLowerCase();
    if (!payerType) return 0;
    return billingClaimReferenceValidationTelemetry.value.byPayerType[payerType] ?? 0;
});

const statusDialogClaimReferenceTelemetryLastFailureLabel = computed(() => {
    const lastFailureAt =
        billingClaimReferenceValidationTelemetry.value.lastFailureAt;
    if (!lastFailureAt) return null;

    const parsedMs = Date.parse(lastFailureAt);
    if (!Number.isFinite(parsedMs)) return null;
    return new Date(parsedMs).toLocaleString();
});

const statusDialogClaimReferenceTelemetryLastFailureReasonLabel = computed(() =>
    claimReferenceFailureReasonLabel(
        billingClaimReferenceValidationTelemetry.value.lastFailureReason,
    ),
);

const statusDialogClaimReferenceTelemetrySessionStartedLabel = computed(() => {
    const value = billingClaimReferenceValidationTelemetry.value.sessionStartedAt;
    if (!value) return null;
    const parsedMs = Date.parse(value);
    if (!Number.isFinite(parsedMs)) return null;
    return new Date(parsedMs).toLocaleString();
});

const statusDialogClaimReferenceTelemetryLastUpdatedLabel = computed(() => {
    const value = billingClaimReferenceValidationTelemetry.value.lastUpdatedAt;
    if (!value) return null;
    const parsedMs = Date.parse(value);
    if (!Number.isFinite(parsedMs)) return null;
    return new Date(parsedMs).toLocaleString();
});

const statusDialogClaimReferenceTelemetryPolicySourceSummary = computed(() => {
    const sources = billingClaimReferenceValidationPolicy.value.sources;

    return [
        `Overall ${claimReferencePolicySourceLabel(sources.overall)}`,
        `Window ${claimReferencePolicySourceLabel(sources.windowMinutes)}`,
        `Inactivity ${claimReferencePolicySourceLabel(sources.inactivityMinutes)}`,
        `Max age ${claimReferencePolicySourceLabel(sources.maxSessionAgeHours)}`,
        `Threshold ${claimReferencePolicySourceLabel(sources.frequentFailureThreshold)}`,
    ].join(' | ');
});

const statusDialogClaimReferenceTelemetryOverrideResolutionSummary = computed(() => {
    const policy = billingClaimReferenceValidationPolicy.value;
    const resolution = claimReferencePolicyOverrideResolutionLabel(
        policy.overrideResolution,
    );
    return policy.overrideMatchedKey
        ? `${resolution} (${policy.overrideMatchedKey})`
        : resolution;
});

const statusDialogClaimReferenceTelemetryProfileProvenanceSummary = computed(() => {
    const policy = billingClaimReferenceValidationPolicy.value;
    const provenanceLabel = claimReferencePolicyProfileProvenanceLabel(
        policy.profileProvenance,
    );

    if (policy.profileProvenance === 'facility_code_hit') {
        return `${provenanceLabel} (${policy.profileProvenanceContext.facilityCode ?? 'n/a'})`;
    }

    if (policy.profileProvenance === 'tenant_code_hit') {
        return `${provenanceLabel} (${policy.profileProvenanceContext.tenantCode ?? 'n/a'})`;
    }

    return `${provenanceLabel} (no facility/tenant code available)`;
});

const statusDialogClaimReferenceTelemetryProfileNormalizationSummary = computed(
    () => {
        const context =
            billingClaimReferenceValidationPolicy.value.profileProvenanceContext;
        const facilitySummary = claimReferencePolicyCodeNormalizationLabel(
            context.facilityCodeRaw,
            context.facilityCode,
        );
        const tenantSummary = claimReferencePolicyCodeNormalizationLabel(
            context.tenantCodeRaw,
            context.tenantCode,
        );
        return `Facility ${facilitySummary} | Tenant ${tenantSummary}`;
    },
);

const statusDialogClaimReferenceTelemetryProfilePrecedenceSummary = computed(() => {
    const context =
        billingClaimReferenceValidationPolicy.value.profileProvenanceContext;
    const facility = context.facilityCode;
    const tenant = context.tenantCode;

    if (facility && tenant) {
        return `Both facility and tenant codes are present; facility takes precedence (selected "${facility}", tenant "${tenant}" ignored for key selection).`;
    }

    if (facility) {
        return `Only facility code is present; facility key "${facility}" is selected.`;
    }

    if (tenant) {
        return `Only tenant code is present; tenant key "${tenant}" is selected.`;
    }

    return 'No facility or tenant code is available; default key "default" is selected.';
});

const statusDialogClaimReferenceTelemetryProfileSelectionMismatchMessage =
    computed(() => {
        const mismatch =
            billingClaimReferenceValidationPolicy.value.profileSelectionMismatch;
        if (!mismatch) return null;

        const selectedLabel = claimReferencePolicyProfileProvenanceLabel(
            mismatch.selectedProvenance,
        );
        const alternateLabel = claimReferencePolicyProfileProvenanceLabel(
            mismatch.alternateProvenance,
        );

        return `Selected profile "${mismatch.selectedKey}" (${selectedLabel}) has no exact override, but alternate "${mismatch.alternateKey}" (${alternateLabel}) does. Add an override for "${mismatch.selectedKey}" or adjust scope-code precedence if that alternate should be selected.`;
    });

const statusDialogClaimReferenceTelemetryOverrideSnippet = computed(() => {
    const policy = billingClaimReferenceValidationPolicy.value;
    return `"${policy.profileKey}":{"windowMinutes":${policy.windowMinutes},"inactivityMinutes":${policy.inactivityMinutes},"maxSessionAgeHours":${policy.maxSessionAgeHours},"frequentFailureThreshold":${policy.frequentFailureThreshold}}`;
});

const statusDialogClaimReferenceTelemetryOverrideEnvelope = computed(
    () => `{${statusDialogClaimReferenceTelemetryOverrideSnippet.value}}`,
);

const statusDialogClaimReferenceTelemetryOverrideEnvLine = computed(() => {
    const configKey = 'VITE_BILLING_CLAIM_REF_TELEMETRY_POLICY_OVERRIDES';
    return `${configKey}=${statusDialogClaimReferenceTelemetryOverrideEnvelope.value}`;
});

const statusDialogClaimReferenceTelemetryOverridePowerShellExportLine = computed(
    () => {
        const configKey = 'VITE_BILLING_CLAIM_REF_TELEMETRY_POLICY_OVERRIDES';
        const escapedValue = escapeForPowerShellSingleQuotedString(
            statusDialogClaimReferenceTelemetryOverrideEnvelope.value,
        );
        return `$env:${configKey}='${escapedValue}'`;
    },
);

const statusDialogClaimReferenceTelemetryOverrideBashExportLine = computed(() => {
    const configKey = 'VITE_BILLING_CLAIM_REF_TELEMETRY_POLICY_OVERRIDES';
    const escapedValue = escapeForBashSingleQuotedString(
        statusDialogClaimReferenceTelemetryOverrideEnvelope.value,
    );
    return `export ${configKey}='${escapedValue}'`;
});

const statusDialogClaimReferenceTelemetryOverrideShellExportsSnippet = computed(
    () =>
        [
            '# PowerShell',
            statusDialogClaimReferenceTelemetryOverridePowerShellExportLine.value,
            '# bash',
            statusDialogClaimReferenceTelemetryOverrideBashExportLine.value,
        ].join('\n'),
);

const statusDialogClaimReferenceTelemetryOverrideMergedEnvelope = computed(() => {
    const policy = billingClaimReferenceValidationPolicy.value;
    const mergedOverrides: Record<string, BillingClaimReferenceValidationPolicyOverride> =
        {
            ...billingClaimReferenceValidationPolicyOverrides,
            [policy.profileKey]: {
                windowMinutes: policy.windowMinutes,
                inactivityMinutes: policy.inactivityMinutes,
                maxSessionAgeHours: policy.maxSessionAgeHours,
                frequentFailureThreshold: policy.frequentFailureThreshold,
            },
        };
    return JSON.stringify(mergedOverrides);
});

const statusDialogClaimReferenceTelemetryOverrideMergeSafeEnvLine = computed(() => {
    const configKey = 'VITE_BILLING_CLAIM_REF_TELEMETRY_POLICY_OVERRIDES';
    return `${configKey}=${statusDialogClaimReferenceTelemetryOverrideMergedEnvelope.value}`;
});

const statusDialogClaimReferenceTelemetryOverrideMergeTemplateWithPlaceholder =
    computed(() => {
        const configKey = 'VITE_BILLING_CLAIM_REF_TELEMETRY_POLICY_OVERRIDES';
        return `${configKey}=<EXISTING_OVERRIDES_JSON_OBJECT_WITH_OTHER_PROFILE_ENTRIES> + {${statusDialogClaimReferenceTelemetryOverrideSnippet.value}}`;
    });

const billingClaimReferenceMergePreviewPreservedKeysPreviewLimit = 8;

const statusDialogClaimReferenceTelemetryOverrideMergePreview = computed(() => {
    const policy = billingClaimReferenceValidationPolicy.value;
    const existingProfileKeys = Object.keys(
        billingClaimReferenceValidationPolicyOverrides,
    ).sort();
    const preservedProfileKeys = existingProfileKeys
        .filter((key) => key !== policy.profileKey)
        .sort();
    const selectedProfileWillOverwrite = existingProfileKeys.includes(
        policy.profileKey,
    );

    return {
        existingProfileCount: existingProfileKeys.length,
        preservedProfileCount: preservedProfileKeys.length,
        preservedProfileKeys,
        selectedProfileAction: selectedProfileWillOverwrite
            ? ('overwrite' as const)
            : ('add' as const),
        selectedProfileConfirmation: selectedProfileWillOverwrite
            ? `Selected profile "${policy.profileKey}" already exists and will be overwritten by generated merge output.`
            : `Selected profile "${policy.profileKey}" is missing and will be added by generated merge output.`,
    };
});

const statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysLabel =
    computed(() => {
        const keys =
            statusDialogClaimReferenceTelemetryOverrideMergePreview.value
                .preservedProfileKeys;
        if (keys.length === 0) return 'none';
        const preview = keys.slice(
            0,
            billingClaimReferenceMergePreviewPreservedKeysPreviewLimit,
        );
        const omittedCount = Math.max(keys.length - preview.length, 0);
        if (omittedCount === 0) return preview.join(', ');
        return `${preview.join(', ')} ...and ${omittedCount} more`;
    });

const statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysOmittedCount =
    computed(() => {
        const preservedCount =
            statusDialogClaimReferenceTelemetryOverrideMergePreview.value
                .preservedProfileCount;
        return Math.max(
            preservedCount -
                billingClaimReferenceMergePreviewPreservedKeysPreviewLimit,
            0,
        );
    });

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysText =
    computed(() => {
        const keys =
            statusDialogClaimReferenceTelemetryOverrideMergePreview.value
                .preservedProfileKeys;
        if (keys.length === 0) return 'No preserved profile keys.';
        return [
            'Billing Claim Reference Merge Preview Preserved Profile Keys (Full)',
            `Count: ${keys.length}`,
            ...keys,
        ].join('\n');
    });

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJson =
    computed(() => {
        const keys =
            statusDialogClaimReferenceTelemetryOverrideMergePreview.value
                .preservedProfileKeys;
        return JSON.stringify(keys);
    });

const billingClaimReferenceMergePreviewChunkBytesPreviewLimit = 12;

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics =
    computed(() =>
        billingClaimReferenceMergePreviewPayloadDiagnostics(
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysText.value,
            'Full keys (newline)',
        ),
    );

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics =
    computed(() =>
        billingClaimReferenceMergePreviewPayloadDiagnostics(
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJson.value,
            'Full keys (JSON)',
        ),
    );

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCopyRecommended =
    computed(
        () =>
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics.value
                .bytes >= billingClaimReferenceMergePreviewPayloadWarningThresholdBytes,
    );

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloads =
    computed(() =>
        buildBillingClaimReferenceMergePreviewKeyChunks(
            statusDialogClaimReferenceTelemetryOverrideMergePreview.value
                .preservedProfileKeys,
        ),
    );

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount =
    computed(
        () =>
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloads.value
                .length,
    );

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible =
    computed(
        () =>
            statusDialogClaimReferenceTelemetryOverrideMergePreview
                .value.preservedProfileCount > 0 &&
            (statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCopyRecommended.value ||
                statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value >
                    1),
    );

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkQuickJumpVisible =
    computed(
        () =>
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible.value &&
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value >
                1,
    );

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtFirstBoundary =
    computed(() => {
        const cursor =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCursorNormalized.value;
        return cursor === null || cursor === 0;
    });

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtLastBoundary =
    computed(() => {
        const cursor =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCursorNormalized.value;
        const chunkCount =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value;
        if (cursor === null || chunkCount === 0) return true;
        return cursor === chunkCount - 1;
    });

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloadBytes =
    computed(() =>
        statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloads.value.map(
            (payload) => billingClaimReferencePayloadUtf8ByteLength(payload),
        ),
    );

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCursorNormalized =
    computed(() => {
        const chunkCount =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value;
        if (chunkCount === 0) return null;

        return (
            billingClaimReferenceMergePreviewFullPreservedKeysChunkCursor.value %
            chunkCount
        );
    });

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentIndex =
    computed(() => {
        const cursor =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCursorNormalized.value;
        if (cursor === null) return null;
        return cursor + 1;
    });

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextIndex =
    computed(() => {
        const cursor =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCursorNormalized.value;
        const chunkCount =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value;
        if (cursor === null || chunkCount === 0) return null;
        return ((cursor + 1) % chunkCount) + 1;
    });

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentBytes =
    computed(() => {
        const cursor =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCursorNormalized.value;
        if (cursor === null) return null;

        const payloadBytes =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloadBytes.value[
                cursor
            ];
        return payloadBytes ?? null;
    });

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextBytes =
    computed(() => {
        const cursor =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCursorNormalized.value;
        const chunkCount =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value;
        if (cursor === null || chunkCount === 0) return null;

        const nextIndex = (cursor + 1) % chunkCount;
        const payloadBytes =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloadBytes.value[
                nextIndex
            ];
        return payloadBytes ?? null;
    });

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkBytesOmittedCount =
    computed(() =>
        Math.max(
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloadBytes.value
                .length - billingClaimReferenceMergePreviewChunkBytesPreviewLimit,
            0,
        ),
    );

const statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkBytesPreviewLabel =
    computed(() => {
        const payloadBytes =
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloadBytes.value;
        if (payloadBytes.length === 0) return 'none';

        const preview = payloadBytes
            .slice(0, billingClaimReferenceMergePreviewChunkBytesPreviewLimit)
            .map((bytes, index) => `#${index + 1}: ${bytes} bytes`);
        const omittedCount = Math.max(payloadBytes.length - preview.length, 0);
        if (omittedCount === 0) return preview.join(', ');
        return `${preview.join(', ')} ...and ${omittedCount} more`;
    });

function statusDialogClaimReferenceTelemetryMergeSafeParseWarningText():
    | string
    | null {
    const diagnostic =
        billingClaimReferenceValidationPolicy.value.overridesParseDiagnostic;
    if (!diagnostic) return null;

    const parseWarning =
        claimReferencePolicyOverridesParseDiagnosticMessage(diagnostic);
    return `Merge-safe helper fallback active: current overrides JSON is invalid/unparseable (${parseWarning}). Generated merge-safe line cannot preserve unknown existing entries from that invalid value.`;
}

const statusDialogClaimReferenceTelemetryOverrideTargetSuggestions = computed(
    () => {
        const policy = billingClaimReferenceValidationPolicy.value;
        const suggestions: string[] = [];
        const configKey = 'VITE_BILLING_CLAIM_REF_TELEMETRY_POLICY_OVERRIDES';

        if (policy.overrideResolution !== 'exact_profile_override') {
            suggestions.push(
                `Add exact profile entry in ${configKey}. Suggested snippet: ${statusDialogClaimReferenceTelemetryOverrideSnippet.value}`,
            );
            suggestions.push(
                `Copy-ready .env line: ${statusDialogClaimReferenceTelemetryOverrideEnvLine.value}`,
            );
            suggestions.push(
                `Merge-safe (preserve existing keys) .env line: ${statusDialogClaimReferenceTelemetryOverrideMergeSafeEnvLine.value}`,
            );
            const mergePreview =
                statusDialogClaimReferenceTelemetryOverrideMergePreview.value;
            suggestions.push(
                `Merge preview: preserves ${mergePreview.preservedProfileCount} parsed existing profile entries; selected profile action is ${mergePreview.selectedProfileAction}.`,
            );
            suggestions.push(
                `Merge preview confirmation: ${mergePreview.selectedProfileConfirmation}`,
            );
            const mergeSafeParseWarning =
                statusDialogClaimReferenceTelemetryMergeSafeParseWarningText();
            if (mergeSafeParseWarning) {
                suggestions.push(
                    `Merge-safe warning: ${mergeSafeParseWarning}`,
                );
            }
        }

        if (policy.profileSelectionMismatch) {
            suggestions.push(
                `If override "${policy.profileSelectionMismatch.alternateKey}" is intended for current scope, duplicate/rename it to "${policy.profileSelectionMismatch.selectedKey}".`,
            );
        }

        return suggestions;
    },
);

const statusDialogClaimReferenceTelemetryOverrideGuidance = computed(() => {
    const policy = billingClaimReferenceValidationPolicy.value;
    const configKey = 'VITE_BILLING_CLAIM_REF_TELEMETRY_POLICY_OVERRIDES';

    if (policy.overrideResolution === 'default_override_fallback') {
        return `Profile key "${policy.profileKey}" has no exact override; using "default" override. Add "${policy.profileKey}" entry in ${configKey} for site-specific thresholds.`;
    }

    if (policy.overrideResolution === 'no_override') {
        return `No profile override is configured for "${policy.profileKey}". Add "${policy.profileKey}" or "default" entry in ${configKey} to tune thresholds per hospital/site.`;
    }

    return null;
});

const statusDialogClaimReferenceTelemetryEnvDiagnosticMessages = computed(() =>
    billingClaimReferenceValidationPolicy.value.envDiagnostics.map((diagnostic) =>
        claimReferencePolicyEnvDiagnosticMessage(diagnostic),
    ),
);

const statusDialogClaimReferenceTelemetryOverridesParseDiagnosticMessage =
    computed(() => {
        const diagnostic =
            billingClaimReferenceValidationPolicy.value.overridesParseDiagnostic;
        if (!diagnostic) return null;
        return claimReferencePolicyOverridesParseDiagnosticMessage(diagnostic);
    });

const statusDialogClaimReferenceTelemetryOverrideMergeSafeParseWarning = computed(
    () => statusDialogClaimReferenceTelemetryMergeSafeParseWarningText(),
);

const statusDialogClaimReferenceTelemetryOverrideMergeSafeCopyText = computed(
    () => {
        const warning =
            statusDialogClaimReferenceTelemetryOverrideMergeSafeParseWarning.value;
        if (!warning) {
            return statusDialogClaimReferenceTelemetryOverrideMergeSafeEnvLine.value;
        }

        return [
            '# WARNING: existing policy overrides JSON is invalid/unparseable.',
            `# ${warning}`,
            '# Review/fix current env value before applying the line below.',
            statusDialogClaimReferenceTelemetryOverrideMergeSafeEnvLine.value,
        ].join('\n');
    },
);

const statusDialogClaimReferenceTelemetryOverridesQualityDiagnosticMessages =
    computed(() =>
        billingClaimReferenceValidationPolicy.value.overridesQualityDiagnostics.map(
            (diagnostic) =>
                claimReferencePolicyOverridesQualityDiagnosticMessage(diagnostic),
        ),
    );

const statusDialogClaimReferenceTelemetryOverrideCoverageExplicitLabel = computed(
    () => {
        const explicit =
            billingClaimReferenceValidationPolicy.value.overrideCoverage
                .explicitFields;
        if (explicit.length === 0) return 'none';
        return explicit.map((field) => claimReferencePolicyFieldLabel(field)).join(', ');
    },
);

const statusDialogClaimReferenceTelemetryOverrideCoverageInheritedLabel = computed(
    () => {
        const inherited =
            billingClaimReferenceValidationPolicy.value.overrideCoverage
                .inheritedFields;
        if (inherited.length === 0) return 'none';
        return inherited
            .map((field) => claimReferencePolicyFieldLabel(field))
            .join(', ');
    },
);

const statusDialogClaimReferenceTelemetryOverrideCoverageSummary = computed(() => {
    const policy = billingClaimReferenceValidationPolicy.value;
    const explicitCount = policy.overrideCoverage.explicitFields.length;
    const inheritedCount = policy.overrideCoverage.inheritedFields.length;
    return `Explicit ${explicitCount}/4 (${statusDialogClaimReferenceTelemetryOverrideCoverageExplicitLabel.value}) | Inherited ${inheritedCount}/4 (${statusDialogClaimReferenceTelemetryOverrideCoverageInheritedLabel.value})`;
});

const statusDialogClaimReferenceTelemetrySnapshot = computed(() => {
    const telemetry = billingClaimReferenceValidationTelemetry.value;
    const policy = billingClaimReferenceValidationPolicy.value;
    const policySources = policy.sources;
    const overrideGuidance =
        statusDialogClaimReferenceTelemetryOverrideGuidance.value;
    const envDiagnosticMessages =
        statusDialogClaimReferenceTelemetryEnvDiagnosticMessages.value;
    const overridesParseDiagnosticMessage =
        statusDialogClaimReferenceTelemetryOverridesParseDiagnosticMessage.value;
    const overridesQualityDiagnosticMessages =
        statusDialogClaimReferenceTelemetryOverridesQualityDiagnosticMessages.value;
    const profileSelectionMismatchMessage =
        statusDialogClaimReferenceTelemetryProfileSelectionMismatchMessage.value;
    const overrideTargetSuggestions =
        statusDialogClaimReferenceTelemetryOverrideTargetSuggestions.value;
    const payerTypeLabel =
        statusDialogSelectedPaymentPayerTypeLabel.value ?? 'Not selected';
    const payerTypeKey = statusDialogPaymentPayerType.value.trim().toLowerCase();
    const payerTypeFailures = payerTypeKey
        ? telemetry.byPayerType[payerTypeKey] ?? 0
        : 0;
    const lastFailureReason = claimReferenceFailureReasonLabel(
        telemetry.lastFailureReason,
    );
    const lastFailureAt = statusDialogClaimReferenceTelemetryLastFailureLabel.value;

    return [
        'Billing Claim Reference Validation Snapshot',
        `Generated At: ${new Date().toISOString()}`,
        `Policy Profile Key: ${policy.profileKey}`,
        `Policy Profile Provenance: ${statusDialogClaimReferenceTelemetryProfileProvenanceSummary.value}`,
        `Policy Profile Normalization: ${statusDialogClaimReferenceTelemetryProfileNormalizationSummary.value}`,
        `Policy Profile Precedence: ${statusDialogClaimReferenceTelemetryProfilePrecedenceSummary.value}`,
        ...(profileSelectionMismatchMessage
            ? [
                  `Policy Profile Selection Warning: ${profileSelectionMismatchMessage}`,
              ]
            : []),
        `Policy Override Suggested Profile Fragment: ${statusDialogClaimReferenceTelemetryOverrideSnippet.value}`,
        `Policy Override Suggested JSON Envelope: ${statusDialogClaimReferenceTelemetryOverrideEnvelope.value}`,
        `Policy Override Suggested Env Line: ${statusDialogClaimReferenceTelemetryOverrideEnvLine.value}`,
        `Policy Override Merge-Safe Env Line: ${statusDialogClaimReferenceTelemetryOverrideMergeSafeEnvLine.value}`,
        `Policy Override Merge Template Placeholder: ${statusDialogClaimReferenceTelemetryOverrideMergeTemplateWithPlaceholder.value}`,
        `Policy Override Merge Preview Existing Profile Count: ${statusDialogClaimReferenceTelemetryOverrideMergePreview.value.existingProfileCount}`,
        `Policy Override Merge Preview Preserved Profile Count: ${statusDialogClaimReferenceTelemetryOverrideMergePreview.value.preservedProfileCount}`,
        `Policy Override Merge Preview Selected Profile Action: ${statusDialogClaimReferenceTelemetryOverrideMergePreview.value.selectedProfileAction}`,
        `Policy Override Merge Preview Selected Profile Confirmation: ${statusDialogClaimReferenceTelemetryOverrideMergePreview.value.selectedProfileConfirmation}`,
        `Policy Override Merge Preview Preserved Profile Keys Preview Limit: ${billingClaimReferenceMergePreviewPreservedKeysPreviewLimit}`,
        `Policy Override Merge Preview Preserved Profile Keys Omitted Count: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysOmittedCount.value}`,
        `Policy Override Merge Preview Preserved Profile Keys: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysLabel.value}`,
        `Policy Override Merge Preview Full Preserved Keys Helper Available: ${statusDialogClaimReferenceTelemetryOverrideMergePreview.value.preservedProfileCount > 0 ? 'yes' : 'no'}`,
        'Policy Override Merge Preview Full Preserved Keys Helper Formats: newline_list, json_array',
        `Policy Override Merge Preview Chunk Helper Recommended: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCopyRecommended.value ? 'yes' : 'no'}`,
        `Policy Override Merge Preview Chunk Helper Count: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value}`,
        `Policy Override Merge Preview Chunk Helper Target Bytes: ${billingClaimReferenceMergePreviewCopyChunkTargetBytes}`,
        `Policy Override Merge Preview Chunk Jump Helper Available: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible.value ? 'yes' : 'no'}`,
        `Policy Override Merge Preview Chunk Quick Jump Chips Available: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkQuickJumpVisible.value ? 'yes' : 'no'}`,
        'Policy Override Merge Preview Chunk Quick Jump Controls: first, last, prev_minus5, next_plus5',
        `Policy Override Merge Preview Chunk Quick Jump First Boundary: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtFirstBoundary.value ? 'yes' : 'no'}`,
        `Policy Override Merge Preview Chunk Quick Jump Last Boundary: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtLastBoundary.value ? 'yes' : 'no'}`,
        `Policy Override Merge Preview Chunk Jump Bounds: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value > 0 ? `1-${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value}` : 'none'}`,
        `Policy Override Merge Preview Chunk Helper Current Chunk: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentIndex.value ?? 'none'}${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentBytes.value !== null ? ` (${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentBytes.value} bytes)` : ''}`,
        `Policy Override Merge Preview Chunk Helper Next Chunk: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextIndex.value ?? 'none'}${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextBytes.value !== null ? ` (${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextBytes.value} bytes)` : ''}`,
        `Policy Override Merge Preview Chunk Helper Bytes Preview: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkBytesPreviewLabel.value}`,
        `Policy Override Merge Preview Chunk Helper Bytes Omitted Count: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkBytesOmittedCount.value}`,
        `Policy Override Merge Preview Full Keys Newline Payload: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics.value.chars} chars / ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics.value.bytes} bytes`,
        `Policy Override Merge Preview Full Keys JSON Payload: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics.value.chars} chars / ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics.value.bytes} bytes`,
        ...(statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics.value
            .warning
            ? [
                  `Policy Override Merge Preview Full Keys Newline Warning: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics.value.warning}`,
              ]
            : []),
        ...(statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics.value
            .warning
            ? [
                  `Policy Override Merge Preview Full Keys JSON Warning: ${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics.value.warning}`,
              ]
            : []),
        ...(statusDialogClaimReferenceTelemetryOverrideMergeSafeParseWarning.value
            ? [
                  `Policy Override Merge-Safe Warning: ${statusDialogClaimReferenceTelemetryOverrideMergeSafeParseWarning.value}`,
              ]
            : []),
        `Policy Override Suggested PowerShell Export: ${statusDialogClaimReferenceTelemetryOverridePowerShellExportLine.value}`,
        `Policy Override Suggested Bash Export: ${statusDialogClaimReferenceTelemetryOverrideBashExportLine.value}`,
        `Policy Override Target Suggestions: ${overrideTargetSuggestions.length}`,
        ...overrideTargetSuggestions.map(
            (message) => `Policy Override Target Suggestion: ${message}`,
        ),
        `Policy Override Resolution: ${claimReferencePolicyOverrideResolutionLabel(policy.overrideResolution)}`,
        `Policy Override Matched Key: ${policy.overrideMatchedKey ?? 'none'}`,
        ...(overrideGuidance
            ? [`Policy Override Guidance: ${overrideGuidance}`]
            : []),
        ...(overridesParseDiagnosticMessage
            ? [
                  `Policy Override Parse Warning: ${overridesParseDiagnosticMessage}`,
              ]
            : []),
        `Policy Override Coverage Explicit Fields: ${statusDialogClaimReferenceTelemetryOverrideCoverageExplicitLabel.value}`,
        `Policy Override Coverage Inherited Fields: ${statusDialogClaimReferenceTelemetryOverrideCoverageInheritedLabel.value}`,
        `Policy Override Quality Warnings: ${overridesQualityDiagnosticMessages.length}`,
        ...overridesQualityDiagnosticMessages.map(
            (message) => `Policy Override Quality Warning: ${message}`,
        ),
        `Policy Env Parse Warnings: ${envDiagnosticMessages.length}`,
        ...envDiagnosticMessages.map((message) => `Env Parse Warning: ${message}`),
        `Policy Source Overall: ${claimReferencePolicySourceLabel(policySources.overall)}`,
        `Policy Source Window Minutes: ${claimReferencePolicySourceLabel(policySources.windowMinutes)}`,
        `Policy Source Inactivity Minutes: ${claimReferencePolicySourceLabel(policySources.inactivityMinutes)}`,
        `Policy Source Max Session Age Hours: ${claimReferencePolicySourceLabel(policySources.maxSessionAgeHours)}`,
        `Policy Source Frequent Failure Threshold: ${claimReferencePolicySourceLabel(policySources.frequentFailureThreshold)}`,
        `Auto-Clear Inactivity Minutes: ${billingClaimReferenceValidationTelemetryInactivityMinutes.value}`,
        `Auto-Clear Max Session Hours: ${billingClaimReferenceValidationTelemetryMaxSessionAgeHours.value}`,
        `Session Started At: ${statusDialogClaimReferenceTelemetrySessionStartedLabel.value ?? 'N/A'}`,
        `Session Last Updated At: ${statusDialogClaimReferenceTelemetryLastUpdatedLabel.value ?? 'N/A'}`,
        `Window Minutes: ${billingClaimReferenceValidationTelemetryWindowMinutes.value}`,
        `Recent Window Failures: ${statusDialogClaimReferenceTelemetryRecentWindowFailures.value}`,
        `Total Failures (Session): ${telemetry.totalFailures}`,
        `Reason Missing: ${statusDialogClaimReferenceTelemetryReasonCounts.value.missing}`,
        `Reason Template: ${statusDialogClaimReferenceTelemetryReasonCounts.value.template}`,
        `Reason Format: ${statusDialogClaimReferenceTelemetryReasonCounts.value.format}`,
        `Current Payer Type: ${payerTypeLabel}`,
        `Current Payer Failures: ${payerTypeFailures}`,
        `Last Failure Reason: ${lastFailureReason}`,
        `Last Failure At: ${lastFailureAt ?? 'N/A'}`,
    ].join('\n');
});

async function copyBillingClaimReferenceTelemetrySnapshot() {
    if (copyingBillingClaimReferenceTelemetrySnapshot.value) return;

    copyingBillingClaimReferenceTelemetrySnapshot.value = true;
    billingClaimReferenceTelemetrySnapshotMessage.value = null;
    billingClaimReferenceTelemetrySnapshotError.value = false;

    try {
        await writeTextToClipboard(statusDialogClaimReferenceTelemetrySnapshot.value);
        billingClaimReferenceTelemetrySnapshotMessage.value =
            'Coaching snapshot copied to clipboard.';
    } catch (error) {
        billingClaimReferenceTelemetrySnapshotMessage.value =
            'Unable to copy coaching snapshot.';
        billingClaimReferenceTelemetrySnapshotError.value = true;
        notifyError(
            messageFromUnknown(
                error,
                'Unable to copy reference validation snapshot.',
            ),
        );
    } finally {
        copyingBillingClaimReferenceTelemetrySnapshot.value = false;
    }
}

async function copyBillingClaimReferenceOverrideSnippet() {
    if (copyingBillingClaimReferenceOverrideSnippet.value) return;

    copyingBillingClaimReferenceOverrideSnippet.value = true;
    billingClaimReferenceOverrideSnippetMessage.value = null;
    billingClaimReferenceOverrideSnippetError.value = false;

    try {
        await writeTextToClipboard(
            statusDialogClaimReferenceTelemetryOverrideSnippet.value,
        );
        billingClaimReferenceOverrideSnippetMessage.value =
            'Override snippet copied to clipboard.';
    } catch (error) {
        billingClaimReferenceOverrideSnippetMessage.value =
            'Unable to copy override snippet.';
        billingClaimReferenceOverrideSnippetError.value = true;
        notifyError(
            messageFromUnknown(error, 'Unable to copy override snippet.'),
        );
    } finally {
        copyingBillingClaimReferenceOverrideSnippet.value = false;
    }
}

async function copyBillingClaimReferenceOverrideEnvelope() {
    if (copyingBillingClaimReferenceOverrideEnvelope.value) return;

    copyingBillingClaimReferenceOverrideEnvelope.value = true;
    billingClaimReferenceOverrideEnvelopeMessage.value = null;
    billingClaimReferenceOverrideEnvelopeError.value = false;

    try {
        await writeTextToClipboard(
            statusDialogClaimReferenceTelemetryOverrideEnvLine.value,
        );
        billingClaimReferenceOverrideEnvelopeMessage.value =
            'Override env line copied to clipboard.';
    } catch (error) {
        billingClaimReferenceOverrideEnvelopeMessage.value =
            'Unable to copy override env line.';
        billingClaimReferenceOverrideEnvelopeError.value = true;
        notifyError(
            messageFromUnknown(error, 'Unable to copy override env line.'),
        );
    } finally {
        copyingBillingClaimReferenceOverrideEnvelope.value = false;
    }
}

async function copyBillingClaimReferenceOverrideShellExports() {
    if (copyingBillingClaimReferenceOverrideShellExports.value) return;

    copyingBillingClaimReferenceOverrideShellExports.value = true;
    billingClaimReferenceOverrideShellExportsMessage.value = null;
    billingClaimReferenceOverrideShellExportsError.value = false;

    try {
        await writeTextToClipboard(
            statusDialogClaimReferenceTelemetryOverrideShellExportsSnippet.value,
        );
        billingClaimReferenceOverrideShellExportsMessage.value =
            'Shell export lines copied to clipboard.';
    } catch (error) {
        billingClaimReferenceOverrideShellExportsMessage.value =
            'Unable to copy shell export lines.';
        billingClaimReferenceOverrideShellExportsError.value = true;
        notifyError(
            messageFromUnknown(error, 'Unable to copy shell export lines.'),
        );
    } finally {
        copyingBillingClaimReferenceOverrideShellExports.value = false;
    }
}

async function copyBillingClaimReferenceOverrideMergeSafeEnv() {
    if (copyingBillingClaimReferenceOverrideMergeSafeEnv.value) return;

    copyingBillingClaimReferenceOverrideMergeSafeEnv.value = true;
    billingClaimReferenceOverrideMergeSafeEnvMessage.value = null;
    billingClaimReferenceOverrideMergeSafeEnvError.value = false;

    try {
        await writeTextToClipboard(
            statusDialogClaimReferenceTelemetryOverrideMergeSafeCopyText.value,
        );
        billingClaimReferenceOverrideMergeSafeEnvMessage.value =
            statusDialogClaimReferenceTelemetryOverrideMergeSafeParseWarning.value
                ? 'Merge-safe override copy block (with parse warning) copied to clipboard.'
                : 'Merge-safe override env line copied to clipboard.';
    } catch (error) {
        billingClaimReferenceOverrideMergeSafeEnvMessage.value =
            'Unable to copy merge-safe override env line.';
        billingClaimReferenceOverrideMergeSafeEnvError.value = true;
        notifyError(
            messageFromUnknown(
                error,
                'Unable to copy merge-safe override env line.',
            ),
        );
    } finally {
        copyingBillingClaimReferenceOverrideMergeSafeEnv.value = false;
    }
}

async function copyBillingClaimReferenceMergePreviewFullPreservedKeys() {
    if (copyingBillingClaimReferenceMergePreviewFullPreservedKeys.value) return;
    if (
        statusDialogClaimReferenceTelemetryOverrideMergePreview.value
            .preservedProfileCount === 0
    ) {
        return;
    }

    copyingBillingClaimReferenceMergePreviewFullPreservedKeys.value = true;
    billingClaimReferenceMergePreviewFullPreservedKeysMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysError.value = false;

    try {
        await writeTextToClipboard(
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysText.value,
        );
        billingClaimReferenceMergePreviewFullPreservedKeysMessage.value =
            `Full preserved profile key list copied to clipboard (${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics.value.bytes} bytes).`;
    } catch (error) {
        billingClaimReferenceMergePreviewFullPreservedKeysMessage.value =
            'Unable to copy full preserved profile key list.';
        billingClaimReferenceMergePreviewFullPreservedKeysError.value = true;
        notifyError(
            messageFromUnknown(
                error,
                'Unable to copy full preserved profile key list.',
            ),
        );
    } finally {
        copyingBillingClaimReferenceMergePreviewFullPreservedKeys.value = false;
    }
}

async function copyBillingClaimReferenceMergePreviewFullPreservedKeysJson() {
    if (copyingBillingClaimReferenceMergePreviewFullPreservedKeysJson.value) return;
    if (
        statusDialogClaimReferenceTelemetryOverrideMergePreview.value
            .preservedProfileCount === 0
    ) {
        return;
    }

    copyingBillingClaimReferenceMergePreviewFullPreservedKeysJson.value = true;
    billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysJsonError.value = false;

    try {
        await writeTextToClipboard(
            statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJson.value,
        );
        billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage.value =
            `Full preserved profile key JSON array copied to clipboard (${statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics.value.bytes} bytes).`;
    } catch (error) {
        billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage.value =
            'Unable to copy full preserved profile key JSON array.';
        billingClaimReferenceMergePreviewFullPreservedKeysJsonError.value = true;
        notifyError(
            messageFromUnknown(
                error,
                'Unable to copy full preserved profile key JSON array.',
            ),
        );
    } finally {
        copyingBillingClaimReferenceMergePreviewFullPreservedKeysJson.value =
            false;
    }
}

async function copyBillingClaimReferenceMergePreviewFullPreservedKeysChunk() {
    if (copyingBillingClaimReferenceMergePreviewFullPreservedKeysChunk.value) return;
    if (
        !statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCopyRecommended.value &&
        statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value <=
            1
    ) {
        return;
    }

    const chunks =
        statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloads.value;
    if (chunks.length === 0) return;

    const chunkIndex =
        billingClaimReferenceMergePreviewFullPreservedKeysChunkCursor.value %
        chunks.length;
    const payload = chunks[chunkIndex];

    copyingBillingClaimReferenceMergePreviewFullPreservedKeysChunk.value = true;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value = null;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = false;

    try {
        await writeTextToClipboard(payload);
        const nextChunkIndex = (chunkIndex + 1) % chunks.length;
        billingClaimReferenceMergePreviewFullPreservedKeysChunkCursor.value =
            nextChunkIndex;
        const payloadBytes = billingClaimReferencePayloadUtf8ByteLength(payload);
        billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
            `Chunk ${chunkIndex + 1}/${chunks.length} copied (${payloadBytes} bytes). Next: chunk ${nextChunkIndex + 1}/${chunks.length}.`;
    } catch (error) {
        billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
            'Unable to copy chunked preserved profile key payload.';
        billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = true;
        notifyError(
            messageFromUnknown(
                error,
                'Unable to copy chunked preserved profile key payload.',
            ),
        );
    } finally {
        copyingBillingClaimReferenceMergePreviewFullPreservedKeysChunk.value =
            false;
    }
}

function resetBillingClaimReferenceMergePreviewFullPreservedKeysChunkCursor() {
    const chunkCount =
        statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value;
    if (chunkCount === 0) return;

    billingClaimReferenceMergePreviewFullPreservedKeysChunkCursor.value = 0;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = false;
    const firstChunkBytes =
        statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloadBytes.value[0] ??
        0;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
        `Chunk cursor reset. Current chunk 1/${chunkCount} (${firstChunkBytes} bytes).`;
}

function jumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk() {
    const chunkCount =
        statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value;
    if (chunkCount === 0) return;

    const raw = billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget.value.trim();
    if (!raw) {
        billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
            `Enter a chunk number between 1 and ${chunkCount}.`;
        billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = true;
        return;
    }

    if (!/^\d+$/.test(raw)) {
        billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
            `Chunk number must be a whole number between 1 and ${chunkCount}.`;
        billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = true;
        return;
    }

    const targetChunk = Number.parseInt(raw, 10);
    if (targetChunk < 1 || targetChunk > chunkCount) {
        billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
            `Chunk number out of range. Choose 1-${chunkCount}.`;
        billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = true;
        return;
    }

    billingClaimReferenceMergePreviewFullPreservedKeysChunkCursor.value = targetChunk - 1;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget.value = String(
        targetChunk,
    );
    billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = false;
    const payloadBytes =
        statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloadBytes.value[
            targetChunk - 1
        ] ?? 0;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
        `Chunk cursor moved to chunk ${targetChunk}/${chunkCount} (${payloadBytes} bytes).`;
}

function quickJumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk(
    mode: 'first' | 'last' | 'prev5' | 'next5',
) {
    const chunkCount =
        statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount.value;
    if (chunkCount === 0) return;

    const cursor =
        statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCursorNormalized.value ??
        0;
    let targetIndex = cursor;
    if (mode === 'first') {
        targetIndex = 0;
    } else if (mode === 'last') {
        targetIndex = chunkCount - 1;
    } else if (mode === 'prev5') {
        targetIndex = Math.max(cursor - 5, 0);
    } else {
        targetIndex = Math.min(cursor + 5, chunkCount - 1);
    }

    billingClaimReferenceMergePreviewFullPreservedKeysChunkCursor.value = targetIndex;
    billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget.value = String(
        targetIndex + 1,
    );
    billingClaimReferenceMergePreviewFullPreservedKeysChunkError.value = false;
    const payloadBytes =
        statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkPayloadBytes.value[
            targetIndex
        ] ?? 0;

    if (mode === 'first') {
        billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
            `Chunk cursor moved to first chunk ${targetIndex + 1}/${chunkCount} (${payloadBytes} bytes).`;
        return;
    }

    if (mode === 'last') {
        billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
            `Chunk cursor moved to last chunk ${targetIndex + 1}/${chunkCount} (${payloadBytes} bytes).`;
        return;
    }

    if (mode === 'prev5') {
        billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
            `Chunk cursor moved back from ${cursor + 1}/${chunkCount} to ${targetIndex + 1}/${chunkCount} (${payloadBytes} bytes) via Prev -5.`;
        return;
    }

    billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage.value =
        `Chunk cursor advanced from ${cursor + 1}/${chunkCount} to ${targetIndex + 1}/${chunkCount} (${payloadBytes} bytes) via Next +5.`;
}

const statusDialogPaymentReferenceSkeletonChips = computed(() => {
    const year = new Date().getFullYear();
    const dateToken = billingReferenceSampleDateToken();
    const paymentMethod = statusDialogPaymentMethod.value.trim();

    if (
        !statusDialogClaimReferenceRequired.value &&
        !statusDialogPaymentReferenceRequired.value
    ) {
        if (paymentMethod === 'cash') {
            return [
                {
                    label: 'Receipt',
                    value: `RCT-${dateToken}-001`,
                },
            ];
        }

        return [];
    }

    const payerType = statusDialogPaymentPayerType.value.trim();
    if (payerType === 'insurance') {
        return [
            {
                label: 'INS Template',
                value: `INS-${year}-000123`,
            },
            {
                label: 'NHIF Template',
                value: `NHIF-${year}-004112`,
            },
        ];
    }

    if (payerType === 'government') {
        return [
            {
                label: 'GOV Template',
                value: `GOV/${year}/00412`,
            },
            {
                label: 'MOH Template',
                value: `MOH-${year}-03100`,
            },
        ];
    }

    if (paymentMethod === 'mobile_money') {
        return [
            {
                label: 'M-Pesa',
                value: `MPESA-${dateToken}-001`,
            },
            {
                label: 'Airtel Money',
                value: `AIRTEL-${dateToken}-001`,
            },
        ];
    }

    if (paymentMethod === 'bank_transfer') {
        return [
            {
                label: 'Transfer Ref',
                value: `TRX-${dateToken}-001`,
            },
            {
                label: 'Deposit Slip',
                value: `DEP-${dateToken}-001`,
            },
        ];
    }

    if (paymentMethod === 'card') {
        return [
            {
                label: 'POS Slip',
                value: `POS-${dateToken}-001`,
            },
            {
                label: 'Card Ref',
                value: `CARD-${dateToken}-001`,
            },
        ];
    }

    if (paymentMethod === 'cheque') {
        return [
            {
                label: 'Cheque',
                value: `CHQ-${year}-001`,
            },
            {
                label: 'EFT Advice',
                value: `EFT-${dateToken}-001`,
            },
        ];
    }

    if (paymentMethod === 'waiver') {
        return [
            {
                label: 'Waiver Ref',
                value: `WAIVER-${dateToken}-001`,
            },
        ];
    }

    if (paymentMethod === 'cash') {
        return [
            {
                label: 'Receipt',
                value: `RCT-${dateToken}-001`,
            },
        ];
    }

    return [];
});

const statusDialogPaymentReferenceSkeletonHelper = computed(() => {
    if (statusDialogClaimReferenceRequired.value) {
        return 'Quick-fill templates; replace the suffix with the actual payer-issued control number before submit.';
    }

    return 'Quick-fill starter formats; replace the suffix with the real receipt, transaction, or approval reference.';
});

function applyStatusDialogPaymentReferenceSkeleton(value: string) {
    statusDialogPaymentReference.value = value;
}

const statusDialogInsuranceClaimMethodHint = computed(() => {
    if (!statusDialogShowsPaidAmount.value) return null;

    const payerType = statusDialogPaymentPayerType.value.trim();
    const paymentMethod = statusDialogPaymentMethod.value.trim();

    if (
        billingPayerTypesRequiringClaimReference.has(payerType) &&
        paymentMethod &&
        paymentMethod !== 'insurance_claim'
    ) {
        return 'Insurance/Government settlements usually use Insurance Claim method. Keep this method only when settlement is intentionally non-claim.';
    }

    return null;
});

const statusDialogPaymentMethodSmartDefaultHint = computed(() => {
    if (!statusDialogShowsPaidAmount.value) return null;
    if (!statusDialogPaymentMethodAutoSelected.value) return null;

    const payerTypeLabel =
        statusDialogSelectedPaymentPayerTypeLabel.value ?? 'this payer type';
    return `Payment method auto-selected to Insurance Claim for ${payerTypeLabel}. You can override for intentional non-claim settlement.`;
});

function maybeAutoSelectStatusDialogPaymentMethod() {
    if (!statusDialogShowsPaidAmount.value) return;

    const payerType = statusDialogPaymentPayerType.value.trim();
    if (!billingPayerTypesRequiringClaimReference.has(payerType)) {
        if (
            statusDialogPaymentMethodAutoSelected.value &&
            !statusDialogPaymentMethodManualOverride.value &&
            statusDialogPaymentMethod.value.trim() === 'insurance_claim'
        ) {
            statusDialogApplyingPaymentMethodAutoSelect.value = true;
            statusDialogPaymentMethod.value = '';
            statusDialogApplyingPaymentMethodAutoSelect.value = false;
        }
        statusDialogPaymentMethodAutoSelected.value = false;
        return;
    }

    if (statusDialogPaymentMethodManualOverride.value) return;

    const currentMethod = statusDialogPaymentMethod.value.trim();
    if (currentMethod === 'insurance_claim') {
        statusDialogPaymentMethodAutoSelected.value = true;
        return;
    }

    statusDialogApplyingPaymentMethodAutoSelect.value = true;
    statusDialogPaymentMethod.value = 'insurance_claim';
    statusDialogPaymentMethodAutoSelected.value = true;
    statusDialogApplyingPaymentMethodAutoSelect.value = false;
}

function applyStatusDialogPaymentRouteQuickAction(
    payerType: string,
    paymentMethod: string,
) {
    statusDialogPaymentPayerType.value = payerType;
    statusDialogPaymentMethod.value = paymentMethod;
    statusDialogPaymentMethodManualOverride.value = true;
    statusDialogPaymentMethodAutoSelected.value = false;
}

watch(
    () => statusDialogPaymentPayerType.value,
    () => {
        if (
            !statusDialogOpen.value &&
            !statusDialogInitializingPaymentMetadata.value
        ) {
            return;
        }

        maybeAutoSelectStatusDialogPaymentMethod();
    },
);

watch(
    () => statusDialogPaymentMethod.value,
    (nextMethod, previousMethod) => {
        if (!statusDialogOpen.value || !statusDialogShowsPaidAmount.value) return;
        if (
            statusDialogInitializingPaymentMetadata.value ||
            statusDialogApplyingPaymentMethodAutoSelect.value
        ) {
            return;
        }

        if (nextMethod.trim() === (previousMethod ?? '').trim()) return;

        statusDialogPaymentMethodManualOverride.value = true;
        statusDialogPaymentMethodAutoSelected.value = false;
    },
);

function setStatusDialogPaidAmountValue(value: number | null) {
    if (value === null || !Number.isFinite(value)) {
        statusDialogPaidAmount.value = '';
        return;
    }

    statusDialogPaidAmount.value = String(Number(value.toFixed(2)));
}

async function loadInvoiceDetailsPayments(invoiceId: string) {
    if (!canViewBillingPaymentHistory.value) {
        invoiceDetailsPaymentsLoading.value = false;
        invoiceDetailsPaymentsError.value = null;
        invoiceDetailsPayments.value = [];
        invoiceDetailsPaymentsMeta.value = null;
        return;
    }

    invoiceDetailsPaymentsLoading.value = true;
    invoiceDetailsPaymentsError.value = null;

    try {
        const response = await apiRequest<BillingInvoicePaymentListResponse>(
            'GET',
            `/billing-invoices/${invoiceId}/payments`,
            {
                query: {
                    page: 1,
                    perPage: invoiceDetailsPaymentsFilters.perPage,
                    q: invoiceDetailsPaymentsFilters.q.trim() || null,
                    payerType: invoiceDetailsPaymentsFilters.payerType || null,
                    paymentMethod:
                        invoiceDetailsPaymentsFilters.paymentMethod || null,
                    from: invoiceDetailsPaymentsFilters.from || null,
                    to: invoiceDetailsPaymentsFilters.to || null,
                },
            },
        );

        invoiceDetailsPayments.value = response.data;
        invoiceDetailsPaymentsMeta.value = response.meta;
    } catch (error) {
        invoiceDetailsPayments.value = [];
        invoiceDetailsPaymentsMeta.value = null;
        invoiceDetailsPaymentsError.value = messageFromUnknown(
            error,
            'Unable to load payment history.',
        );
    } finally {
        invoiceDetailsPaymentsLoading.value = false;
    }
}

function invoiceDetailsAuditLogsQuery(page: number, perPage: number) {
    return {
        page,
        perPage,
        q: invoiceDetailsAuditLogsFilters.q.trim() || null,
        action: invoiceDetailsAuditLogsFilters.action.trim() || null,
        actorType: invoiceDetailsAuditLogsFilters.actorType || null,
        actorId: invoiceDetailsAuditLogsFilters.actorId.trim() || null,
        from: invoiceDetailsAuditLogsFilters.from
            ? `${invoiceDetailsAuditLogsFilters.from} 00:00:00`
            : null,
        to: invoiceDetailsAuditLogsFilters.to
            ? `${invoiceDetailsAuditLogsFilters.to} 23:59:59`
            : null,
    };
}

function invoiceDetailsAuditLogsExportQuery() {
    return {
        q: invoiceDetailsAuditLogsFilters.q.trim() || null,
        action: invoiceDetailsAuditLogsFilters.action.trim() || null,
        actorType: invoiceDetailsAuditLogsFilters.actorType || null,
        actorId: invoiceDetailsAuditLogsFilters.actorId.trim() || null,
        from: invoiceDetailsAuditLogsFilters.from
            ? `${invoiceDetailsAuditLogsFilters.from} 00:00:00`
            : null,
        to: invoiceDetailsAuditLogsFilters.to
            ? `${invoiceDetailsAuditLogsFilters.to} 23:59:59`
            : null,
    };
}

function invoiceDetailsAuditExportJobsQuery(page: number, perPage: number) {
    return {
        page,
        perPage,
        statusGroup: invoiceDetailsAuditExportJobsFilters.statusGroup,
    };
}

async function loadInvoiceDetailsAuditLogs(invoiceId: string) {
    if (!canViewBillingInvoiceAuditLogs.value) {
        invoiceDetailsAuditLogsLoading.value = false;
        invoiceDetailsAuditLogsError.value = null;
        invoiceDetailsAuditLogs.value = [];
        invoiceDetailsAuditLogsMeta.value = null;
        return;
    }

    invoiceDetailsAuditLogsLoading.value = true;
    invoiceDetailsAuditLogsError.value = null;

    try {
        const response = await apiRequest<BillingInvoiceAuditLogListResponse>(
            'GET',
            `/billing-invoices/${invoiceId}/audit-logs`,
            {
                query: invoiceDetailsAuditLogsQuery(
                    invoiceDetailsAuditLogsFilters.page,
                    invoiceDetailsAuditLogsFilters.perPage,
                ),
            },
        );

        invoiceDetailsAuditLogs.value = response.data;
        invoiceDetailsAuditLogsMeta.value = response.meta;
    } catch (error) {
        invoiceDetailsAuditLogs.value = [];
        invoiceDetailsAuditLogsMeta.value = null;
        invoiceDetailsAuditLogsError.value = messageFromUnknown(
            error,
            'Unable to load invoice audit trail.',
        );
    } finally {
        invoiceDetailsAuditLogsLoading.value = false;
    }
}

async function loadInvoiceAuditExportJobs(invoiceId: string) {
    if (!canViewBillingInvoiceAuditLogs.value) {
        invoiceDetailsAuditExportJobsLoading.value = false;
        invoiceDetailsAuditExportJobsError.value = null;
        invoiceDetailsAuditExportJobs.value = [];
        invoiceDetailsAuditExportJobsMeta.value = null;
        return;
    }

    invoiceDetailsAuditExportJobsLoading.value = true;
    invoiceDetailsAuditExportJobsError.value = null;

    try {
        const response = await apiRequest<BillingInvoiceAuditExportJobListResponse>(
            'GET',
            `/billing-invoices/${invoiceId}/audit-logs/export-jobs`,
            {
                query: invoiceDetailsAuditExportJobsQuery(
                    invoiceDetailsAuditExportJobsFilters.page,
                    invoiceDetailsAuditExportJobsFilters.perPage,
                ),
            },
        );

        invoiceDetailsAuditExportJobs.value = response.data;
        invoiceDetailsAuditExportJobsMeta.value = response.meta;
        if (
            invoiceDetailsAuditExportPinnedHandoffJob.value &&
            response.data.some(
                (job) =>
                    job.id ===
                    invoiceDetailsAuditExportPinnedHandoffJob.value?.id,
            )
        ) {
            invoiceDetailsAuditExportPinnedHandoffJob.value = null;
        }
    } catch (error) {
        invoiceDetailsAuditExportJobs.value = [];
        invoiceDetailsAuditExportJobsMeta.value = null;
        invoiceDetailsAuditExportJobsError.value = messageFromUnknown(
            error,
            'Unable to load audit export jobs.',
        );
    } finally {
        invoiceDetailsAuditExportJobsLoading.value = false;
    }
}

async function fetchBillingAuditExportJobById(
    invoiceId: string,
    jobId: string,
): Promise<BillingInvoiceAuditExportJob | null> {
    try {
        const response = await apiRequest<BillingInvoiceAuditExportJobResponse>(
            'GET',
            `/billing-invoices/${invoiceId}/audit-logs/export-jobs/${jobId}`,
        );
        return response.data;
    } catch {
        return null;
    }
}

function clearBillingAuditExportRetryHandoffQueryParams() {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const keys = [
        'auditExportJobId',
        'auditAction',
        'auditExportStatusGroup',
        'auditExportPage',
        'auditExportPerPage',
    ];

    let changed = false;
    for (const key of keys) {
        if (!url.searchParams.has(key)) continue;
        url.searchParams.delete(key);
        changed = true;
    }

    if (!changed) return;

    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

function clearQueryParamFromUrl(name: string) {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (!url.searchParams.has(name)) return;

    url.searchParams.delete(name);
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

async function focusBillingAuditExportRetryHandoff(jobId: string): Promise<boolean> {
    if (!jobId || !invoiceDetailsInvoice.value) return false;

    const focusJob = invoiceDetailsAuditExportJobs.value.find(
        (job) => job.id === jobId,
    );
    if (focusJob) {
        invoiceDetailsAuditExportFocusJobId.value = focusJob.id;
        invoiceDetailsAuditExportPinnedHandoffJob.value = null;
        invoiceDetailsAuditExportHandoffError.value = false;
        invoiceDetailsAuditExportHandoffMessage.value =
            'Retry handoff active. Use the highlighted export job retry action.';

        await nextTick();
        const row = document.getElementById(`bil-audit-export-job-${focusJob.id}`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const retryButton = row?.querySelector<HTMLButtonElement>(
            `[data-audit-export-retry-job-id="${focusJob.id}"]`,
        );
        retryButton?.focus();
        return true;
    }

    const resolvedJob = await fetchBillingAuditExportJobById(
        invoiceDetailsInvoice.value.id,
        jobId,
    );
    if (!resolvedJob) {
        invoiceDetailsAuditExportFocusJobId.value = null;
        invoiceDetailsAuditExportPinnedHandoffJob.value = null;
        invoiceDetailsAuditExportHandoffError.value = true;
        invoiceDetailsAuditExportHandoffMessage.value =
            'Retry handoff loaded this invoice, but the target export job could not be resolved. Refresh jobs and retry from this invoice details sheet.';
        return false;
    }

    invoiceDetailsAuditExportPinnedHandoffJob.value = resolvedJob;
    invoiceDetailsAuditExportFocusJobId.value = resolvedJob.id;
    invoiceDetailsAuditExportHandoffError.value = false;
    invoiceDetailsAuditExportHandoffMessage.value =
        'Retry handoff resolved a job outside the current page. Use the pinned handoff row below.';

    await nextTick();
    const row = document.getElementById(
        `bil-audit-export-job-handoff-${resolvedJob.id}`,
    );
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const retryButton = row?.querySelector<HTMLButtonElement>(
        `[data-audit-export-retry-job-id="${resolvedJob.id}"]`,
    );
    retryButton?.focus();
    return true;
}

function applyBillingAuditExportRetryHandoffFilters(
    context: Pick<BillingAuditExportRetryHandoffContext, 'statusGroup' | 'page' | 'perPage'>,
) {
    invoiceDetailsAuditExportJobsFilters.statusGroup = context.statusGroup;
    invoiceDetailsAuditExportJobsFilters.page = context.page;
    invoiceDetailsAuditExportJobsFilters.perPage = context.perPage;
}

async function fetchBillingInvoiceById(
    invoiceId: string,
): Promise<BillingInvoice | null> {
    try {
        const response = await apiRequest<{ data: BillingInvoice }>(
            'GET',
            `/billing-invoices/${invoiceId}`,
        );
        return response.data;
    } catch {
        return null;
    }
}

async function loadInvoiceDetailsFinancePosting(invoiceId: string) {
    invoiceDetailsFinancePostingLoading.value = true;
    invoiceDetailsFinancePostingError.value = null;

    try {
        const response = await apiRequest<{ data: BillingInvoiceFinancePostingSummary }>(
            'GET',
            `/billing-invoices/${invoiceId}/finance-posting`,
        );
        invoiceDetailsFinancePosting.value = response.data;
    } catch (error) {
        invoiceDetailsFinancePosting.value = null;
        invoiceDetailsFinancePostingError.value = messageFromUnknown(
            error,
            'Unable to load finance posting state.',
        );
    } finally {
        invoiceDetailsFinancePostingLoading.value = false;
    }
}

watch(
    () =>
        invoiceDetailsInvoice.value
            ? `${invoiceDetailsInvoice.value.id}:${invoiceDetailsInvoice.value.updatedAt ?? ''}`
            : '',
    (nextKey) => {
        if (!nextKey || !invoiceDetailsInvoice.value) {
            invoiceDetailsFinancePosting.value = null;
            invoiceDetailsFinancePostingError.value = null;
            invoiceDetailsFinancePostingLoading.value = false;
            return;
        }

        void loadInvoiceDetailsFinancePosting(invoiceDetailsInvoice.value.id);
    },
    { immediate: true },
);

async function applyDraftWorkspaceFromQuery() {
    if (billingWorkspaceView.value !== 'create') return;

    const draftInvoiceId = createWorkspaceDraftInvoiceId.value.trim();
    if (!draftInvoiceId) return;

    const draftInvoice = await fetchBillingInvoiceById(draftInvoiceId);
    if (!draftInvoice) {
        clearCreateWorkspaceDraftTarget();
        replaceUrlQueryParam('draftInvoiceId', null);
        notifyError('Unable to reopen the requested billing draft workspace.');
        return;
    }

    if ((draftInvoice.status ?? '').trim().toLowerCase() !== 'draft') {
        clearCreateWorkspaceDraftTarget();
        replaceUrlQueryParam('draftInvoiceId', null);
        notifyError('This invoice is no longer a draft, so it cannot be reopened in the charge workspace.');
        return;
    }

    populateCreateWorkspaceFromInvoice(draftInvoice);
}

async function openInvoiceDetailsSheet(
    invoice: BillingInvoice,
    options?: {
        retryHandoffContext?: Pick<
            BillingAuditExportRetryHandoffContext,
            'statusGroup' | 'page' | 'perPage'
        >;
    },
) {
    invoiceDetailsActionOutcome.value = null;
    resetInvoiceDetailsPaymentsFilters({ autoLoad: false });
    resetInvoiceDetailsAuditLogsFilters({ autoLoad: false });
    resetInvoiceDetailsAuditExportJobsFilters({ autoLoad: false });
    invoiceDetailsSheetTab.value = options?.retryHandoffContext ? 'audit' : 'overview';
    invoiceDetailsAuditFiltersOpen.value = false;
    invoiceDetailsExpandedAuditLogIds.value = [];
    if (options?.retryHandoffContext) {
        applyBillingAuditExportRetryHandoffFilters(options.retryHandoffContext);
    }
    invoiceDetailsInvoice.value = invoice;
    invoiceDetailsSheetOpen.value = true;
    invoiceDetailsPayments.value = [];
    invoiceDetailsPaymentsMeta.value = null;
    invoiceDetailsPaymentsError.value = null;
    invoiceDetailsAuditLogs.value = [];
    invoiceDetailsAuditLogsMeta.value = null;
    invoiceDetailsAuditLogsError.value = null;
    invoiceDetailsAuditExportJobs.value = [];
    invoiceDetailsAuditExportJobsMeta.value = null;
    invoiceDetailsAuditExportJobsError.value = null;
    invoiceDetailsAuditExportFocusJobId.value = null;
    invoiceDetailsAuditExportPinnedHandoffJob.value = null;
    invoiceDetailsAuditExportHandoffMessage.value = null;
    invoiceDetailsAuditExportHandoffError.value = false;

    const detailLoads: Promise<unknown>[] = [];
    detailLoads.push(
        fetchBillingInvoiceById(invoice.id).then((latestInvoice) => {
            if (
                latestInvoice &&
                invoiceDetailsInvoice.value?.id === invoice.id
            ) {
                invoiceDetailsInvoice.value = latestInvoice;
            }
        }),
    );
    if (canViewBillingPaymentHistory.value) {
        detailLoads.push(loadInvoiceDetailsPayments(invoice.id));
    }
    if (canViewBillingInvoiceAuditLogs.value) {
        detailLoads.push(loadInvoiceDetailsAuditLogs(invoice.id));
        detailLoads.push(loadInvoiceAuditExportJobs(invoice.id));
    }
    if (detailLoads.length > 0) {
        await Promise.allSettled(detailLoads);
    }
}

async function applyFocusedInvoiceFromQuery() {
    const invoiceId = queryParam('focusInvoiceId').trim();
    if (!invoiceId) return;

    let targetInvoice =
        invoices.value.find((invoice) => invoice.id === invoiceId) ?? null;
    if (!targetInvoice) {
        targetInvoice = await fetchBillingInvoiceById(invoiceId);
    }

    if (targetInvoice) {
        await openInvoiceDetailsSheet(targetInvoice);
    } else {
        listErrors.value.push(
            'Unable to open the requested billing invoice from the patient chart.',
        );
    }

    clearQueryParamFromUrl('focusInvoiceId');
}

function openInvoicePrintPreview(invoice: BillingInvoice) {
    const url = new URL(`/billing-invoices/${invoice.id}/print`, window.location.origin);
    window.open(url.toString(), '_blank', 'noopener');
}

async function applyBillingAuditExportRetryHandoff() {
    if (!auditExportRetryHandoffPending.value) return;
    auditExportRetryHandoffPending.value = false;
    auditExportRetryHandoffCompletedMessage.value = null;

    const targetInvoiceId = searchForm.q.trim();
    if (!targetInvoiceId) {
        listErrors.value.push(
            'Audit export retry handoff skipped: target billing invoice was not provided.',
        );
        return;
    }

    let targetInvoice = invoices.value.find(
        (invoice) => invoice.id === targetInvoiceId,
    );
    if (!targetInvoice) {
        targetInvoice = await fetchBillingInvoiceById(targetInvoiceId);
        if (!targetInvoice) {
            listErrors.value.push(
                'Audit export retry handoff target is not visible in current billing queue results, and direct invoice lookup failed.',
            );
            return;
        }
    }

    const handoffContext: BillingAuditExportRetryHandoffContext = {
        targetInvoiceId,
        jobId: auditExportRetryHandoffJobId,
        statusGroup: auditExportRetryHandoffStatusGroup,
        page: auditExportRetryHandoffPage,
        perPage: auditExportRetryHandoffPerPage,
        savedAt: new Date().toISOString(),
    };

    await openInvoiceDetailsSheet(targetInvoice, {
        retryHandoffContext: handoffContext,
    });
    const focused = await focusBillingAuditExportRetryHandoff(handoffContext.jobId);
    if (focused) {
        clearBillingAuditExportRetryHandoffQueryParams();
        persistBillingAuditExportRetryHandoff(handoffContext);
        auditExportRetryHandoffCompletedMessage.value =
            `Retry handoff ready for invoice ${targetInvoice.id} (export job ${auditExportRetryHandoffJobId}).`;
    }
}

async function resumeLastBillingAuditExportRetryHandoff() {
    const context = lastBillingAuditExportRetryHandoff.value;
    if (!context || resumingBillingAuditExportRetryHandoff.value) return;

    const telemetryContext: BillingAuditExportRetryResumeTelemetryEventContext = {
        targetResourceId: context.targetInvoiceId,
        exportJobId: context.jobId,
        handoffStatusGroup: context.statusGroup,
        handoffPage: context.page,
        handoffPerPage: context.perPage,
    };

    resumingBillingAuditExportRetryHandoff.value = true;
    auditExportRetryHandoffCompletedMessage.value = null;
    recordBillingAuditExportRetryResumeAttempt(telemetryContext);

    try {
        let targetInvoice = invoices.value.find(
            (invoice) => invoice.id === context.targetInvoiceId,
        );
        if (!targetInvoice) {
            targetInvoice = await fetchBillingInvoiceById(context.targetInvoiceId);
            if (!targetInvoice) {
                recordBillingAuditExportRetryResumeFailure(
                    'target_invoice_lookup_failed',
                    telemetryContext,
                );
                listErrors.value.push(
                    'Unable to resume last billing retry handoff target. The invoice could not be loaded.',
                );
                return;
            }
        }

        const resumeContext: BillingAuditExportRetryHandoffContext = {
            ...context,
            savedAt: new Date().toISOString(),
        };

        await openInvoiceDetailsSheet(targetInvoice, {
            retryHandoffContext: resumeContext,
        });
        const focused = await focusBillingAuditExportRetryHandoff(
            resumeContext.jobId,
        );
        if (!focused) {
            recordBillingAuditExportRetryResumeFailure(
                'target_export_job_focus_failed',
                telemetryContext,
            );
            listErrors.value.push(
                'Unable to resume last billing retry handoff focus. The export job could not be resolved.',
            );
            return;
        }

        recordBillingAuditExportRetryResumeSuccess(telemetryContext);
        persistBillingAuditExportRetryHandoff(resumeContext);
        auditExportRetryHandoffCompletedMessage.value =
            `Resumed retry handoff for invoice ${resumeContext.targetInvoiceId} (export job ${resumeContext.jobId}).`;
    } finally {
        resumingBillingAuditExportRetryHandoff.value = false;
    }
}

function closeInvoiceDetailsSheet() {
    invoiceDetailsSheetOpen.value = false;
    invoiceDetailsInvoice.value = null;
    invoiceDetailsActionOutcome.value = null;
    invoiceDetailsSheetTab.value = 'overview';
    invoiceDetailsAuditFiltersOpen.value = false;
    invoiceDetailsExpandedAuditLogIds.value = [];
    invoiceDetailsPayments.value = [];
    invoiceDetailsPaymentsMeta.value = null;
    invoiceDetailsPaymentsError.value = null;
    invoiceDetailsAuditLogs.value = [];
    invoiceDetailsAuditLogsMeta.value = null;
    invoiceDetailsAuditLogsError.value = null;
    invoiceDetailsAuditExportJobs.value = [];
    invoiceDetailsAuditExportJobsMeta.value = null;
    invoiceDetailsAuditExportJobsError.value = null;
    invoiceDetailsAuditExportRetryingJobId.value = null;
    invoiceDetailsAuditExportFocusJobId.value = null;
    invoiceDetailsAuditExportPinnedHandoffJob.value = null;
    invoiceDetailsAuditExportHandoffMessage.value = null;
    invoiceDetailsAuditExportHandoffError.value = false;
}

function resetInvoiceDetailsPaymentsFilters(options?: { autoLoad?: boolean }) {
    invoiceDetailsPaymentsFilters.q = '';
    invoiceDetailsPaymentsFilters.payerType = '';
    invoiceDetailsPaymentsFilters.paymentMethod = '';
    invoiceDetailsPaymentsFilters.from = '';
    invoiceDetailsPaymentsFilters.to = '';
    invoiceDetailsPaymentsFilters.perPage = 20;

    if (options?.autoLoad !== false && invoiceDetailsInvoice.value) {
        void loadInvoiceDetailsPayments(invoiceDetailsInvoice.value.id);
    }
}

function submitInvoiceDetailsPaymentsFilters() {
    if (!invoiceDetailsInvoice.value) return;
    void loadInvoiceDetailsPayments(invoiceDetailsInvoice.value.id);
}

function resetInvoiceDetailsAuditLogsFilters(options?: { autoLoad?: boolean }) {
    invoiceDetailsAuditLogsFilters.q = '';
    invoiceDetailsAuditLogsFilters.action = '';
    invoiceDetailsAuditLogsFilters.actorType = '';
    invoiceDetailsAuditLogsFilters.actorId = '';
    invoiceDetailsAuditLogsFilters.from = '';
    invoiceDetailsAuditLogsFilters.to = '';
    invoiceDetailsAuditLogsFilters.perPage = 20;
    invoiceDetailsAuditLogsFilters.page = 1;

    if (options?.autoLoad !== false && invoiceDetailsInvoice.value) {
        void loadInvoiceDetailsAuditLogs(invoiceDetailsInvoice.value.id);
    }
}

function submitInvoiceDetailsAuditLogsFilters() {
    if (!invoiceDetailsInvoice.value) return;
    invoiceDetailsAuditLogsFilters.page = 1;
    void loadInvoiceDetailsAuditLogs(invoiceDetailsInvoice.value.id);
}

function resetInvoiceDetailsAuditExportJobsFilters(options?: { autoLoad?: boolean }) {
    invoiceDetailsAuditExportJobsFilters.statusGroup = 'all';
    invoiceDetailsAuditExportJobsFilters.perPage = 8;
    invoiceDetailsAuditExportJobsFilters.page = 1;

    if (options?.autoLoad !== false && invoiceDetailsInvoice.value) {
        void loadInvoiceAuditExportJobs(invoiceDetailsInvoice.value.id);
    }
}

function submitInvoiceDetailsAuditExportJobsFilters() {
    if (!invoiceDetailsInvoice.value) return;
    invoiceDetailsAuditExportJobsFilters.page = 1;
    void loadInvoiceAuditExportJobs(invoiceDetailsInvoice.value.id);
}

function prevInvoiceDetailsAuditExportJobsPage() {
    if (!invoiceDetailsInvoice.value || !invoiceDetailsAuditExportJobsMeta.value) return;
    if (invoiceDetailsAuditExportJobsMeta.value.currentPage <= 1) return;
    invoiceDetailsAuditExportJobsFilters.page = Math.max(
        invoiceDetailsAuditExportJobsMeta.value.currentPage - 1,
        1,
    );
    void loadInvoiceAuditExportJobs(invoiceDetailsInvoice.value.id);
}

function nextInvoiceDetailsAuditExportJobsPage() {
    if (!invoiceDetailsInvoice.value || !invoiceDetailsAuditExportJobsMeta.value) return;
    if (
        invoiceDetailsAuditExportJobsMeta.value.currentPage >=
        invoiceDetailsAuditExportJobsMeta.value.lastPage
    ) {
        return;
    }

    invoiceDetailsAuditExportJobsFilters.page = Math.min(
        invoiceDetailsAuditExportJobsMeta.value.currentPage + 1,
        invoiceDetailsAuditExportJobsMeta.value.lastPage,
    );
    void loadInvoiceAuditExportJobs(invoiceDetailsInvoice.value.id);
}

function prevInvoiceDetailsAuditLogsPage() {
    if (!invoiceDetailsInvoice.value || !invoiceDetailsAuditLogsMeta.value) return;
    if (invoiceDetailsAuditLogsMeta.value.currentPage <= 1) return;
    invoiceDetailsAuditLogsFilters.page = Math.max(
        invoiceDetailsAuditLogsMeta.value.currentPage - 1,
        1,
    );
    void loadInvoiceDetailsAuditLogs(invoiceDetailsInvoice.value.id);
}

function nextInvoiceDetailsAuditLogsPage() {
    if (!invoiceDetailsInvoice.value || !invoiceDetailsAuditLogsMeta.value) return;
    if (
        invoiceDetailsAuditLogsMeta.value.currentPage >=
        invoiceDetailsAuditLogsMeta.value.lastPage
    ) {
        return;
    }

    invoiceDetailsAuditLogsFilters.page = Math.min(
        invoiceDetailsAuditLogsMeta.value.currentPage + 1,
        invoiceDetailsAuditLogsMeta.value.lastPage,
    );
    void loadInvoiceDetailsAuditLogs(invoiceDetailsInvoice.value.id);
}

function openEditInvoiceDialog(invoice: BillingInvoice) {
    resetEditDialogForm();

    if (!billingPayerContractsLoaded.value && !billingPayerContractsLoading.value) {
        void loadBillingPayerContracts();
    }

    editDialogInvoiceId.value = invoice.id;
    editDialogInvoiceLabel.value = invoice.invoiceNumber ?? 'Billing Invoice';
    editDialogSourceInvoice.value = invoice;
    editForm.billingPayerContractId = invoice.billingPayerContractId ?? '';
    editForm.invoiceDate = dateOnlyString(invoice.invoiceDate) || today;
    editForm.currencyCode =
        (invoice.currencyCode?.trim() || defaultBillingCurrencyCode.value).toUpperCase();
    editForm.subtotalAmount =
        amountToNumber(invoice.subtotalAmount) !== null
            ? String(amountToNumber(invoice.subtotalAmount))
            : '';
    editForm.discountAmount =
        amountToNumber(invoice.discountAmount ?? null) !== null
            ? String(amountToNumber(invoice.discountAmount ?? null))
            : '';
    editForm.taxAmount =
        amountToNumber(invoice.taxAmount ?? null) !== null
            ? String(amountToNumber(invoice.taxAmount ?? null))
            : '';
    editForm.paymentDueAt = dateOnlyString(invoice.paymentDueAt);
    editForm.notes = invoice.notes ?? '';
    editForm.lineItems =
        invoiceLineItems(invoice).length > 0
            ? invoiceLineItems(invoice).map(lineItemDraftFromInvoiceLineItem)
            : [createBillingLineItemDraft()];

    editDialogOpen.value = true;
}

function closeEditInvoiceDialog() {
    if (editDialogLoading.value) return;
    editDialogOpen.value = false;
    resetEditDialogForm();
}

function editFieldError(key: string): string | null {
    return editDialogFieldErrors.value[key]?.[0] ?? null;
}

async function submitEditInvoice() {
    if (editDialogLoading.value || !editDialogInvoiceId.value) return;

    editDialogLoading.value = true;
    editDialogError.value = null;
    editDialogFieldErrors.value = {};

    try {
        const lineItems = normalizedEditLineItems();
        const subtotalAmount =
            editForm.subtotalAmount.trim() === '' && lineItems.length > 0
                ? editLineItemsSubtotal.value
                : editForm.subtotalAmount.trim() === ''
                  ? ''
                  : Number(editForm.subtotalAmount);

        const response = await apiRequest<{ data: BillingInvoice }>(
            'PATCH',
            `/billing-invoices/${editDialogInvoiceId.value}`,
            {
                body: {
                    billingPayerContractId:
                        editForm.billingPayerContractId.trim() || null,
                    invoiceDate: editForm.invoiceDate,
                    currencyCode: editForm.currencyCode.trim().toUpperCase(),
                    subtotalAmount,
                    discountAmount: parseOptionalNumber(editForm.discountAmount),
                    taxAmount: parseOptionalNumber(editForm.taxAmount),
                    paymentDueAt: editForm.paymentDueAt.trim() || null,
                    notes: editForm.notes.trim() || null,
                    lineItems: lineItems.length > 0 ? lineItems : null,
                },
            },
        );

        notifySuccess(
            `Updated ${response.data.invoiceNumber ?? 'billing invoice'} details.`,
        );
        if (invoiceDetailsInvoice.value?.id === response.data.id) {
            invoiceDetailsInvoice.value = response.data;
            if (canViewBillingInvoiceAuditLogs.value) {
                void loadInvoiceDetailsAuditLogs(response.data.id);
            }
        }
        await reloadQueueAndSummary();
        closeEditInvoiceDialog();
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };

        if (apiError.status === 422 && apiError.payload?.errors) {
            editDialogFieldErrors.value = apiError.payload.errors;
            editDialogError.value =
                apiError.payload.message ?? 'Please correct the highlighted fields.';
        } else {
            editDialogError.value =
                apiError.message ?? 'Unable to update billing invoice.';
            notifyError(editDialogError.value);
        }
    } finally {
        editDialogLoading.value = false;
    }
}

function createBillingLineItemDraft(
    overrides?: Partial<BillingInvoiceLineItemDraft>,
): BillingInvoiceLineItemDraft {
    billingLineItemDraftCounter += 1;

    return {
        key: `bil-li-${billingLineItemDraftCounter}`,
        entryMode: canReadBillingServiceCatalog.value ? 'catalog' : 'manual',
        catalogItemId: '',
        description: '',
        quantity: '1',
        unitPrice: '',
        serviceCode: '',
        unit: '',
        notes: '',
        sourceWorkflowKind: '',
        sourceWorkflowId: '',
        sourceWorkflowLabel: '',
        sourcePerformedAt: '',
        ...overrides,
    };
}

function catalogCurrencyCode(): string {
    const normalized = createForm.currencyCode.trim().toUpperCase();
    return normalized || defaultBillingCurrencyCode.value;
}

function invoiceDraftCurrencyCode(value: string): string {
    const normalized = value.trim().toUpperCase();
    return normalized || defaultBillingCurrencyCode.value;
}

function billingPayerContractById(
    id: string | null | undefined,
): BillingPayerContract | null {
    const normalized = (id ?? '').trim();
    if (!normalized) return null;

    return billingPayerContracts.value.find((item) => item.id === normalized) ?? null;
}

function billingInvoiceCoveragePostureVariantToTone(
    variant: BillingInvoiceCoveragePosture['badgeVariant'] | null | undefined,
): BillingInvoicePayerPreview['statusTone'] {
    if (variant === 'secondary') return 'secondary';
    if (variant === 'destructive') return 'destructive';
    if (variant === 'default') return 'default';

    return 'outline';
}

function billingInvoicePayerPreviewFromInvoice(
    invoice: BillingInvoice | null | undefined,
): BillingInvoicePayerPreview | null {
    if (!invoice) return null;

    const billingPayerContractId = (invoice.billingPayerContractId ?? '').trim();
    const selectedContract = billingPayerContractById(billingPayerContractId);
    const coveragePosture = billingInvoiceCoveragePosture(invoice);
    const fallbackCurrencyCode = invoiceDraftCurrencyCode(invoice.currencyCode ?? '');
    const claimGuidance = Array.isArray(invoice.claimReadiness?.guidance)
        ? invoice.claimReadiness?.guidance ?? []
        : [];

    return {
        selectedContract,
        selectedContractMissing: billingPayerContractId !== '' && selectedContract === null,
        settlementPathLabel: billingInvoiceSettlementPathLabel(invoice),
        statusLabel: coveragePosture?.label ?? billingInvoiceClaimPostureLabel(invoice),
        statusTone: billingInvoiceCoveragePostureVariantToTone(coveragePosture?.badgeVariant),
        totalAmount: amountToNumber(invoice.totalAmount ?? null) ?? 0,
        expectedPayerAmount:
            amountToNumber(invoice.payerSummary?.expectedPayerAmount ?? null) ?? 0,
        expectedPatientAmount:
            amountToNumber(invoice.payerSummary?.expectedPatientAmount ?? null)
            ?? (amountToNumber(invoice.totalAmount ?? null) ?? 0),
        coveragePercent:
            amountToNumber(invoice.payerSummary?.coveragePercent ?? null) ?? 0,
        copayType: invoice.payerSummary?.copayType ?? null,
        copayValue: amountToNumber(invoice.payerSummary?.copayValue ?? null) ?? 0,
        copayAmount: amountToNumber(invoice.payerSummary?.copayAmount ?? null) ?? 0,
        requiresPreAuthorization:
            invoice.claimReadiness?.requiresPreAuthorization === true
            || invoice.payerSummary?.requiresPreAuthorization === true,
        claimEligible: invoice.claimReadiness?.claimEligible === true,
        claimReady: invoice.claimReadiness?.ready === true,
        currencyCode: fallbackCurrencyCode,
        currencyMismatch: false,
        effectiveWindowMismatch: false,
        blockingReasons: Array.isArray(invoice.claimReadiness?.blockingReasons)
            ? invoice.claimReadiness?.blockingReasons ?? []
            : [],
        guidance:
            coveragePosture && !claimGuidance.includes(coveragePosture.description)
                ? [coveragePosture.description, ...claimGuidance]
                : claimGuidance,
    };
}

function mergeBillingPayerPreviewError(
    preview: BillingInvoicePayerPreview,
    errorMessage: string | null,
): BillingInvoicePayerPreview {
    const normalizedError = (errorMessage ?? '').trim();
    if (!normalizedError) return preview;
    if (preview.blockingReasons.includes(normalizedError)) return preview;

    return {
        ...preview,
        statusTone: 'destructive',
        blockingReasons: [normalizedError, ...preview.blockingReasons],
    };
}

function payerContractOptionLabel(contract: BillingPayerContract): string {
    const contractName = (contract.contractName ?? '').trim();
    const payerName = (contract.payerName ?? '').trim();
    const planName = (contract.payerPlanName ?? '').trim();

    return contractName || planName || payerName || contract.contractCode?.trim() || 'Payer contract';
}

function payerContractOptionDescription(contract: BillingPayerContract): string {
    return [
        contract.contractCode?.trim() || null,
        contract.payerName?.trim() || null,
        contract.payerPlanName?.trim() || null,
        contract.currencyCode?.trim() || null,
    ]
        .filter((value): value is string => Boolean(value))
        .join(' | ');
}

function payerContractOptionGroup(contract: BillingPayerContract): string | null {
    const payerType = contract.payerType ? formatEnumLabel(contract.payerType) : null;
    const currencyCode = contract.currencyCode?.trim() || null;

    if (payerType && currencyCode) {
        return `${payerType} | ${currencyCode}`;
    }

    return payerType || currencyCode;
}

function unavailableBillingPayerContractOption(
    contractId: string | null | undefined,
): SearchableSelectOption | null {
    const normalized = (contractId ?? '').trim();
    if (!normalized || billingPayerContractById(normalized)) return null;

    return {
        value: normalized,
        label: `Previously linked contract (${shortId(normalized)})`,
        description:
            'This contract is no longer in the active payer list. Clear it or choose another active contract.',
        group: 'Needs review',
        keywords: [normalized],
    };
}

function billingPayerContractOptionsFor(
    selectedContractId: string | null | undefined,
): SearchableSelectOption[] {
    const options = billingPayerContracts.value.map((contract) => ({
        value: contract.id,
        label: payerContractOptionLabel(contract),
        description: payerContractOptionDescription(contract),
        group: payerContractOptionGroup(contract),
        keywords: [
            contract.contractCode ?? '',
            contract.contractName ?? '',
            contract.payerType ?? '',
            contract.payerName ?? '',
            contract.payerPlanCode ?? '',
            contract.payerPlanName ?? '',
            contract.currencyCode ?? '',
        ]
            .map((value) => value.trim())
            .filter(Boolean),
    }));
    const unavailable = unavailableBillingPayerContractOption(selectedContractId);

    return unavailable ? [unavailable, ...options] : options;
}

function normalizedDraftSubtotal(
    subtotalAmount: string,
    calculatedSubtotal: number,
    lineItemsCount: number,
    autoPriceLineItems = false,
): number {
    if (autoPriceLineItems) {
        return Math.round(Math.max(calculatedSubtotal, 0) * 100) / 100;
    }

    const trimmed = subtotalAmount.trim();
    if (!trimmed && lineItemsCount > 0) {
        return Math.round(Math.max(calculatedSubtotal, 0) * 100) / 100;
    }

    return Math.round(Math.max(parseOptionalNumber(trimmed) ?? 0, 0) * 100) / 100;
}

function normalizedDraftTotal(
    subtotalAmount: number,
    discountAmount: string,
    taxAmount: string,
): number {
    const discount = Math.max(parseOptionalNumber(discountAmount) ?? 0, 0);
    const tax = Math.max(parseOptionalNumber(taxAmount) ?? 0, 0);

    return Math.round(Math.max((subtotalAmount - discount) + tax, 0) * 100) / 100;
}

function billingPayerContractEffectiveWindowMismatch(
    contract: BillingPayerContract,
    invoiceDate: string,
): boolean {
    const normalizedInvoiceDate = dateOnlyString(invoiceDate);
    if (!normalizedInvoiceDate) return false;

    const effectiveFrom = dateOnlyString(contract.effectiveFrom);
    const effectiveTo = dateOnlyString(contract.effectiveTo);

    if (effectiveFrom && normalizedInvoiceDate < effectiveFrom) {
        return true;
    }

    if (effectiveTo && normalizedInvoiceDate > effectiveTo) {
        return true;
    }

    return false;
}

function buildBillingInvoicePayerPreview(options: {
    billingPayerContractId: string;
    currencyCode: string;
    invoiceDate: string;
    subtotalAmount: string;
    calculatedSubtotal: number;
    lineItemsCount: number;
    discountAmount: string;
    taxAmount: string;
    autoPriceLineItems?: boolean;
}): BillingInvoicePayerPreview {
    const currencyCode = invoiceDraftCurrencyCode(options.currencyCode);
    const totalAmount = normalizedDraftTotal(
        normalizedDraftSubtotal(
            options.subtotalAmount,
            options.calculatedSubtotal,
            options.lineItemsCount,
            options.autoPriceLineItems ?? false,
        ),
        options.discountAmount,
        options.taxAmount,
    );
    const selectedContractId = options.billingPayerContractId.trim();
    const selectedContract = billingPayerContractById(selectedContractId);
    const guidance: string[] = [];
    const blockingReasons: string[] = [];

    if (!selectedContractId) {
        if (totalAmount > 0) {
            guidance.push('Leave the invoice as self-pay when the patient is responsible for the full balance.');
        } else {
            guidance.push('Add billable services first, then attach a payer contract only if a third party is responsible.');
        }

        return {
            selectedContract: null,
            selectedContractMissing: false,
            settlementPathLabel: 'Self-pay',
            statusLabel: totalAmount > 0 ? 'Patient responsible' : 'Waiting for billable amount',
            statusTone: totalAmount > 0 ? 'secondary' : 'outline',
            totalAmount,
            expectedPayerAmount: 0,
            expectedPatientAmount: totalAmount,
            coveragePercent: 0,
            copayType: 'none',
            copayValue: 0,
            copayAmount: 0,
            requiresPreAuthorization: false,
            claimEligible: false,
            claimReady: false,
            currencyCode,
            currencyMismatch: false,
            effectiveWindowMismatch: false,
            blockingReasons,
            guidance,
        };
    }

    if (!selectedContract) {
        blockingReasons.push(
            'The selected contract is no longer active in the payer-contract list. Clear it or choose another active contract.',
        );

        return {
            selectedContract: null,
            selectedContractMissing: true,
            settlementPathLabel: 'Needs review',
            statusLabel: 'Contract not available',
            statusTone: 'destructive',
            totalAmount,
            expectedPayerAmount: 0,
            expectedPatientAmount: totalAmount,
            coveragePercent: 0,
            copayType: null,
            copayValue: 0,
            copayAmount: 0,
            requiresPreAuthorization: false,
            claimEligible: false,
            claimReady: false,
            currencyCode,
            currencyMismatch: false,
            effectiveWindowMismatch: false,
            blockingReasons,
            guidance,
        };
    }

    const contractCurrencyCode = invoiceDraftCurrencyCode(selectedContract.currencyCode ?? '');
    const coveragePercent = Math.min(
        Math.max(amountToNumber(selectedContract.defaultCoveragePercent ?? null) ?? 0, 0),
        100,
    );
    const copayType = (selectedContract.defaultCopayType ?? 'none').trim().toLowerCase() || 'none';
    const copayValue = Math.max(amountToNumber(selectedContract.defaultCopayValue ?? null) ?? 0, 0);
    const coveredAmountByPercent = Math.round(totalAmount * (coveragePercent / 100) * 100) / 100;
    const coveragePatientShare = Math.round(Math.max(totalAmount - coveredAmountByPercent, 0) * 100) / 100;
    const copayAmount =
        copayType === 'fixed'
            ? Math.round(Math.min(totalAmount, copayValue) * 100) / 100
            : copayType === 'percentage'
              ? Math.round(Math.min(totalAmount, totalAmount * (copayValue / 100)) * 100) / 100
              : 0;
    const expectedPatientAmount = Math.round(
        Math.min(totalAmount, Math.max(coveragePatientShare, copayAmount)) * 100,
    ) / 100;
    const expectedPayerAmount = Math.round(
        Math.max(totalAmount - expectedPatientAmount, 0) * 100,
    ) / 100;
    const currencyMismatch = contractCurrencyCode !== currencyCode;
    const effectiveWindowMismatch = billingPayerContractEffectiveWindowMismatch(
        selectedContract,
        options.invoiceDate,
    );
    const requiresPreAuthorization = selectedContract.requiresPreAuthorization === true;
    const claimEligible =
        totalAmount > 0 &&
        expectedPayerAmount > 0 &&
        !currencyMismatch &&
        !effectiveWindowMismatch;
    const claimReady = claimEligible && !requiresPreAuthorization;

    if (currencyMismatch) {
        blockingReasons.push(
            `Contract currency ${contractCurrencyCode} does not match invoice currency ${currencyCode}.`,
        );
    }

    if (effectiveWindowMismatch) {
        blockingReasons.push(
            'Invoice date is outside the selected contract effective window.',
        );
    }

    if (requiresPreAuthorization && expectedPayerAmount > 0) {
        guidance.push(
            'Pre-authorization is required before the claim can move forward. Save the invoice, then complete payer authorization review.',
        );
    }

    if (claimReady) {
        guidance.push(
            'This invoice can move into the claims workflow after it is issued.',
        );
    } else if (claimEligible && !claimReady) {
        guidance.push(
            'Coverage is available, but authorization checks still need to be completed.',
        );
    } else if (expectedPayerAmount <= 0 && totalAmount > 0) {
        guidance.push(
            'This contract leaves the full amount with the patient, so no insurance claim is expected from this invoice.',
        );
    } else if (totalAmount <= 0) {
        guidance.push(
            'Billable total is still zero. Add billable services or adjust discounts/tax before using this contract for a claim.',
        );
    }

    return {
        selectedContract,
        selectedContractMissing: false,
        settlementPathLabel: [
            selectedContract.payerName?.trim() || null,
            selectedContract.contractName?.trim() || null,
        ]
            .filter((value): value is string => Boolean(value))
            .join(' | ') || 'Payer contract',
        statusLabel: currencyMismatch
            ? 'Currency mismatch'
            : effectiveWindowMismatch
              ? 'Outside contract dates'
              : claimReady
                ? 'Claim-ready after issue'
                : claimEligible
                  ? 'Authorization review required'
                  : 'Patient responsible',
        statusTone: currencyMismatch || effectiveWindowMismatch
            ? 'destructive'
            : claimReady
              ? 'secondary'
              : claimEligible
                ? 'outline'
                : 'default',
        totalAmount,
        expectedPayerAmount,
        expectedPatientAmount,
        coveragePercent,
        copayType,
        copayValue,
        copayAmount,
        requiresPreAuthorization,
        claimEligible,
        claimReady,
        currencyCode,
        currencyMismatch,
        effectiveWindowMismatch,
        blockingReasons,
        guidance,
    };
}

function billingServiceCatalogItemById(
    id: string | null | undefined,
): BillingServiceCatalogItem | null {
    const normalized = (id ?? '').trim();
    if (!normalized) return null;

    return (
        billingServiceCatalogItems.value.find((item) => item.id === normalized) ?? null
    );
}

function applyBillingServiceCatalogItemToDraft(
    draft: BillingInvoiceLineItemDraft,
    catalogItem: BillingServiceCatalogItem | null,
) {
    if (!catalogItem) {
        draft.catalogItemId = '';
        draft.description = '';
        draft.serviceCode = '';
        draft.unit = '';
        draft.unitPrice = '';
        return;
    }

    draft.catalogItemId = catalogItem.id;
    draft.description = (catalogItem.serviceName ?? catalogItem.serviceCode ?? '').trim();
    draft.serviceCode = (catalogItem.serviceCode ?? '').trim();
    draft.unit = (catalogItem.unit ?? '').trim();
    draft.unitPrice =
        amountToNumber(catalogItem.basePrice ?? null) !== null
            ? String(amountToNumber(catalogItem.basePrice ?? null))
            : '';
}

function setCreateLineItemEntryMode(
    draft: BillingInvoiceLineItemDraft,
    entryMode: 'catalog' | 'manual',
) {
    draft.entryMode = entryMode;

    if (entryMode === 'catalog') {
        const selectedCatalogItem = billingServiceCatalogItemById(draft.catalogItemId);
        if (selectedCatalogItem) {
            applyBillingServiceCatalogItemToDraft(draft, selectedCatalogItem);
        } else if (
            !draft.description.trim() &&
            !draft.serviceCode.trim() &&
            !draft.unit.trim() &&
            !draft.unitPrice.trim()
        ) {
            draft.catalogItemId = '';
        }
        return;
    }

    draft.catalogItemId = '';
}

function selectCreateLineItemCatalogItem(
    draft: BillingInvoiceLineItemDraft,
    catalogItemId: string,
) {
    applyBillingServiceCatalogItemToDraft(
        draft,
        billingServiceCatalogItemById(catalogItemId),
    );
}

function lineItemIsEffectivelyEmpty(item: BillingInvoiceLineItemDraft): boolean {
    return (
        !item.description.trim() &&
        !item.serviceCode.trim() &&
        !item.unit.trim() &&
        !item.unitPrice.trim() &&
        !item.notes.trim() &&
        Math.max(parseLineItemNumber(item.quantity, 0), 0) <= 1
    );
}

function syncCreateLineItemsForCatalogMode() {
    createForm.lineItems.forEach((draft) => {
        if (!canReadBillingServiceCatalog.value) {
            if (draft.entryMode === 'catalog') {
                draft.entryMode = 'manual';
                draft.catalogItemId = '';
            }
            return;
        }

        if (draft.entryMode === 'catalog' && draft.catalogItemId.trim()) {
            applyBillingServiceCatalogItemToDraft(
                draft,
                billingServiceCatalogItemById(draft.catalogItemId),
            );
            return;
        }

        if (lineItemIsEffectivelyEmpty(draft)) {
            draft.entryMode = 'catalog';
        }
    });
}

async function loadBillingServiceCatalog() {
    if (!canReadBillingServiceCatalog.value) {
        billingServiceCatalogItems.value = [];
        billingServiceCatalogError.value = null;
        billingServiceCatalogLoading.value = false;
        billingCreateBootstrapComplete.value = true;
        syncCreateLineItemsForCatalogMode();
        return;
    }

    billingServiceCatalogLoading.value = true;
    billingServiceCatalogError.value = null;

    try {
        const response = await apiRequest<BillingServiceCatalogListResponse>(
            'GET',
            '/billing-service-catalog/items',
            {
                query: {
                    status: 'active',
                    currencyCode: catalogCurrencyCode(),
                    perPage: 200,
                    sortBy: 'serviceName',
                    sortDir: 'asc',
                },
            },
        );
        billingServiceCatalogItems.value = response.data;
    } catch (error) {
        billingServiceCatalogItems.value = [];
        billingServiceCatalogError.value = messageFromUnknown(
            error,
            'Unable to load billing service catalog.',
        );
    } finally {
        billingServiceCatalogLoading.value = false;
        billingCreateBootstrapComplete.value = true;
        syncCreateLineItemsForCatalogMode();
    }
}

async function loadBillingPayerContracts() {
    if (!canReadBillingPayerContracts.value) {
        billingPayerContracts.value = [];
        billingPayerContractsError.value = null;
        billingPayerContractsLoading.value = false;
        billingPayerContractsLoaded.value = true;
        return;
    }

    billingPayerContractsLoading.value = true;
    billingPayerContractsError.value = null;

    try {
        const response = await apiRequest<BillingPayerContractListResponse>(
            'GET',
            '/billing-payer-contracts',
            {
                query: {
                    status: 'active',
                    perPage: 200,
                    sortBy: 'contractName',
                    sortDir: 'asc',
                },
            },
        );
        billingPayerContracts.value = response.data;
    } catch (error) {
        billingPayerContracts.value = [];
        billingPayerContractsError.value = messageFromUnknown(
            error,
            'Unable to load payer contracts.',
        );
    } finally {
        billingPayerContractsLoading.value = false;
        billingPayerContractsLoaded.value = true;
    }
}

const billingServiceCatalogOptions = computed<SearchableSelectOption[]>(() =>
    billingServiceCatalogItems.value.map((item) => {
        const priceLabel =
            amountToNumber(item.basePrice ?? null) !== null
                ? formatMoney(item.basePrice, item.currencyCode || catalogCurrencyCode())
                : 'No tariff';
        const serviceCode = (item.serviceCode ?? '').trim();
        const serviceType = (item.serviceType ?? '').trim();
        const department = (item.department ?? '').trim();
        const unit = (item.unit ?? '').trim();
        const groupLabel =
            department && serviceType
                ? `${department} - ${formatEnumLabel(serviceType)}`
                : department || (serviceType ? formatEnumLabel(serviceType) : 'Other');

        return {
            value: item.id,
            label: ((item.serviceName ?? serviceCode) || 'Unnamed service').trim(),
            description: [serviceCode || null, priceLabel, unit || null]
                .filter((value): value is string => Boolean(value))
                .join(' | '),
            keywords: [
                serviceCode,
                item.serviceName ?? '',
                department,
                serviceType,
                unit,
                String(item.basePrice ?? ''),
            ].filter((value) => value.trim().length > 0),
            group: groupLabel,
        };
    }),
);
const createBillingPayerContractOptions = computed<SearchableSelectOption[]>(() =>
    billingPayerContractOptionsFor(createForm.billingPayerContractId),
);
const editBillingPayerContractOptions = computed<SearchableSelectOption[]>(() =>
    billingPayerContractOptionsFor(editForm.billingPayerContractId),
);
const createBillingDraftPreviewSignature = computed(() => {
    const payload = buildCreateBillingDraftPreviewPayload();
    return payload ? JSON.stringify(payload) : '';
});
const editBillingDraftPreviewSignature = computed(() => {
    const payload = buildEditBillingDraftPreviewPayload();
    return payload ? JSON.stringify(payload) : '';
});
const localCreateBillingPayerPreview = computed<BillingInvoicePayerPreview>(() =>
    buildBillingInvoicePayerPreview({
        billingPayerContractId: createForm.billingPayerContractId,
        currencyCode: createForm.currencyCode,
        invoiceDate: createForm.invoiceDate,
        subtotalAmount: '',
        calculatedSubtotal: createLineItemsSubtotal.value,
        lineItemsCount: createLineItemsCount.value,
        discountAmount: createForm.discountAmount,
        taxAmount: createForm.taxAmount,
        autoPriceLineItems: billingCreateUsesCatalogPricing.value,
    }),
);
const localEditBillingPayerPreview = computed<BillingInvoicePayerPreview>(() =>
    buildBillingInvoicePayerPreview({
        billingPayerContractId: editForm.billingPayerContractId,
        currencyCode: editForm.currencyCode,
        invoiceDate: editForm.invoiceDate,
        subtotalAmount: editForm.subtotalAmount,
        calculatedSubtotal: editLineItemsSubtotal.value,
        lineItemsCount: editLineItemsCount.value,
        discountAmount: editForm.discountAmount,
        taxAmount: editForm.taxAmount,
    }),
);
const selectedCreateBillingPayerPreview = computed<BillingInvoicePayerPreview>(() => {
    const previewFromInvoice = billingInvoicePayerPreviewFromInvoice(
        createBillingDraftPreviewInvoice.value,
    );
    const basePreview = previewFromInvoice ?? localCreateBillingPayerPreview.value;

    return mergeBillingPayerPreviewError(
        basePreview,
        createBillingDraftPreviewError.value,
    );
});
const createBillingDraftPreviewCoveragePosture = computed(() =>
    billingInvoiceCoveragePosture(createBillingDraftPreviewInvoice.value),
);
const createBillingDraftPreviewCoverageMetricBadges = computed(() =>
    billingInvoiceCoverageMetricBadges(createBillingDraftPreviewInvoice.value),
);
const createBillingDraftPreviewNegotiatedCount = computed(() =>
    Math.max(
        createBillingDraftPreviewInvoice.value?.priceOverrideSummary?.matchedOverrideCount ?? 0,
        0,
    ),
);
const createDraftExecutionPreview = computed<BillingDraftExecutionPreview>(() =>
    buildBillingDraftExecutionPreview({
        invoice: createBillingDraftPreviewInvoice.value,
        usesThirdParty: createCoverageMode.value === 'third_party',
        contractPending: createCoverageNeedsContract.value,
    }),
);
const createDraftSaveGuidanceTitle = computed(() =>
    createWorkspaceIsEditingDraft.value ? 'Save draft changes only' : 'Save draft only',
);
const createDraftSaveGuidanceDescription = computed(() => {
    const preview = createDraftExecutionPreview.value;

    return `This step saves the draft only. When billing issues it, the invoice will move into ${preview.afterIssueLabel}. ${preview.afterIssueHelper}`;
});
const suggestedCreateCoverageMode = computed<BillingCreateCoverageMode>(() => {
    if (createForm.billingPayerContractId.trim()) return 'third_party';

    return createVisitCoverage.value
        && isThirdPartyFinancialClass(createVisitCoverage.value.financialClass)
        ? 'third_party'
        : 'self_pay';
});
const statusDialogPreferredPaymentPayerType = computed(() =>
    billingInvoicePreferredPaymentPayerType(statusDialogInvoice.value),
);
const statusDialogPreferredPaymentPayerTypeLabel = computed(() =>
    billingPaymentPayerTypeLabel(statusDialogPreferredPaymentPayerType.value),
);
const statusDialogPaymentPayerTypeHelper = computed(() => {
    if (!statusDialogShowsPaidAmount.value) return null;

    const preferredLabel = statusDialogPreferredPaymentPayerTypeLabel.value;
    const selectedValue = statusDialogPaymentPayerType.value.trim();
    const selectedLabel = statusDialogSelectedPaymentPayerTypeLabel.value;

    if (!selectedValue) {
        return `Start from ${preferredLabel} for this invoice's settlement path.`;
    }

    if (
        selectedValue !== statusDialogPreferredPaymentPayerType.value &&
        selectedLabel
    ) {
        return `Invoice settlement suggests ${preferredLabel}, but this entry is being recorded as ${selectedLabel}.`;
    }

    return `Aligned with ${preferredLabel} settlement for this invoice.`;
});
const createCoverageMode = computed<BillingCreateCoverageMode>(() =>
    createCoverageModeOverride.value ?? suggestedCreateCoverageMode.value,
);
const createCoverageNeedsContract = computed(
    () =>
        createCoverageMode.value === 'third_party'
        && !createForm.billingPayerContractId.trim(),
);
const createCoverageStatusTone = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    if (!createCoverageNeedsContract.value) {
        return selectedCreateBillingPayerPreview.value.statusTone;
    }

    return canReadBillingPayerContracts.value ? 'outline' : 'destructive';
});
const createCoverageStatusLabel = computed(() => {
    if (!createCoverageNeedsContract.value) {
        return selectedCreateBillingPayerPreview.value.statusLabel;
    }

    return canReadBillingPayerContracts.value
        ? 'Choose payer contract'
        : 'Contract access unavailable';
});
const createCoverageSettlementPathDisplay = computed(() => {
    if (!createCoverageNeedsContract.value) {
        return selectedCreateBillingPayerPreview.value.settlementPathLabel;
    }

    if (createVisitCoverage.value) {
        return financialClassLabel(createVisitCoverage.value.financialClass);
    }

    return 'Third-party coverage';
});
const createCoverageExpectedPayerDisplay = computed(() =>
    createCoverageNeedsContract.value
        ? 'Pending contract'
        : formatMoney(
            selectedCreateBillingPayerPreview.value.expectedPayerAmount,
            selectedCreateBillingPayerPreview.value.currencyCode,
        ),
);
const createCoverageExpectedPatientDisplay = computed(() =>
    createCoverageNeedsContract.value
        ? 'Pending contract'
        : formatMoney(
            selectedCreateBillingPayerPreview.value.expectedPatientAmount,
            selectedCreateBillingPayerPreview.value.currencyCode,
        ),
);
const createCoverageClaimPostureDisplay = computed(() => {
    if (createCoverageNeedsContract.value) {
        return 'Link contract first';
    }

    return selectedCreateBillingPayerPreview.value.claimReady
        ? 'Ready after issue'
        : selectedCreateBillingPayerPreview.value.claimEligible
          ? 'Authorization review'
          : 'No claim path yet';
});
const createCoverageContractHelperText = computed(() => {
    if (billingPayerContractsLoading.value) {
        return 'Loading active payer contracts...';
    }

    if (createVisitCoverageContract.value) {
        return `Visit coverage already points to ${payerContractOptionLabel(createVisitCoverageContract.value)}. Keep it or choose another active contract if settlement changed.`;
    }

    if (
        createVisitCoverage.value
        && isThirdPartyFinancialClass(createVisitCoverage.value.financialClass)
    ) {
        return `Visit coverage suggests ${financialClassLabel(createVisitCoverage.value.financialClass)}. Select the exact active payer contract for this invoice.`;
    }

    return 'Select an active contract only when a third-party payer is expected to settle part of this invoice.';
});
const createCoverageBlockingReasons = computed(() => {
    if (!createCoverageNeedsContract.value) {
        return selectedCreateBillingPayerPreview.value.blockingReasons;
    }

    if (!canReadBillingPayerContracts.value) {
        return [
            'This user cannot browse payer contracts here, so another billing user must link the contract before issuing a claim.',
        ];
    }

    if (
        billingPayerContractsLoaded.value
        && !billingPayerContractsLoading.value
        && billingPayerContracts.value.length === 0
    ) {
        return [
            'No active payer contracts are available in this billing scope, so third-party settlement cannot be completed yet.',
        ];
    }

    return [
        'Select the exact payer contract before issuing this invoice through a third-party settlement path.',
    ];
});
const createCoverageGuidance = computed(() => {
    if (!createCoverageNeedsContract.value) {
        return selectedCreateBillingPayerPreview.value.guidance;
    }

    const guidance: string[] = [];

    if (createVisitCoverage.value) {
        guidance.push(
            `Visit coverage suggests ${financialClassLabel(createVisitCoverage.value.financialClass)}. Link the exact payer contract before claim routing.`,
        );
    } else {
        guidance.push(
            'Choose third-party coverage only when an insurer, employer, government program, donor, or sponsor is expected to settle part of this invoice.',
        );
    }

    if (selectedCreateBillingPayerPreview.value.totalAmount > 0) {
        guidance.push(
            'The billed amount is ready. Once the contract is linked, Billing will calculate payer and patient responsibility.',
        );
    } else {
        guidance.push(
            'Add billable services first so Billing can calculate payer and patient responsibility once the contract is linked.',
        );
    }

    return guidance;
});
const createCoverageModeContextHint = computed(() => {
    if (!createVisitCoverage.value) return null;

    const inheritedIsThirdParty = isThirdPartyFinancialClass(
        createVisitCoverage.value.financialClass,
    );
    const inheritedLabel = financialClassLabel(
        createVisitCoverage.value.financialClass,
    );

    if (createCoverageMode.value === 'self_pay' && inheritedIsThirdParty) {
        return `Visit coverage suggests ${inheritedLabel}, but this invoice is currently self-pay.`;
    }

    if (createCoverageMode.value === 'third_party' && !inheritedIsThirdParty) {
        return 'The linked visit was registered as self-pay, but this invoice is being routed through third-party coverage.';
    }

    return `Starting from visit coverage: ${compactVisitCoverageSummary(createVisitCoverage.value)}.`;
});
const billingChargeCaptureCoverageBadgeLabel = computed(() => {
    if (createCoverageNeedsContract.value) {
        return 'Third-party contract pending';
    }

    return createCoverageMode.value === 'third_party'
        ? 'Third-party settlement'
        : 'Self-pay settlement';
});
const billingChargeCaptureCoverageBadgeVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    if (createCoverageNeedsContract.value) return 'outline';

    return createCoverageMode.value === 'third_party' ? 'secondary' : 'outline';
});
const billingChargeCaptureSectionDescription = computed(() => {
    if (createCoverageNeedsContract.value) {
        return 'Import completed services now. Link the payer contract before issue.';
    }

    if (createCoverageMode.value === 'third_party') {
        return 'Import completed services that should follow the selected payer path.';
    }

    return 'Import completed services for direct patient billing.';
});
const billingChargeCaptureContextGuidance = computed(() => {
    if (createCoverageNeedsContract.value) {
        return 'Pricing can be captured now; payer routing is completed after the contract is linked.';
    }

    if (createCoverageMode.value === 'third_party') {
        return selectedCreateBillingPayerPreview.value.claimReady
            ? 'Imported services stay on the selected payer path.'
            : 'Imported services stay on the third-party path, but claim review is still required.';
    }

    return 'Imported services stay on patient-pay for cashier collection.';
});
const billingChargeCaptureEmptyStateDescription = computed(() => {
    const base =
        'Completed lab, imaging, procedure, and dispensed pharmacy work will appear here when they are still waiting to be invoiced.';

    if (createCoverageNeedsContract.value) {
        return `${base} The invoice is already marked for third-party settlement, but the payer contract still needs linking before issue.`;
    }

    if (createCoverageMode.value === 'third_party') {
        return `${base} Imported services will follow the selected third-party settlement path already attached to this invoice.`;
    }

    return base;
});
const billingChargeCaptureBulkActionLabel = computed(() =>
    createCoverageMode.value === 'third_party'
        ? 'Add priced services'
        : 'Add priced services',
);
const selectedEditBillingPayerPreview = computed<BillingInvoicePayerPreview>(() => {
    const previewFromInvoice = billingInvoicePayerPreviewFromInvoice(
        editBillingDraftPreviewInvoice.value,
    );
    const basePreview = previewFromInvoice ?? localEditBillingPayerPreview.value;

    return mergeBillingPayerPreviewError(
        basePreview,
        editBillingDraftPreviewError.value,
    );
});
const editBillingDraftPreviewCoveragePosture = computed(() =>
    billingInvoiceCoveragePosture(editBillingDraftPreviewInvoice.value),
);
const editBillingDraftPreviewCoverageMetricBadges = computed(() =>
    billingInvoiceCoverageMetricBadges(editBillingDraftPreviewInvoice.value),
);
const editBillingDraftPreviewNegotiatedCount = computed(() =>
    Math.max(
        editBillingDraftPreviewInvoice.value?.priceOverrideSummary?.matchedOverrideCount ?? 0,
        0,
    ),
);
const editDraftExecutionPreview = computed<BillingDraftExecutionPreview>(() =>
    buildBillingDraftExecutionPreview({
        invoice: editBillingDraftPreviewInvoice.value,
        usesThirdParty: Boolean(editForm.billingPayerContractId.trim()),
        contractPending: false,
    }),
);
const editDraftSaveGuidanceDescription = computed(() => {
    const preview = editDraftExecutionPreview.value;

    return `Saving here keeps this invoice in draft. When billing issues it, the invoice will move into ${preview.afterIssueLabel}. ${preview.afterIssueHelper}`;
});

function hasLineItemSourceRef(
    item: Pick<BillingInvoiceLineItemDraft, 'sourceWorkflowKind' | 'sourceWorkflowId'>,
    sourceWorkflowKind: string,
    sourceWorkflowId: string,
): boolean {
    return item.sourceWorkflowKind.trim() === sourceWorkflowKind.trim()
        && item.sourceWorkflowId.trim() === sourceWorkflowId.trim();
}

function createLineItemDraftFromChargeCaptureCandidate(
    candidate: BillingChargeCaptureCandidate,
): BillingInvoiceLineItemDraft {
    const suggested = candidate.suggestedLineItem;
    const normalizedServiceCode = (candidate.serviceCode ?? '').trim().toUpperCase();
    const catalogMatch = candidate.serviceCode
        ? billingServiceCatalogItems.value.find(
            (item) => (item.serviceCode ?? '').trim().toUpperCase() === normalizedServiceCode,
        )
        : null;
    const entryMode = catalogMatch ? 'catalog' : 'manual';

    return createBillingLineItemDraft({
        entryMode,
        catalogItemId: catalogMatch?.id ?? '',
        description: suggested.description ?? candidate.serviceName ?? '',
        quantity:
            amountToNumber(suggested.quantity ?? candidate.quantity ?? null) !== null
                ? String(amountToNumber(suggested.quantity ?? candidate.quantity ?? null))
                : '1',
        unitPrice:
            amountToNumber(suggested.unitPrice ?? candidate.unitPrice ?? null) !== null
                ? String(amountToNumber(suggested.unitPrice ?? candidate.unitPrice ?? null))
                : '',
        serviceCode: suggested.serviceCode ?? candidate.serviceCode ?? '',
        unit: suggested.unit ?? candidate.unit ?? '',
        notes: suggested.notes ?? '',
        sourceWorkflowKind: suggested.sourceWorkflowKind ?? candidate.sourceWorkflowKind ?? '',
        sourceWorkflowId: suggested.sourceWorkflowId ?? candidate.sourceWorkflowId ?? '',
        sourceWorkflowLabel: suggested.sourceWorkflowLabel ?? candidate.sourceWorkflowLabel ?? '',
        sourcePerformedAt: suggested.sourcePerformedAt ?? candidate.performedAt ?? '',
    });
}

function syncImportedChargeCaptureCandidateIdsFromLineItems() {
    importedChargeCaptureCandidateIds.value = createForm.lineItems
        .filter(
            (item) => item.sourceWorkflowKind.trim() !== '' && item.sourceWorkflowId.trim() !== '',
        )
        .map((item) => `${item.sourceWorkflowKind.trim()}:${item.sourceWorkflowId.trim()}`);
}

function importBillingChargeCaptureCandidate(candidate: BillingChargeCaptureCandidate) {
    const existing = createForm.lineItems.find((item) =>
        hasLineItemSourceRef(
            item,
            candidate.sourceWorkflowKind,
            candidate.sourceWorkflowId,
        ),
    );

    if (existing) {
        notifyError('This service is already in the basket.');
        return;
    }

    const draft = createLineItemDraftFromChargeCaptureCandidate(candidate);
    const currentLineItemsAreEmpty =
        createForm.lineItems.length === 1
        && lineItemIsEffectivelyEmpty(createForm.lineItems[0])
        && createForm.lineItems[0].sourceWorkflowId.trim() === '';

    if (currentLineItemsAreEmpty) {
        createForm.lineItems = [draft];
    } else {
        createForm.lineItems.push(draft);
    }

    activeCreateLineItemKey.value = draft.key;
    syncImportedChargeCaptureCandidateIdsFromLineItems();
}

const visibleBillingChargeCaptureCandidates = computed(() =>
    billingChargeCaptureCandidates.value.filter((candidate) => !candidate.alreadyInvoiced),
);
const billingChargeCaptureImportableCandidates = computed(() => {
    const importedIds = new Set(importedChargeCaptureCandidateIds.value);

    return visibleBillingChargeCaptureCandidates.value.filter(
        (candidate) =>
            candidate.pricingStatus === 'priced' &&
            !importedIds.has(candidate.id) &&
            !createForm.lineItems.some((item) =>
                hasLineItemSourceRef(
                    item,
                    candidate.sourceWorkflowKind,
                    candidate.sourceWorkflowId,
                ),
            ),
    );
});
const billingChargeCaptureReadyCount = computed(
    () =>
        visibleBillingChargeCaptureCandidates.value.filter(
            (candidate) => candidate.pricingStatus === 'priced',
        ).length,
);
const billingChargeCaptureNeedsTariffCount = computed(
    () =>
        visibleBillingChargeCaptureCandidates.value.filter(
            (candidate) => candidate.pricingStatus !== 'priced',
        ).length,
);
const billingChargeCaptureImportedCount = computed(() => {
    const importedIds = new Set(importedChargeCaptureCandidateIds.value);

    return visibleBillingChargeCaptureCandidates.value.filter((candidate) =>
        importedIds.has(candidate.id),
    ).length;
});

function importReadyBillingChargeCaptureCandidates() {
    const candidates = billingChargeCaptureImportableCandidates.value;

    if (candidates.length === 0) {
        notifyError('No priced services are ready to add to the basket.');
        return;
    }

    const drafts = candidates.map((candidate) => createLineItemDraftFromChargeCaptureCandidate(candidate));
    const currentLineItemsAreEmpty =
        createForm.lineItems.length === 1
        && lineItemIsEffectivelyEmpty(createForm.lineItems[0])
        && createForm.lineItems[0].sourceWorkflowId.trim() === '';

    if (currentLineItemsAreEmpty) {
        createForm.lineItems = drafts;
    } else {
        createForm.lineItems.push(...drafts);
    }

    activeCreateLineItemKey.value = drafts[0]?.key ?? '';
    syncImportedChargeCaptureCandidateIdsFromLineItems();
}

async function loadBillingChargeCaptureCandidates() {
    if (!canCreateBillingInvoices.value) {
        billingChargeCaptureCandidates.value = [];
        billingChargeCaptureMeta.value = null;
        billingChargeCaptureError.value = null;
        billingChargeCaptureLoading.value = false;
        importedChargeCaptureCandidateIds.value = [];
        return;
    }

    const patientId = createForm.patientId.trim();
    if (patientId === '') {
        billingChargeCaptureCandidates.value = [];
        billingChargeCaptureMeta.value = null;
        billingChargeCaptureError.value = null;
        billingChargeCaptureLoading.value = false;
        importedChargeCaptureCandidateIds.value = [];
        return;
    }

    billingChargeCaptureLoading.value = true;
    billingChargeCaptureError.value = null;

    try {
        const response = await apiRequest<BillingChargeCaptureCandidateListResponse>(
            'GET',
            '/billing-invoices/charge-capture-candidates',
            {
                query: {
                    patientId,
                    appointmentId: createForm.appointmentId.trim() || null,
                    admissionId: createForm.admissionId.trim() || null,
                    currencyCode: createForm.currencyCode.trim().toUpperCase() || null,
                    includeInvoiced: false,
                    limit: 100,
                },
            },
        );
        billingChargeCaptureCandidates.value = response.data ?? [];
        billingChargeCaptureMeta.value = response.meta ?? null;
        syncImportedChargeCaptureCandidateIdsFromLineItems();
    } catch (error) {
        billingChargeCaptureCandidates.value = [];
        billingChargeCaptureMeta.value = null;
        billingChargeCaptureError.value = messageFromUnknown(
            error,
            'Unable to load billable clinical services.',
        );
    } finally {
        billingChargeCaptureLoading.value = false;
    }
}

const billingCreateUsesCatalogPricing = computed(() => {
    const lineItems = normalizedCreateLineItems();
    if (lineItems.length === 0 || !canReadBillingServiceCatalog.value) return false;

    return createForm.lineItems
        .filter((item) => !lineItemIsEffectivelyEmpty(item))
        .every(
            (item) =>
                item.entryMode === 'catalog' &&
                item.catalogItemId.trim() !== '' &&
                item.serviceCode.trim() !== '',
        );
});

function parseLineItemNumber(value: string, fallback = 0): number {
    const parsed = parseOptionalNumber(value);
    return parsed === null ? fallback : parsed;
}

function createLineItemTotalDraft(item: BillingInvoiceLineItemDraft): number {
    const quantity = Math.max(parseLineItemNumber(item.quantity, 0), 0);
    const unitPrice = Math.max(parseLineItemNumber(item.unitPrice, 0), 0);

    return Math.round(quantity * unitPrice * 100) / 100;
}

function normalizedCreateLineItems(): BillingInvoiceLineItem[] {
    return createForm.lineItems
        .map((item) => {
            const description = item.description.trim();
            const quantity = Math.max(parseLineItemNumber(item.quantity, 0), 0);
            const unitPrice = Math.max(parseLineItemNumber(item.unitPrice, 0), 0);
            const serviceCode = item.serviceCode.trim() || null;
            const unit = item.unit.trim() || null;
            const notes = item.notes.trim() || null;
            const sourceWorkflowKind = item.sourceWorkflowKind.trim() || null;
            const sourceWorkflowId = item.sourceWorkflowId.trim() || null;
            const sourceWorkflowLabel = item.sourceWorkflowLabel.trim() || null;
            const sourcePerformedAt = item.sourcePerformedAt.trim() || null;
            const lineTotal = Math.round(quantity * unitPrice * 100) / 100;

            return {
                description,
                quantity,
                unitPrice,
                lineTotal,
                serviceCode,
                unit,
                notes,
                sourceWorkflowKind,
                sourceWorkflowId,
                sourceWorkflowLabel,
                sourcePerformedAt,
            };
        })
        .filter(
            (item) =>
                item.description !== '' ||
                item.quantity > 0 ||
                item.unitPrice > 0 ||
                item.serviceCode !== null ||
                item.notes !== null,
        )
        .filter((item) => item.description !== '');
}

function addCreateLineItem() {
    createLineItemWorkspaceTab.value = 'compose';
    const draft = createBillingLineItemDraft({
        entryMode: 'manual',
    });
    createForm.lineItems.push(draft);
    activeCreateLineItemKey.value = draft.key;
}

function addCreateCatalogLineItem() {
    createLineItemWorkspaceTab.value = 'compose';
    const draft = createBillingLineItemDraft();
    createForm.lineItems.push(draft);
    activeCreateLineItemKey.value = draft.key;
}

function removeCreateLineItem(key: string) {
    if (createForm.lineItems.length <= 1) {
        const draft = createBillingLineItemDraft();
        createForm.lineItems = [draft];
        activeCreateLineItemKey.value = draft.key;
        syncImportedChargeCaptureCandidateIdsFromLineItems();
        return;
    }

    const removedIndex = createForm.lineItems.findIndex((item) => item.key === key);
    createForm.lineItems = createForm.lineItems.filter((item) => item.key !== key);
    const nextActiveItem =
        createForm.lineItems[Math.min(Math.max(removedIndex, 0), createForm.lineItems.length - 1)]
        ?? createForm.lineItems[0]
        ?? null;
    activeCreateLineItemKey.value = nextActiveItem?.key ?? '';
    syncImportedChargeCaptureCandidateIdsFromLineItems();
}

const createLineItemsSubtotal = computed(() =>
    Math.round(
        normalizedCreateLineItems().reduce(
            (sum, item) => sum + (item.lineTotal ?? item.quantity * item.unitPrice),
            0,
        ) * 100,
    ) / 100,
);

const createLineItemsCount = computed(
    () => normalizedCreateLineItems().length,
);
function createLineItemIsVisibleInReview(item: BillingInvoiceLineItemDraft): boolean {
    return (
        !lineItemIsEffectivelyEmpty(item)
        || item.sourceWorkflowId.trim() !== ''
        || item.catalogItemId.trim() !== ''
    );
}
function createLineItemIsExceptionCharge(item: BillingInvoiceLineItemDraft): boolean {
    return item.entryMode === 'manual' && createLineItemIsVisibleInReview(item);
}
function createLineItemExceptionReasonMissing(item: BillingInvoiceLineItemDraft): boolean {
    return createLineItemIsExceptionCharge(item) && item.notes.trim() === '';
}
function ensureActiveCreateLineItem(preferredKey?: string | null) {
    const currentKey = activeCreateLineItemKey.value.trim();
    const candidates = [preferredKey ?? '', currentKey];

    for (const candidateKey of candidates) {
        if (
            candidateKey.trim() !== ''
            && createForm.lineItems.some((item) => item.key === candidateKey)
        ) {
            activeCreateLineItemKey.value = candidateKey;
            return;
        }
    }

    const firstVisibleItem =
        createForm.lineItems.find((item) => createLineItemIsVisibleInReview(item)) ?? null;

    activeCreateLineItemKey.value = firstVisibleItem?.key ?? '';
}
function setActiveCreateLineItem(key: string) {
    activeCreateLineItemKey.value = key;
    createLineItemWorkspaceTab.value = 'compose';
}
function createLineItemDraftDisplayLabel(
    item: BillingInvoiceLineItemDraft,
    fallbackIndex?: number,
): string {
    const catalogLabel = (
        billingServiceCatalogItemById(item.catalogItemId)?.serviceName ?? ''
    ).trim();

    return item.description.trim()
        || catalogLabel
        || item.sourceWorkflowLabel.trim()
        || (fallbackIndex !== undefined ? `Line ${fallbackIndex + 1}` : 'Charge line');
}
const createReviewLineItems = computed(() => {
    const visibleItems = createForm.lineItems.filter((item) =>
        createLineItemIsVisibleInReview(item),
    );

    return visibleItems;
});
const createExceptionChargeLineItems = computed(() =>
    createForm.lineItems.filter((item) => createLineItemIsExceptionCharge(item)),
);
const createExceptionChargeLinesMissingReason = computed(() =>
    createExceptionChargeLineItems.value.filter((item) =>
        createLineItemExceptionReasonMissing(item),
    ),
);
const activeCreateLineItemDraft = computed(() =>
    createForm.lineItems.find((item) => item.key === activeCreateLineItemKey.value.trim())
    ?? createReviewLineItems.value[0]
    ?? null,
);
const activeCreateLineItemIndex = computed(() => {
    const activeItem = activeCreateLineItemDraft.value;
    if (!activeItem) return null;

    const index = createForm.lineItems.findIndex((item) => item.key === activeItem.key);
    return index >= 0 ? index : null;
});
const createBasketCountLabel = computed(() => {
    const count = createLineItemsCount.value;
    if (count <= 0) return 'No items';

    return `${count} item${count === 1 ? '' : 's'}`;
});
const createBasketCountBadgeLabel = computed(() => {
    const count = createLineItemsCount.value;
    if (count <= 0) return '0';

    return count > 99 ? '99+' : `${count}`;
});
const createFinalizeReady = computed(() => createLineItemsCount.value > 0);

function dateOnlyString(value: string | null): string {
    if (!value) return '';
    const direct = value.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(direct) ? direct : '';
}

function resetEditDialogForm() {
    editDialogInvoiceId.value = null;
    editDialogInvoiceLabel.value = 'Billing Invoice';
    editDialogSourceInvoice.value = null;
    editDialogError.value = null;
    editDialogFieldErrors.value = {};
    editForm.billingPayerContractId = '';
    editForm.invoiceDate = today;
    editForm.currencyCode = defaultBillingCurrencyCode.value;
    editForm.subtotalAmount = '';
    editForm.discountAmount = '';
    editForm.taxAmount = '';
    editForm.paymentDueAt = '';
    editForm.notes = '';
    editForm.lineItems = [createBillingLineItemDraft()];
}

function lineItemDraftFromInvoiceLineItem(
    item: BillingInvoiceLineItem,
): BillingInvoiceLineItemDraft {
    return createBillingLineItemDraft({
        description: item.description ?? '',
        quantity:
            amountToNumber(item.quantity) !== null
                ? String(amountToNumber(item.quantity))
                : '1',
        unitPrice:
            amountToNumber(item.unitPrice) !== null
                ? String(amountToNumber(item.unitPrice))
                : '',
        serviceCode: item.serviceCode ?? '',
        unit: item.unit ?? '',
        notes: item.notes ?? '',
        sourceWorkflowKind: item.sourceWorkflowKind ?? '',
        sourceWorkflowId: item.sourceWorkflowId ?? '',
        sourceWorkflowLabel: item.sourceWorkflowLabel ?? '',
        sourcePerformedAt: item.sourcePerformedAt ?? '',
    });
}

function normalizedEditLineItems(): BillingInvoiceLineItem[] {
    return editForm.lineItems
        .map((item) => {
            const description = item.description.trim();
            const quantity = Math.max(parseLineItemNumber(item.quantity, 0), 0);
            const unitPrice = Math.max(parseLineItemNumber(item.unitPrice, 0), 0);
            const lineTotal = Math.round(quantity * unitPrice * 100) / 100;
            const sourceWorkflowKind = item.sourceWorkflowKind.trim() || null;
            const sourceWorkflowId = item.sourceWorkflowId.trim() || null;
            const sourceWorkflowLabel = item.sourceWorkflowLabel.trim() || null;
            const sourcePerformedAt = item.sourcePerformedAt.trim() || null;

            return {
                description,
                quantity,
                unitPrice,
                lineTotal,
                serviceCode: item.serviceCode.trim() || null,
                unit: item.unit.trim() || null,
                notes: item.notes.trim() || null,
                sourceWorkflowKind,
                sourceWorkflowId,
                sourceWorkflowLabel,
                sourcePerformedAt,
            };
        })
        .filter(
            (item) =>
                item.description !== '' ||
                item.quantity > 0 ||
                item.unitPrice > 0 ||
                item.serviceCode !== null ||
                item.notes !== null,
        )
        .filter((item) => item.description !== '');
}

function clearCreateBillingDraftPreviewDebounce() {
    if (createBillingDraftPreviewDebounceTimer !== null) {
        window.clearTimeout(createBillingDraftPreviewDebounceTimer);
        createBillingDraftPreviewDebounceTimer = null;
    }
}

function clearEditBillingDraftPreviewDebounce() {
    if (editBillingDraftPreviewDebounceTimer !== null) {
        window.clearTimeout(editBillingDraftPreviewDebounceTimer);
        editBillingDraftPreviewDebounceTimer = null;
    }
}

function resetCreateBillingDraftPreview() {
    clearCreateBillingDraftPreviewDebounce();
    createBillingDraftPreviewRequestKey = '';
    createBillingDraftPreviewLoading.value = false;
    createBillingDraftPreviewInvoice.value = null;
    createBillingDraftPreviewError.value = null;
}

function resetEditBillingDraftPreview() {
    clearEditBillingDraftPreviewDebounce();
    editBillingDraftPreviewRequestKey = '';
    editBillingDraftPreviewLoading.value = false;
    editBillingDraftPreviewInvoice.value = null;
    editBillingDraftPreviewError.value = null;
}

function buildCreateBillingDraftPreviewPayload(): Record<string, unknown> | null {
    const patientId = createForm.patientId.trim();
    if (!patientId) return null;

    const lineItems = normalizedCreateLineItems();

    return {
        patientId,
        appointmentId: createForm.appointmentId.trim() || null,
        admissionId: createForm.admissionId.trim() || null,
        billingPayerContractId: createForm.billingPayerContractId.trim() || null,
        invoiceDate: createForm.invoiceDate,
        currencyCode: createForm.currencyCode.trim().toUpperCase(),
        autoPriceLineItems: billingCreateUsesCatalogPricing.value,
        subtotalAmount: lineItems.length > 0 ? createLineItemsSubtotal.value : 0,
        discountAmount: parseOptionalNumber(createForm.discountAmount) ?? 0,
        taxAmount: parseOptionalNumber(createForm.taxAmount) ?? 0,
        paidAmount: parseOptionalNumber(createForm.paidAmount) ?? 0,
        paymentDueAt: createForm.paymentDueAt.trim() || null,
        notes: createForm.notes.trim() || null,
        lineItems: lineItems.length > 0 ? lineItems : null,
    };
}

function buildEditBillingDraftPreviewPayload(): Record<string, unknown> | null {
    const patientId = (editDialogSourceInvoice.value?.patientId ?? '').trim();
    if (!patientId) return null;

    const lineItems = normalizedEditLineItems();

    return {
        patientId,
        appointmentId: (editDialogSourceInvoice.value?.appointmentId ?? '').trim() || null,
        admissionId: (editDialogSourceInvoice.value?.admissionId ?? '').trim() || null,
        billingPayerContractId: editForm.billingPayerContractId.trim() || null,
        invoiceDate: editForm.invoiceDate,
        currencyCode: editForm.currencyCode.trim().toUpperCase(),
        autoPriceLineItems:
            (editDialogSourceInvoice.value?.pricingMode ?? '').trim().toLowerCase()
            === 'service_catalog',
        subtotalAmount:
            editForm.subtotalAmount.trim() === '' && lineItems.length > 0
                ? editLineItemsSubtotal.value
                : editForm.subtotalAmount.trim() === ''
                  ? 0
                  : Number(editForm.subtotalAmount),
        discountAmount: parseOptionalNumber(editForm.discountAmount) ?? 0,
        taxAmount: parseOptionalNumber(editForm.taxAmount) ?? 0,
        paidAmount: amountToNumber(editDialogSourceInvoice.value?.paidAmount ?? null) ?? 0,
        paymentDueAt: editForm.paymentDueAt.trim() || null,
        notes: editForm.notes.trim() || null,
        lineItems: lineItems.length > 0 ? lineItems : null,
    };
}

async function loadCreateBillingDraftPreview(expectedKey: string) {
    const payload = buildCreateBillingDraftPreviewPayload();
    if (!payload || JSON.stringify(payload) !== expectedKey) return;

    createBillingDraftPreviewRequestKey = expectedKey;
    createBillingDraftPreviewLoading.value = true;
    createBillingDraftPreviewError.value = null;

    try {
        const response = await apiRequest<{ data: BillingInvoice }>(
            'POST',
            '/billing-invoices/preview',
            { body: payload },
        );

        if (createBillingDraftPreviewRequestKey !== expectedKey) return;
        createBillingDraftPreviewInvoice.value = response.data;
    } catch (error) {
        if (createBillingDraftPreviewRequestKey !== expectedKey) return;

        const apiError = error as Error & {
            payload?: ValidationErrorResponse;
        };
        createBillingDraftPreviewInvoice.value = null;
        createBillingDraftPreviewError.value =
            apiError.payload?.message
            ?? apiError.message
            ?? 'Unable to calculate the live payer preview.';
    } finally {
        if (createBillingDraftPreviewRequestKey === expectedKey) {
            createBillingDraftPreviewLoading.value = false;
        }
    }
}

async function loadEditBillingDraftPreview(expectedKey: string) {
    const payload = buildEditBillingDraftPreviewPayload();
    if (!payload || JSON.stringify(payload) !== expectedKey) return;

    editBillingDraftPreviewRequestKey = expectedKey;
    editBillingDraftPreviewLoading.value = true;
    editBillingDraftPreviewError.value = null;

    try {
        const response = await apiRequest<{ data: BillingInvoice }>(
            'POST',
            '/billing-invoices/preview',
            { body: payload },
        );

        if (editBillingDraftPreviewRequestKey !== expectedKey) return;
        editBillingDraftPreviewInvoice.value = response.data;
    } catch (error) {
        if (editBillingDraftPreviewRequestKey !== expectedKey) return;

        const apiError = error as Error & {
            payload?: ValidationErrorResponse;
        };
        editBillingDraftPreviewInvoice.value = null;
        editBillingDraftPreviewError.value =
            apiError.payload?.message
            ?? apiError.message
            ?? 'Unable to calculate the live payer preview.';
    } finally {
        if (editBillingDraftPreviewRequestKey === expectedKey) {
            editBillingDraftPreviewLoading.value = false;
        }
    }
}

const editLineItemsSubtotal = computed(() =>
    Math.round(
        normalizedEditLineItems().reduce(
            (sum, item) => sum + (item.lineTotal ?? item.quantity * item.unitPrice),
            0,
        ) * 100,
    ) / 100,
);

const editLineItemsCount = computed(() => normalizedEditLineItems().length);

function removeEditLineItem(key: string) {
    if (editForm.lineItems.length <= 1) {
        editForm.lineItems = [createBillingLineItemDraft()];
        return;
    }

    editForm.lineItems = editForm.lineItems.filter((item) => item.key !== key);
}

function applyCalculatedEditSubtotal() {
    editForm.subtotalAmount = editLineItemsSubtotal.value.toFixed(2);
}

function fillStatusDialogPaidAmountQuick(
    mode: 'current' | 'outstanding' | 'full',
) {
    if (!statusDialogShowsPaidAmount.value) return;

    if (mode === 'current') {
        setStatusDialogPaidAmountValue(statusDialogCurrentPaidAmount.value);
        return;
    }

    if (mode === 'outstanding') {
        const outstanding = statusDialogOutstandingAmount.value;
        if (outstanding === null) return;
        setStatusDialogPaidAmountValue(
            statusDialogCurrentPaidAmount.value + outstanding,
        );
        return;
    }

    setStatusDialogPaidAmountValue(statusDialogTotalAmount.value);
}

function setInvoiceDetailsActionOutcome(options: {
    invoiceId: string;
    title: string;
    message: string;
    tone?: 'default' | 'secondary';
}) {
    if (invoiceDetailsInvoice.value?.id !== options.invoiceId) return;

    invoiceDetailsActionOutcome.value = {
        invoiceId: options.invoiceId,
        title: options.title,
        message: options.message,
        tone: options.tone ?? 'default',
    };
}

function buildRecordInvoicePaymentOutcome(
    updatedInvoice: BillingInvoice,
    recordedAmount: number,
) {
    const invoiceLabel = updatedInvoice.invoiceNumber ?? 'billing invoice';
    const currencyCode = updatedInvoice.currencyCode;
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(updatedInvoice) === 'third_party';
    const normalizedBalance =
        amountToNumber(updatedInvoice.balanceAmount ?? null) ??
        Math.max(
            (amountToNumber(updatedInvoice.totalAmount ?? null) ?? 0) -
                (amountToNumber(updatedInvoice.paidAmount ?? null) ?? 0),
            0,
        );
    const settledInFull = normalizedBalance <= 0;

    if (usesThirdPartySettlement) {
        if (settledInFull) {
            return {
                title: 'Settlement closed',
                message: `Recorded settlement of ${formatMoney(recordedAmount, currencyCode)} for ${invoiceLabel}. The invoice is now fully settled and has left active payer follow-up.`,
                tone: 'default' as const,
            };
        }

        return {
            title: 'Settlement updated',
            message: `Recorded settlement of ${formatMoney(recordedAmount, currencyCode)} for ${invoiceLabel}. Remaining balance is ${formatMoney(normalizedBalance, currencyCode)} and payer follow-up stays active.`,
            tone: 'secondary' as const,
        };
    }

    if (settledInFull) {
        return {
            title: 'Collection closed',
            message: `Recorded collection of ${formatMoney(recordedAmount, currencyCode)} for ${invoiceLabel}. The invoice is now fully paid and has left the cashier work queue.`,
            tone: 'default' as const,
        };
    }

    return {
        title: 'Collection updated',
        message: `Recorded collection of ${formatMoney(recordedAmount, currencyCode)} for ${invoiceLabel}. Remaining balance is ${formatMoney(normalizedBalance, currencyCode)} and cashier collection stays active.`,
        tone: 'secondary' as const,
    };
}

function buildUpdateInvoiceStatusOutcome(
    updatedInvoice: BillingInvoice,
    status: BillingInvoiceStatusAction,
) {
    const invoiceLabel = updatedInvoice.invoiceNumber ?? 'billing invoice';
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(updatedInvoice) === 'third_party';

    if (status === 'issued') {
        return (
            billingInvoiceIssueHandoff(updatedInvoice) ?? {
                title: usesThirdPartySettlement
                    ? 'Settlement lane opened'
                    : 'Collection lane opened',
                message: usesThirdPartySettlement
                    ? `Issued ${invoiceLabel}. Payer settlement and claims follow-up can begin now, with patient-share collection staying tied to the same invoice.`
                    : `Issued ${invoiceLabel}. Cashier collection can begin now from the active billing queue.`,
                tone: 'default' as const,
            }
        );
    }

    if (status === 'cancelled') {
        return {
            title: 'Invoice cancelled',
            message: `Cancelled ${invoiceLabel}. It has left the active billing queue and will remain available only for review and audit.`,
            tone: 'secondary' as const,
        };
    }

    return {
        title: 'Invoice voided',
        message: `Voided ${invoiceLabel}. It has been removed from active billing workflow and remains available for controlled audit review.`,
        tone: 'secondary' as const,
    };
}

async function submitInvoiceStatusDialog() {
    if (!statusDialogInvoice.value || !statusDialogAction.value) return;

    let reason: string | null = null;
    let paidAmount: number | null = null;
    let paymentAmountDelta: number | null = null;
    let paymentPayerType: string | null = null;
    let paymentMethod: string | null = null;
    let paymentReference: string | null = null;
    let paymentNote: string | null = null;
    let paymentAt: string | null = null;

    if (statusDialogNeedsReason.value) {
        reason = statusDialogReason.value.trim();
        if (!reason) {
            statusDialogError.value =
                statusDialogAction.value === 'cancelled'
                    ? 'Cancellation reason is required.'
                    : 'Void reason is required.';
            return;
        }
    }

    if (statusDialogShowsPaidAmount.value) {
        const trimmedAmount = statusDialogPaidAmount.value.trim();
        if (trimmedAmount !== '') {
            const parsed = Number(trimmedAmount);
            if (!Number.isFinite(parsed) || parsed < 0) {
                statusDialogError.value = 'Paid amount must be a valid number.';
                return;
            }

            const total = statusDialogTotalAmount.value;
            const currentPaid = statusDialogCurrentPaidAmount.value;

            if (
                statusDialogAction.value === 'partially_paid' &&
                parsed < currentPaid
            ) {
                statusDialogError.value =
                    'Partial payment amount must be greater than or equal to the current paid amount.';
                return;
            }

            if (total !== null && parsed > total) {
                statusDialogError.value =
                    'Paid amount cannot be greater than the invoice total.';
                return;
            }

            if (
                statusDialogAction.value === 'paid' &&
                total !== null &&
                parsed < total
            ) {
                statusDialogError.value =
                    'Mark Paid requires the full invoice total. Use Partial Payment for incomplete settlement.';
                return;
            }

            paidAmount = parsed;
        } else if (statusDialogPaidAmountRequired.value) {
            statusDialogError.value = 'Paid amount is required for partial payment.';
            return;
        }

        if (statusDialogRequiresPaymentMetadata.value) {
            paymentPayerType = statusDialogPaymentPayerType.value.trim() || null;
            paymentMethod = statusDialogPaymentMethod.value.trim() || null;
            paymentReference = statusDialogPaymentReference.value.trim() || null;
            paymentNote = statusDialogPaymentNote.value.trim() || null;
            paymentAt = statusDialogPaymentAt.value.trim() || null;

            if (!paymentPayerType) {
                statusDialogError.value = 'Payer type is required for payment capture.';
                return;
            }

            if (!paymentMethod) {
                statusDialogError.value = 'Payment method is required for payment capture.';
                return;
            }

            if (
                paymentMethod === 'insurance_claim' &&
                !billingPayerTypesRequiringClaimReference.has(paymentPayerType)
            ) {
                statusDialogError.value =
                    'Insurance Claim method can only be used with Insurance or Government payer type.';
                return;
            }

            if (statusDialogPaymentReferenceRequired.value && !paymentReference) {
                if (statusDialogClaimReferenceRequired.value) {
                    recordBillingClaimReferenceValidationFailure(
                        'missing',
                        paymentPayerType,
                        paymentMethod,
                    );
                }
                statusDialogError.value = `Payment reference is required for ${statusDialogSelectedPaymentMethodLabel.value ?? 'the selected payment method'}.`;
                return;
            }

            if (
                statusDialogClaimReferenceRequired.value &&
                paymentReference &&
                isTemplateLikeClaimReference(paymentReference, paymentPayerType)
            ) {
                recordBillingClaimReferenceValidationFailure(
                    'template',
                    paymentPayerType,
                    paymentMethod,
                );
                statusDialogError.value =
                    'Claim/control reference looks like a template placeholder. Replace it with the actual payer-issued reference.';
                return;
            }

            if (
                statusDialogClaimReferenceRequired.value &&
                paymentReference &&
                !billingClaimReferenceFormatPattern.test(paymentReference)
            ) {
                recordBillingClaimReferenceValidationFailure(
                    'format',
                    paymentPayerType,
                    paymentMethod,
                );
                statusDialogError.value =
                    'Claim/control reference format is invalid. Use 6-120 characters, start with a letter or number, and use only letters, numbers, -, /, _, ., or :.';
                return;
            }
        }

        if (
            statusDialogAction.value === 'record_payment' ||
            statusDialogAction.value === 'partially_paid' ||
            statusDialogAction.value === 'paid'
        ) {
            const projectedPaid = statusDialogProjectedPaidAmount.value;
            if (projectedPaid === null) {
                statusDialogError.value = 'Unable to compute payment amount.';
                return;
            }

            paymentAmountDelta = Number(
                (projectedPaid - statusDialogCurrentPaidAmount.value).toFixed(2),
            );

            if (!Number.isFinite(paymentAmountDelta) || paymentAmountDelta <= 0) {
                statusDialogError.value =
                    'Payment amount must increase the cumulative paid amount.';
                return;
            }
        }
    }

    statusDialogError.value = null;
    const success =
        statusDialogAction.value === 'record_payment' ||
        statusDialogAction.value === 'partially_paid' ||
        statusDialogAction.value === 'paid'
            ? await recordInvoicePayment(statusDialogInvoice.value, {
                  amount: paymentAmountDelta ?? 0,
                  payerType: paymentPayerType ?? '',
                  paymentMethod: paymentMethod ?? '',
                  paymentReference,
                  note: paymentNote,
                  paymentAt,
              })
            : await updateInvoiceStatus(statusDialogInvoice.value, statusDialogAction.value, {
                  reason,
                  paidAmount,
                  paymentPayerType,
                  paymentMethod,
                  paymentReference,
              });

    if (success) {
        closeInvoiceStatusDialog();
    }
}

async function applyBillingInvoiceIssueHandoff(
    invoice: BillingInvoice,
): Promise<void> {
    const handoff = billingInvoiceIssueHandoff(invoice);
    if (!handoff) {
        await reloadQueueAndSummary();
        return;
    }

    clearSearchDebounce();
    searchForm.q = '';
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : '';
    searchForm.status = '';
    searchForm.statusIn = ['issued', 'partially_paid'];
    searchForm.currencyCode = '';
    searchForm.from = '';
    searchForm.to = '';
    searchForm.paymentActivityFrom = '';
    searchForm.paymentActivityTo = '';
    searchForm.page = 1;
    billingQueueLaneFilter.value = handoff.laneFilter;
    billingQueueThirdPartyPhaseFilter.value =
        handoff.laneFilter === 'third_party_settlement'
            ? handoff.thirdPartyPhaseFilter
            : 'all';

    setBillingWorkspaceView('queue', { scroll: true });
    await reloadQueueAndSummary();
    await openInvoiceDetailsSheet(invoice);
}

async function recordInvoicePayment(
    invoice: BillingInvoice,
    payload: {
        amount: number;
        payerType: string;
        paymentMethod: string;
        paymentReference?: string | null;
        note?: string | null;
        paymentAt?: string | null;
    },
) {
    if (actionLoadingId.value) return false;

    actionLoadingId.value = invoice.id;
    listErrors.value = [];
    actionMessage.value = null;

    try {
        const response = await apiRequest<RecordBillingInvoicePaymentResponse>(
            'POST',
            `/billing-invoices/${invoice.id}/payments`,
            {
                body: {
                    amount: payload.amount,
                    payerType: payload.payerType,
                    paymentMethod: payload.paymentMethod,
                    paymentReference: payload.paymentReference ?? null,
                    note: payload.note ?? null,
                    paymentAt: payload.paymentAt ?? null,
                },
            },
        );

        const updatedInvoice = response.data.invoice;
        const recordedPayment = response.data.payment;
        const outcome = buildRecordInvoicePaymentOutcome(
            updatedInvoice,
            Math.abs(amountToNumber(recordedPayment.amount ?? null) ?? payload.amount),
        );
        actionMessage.value = outcome.message;
        notifySuccess(outcome.message);

        if (invoiceDetailsInvoice.value?.id === updatedInvoice.id) {
            invoiceDetailsInvoice.value = updatedInvoice;
            setInvoiceDetailsActionOutcome({
                invoiceId: updatedInvoice.id,
                title: outcome.title,
                message: outcome.message,
                tone: outcome.tone,
            });
            if (canViewBillingPaymentHistory.value) {
                void loadInvoiceDetailsPayments(updatedInvoice.id);
            }
            if (canViewBillingInvoiceAuditLogs.value) {
                void loadInvoiceDetailsAuditLogs(updatedInvoice.id);
            }
        }

        await reloadQueueAndSummary();
        return true;
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to record invoice payment.'));
        return false;
    } finally {
        actionLoadingId.value = null;
    }
}

async function updateInvoiceStatus(
    invoice: BillingInvoice,
    status: BillingInvoiceStatusAction,
    payload?: {
        reason?: string | null;
        paidAmount?: number | null;
        paymentPayerType?: string | null;
        paymentMethod?: string | null;
        paymentReference?: string | null;
    },
) {
    if (actionLoadingId.value) return;

    const reason = payload?.reason ?? null;
    const paidAmount = payload?.paidAmount ?? null;
    const paymentPayerType = payload?.paymentPayerType ?? null;
    const paymentMethod = payload?.paymentMethod ?? null;
    const paymentReference = payload?.paymentReference ?? null;

    actionLoadingId.value = invoice.id;
    listErrors.value = [];
    actionMessage.value = null;

    try {
        const response = await apiRequest<{ data: BillingInvoice }>(
            'PATCH',
            `/billing-invoices/${invoice.id}/status`,
            {
                body: {
                    status,
                    reason,
                    paidAmount,
                    paymentPayerType,
                    paymentMethod,
                    paymentReference,
                },
            },
        );

        const outcome = buildUpdateInvoiceStatusOutcome(response.data, status);
        actionMessage.value = outcome.message;
        notifySuccess(outcome.message);
        if (status === 'issued') {
            await applyBillingInvoiceIssueHandoff(response.data);
            setInvoiceDetailsActionOutcome({
                invoiceId: response.data.id,
                title: outcome.title,
                message: outcome.message,
                tone: outcome.tone,
            });
        } else {
            if (invoiceDetailsInvoice.value?.id === response.data.id) {
                invoiceDetailsInvoice.value = response.data;
                setInvoiceDetailsActionOutcome({
                    invoiceId: response.data.id,
                    title: outcome.title,
                    message: outcome.message,
                    tone: outcome.tone,
                });
                if (canViewBillingPaymentHistory.value) {
                    void loadInvoiceDetailsPayments(response.data.id);
                }
                if (canViewBillingInvoiceAuditLogs.value) {
                    void loadInvoiceDetailsAuditLogs(response.data.id);
                }
            }
            await reloadQueueAndSummary();
        }
        return true;
    } catch (error) {
        notifyError(
            messageFromUnknown(error, 'Unable to update billing invoice status.'),
        );
        return false;
    } finally {
        actionLoadingId.value = null;
    }
}

function submitSearch() {
    clearSearchDebounce();
    if (patientChartQueueFocusLocked.value && patientChartQueueRouteContext.patientId) {
        searchForm.patientId = patientChartQueueRouteContext.patientId;
    }
    searchForm.page = 1;
    setBillingWorkspaceView('queue');
    void reloadQueueAndSummary();
}

function submitSearchFromFiltersSheet() {
    submitSearch();
    advancedFiltersSheetOpen.value = false;
}

function submitSearchFromMobileDrawer() {
    submitSearch();
    mobileFiltersDrawerOpen.value = false;
}

function resetFilters() {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : '';
    searchForm.status = '';
    searchForm.statusIn = [];
    searchForm.currencyCode = '';
    searchForm.from = today;
    searchForm.to = '';
    searchForm.paymentActivityFrom = '';
    searchForm.paymentActivityTo = '';
    searchForm.page = 1;
    billingQueueLaneFilter.value = 'all';
    billingQueueThirdPartyPhaseFilter.value = 'all';
    setBillingWorkspaceView('queue');
    void reloadQueueAndSummary();
}

function openFullBillingQueue() {
    clearSearchDebounce();
    patientChartQueueFocusLocked.value = false;
    searchForm.patientId = '';
    searchForm.page = 1;
    setBillingWorkspaceView('queue');
    void reloadQueueAndSummary();
}

function refocusBillingPatientQueue() {
    if (!patientChartQueueRoutePatientAvailable.value) return;

    clearSearchDebounce();
    patientChartQueueFocusLocked.value = true;
    searchForm.patientId = patientChartQueueRouteContext.patientId;
    searchForm.page = 1;
    setBillingWorkspaceView('queue');
    void reloadQueueAndSummary();
}

function resetFiltersFromFiltersSheet() {
    resetFilters();
    advancedFiltersSheetOpen.value = false;
}

function resetFiltersFromMobileDrawer() {
    resetFilters();
    mobileFiltersDrawerOpen.value = false;
}

function setBillingResultsPerPage(perPage: number) {
    if (searchForm.perPage === perPage) return;
    clearSearchDebounce();
    searchForm.perPage = perPage;
    searchForm.page = 1;
    setBillingWorkspaceView('queue');
    void reloadQueueAndSummary();
}

function setBillingQueueDensity(compact: boolean) {
    compactQueueRows.value = compact;
}

function setBillingQueueLaneFilter(laneFilter: BillingQueueLaneFilter) {
    billingQueueLaneFilter.value = laneFilter;

    if (laneFilter !== 'third_party_settlement') {
        billingQueueThirdPartyPhaseFilter.value = 'all';
    }
}

function setBillingQueueThirdPartyPhaseFilter(
    phaseFilter: BillingQueueThirdPartyPhaseFilter,
) {
    billingQueueThirdPartyPhaseFilter.value = phaseFilter;
}

function prevPage() {
    if ((pagination.value?.currentPage ?? 1) <= 1) return;
    clearSearchDebounce();
    searchForm.page -= 1;
    setBillingWorkspaceView('queue');
    void reloadQueueAndSummary();
}

function nextPage() {
    if (
        !pagination.value ||
        pagination.value.currentPage >= pagination.value.lastPage
    ) {
        return;
    }
    clearSearchDebounce();
    searchForm.page += 1;
    setBillingWorkspaceView('queue');
    void reloadQueueAndSummary();
}

function applyBillingQueuePreset(
    preset:
        | 'today_collections'
        | 'outstanding'
        | 'draft'
        | 'issued'
        | 'partially_paid'
        | 'paid'
        | 'voided'
        | 'exceptions',
    options?: {
        focusSearch?: boolean;
        laneFilter?: BillingQueueLaneFilter;
        thirdPartyPhaseFilter?: BillingQueueThirdPartyPhaseFilter;
    },
) {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : '';
    searchForm.currencyCode = '';
    searchForm.page = 1;
    searchForm.to = '';
    searchForm.paymentActivityFrom = '';
    searchForm.paymentActivityTo = '';

    billingQueueLaneFilter.value = options?.laneFilter ?? 'all';
    if (billingQueueLaneFilter.value === 'third_party_settlement') {
        billingQueueThirdPartyPhaseFilter.value =
            options?.thirdPartyPhaseFilter ?? 'all';
    } else {
        billingQueueThirdPartyPhaseFilter.value = 'all';
    }

    if (preset === 'today_collections') {
        searchForm.status = '';
        searchForm.statusIn = [];
        searchForm.from = '';
        searchForm.paymentActivityFrom = today;
        searchForm.paymentActivityTo = today;
    } else {
        searchForm.from = today;

        if (preset === 'outstanding') {
            searchForm.status = '';
            searchForm.statusIn = ['issued', 'partially_paid'];
        } else if (preset === 'exceptions') {
            searchForm.status = '';
            searchForm.statusIn = ['cancelled', 'voided'];
        } else {
            searchForm.status = preset;
            searchForm.statusIn = [];
        }
    }

    setBillingWorkspaceView('queue', {
        focusSearch: options?.focusSearch,
        scroll: true,
    });
    void reloadQueueAndSummary();
}

function applyBillingQueueOperationalPreset(
    preset: 'cashier_daybook' | 'claim_prep' | 'reconciliation',
    options?: { focusSearch?: boolean },
) {
    if (preset === 'cashier_daybook') {
        applyBillingQueuePreset('today_collections', {
            focusSearch: options?.focusSearch,
            laneFilter: 'cashier_collection',
        });
        return;
    }

    if (preset === 'claim_prep') {
        applyBillingQueuePreset('outstanding', {
            focusSearch: options?.focusSearch,
            laneFilter: 'third_party_settlement',
            thirdPartyPhaseFilter: 'claim_submission',
        });
        return;
    }

    applyBillingQueuePreset('outstanding', {
        focusSearch: options?.focusSearch,
        laneFilter: 'third_party_settlement',
        thirdPartyPhaseFilter: 'remittance_reconciliation',
    });
}

function applyBillingSummaryFilter(status: string) {
    clearSearchDebounce();
    searchForm.status = searchForm.status === status ? '' : status;
    searchForm.statusIn = [];
    searchForm.page = 1;
    setBillingWorkspaceView('queue', { scroll: true });
    void reloadQueueAndSummary();
}

function applyBillingSummaryStatusSetFilter(statuses: string[]) {
    clearSearchDebounce();
    const normalizedStatuses = [
        ...new Set(statuses.map((value) => value.trim()).filter(Boolean)),
    ].sort();
    const selectedStatuses = normalizedStatusInSelection();
    const isActive =
        !searchForm.status &&
        selectedStatuses.length === normalizedStatuses.length &&
        selectedStatuses.every(
            (value, index) => value === normalizedStatuses[index],
        );

    searchForm.status = '';
    searchForm.statusIn = isActive ? [] : normalizedStatuses;
    searchForm.page = 1;
    setBillingWorkspaceView('queue', { scroll: true });
    void reloadQueueAndSummary();
}

function isBillingSummaryFilterActive(status: string): boolean {
    return (searchForm.status || '') === status;
}

function isBillingSummaryStatusSetFilterActive(statuses: string[]): boolean {
    const selectedStatuses = normalizedStatusInSelection();
    const normalizedStatuses = [
        ...new Set(statuses.map((value) => value.trim()).filter(Boolean)),
    ].sort();

    return (
        !searchForm.status &&
        selectedStatuses.length === normalizedStatuses.length &&
        selectedStatuses.every(
            (value, index) => value === normalizedStatuses[index],
        )
    );
}

function shortId(value: string | null): string {
    if (!value) return 'N/A';
    return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

function formatMoney(
    value: string | number | null,
    currencyCode: string | null,
): string {
    const amount = amountToNumber(value);
    if (amount === null) return 'N/A';
    const currency = (currencyCode?.trim() || defaultBillingCurrencyCode.value).toUpperCase();
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(2)}`;
    }
}

function patientName(summary: PatientSummary): string {
    return (
        [summary.firstName, summary.middleName, summary.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        summary.patientNumber ||
        shortId(summary.id)
    );
}

function invoicePatientSummary(invoice: BillingInvoice): PatientSummary | null {
    if (!invoice.patientId) return null;
    return patientDirectory.value[invoice.patientId] ?? null;
}

function invoicePatientLabel(invoice: BillingInvoice): string {
    const summary = invoicePatientSummary(invoice);
    if (!summary) return shortId(invoice.patientId);
    return patientName(summary);
}

function invoicePatientNumber(invoice: BillingInvoice): string | null {
    return invoicePatientSummary(invoice)?.patientNumber ?? null;
}

function invoiceEncounterContextLabel(invoice: BillingInvoice): string {
    if (invoice.appointmentId && invoice.admissionId) {
        return 'Appointment and admission linked';
    }

    if (invoice.admissionId) {
        return 'Inpatient admission linked';
    }

    if (invoice.appointmentId) {
        return 'Outpatient appointment linked';
    }

    return 'No linked encounter';
}

function previewText(value: string | null): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed === '' ? null : trimmed;
}

function extractSourceWorkflowNote(
    value: string | null,
): { label: string; kind?: SourceWorkflowKind; id?: string } | null {
    const lines = (value ?? '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const sourceLine = lines.find((line) => /^source:/i.test(line));
    if (!sourceLine) return null;

    const normalized = sourceLine.replace(/^source:\s*/i, '').trim();
    if (!normalized) return null;

    const match = normalized.match(
        /^\[(?<kind>[a-z_]+)\]\s*(?<label>.*?)(?:\s*\(id:\s*(?<id>[^)]+)\))?$/i,
    );
    if (!match?.groups) {
        return { label: normalized };
    }

    const label = match.groups.label?.trim();
    if (!label) return null;

    const kind = match.groups.kind?.trim() as SourceWorkflowKind | undefined;
    const id = match.groups.id?.trim();

    return {
        label,
        kind: kind && kind in SOURCE_WORKFLOW_KIND_LABELS ? kind : undefined,
        id: id || undefined,
    };
}

function invoiceSourceLabel(invoice: BillingInvoice): string | null {
    const meta = extractSourceWorkflowNote(invoice.notes);
    if (!meta) return null;
    if (meta.kind) {
        return `${sourceWorkflowKindLabel(meta.kind)} ${meta.label}`.trim();
    }
    return meta.label;
}

function invoiceSourceMeta(invoice: BillingInvoice): {
    label: string;
    kind?: SourceWorkflowKind;
    id?: string;
} | null {
    return extractSourceWorkflowNote(invoice.notes);
}

function invoiceSourceWorkflowHref(invoice: BillingInvoice): string | null {
    const meta = invoiceSourceMeta(invoice);
    if (!meta?.kind || !meta?.id) return null;

    const params = new URLSearchParams();
    let base = '';

    switch (meta.kind) {
        case 'laboratory_order':
            base = '/laboratory-orders';
            params.set('focusOrderId', meta.id);
            break;
        case 'pharmacy_order':
            base = '/pharmacy-orders';
            params.set('focusOrderId', meta.id);
            break;
        case 'radiology_order':
            base = '/radiology-orders';
            params.set('focusOrderId', meta.id);
            break;
        case 'theatre_procedure':
            base = '/theatre-procedures';
            params.set('focusProcedureId', meta.id);
            break;
        default:
            return null;
    }

    if (openedFromPatientChart) params.set('from', 'patient-chart');

    const queryString = params.toString();
    return queryString ? `${base}?${queryString}` : base;
}

function invoiceLineItemPreview(invoice: BillingInvoice): string[] {
    return invoiceLineItems(invoice)
        .slice(0, 3)
        .map((item) => {
            const quantity = amountToNumber(item.quantity) ?? 0;
            const unitPrice = amountToNumber(item.unitPrice) ?? 0;
            const lineTotal =
                amountToNumber(item.lineTotal ?? null) ?? quantity * unitPrice;
            const parts = [
                item.description,
                `(${quantity} x ${formatMoney(unitPrice, invoice.currencyCode)})`,
                formatMoney(lineTotal, invoice.currencyCode),
            ];

            return parts.filter(Boolean).join(' ');
        });
}

function invoiceLastPaymentMetaLabel(invoice: BillingInvoice): string | null {
    const parts: string[] = [];

    if (invoice.lastPaymentPayerType) {
        parts.push(formatEnumLabel(invoice.lastPaymentPayerType));
    }

    if (invoice.lastPaymentMethod) {
        parts.push(formatEnumLabel(invoice.lastPaymentMethod));
    }

    if (invoice.lastPaymentReference) {
        parts.push(`Ref ${invoice.lastPaymentReference}`);
    }

    return parts.length > 0 ? parts.join(' - ') : null;
}

function isAuditLogObject(
    value: Record<string, unknown> | unknown[] | null,
): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function auditLogEntries(
    value: Record<string, unknown> | unknown[] | null,
): Array<[string, unknown]> {
    if (!isAuditLogObject(value)) return [];
    return Object.entries(value);
}

function auditLogActorLabel(log: BillingInvoiceAuditLog): string {
    return auditActorDisplayName(log, 'User');
}

function auditLogActionLabel(log: BillingInvoiceAuditLog): string {
    return auditActionDisplayLabel(log);
}

function formatAuditLogJson(value: unknown): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || 'N/A';
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function invoiceDetailsAuditActorTypeLabel(log: BillingInvoiceAuditLog): string {
    return log.actorId === null || log.actorId === undefined
        ? 'System event'
        : 'User action';
}

function invoiceDetailsAuditChangeSummary(log: BillingInvoiceAuditLog): string | null {
    const count = auditLogEntries(log.changes).length;
    if (count === 0) return null;
    return `${count} field${count === 1 ? '' : 's'} changed`;
}

function invoiceDetailsAuditChangeKeys(log: BillingInvoiceAuditLog): string[] {
    return auditLogEntries(log.changes).map(([key]) => formatEnumLabel(key));
}

function invoiceDetailsAuditMetadataPreview(
    log: BillingInvoiceAuditLog,
): Array<{ key: string; value: string }> {
    return buildAuditMetadataPreview(log, 4);
}

function toggleInvoiceDetailsAuditLogExpanded(logId: string) {
    invoiceDetailsExpandedAuditLogIds.value =
        invoiceDetailsExpandedAuditLogIds.value.includes(logId)
            ? invoiceDetailsExpandedAuditLogIds.value.filter((id) => id !== logId)
            : [...invoiceDetailsExpandedAuditLogIds.value, logId];
}

function isInvoiceDetailsAuditLogExpanded(logId: string): boolean {
    return invoiceDetailsExpandedAuditLogIds.value.includes(logId);
}

const invoiceDetailsAmountSummary = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) {
        return {
            total: null as number | null,
            paid: 0,
            balance: null as number | null,
            settlementPercent: 0,
        };
    }

    const total = amountToNumber(invoice.totalAmount ?? null);
    const paid = amountToNumber(invoice.paidAmount ?? null) ?? 0;
    const explicitBalance = amountToNumber(invoice.balanceAmount ?? null);
    const balance =
        explicitBalance !== null
            ? Math.max(explicitBalance, 0)
            : total !== null
              ? Math.max(total - paid, 0)
              : null;
    const settlementPercent =
        total !== null && total > 0
            ? Math.min(Math.max((paid / total) * 100, 0), 100)
            : paid > 0
              ? 100
              : 0;

    return {
        total,
        paid,
        balance,
        settlementPercent: Math.round(settlementPercent),
    };
});

const invoiceDetailsFocusCard = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return null;

    const status = (invoice.status ?? '').toLowerCase();
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const coveragePosture = billingInvoiceCoveragePosture(invoice);
    const thirdPartyPhase = billingInvoiceThirdPartyPhase(invoice);
    if (status === 'draft') {
        return {
            title: usesThirdPartySettlement
                ? 'Ready to issue for settlement'
                : 'Ready to issue for collection',
            description: usesThirdPartySettlement
                ? 'Confirm line items, totals, coverage, and due date, then release the invoice so payer settlement and claims follow-up can begin.'
                : 'Confirm line items, totals, and due date, then release the invoice so cashier collection can begin.',
            toneClass:
                'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30',
        };
    }

    if (status === 'issued') {
        if (!usesThirdPartySettlement) {
            return {
                title: 'Cashier collection is active',
                description:
                    'Front-desk or cashier collection is now the active owner on this invoice. Record payment as soon as patient-share money is received.',
                toneClass:
                    'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
            };
        }

        if (coveragePosture?.state === 'coverage_review_required') {
            return {
                title: 'Clear coverage review before submission',
                description:
                    'Manual payer cover checks are blocking claim submission. Resolve the review decision first, then continue claim prep.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (
            coveragePosture?.state === 'coverage_exception' ||
            coveragePosture?.state === 'no_claim_route'
        ) {
            return {
                title: 'Resolve coverage exceptions first',
                description:
                    'Excluded services or missing claim-route posture need a patient-share or split-billing decision before payer follow-up can continue.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (
            coveragePosture?.state === 'preauthorization_required' ||
            coveragePosture?.state === 'authorization_required'
        ) {
            return {
                title: 'Complete authorization follow-up',
                description:
                    'Authorization is still open on this invoice. Close the payer approval path before claim submission or settlement posting continues.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (thirdPartyPhase === 'remittance_reconciliation') {
            return {
                title: 'Reconcile remittance and patient share',
                description:
                    'Settlement activity has already started on this invoice. Keep payer remittance, reconciliation, and patient-share capture aligned until the balance closes.',
                toneClass:
                    'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
            };
        }

        return {
            title: invoice.claimReadiness?.ready
                ? 'Submit or advance the claim'
                : 'Advance claim follow-up',
            description: invoice.claimReadiness?.ready
                ? 'Claim prep is active and this invoice is ready for submission or payer-side follow-up.'
                : 'Claim prep is active for this invoice. Keep payer follow-up moving until it is ready for submission or settlement posting.',
            toneClass:
                'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30',
        };
    }

    if (status === 'partially_paid') {
        if (!usesThirdPartySettlement) {
            return {
                title: 'Collect the remaining cashier balance',
                description:
                    'Some payment is already posted. Continue cashier collection until the outstanding patient balance reaches zero.',
                toneClass:
                    'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
            };
        }

        if (coveragePosture?.state === 'coverage_review_required') {
            return {
                title: 'Re-open coverage review before more submission',
                description:
                    'Settlement activity exists, but manual payer cover checks still need to be cleared before the claim path can fully continue.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (
            coveragePosture?.state === 'coverage_exception' ||
            coveragePosture?.state === 'no_claim_route'
        ) {
            return {
                title: 'Close coverage exceptions and remaining balance',
                description:
                    'Keep patient-share reconciliation and coverage exception handling together until the remaining balance is routed correctly.',
                toneClass: coveragePosture.toneClass,
            };
        }

        if (
            coveragePosture?.state === 'preauthorization_required' ||
            coveragePosture?.state === 'authorization_required'
        ) {
            return {
                title: 'Finish authorization while balance remains open',
                description:
                    'Settlement has started, but payer authorization is still incomplete. Resolve authorization and keep reconciliation in step with the remaining balance.',
                toneClass: coveragePosture.toneClass,
            };
        }

        return {
            title:
                thirdPartyPhase === 'remittance_reconciliation'
                    ? 'Complete remittance reconciliation'
                    : 'Close the remaining payer balance',
            description:
                thirdPartyPhase === 'remittance_reconciliation'
                    ? 'Keep payer remittance and patient-share reconciliation moving until the invoice balance reaches zero.'
                    : 'Continue claim or payer follow-up until the remaining third-party balance is fully resolved.',
            toneClass:
                'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
        };
    }

    if (status === 'paid') {
        return {
            title: 'Settlement closed',
            description:
                'The invoice is fully settled. Use payment history, reversals, audit checks, or related workflows only if needed.',
            toneClass:
                'border-emerald-200/80 border-l-4 border-l-emerald-400/70 bg-muted/20 dark:border-emerald-500/30 dark:border-l-emerald-400/50 dark:bg-muted/30',
        };
    }

    return {
        title: 'Closed billing exception',
        description:
            'This invoice is no longer active for settlement. Review notes and audit history for the closure decision.',
        toneClass:
            'border-rose-200/80 border-l-4 border-l-rose-400/70 bg-muted/20 dark:border-rose-500/30 dark:border-l-rose-400/50 dark:bg-muted/30',
    };
});

const invoiceDetailsFinancePostingCards = computed(() => {
    const summary = invoiceDetailsFinancePosting.value;
    const currencyCode = invoiceDetailsInvoice.value?.currencyCode ?? 'TZS';

    if (!summary) return [];

    return [
        {
            key: 'recognition',
            label: 'Recognition',
            value:
                summary.recognition.status === 'recognized'
                    ? formatMoney(summary.recognition.netRevenue, currencyCode)
                    : 'Pending',
            helper:
                summary.recognition.status === 'recognized'
                    ? `Posted ${formatEnumLabel(summary.recognition.recognitionMethod ?? 'accrual')} at ${formatDateTime(summary.recognition.recognizedAt)}`
                    : 'Invoice is not yet synchronized into revenue recognition.',
        },
        {
            key: 'payments',
            label: 'Payment GL',
            value: `${summary.paymentPosting.postedCount} posted`,
            helper:
                summary.paymentPosting.entryCount > 0
                    ? `${summary.paymentPosting.reversedCount} reversed | latest ${formatDateTime(summary.paymentPosting.latestPostingDate)}`
                    : 'No payment posting entries yet.',
        },
        {
            key: 'refunds',
            label: 'Refund GL',
            value:
                summary.refundPosting.entryCount > 0
                    ? `${summary.refundPosting.postedCount} posted`
                    : 'None',
            helper:
                summary.refundPosting.entryCount > 0
                    ? `Latest ${formatDateTime(summary.refundPosting.latestPostingDate)}`
                    : 'No refund payout entries on this invoice.',
        },
    ];
});
const invoiceDetailsFinanceInfrastructureAlert = computed(() => {
    const infrastructure = invoiceDetailsFinancePosting.value?.infrastructure;
    if (!infrastructure) return null;
    if (infrastructure.revenueRecognitionReady && infrastructure.glPostingReady) {
        return null;
    }

    const missingTables = infrastructure.missingTables.length > 0
        ? infrastructure.missingTables.join(', ')
        : 'finance ledger tables';

    return `Finance ledger setup is incomplete. Missing tables: ${missingTables}. Invoice finance badges are fallback-only until billing finance migrations are applied.`;
});
const invoiceDetailsCoveragePosture = computed(() =>
    billingInvoiceCoveragePosture(invoiceDetailsInvoice.value),
);
const invoiceDetailsCoverageMetricBadges = computed(() =>
    billingInvoiceCoverageMetricBadges(invoiceDetailsInvoice.value),
);

const invoiceDetailsFocusPanel = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    const focusCard = invoiceDetailsFocusCard.value;
    if (!invoice || !focusCard) return null;
    const status = (invoice.status ?? '').trim().toLowerCase();

    if (hasBillingExecutionSurface.value) {
        return {
            heading:
                status === 'draft'
                    ? 'Draft workflow'
                    : status === 'issued' || status === 'partially_paid'
                      ? 'Operational follow-up'
                      : 'Billing status',
            title: focusCard.title,
            description: focusCard.description,
            toneClass: focusCard.toneClass,
            badgeLabel: formatEnumLabel(invoice.status),
            badgeVariant: 'outline' as const,
        };
    }

    return {
        heading: 'Invoice summary',
        title: formatEnumLabel(invoice.status) + ' invoice',
        description: invoiceDetailsUsesThirdPartySettlement.value
            ? 'Review settlement state, settlement history, and related workflows available in your current access scope.'
            : 'Review settlement state, payment history, and related workflows available in your current access scope.',
        toneClass:
            'border-border border-l-4 border-l-muted-foreground/40 bg-muted/20 dark:border-border/80 dark:border-l-muted-foreground/50 dark:bg-muted/30',
        badgeLabel: 'Review access',
        badgeVariant: 'secondary' as const,
    };
});

const invoiceDetailsUsesThirdPartySettlement = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    return invoice ? billingInvoiceSettlementMode(invoice) === 'third_party' : false;
});

const invoiceDetailsSheetDescription = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'Review invoice amounts, line items, and settlement history without leaving the billing workspace.'
        : 'Review invoice amounts, line items, and payment history without leaving the billing workspace.',
);

const invoiceDetailsSettlementRoutingTitle = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'Responsibility and routing'
        : 'Billing responsibility',
);

const invoiceDetailsSettlementRoutingDescription = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'Payer route, patient share, and claim readiness captured on this invoice.'
        : 'Direct-pay responsibility and collection expectations captured on this invoice.',
);

const invoiceDetailsLedgerTitle = computed(() =>
    {
        const invoice = invoiceDetailsInvoice.value;
        if (!invoice) return 'Payment History';

        if (!invoiceDetailsUsesThirdPartySettlement.value) {
            return 'Cashier History';
        }

        const coveragePosture = invoiceDetailsCoveragePosture.value;
        const phase = billingInvoiceThirdPartyPhase(invoice);

        if (
            coveragePosture?.state === 'coverage_review_required' ||
            coveragePosture?.state === 'coverage_exception' ||
            coveragePosture?.state === 'no_claim_route' ||
            coveragePosture?.state === 'preauthorization_required' ||
            coveragePosture?.state === 'authorization_required'
        ) {
            return 'Claim & Exception History';
        }

        if (phase === 'remittance_reconciliation') {
            return 'Remittance History';
        }

        return 'Claim & Settlement History';
    },
);

const invoiceDetailsLedgerDescription = computed(() =>
    {
        const invoice = invoiceDetailsInvoice.value;
        if (!invoice) {
            return 'Immutable billing ledger entries for this invoice.';
        }

        if (!invoiceDetailsUsesThirdPartySettlement.value) {
            return 'Immutable cashier payment and collection ledger entries for this invoice.';
        }

        const coveragePosture = invoiceDetailsCoveragePosture.value;
        const phase = billingInvoiceThirdPartyPhase(invoice);

        if (
            coveragePosture?.state === 'coverage_review_required' ||
            coveragePosture?.state === 'coverage_exception' ||
            coveragePosture?.state === 'no_claim_route' ||
            coveragePosture?.state === 'preauthorization_required' ||
            coveragePosture?.state === 'authorization_required'
        ) {
            return 'Immutable claim-prep, authorization, exception, and payer-share activity recorded against this invoice.';
        }

        if (phase === 'remittance_reconciliation') {
            return 'Immutable remittance, reconciliation, and patient-share ledger entries for this invoice.';
        }

        return 'Immutable claim-prep, settlement, and payer-share ledger entries for this invoice.';
    },
);

const invoiceDetailsLedgerRestrictedTitle = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'Workflow history restricted'
        : 'Cashier history restricted',
);

const invoiceDetailsLedgerRestrictedDescription = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'You do not have permission to view claim, settlement, or reconciliation ledger history for billing invoices.'
        : 'You do not have permission to view cashier payment ledger history for billing invoices.',
);

const invoiceDetailsLedgerSearchLabel = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'Workflow Search'
        : 'Cashier Search',
);

const invoiceDetailsLedgerSearchPlaceholder = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'Reference, claim note, remittance note, source action'
        : 'Reference, cashier note, source action',
);

const invoiceDetailsLedgerDateTitle = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'Workflow Activity Date'
        : 'Cashier Activity Date',
);

const invoiceDetailsLedgerDateHelper = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'Filter claim, settlement, and reconciliation ledger entries by recorded activity timestamp.'
        : 'Filter cashier payment ledger entries by recorded payment timestamp.',
);

const invoiceDetailsLedgerEmptyStateLabel = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'No workflow history entries yet.'
        : 'No cashier history entries yet.',
);

const invoiceDetailsLedgerEntryLabel = computed(() =>
    invoiceDetailsUsesThirdPartySettlement.value
        ? 'Workflow Entry'
        : 'Payment',
);

const invoiceDetailsLedgerQuickFilters = computed(() => {
    if (invoiceDetailsUsesThirdPartySettlement.value) {
        return [
            {
                key: 'all',
                label: 'All entries',
                payerType: '',
                paymentMethod: '',
            },
            {
                key: 'insurance-claim',
                label: 'Claim refs',
                payerType: 'insurance',
                paymentMethod: 'insurance_claim',
            },
            {
                key: 'government-claim',
                label: 'Government',
                payerType: 'government',
                paymentMethod: '',
            },
            {
                key: 'bank-transfer',
                label: 'Bank',
                payerType: '',
                paymentMethod: 'bank_transfer',
            },
            {
                key: 'cheque',
                label: 'Cheque',
                payerType: '',
                paymentMethod: 'cheque',
            },
        ] as const;
    }

    return [
        {
            key: 'all',
            label: 'All entries',
            payerType: '',
            paymentMethod: '',
        },
        {
            key: 'cash',
            label: 'Cash',
            payerType: 'self_pay',
            paymentMethod: 'cash',
        },
        {
            key: 'mobile-money',
            label: 'Mobile money',
            payerType: 'self_pay',
            paymentMethod: 'mobile_money',
        },
        {
            key: 'bank-transfer',
            label: 'Bank',
            payerType: 'self_pay',
            paymentMethod: 'bank_transfer',
        },
        {
            key: 'waiver',
            label: 'Waiver',
            payerType: 'self_pay',
            paymentMethod: 'waiver',
        },
    ] as const;
});

const invoiceDetailsLedgerActiveFilters = computed(() => {
    const filters: Array<{ key: string; label: string }> = [];
    const query = invoiceDetailsPaymentsFilters.q.trim();
    if (query) {
        filters.push({
            key: 'q',
            label: `Search: ${query}`,
        });
    }

    if (invoiceDetailsPaymentsFilters.payerType) {
        filters.push({
            key: 'payerType',
            label: `Payer: ${billingPaymentPayerTypeLabel(invoiceDetailsPaymentsFilters.payerType)}`,
        });
    }

    if (invoiceDetailsPaymentsFilters.paymentMethod) {
        filters.push({
            key: 'paymentMethod',
            label: `Method: ${billingPaymentMethodLabel(invoiceDetailsPaymentsFilters.paymentMethod)}`,
        });
    }

    if (invoiceDetailsPaymentsFilters.from || invoiceDetailsPaymentsFilters.to) {
        filters.push({
            key: 'dateRange',
            label: `Date: ${invoiceDetailsPaymentsFilters.from || 'Start'} to ${invoiceDetailsPaymentsFilters.to || 'Now'}`,
        });
    }

    return filters;
});

const invoiceDetailsLedgerSnapshotCards = computed<InvoiceDetailsOperationalCard[]>(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const pageEntries = invoiceDetailsPayments.value.length;
    const totalEntries =
        invoiceDetailsPaymentsMeta.value?.total ?? invoiceDetailsPayments.value.length;
    const reversalEntries = invoiceDetailsPayments.value.filter((payment) =>
        billingPaymentIsReversal(payment),
    ).length;
    const latestEntry = invoiceDetailsPayments.value.find(
        (payment) => payment.paymentAt || payment.createdAt,
    );
    const latestEntryAt = latestEntry?.paymentAt || latestEntry?.createdAt || null;
    const activeFilters = invoiceDetailsLedgerActiveFilters.value;

    return [
        {
            id: 'scope',
            title: 'History scope',
            value:
                activeFilters.length > 0
                    ? 'Filtered view'
                    : invoiceDetailsUsesThirdPartySettlement.value
                      ? 'All workflow history'
                      : 'All cashier history',
            helper:
                activeFilters.length > 0
                    ? `${activeFilters.length} active filter${activeFilters.length === 1 ? '' : 's'} shaping this audit view.`
                    : 'No extra history filters are active right now.',
            badgeVariant: activeFilters.length > 0 ? 'secondary' : 'outline',
        },
        {
            id: 'entries',
            title: 'Entries in view',
            value: `${pageEntries} of ${totalEntries}`,
            helper:
                totalEntries === pageEntries
                    ? 'All matching ledger entries are visible on this page.'
                    : 'Current page entries shown first for faster audit scanning.',
            badgeVariant: 'outline',
        },
        {
            id: 'reversals',
            title: 'Corrections',
            value:
                reversalEntries > 0
                    ? `${reversalEntries} reversal${reversalEntries === 1 ? '' : 's'}`
                    : 'No reversals',
            helper:
                reversalEntries > 0
                    ? 'Reversals remain separate immutable entries so the original posting stays visible.'
                    : 'No correction entries are visible in this history scope.',
            badgeVariant: reversalEntries > 0 ? 'secondary' : 'outline',
        },
        {
            id: 'latest',
            title: 'Latest entry',
            value: latestEntryAt ? formatDateTime(latestEntryAt) : 'No activity yet',
            helper: latestEntryAt
                ? 'Most recent recorded posting in this history view.'
                : 'No payment, settlement, or reversal activity has been recorded yet.',
            badgeVariant: latestEntryAt ? 'outline' : 'secondary',
        },
    ];
});

function applyInvoiceDetailsPaymentQuickFilter(filter: {
    payerType: string;
    paymentMethod: string;
}) {
    invoiceDetailsPaymentsFilters.payerType = filter.payerType;
    invoiceDetailsPaymentsFilters.paymentMethod = filter.paymentMethod;

    if (invoiceDetailsInvoice.value) {
        void loadInvoiceDetailsPayments(invoiceDetailsInvoice.value.id);
    }
}

const invoiceDetailsOverviewCards = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const amountSummary = invoiceDetailsAmountSummary.value;
    const usesThirdPartySettlement = invoiceDetailsUsesThirdPartySettlement.value;
    const paymentDueLabel = invoice.paymentDueAt
        ? formatDate(invoice.paymentDueAt)
        : 'Not set';
    const lineItems = invoiceLineItemCount(invoice);

    return [
        {
            id: 'settlement',
            title: 'Settlement progress',
            value: `${amountSummary.settlementPercent}%`,
            helper: `${formatMoney(amountSummary.paid, invoice.currencyCode)} captured so far`,
            badgeVariant: amountSummary.settlementPercent >= 100 ? 'default' : 'secondary',
        },
        {
            id: 'outstanding',
            title: 'Outstanding balance',
            value:
                amountSummary.balance !== null
                    ? formatMoney(amountSummary.balance, invoice.currencyCode)
                    : 'N/A',
            helper:
                amountSummary.balance === 0
                    ? 'No remaining balance'
                    : 'Amount still awaiting settlement',
            badgeVariant:
                amountSummary.balance !== null && amountSummary.balance > 0
                    ? 'outline'
                    : 'default',
        },
        {
            id: 'line-items',
            title: 'Line items',
            value: `${lineItems}`,
            helper: lineItems === 1 ? 'Charge on this invoice' : 'Charges on this invoice',
            badgeVariant: 'outline',
        },
        {
            id: 'due',
            title: 'Payment due',
            value: paymentDueLabel,
            helper: invoice.lastPaymentAt
                ? usesThirdPartySettlement
                    ? `Latest settlement entry ${formatDateTime(invoice.lastPaymentAt)}`
                    : `Latest payment ${formatDateTime(invoice.lastPaymentAt)}`
                : usesThirdPartySettlement
                    ? 'No settlement entry recorded yet'
                    : 'No payment recorded yet',
            badgeVariant: invoice.paymentDueAt ? 'outline' : 'secondary',
        },
    ];
});

const invoiceDetailsFinancialSnapshotRows = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const amountSummary = invoiceDetailsAmountSummary.value;
    const usesThirdPartySettlement = invoiceDetailsUsesThirdPartySettlement.value;
    const dueLabel = invoice.paymentDueAt ? formatDate(invoice.paymentDueAt) : 'Not set';
    const lastActivityLabel = invoice.lastPaymentAt
        ? formatDateTime(invoice.lastPaymentAt)
        : usesThirdPartySettlement
          ? 'No settlement posted yet'
          : 'No cashier entry yet';

    return [
        {
            key: 'total',
            label: 'Total',
            value: formatMoney(invoice.totalAmount, invoice.currencyCode),
        },
        {
            key: 'paid',
            label: usesThirdPartySettlement ? 'Settled' : 'Collected',
            value: formatMoney(amountSummary.paid, invoice.currencyCode),
        },
        {
            key: 'balance',
            label: 'Open balance',
            value:
                amountSummary.balance !== null
                    ? formatMoney(amountSummary.balance, invoice.currencyCode)
                    : 'N/A',
        },
        {
            key: 'progress',
            label: 'Progress',
            value: `${amountSummary.settlementPercent}%`,
        },
        {
            key: 'due',
            label: 'Due',
            value: dueLabel,
        },
        {
            key: 'last-activity',
            label: usesThirdPartySettlement ? 'Last settlement' : 'Last collection',
            value: lastActivityLabel,
        },
    ];
});

const invoiceDetailsOperationalPanel = computed<InvoiceDetailsOperationalPanel | null>(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return null;

    const status = (invoice.status ?? '').trim().toLowerCase();
    const usesThirdPartySettlement = invoiceDetailsUsesThirdPartySettlement.value;
    const coveragePosture = invoiceDetailsCoveragePosture.value;
    const coverageSummary = billingInvoiceCoverageSummary(invoice);
    const authorizationSummary = billingInvoiceAuthorizationSummary(invoice);
    const amountSummary = invoiceDetailsAmountSummary.value;
    const thirdPartyPhase = billingInvoiceThirdPartyPhase(invoice);
    const issueHandoff = billingInvoiceIssueHandoff(invoice);

    const excluded = Math.max(coverageSummary?.lineItemsExcluded ?? 0, 0);
    const manualReview = Math.max(coverageSummary?.lineItemsManualReview ?? 0, 0);
    const authorizationRequired = Math.max(
        authorizationSummary?.lineItemsRequiringAuthorization ?? 0,
        0,
    );
    const expectedClaimAmount =
        amountToNumber(
            invoice.claimReadiness?.expectedClaimAmount ??
                invoice.payerSummary?.expectedPayerAmount ??
                null,
        ) ?? 0;
    const expectedPatientAmount =
        amountToNumber(invoice.payerSummary?.expectedPatientAmount ?? null) ??
        amountSummary.balance ??
        0;
    const dueLabel = invoice.payerSummary?.claimSubmissionDueAt
        ? formatDate(invoice.payerSummary.claimSubmissionDueAt)
        : invoice.payerSummary?.claimSubmissionDeadlineDays
          ? `${invoice.payerSummary.claimSubmissionDeadlineDays} day limit`
          : 'No claim due date';
    const settlementCycleLabel = invoice.payerSummary?.settlementCycleDays
        ? `${invoice.payerSummary.settlementCycleDays} day cycle`
        : 'Cycle not set';
    const lastActivityLabel = invoice.lastPaymentAt
        ? formatDateTime(invoice.lastPaymentAt)
        : usesThirdPartySettlement
          ? 'No settlement posted yet'
          : 'No cashier entry yet';

    if (status === 'draft') {
        return {
            heading: 'Release path',
            title: issueHandoff?.afterStepValue ?? 'Issue invoice',
            description:
                issueHandoff?.afterStepHelper ??
                'Issue the draft to move it into the active billing queue for follow-up.',
            toneClass:
                invoiceDetailsFocusCard.value?.toneClass ??
                'border-border bg-background',
            cards: [
                {
                    id: 'issue-posture',
                    title: 'Issue posture',
                    value: usesThirdPartySettlement
                        ? coveragePosture?.label ?? 'Third-party route'
                        : 'Self-pay route',
                    helper: usesThirdPartySettlement
                        ? coveragePosture?.description ??
                          'Contract coverage will define the first post-issue work queue.'
                        : 'This invoice moves straight into cashier collection after issue.',
                    badgeVariant: coveragePosture?.badgeVariant ?? 'outline',
                },
                {
                    id: 'patient-share',
                    title: usesThirdPartySettlement
                        ? 'Expected patient share'
                        : 'Collection target',
                    value: formatMoney(
                        usesThirdPartySettlement
                            ? expectedPatientAmount
                            : amountSummary.total,
                        invoice.currencyCode,
                    ),
                    helper: usesThirdPartySettlement
                        ? 'Patient-share stays visible before claim submission starts.'
                        : 'Patient collection starts from the full invoice total after issue.',
                    badgeVariant: 'outline',
                },
                {
                    id: 'payer-share',
                    title: usesThirdPartySettlement ? 'Expected claim' : 'After issue',
                    value: usesThirdPartySettlement
                        ? formatMoney(expectedClaimAmount, invoice.currencyCode)
                        : 'Cashier collection',
                    helper: usesThirdPartySettlement
                        ? 'Expected payer-sponsored value once the claim path is active.'
                        : 'Cashier payment capture becomes the next active step.',
                    badgeVariant: usesThirdPartySettlement ? 'secondary' : 'outline',
                },
            ],
        };
    }

    if (!usesThirdPartySettlement) {
        const balanceValue = amountSummary.balance ?? amountSummary.total ?? 0;

        return {
            heading: status === 'partially_paid' ? 'Balance follow-up' : 'Cashier execution',
            title:
                status === 'partially_paid'
                    ? 'Cashier balance follow-up'
                    : 'Cashier collection queue',
            description:
                status === 'partially_paid'
                    ? 'Some patient money is already posted. Keep collection focused on the remaining balance.'
                    : 'Cashier or front-desk collection is the active owner on this invoice now.',
            toneClass:
                invoiceDetailsFocusCard.value?.toneClass ??
                'border-border bg-background',
            cards: [
                {
                    id: 'queue',
                    title: 'Queue now',
                    value:
                        status === 'partially_paid'
                            ? 'Balance follow-up'
                            : 'Cashier collection',
                    helper: 'Cashier remains the primary operational owner for this invoice.',
                    badgeVariant: status === 'partially_paid' ? 'secondary' : 'default',
                },
                {
                    id: 'collect',
                    title: 'Amount to collect',
                    value: formatMoney(balanceValue, invoice.currencyCode),
                    helper:
                        balanceValue > 0
                            ? 'Record only the remaining patient balance from this point.'
                            : 'No remaining patient balance is waiting for collection.',
                    badgeVariant: balanceValue > 0 ? 'outline' : 'default',
                },
                {
                    id: 'activity',
                    title: 'Latest cashier activity',
                    value: lastActivityLabel,
                    helper: invoice.paymentDueAt
                        ? `Current due date ${formatDate(invoice.paymentDueAt)}`
                        : 'Use payment capture or reversal from this invoice when needed.',
                    badgeVariant: 'outline',
                },
            ],
        };
    }

    if (coveragePosture?.state === 'coverage_review_required') {
        return {
            heading: 'Coverage blocker',
            title: 'Coverage review queue',
            description:
                'Manual payer cover decisions are blocking claim work. Clear the review path before submission or reconciliation continues.',
            toneClass: coveragePosture.toneClass,
            cards: [
                {
                    id: 'queue',
                    title: 'Queue now',
                    value: 'Coverage review',
                    helper: 'Coverage review owns the next operational decision on this invoice.',
                    badgeVariant: 'destructive',
                },
                {
                    id: 'manual-review',
                    title: 'Items waiting',
                    value: `${manualReview}`,
                    helper: `${manualReview} line item${manualReview === 1 ? '' : 's'} still need manual payer cover review.`,
                    badgeVariant: 'destructive',
                },
                {
                    id: 'release',
                    title: 'Release path',
                    value: 'Claim prep & submission',
                    helper: 'Once coverage is cleared, this invoice can return to claim prep immediately.',
                    badgeVariant: 'outline',
                },
            ],
        };
    }

    if (
        coveragePosture?.state === 'coverage_exception' ||
        coveragePosture?.state === 'no_claim_route'
    ) {
        return {
            heading: 'Coverage exception',
            title:
                coveragePosture.state === 'coverage_exception'
                    ? 'Excluded service review'
                    : 'Patient-share routing review',
            description:
                coveragePosture.state === 'coverage_exception'
                    ? 'Some services must stay patient-share or be split out before payer submission can continue.'
                    : 'This invoice currently has no viable claim route and needs a patient-share or contract routing decision.',
            toneClass: coveragePosture.toneClass,
            cards: [
                {
                    id: 'queue',
                    title: 'Queue now',
                    value: 'Settlement exception review',
                    helper: 'Keep coverage exception handling in front of claim follow-up on this invoice.',
                    badgeVariant: 'destructive',
                },
                {
                    id: 'affected',
                    title: 'Affected items',
                    value:
                        coveragePosture.state === 'coverage_exception'
                            ? `${excluded}`
                            : 'Route missing',
                    helper:
                        coveragePosture.state === 'coverage_exception'
                            ? `${excluded} excluded line item${excluded === 1 ? '' : 's'} need a patient-share or split-bill decision.`
                            : 'No payer-sponsored claim route is currently available after contract policy is applied.',
                    badgeVariant: 'destructive',
                },
                {
                    id: 'patient-share',
                    title: 'Expected patient share',
                    value: formatMoney(expectedPatientAmount, invoice.currencyCode),
                    helper: 'Patient-share exposure should be reviewed before more payer follow-up is posted.',
                    badgeVariant: 'outline',
                },
            ],
        };
    }

    if (
        coveragePosture?.state === 'preauthorization_required' ||
        coveragePosture?.state === 'authorization_required'
    ) {
        return {
            heading: 'Authorization blocker',
            title: 'Authorization follow-up queue',
            description:
                'Payer authorization must be completed before claim submission or clean settlement posting can continue.',
            toneClass: coveragePosture.toneClass,
            cards: [
                {
                    id: 'queue',
                    title: 'Queue now',
                    value: 'Authorization follow-up',
                    helper: 'Authorization work owns the next step on this invoice.',
                    badgeVariant: 'outline',
                },
                {
                    id: 'items',
                    title: 'Items needing auth',
                    value: `${authorizationRequired || 1}`,
                    helper: `${authorizationRequired || 1} line item${authorizationRequired === 1 ? '' : 's'} still require payer authorization clearance.`,
                    badgeVariant: 'outline',
                },
                {
                    id: 'release',
                    title: 'Release path',
                    value: 'Claim prep & submission',
                    helper: 'Claim submission becomes active as soon as authorization closes.',
                    badgeVariant: 'secondary',
                },
            ],
        };
    }

    if (thirdPartyPhase === 'remittance_reconciliation') {
        return {
            heading: 'Settlement execution',
            title: 'Remittance & reconciliation',
            description:
                'Settlement activity has started. Keep payer remittance, reconciliation, and patient-share capture aligned until the invoice balance closes.',
            toneClass:
                invoiceDetailsFocusCard.value?.toneClass ??
                'border-border bg-background',
            cards: [
                {
                    id: 'queue',
                    title: 'Queue now',
                    value: 'Remittance & reconciliation',
                    helper: 'Reconciliation now owns the active settlement step on this invoice.',
                    badgeVariant: 'secondary',
                },
                {
                    id: 'expected-payer',
                    title: 'Expected payer',
                    value: formatMoney(expectedClaimAmount, invoice.currencyCode),
                    helper: settlementCycleLabel,
                    badgeVariant: 'outline',
                },
                {
                    id: 'latest',
                    title: 'Latest settlement activity',
                    value: lastActivityLabel,
                    helper:
                        amountSummary.balance !== null && amountSummary.balance > 0
                            ? `Outstanding balance ${formatMoney(amountSummary.balance, invoice.currencyCode)} still needs reconciliation.`
                            : 'No additional settlement balance is waiting right now.',
                    badgeVariant: 'outline',
                },
            ],
        };
    }

    return {
        heading: 'Claim execution',
        title: invoice.claimReadiness?.ready
            ? 'Claim prep & submission'
            : 'Claim follow-up queue',
        description: invoice.claimReadiness?.ready
            ? 'Claim prep is active and this invoice is ready for submission or payer-side claim follow-up.'
            : 'Claim prep is active for this invoice while payer follow-up and final readiness checks continue.',
        toneClass:
            invoiceDetailsFocusCard.value?.toneClass ??
            'border-border bg-background',
        cards: [
            {
                id: 'queue',
                title: 'Queue now',
                value: 'Claim prep & submission',
                helper: 'Claims work is the primary operational owner for this invoice now.',
                badgeVariant: invoice.claimReadiness?.ready ? 'secondary' : 'outline',
            },
            {
                id: 'claim-due',
                title: 'Claim due',
                value: dueLabel,
                helper:
                    invoice.claimReadiness?.claimSubmissionDueAt ||
                    invoice.payerSummary?.claimSubmissionDeadlineDays
                        ? 'Use this timing as the current claim submission target.'
                        : 'No formal payer claim due date is configured on this invoice.',
                badgeVariant: 'outline',
            },
            {
                id: 'expected-claim',
                title: 'Expected claim',
                value: formatMoney(expectedClaimAmount, invoice.currencyCode),
                helper:
                    coveragePosture?.description ??
                    'Payer-sponsored exposure attached to the current claim path.',
                badgeVariant: 'secondary',
            },
        ],
    };
});

const invoiceDetailsExecutionControlCards = computed<InvoiceDetailsOperationalCard[]>(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const status = (invoice.status ?? '').trim().toLowerCase();
    const usesThirdPartySettlement = invoiceDetailsUsesThirdPartySettlement.value;
    const coveragePosture = invoiceDetailsCoveragePosture.value;
    const amountSummary = invoiceDetailsAmountSummary.value;
    const paymentEntries = invoiceDetailsPayments.value;
    const reversibleEntries = paymentEntries.filter((payment) =>
        billingPaymentCanBeReversed(payment),
    ).length;
    const lastActivityLabel = invoice.lastPaymentAt
        ? formatDateTime(invoice.lastPaymentAt)
        : usesThirdPartySettlement
          ? 'No settlement activity yet'
          : 'No cashier payment yet';
    const dueLabel = invoice.payerSummary?.claimSubmissionDueAt
        ? formatDate(invoice.payerSummary.claimSubmissionDueAt)
        : invoice.paymentDueAt
          ? formatDate(invoice.paymentDueAt)
          : invoice.payerSummary?.claimSubmissionDeadlineDays
            ? `${invoice.payerSummary.claimSubmissionDeadlineDays} day limit`
            : 'Not set';
    const contractLabel =
        (invoice.payerSummary?.contractName ?? '').trim() ||
        (invoice.payerSummary?.payerName ?? '').trim() ||
        'No contract linked';
    const expectedClaimAmount =
        amountToNumber(
            invoice.claimReadiness?.expectedClaimAmount ??
                invoice.payerSummary?.expectedPayerAmount ??
                null,
        ) ?? 0;
    const expectedPatientAmount =
        amountToNumber(invoice.payerSummary?.expectedPatientAmount ?? null) ??
        amountSummary.balance ??
        0;
    const coverageSummary = billingInvoiceCoverageSummary(invoice);
    const authorizationSummary = billingInvoiceAuthorizationSummary(invoice);
    const excluded = Math.max(coverageSummary?.lineItemsExcluded ?? 0, 0);
    const manualReview = Math.max(coverageSummary?.lineItemsManualReview ?? 0, 0);
    const authorizationRequired = Math.max(
        authorizationSummary?.lineItemsRequiringAuthorization ?? 0,
        0,
    );

    if (!usesThirdPartySettlement) {
        return [
            {
                id: 'cashier-target',
                title: status === 'partially_paid' ? 'Remaining to collect' : 'Collection target',
                value: formatMoney(amountSummary.balance ?? amountSummary.total ?? 0, invoice.currencyCode),
                helper:
                    status === 'partially_paid'
                        ? 'Only the open patient balance should be collected now.'
                        : 'This is the cashier-facing amount to collect from the patient.',
                badgeVariant: 'default',
            },
            {
                id: 'cashier-due',
                title: 'Collection timing',
                value: dueLabel,
                helper:
                    invoice.paymentDueAt
                        ? 'Use the due date to guide follow-up when payment is not completed immediately.'
                        : 'No explicit due date is set on this invoice yet.',
                badgeVariant: 'outline',
            },
            {
                id: 'cashier-correction',
                title: 'Correction path',
                value: reversibleEntries > 0 ? 'Reversal available' : 'No reversal yet',
                helper:
                    reversibleEntries > 0
                        ? `${reversibleEntries} cashier entr${reversibleEntries === 1 ? 'y is' : 'ies are'} available for governed reversal if correction is needed.`
                        : 'Once cashier payment is posted, reversal becomes available from history if correction is needed.',
                badgeVariant: reversibleEntries > 0 ? 'secondary' : 'outline',
            },
            {
                id: 'cashier-handoff',
                title: 'Receipt and handoff',
                value: 'Print + payment history',
                helper:
                    'Use print for patient or cashier handoff, then rely on payment history for confirmation and correction tracking.',
                badgeVariant: 'outline',
            },
        ];
    }

    if (coveragePosture?.state === 'coverage_review_required') {
        return [
            {
                id: 'coverage-items',
                title: 'Coverage items waiting',
                value: `${manualReview}`,
                helper: `${manualReview} line item${manualReview === 1 ? '' : 's'} still need manual cover decision before the claim can move forward.`,
                badgeVariant: 'destructive',
            },
            {
                id: 'coverage-contract',
                title: 'Contract in focus',
                value: contractLabel,
                helper: 'Coverage review should stay aligned to the active payer contract or plan on this invoice.',
                badgeVariant: 'outline',
            },
            {
                id: 'coverage-release',
                title: 'Release path',
                value: 'Claim prep & submission',
                helper: 'Once review closes, the invoice should return straight into claim-prep flow.',
                badgeVariant: 'secondary',
            },
            {
                id: 'coverage-patient',
                title: 'Patient exposure',
                value: formatMoney(expectedPatientAmount, invoice.currencyCode),
                helper: 'Keep the visible patient share in view while coverage decisions are still unresolved.',
                badgeVariant: 'outline',
            },
        ];
    }

    if (
        coveragePosture?.state === 'coverage_exception' ||
        coveragePosture?.state === 'no_claim_route'
    ) {
        return [
            {
                id: 'exception-items',
                title: 'Exception load',
                value:
                    coveragePosture.state === 'coverage_exception'
                        ? `${excluded} excluded`
                        : 'Route missing',
                helper:
                    coveragePosture.state === 'coverage_exception'
                        ? `${excluded} line item${excluded === 1 ? '' : 's'} need patient-share or split-bill resolution.`
                        : 'No clean claim route is currently available under the linked payer policy.',
                badgeVariant: 'destructive',
            },
            {
                id: 'exception-patient',
                title: 'Patient-share decision',
                value: formatMoney(expectedPatientAmount, invoice.currencyCode),
                helper: 'This is the likely patient-facing exposure while exception handling remains open.',
                badgeVariant: 'outline',
            },
            {
                id: 'exception-release',
                title: 'Release path',
                value: 'Claim follow-up',
                helper: 'Clear the routing or exclusion decision before claim work continues.',
                badgeVariant: 'secondary',
            },
            {
                id: 'exception-contract',
                title: 'Policy source',
                value: contractLabel,
                helper: 'Exception handling should stay anchored to the payer contract that produced the current routing.',
                badgeVariant: 'outline',
            },
        ];
    }

    if (
        coveragePosture?.state === 'preauthorization_required' ||
        coveragePosture?.state === 'authorization_required'
    ) {
        return [
            {
                id: 'auth-items',
                title: 'Items needing authorization',
                value: `${authorizationRequired || 1}`,
                helper: `${authorizationRequired || 1} line item${authorizationRequired === 1 ? '' : 's'} still require authorization closure.`,
                badgeVariant: 'destructive',
            },
            {
                id: 'auth-contract',
                title: 'Authorization source',
                value: contractLabel,
                helper: 'Use the linked payer contract as the source of truth for authorization routing and timing.',
                badgeVariant: 'outline',
            },
            {
                id: 'auth-release',
                title: 'Release path',
                value: 'Claim prep & submission',
                helper: 'Claim work should resume immediately after authorization is closed.',
                badgeVariant: 'secondary',
            },
            {
                id: 'auth-claim',
                title: 'Expected claim',
                value: formatMoney(expectedClaimAmount, invoice.currencyCode),
                helper: 'Keep the payer-sponsored amount visible while authorization is being completed.',
                badgeVariant: 'outline',
            },
        ];
    }

    if (billingInvoiceThirdPartyPhase(invoice) === 'remittance_reconciliation') {
        return [
            {
                id: 'recon-expected',
                title: 'Expected payer amount',
                value: formatMoney(expectedClaimAmount, invoice.currencyCode),
                helper: 'Use this as the expected payer-side settlement position during reconciliation.',
                badgeVariant: 'secondary',
            },
            {
                id: 'recon-balance',
                title: 'Open reconciliation balance',
                value: formatMoney(amountSummary.balance ?? 0, invoice.currencyCode),
                helper: 'This is the amount still waiting to be reconciled across payer and patient-share settlement.',
                badgeVariant: amountSummary.balance && amountSummary.balance > 0 ? 'outline' : 'default',
            },
            {
                id: 'recon-cycle',
                title: 'Settlement cycle',
                value: invoice.payerSummary?.settlementCycleDays
                    ? `${invoice.payerSummary.settlementCycleDays} days`
                    : 'Not set',
                helper: 'Contract settlement timing helps explain whether the remittance delay is expected or overdue.',
                badgeVariant: 'outline',
            },
            {
                id: 'recon-activity',
                title: 'Latest remittance activity',
                value: lastActivityLabel,
                helper: 'Keep the most recent settlement or reconciliation activity visible while matching balances.',
                badgeVariant: 'outline',
            },
        ];
    }

    return [
        {
            id: 'claim-packet',
            title: 'Claim packet',
            value: invoice.claimReadiness?.ready ? 'Ready to submit' : 'Prep in progress',
            helper: invoice.claimReadiness?.ready
                ? 'The invoice meets current claim-readiness checks and can move into submission.'
                : 'Claim follow-up is still active. Keep references, routing, and coverage posture in sync until ready.',
            badgeVariant: invoice.claimReadiness?.ready ? 'secondary' : 'outline',
        },
        {
            id: 'claim-contract',
            title: 'Payer contract',
            value: contractLabel,
            helper: 'Claim routing and negotiated-price posture should match this active contract context.',
            badgeVariant: 'outline',
        },
        {
            id: 'claim-due',
            title: 'Submission target',
            value: dueLabel,
            helper: 'Use this as the operational target for claim handoff or payer follow-up.',
            badgeVariant: 'outline',
        },
        {
            id: 'claim-expected',
            title: 'Expected claim',
            value: formatMoney(expectedClaimAmount, invoice.currencyCode),
            helper: 'This is the payer-sponsored amount attached to the current claim path.',
            badgeVariant: 'secondary',
        },
    ];
});

const invoiceDetailsExecutionChecklist = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return null;

    const status = (invoice.status ?? '').trim().toLowerCase();
    const usesThirdPartySettlement = invoiceDetailsUsesThirdPartySettlement.value;
    const coveragePosture = invoiceDetailsCoveragePosture.value;
    const thirdPartyPhase = billingInvoiceThirdPartyPhase(invoice);
    const payerLabel =
        (invoice.payerSummary?.payerName ?? '').trim() ||
        billingPaymentPayerTypeLabel(invoice.payerSummary?.payerType);
    const dueLabel = invoice.payerSummary?.claimSubmissionDueAt
        ? formatDate(invoice.payerSummary.claimSubmissionDueAt)
        : invoice.payerSummary?.claimSubmissionDeadlineDays
          ? `${invoice.payerSummary.claimSubmissionDeadlineDays} day limit`
          : invoice.paymentDueAt
            ? formatDate(invoice.paymentDueAt)
            : 'Not set';
    const items: string[] = [];

    if (status === 'draft') {
        if (usesThirdPartySettlement) {
            items.push('Confirm the exact payer contract before issue so the invoice enters the correct claim lane.');
            items.push('Keep patient-share visible before issue when exclusions, co-pay, or split-bill exposure exists.');
            items.push(
                dueLabel !== 'Not set'
                    ? `Issue only when the claim path can still meet the current target (${dueLabel}).`
                    : 'Issue only when claim-routing and payer follow-up ownership are clear.',
            );
            return {
                title: 'Before issue',
                description: 'Release this draft into the correct third-party billing lane with the right payer context from the start.',
                badgeLabel: 'Third-party issue',
                items,
            };
        }

        items.push('Confirm totals and line items before release so cashier starts from one clean draft.');
        items.push('Set or confirm the due date when patient collection will not happen immediately.');
        items.push('Use issue only when this draft is ready to move into front-desk or cashier collection.');
        return {
            title: 'Before issue',
            description: 'Release this draft into cashier collection only when the patient-facing amount is final.',
            badgeLabel: 'Cashier issue',
            items,
        };
    }

    if (!usesThirdPartySettlement) {
        if (status === 'partially_paid') {
            items.push('Confirm the remaining patient balance before taking the next cashier payment.');
            items.push('Capture each cash, mobile-money, card, or bank reference separately instead of reusing the last one.');
            items.push('Use governed reversal if a cashier posting is wrong; do not overwrite payment history.');
            return {
                title: 'Cashier follow-up',
                description: 'Keep collection clean while the remaining patient balance is still open.',
                badgeLabel: 'Cashier balance',
                items,
            };
        }

        if (status === 'issued') {
            items.push('Collect against the correct route: receipt/daybook for cash, telecom ID for mobile money, or terminal/bank reference for electronic payment.');
            items.push('Record the cumulative amount received so far, not only the latest tranche.');
            items.push('Print or hand back the patient/cashier receipt path immediately after posting.');
            return {
                title: 'Cashier collection checklist',
                description: 'The invoice is live in self-pay collection, so the cashier route and proof need to stay clean.',
                badgeLabel: 'Cashier',
                items,
            };
        }
    }

    if (coveragePosture?.state === 'coverage_review_required') {
        items.push(`Review the manual cover decision against ${payerLabel} before claim work continues.`);
        items.push('Resolve which line items remain payer-covered and which move back to patient share.');
        items.push('Return the invoice to claim prep immediately after the review path is closed.');
        return {
            title: 'Coverage review checklist',
            description: 'Manual payer cover review is the current blocker, so the next move is a clear cover decision.',
            badgeLabel: 'Coverage review',
            items,
        };
    }

    if (
        coveragePosture?.state === 'coverage_exception' ||
        coveragePosture?.state === 'no_claim_route'
    ) {
        items.push('Separate excluded or non-claimable services before more payer settlement is posted.');
        items.push('Confirm the patient-share route, guarantee, or split-bill decision before reopening payer follow-up.');
        items.push('Keep the invoice in exception handling until the remaining balance has one clear route.');
        return {
            title: 'Coverage exception checklist',
            description: 'This invoice needs a routing decision before it can safely return to claims or reconciliation.',
            badgeLabel: 'Exception',
            items,
        };
    }

    if (
        coveragePosture?.state === 'preauthorization_required' ||
        coveragePosture?.state === 'authorization_required'
    ) {
        items.push(`Capture the authorization number, scheme approval, or employer guarantee evidence for ${payerLabel}.`);
        items.push('Confirm approved items, limits, or dates before claim release or further settlement posting.');
        items.push('Move the invoice back to claim prep as soon as authorization is closed.');
        return {
            title: 'Authorization checklist',
            description: 'Authorization is the active blocker, so payer approval proof needs to be complete before the next handoff.',
            badgeLabel: 'Authorization',
            items,
        };
    }

    if (thirdPartyPhase === 'remittance_reconciliation') {
        items.push('Match the remittance advice, bank transfer, cheque, or payer control reference to this exact invoice before posting.');
        items.push('Keep patient-share settlement separate from payer remittance when the payer does not settle the full amount.');
        items.push('Use reversal entries for wrong postings so reconciliation history stays auditable.');
        return {
            title: 'Reconciliation checklist',
            description: 'Settlement is already in motion, so the focus is matching payer remittance and remaining balance cleanly.',
            badgeLabel: 'Reconciliation',
            items,
        };
    }

    if (status === 'issued' || status === 'partially_paid') {
        items.push(`Keep the payer route aligned to ${payerLabel} and do not submit under the wrong contract context.`);
        items.push('Carry the claim/control number, guarantee letter, or payer-issued reference with the invoice before handoff.');
        items.push(
            dueLabel !== 'Not set'
                ? `Advance claim prep before the current submission target (${dueLabel}) slips.`
                : 'Advance claim prep while coverage and routing are still clean.',
        );
        return {
            title: 'Claim handoff checklist',
            description: 'The invoice is in claim prep, so staff need the payer proof, reference, and timing in one place.',
            badgeLabel: 'Claim prep',
            items,
        };
    }

    if (status === 'paid') {
        items.push('Use payment history, print, and audit only when a correction or downstream review is needed.');
        items.push('Any correction should happen through governed reversal, not direct editing of closed settlement history.');
        items.push('Keep the closed invoice available for patient, cashier, finance, or payer audit follow-up.');
        return {
            title: 'Closed invoice checklist',
            description: 'Routine execution is complete, so only audit-safe follow-up should continue from this point.',
            badgeLabel: 'Closed',
            items,
        };
    }

    items.push('Review closure reason and workflow history before any downstream follow-up.');
    items.push('Use audit and notes as the source of truth for why this invoice left active execution.');
    items.push('Only governed correction paths should continue from a closed billing exception.');
    return {
        title: 'Closure review checklist',
        description: 'This invoice is outside active settlement, so the work here is controlled review rather than execution.',
        badgeLabel: 'Review',
        items,
    };
});

const invoiceDetailsExecutionHandoffCards = computed<InvoiceDetailsOperationalCard[]>(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const status = (invoice.status ?? '').trim().toLowerCase();
    const usesThirdPartySettlement = invoiceDetailsUsesThirdPartySettlement.value;
    const coveragePosture = invoiceDetailsCoveragePosture.value;
    const thirdPartyPhase = billingInvoiceThirdPartyPhase(invoice);
    const claimsAction = billingInvoiceQueueClaimsAction(invoice);
    const sourceHref = invoiceSourceWorkflowHref(invoice);
    const dueLabel = invoice.payerSummary?.claimSubmissionDueAt
        ? formatDate(invoice.payerSummary.claimSubmissionDueAt)
        : invoice.payerSummary?.claimSubmissionDeadlineDays
          ? `${invoice.payerSummary.claimSubmissionDeadlineDays} day limit`
          : invoice.paymentDueAt
            ? formatDate(invoice.paymentDueAt)
            : 'Not set';
    const payerLabel =
        (invoice.payerSummary?.payerName ?? '').trim() ||
        billingPaymentPayerTypeLabel(invoice.payerSummary?.payerType);
    const sourceLabel = sourceHref ? 'Open source order' : 'Current invoice only';
    const cards: InvoiceDetailsOperationalCard[] = [];

    if (!usesThirdPartySettlement) {
        cards.push({
            id: 'handoff-workspace',
            title: 'Primary workspace',
            value: 'Cashier collection',
            helper: 'Keep posting and receipt handling in this invoice unless the source order needs review.',
            badgeVariant: 'default',
        });
        cards.push({
            id: 'handoff-proof',
            title: 'Carry forward',
            value: 'Receipt or transaction ref',
            helper: 'Use cashier receipt/daybook, telecom ID, POS slip, or bank reference as the proof for each collection route.',
            badgeVariant: 'outline',
        });
        cards.push({
            id: 'handoff-timing',
            title: 'Timing target',
            value: dueLabel,
            helper: dueLabel === 'Not set'
                ? 'No explicit due date is set yet.'
                : 'Use the current patient payment due date as the follow-up target.',
            badgeVariant: 'outline',
        });
        cards.push({
            id: 'handoff-support',
            title: 'Supporting context',
            value: sourceLabel,
            helper: sourceHref
                ? 'Use the originating order when cashier needs to verify why the charge exists.'
                : 'No linked source workflow is available for this invoice.',
            badgeVariant: sourceHref ? 'secondary' : 'outline',
        });
        return cards;
    }

    let workspaceValue = claimsAction?.label ?? 'Claims Queue';
    let workspaceHelper =
        'Use the linked claims workspace as the operational home for this invoice after billing handoff.';
    let proofValue = 'Claim/control reference';
    let proofHelper =
        `Carry the current payer-issued claim, guarantee, or control number for ${payerLabel}.`;

    if (coveragePosture?.state === 'coverage_review_required') {
        workspaceValue = 'Coverage review';
        workspaceHelper =
            'Coverage review is the active handoff target until manual payer cover decisions are closed.';
        proofValue = 'Coverage decision support';
        proofHelper =
            'Carry supporting benefit, scheme, or guarantor proof that justifies why each line stays payer-covered or moves to patient share.';
    } else if (
        coveragePosture?.state === 'coverage_exception' ||
        coveragePosture?.state === 'no_claim_route'
    ) {
        workspaceValue = 'Exception follow-up';
        workspaceHelper =
            'Exception handling owns the next step until excluded services or missing claim routes are resolved.';
        proofValue = 'Split-bill / patient-share basis';
        proofHelper =
            'Carry the reason for exclusion, no-claim-route decision, or patient-share guarantee before reopening payer follow-up.';
    } else if (
        coveragePosture?.state === 'preauthorization_required' ||
        coveragePosture?.state === 'authorization_required'
    ) {
        workspaceValue = 'Authorization follow-up';
        workspaceHelper =
            'Authorization follow-up is the handoff target before claim release or clean settlement posting can continue.';
        proofValue = 'Authorization proof';
        proofHelper =
            `Carry approval number, letter, or employer guarantee evidence linked to ${payerLabel}.`;
    } else if (thirdPartyPhase === 'remittance_reconciliation') {
        workspaceValue = claimsAction?.label ?? 'Claims Queue';
        workspaceHelper =
            'Keep claims context close while payer remittance, reconciliation, and patient-share matching continue.';
        proofValue = 'Remittance advice / bank proof';
        proofHelper =
            'Carry remittance advice, bank transfer, cheque, or payer control reference that matches this exact invoice.';
    } else if (invoice.claimReadiness?.ready) {
        workspaceValue = claimsAction?.label ?? 'Create Claim';
        workspaceHelper =
            'This invoice is claim-ready and can move straight into submission or payer-side follow-up.';
        proofValue = 'Submission packet';
        proofHelper =
            'Carry the claim/control number, payer attachment references, and contract-aligned invoice context together.';
    }

    cards.push({
        id: 'handoff-workspace',
        title: 'Primary workspace',
        value: workspaceValue,
        helper: workspaceHelper,
        badgeVariant: 'secondary',
    });
    cards.push({
        id: 'handoff-proof',
        title: 'Carry forward',
        value: proofValue,
        helper: proofHelper,
        badgeVariant: 'outline',
    });
    cards.push({
        id: 'handoff-timing',
        title: 'Timing target',
        value: dueLabel,
        helper: dueLabel === 'Not set'
            ? 'No formal payer timing target is configured on this invoice yet.'
            : 'Use this as the current claim or payer follow-up deadline.',
        badgeVariant: 'outline',
    });
    cards.push({
        id: 'handoff-support',
        title: 'Supporting context',
        value: sourceLabel,
        helper: sourceHref
            ? 'Keep the originating clinical source available when payer or finance needs billing justification.'
            : 'No linked source workflow is available for this invoice.',
        badgeVariant: sourceHref ? 'secondary' : 'outline',
    });

    return cards;
});

const invoiceDetailsLedgerConfidenceCards = computed<InvoiceDetailsOperationalCard[]>(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const amountSummary = invoiceDetailsAmountSummary.value;
    const totalEntries = invoiceDetailsPaymentsMeta.value?.total ?? invoiceDetailsPayments.value.length;
    const reversalEntries = invoiceDetailsPayments.value.filter((payment) =>
        billingPaymentIsReversal(payment),
    ).length;
    const lastActivityLabel = invoice.lastPaymentAt
        ? formatDateTime(invoice.lastPaymentAt)
        : invoiceDetailsUsesThirdPartySettlement.value
          ? 'No settlement activity yet'
          : 'No cashier activity yet';

    return [
        {
            id: 'ledger-total',
            title: 'Gross total',
            value: formatMoney(amountSummary.total ?? 0, invoice.currencyCode),
            helper: 'Full invoice exposure before paid balance is netted down.',
            badgeVariant: 'outline',
        },
        {
            id: 'ledger-paid',
            title: invoiceDetailsUsesThirdPartySettlement.value ? 'Settled so far' : 'Collected so far',
            value: formatMoney(amountSummary.paid, invoice.currencyCode),
            helper: `${amountSummary.settlementPercent}% of the invoice has been settled.`,
            badgeVariant: amountSummary.settlementPercent >= 100 ? 'default' : 'secondary',
        },
        {
            id: 'ledger-adjustments',
            title: 'Discount and tax',
            value: `${formatMoney(invoice.discountAmount ?? 0, invoice.currencyCode)} / ${formatMoney(invoice.taxAmount ?? 0, invoice.currencyCode)}`,
            helper: 'Displayed as discount first, then tax, so billing adjustments stay visible during follow-up.',
            badgeVariant: 'outline',
        },
        {
            id: 'ledger-entries',
            title: 'Ledger confidence',
            value: `${totalEntries} entr${totalEntries === 1 ? 'y' : 'ies'}`,
            helper:
                reversalEntries > 0
                    ? `${reversalEntries} reversal${reversalEntries === 1 ? '' : 's'} recorded. Latest activity ${lastActivityLabel}.`
                    : `No reversal entries yet. Latest activity ${lastActivityLabel}.`,
            badgeVariant: reversalEntries > 0 ? 'secondary' : 'outline',
        },
    ];
});

const invoiceDetailsPrimaryAction = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return null;

    if (canIssueBillingInvoices.value && invoice.status === 'draft') {
        return {
            label: billingInvoiceStatusActionLabel(invoice, 'issued'),
            action: 'issued' as BillingInvoiceStatusAction,
            variant: 'default' as const,
        };
    }

    if (
        canRecordBillingPayments.value &&
        (invoice.status === 'issued' || invoice.status === 'partially_paid')
    ) {
        return {
            label: billingInvoiceStatusActionLabel(invoice, 'record_payment'),
            action: 'record_payment' as BillingInvoiceStatusAction,
            variant: billingInvoiceShouldPrioritizeClaimsAction(invoice)
                ? 'secondary' as const
                : 'default' as const,
        };
    }

    return null;
});

const invoiceDetailsLeadWorkflowAction = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return null;
    if (!billingInvoiceShouldPrioritizeClaimsAction(invoice)) return null;

    return billingInvoiceQueueClaimsAction(invoice);
});

const invoiceDetailsHeaderQuickLaunch = computed(() => {
    const workflowAction = invoiceDetailsLeadWorkflowAction.value;
    const primaryAction = invoiceDetailsPrimaryAction.value;
    const primaryOperationalAction = invoiceDetailsPrimaryOperationalAction.value;

    if (workflowAction && primaryOperationalAction?.href === workflowAction.href) {
        return {
            kind: 'link' as const,
            label: workflowAction.label,
            title: primaryOperationalAction.title,
            description: primaryOperationalAction.description,
            href: workflowAction.href,
            icon: primaryOperationalAction.icon,
            variant: primaryOperationalAction.variant,
        };
    }

    if (workflowAction) {
        return {
            kind: 'link' as const,
            label: workflowAction.label,
            title: primaryOperationalAction?.title ?? workflowAction.label,
            description:
                primaryOperationalAction?.description
                ?? 'Open the linked workflow with this invoice context already carried forward.',
            href: workflowAction.href,
            icon: primaryOperationalAction?.icon ?? 'receipt',
            variant: primaryOperationalAction?.variant ?? 'secondary',
        };
    }

    if (primaryAction) {
        return {
            kind: 'status' as const,
            label: primaryAction.label,
            title: primaryOperationalAction?.title ?? primaryAction.label,
            description:
                primaryOperationalAction?.description
                ?? 'Continue the next billing action directly from this invoice.',
            action: primaryAction.action,
            icon: primaryOperationalAction?.icon ?? 'activity',
            variant: primaryAction.variant,
        };
    }

    return null;
});

const invoiceDetailsHeaderSupportActions = computed(() => {
    const actions: Array<{
        key: string;
        label: string;
        icon: string;
        variant: 'default' | 'secondary' | 'outline' | 'destructive';
        href?: string;
        onClick?: () => void;
    }> = [];

    const primaryAction = invoiceDetailsPrimaryAction.value;
    const workflowAction = invoiceDetailsLeadWorkflowAction.value;

    if (workflowAction && primaryAction) {
        actions.push({
            key: 'header-primary-status',
            label: primaryAction.label,
            icon: 'activity',
            variant: primaryAction.variant,
            onClick: () => {
                if (invoiceDetailsInvoice.value) {
                    openInvoiceStatusDialog(invoiceDetailsInvoice.value, primaryAction.action);
                }
            },
        });
    }

    for (const action of invoiceDetailsSecondaryActions.value.slice(0, 3)) {
        actions.push({
            key: `header-secondary-${action.key}`,
            label: action.label,
            icon:
                action.key.includes('print')
                    ? 'file-text'
                    : action.key.includes('source')
                      ? 'receipt'
                      : 'activity',
            variant: action.variant,
            onClick: action.onClick,
        });
    }

    return actions;
});

const invoiceDetailsOperationalActions = computed<InvoiceDetailsOperationalAction[]>(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const actions: InvoiceDetailsOperationalAction[] = [];
    const status = (invoice.status ?? '').trim().toLowerCase();
    const usesThirdPartySettlement = invoiceDetailsUsesThirdPartySettlement.value;
    const coveragePosture = invoiceDetailsCoveragePosture.value;
    const claimsAction = billingInvoiceQueueClaimsAction(invoice);
    const sourceHref = invoiceSourceWorkflowHref(invoice);
    const dueLabel = invoice.payerSummary?.claimSubmissionDueAt
        ? formatDate(invoice.payerSummary.claimSubmissionDueAt)
        : invoice.payerSummary?.claimSubmissionDeadlineDays
          ? `${invoice.payerSummary.claimSubmissionDeadlineDays} day claim window`
          : invoice.paymentDueAt
            ? formatDate(invoice.paymentDueAt)
            : 'Current business follow-up';
    const settlementCycleLabel = invoice.payerSummary?.settlementCycleDays
        ? `${invoice.payerSummary.settlementCycleDays} day settlement cycle`
        : 'Current reconciliation cycle';
    const payerLabel =
        (invoice.payerSummary?.payerName ?? '').trim()
        || billingPaymentPayerTypeLabel(invoice.payerSummary?.payerType);
    const expectedPatientAmount =
        amountToNumber(invoice.payerSummary?.expectedPatientAmount ?? null) ??
        amountToNumber(invoice.balanceAmount ?? null) ??
        0;
    const canPostPayment =
        canRecordBillingPayments.value &&
        (status === 'issued' || status === 'partially_paid');

    if (!usesThirdPartySettlement) {
        if (canPostPayment) {
            actions.push({
                key: 'cashier-payment',
                title:
                    status === 'partially_paid'
                        ? 'Record remaining payment'
                        : 'Record cashier payment',
                description:
                    status === 'partially_paid'
                        ? 'Post the remaining patient payment from the cashier lane and keep the balance current.'
                        : 'Use cashier payment capture to post the patient payment from this invoice.',
                label: billingInvoiceStatusActionLabel(invoice, 'record_payment'),
                icon: 'activity',
                variant: 'default',
                detailRows: [
                    {
                        label: 'Proof',
                        value: 'Receipt, telecom ID, POS slip, or bank reference',
                    },
                    {
                        label: 'Timing',
                        value: invoice.paymentDueAt ? formatDate(invoice.paymentDueAt) : 'Same cashier shift',
                    },
                ],
                onClick: () => openInvoiceStatusDialog(invoice, 'record_payment'),
            });
        }
    } else if (
        coveragePosture?.state === 'coverage_review_required' ||
        coveragePosture?.state === 'coverage_exception' ||
        coveragePosture?.state === 'no_claim_route' ||
        coveragePosture?.state === 'preauthorization_required' ||
        coveragePosture?.state === 'authorization_required' ||
        billingInvoiceShouldPrioritizeClaimsAction(invoice)
    ) {
        if (claimsAction) {
            let title = 'Open claim workspace';
            let description =
                'Open the linked claims workspace for this invoice and continue payer follow-up from there.';
            let detailRows: Array<{ label: string; value: string }> = [
                {
                    label: 'Proof',
                    value: `Current payer control, guarantee, or claim reference for ${payerLabel}`,
                },
                {
                    label: 'Timing',
                    value: dueLabel,
                },
            ];

            if (coveragePosture?.state === 'coverage_review_required') {
                title = 'Open coverage review';
                description =
                    'Use the claims workspace with this invoice context to clear manual coverage review and return the invoice to claim prep.';
                detailRows = [
                    {
                        label: 'Proof',
                        value: 'Benefit evidence, guarantor proof, and line-level cover decision basis',
                    },
                    {
                        label: 'Timing',
                        value: 'Before claim prep resumes',
                    },
                ];
            } else if (
                coveragePosture?.state === 'coverage_exception' ||
                coveragePosture?.state === 'no_claim_route'
            ) {
                title = 'Open exception follow-up';
                description =
                    'Review excluded services, patient-share routing, or missing claim path decisions in the claims workspace.';
                detailRows = [
                    {
                        label: 'Proof',
                        value: 'Split-bill basis, exclusion reason, or patient-share guarantee',
                    },
                    {
                        label: 'Timing',
                        value: 'Before more payer posting',
                    },
                ];
            } else if (
                coveragePosture?.state === 'preauthorization_required' ||
                coveragePosture?.state === 'authorization_required'
            ) {
                title = 'Open authorization follow-up';
                description =
                    'Continue payer authorization handling in the claims workspace before returning to claim prep.';
                detailRows = [
                    {
                        label: 'Proof',
                        value: `Approval number, letter, or authorization evidence for ${payerLabel}`,
                    },
                    {
                        label: 'Timing',
                        value: 'Before claim release',
                    },
                ];
            } else if (billingInvoiceThirdPartyPhase(invoice) === 'remittance_reconciliation') {
                title = 'Open reconciliation context';
                description =
                    'Keep claims context close while remittance and settlement reconciliation continue on this invoice.';
                detailRows = [
                    {
                        label: 'Proof',
                        value: 'Remittance advice, bank proof, cheque trail, or payer control reference',
                    },
                    {
                        label: 'Timing',
                        value: settlementCycleLabel,
                    },
                ];
            } else if (invoice.claimReadiness?.ready) {
                title = 'Open claim submission';
                description =
                    'This invoice is claim-ready. Open the claims workspace and move straight into submission or payer follow-up.';
                detailRows = [
                    {
                        label: 'Proof',
                        value: 'Submission packet, payer attachments, and contract-aligned claim reference',
                    },
                    {
                        label: 'Timing',
                        value: dueLabel,
                    },
                ];
            }

            actions.push({
                key: 'claims-workflow',
                title,
                description,
                label: claimsAction.label,
                icon: 'receipt',
                variant: 'secondary',
                detailRows,
                href: claimsAction.href,
            });
        }

        if (canPostPayment && expectedPatientAmount > 0) {
            actions.push({
                key: 'patient-share-payment',
                title: 'Record patient-share payment',
                description:
                    'Post any patient-share or top-up payment without leaving this invoice while payer follow-up continues.',
                label: billingInvoiceStatusActionLabel(invoice, 'record_payment'),
                icon: 'activity',
                variant: 'outline',
                detailRows: [
                    {
                        label: 'Proof',
                        value: 'Patient receipt, telecom ID, or bank reference kept separate from payer remittance',
                    },
                    {
                        label: 'Timing',
                        value: 'Same cashier follow-up',
                    },
                ],
                onClick: () => openInvoiceStatusDialog(invoice, 'record_payment'),
            });
        }
    }

    if (sourceHref) {
        actions.push({
            key: 'source-order',
            title: 'Open source order',
            description:
                'Jump back to the originating clinical order or source workflow to confirm what produced this invoice.',
            label: 'Open Source Order',
            icon: 'receipt',
            variant: 'outline',
            detailRows: [
                {
                    label: 'Purpose',
                    value: 'Verify the originating clinical charge or order context',
                },
            ],
            href: sourceHref,
        });
    }

    actions.push({
        key: 'print-invoice',
        title: 'Print invoice',
        description:
            'Open the clean invoice print view for handoff or patient sharing.',
        label: 'Print',
        icon: 'file-text',
        variant: 'outline',
        detailRows: [
            {
                label: 'Use',
                value: 'Cashier handoff, patient copy, or payer copy',
            },
        ],
        onClick: () => openInvoicePrintPreview(invoice),
    });

    return actions.slice(0, 3);
});

const invoiceDetailsPrimaryOperationalAction = computed(
    () => invoiceDetailsOperationalActions.value[0] ?? null,
);

const invoiceDetailsSupportingOperationalActions = computed(
    () => invoiceDetailsOperationalActions.value.slice(1),
);

const invoiceDetailsSecondaryActions = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const actions: Array<{
        key: string;
        label: string;
        variant: 'default' | 'secondary' | 'outline' | 'destructive';
        onClick: () => void;
    }> = [];

    const sourceHref = invoiceSourceWorkflowHref(invoice);
    if (sourceHref) {
        actions.push({
            key: 'source-order',
            label: 'Open Source Order',
            variant: 'outline',
            onClick: () => {
                window.location.assign(sourceHref);
            },
        });
    }

    if (canUpdateDraftBillingInvoices.value && invoice.status === 'draft') {
        actions.push({
            key: 'open-draft-workspace',
            label: 'Charge Workspace',
            variant: 'outline',
            onClick: () => openDraftBillingWorkspace(invoice),
        });
        actions.push({
            key: 'edit-draft',
            label: 'Quick Edit Draft',
            variant: 'outline',
            onClick: () => openEditInvoiceDialog(invoice),
        });
    }

    if (
        canCancelBillingInvoices.value &&
        invoice.status !== 'paid' &&
        invoice.status !== 'cancelled' &&
        invoice.status !== 'voided'
    ) {
        actions.push({
            key: 'cancel',
            label: 'Cancel Invoice',
            variant: 'destructive',
            onClick: () => openInvoiceStatusDialog(invoice, 'cancelled'),
        });
    }

    if (
        canVoidBillingInvoices.value &&
        invoice.status !== 'paid' &&
        invoice.status !== 'voided'
    ) {
        actions.push({
            key: 'void',
            label: 'Void Invoice',
            variant: 'outline',
            onClick: () => openInvoiceStatusDialog(invoice, 'voided'),
        });
    }

    return actions;
});
const editDialogCanOpenDraftWorkspace = computed(
    () =>
        canUpdateDraftBillingInvoices.value &&
        (editDialogSourceInvoice.value?.status ?? '').trim().toLowerCase() === 'draft',
);
const invoiceDetailsOperationalLockMessage = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return null;

    const status = (invoice.status ?? '').trim().toLowerCase();
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';

    if (status === 'issued') {
        return usesThirdPartySettlement
            ? 'Draft charge editing is closed. Continue this invoice through settlement, remittance, patient-share capture, or audit workflows only.'
            : 'Draft charge editing is closed. Continue this invoice through cashier collection, payment reversal, or audit workflows only.';
    }

    if (status === 'partially_paid') {
        return usesThirdPartySettlement
            ? 'This invoice is already in active settlement. Continue remittance and balance follow-up instead of draft maintenance.'
            : 'This invoice is already in active collection. Continue cashier collection and balance follow-up instead of draft maintenance.';
    }

    if (status === 'paid') {
        return 'This invoice is fully closed for billing operations. Use payment history, reversals, print, or audit review only if follow-up is needed.';
    }

    return null;
});

const invoiceDetailsWorkflowSummaryCards = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const balance = amountToNumber(invoice.balanceAmount ?? null) ?? 0;
    const paid = amountToNumber(invoice.paidAmount ?? null) ?? 0;
    const total = amountToNumber(invoice.totalAmount ?? null) ?? 0;
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const settlementPathLabel = billingInvoiceSettlementPathLabel(invoice);
    const coveragePosture = billingInvoiceCoveragePosture(invoice);

    return [
        {
            id: 'settlement-state',
            title: 'Settlement state',
            value:
                invoice.status === 'paid'
                    ? 'Closed'
                    : invoice.status === 'partially_paid'
                      ? 'Partial'
                      : invoice.status === 'issued'
                        ? usesThirdPartySettlement
                            ? 'Awaiting settlement'
                            : 'Awaiting collection'
                        : formatEnumLabel(invoice.status),
            helper:
                invoice.status === 'paid'
                    ? 'Invoice fully settled and ready for audit or reporting.'
                    : balance > 0
                      ? `Outstanding balance ${formatMoney(balance, invoice.currencyCode)} still needs follow-up.`
                      : 'No additional settlement action is currently needed.',
            badgeVariant:
                invoice.status === 'paid'
                    ? 'default'
                    : invoice.status === 'partially_paid'
                      ? 'secondary'
                      : 'outline',
        },
        {
            id: 'payer-route',
            title: 'Settlement route',
            value: settlementPathLabel,
            helper: usesThirdPartySettlement
                ? 'Use claims and payer follow-up links when remittance, authorization, or denial review is required.'
                : 'Cashier collection can continue directly from this invoice.',
            badgeVariant:
                usesThirdPartySettlement ? 'secondary' : 'outline',
        },
        {
            id: 'coverage-posture',
            title: 'Coverage posture',
            value: coveragePosture?.label ?? (usesThirdPartySettlement ? 'Third-party routing' : 'Self-pay'),
            helper: coveragePosture?.description
                ?? (
                    usesThirdPartySettlement
                        ? 'Contract coverage posture is not available for this invoice yet.'
                        : 'No payer contract policy is attached to this invoice.'
                ),
            badgeVariant: coveragePosture?.badgeVariant ?? 'outline',
        },
        {
            id: 'collection-progress',
            title: usesThirdPartySettlement
                ? 'Settlement progress'
                : 'Collection progress',
            value:
                total > 0
                    ? `${Math.round(Math.min(100, (paid / total) * 100))}%`
                    : '0%',
            helper: invoice.lastPaymentAt
                ? usesThirdPartySettlement
                    ? `Last posted settlement activity ${formatDateTime(invoice.lastPaymentAt)}`
                    : `Last cashier activity ${formatDateTime(invoice.lastPaymentAt)}`
                : usesThirdPartySettlement
                    ? 'No settlement entry has been recorded yet.'
                    : 'No payment has been recorded yet.',
            badgeVariant: paid > 0 ? 'default' : 'outline',
        },
    ];
});

const invoiceDetailsWorkflowLinks = computed<InvoiceWorkflowLink[]>(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const links: InvoiceWorkflowLink[] = [];

    if (invoice.patientId && canReadMedicalRecords.value) {
        links.push({
            key: 'medical-records',
            label: 'Medical Records',
            helper: 'Review consultation and documentation before settlement decisions.',
            href: invoiceContextHref(invoice, '/medical-records', { includeTabNew: true }),
            icon: 'stethoscope',
        });
    }

    if (invoice.appointmentId && canReadAppointments.value) {
        links.push({
            key: 'appointment',
            label: 'Appointment',
            helper: 'Return to the originating appointment workflow.',
            href: invoiceBackToAppointmentsHref(invoice),
            icon: 'calendar-clock',
        });
    }

    if (invoice.admissionId && canReadAdmissions.value) {
        links.push({
            key: 'admission',
            label: 'Admission',
            helper: 'Open the linked admission for inpatient billing context.',
            href: invoiceContextHref(invoice, '/admissions'),
            icon: 'bed-double',
        });
    }

    if (canCreateClaimsInsurance.value && invoiceClaimWorkflowIsAvailable(invoice)) {
        links.push({
            key: 'create-claim',
            label: invoice.claimReadiness?.ready ? 'Create Claim' : 'Prepare Claim',
            helper: invoice.claimReadiness?.ready
                ? 'Open Claims with this invoice and payer context already filled.'
                : 'Open a draft claim path while authorization or payer requirements are finished.',
            href: invoiceClaimCreateHref(invoice),
            icon: 'receipt',
        });
    } else if (
        canReadClaimsInsurance.value
        && billingInvoiceSettlementMode(invoice) === 'third_party'
    ) {
        links.push({
            key: 'claims-queue',
            label: 'Claims Queue',
            helper: 'Review claim work and reconciliation activity already linked to this payer-responsible invoice.',
            href: invoiceClaimsQueueHref(invoice),
            icon: 'receipt',
        });
    }

    if (canReadBillingPayerContracts.value) {
        links.push({
            key: 'payer-contracts',
            label: 'Payer Contracts',
            helper: 'Review payer contracts, authorization rules, and coverage conditions.',
            href: '/billing-payer-contracts',
            icon: 'badge-check',
        });
    }

    if (
        canReadBillingInvoices.value
        && ['issued', 'partially_paid'].includes((invoice.status ?? '').trim().toLowerCase())
    ) {
        links.push({
            key: 'payment-plan',
            label: 'Payment Plan',
            helper: 'Open payment plans with this invoice preselected for installment setup.',
            href: invoicePaymentPlanCreateHref(invoice),
            icon: 'calendar-range',
        });
    }

    if (
        canReadBillingPayerContracts.value
        && ['issued', 'partially_paid'].includes((invoice.status ?? '').trim().toLowerCase())
        && (invoice.billingPayerContractId ?? '').trim() !== ''
    ) {
        links.push({
            key: 'corporate-billing',
            label: 'Corporate Billing',
            helper: 'Open corporate billing with this payer contract and invoice date prefilled for a run.',
            href: invoiceCorporateRunHref(invoice),
            icon: 'building-2',
        });
    }

    return links;
});

const billingCreateWorkflowLinks = computed<InvoiceWorkflowLink[]>(() => {
    const links: InvoiceWorkflowLink[] = [];

    if (canReadMedicalRecords.value) {
        links.push({
            key: 'medical-records',
            label: consultationWorkflowLabel.value,
            helper: hasCreateMedicalRecordContext.value
                ? 'Return to the same consultation note with billing context preserved.'
                : 'Continue clinical documentation with the current billing context.',
            href: consultationContextHref.value,
            icon: 'stethoscope',
        });
    }

    if (canReadBillingServiceCatalog.value) {
        links.push({
            key: 'service-catalog',
            label: 'Service Catalog',
            helper: 'Validate tariffs and service codes before finalizing pricing.',
            href: '/billing-service-catalog',
            icon: 'list-check',
        });
    }

    if (canReadBillingPayerContracts.value) {
        links.push({
            key: 'payer-contracts',
            label: 'Payer Contracts',
            helper: 'Confirm payer rules, pre-authorization, and contract terms.',
            href: '/billing-payer-contracts',
            icon: 'badge-check',
        });
    }

    if (canCreateLaboratoryOrders.value) {
        links.push({
            key: 'laboratory-orders',
            label: 'New Lab Order',
            helper: 'Open laboratory ordering without re-searching the patient.',
            href: contextCreateHref('/laboratory-orders', { includeTabNew: true }),
            icon: 'flask-conical',
        });
    }

    if (canCreatePharmacyOrders.value) {
        links.push({
            key: 'pharmacy-orders',
            label: 'New Pharmacy Order',
            helper: 'Open medication ordering from the same patient context.',
            href: contextCreateHref('/pharmacy-orders', { includeTabNew: true }),
            icon: 'pill',
        });
    }

    if (canCreateTheatreProcedures.value) {
        links.push({
            key: 'theatre-procedures',
            label: 'Schedule Procedure',
            helper: 'Carry the same patient and encounter context into theatre scheduling.',
            href: contextCreateHref('/theatre-procedures', { includeTabNew: true }),
            icon: 'scissors',
        });
    }

    return links;
});

const invoiceDetailsWorkflowStepCards = computed(() => {
    const invoice = invoiceDetailsInvoice.value;
    if (!invoice) return [];

    const status = (invoice.status ?? '').trim().toLowerCase();
    const primaryActionLabel = invoiceDetailsPrimaryAction.value?.label ?? null;
    const usesThirdPartySettlement =
        billingInvoiceSettlementMode(invoice) === 'third_party';
    const coveragePosture = invoiceDetailsCoveragePosture.value;
    const thirdPartyPhase = billingInvoiceThirdPartyPhase(invoice);
    const issueHandoff = billingInvoiceIssueHandoff(invoice);

    if (status === 'draft') {
        return [
            {
                id: 'current-step',
                title: 'Current step',
                value: 'Draft invoice',
                helper: 'Charges can still be adjusted before issue.',
                badgeVariant: 'outline' as const,
            },
            {
                id: 'next-action',
                title: 'Next action',
                value: primaryActionLabel ?? 'Issue invoice',
                helper: usesThirdPartySettlement
                    ? 'Confirm totals, coverage posture, and due date, then release it to the correct third-party queue.'
                    : 'Confirm totals and due date, then release it to cashier collection.',
                badgeVariant: 'secondary' as const,
            },
            {
                id: 'after-step',
                title: 'After this step',
                value:
                    issueHandoff?.afterStepValue ??
                    (usesThirdPartySettlement
                        ? 'Claim prep queue'
                        : 'Cashier collection queue'),
                helper:
                    issueHandoff?.afterStepHelper ??
                    (usesThirdPartySettlement
                        ? 'Claims or payer follow-up becomes the active workflow.'
                        : 'Cashier payment capture becomes the active workflow.'),
                badgeVariant: 'outline' as const,
            },
        ];
    }

    if (status === 'issued') {
        if (!usesThirdPartySettlement) {
            return [
                {
                    id: 'current-step',
                    title: 'Current step',
                    value: 'Cashier collection',
                    helper: 'The invoice is active for cashier or front-desk patient collection.',
                    badgeVariant: 'secondary' as const,
                },
                {
                    id: 'next-action',
                    title: 'Next action',
                    value: primaryActionLabel ?? 'Record payment',
                    helper: 'Capture the next cashier payment or patient-share collection entry.',
                    badgeVariant: 'default' as const,
                },
                {
                    id: 'after-step',
                    title: 'After this step',
                    value: 'Balance updates immediately',
                    helper: 'The cashier queue stays active until the invoice is fully collected or formally closed.',
                    badgeVariant: 'outline' as const,
                },
            ];
        }

        if (coveragePosture?.state === 'coverage_review_required') {
            return [
                {
                    id: 'current-step',
                    title: 'Current step',
                    value: 'Coverage review',
                    helper: 'Manual payer cover review is blocking claim submission on this invoice.',
                    badgeVariant: 'destructive' as const,
                },
                {
                    id: 'next-action',
                    title: 'Next action',
                    value: 'Clear coverage review',
                    helper: 'Resolve the manual coverage decision before claim submission continues.',
                    badgeVariant: 'destructive' as const,
                },
                {
                    id: 'after-step',
                    title: 'After this step',
                    value: 'Claim prep resumes',
                    helper: 'Once coverage review clears, the invoice can move back into claim prep and submission.',
                    badgeVariant: 'outline' as const,
                },
            ];
        }

        if (
            coveragePosture?.state === 'coverage_exception' ||
            coveragePosture?.state === 'no_claim_route'
        ) {
            return [
                {
                    id: 'current-step',
                    title: 'Current step',
                    value: 'Coverage exception review',
                    helper: 'Excluded services or missing claim route posture are blocking clean payer follow-up.',
                    badgeVariant: 'destructive' as const,
                },
                {
                    id: 'next-action',
                    title: 'Next action',
                    value: 'Resolve patient-share routing',
                    helper: 'Split excluded services or confirm patient-share handling before continuing payer follow-up.',
                    badgeVariant: 'destructive' as const,
                },
                {
                    id: 'after-step',
                    title: 'After this step',
                    value: 'Claim path or reconciliation continues',
                    helper: 'Once the exception is resolved, the invoice can return to claim prep or settlement follow-up.',
                    badgeVariant: 'outline' as const,
                },
            ];
        }

        if (
            coveragePosture?.state === 'preauthorization_required' ||
            coveragePosture?.state === 'authorization_required'
        ) {
            return [
                {
                    id: 'current-step',
                    title: 'Current step',
                    value: 'Authorization follow-up',
                    helper: 'Authorization is still open on this invoice before claim release can continue.',
                    badgeVariant: 'outline' as const,
                },
                {
                    id: 'next-action',
                    title: 'Next action',
                    value: 'Close authorization',
                    helper: 'Complete payer authorization or pre-authorization requirements first.',
                    badgeVariant: 'default' as const,
                },
                {
                    id: 'after-step',
                    title: 'After this step',
                    value: 'Claim prep & submission',
                    helper: 'Claim work becomes the active next step as soon as authorization closes.',
                    badgeVariant: 'secondary' as const,
                },
            ];
        }

        if (thirdPartyPhase === 'remittance_reconciliation') {
            return [
                {
                    id: 'current-step',
                    title: 'Current step',
                    value: 'Remittance & reconciliation',
                    helper: 'Settlement activity is already running and the invoice is in reconciliation follow-up.',
                    badgeVariant: 'secondary' as const,
                },
                {
                    id: 'next-action',
                    title: 'Next action',
                    value: primaryActionLabel ?? 'Record payment',
                    helper: 'Capture the latest remittance, patient-share posting, or reconciliation correction.',
                    badgeVariant: 'default' as const,
                },
                {
                    id: 'after-step',
                    title: 'After this step',
                    value: 'Settlement position updates immediately',
                    helper: 'The invoice stays in reconciliation until the remaining balance is resolved.',
                    badgeVariant: 'outline' as const,
                },
            ];
        }

        return [
            {
                id: 'current-step',
                title: 'Current step',
                value: 'Claim prep & submission',
                helper: invoice.claimReadiness?.ready
                    ? 'The invoice is ready for claim submission or payer-side follow-up.'
                    : 'Claim prep is active while payer follow-up and readiness checks continue.',
                badgeVariant: 'secondary' as const,
            },
            {
                id: 'next-action',
                title: 'Next action',
                value: primaryActionLabel ?? 'Record payment',
                helper: invoice.claimReadiness?.ready
                    ? 'Create or advance the claim, then keep payer follow-up moving.'
                    : 'Continue claim prep work until submission or payer-side follow-up is ready.',
                badgeVariant: 'default' as const,
            },
            {
                id: 'after-step',
                title: 'After this step',
                value: 'Remittance or partial settlement follows',
                helper: 'Once claim work advances, the invoice moves into remittance posting, reconciliation, or balance closure.',
                badgeVariant: 'outline' as const,
            },
        ];
    }

    if (status === 'partially_paid') {
        if (!usesThirdPartySettlement) {
            return [
                {
                    id: 'current-step',
                    title: 'Current step',
                    value: 'Partial cashier collection',
                    helper: 'Some patient money is already collected, but a cashier balance still remains open.',
                    badgeVariant: 'secondary' as const,
                },
                {
                    id: 'next-action',
                    title: 'Next action',
                    value: primaryActionLabel ?? 'Record payment',
                    helper: 'Capture the next cumulative cashier payment.',
                    badgeVariant: 'default' as const,
                },
                {
                    id: 'after-step',
                    title: 'After this step',
                    value: 'Cashier collection closes at zero balance',
                    helper: 'Reversals and audit review remain available after the balance is cleared.',
                    badgeVariant: 'outline' as const,
                },
            ];
        }

        if (coveragePosture?.state === 'coverage_review_required') {
            return [
                {
                    id: 'current-step',
                    title: 'Current step',
                    value: 'Coverage review with open balance',
                    helper: 'Settlement activity exists, but coverage review still needs to close on the remaining balance.',
                    badgeVariant: 'destructive' as const,
                },
                {
                    id: 'next-action',
                    title: 'Next action',
                    value: 'Finish coverage review',
                    helper: 'Clear the review blocker before more claim or payer follow-up continues.',
                    badgeVariant: 'destructive' as const,
                },
                {
                    id: 'after-step',
                    title: 'After this step',
                    value: 'Claim or reconciliation resumes',
                    helper: 'The invoice can return to claim prep or remittance follow-up once review clears.',
                    badgeVariant: 'outline' as const,
                },
            ];
        }

        if (
            coveragePosture?.state === 'coverage_exception' ||
            coveragePosture?.state === 'no_claim_route'
        ) {
            return [
                {
                    id: 'current-step',
                    title: 'Current step',
                    value: 'Coverage exception with open balance',
                    helper: 'A coverage exception still affects how the remaining balance should be routed.',
                    badgeVariant: 'destructive' as const,
                },
                {
                    id: 'next-action',
                    title: 'Next action',
                    value: 'Close patient-share exception',
                    helper: 'Resolve excluded-service or no-claim-route handling before more payer follow-up is posted.',
                    badgeVariant: 'destructive' as const,
                },
                {
                    id: 'after-step',
                    title: 'After this step',
                    value: 'Settlement closes on the correct route',
                    helper: 'Once routing is corrected, the remaining balance can close under claim or patient-share follow-up.',
                    badgeVariant: 'outline' as const,
                },
            ];
        }

        if (
            coveragePosture?.state === 'preauthorization_required' ||
            coveragePosture?.state === 'authorization_required'
        ) {
            return [
                {
                    id: 'current-step',
                    title: 'Current step',
                    value: 'Authorization follow-up with open balance',
                    helper: 'Some settlement is posted, but authorization still needs to close against the remaining amount.',
                    badgeVariant: 'outline' as const,
                },
                {
                    id: 'next-action',
                    title: 'Next action',
                    value: 'Close authorization and post balance',
                    helper: 'Finish payer authorization, then continue the remaining settlement or claim work.',
                    badgeVariant: 'default' as const,
                },
                {
                    id: 'after-step',
                    title: 'After this step',
                    value: 'Reconciliation continues',
                    helper: 'The invoice returns to clean settlement and balance follow-up once authorization closes.',
                    badgeVariant: 'outline' as const,
                },
            ];
        }

        if (thirdPartyPhase === 'remittance_reconciliation') {
            return [
                {
                    id: 'current-step',
                    title: 'Current step',
                    value: 'Partial remittance reconciliation',
                    helper: 'Some payer or patient-share settlement is recorded, but the invoice still has a remaining balance.',
                    badgeVariant: 'secondary' as const,
                },
                {
                    id: 'next-action',
                    title: 'Next action',
                    value: primaryActionLabel ?? 'Record payment',
                    helper: 'Capture the next cumulative settlement or reconciliation adjustment.',
                    badgeVariant: 'default' as const,
                },
                {
                    id: 'after-step',
                    title: 'After this step',
                    value: 'Settlement closes when balance reaches zero',
                    helper: 'Reversals, audit review, and payer follow-up remain available afterward.',
                    badgeVariant: 'outline' as const,
                },
            ];
        }

        return [
            {
                id: 'current-step',
                title: 'Current step',
                value: 'Partial claim and settlement follow-up',
                helper: 'Claim work and settlement are both active while the third-party balance remains open.',
                badgeVariant: 'secondary' as const,
            },
            {
                id: 'next-action',
                title: 'Next action',
                value: primaryActionLabel ?? 'Record payment',
                helper: 'Capture the next cumulative settlement entry or continue payer claim follow-up.',
                badgeVariant: 'default' as const,
            },
            {
                id: 'after-step',
                title: 'After this step',
                value: 'Third-party balance closes at zero',
                helper: 'Reversals, audit review, and related payer follow-up remain available afterward.',
                badgeVariant: 'outline' as const,
            },
        ];
    }

    if (status === 'paid') {
        return [
            {
                id: 'current-step',
                title: 'Current step',
                value: 'Settlement complete',
                helper: 'The invoice is fully paid and ready for audit or reporting.',
                badgeVariant: 'default' as const,
            },
            {
                id: 'next-action',
                title: 'Next action',
                value: canViewBillingPaymentHistory.value ? 'Review payment history' : 'Review invoice summary',
                helper: 'Use payment history, reversals, or related workflows only if a correction is needed.',
                badgeVariant: 'outline' as const,
            },
            {
                id: 'after-step',
                title: 'After this step',
                value: 'Audit and downstream review only',
                helper: usesThirdPartySettlement
                    ? 'No routine payer settlement action is expected now.'
                    : 'No routine cashier action is expected now.',
                badgeVariant: 'outline' as const,
            },
        ];
    }

    return [
        {
            id: 'current-step',
            title: 'Current step',
            value: 'Workflow closed',
            helper: 'This invoice is no longer active for settlement.',
            badgeVariant: 'destructive' as const,
        },
        {
            id: 'next-action',
            title: 'Next action',
            value: 'Review closure history',
            helper: 'Use notes and audit events if the closure needs investigation.',
            badgeVariant: 'outline' as const,
        },
        {
            id: 'after-step',
            title: 'After this step',
            value: 'No additional settlement step expected',
            helper: 'Only audit review or authorized corrections should continue from here.',
            badgeVariant: 'outline' as const,
        },
    ];
});

const invoiceDetailsAuditSummary = computed(() => {
    const total = invoiceDetailsAuditLogsMeta.value?.total ?? invoiceDetailsAuditLogs.value.length;
    const userEntries = invoiceDetailsAuditLogs.value.filter(
        (log) => log.actorId !== null && log.actorId !== undefined,
    ).length;
    const systemEntries = Math.max(invoiceDetailsAuditLogs.value.length - userEntries, 0);

    return {
        total,
        userEntries,
        systemEntries,
        exportJobs:
            invoiceDetailsAuditExportJobsMeta.value?.total ??
            invoiceDetailsAuditExportJobs.value.length,
    };
});

const invoiceDetailsAuditHasActiveFilters = computed(
    () =>
        Boolean(
            invoiceDetailsAuditLogsFilters.q.trim() ||
                invoiceDetailsAuditLogsFilters.action.trim() ||
                invoiceDetailsAuditLogsFilters.actorType ||
                invoiceDetailsAuditLogsFilters.actorId.trim() ||
                invoiceDetailsAuditLogsFilters.from ||
                invoiceDetailsAuditLogsFilters.to ||
                invoiceDetailsAuditExportJobsFilters.statusGroup !== 'all',
        ),
);

const invoiceDetailsAuditActiveFilters = computed(() => {
    const active: Array<{ key: string; label: string }> = [];

    if (invoiceDetailsAuditLogsFilters.q.trim()) {
        active.push({
            key: 'q',
            label: `Search: ${invoiceDetailsAuditLogsFilters.q.trim()}`,
        });
    }
    if (invoiceDetailsAuditLogsFilters.action.trim()) {
        active.push({
            key: 'action',
            label: `Action: ${invoiceDetailsAuditLogsFilters.action.trim()}`,
        });
    }
    if (invoiceDetailsAuditLogsFilters.actorType) {
        active.push({
            key: 'actor-type',
            label: `Actor type: ${formatEnumLabel(invoiceDetailsAuditLogsFilters.actorType)}`,
        });
    }
    if (invoiceDetailsAuditLogsFilters.actorId.trim()) {
        active.push({
            key: 'actor-id',
            label: `Actor user ID: ${invoiceDetailsAuditLogsFilters.actorId.trim()}`,
        });
    }
    if (invoiceDetailsAuditLogsFilters.from || invoiceDetailsAuditLogsFilters.to) {
        active.push({
            key: 'date',
            label: `Date: ${invoiceDetailsAuditLogsFilters.from || 'Any'} -> ${invoiceDetailsAuditLogsFilters.to || 'Any'}`,
        });
    }
    if (invoiceDetailsAuditExportJobsFilters.statusGroup !== 'all') {
        active.push({
            key: 'export-status',
            label: `Export jobs: ${formatEnumLabel(invoiceDetailsAuditExportJobsFilters.statusGroup)}`,
        });
    }

    return active;
});

const invoiceAuditExportPollAttempts = 20;
const invoiceAuditExportPollDelayMs = 1500;

function triggerAuditCsvDownload(downloadUrl: string) {
    const link = document.createElement('a');
    link.href = new URL(downloadUrl, window.location.origin).toString();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function waitMs(ms: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

async function waitForInvoiceAuditExportJob(
    invoiceId: string,
    jobId: string,
): Promise<BillingInvoiceAuditExportJob> {
    let latest: BillingInvoiceAuditExportJob | null = null;

    for (let attempt = 0; attempt < invoiceAuditExportPollAttempts; attempt += 1) {
        const response = await apiRequest<BillingInvoiceAuditExportJobResponse>(
            'GET',
            `/billing-invoices/${invoiceId}/audit-logs/export-jobs/${jobId}`,
        );
        latest = response.data;
        if (latest.status === 'completed' || latest.status === 'failed') {
            return latest;
        }
        await waitMs(invoiceAuditExportPollDelayMs);
    }

    return (
        latest ??
        (
            await apiRequest<BillingInvoiceAuditExportJobResponse>(
                'GET',
                `/billing-invoices/${invoiceId}/audit-logs/export-jobs/${jobId}`,
            )
        ).data
    );
}

function downloadInvoiceAuditExportJob(job: BillingInvoiceAuditExportJob) {
    if (!job.downloadUrl) return;
    triggerAuditCsvDownload(job.downloadUrl);
}

async function retryInvoiceAuditExportJob(job: BillingInvoiceAuditExportJob) {
    if (!invoiceDetailsInvoice.value) return;
    if (invoiceDetailsAuditExportRetryingJobId.value) return;
    const invoiceId = invoiceDetailsInvoice.value.id;

    invoiceDetailsAuditExportRetryingJobId.value = job.id;
    try {
        const response = await apiRequest<BillingInvoiceAuditExportJobResponse>(
            'POST',
            `/billing-invoices/${invoiceId}/audit-logs/export-jobs/${job.id}/retry`,
        );
        notifySuccess('Audit export retry queued.');
        const createdJobId = response.data?.id ?? null;
        if (createdJobId) {
            const finalJob = await waitForInvoiceAuditExportJob(invoiceId, createdJobId);
            if (finalJob.status === 'completed' && finalJob.downloadUrl) {
                triggerAuditCsvDownload(finalJob.downloadUrl);
                notifySuccess('Audit CSV export ready. Download started.');
            } else if (finalJob.status === 'failed') {
                throw new Error(finalJob.errorMessage || 'Audit export retry failed.');
            } else {
                notifySuccess('Audit export retry is processing.');
            }
        }
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to retry audit export job.'));
    } finally {
        invoiceDetailsAuditExportRetryingJobId.value = null;
        if (invoiceDetailsInvoice.value) {
            void loadInvoiceAuditExportJobs(invoiceDetailsInvoice.value.id);
        }
    }
}

async function exportInvoiceAuditLogsCsv() {
    if (!invoiceDetailsInvoice.value) return;
    if (invoiceDetailsAuditLogsExporting.value) return;

    invoiceDetailsAuditLogsExporting.value = true;

    try {
        const invoiceId = invoiceDetailsInvoice.value.id;
        const createResponse = await apiRequest<BillingInvoiceAuditExportJobResponse>(
            'POST',
            `/billing-invoices/${invoiceId}/audit-logs/export-jobs`,
            {
                body: invoiceDetailsAuditLogsExportQuery(),
            },
        );
        const jobId = createResponse.data?.id;
        if (!jobId) {
            throw new Error('Unable to start audit export job.');
        }

        const finalJob = await waitForInvoiceAuditExportJob(invoiceId, jobId);
        if (finalJob.status === 'failed') {
            throw new Error(finalJob.errorMessage || 'Audit export job failed.');
        }
        if (finalJob.status !== 'completed' || !finalJob.downloadUrl) {
            notifySuccess('Audit CSV export queued. Retry in a moment if needed.');
            return;
        }

        triggerAuditCsvDownload(finalJob.downloadUrl);
        notifySuccess('Audit CSV export ready. Download started.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export audit entries.'));
    } finally {
        invoiceDetailsAuditLogsExporting.value = false;
        if (invoiceDetailsInvoice.value) {
            void loadInvoiceAuditExportJobs(invoiceDetailsInvoice.value.id);
        }
    }
}

function summarizeAuditExportJobs(
    jobs: Array<{ status: string | null | undefined }>,
): AuditExportJobStatusSummary {
    const summary: AuditExportJobStatusSummary = {
        total: 0,
        completed: 0,
        failed: 0,
        queued: 0,
        processing: 0,
        backlog: 0,
        other: 0,
    };

    for (const job of jobs) {
        summary.total += 1;
        const status = (job.status ?? '').toLowerCase();

        if (status === 'completed') {
            summary.completed += 1;
            continue;
        }
        if (status === 'failed') {
            summary.failed += 1;
            continue;
        }
        if (status === 'queued') {
            summary.queued += 1;
            continue;
        }
        if (status === 'processing') {
            summary.processing += 1;
            continue;
        }

        summary.other += 1;
    }

    summary.backlog = summary.queued + summary.processing;

    return summary;
}

const invoiceDetailsAuditExportJobSummary = computed(() =>
    summarizeAuditExportJobs(invoiceDetailsAuditExportJobs.value),
);

const invoiceDetailsAuditExportOpsHint = computed(() => {
    const summary = invoiceDetailsAuditExportJobSummary.value;

    if (summary.total === 0) return null;

    if (summary.failed > 0 && summary.backlog > 0) {
        return `${summary.failed} failed and ${summary.backlog} queued/processing export jobs. Retry failed jobs once, and check queue workers if backlog persists.`;
    }
    if (summary.failed > 0) {
        return `${summary.failed} failed export jobs detected. Retry failed jobs once after confirming the current audit filters are correct.`;
    }
    if (summary.backlog > 0) {
        return `${summary.backlog} export jobs are still queued/processing. Avoid repeated retries while active jobs are still running.`;
    }

    return 'Export jobs look healthy. Use Download for completed jobs and Retry only for failed jobs.';
});

function invoiceAccentClass(status: string | null): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'draft') {
        return 'border-l-4 border-l-slate-500/80 dark:border-l-slate-400/80';
    }
    if (normalized === 'issued') {
        return 'border-l-4 border-l-sky-500/80 dark:border-l-sky-400/80';
    }
    if (normalized === 'partially_paid') {
        return 'border-l-4 border-l-amber-500/80 dark:border-l-amber-400/80';
    }
    if (normalized === 'paid') {
        return 'border-l-4 border-l-emerald-500/80 dark:border-l-emerald-400/80';
    }
    if (normalized === 'cancelled' || normalized === 'voided') {
        return 'border-l-4 border-l-rose-500/80 dark:border-l-rose-400/80';
    }
    return '';
}

const scopeWarning = computed(() => {
    if (pageLoading.value) return null;
    if (!scope.value) return 'Platform access scope could not be loaded.';
    if (scope.value.resolvedFrom === 'none') {
        return 'No tenant/facility scope is resolved. Billing invoice actions may be blocked by tenant isolation controls.';
    }
    return null;
});

const visibleQueueCounts = computed(() => ({
    draft: invoices.value.filter((invoice) => invoice.status === 'draft').length,
    issued: invoices.value.filter((invoice) => invoice.status === 'issued').length,
    partiallyPaid: invoices.value.filter(
        (invoice) => invoice.status === 'partially_paid',
    ).length,
    paid: invoices.value.filter((invoice) => invoice.status === 'paid').length,
    cancelled: invoices.value.filter((invoice) => invoice.status === 'cancelled')
        .length,
    voided: invoices.value.filter((invoice) => invoice.status === 'voided').length,
    other: invoices.value.filter(
        (invoice) =>
            invoice.status !== 'draft' &&
            invoice.status !== 'issued' &&
            invoice.status !== 'partially_paid' &&
            invoice.status !== 'paid' &&
            invoice.status !== 'cancelled' &&
            invoice.status !== 'voided',
    ).length,
}));

const summaryQueueCounts = computed(() => {
    const fallbackTotal = Math.max(
        visibleQueueCounts.value.draft +
            visibleQueueCounts.value.issued +
            visibleQueueCounts.value.partiallyPaid +
            visibleQueueCounts.value.paid +
            visibleQueueCounts.value.cancelled +
            visibleQueueCounts.value.voided +
            visibleQueueCounts.value.other,
        pagination.value?.total ?? 0,
    );

    if (!billingInvoiceStatusCounts.value) {
        return {
            draft: visibleQueueCounts.value.draft,
            issued: visibleQueueCounts.value.issued,
            partiallyPaid: visibleQueueCounts.value.partiallyPaid,
            paid: visibleQueueCounts.value.paid,
            cancelled: visibleQueueCounts.value.cancelled,
            voided: visibleQueueCounts.value.voided,
            exceptions:
                visibleQueueCounts.value.cancelled +
                visibleQueueCounts.value.voided,
            total: fallbackTotal,
        };
    }

    return {
        draft: billingInvoiceStatusCounts.value.draft,
        issued: billingInvoiceStatusCounts.value.issued,
        partiallyPaid: billingInvoiceStatusCounts.value.partially_paid,
        paid: billingInvoiceStatusCounts.value.paid,
        cancelled: billingInvoiceStatusCounts.value.cancelled,
        voided: billingInvoiceStatusCounts.value.voided,
        exceptions:
            billingInvoiceStatusCounts.value.cancelled +
            billingInvoiceStatusCounts.value.voided,
        total: billingInvoiceStatusCounts.value.total,
    };
});

const financialSummaryCurrencyCode = computed(() => {
    const summaryCurrency =
        billingFinancialControlsSummary.value?.window.currencyCode?.trim() ?? '';
    if (summaryCurrency) return summaryCurrency.toUpperCase();

    const filterCurrency = searchForm.currencyCode.trim();
    if (filterCurrency) return filterCurrency.toUpperCase();

    return defaultBillingCurrencyCode.value;
});

const billingOutstandingFollowUpCount = computed(
    () => summaryQueueCounts.value.issued + summaryQueueCounts.value.partiallyPaid,
);

const billingDaybookScopeLabel = computed(() => {
    if (billingQueuePresetState.value.todayCollections) {
        return 'Collections activity posted today';
    }
    if (activePaymentActivityFilterBadgeLabel.value) {
        return activePaymentActivityFilterBadgeLabel.value;
    }
    if (activeBillingQueuePresetLabel.value) {
        return `${activeBillingQueuePresetLabel.value} queue scope`;
    }
    return 'Current billing queue scope';
});

const billingVisibleLatestPaymentAt = computed(() => {
    let latest: string | null = null;

    for (const invoice of invoices.value) {
        const candidate = invoice.lastPaymentAt;
        if (!candidate) continue;
        if (!latest || candidate > latest) {
            latest = candidate;
        }
    }

    return latest;
});

const billingVisiblePaymentActivityCount = computed(
    () =>
        invoices.value.filter((invoice) =>
            Boolean((invoice.lastPaymentAt ?? '').trim()),
        ).length,
);

const billingOperationalQueueCounts = computed(() => {
    let cashierDaybook = 0;
    let claimPrep = 0;
    let reconciliation = 0;

    for (const invoice of invoices.value) {
        const status = (invoice.status ?? '').trim().toLowerCase();
        const isOutstanding =
            status === 'issued' || status === 'partially_paid';

        if (
            billingInvoiceSettlementMode(invoice) !== 'third_party'
            && ((invoice.lastPaymentAt ?? '').trim().slice(0, 10) === today)
        ) {
            cashierDaybook += 1;
        }

        if (!isOutstanding || billingInvoiceSettlementMode(invoice) !== 'third_party') {
            continue;
        }

        if (billingInvoiceThirdPartyPhase(invoice) === 'remittance_reconciliation') {
            reconciliation += 1;
        } else {
            claimPrep += 1;
        }
    }

    return {
        cashierDaybook,
        claimPrep,
        reconciliation,
    };
});

function summarizeInvoiceMetaMix(
    values: Array<string | null | undefined>,
    emptyLabel: string,
): string {
    const counts = new Map<string, number>();

    values
        .map((value) => (value ?? '').trim())
        .filter(Boolean)
        .forEach((value) => {
            const key = value.toLowerCase();
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });

    if (counts.size === 0) return emptyLabel;

    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 2)
        .map(([value, count]) => `${formatEnumLabel(value)} (${count})`)
        .join(' | ');
}

const billingVisiblePaymentMethodMixLabel = computed(() =>
    summarizeInvoiceMetaMix(
        invoices.value.map((invoice) => invoice.lastPaymentMethod),
        'No payment method activity on this page yet.',
    ),
);

const billingVisiblePayerTypeMixLabel = computed(() =>
    summarizeInvoiceMetaMix(
        invoices.value.map((invoice) => invoice.lastPaymentPayerType),
        'No payer mix captured on this page yet.',
    ),
);

const billingDenialPressureToneClass = computed(() => {
    const deniedAmount =
        billingFinancialControlsSummary.value?.denials.deniedAmountTotal ?? 0;
    const deniedClaimCount =
        billingFinancialControlsSummary.value?.denials.deniedClaimCount ?? 0;

    if (deniedAmount > 0 || deniedClaimCount > 0) {
        return 'border-amber-500/25 bg-amber-500/5';
    }

    return 'border-emerald-500/20 bg-emerald-500/5';
});

const billingSettlementPressureToneClass = computed(() => {
    const pendingAmount =
        billingFinancialControlsSummary.value?.settlement.pendingSettlementAmount ??
        0;
    const pendingCount =
        billingFinancialControlsSummary.value?.settlement.reconciliationStatusCounts
            .pending ?? 0;

    if (pendingAmount > 0 || pendingCount > 0) {
        return 'border-primary/25 bg-primary/5';
    }

    return 'border-emerald-500/20 bg-emerald-500/5';
});

const billingOutstandingToneClass = computed(() => {
    const overdueAmount =
        billingFinancialControlsSummary.value?.outstanding.overdueBalanceAmountTotal ??
        0;
    const overdueInvoices =
        billingFinancialControlsSummary.value?.outstanding.overdueInvoiceCount ?? 0;

    if (overdueAmount > 0 || overdueInvoices > 0) {
        return 'border-amber-500/25 bg-amber-500/5';
    }

    return 'border-emerald-500/20 bg-emerald-500/5';
});

const billingDaybookToneClass = computed(() => {
    if (billingVisiblePaymentActivityCount.value > 0) {
        return 'border-emerald-500/20 bg-emerald-500/5';
    }
    if (
        billingQueuePresetState.value.todayCollections ||
        hasPaymentActivityDateFilter.value
    ) {
        return 'border-amber-500/25 bg-amber-500/5';
    }

    return 'border-sidebar-border/70';
});

const billingDaybookFocusCard = computed(() => {
    if (billingOutstandingFollowUpCount.value > 0) {
        return {
            label: 'Focus now',
            title: 'Work outstanding settlement follow-up',
            helper: billingOutstandingFollowUpCount.value + ' invoice(s) still need cashier collection or payer follow-up.',
            toneClass:
                'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
        };
    }

    if (billingVisiblePaymentActivityCount.value > 0) {
        return {
            label: 'Healthy flow',
            title: 'Collections are moving',
            helper: 'Keep today collections moving and watch for new balances that still need settlement.',
            toneClass:
                'border-emerald-200/80 border-l-4 border-l-emerald-400/70 bg-muted/20 dark:border-emerald-500/30 dark:border-l-emerald-400/50 dark:bg-muted/30',
        };
    }

    return {
        label: 'Monitor',
        title: 'No active collection movement in scope',
        helper: 'Use the queue presets to open today collections or the outstanding balance queue.',
        toneClass:
            'border-border border-l-4 border-l-muted-foreground/40 bg-muted/20 dark:border-border/80 dark:border-l-muted-foreground/50 dark:bg-muted/30',
    };
});

const billingDenialFocusCard = computed(() => {
    const deniedClaimCount = billingFinancialControlsSummary.value?.denials.deniedClaimCount ?? 0;
    const partialDeniedClaimCount =
        billingFinancialControlsSummary.value?.denials.partialDeniedClaimCount ?? 0;

    if (deniedClaimCount > 0 || partialDeniedClaimCount > 0) {
        return {
            label: 'Focus now',
            title: 'Work the denial and rework backlog',
            helper: 'Rejected and partial claims need follow-up before revenue leakage grows.',
            toneClass:
                'border-amber-200/80 border-l-4 border-l-amber-400/70 bg-muted/20 dark:border-amber-500/30 dark:border-l-amber-400/50 dark:bg-muted/30',
        };
    }

    return {
        label: 'Stable',
        title: 'No active denial pressure in scope',
        helper: 'Current reporting scope shows no rejected or partial denial backlog that needs attention.',
        toneClass:
            'border-emerald-200/80 border-l-4 border-l-emerald-400/70 bg-muted/20 dark:border-emerald-500/30 dark:border-l-emerald-400/50 dark:bg-muted/30',
    };
});

const billingSettlementFocusCard = computed(() => {
    const pendingCount =
        billingFinancialControlsSummary.value?.settlement.reconciliationStatusCounts
            .pending ?? 0;
    const pendingAmount =
        billingFinancialControlsSummary.value?.settlement.pendingSettlementAmount ?? 0;

    if (pendingCount > 0 || pendingAmount > 0) {
        return {
            label: 'Focus now',
            title: 'Clear pending reconciliation work',
            helper: 'Approved claims still need settlement posting or exception handling before closure.',
            toneClass:
                'border-sky-200/80 border-l-4 border-l-sky-400/70 bg-muted/20 dark:border-sky-500/30 dark:border-l-sky-400/50 dark:bg-muted/30',
        };
    }

    return {
        label: 'Healthy',
        title: 'Settlement is flowing cleanly',
        helper: 'No meaningful reconciliation backlog is visible in the current billing reporting scope.',
        toneClass:
            'border-emerald-200/80 border-l-4 border-l-emerald-400/70 bg-muted/20 dark:border-emerald-500/30 dark:border-l-emerald-400/50 dark:bg-muted/30',
    };
});

const billingClaimsRejectedHref = computed(() => '/claims-insurance?status=rejected');
const billingClaimsPartialDenialsHref = computed(
    () => '/claims-insurance?status=partial',
);
const billingClaimsPendingSettlementHref = computed(
    () => '/claims-insurance?reconciliationStatus=pending',
);
const billingClaimsOpenExceptionsHref = computed(
    () => '/claims-insurance?reconciliationExceptionStatus=open',
);

const billingFinancialControlsWindowLabel = computed(() => {
    const window = billingFinancialControlsSummary.value?.window;
    if (!window) return 'Current billing filter window';

    const from = (window.from ?? '').trim();
    const to = (window.to ?? '').trim();

    if (from && to) {
        return from === to ? `Window: ${from}` : `Window: ${from} to ${to}`;
    }
    if (from) return `Window from ${from}`;
    if (to) return `Window through ${to}`;
    return 'Current billing filter window';
});

const billingFinancialControlsAsOfLabel = computed(() => {
    const asOf = billingFinancialControlsSummary.value?.window.asOf;
    return asOf ? `As of ${formatDateTime(asOf)}` : 'Latest financial-controls snapshot';
});

type BillingAgingBucketRow = {
    key: string;
    label: string;
    invoiceCount: number;
    balanceAmountTotal: number;
    barWidthPercent: number;
    barClass: string;
};

const billingAgingBucketRows = computed<BillingAgingBucketRow[]>(() => {
    const agingBuckets = billingFinancialControlsSummary.value?.agingBuckets;
    if (!agingBuckets) return [];

    const rawRows = [
        {
            key: 'current',
            label: 'Current',
            invoiceCount: agingBuckets.current.invoiceCount,
            balanceAmountTotal: agingBuckets.current.balanceAmountTotal,
            barClass: 'bg-emerald-500/70',
        },
        {
            key: 'days_1_30',
            label: '1-30 days',
            invoiceCount: agingBuckets.days_1_30.invoiceCount,
            balanceAmountTotal: agingBuckets.days_1_30.balanceAmountTotal,
            barClass: 'bg-sky-500/70',
        },
        {
            key: 'days_31_60',
            label: '31-60 days',
            invoiceCount: agingBuckets.days_31_60.invoiceCount,
            balanceAmountTotal: agingBuckets.days_31_60.balanceAmountTotal,
            barClass: 'bg-amber-500/70',
        },
        {
            key: 'days_61_90',
            label: '61-90 days',
            invoiceCount: agingBuckets.days_61_90.invoiceCount,
            balanceAmountTotal: agingBuckets.days_61_90.balanceAmountTotal,
            barClass: 'bg-orange-500/70',
        },
        {
            key: 'days_over_90',
            label: 'Over 90 days',
            invoiceCount: agingBuckets.days_over_90.invoiceCount,
            balanceAmountTotal: agingBuckets.days_over_90.balanceAmountTotal,
            barClass: 'bg-rose-500/70',
        },
    ];

    const maxAmount = Math.max(
        ...rawRows.map((row) => row.balanceAmountTotal),
        0,
    );

    return rawRows.map((row) => ({
        ...row,
        barWidthPercent:
            maxAmount > 0
                ? Math.max(
                      8,
                      Math.min(100, (row.balanceAmountTotal / maxAmount) * 100),
                  )
                : 0,
    }));
});

const statusSelectValue = computed({
    get: () => searchForm.status || 'all',
    set: (v: string) => {
        searchForm.status = v === 'all' ? '' : v;
        searchForm.page = 1;
        void reloadQueueAndSummary();
    },
});

function updateBillingQueueStatusValue(value: string) {
    statusSelectValue.value = value;
}

function handleBillingQueueStatusAction(payload: {
    invoice: BillingInvoice;
    action: BillingInvoiceStatusAction;
}) {
    openInvoiceStatusDialog(payload.invoice, payload.action);
}

const hasActiveFilters = computed(() =>
    Boolean(
            searchForm.q.trim() ||
            searchForm.patientId.trim() ||
            searchForm.status ||
            searchForm.statusIn.length > 0 ||
            searchForm.currencyCode.trim() ||
            searchForm.to ||
            searchForm.paymentActivityFrom ||
            searchForm.paymentActivityTo ||
            searchForm.from !== today,
    ),
);

const hasAdvancedFilters = computed(() =>
    Boolean(
        searchForm.patientId.trim() ||
            searchForm.currencyCode.trim() ||
            searchForm.to ||
            searchForm.from !== today ||
            searchForm.paymentActivityFrom ||
            searchForm.paymentActivityTo,
    ),
);

const activeBillingAdvancedFilterCount = computed(() => {
    let count = 0;
    if (searchForm.patientId.trim()) count += 1;
    if (searchForm.currencyCode.trim()) count += 1;
    if (searchForm.from !== today || searchForm.to) count += 1;
    if (
        searchForm.paymentActivityFrom.trim() ||
        searchForm.paymentActivityTo.trim()
    ) {
        count += 1;
    }
    return count;
});

const createActivePatientSummary = computed<PatientSummary | null>(() => {
    const id = createForm.patientId.trim();
    if (!id) return null;
    return patientDirectory.value[id] ?? null;
});

const hasCreateAppointmentContext = computed(
    () => createForm.appointmentId.trim().length > 0,
);
const hasCreateAdmissionContext = computed(
    () => createForm.admissionId.trim().length > 0,
);
const activeBillingAppointmentStatuses = Object.freeze([
    'checked_in',
    'waiting_triage',
    'waiting_provider',
    'in_consultation',
]);

const createPatientContextLabel = computed(() => {
    const patientId = createForm.patientId.trim();
    if (!patientId) return 'Select patient';
    if (createActivePatientSummary.value) {
        return patientName(createActivePatientSummary.value);
    }
    if (isUnavailablePatientId(patientId)) {
        return 'Unavailable patient';
    }
    if (pendingPatientLookupIds.has(patientId)) {
        return 'Loading patient...';
    }
    return shortId(patientId);
});

const createPatientContextMeta = computed(() => {
    const patientId = createForm.patientId.trim();
    if (!patientId) {
        return 'Search and select the patient first, then confirm any appointment or admission billing handoff.';
    }

    if (isUnavailablePatientId(patientId)) {
        return 'This patient record is no longer available. Select another patient to continue billing.';
    }

    const parts = [
        createActivePatientSummary.value?.patientNumber
            ? `Patient No. ${createActivePatientSummary.value.patientNumber}`
            : null,
    ].filter(Boolean);

    if (openedFromClinicalContext.value) {
        parts.push('Linked from clinical handoff');
    }

    return parts.length > 0
        ? parts.join(' | ')
        : `Patient record ${shortId(patientId)} is attached to this invoice.`;
});

const createAppointmentContextLabel = computed(() => {
    const number = createAppointmentSummary.value?.appointmentNumber?.trim();
    if (number) return number;
    if (hasCreateAppointmentContext.value) return 'Linked appointment';
    return 'No appointment linked';
});

const createAppointmentContextMeta = computed(() => {
    if (createAppointmentSummaryLoading.value) {
        return 'Loading appointment summary...';
    }
    if (createAppointmentSummaryError.value) {
        return createAppointmentSummaryError.value;
    }
    if (!createAppointmentSummary.value) {
        if (
            !hasCreateAppointmentContext.value &&
            createAppointmentSuggestionsLoading.value
        ) {
            return 'Checking for active outpatient appointments...';
        }
        if (
            !hasCreateAppointmentContext.value &&
            createAppointmentSuggestions.value.length > 1
        ) {
            return `${createAppointmentSuggestions.value.length} active outpatient visits found. Review the context editor and choose one.`;
        }
        return hasCreateAppointmentContext.value
            ? 'Appointment summary will appear once the link is resolved.'
            : 'Optional. Link the active outpatient visit when this invoice belongs to the current patient encounter.';
    }

    const parts = [
        createAppointmentSummary.value.scheduledAt
            ? formatDateTime(createAppointmentSummary.value.scheduledAt)
            : null,
        createAppointmentSummary.value.department?.trim() || null,
    ].filter(Boolean);

    if (createAppointmentLinkSource.value === 'auto') {
        parts.push('Auto-linked from active patient context');
    } else if (createAppointmentLinkSource.value === 'route') {
        parts.push('Linked from clinical handoff');
    } else if (createAppointmentLinkSource.value === 'manual') {
        parts.push('Chosen in context editor');
    }

    return parts.join(' | ');
});

const createAppointmentContextReason = computed(() => {
    const value = createAppointmentSummary.value?.reason?.trim();
    return value ? `Reason: ${value}` : null;
});

const createAppointmentContextStatusLabel = computed(() => {
    if (createAppointmentSummaryLoading.value) return 'Loading';
    const status = createAppointmentSummary.value?.status?.trim();
    if (!status) {
        return hasCreateAppointmentContext.value ? 'Linked' : null;
    }
    if (status.toLowerCase() === 'checked_in') return 'Checked In';
    return formatEnumLabel(status);
});

const createAppointmentContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    const status = createAppointmentSummary.value?.status?.trim().toLowerCase() ?? '';
    if (status === 'checked_in' || status === 'completed') return 'default';
    if (status === 'scheduled') return 'secondary';
    if (status === 'cancelled' || status === 'no_show') return 'destructive';
    return 'outline';
});

const createAppointmentContextSourceLabel = computed(() => {
    if (!hasCreateAppointmentContext.value) return null;
    if (createAppointmentLinkSource.value === 'auto') return 'Auto-linked';
    if (createAppointmentLinkSource.value === 'route') return 'Route context';
    if (createAppointmentLinkSource.value === 'manual') return 'Chosen';
    return null;
});

const createAdmissionContextLabel = computed(() => {
    const number = createAdmissionSummary.value?.admissionNumber?.trim();
    if (number) return number;
    if (hasCreateAdmissionContext.value) return 'Linked admission';
    return 'No admission linked';
});

const createAdmissionContextMeta = computed(() => {
    if (createAdmissionSummaryLoading.value) {
        return 'Loading admission summary...';
    }
    if (createAdmissionSummaryError.value) {
        return createAdmissionSummaryError.value;
    }
    if (!createAdmissionSummary.value) {
        if (
            !hasCreateAdmissionContext.value &&
            createAdmissionSuggestionsLoading.value
        ) {
            return 'Checking for active admissions...';
        }
        if (
            !hasCreateAdmissionContext.value &&
            createAdmissionSuggestions.value.length > 1
        ) {
            return `${createAdmissionSuggestions.value.length} active admissions found. Review the context editor and choose one.`;
        }
        return hasCreateAdmissionContext.value
            ? 'Admission summary will appear once the link is resolved.'
            : 'Optional. Link the admitted stay when this invoice belongs to an inpatient episode.';
    }

    const parts = [
        createAdmissionSummary.value.admittedAt
            ? formatDateTime(createAdmissionSummary.value.admittedAt)
            : null,
        createAdmissionSummary.value.ward?.trim() || null,
        createAdmissionSummary.value.bed?.trim() || null,
    ].filter(Boolean);

    if (createAdmissionLinkSource.value === 'auto') {
        parts.push('Auto-linked from active patient context');
    } else if (createAdmissionLinkSource.value === 'route') {
        parts.push('Linked from clinical handoff');
    } else if (createAdmissionLinkSource.value === 'manual') {
        parts.push('Chosen in context editor');
    }

    return parts.join(' | ');
});

const createAdmissionContextReason = computed(() => {
    const value = createAdmissionSummary.value?.statusReason?.trim();
    return value ? `Status note: ${value}` : null;
});

const createAdmissionContextStatusLabel = computed(() => {
    if (createAdmissionSummaryLoading.value) return 'Loading';
    const status = createAdmissionSummary.value?.status?.trim();
    if (!status) {
        return hasCreateAdmissionContext.value ? 'Linked' : null;
    }
    if (status.toLowerCase() === 'admitted') return 'Admitted';
    return formatEnumLabel(status);
});

const createAdmissionContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    const status = createAdmissionSummary.value?.status?.trim().toLowerCase() ?? '';
    if (status === 'admitted') return 'default';
    if (status === 'discharged' || status === 'transferred') return 'secondary';
    if (status === 'cancelled') return 'destructive';
    return 'outline';
});

const createAdmissionContextSourceLabel = computed(() => {
    if (!hasCreateAdmissionContext.value) return null;
    if (createAdmissionLinkSource.value === 'auto') return 'Auto-linked';
    if (createAdmissionLinkSource.value === 'route') return 'Route context';
    if (createAdmissionLinkSource.value === 'manual') return 'Chosen';
    return null;
});

const createContextEditorDescription = computed(() => {
    switch (createContextEditorTab.value) {
        case 'appointment':
            return createForm.patientId.trim()
                ? 'Review the checked-in appointment or search manually for a different outpatient billing handoff.'
                : 'Select a patient first, then optionally link the checked-in appointment.';
        case 'admission':
            return createForm.patientId.trim()
                ? 'Review the admitted stay or search manually for a different inpatient billing handoff.'
                : 'Select a patient first, then optionally link the admission.';
        default:
            return createPatientContextLocked.value
                ? 'Patient is locked from the selected clinical handoff until you choose a different patient.'
                : 'Search and confirm the patient before entering invoice details.';
    }
});

const createOrderContextSummary = computed(() => {
    if (!createForm.patientId.trim()) {
        return 'Select the patient first, then optionally link the checked-in appointment or admission before adding invoice lines.';
    }

    const parts = [createPatientContextLabel.value];

    if (hasCreateAppointmentContext.value) {
        parts.push(createAppointmentContextLabel.value);
    }

    if (hasCreateAdmissionContext.value) {
        parts.push(createAdmissionContextLabel.value);
    }

    if (!hasCreateAppointmentContext.value && !hasCreateAdmissionContext.value) {
        parts.push('No visit context linked');
    }

    if (openedFromClinicalContext.value) {
        parts.push('Clinical handoff preserved');
    }

    return parts.join(' | ');
});

const hasCreateFeedback = computed(() =>
    Object.values(createErrors.value).some((messages) => messages.length > 0),
);

const activePatientSummary = computed<PatientSummary | null>(() => {
    const id = searchForm.patientId.trim();
    if (!id) return null;
    return patientDirectory.value[id] ?? null;
});
const activeBillingPatientFocus = computed(() => {
    const id = searchForm.patientId.trim();
    if (!id) return null;

    const summary = activePatientSummary.value;
    return {
        label: summary
            ? patientName(summary)
            : isUnavailablePatientId(id)
              ? 'Unavailable patient'
              : pendingPatientLookupIds.has(id)
                ? 'Loading patient...'
                : shortId(id),
        number: summary?.patientNumber
            || (isUnavailablePatientId(id) ? 'Removed record' : shortId(id)),
    };
});

const billingQueueLaneCounts = computed(() => {
    let cashierCollection = 0;
    let thirdPartySettlement = 0;

    for (const invoice of invoices.value) {
        if (billingInvoiceSettlementMode(invoice) === 'third_party') {
            thirdPartySettlement += 1;
        } else {
            cashierCollection += 1;
        }
    }

    return {
        all: invoices.value.length,
        cashierCollection,
        thirdPartySettlement,
    };
});

const billingQueueThirdPartyPhaseCounts = computed(() => {
    let claimSubmission = 0;
    let remittanceReconciliation = 0;

    for (const invoice of invoices.value) {
        if (billingInvoiceSettlementMode(invoice) !== 'third_party') continue;

        if (billingInvoiceThirdPartyPhase(invoice) === 'remittance_reconciliation') {
            remittanceReconciliation += 1;
        } else {
            claimSubmission += 1;
        }
    }

    return {
        all: billingQueueLaneCounts.value.thirdPartySettlement,
        claimSubmission,
        remittanceReconciliation,
    };
});

const visibleBillingQueueInvoices = computed(() =>
    invoices.value.filter((invoice) => {
        if (!billingInvoiceMatchesQueueLaneFilter(invoice, billingQueueLaneFilter.value)) {
            return false;
        }

        if (billingQueueLaneFilter.value !== 'third_party_settlement') {
            return true;
        }

        return billingInvoiceMatchesThirdPartyPhaseFilter(
            invoice,
            billingQueueThirdPartyPhaseFilter.value,
        );
    }),
);

const billingQueueLaneFilterLabel = computed(() => {
    if (billingQueueLaneFilter.value === 'cashier_collection') {
        return 'Cashier collection';
    }

    if (billingQueueLaneFilter.value === 'third_party_settlement') {
        return 'Third-party settlement';
    }

    return null;
});

const billingQueueThirdPartyPhaseFilterLabel = computed(() => {
    if (billingQueueThirdPartyPhaseFilter.value === 'claim_submission') {
        return 'Claim prep & submission';
    }

    if (billingQueueThirdPartyPhaseFilter.value === 'remittance_reconciliation') {
        return 'Remittance & reconciliation';
    }

    return null;
});

const hasVisibleBillingQueueScopeBadges = computed(
    () =>
        hasAdvancedFilters.value
        || billingQueueLaneFilter.value !== 'all'
        || billingQueueThirdPartyPhaseFilter.value !== 'all',
);

function normalizedStatusInSelection(): string[] {
    return [...new Set(searchForm.statusIn.map((value) => value.trim()).filter(Boolean))].sort();
}

function matchesBillingPreset(options: {
    status?: string;
    statusIn?: string[];
    paymentActivityFrom?: string;
    paymentActivityTo?: string;
}): boolean {
    if (searchForm.q.trim()) return false;
    if (searchForm.patientId.trim()) return false;
    if (searchForm.currencyCode.trim()) return false;
    if ((options.paymentActivityFrom ?? '') !== searchForm.paymentActivityFrom) {
        return false;
    }
    if ((options.paymentActivityTo ?? '') !== searchForm.paymentActivityTo) {
        return false;
    }

    if (!options.paymentActivityFrom && !options.paymentActivityTo) {
        if (searchForm.to) return false;
        if (searchForm.from !== today) return false;
    } else {
        if (searchForm.from) return false;
        if (searchForm.to) return false;
    }

    const selectedStatusIn = normalizedStatusInSelection();
    const expectedStatusIn = [...new Set((options.statusIn ?? []).map((value) => value.trim()).filter(Boolean))].sort();

    if ((options.status ?? '') !== searchForm.status) return false;
    if (selectedStatusIn.length !== expectedStatusIn.length) return false;

    return selectedStatusIn.every((value, index) => value === expectedStatusIn[index]);
}

const billingQueuePresetState = computed(() => ({
    todayCollections: matchesBillingPreset({
        paymentActivityFrom: today,
        paymentActivityTo: today,
    }),
    outstanding: matchesBillingPreset({ statusIn: ['issued', 'partially_paid'] }),
    draft: matchesBillingPreset({ status: 'draft' }),
    issued: matchesBillingPreset({ status: 'issued' }),
    partiallyPaid: matchesBillingPreset({ status: 'partially_paid' }),
    paid: matchesBillingPreset({ status: 'paid' }),
    voided: matchesBillingPreset({ status: 'voided' }),
}));

const billingOperationalPresetState = computed(() => ({
    cashierDaybook:
        billingQueuePresetState.value.todayCollections
        && billingQueueLaneFilter.value === 'cashier_collection',
    claimPrep:
        billingQueuePresetState.value.outstanding
        && billingQueueLaneFilter.value === 'third_party_settlement'
        && billingQueueThirdPartyPhaseFilter.value === 'claim_submission',
    reconciliation:
        billingQueuePresetState.value.outstanding
        && billingQueueLaneFilter.value === 'third_party_settlement'
        && billingQueueThirdPartyPhaseFilter.value === 'remittance_reconciliation',
}));

const activeBillingQueuePresetLabel = computed(() => {
    if (billingOperationalPresetState.value.cashierDaybook) return 'Cashier Daybook';
    if (billingOperationalPresetState.value.claimPrep) return 'Claim Prep Backlog';
    if (billingOperationalPresetState.value.reconciliation) {
        return 'Reconciliation Backlog';
    }
    if (billingQueuePresetState.value.todayCollections) return 'Today Collections';
    if (billingQueuePresetState.value.outstanding) return 'Outstanding';
    if (billingQueuePresetState.value.draft) return 'Draft';
    if (billingQueuePresetState.value.issued) return 'Issued';
    if (billingQueuePresetState.value.partiallyPaid) return 'Partially Paid';
    if (billingQueuePresetState.value.paid) return 'Paid';
    if (billingQueuePresetState.value.voided) return 'Voided';
    return null;
});

const billingQueueStateLabel = computed(() => {
    const laneScope = [
        billingQueueLaneFilterLabel.value,
        billingQueueThirdPartyPhaseFilterLabel.value,
    ].filter(Boolean).join(' | ');

    if (activeBillingQueuePresetLabel.value && laneScope) {
        return `${activeBillingQueuePresetLabel.value} | ${laneScope}`;
    }
    if (activeBillingQueuePresetLabel.value) return activeBillingQueuePresetLabel.value;
    if (laneScope) return laneScope;
    if (isBillingSummaryStatusSetFilterActive(['cancelled', 'voided'])) {
        return 'Exceptions';
    }
    if (activeBillingPatientFocus.value) return 'Patient filtered';
    if (hasActiveFilters.value) return 'Filtered';
    return 'Billing Queue';
});

const billingWorkspaceHeaderDescription = computed(() => {
    if (pageLoading.value) {
        return 'Loading billing workspace and restoring the current scope.';
    }

    if (billingWorkspaceView.value === 'create') {
        return 'Create and issue OPD invoices without losing patient context.';
    }

    if (billingWorkspaceView.value === 'board') {
        return 'Monitor collections, denial pressure, and settlement reconciliation without crowding the queue.';
    }

    return 'Review cashier queues, payments, and invoice follow-up in one place.';
});

const billingWorkspaceHeaderScopeLabel = computed(() => {
    if (pageLoading.value) {
        return 'Loading Scope';
    }

    if (!scope.value) {
        return 'Scope Unavailable';
    }

    if (scope.value.resolvedFrom === 'none') {
        return 'Scope Unresolved';
    }

    return 'Scope Ready';
});

const billingQueueScopeSummary = computed(() => {
    if (billingOperationalPresetState.value.cashierDaybook) {
        return 'Today cash and patient-share postings that still need cashier execution or confirmation.';
    }
    if (billingOperationalPresetState.value.claimPrep) {
        return 'Third-party invoices currently moving through claim prep, submission readiness, and payer follow-up.';
    }
    if (billingOperationalPresetState.value.reconciliation) {
        return 'Third-party invoices waiting on remittance matching, settlement cleanup, or remaining balance follow-up.';
    }
    if (billingQueuePresetState.value.outstanding) {
        return 'Open invoices that still need cashier collection, payer follow-up, or reconciliation work.';
    }
    if (billingQueuePresetState.value.draft) {
        return 'Draft invoices still being prepared before they enter cashier or payer execution.';
    }
    if (activeBillingPatientFocus.value) {
        return 'Queue narrowed to one patient context so billing staff can work one episode cleanly.';
    }
    if (hasActiveFilters.value) {
        return 'Queue narrowed by the current billing filters and workboard scope.';
    }
    return 'Live billing queue across cashier collection, claim prep, and remittance follow-up.';
});

const billingQueueFilterSummary = computed(() => {
    const parts: string[] = [];

    if (searchForm.patientId.trim()) {
        parts.push('Patient selected');
    }
    if (searchForm.currencyCode.trim()) {
        parts.push(`Currency ${searchForm.currencyCode.trim().toUpperCase()}`);
    }
    if (searchForm.from !== today || searchForm.to) {
        parts.push('Invoice date active');
    }
    if (searchForm.paymentActivityFrom.trim() || searchForm.paymentActivityTo.trim()) {
        parts.push('Payment activity active');
    }

    return parts.length > 0 ? parts.join(' | ') : 'No extra work filters applied';
});

const billingQueueToolbarSummary = computed(() => {
    const parts: string[] = [];
    const searchTerm = searchForm.q.trim();
    const selectedStatuses = normalizedStatusInSelection();
    const perPage = pagination.value?.perPage ?? 10;

    parts.push(
        searchTerm
            ? `Search: "${searchTerm}"`
            : 'Search all invoices',
    );

    if (searchForm.status.trim()) {
        parts.push(`Queue status: ${formatEnumLabel(searchForm.status)}`);
    } else if (selectedStatuses.length > 0) {
        parts.push(`Queue status set: ${selectedStatuses.map((status) => formatEnumLabel(status)).join(', ')}`);
    } else {
        parts.push('Queue status: all');
    }

    parts.push(`${perPage} rows per page`);
    parts.push(compactQueueRows.value ? 'Compact rows' : 'Comfortable rows');

    if (activeBillingAdvancedFilterCount.value > 0) {
        parts.push(`${activeBillingAdvancedFilterCount.value} work filter${activeBillingAdvancedFilterCount.value === 1 ? '' : 's'}`);
    }

    return parts.join(' | ');
});

const billingFilterBadgeCount = computed(() => {
    let count = 0;
    if (searchForm.patientId.trim()) count += 1;
    if (searchForm.status || searchForm.statusIn.length > 0) count += 1;
    if (searchForm.currencyCode.trim()) count += 1;
    if (searchForm.from !== today || searchForm.to) count += 1;
    if (
        searchForm.paymentActivityFrom.trim() ||
        searchForm.paymentActivityTo.trim()
    ) {
        count += 1;
    }

    return count;
});

const hasPaymentActivityDateFilter = computed(
    () =>
        Boolean(
            searchForm.paymentActivityFrom.trim() ||
                searchForm.paymentActivityTo.trim(),
        ),
);

const activePaymentActivityFilterBadgeLabel = computed(() => {
    if (!hasPaymentActivityDateFilter.value) return null;
    if (activeBillingQueuePresetLabel.value === 'Today Collections') return null;

    const from = searchForm.paymentActivityFrom.trim();
    const to = searchForm.paymentActivityTo.trim();

    if (from && to && from === to) {
        return `Collections: ${from}`;
    }

    return 'Collections Date Active';
});

watch(
    () => createForm.currencyCode,
    (value, previousValue) => {
        const currentCurrency = value.trim().toUpperCase();
        const previousCurrency = (previousValue ?? '').trim().toUpperCase();
        if (currentCurrency === previousCurrency) return;

        if (
            billingWorkspaceView.value !== 'create' &&
            !billingCreateBootstrapComplete.value
        ) {
            return;
        }

        billingCreateBootstrapComplete.value = false;
        void loadBillingServiceCatalog();
        if (billingWorkspaceView.value === 'create') {
            void loadBillingChargeCaptureCandidates();
        }
    },
);

watch(
    () => createForm.patientId,
    (value, previousValue) => {
        const patientId = value.trim();
        const previousPatientId = (previousValue ?? '').trim();
        if (patientId === previousPatientId) return;

        createCoverageModeOverride.value = null;

        createContextAutoLinkSuppressed.appointment = false;
        createContextAutoLinkSuppressed.admission = false;

        if (!patientId) {
            clearCreateAppointmentLink({
                suppressAuto: false,
                focusEditor: false,
            });
            clearCreateAdmissionLink({
                suppressAuto: false,
                focusEditor: false,
            });
            resetCreateContextSuggestions();
            createContextEditorTab.value = 'patient';
            billingChargeCaptureCandidates.value = [];
            billingChargeCaptureMeta.value = null;
            billingChargeCaptureError.value = null;
            importedChargeCaptureCandidateIds.value = [];
            createInvoiceStage.value = 'context';
            createLineItemWorkspaceTab.value = 'compose';
            return;
        }

        if (!previousPatientId) {
            createLineItemWorkspaceTab.value = 'capture';
        }

        if (previousPatientId && previousPatientId !== patientId) {
            clearCreateAppointmentLink({
                suppressAuto: false,
                focusEditor: false,
            });
            clearCreateAdmissionLink({
                suppressAuto: false,
                focusEditor: false,
            });
        }

        void hydratePatientSummary(patientId);
        void loadCreateContextSuggestions(patientId);
        if (billingWorkspaceView.value === 'create') {
            void loadBillingChargeCaptureCandidates();
        }
    },
    { immediate: true },
);

watch(
    () => createForm.appointmentId,
    (value, previousValue) => {
        const appointmentId = value.trim();
        if (appointmentId === (previousValue ?? '').trim()) return;

        createCoverageModeOverride.value = null;

        if (pendingCreateAppointmentLinkSource !== null) {
            createAppointmentLinkSource.value = pendingCreateAppointmentLinkSource;
            pendingCreateAppointmentLinkSource = null;
        } else if (!appointmentId) {
            createAppointmentLinkSource.value = 'none';
        } else if (createAppointmentLinkSource.value !== 'route') {
            createAppointmentLinkSource.value = 'manual';
        }

        void loadCreateAppointmentSummary(appointmentId);
        if (billingWorkspaceView.value === 'create') {
            void loadBillingChargeCaptureCandidates();
        }
    },
    { immediate: true },
);

watch(
    () => createForm.admissionId,
    (value, previousValue) => {
        const admissionId = value.trim();
        if (admissionId === (previousValue ?? '').trim()) return;

        createCoverageModeOverride.value = null;

        if (pendingCreateAdmissionLinkSource !== null) {
            createAdmissionLinkSource.value = pendingCreateAdmissionLinkSource;
            pendingCreateAdmissionLinkSource = null;
        } else if (!admissionId) {
            createAdmissionLinkSource.value = 'none';
        } else if (createAdmissionLinkSource.value !== 'route') {
            createAdmissionLinkSource.value = 'manual';
        }

        void loadCreateAdmissionSummary(admissionId);
        if (billingWorkspaceView.value === 'create') {
            void loadBillingChargeCaptureCandidates();
        }
    },
    { immediate: true },
);

watch(
    () => createForm.lineItems.map((item) => item.key).join('|'),
    () => {
        ensureActiveCreateLineItem();
    },
    { immediate: true },
);

watch(
    () =>
        createForm.lineItems
            .map((item) => `${item.sourceWorkflowKind.trim()}:${item.sourceWorkflowId.trim()}`)
            .join('|'),
    () => {
        syncImportedChargeCaptureCandidateIdsFromLineItems();
    },
    { immediate: true },
);

watch(
    [() => billingWorkspaceView.value, createBillingDraftPreviewSignature],
    ([workspaceView, signature]) => {
        if (workspaceView !== 'create' || !signature) {
            resetCreateBillingDraftPreview();
            return;
        }

        clearCreateBillingDraftPreviewDebounce();
        createBillingDraftPreviewRequestKey = signature;
        createBillingDraftPreviewError.value = null;
        createBillingDraftPreviewDebounceTimer = window.setTimeout(() => {
            createBillingDraftPreviewDebounceTimer = null;
            void loadCreateBillingDraftPreview(signature);
        }, 300);
    },
    { immediate: true },
);

watch(
    createContextActiveDraftSignature,
    (signature) => {
        if (!signature) {
            clearCreateContextActiveDraftDebounce();
            createContextActiveDraftRequestKey = '';
            resetCreateContextActiveDraftLookup();
            return;
        }

        clearCreateContextActiveDraftDebounce();
        createContextActiveDraftRequestKey = signature;
        createContextActiveDraftDebounceTimer = window.setTimeout(() => {
            createContextActiveDraftDebounceTimer = null;
            void loadCreateContextActiveDraft(signature);
        }, 250);
    },
    { immediate: true },
);

watch(
    [editDialogOpen, editBillingDraftPreviewSignature],
    ([isOpen, signature]) => {
        if (!isOpen || !signature) {
            resetEditBillingDraftPreview();
            return;
        }

        clearEditBillingDraftPreviewDebounce();
        editBillingDraftPreviewRequestKey = signature;
        editBillingDraftPreviewError.value = null;
        editBillingDraftPreviewDebounceTimer = window.setTimeout(() => {
            editBillingDraftPreviewDebounceTimer = null;
            void loadEditBillingDraftPreview(signature);
        }, 300);
    },
    { immediate: true },
);

watch(createContextDialogOpen, (isOpen) => {
    if (!isOpen) return;

    createContextDialogInitialSelection.patientId = createForm.patientId.trim();
    createContextDialogInitialSelection.appointmentId =
        createForm.appointmentId.trim();
    createContextDialogInitialSelection.admissionId =
        createForm.admissionId.trim();
});

watch(
    () => searchForm.patientId,
    (value) => {
        const patientId = value.trim();
        if (!patientId) return;

        void hydratePatientSummary(patientId);
    },
    { immediate: true },
);

watch(
    () => searchForm.q,
    (value, previousValue) => {
        const currentQuery = value.trim();
        const previousQuery = (previousValue ?? '').trim();
        if (currentQuery === previousQuery) return;

        clearSearchDebounce();
        searchDebounceTimer = window.setTimeout(() => {
            searchForm.page = 1;
            void reloadQueueAndSummary();
            searchDebounceTimer = null;
        }, 350);
    },
);

watch(
    () => searchForm.status,
    (value) => {
        if (value && searchForm.statusIn.length > 0) {
            searchForm.statusIn = [];
        }
    },
);

const statusDialogState = {
    statusDialogOpen,
    statusDialogInvoice,
    statusDialogAction,
    statusDialogReason,
    statusDialogPaidAmount,
    statusDialogPaymentPayerType,
    statusDialogPaymentMethod,
    statusDialogPaymentReference,
    statusDialogPaymentNote,
    statusDialogPaymentAtDate,
    statusDialogPaymentAtTime,
    statusDialogAdvancedSupportOpen,
    statusDialogReferenceDiagnosticsOpen,
    statusDialogReferenceCopyToolsOpen,
    billingClaimReferenceMergePreviewFullPreservedKeysChunkJumpTarget,
};

const statusDialogView = {
    actionLoadingId,
    billingClaimReferenceMergePreviewCopyChunkTargetBytes,
    billingClaimReferenceMergePreviewFullPreservedKeysChunkError,
    billingClaimReferenceMergePreviewFullPreservedKeysChunkMessage,
    billingClaimReferenceMergePreviewFullPreservedKeysError,
    billingClaimReferenceMergePreviewFullPreservedKeysJsonError,
    billingClaimReferenceMergePreviewFullPreservedKeysJsonMessage,
    billingClaimReferenceMergePreviewFullPreservedKeysMessage,
    billingClaimReferenceMergePreviewPreservedKeysPreviewLimit,
    billingClaimReferenceOverrideEnvelopeError,
    billingClaimReferenceOverrideEnvelopeMessage,
    billingClaimReferenceOverrideMergeSafeEnvError,
    billingClaimReferenceOverrideMergeSafeEnvMessage,
    billingClaimReferenceOverrideShellExportsError,
    billingClaimReferenceOverrideShellExportsMessage,
    billingClaimReferenceOverrideSnippetError,
    billingClaimReferenceOverrideSnippetMessage,
    billingClaimReferenceTelemetrySnapshotError,
    billingClaimReferenceTelemetrySnapshotMessage,
    billingClaimReferenceValidationPolicy,
    billingClaimReferenceValidationTelemetry,
    billingClaimReferenceValidationTelemetryInactivityMinutes,
    billingClaimReferenceValidationTelemetryMaxSessionAgeHours,
    billingClaimReferenceValidationTelemetryWindowMinutes,
    copyingBillingClaimReferenceMergePreviewFullPreservedKeys,
    copyingBillingClaimReferenceMergePreviewFullPreservedKeysChunk,
    copyingBillingClaimReferenceMergePreviewFullPreservedKeysJson,
    copyingBillingClaimReferenceOverrideEnvelope,
    copyingBillingClaimReferenceOverrideMergeSafeEnv,
    copyingBillingClaimReferenceOverrideShellExports,
    copyingBillingClaimReferenceOverrideSnippet,
    copyingBillingClaimReferenceTelemetrySnapshot,
    statusDialogAmountHelper,
    statusDialogClaimReferenceFormatHint,
    statusDialogClaimReferenceFormatInvalid,
    statusDialogClaimReferenceFrequentFailureHint,
    statusDialogClaimReferenceRequired,
    statusDialogClaimReferenceTelemetryEnvDiagnosticMessages,
    statusDialogClaimReferenceTelemetryHasData,
    statusDialogClaimReferenceTelemetryLastFailureLabel,
    statusDialogClaimReferenceTelemetryLastFailureReasonLabel,
    statusDialogClaimReferenceTelemetryLastUpdatedLabel,
    statusDialogClaimReferenceTelemetryOverrideBashExportLine,
    statusDialogClaimReferenceTelemetryOverrideCoverageSummary,
    statusDialogClaimReferenceTelemetryOverrideEnvLine,
    statusDialogClaimReferenceTelemetryOverrideGuidance,
    statusDialogClaimReferenceTelemetryOverrideMergePreview,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtFirstBoundary,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkAtLastBoundary,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkBytesPreviewLabel,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCount,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentBytes,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkCurrentIndex,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkHelperVisible,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextBytes,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkNextIndex,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysChunkQuickJumpVisible,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysJsonPayloadDiagnostics,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewFullPreservedKeysTextPayloadDiagnostics,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysLabel,
    statusDialogClaimReferenceTelemetryOverrideMergePreviewPreservedKeysOmittedCount,
    statusDialogClaimReferenceTelemetryOverrideMergeSafeEnvLine,
    statusDialogClaimReferenceTelemetryOverrideMergeSafeParseWarning,
    statusDialogClaimReferenceTelemetryOverrideMergeTemplateWithPlaceholder,
    statusDialogClaimReferenceTelemetryOverridePowerShellExportLine,
    statusDialogClaimReferenceTelemetryOverrideResolutionSummary,
    statusDialogClaimReferenceTelemetryOverridesParseDiagnosticMessage,
    statusDialogClaimReferenceTelemetryOverridesQualityDiagnosticMessages,
    statusDialogClaimReferenceTelemetryOverrideTargetSuggestions,
    statusDialogClaimReferenceTelemetryPayerFailures,
    statusDialogClaimReferenceTelemetryPolicySourceSummary,
    statusDialogClaimReferenceTelemetryProfileNormalizationSummary,
    statusDialogClaimReferenceTelemetryProfilePrecedenceSummary,
    statusDialogClaimReferenceTelemetryProfileProvenanceSummary,
    statusDialogClaimReferenceTelemetryProfileSelectionMismatchMessage,
    statusDialogClaimReferenceTelemetryReasonCounts,
    statusDialogClaimReferenceTelemetryRecentWindowFailures,
    statusDialogClaimReferenceTelemetrySessionStartedLabel,
    statusDialogClaimReferenceTemplateLike,
    statusDialogCurrencyCode,
    statusDialogDescription,
    statusDialogError,
    statusDialogExecutionPreviewCards,
    statusDialogInsuranceClaimMethodHint,
    statusDialogLastActivityLabel,
    statusDialogNeedsReason,
    statusDialogOperationBadgeLabel,
    statusDialogOutstandingAmount,
    statusDialogPaidAmountFieldLabel,
    statusDialogPaidAmountRequired,
    statusDialogPaymentAtFieldLabel,
    statusDialogPaymentMethodFieldLabel,
    statusDialogPaymentMethodSmartDefaultHint,
    statusDialogPaymentNoteFieldLabel,
    statusDialogPaymentNoteHelper,
    statusDialogPaymentNotePlaceholder,
    statusDialogPaymentPayerTypeFieldLabel,
    statusDialogPaymentPayerTypeHelper,
    statusDialogPaymentReferenceControlHint,
    statusDialogPaymentReferenceFieldLabel,
    statusDialogPaymentReferenceHelper,
    statusDialogPaymentReferencePlaceholder,
    statusDialogPaymentReferenceRequired,
    statusDialogPaymentReferenceSkeletonChips,
    statusDialogPaymentReferenceSkeletonHelper,
    statusDialogPaymentRouteQuickActionLabel,
    statusDialogPaymentRouteQuickActions,
    statusDialogPaymentSectionTitle,
    statusDialogProjectedBalance,
    statusDialogProjectedPaidAmount,
    statusDialogReasonSectionTitle,
    statusDialogReferenceCopyToolsLabel,
    statusDialogReferenceDiagnosticsDescription,
    statusDialogReferenceDiagnosticsLabel,
    statusDialogReferenceSupportDescription,
    statusDialogReferenceSupportLabel,
    statusDialogRouteControlCards,
    statusDialogSettlementBadgeLabel,
    statusDialogSettlementBadgeVariant,
    statusDialogSettlementNoticeLines,
    statusDialogSettlementNoticeVariant,
    statusDialogSettlementSectionDescription,
    statusDialogSettlementSectionTitle,
    statusDialogSettlementSummaryRows,
    statusDialogShowsPaidAmount,
    statusDialogSubmitButtonLabel,
    statusDialogSubmitLoadingLabel,
    statusDialogTitle,
    statusDialogUsesThirdPartySettlement,
};

const statusDialogActions = {
    closeInvoiceStatusDialog,
    submitInvoiceStatusDialog,
    applyStatusDialogPaymentRouteQuickAction,
    fillStatusDialogPaidAmountQuick,
    applyStatusDialogPaymentReferenceSkeleton,
    copyBillingClaimReferenceTelemetrySnapshot,
    copyBillingClaimReferenceOverrideSnippet,
    copyBillingClaimReferenceOverrideEnvelope,
    copyBillingClaimReferenceOverrideShellExports,
    copyBillingClaimReferenceOverrideMergeSafeEnv,
    copyBillingClaimReferenceMergePreviewFullPreservedKeys,
    copyBillingClaimReferenceMergePreviewFullPreservedKeysJson,
    copyBillingClaimReferenceMergePreviewFullPreservedKeysChunk,
    resetBillingClaimReferenceMergePreviewFullPreservedKeysChunkCursor,
    jumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk,
    quickJumpBillingClaimReferenceMergePreviewFullPreservedKeysChunk,
    resetBillingClaimReferenceValidationTelemetry,
};

const statusDialogHelpers = {
    formatMoney,
    shortId,
};

const billingQueueControlBarState = {
    statusSelectValue,
    billingQueueLaneFilter,
    billingQueueThirdPartyPhaseFilter,
};

const billingQueueControlBarView = {
    canReadBillingInvoices,
    billingWorkspaceView,
    billingQueueStateLabel,
    billingOperationalPresetState,
    billingOperationalQueueCounts,
    billingQueuePresetState,
    summaryQueueCounts,
    billingQueueLaneCounts,
    billingQueueThirdPartyPhaseCounts,
};

const billingQueueControlBarActions = {
    applyBillingQueueOperationalPreset,
    applyBillingQueuePreset,
    applyBillingSummaryStatusSetFilter,
    applyBillingSummaryFilter,
    setBillingQueueLaneFilter,
    setBillingQueueThirdPartyPhaseFilter,
};

const billingQueueControlBarHelpers = {
    isBillingSummaryFilterActive,
    isBillingSummaryStatusSetFilterActive,
};

const billingQueueFiltersPanelsState = {
    advancedFiltersSheetOpen,
    mobileFiltersDrawerOpen,
    searchForm,
};

const billingQueueFiltersPanelsView = {
    canReadBillingInvoices,
    billingWorkspaceView,
    patientChartQueueFocusLocked,
    defaultBillingCurrencyCode,
    billingQueueFilterSummary,
    listLoading,
    hasAdvancedFilters,
};

const billingQueueFiltersPanelsActions = {
    resetFiltersFromFiltersSheet,
    submitSearchFromFiltersSheet,
    submitSearchFromMobileDrawer,
    resetFiltersFromMobileDrawer,
};

const invoiceDetailsState = {
    invoiceDetailsSheetOpen,
    invoiceDetailsInvoice,
    invoiceDetailsSheetTab,
    invoiceDetailsPaymentsFiltersOpen,
    invoiceDetailsAuditFiltersOpen,
};

const invoiceDetailsView = {
    invoiceDetailsSheetDescription,
    invoiceDetailsUsesThirdPartySettlement,
    invoiceDetailsAmountSummary,
    canViewBillingInvoiceAuditLogs,
    invoiceDetailsAuditLogsMeta,
    invoiceDetailsAuditLogs,
    invoiceDetailsSettlementRoutingTitle,
    invoiceDetailsSettlementRoutingDescription,
    invoiceDetailsCoveragePosture,
    invoiceDetailsCoverageMetricBadges,
    invoiceDetailsFocusPanel,
    invoiceDetailsActionOutcome,
    invoiceDetailsOperationalLockMessage,
    invoiceDetailsOperationalPanel,
    invoiceDetailsOperationalActions,
    actionLoadingId,
    invoiceDetailsFinancialSnapshotRows,
    invoiceDetailsFinancePosting,
    invoiceDetailsFinancePostingLoading,
    invoiceDetailsFinancePostingError,
    invoiceDetailsFinanceInfrastructureAlert,
    invoiceDetailsFinancePostingCards,
    invoiceDetailsWorkflowStepCards,
    invoiceDetailsExecutionControlCards,
    invoiceDetailsExecutionChecklist,
    invoiceDetailsLedgerTitle,
    invoiceDetailsLedgerDescription,
    invoiceDetailsLedgerRestrictedTitle,
    invoiceDetailsLedgerRestrictedDescription,
    invoiceDetailsLedgerQuickFilters,
    invoiceDetailsLedgerDateTitle,
    invoiceDetailsLedgerDateHelper,
    invoiceDetailsLedgerSearchPlaceholder,
    invoiceDetailsLedgerSnapshotCards,
    invoiceDetailsLedgerActiveFilters,
    invoiceDetailsLedgerEmptyStateLabel,
    invoiceDetailsLedgerEntryLabel,
    canViewBillingPaymentHistory,
    invoiceDetailsPaymentsMeta,
    invoiceDetailsPaymentsLoading,
    invoiceDetailsPaymentsError,
    invoiceDetailsPayments,
    invoiceDetailsPaymentsFilters,
    paymentReversalSubmitting,
    invoiceDetailsWorkflowLinks,
    invoiceDetailsAuditSummary,
    invoiceDetailsAuditHasActiveFilters,
    invoiceDetailsAuditActiveFilters,
    invoiceDetailsAuditLogsFilters,
    invoiceDetailsAuditLogsLoading,
    invoiceDetailsAuditLogsExporting,
    invoiceDetailsAuditLogsError,
    invoiceDetailsAuditExportJobsFilters,
    invoiceDetailsAuditExportJobsLoading,
    invoiceDetailsAuditExportJobsError,
    invoiceDetailsAuditExportJobs,
    invoiceDetailsAuditExportJobsMeta,
    invoiceDetailsAuditExportJobSummary,
    invoiceDetailsAuditExportOpsHint,
    invoiceDetailsAuditExportHandoffMessage,
    invoiceDetailsAuditExportHandoffError,
    invoiceDetailsAuditExportPinnedHandoffJob,
    invoiceDetailsAuditExportFocusJobId,
    invoiceDetailsAuditExportRetryingJobId,
    invoiceDetailsPrimaryOperationalAction,
};

const invoiceDetailsActions = {
    closeInvoiceDetailsSheet,
    openInvoicePrintPreview,
    loadInvoiceDetailsPayments,
    submitInvoiceDetailsPaymentsFilters,
    resetInvoiceDetailsPaymentsFilters,
    applyInvoiceDetailsPaymentQuickFilter,
    openPaymentReversalDialog,
    loadInvoiceDetailsAuditLogs,
    submitInvoiceDetailsAuditLogsFilters,
    resetInvoiceDetailsAuditLogsFilters,
    exportInvoiceAuditLogsCsv,
    loadInvoiceAuditExportJobs,
    submitInvoiceDetailsAuditExportJobsFilters,
    resetInvoiceDetailsAuditExportJobsFilters,
    downloadInvoiceAuditExportJob,
    retryInvoiceAuditExportJob,
    prevInvoiceDetailsAuditExportJobsPage,
    nextInvoiceDetailsAuditExportJobsPage,
    toggleInvoiceDetailsAuditLogExpanded,
    prevInvoiceDetailsAuditLogsPage,
    nextInvoiceDetailsAuditLogsPage,
};

const invoiceDetailsHelpers = {
    formatMoney,
    shortId,
    previewText,
    invoicePatientLabel,
    invoicePatientNumber,
    invoiceEncounterContextLabel,
    invoiceSourceLabel,
    billingPaymentCanBeReversed,
    auditLogActionLabel,
    auditLogActorLabel,
    invoiceDetailsAuditActorTypeLabel,
    invoiceDetailsAuditChangeSummary,
    invoiceDetailsAuditChangeKeys,
    invoiceDetailsAuditMetadataPreview,
    auditLogEntries,
    formatAuditLogJson,
    isInvoiceDetailsAuditLogExpanded,
};

const createContextDialogState = {
    createContextDialogOpen,
    createContextEditorTab,
    createForm,
};

const createContextDialogView = {
    createPatientContextLocked,
    createPatientContextLabel,
    createPatientContextMeta,
    openedFromPatientChart,
    createPatientChartHref,
    activeBillingAppointmentStatuses,
};

const createContextDialogActions = {
    clearCreateClinicalLinks,
    unlockCreatePatientContext,
    closeCreateContextDialogAfterSelection,
    createFieldError,
};

const editDialogState = {
    editDialogOpen,
    editForm,
};

const editDialogView = {
    editDialogInvoiceLabel,
    editDialogCanOpenDraftWorkspace,
    editDialogSourceInvoice,
    editDialogLoading,
    editDialogError,
    editBillingDraftPreviewLoading,
    editBillingDraftPreviewInvoice,
    defaultBillingCurrencyCode,
    canReadBillingPayerContracts,
    billingPayerContractsLoading,
    billingPayerContractsError,
    editBillingPayerContractOptions,
    selectedEditBillingPayerPreview,
    editDraftExecutionPreview,
    editBillingDraftPreviewCoverageMetricBadges,
    editBillingDraftPreviewNegotiatedCount,
    editLineItemsCount,
    editLineItemsSubtotal,
    editDraftSaveGuidanceDescription,
};

const editDialogActions = {
    closeEditInvoiceDialog,
    openDraftBillingWorkspace,
    editFieldError,
    submitEditInvoice,
    removeEditLineItem,
    applyCalculatedEditSubtotal,
};

const editDialogHelpers = {
    formatMoney,
    formatPercent,
    createLineItemTotalDraft,
};

onBeforeUnmount(() => {
    clearSearchDebounce();
    clearCreateBillingDraftPreviewDebounce();
    clearEditBillingDraftPreviewDebounce();
    clearCreateContextActiveDraftDebounce();
});
onMounted(refreshPage);
</script>

<template>
    <Head title="Billing Invoices" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6"
        >
            <BillingWorkspaceHeader
                :page-loading="pageLoading"
                :list-loading="listLoading"
                :page-description="billingWorkspaceHeaderDescription"
                :scope-status-label="billingWorkspaceHeaderScopeLabel"
                :billing-workspace-view="billingWorkspaceView"
                :can-read-billing-financial-controls="canReadBillingFinancialControls"
                :can-read-billing-invoices="canReadBillingInvoices"
                :can-read-billing-payer-contracts="canReadBillingPayerContracts"
                :can-create-billing-invoices="canCreateBillingInvoices"
                @refresh="refreshPage"
                @open-board="openBillingBoardWorkspace"
                @open-queue="setBillingWorkspaceView('queue', { focusSearch: true })"
                @open-create="openCreateBillingWorkspace"
            />

            <template v-if="pageLoading">
                <div
                    v-if="billingWorkspaceView === 'create'"
                    class="space-y-4"
                >
                    <Card
                        id="create-billing-invoice-loading"
                        class="rounded-lg border-sidebar-border/70"
                    >
                        <CardHeader class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div class="space-y-1.5">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="plus" class="size-5 text-muted-foreground" />
                                    {{ createWorkspaceTitle }}
                                </CardTitle>
                                <CardDescription>
                                    {{ createWorkspaceDescription }}
                                </CardDescription>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                                <Skeleton class="h-8 w-36 rounded-lg" />
                            </div>
                        </CardHeader>
                        <CardContent class="space-y-4">
                            <div class="rounded-lg border bg-muted/20 p-2">
                                <div class="grid gap-2 md:grid-cols-3">
                                    <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                        <p class="text-sm font-medium text-foreground">1. Context</p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            Confirm patient, visit link, and settlement route.
                                        </p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                        <p class="text-sm font-medium text-foreground">2. Charges</p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            Import services or add governed exception charges.
                                        </p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/20 px-4 py-3">
                                        <p class="text-sm font-medium text-foreground">3. Review & Save</p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            Review lines, dates, and adjustments before saving the draft invoice.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div class="rounded-lg border bg-muted/20 p-3">
                                <div class="space-y-3">
                                    <Skeleton class="h-4 w-56 rounded-lg" />
                                    <div class="grid gap-2 lg:grid-cols-3">
                                        <Skeleton class="h-16 rounded-lg" />
                                        <Skeleton class="h-16 rounded-lg" />
                                        <Skeleton class="h-16 rounded-lg" />
                                    </div>
                                </div>
                            </div>

                            <div class="grid gap-3 md:grid-cols-2">
                                <Skeleton class="h-24 rounded-lg" />
                                <Skeleton class="h-24 rounded-lg" />
                            </div>

                            <Skeleton class="h-48 rounded-lg" />
                        </CardContent>
                    </Card>
                </div>
                <div v-else class="space-y-3">
                    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <Skeleton class="h-9 rounded-lg" />
                        <Skeleton class="h-9 rounded-lg" />
                        <Skeleton class="h-9 rounded-lg" />
                        <Skeleton class="h-9 rounded-lg" />
                    </div>

                    <Card class="rounded-lg border-sidebar-border/70">
                        <CardHeader class="space-y-2">
                            <Skeleton class="h-5 w-48" />
                            <Skeleton class="h-4 w-full max-w-2xl" />
                        </CardHeader>
                        <CardContent class="space-y-3">
                            <Skeleton class="h-10 w-full rounded-lg" />
                            <Skeleton class="h-24 w-full rounded-lg" />
                            <Skeleton class="h-48 w-full rounded-lg" />
                        </CardContent>
                    </Card>
                </div>
            </template>
            <template v-else>
            <BillingQueueControlBar
                :state="billingQueueControlBarState"
                :view="billingQueueControlBarView"
                :actions="billingQueueControlBarActions"
                :helpers="billingQueueControlBarHelpers"
            />

            <BillingBoardView
                v-if="billingWorkspaceView === 'board'"
                :can-read-billing-invoices="canReadBillingInvoices"
                :can-read-billing-financial-controls="canReadBillingFinancialControls"
                :billing-permissions-resolved="billingPermissionsResolved"
                :page-loading="pageLoading"
                :billing-financial-controls-window-label="billingFinancialControlsWindowLabel"
                :billing-financial-controls-as-of-label="billingFinancialControlsAsOfLabel"
                :financial-summary-currency-code="financialSummaryCurrencyCode"
                :billing-financial-controls-summary="billingFinancialControlsSummary"
                :billing-financial-controls-loading="billingFinancialControlsLoading"
                :billing-financial-controls-error="billingFinancialControlsError"
                :billing-financial-controls-exporting="billingFinancialControlsExporting"
                :billing-outstanding-tone-class="billingOutstandingToneClass"
                :billing-aging-bucket-rows="billingAgingBucketRows"
                :billing-daybook-tone-class="billingDaybookToneClass"
                :billing-daybook-scope-label="billingDaybookScopeLabel"
                :billing-visible-payment-activity-count="billingVisiblePaymentActivityCount"
                :billing-operational-queue-counts="billingOperationalQueueCounts"
                :billing-visible-latest-payment-at="billingVisibleLatestPaymentAt"
                :billing-visible-payment-method-mix-label="billingVisiblePaymentMethodMixLabel"
                :billing-visible-payer-type-mix-label="billingVisiblePayerTypeMixLabel"
                :billing-outstanding-follow-up-count="billingOutstandingFollowUpCount"
                :billing-daybook-focus-card="billingDaybookFocusCard"
                :billing-denial-pressure-tone-class="billingDenialPressureToneClass"
                :billing-denial-focus-card="billingDenialFocusCard"
                :billing-settlement-pressure-tone-class="billingSettlementPressureToneClass"
                :billing-settlement-focus-card="billingSettlementFocusCard"
                :billing-claims-rejected-href="billingClaimsRejectedHref"
                :billing-claims-partial-denials-href="billingClaimsPartialDenialsHref"
                :billing-claims-pending-settlement-href="billingClaimsPendingSettlementHref"
                :billing-claims-open-exceptions-href="billingClaimsOpenExceptionsHref"
                :format-money="formatMoney"
                @refresh-summary="loadFinancialControlsSummary"
                @export-summary="exportFinancialControlsSummaryCsv"
                @open-cashier-daybook="
                    applyBillingQueueOperationalPreset('cashier_daybook', {
                        focusSearch: true,
                    })
                "
                @work-outstanding-follow-up="
                    applyBillingQueuePreset('outstanding', {
                        focusSearch: true,
                    })
                "
                @open-claim-prep="
                    applyBillingQueueOperationalPreset('claim_prep', {
                        focusSearch: true,
                    })
                "
                @open-reconciliation="
                    applyBillingQueueOperationalPreset('reconciliation', {
                        focusSearch: true,
                    })
                "
            />

            <BillingWorkspaceAlerts
                :scope-warning="scopeWarning"
                :list-errors="listErrors"
                :last-billing-audit-export-retry-handoff="lastBillingAuditExportRetryHandoff"
                :billing-audit-export-retry-resume-telemetry="
                    billingAuditExportRetryResumeTelemetry
                "
                :resuming-billing-audit-export-retry-handoff="
                    resumingBillingAuditExportRetryHandoff
                "
                :audit-export-retry-handoff-completed-message="
                    auditExportRetryHandoffCompletedMessage
                "
                @resume-last-handoff="resumeLastBillingAuditExportRetryHandoff"
                @clear-last-handoff="clearLastBillingAuditExportRetryHandoff"
                @reset-resume-telemetry="resetBillingAuditExportRetryResumeTelemetry"
                @dismiss-completed-message="auditExportRetryHandoffCompletedMessage = null"
            />

            <div class="flex min-w-0 flex-col gap-4">
                <Card
                    v-if="canReadBillingInvoices && billingWorkspaceView === 'queue'"
                    id="billing-invoices-queue"
                    class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col"
                >
                    <BillingQueueToolbar
                        :queue-scope-summary="billingQueueScopeSummary"
                        :visible-count="visibleBillingQueueInvoices.length"
                        :current-page="pagination?.currentPage ?? 1"
                        :last-page="pagination?.lastPage ?? 1"
                        :patient-filtered="Boolean(searchForm.patientId)"
                        :active-patient-focus="activeBillingPatientFocus"
                        :queue-state-label="billingQueueStateLabel"
                        :filter-badge-count="billingFilterBadgeCount"
                        :patient-chart-queue-return-href="patientChartQueueReturnHref"
                        :is-patient-chart-queue-focus-applied="isPatientChartQueueFocusApplied"
                        :opened-from-patient-chart="openedFromPatientChart"
                        :patient-chart-queue-route-patient-available="patientChartQueueRoutePatientAvailable"
                        :search-query="searchForm.q"
                        :status-value="statusSelectValue"
                        :list-loading="listLoading"
                        :active-advanced-filter-count="activeBillingAdvancedFilterCount"
                        :queue-toolbar-summary="billingQueueToolbarSummary"
                        :has-visible-scope-badges="hasVisibleBillingQueueScopeBadges"
                        :queue-lane-filter-label="billingQueueLaneFilterLabel"
                        :queue-third-party-phase-filter-label="billingQueueThirdPartyPhaseFilterLabel"
                        :currency-code="searchForm.currencyCode"
                        :invoice-date-filter-active="searchForm.from !== today || Boolean(searchForm.to)"
                        :payment-activity-filter-active="Boolean(searchForm.paymentActivityFrom || searchForm.paymentActivityTo)"
                        :register-search-input="registerBillingQueueSearchInput"
                        @update:search-query="searchForm.q = $event"
                        @update:status-value="updateBillingQueueStatusValue"
                        @submit-search="submitSearch"
                        @open-advanced-filters="advancedFiltersSheetOpen = true"
                        @open-mobile-filters="mobileFiltersDrawerOpen = true"
                        @set-results-per-page="setBillingResultsPerPage"
                        @set-compact-rows="setBillingQueueDensity"
                        @reset-filters="resetFilters"
                        @open-full-queue="openFullBillingQueue"
                        @refocus-patient="refocusBillingPatientQueue"
                    />
                    <BillingQueueTable
                        :page-loading="pageLoading"
                        :list-loading="listLoading"
                        :compact-queue-rows="compactQueueRows"
                        :visible-invoices="visibleBillingQueueInvoices"
                        :invoices-count="invoices.length"
                        :pagination="pagination"
                        :billing-queue-third-party-phase-filter="billingQueueThirdPartyPhaseFilter"
                        :can-issue-billing-invoices="canIssueBillingInvoices"
                        :can-record-billing-payments="canRecordBillingPayments"
                        :can-update-draft-billing-invoices="canUpdateDraftBillingInvoices"
                        :can-cancel-billing-invoices="canCancelBillingInvoices"
                        :can-void-billing-invoices="canVoidBillingInvoices"
                        :action-loading-id="actionLoadingId"
                        :edit-dialog-loading="editDialogLoading"
                        :invoice-details-payments-loading="invoiceDetailsPaymentsLoading"
                        :invoice-details-invoice-id="invoiceDetailsInvoice?.id ?? null"
                        :format-money="formatMoney"
                        :preview-text="previewText"
                        :invoice-accent-class="invoiceAccentClass"
                        :invoice-patient-label="invoicePatientLabel"
                        :invoice-patient-number="invoicePatientNumber"
                        :invoice-source-label="invoiceSourceLabel"
                        :invoice-source-workflow-href="invoiceSourceWorkflowHref"
                        :invoice-last-payment-meta-label="invoiceLastPaymentMetaLabel"
                        :invoice-line-item-preview="invoiceLineItemPreview"
                        :billing-invoice-queue-claims-action="billingInvoiceQueueClaimsAction"
                        :billing-invoice-should-prioritize-claims-action="billingInvoiceShouldPrioritizeClaimsAction"
                        :billing-invoice-queue-action-rail-label="billingInvoiceQueueActionRailLabel"
                        @status-action="handleBillingQueueStatusAction"
                        @open-draft-workspace="openDraftBillingWorkspace"
                        @open-edit-draft="openEditInvoiceDialog"
                        @open-details="openInvoiceDetailsSheet"
                        @prev-page="prevPage"
                        @next-page="nextPage"
                    />
                </Card>

                <Card
                    v-else-if="!pageLoading && billingWorkspaceView === 'queue'"
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="shield-check" class="size-4 text-muted-foreground" />
                            Billing Invoices
                        </CardTitle>
                        <CardDescription>
                            You do not have permission to view billing invoices.
                        </CardDescription>
                    </CardHeader>
                </Card>

                <Card
                    v-if="canCreateBillingInvoices && billingWorkspaceView === 'create'"
                    id="create-billing-invoice"
                    class="rounded-lg border-sidebar-border/70"
                >
                    <BillingCreateWorkspaceHeader
                        :create-workspace-title="createWorkspaceTitle"
                        :create-workspace-description="createWorkspaceDescription"
                        :show-patient-chart-return="openedFromPatientChart && Boolean(createForm.patientId.trim())"
                        :create-patient-chart-href="createPatientChartHref"
                        :show-consultation-return="Boolean(consultationContextHref)"
                        :consultation-context-href="consultationContextHref"
                        :consultation-return-label="consultationReturnLabel"
                        :create-invoice-stage="createInvoiceStage"
                        :create-line-items-count="createLineItemsCount"
                        :create-workspace-review-step-description="createWorkspaceReviewStepDescription"
                        :create-workspace-mode-badge-label="createWorkspaceModeBadgeLabel"
                        :create-workspace-is-editing-draft="createWorkspaceIsEditingDraft"
                        :create-workspace-draft-invoice-label="createWorkspaceDraftInvoiceLabel"
                        :has-active-draft="Boolean(createContextActiveDraft)"
                        :create-context-active-draft-label="createContextActiveDraftLabel"
                        :create-context-active-draft-description="createContextActiveDraftDescription"
                        :create-context-active-draft-summary="createContextActiveDraftSummary"
                        :has-pending-create-workflow="hasPendingCreateWorkflow"
                        :create-context-active-draft-error="createContextActiveDraftError"
                        :create-context-active-draft-loading="createContextActiveDraftLoading"
                        @update:createInvoiceStage="createInvoiceStage = $event"
                        @continue-active-draft="continueCreateContextActiveDraft"
                        @preview-active-draft="previewCreateContextActiveDraft"
                    />
                    <CardContent class="space-y-4">
                        <Alert
                            v-if="createMessage"
                            class="border-primary/20 bg-primary/5"
                        >
                            <AlertTitle>Draft workspace update</AlertTitle>
                            <AlertDescription>
                                {{ createMessage }}
                            </AlertDescription>
                        </Alert>

                        <Alert
                            v-if="hasCreateFeedback"
                            variant="destructive"
                        >
                            <AlertTitle>Create workflow needs attention</AlertTitle>
                            <AlertDescription>
                                <div class="space-y-1">
                                    <p
                                        v-for="(messages, field) in createErrors"
                                        :key="field"
                                        class="text-xs"
                                    >
                                        {{ messages[0] }}
                                    </p>
                                </div>
                            </AlertDescription>
                        </Alert>

                        <div
                            v-if="createInvoiceStage === 'context'"
                            class="space-y-4"
                        >
                            <BillingCreateContextSummary
                                :create-order-context-summary="createOrderContextSummary"
                                :create-patient-context-locked="createPatientContextLocked"
                                :create-form-patient-id="createForm.patientId"
                                :create-form-appointment-id="createForm.appointmentId"
                                :create-form-admission-id="createForm.admissionId"
                                :create-patient-context-meta="createPatientContextMeta"
                                :create-patient-context-label="createPatientContextLabel"
                                :has-create-appointment-context="hasCreateAppointmentContext"
                                :create-appointment-context-label="createAppointmentContextLabel"
                                :create-appointment-context-meta="createAppointmentContextMeta"
                                :create-appointment-context-reason="createAppointmentContextReason"
                                :create-appointment-context-status-label="createAppointmentContextStatusLabel"
                                :create-appointment-context-status-variant="createAppointmentContextStatusVariant"
                                :create-appointment-context-source-label="createAppointmentContextSourceLabel"
                                :has-create-admission-context="hasCreateAdmissionContext"
                                :create-admission-context-label="createAdmissionContextLabel"
                                :create-admission-context-meta="createAdmissionContextMeta"
                                :create-admission-context-reason="createAdmissionContextReason"
                                :create-admission-context-status-label="createAdmissionContextStatusLabel"
                                :create-admission-context-status-variant="createAdmissionContextStatusVariant"
                                :create-admission-context-source-label="createAdmissionContextSourceLabel"
                                :has-source-workflow-context="hasSourceWorkflowContext"
                                :source-workflow-kind-badge="sourceWorkflowKindBadge"
                                :source-workflow-reference="sourceWorkflowReference"
                                :source-workflow-href="sourceWorkflowHref"
                                :source-workflow-summary="sourceWorkflowSummary"
                                @open-context-dialog="openCreateContextDialog"
                                @clear-clinical-links="clearCreateClinicalLinks"
                            />

                            <BillingCreateCoveragePanel
                                :create-coverage-status-tone="createCoverageStatusTone"
                                :create-coverage-status-label="createCoverageStatusLabel"
                                :create-billing-draft-preview-loading="createBillingDraftPreviewLoading"
                                :has-create-billing-draft-preview-invoice="Boolean(createBillingDraftPreviewInvoice)"
                                :create-coverage-mode="createCoverageMode"
                                :create-billing-payer-contract-id="createForm.billingPayerContractId"
                                :create-coverage-mode-context-hint="createCoverageModeContextHint"
                                :create-visit-coverage="createVisitCoverage"
                                :create-visit-coverage-summary="createVisitCoverageSummary"
                                :create-visit-coverage-contract-label="createVisitCoverageContractLabel"
                                :can-read-billing-payer-contracts="canReadBillingPayerContracts"
                                :create-billing-payer-contract-options="createBillingPayerContractOptions"
                                :create-coverage-contract-helper-text="createCoverageContractHelperText"
                                :billing-payer-contracts-loading="billingPayerContractsLoading"
                                :create-billing-payer-contract-id-error="createFieldError('billingPayerContractId')"
                                :billing-payer-contracts-error="billingPayerContractsError"
                                :billing-payer-contracts-loaded="billingPayerContractsLoaded"
                                :billing-payer-contracts-count="createBillingPayerContractOptions.length"
                                :create-draft-execution-preview="createDraftExecutionPreview"
                                :create-coverage-settlement-path-display="createCoverageSettlementPathDisplay"
                                :create-coverage-expected-payer-display="createCoverageExpectedPayerDisplay"
                                :create-coverage-expected-patient-display="createCoverageExpectedPatientDisplay"
                                :selected-create-billing-payer-preview="selectedCreateBillingPayerPreview"
                                :create-billing-draft-preview-coverage-metric-badges="createBillingDraftPreviewCoverageMetricBadges"
                                :create-billing-draft-preview-negotiated-count="createBillingDraftPreviewNegotiatedCount"
                                :create-coverage-blocking-reasons="createCoverageBlockingReasons"
                                :create-coverage-guidance="createCoverageGuidance"
                                :format-money="formatMoney"
                                @set-coverage-mode="setCreateCoverageMode"
                                @clear-billing-payer-contract="createForm.billingPayerContractId = ''"
                                @update:billing-payer-contract-id="createForm.billingPayerContractId = $event"
                            />
                        </div>

                        <div
                            v-else-if="createInvoiceStage === 'charges'"
                            class="space-y-4"
                        >
                            <BillingCreateChargesSummary
                                :create-line-items-count="createLineItemsCount"
                                :create-line-items-subtotal="createLineItemsSubtotal"
                                :currency-code="createForm.currencyCode"
                                :default-currency-code="defaultBillingCurrencyCode"
                                :create-coverage-settlement-path-display="createCoverageSettlementPathDisplay"
                                :create-coverage-expected-payer-display="createCoverageExpectedPayerDisplay"
                                :create-coverage-expected-patient-display="createCoverageExpectedPatientDisplay"
                                :create-coverage-claim-posture-display="createCoverageClaimPostureDisplay"
                                :can-read-billing-service-catalog="canReadBillingServiceCatalog"
                                :billing-service-catalog-error="billingServiceCatalogError"
                                :billing-service-catalog-loading="billingServiceCatalogLoading"
                                :billing-service-catalog-items-count="billingServiceCatalogOptions.length"
                                :catalog-currency-code-label="createForm.currencyCode || defaultBillingCurrencyCode"
                                :create-line-items-error="createFieldError('lineItems')"
                                :format-money="formatMoney"
                            />

                            <div class="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:items-start">
                                <BillingCreateLineItemsSidebar
                                    :create-line-items-count="createLineItemsCount"
                                    :create-line-item-workspace-tab="createLineItemWorkspaceTab"
                                    :can-read-billing-service-catalog="canReadBillingServiceCatalog"
                                    :create-basket-count-label="createBasketCountLabel"
                                    :create-line-items-subtotal="createLineItemsSubtotal"
                                    :currency-code="createForm.currencyCode"
                                    :default-currency-code="defaultBillingCurrencyCode"
                                    :has-active-create-line-item="Boolean(activeCreateLineItemDraft)"
                                    :create-review-line-items="createReviewLineItems"
                                    :active-create-line-item-key="activeCreateLineItemDraft?.key ?? null"
                                    :format-money="formatMoney"
                                    :create-line-item-draft-display-label="createLineItemDraftDisplayLabel"
                                    @open-capture-workspace="createLineItemWorkspaceTab = 'capture'"
                                    @add-catalog-line="addCreateCatalogLineItem"
                                    @add-exception-line="addCreateLineItem"
                                    @set-active-line-item="setActiveCreateLineItem"
                                    @remove-line-item="removeCreateLineItem"
                                />

                                <div class="space-y-4">
                                    <BillingCreateChargeCapturePanel
                                        v-if="createLineItemWorkspaceTab === 'capture'"
                                        :patient-id="createForm.patientId"
                                        :billing-charge-capture-coverage-badge-variant="billingChargeCaptureCoverageBadgeVariant"
                                        :billing-charge-capture-coverage-badge-label="billingChargeCaptureCoverageBadgeLabel"
                                        :billing-charge-capture-section-description="billingChargeCaptureSectionDescription"
                                        :billing-charge-capture-ready-count="billingChargeCaptureReadyCount"
                                        :billing-charge-capture-imported-count="billingChargeCaptureImportedCount"
                                        :billing-charge-capture-needs-tariff-count="billingChargeCaptureNeedsTariffCount"
                                        :visible-billing-charge-capture-candidates="visibleBillingChargeCaptureCandidates"
                                        :billing-charge-capture-importable-candidates-count="billingChargeCaptureImportableCandidates.length"
                                        :billing-charge-capture-bulk-action-label="billingChargeCaptureBulkActionLabel"
                                        :billing-charge-capture-context-guidance="billingChargeCaptureContextGuidance"
                                        :billing-charge-capture-error="billingChargeCaptureError"
                                        :billing-charge-capture-loading="billingChargeCaptureLoading"
                                        :billing-charge-capture-empty-state-description="billingChargeCaptureEmptyStateDescription"
                                        :imported-charge-capture-candidate-ids="importedChargeCaptureCandidateIds"
                                        :create-coverage-needs-contract="createCoverageNeedsContract"
                                        :create-coverage-mode="createCoverageMode"
                                        :selected-create-billing-payer-preview-claim-ready="selectedCreateBillingPayerPreview.claimReady"
                                        :currency-code="createForm.currencyCode"
                                        :default-currency-code="defaultBillingCurrencyCode"
                                        :format-money="formatMoney"
                                        @import-ready-candidates="importReadyBillingChargeCaptureCandidates"
                                        @import-candidate="importBillingChargeCaptureCandidate"
                                    />

                                    <BillingCreateSelectedLineEditor
                                        v-else-if="activeCreateLineItemDraft"
                                        :active-create-line-item-draft="activeCreateLineItemDraft"
                                        :active-create-line-item-index="activeCreateLineItemIndex"
                                        :can-read-billing-service-catalog="canReadBillingServiceCatalog"
                                        :billing-service-catalog-options="billingServiceCatalogOptions"
                                        :billing-service-catalog-loading="billingServiceCatalogLoading"
                                        :currency-code="createForm.currencyCode"
                                        :default-currency-code="defaultBillingCurrencyCode"
                                        :format-money="formatMoney"
                                        :create-line-item-draft-display-label="createLineItemDraftDisplayLabel"
                                        :billing-service-catalog-item-by-id="billingServiceCatalogItemById"
                                        :create-line-item-exception-reason-missing="createLineItemExceptionReasonMissing"
                                        :create-line-item-total-draft="createLineItemTotalDraft"
                                        @set-entry-mode="setCreateLineItemEntryMode"
                                        @remove-line-item="removeCreateLineItem"
                                        @select-catalog-item="selectCreateLineItemCatalogItem"
                                    />

                                    <BillingCreateLineItemsFallback
                                        v-else
                                        :can-read-billing-service-catalog="canReadBillingServiceCatalog"
                                        :line-items="createForm.lineItems"
                                        :billing-service-catalog-options="billingServiceCatalogOptions"
                                        :billing-service-catalog-loading="billingServiceCatalogLoading"
                                        :currency-code="createForm.currencyCode"
                                        :default-currency-code="defaultBillingCurrencyCode"
                                        :format-money="formatMoney"
                                        :billing-service-catalog-item-by-id="billingServiceCatalogItemById"
                                        :create-line-item-total-draft="createLineItemTotalDraft"
                                        @add-catalog-line="addCreateCatalogLineItem"
                                        @add-exception-line="addCreateLineItem"
                                        @set-entry-mode="setCreateLineItemEntryMode"
                                        @remove-line-item="removeCreateLineItem"
                                        @select-catalog-item="selectCreateLineItemCatalogItem"
                                    />
                                </div>
                            </div>
                        </div>

                        <BillingCreateFinalizePanel
                            v-else
                            :create-basket-count-label="createBasketCountLabel"
                            :create-line-items-subtotal="createLineItemsSubtotal"
                            :default-currency-code="defaultBillingCurrencyCode"
                            :create-coverage-expected-payer-display="createCoverageExpectedPayerDisplay"
                            :create-coverage-settlement-path-display="createCoverageSettlementPathDisplay"
                            :create-coverage-expected-patient-display="createCoverageExpectedPatientDisplay"
                            :selected-create-billing-payer-preview="selectedCreateBillingPayerPreview"
                            :create-coverage-claim-posture-display="createCoverageClaimPostureDisplay"
                            :create-exception-charge-line-items-count="createExceptionChargeLineItems.length"
                            :create-exception-charge-lines-missing-reason-count="createExceptionChargeLinesMissingReason.length"
                            :create-line-items-count="createLineItemsCount"
                            :create-review-line-items="createReviewLineItems"
                            :create-draft-save-guidance-title="createDraftSaveGuidanceTitle"
                            :create-draft-save-guidance-description="createDraftSaveGuidanceDescription"
                            :create-form="createForm"
                            :create-field-error="createFieldError"
                            :format-money="formatMoney"
                            :create-line-item-total-draft="createLineItemTotalDraft"
                            :create-line-item-draft-display-label="createLineItemDraftDisplayLabel"
                            @back-to-charges="goToCreateChargesStage"
                        />

                        <BillingCreateStageActions
                            :create-invoice-stage="createInvoiceStage"
                            :create-draft-save-guidance-description="createDraftSaveGuidanceDescription"
                            :has-create-feedback="hasCreateFeedback"
                            :create-loading="createLoading"
                            :can-continue-from-context="canContinueCreateContextStage"
                            :can-continue-from-charges="createFinalizeReady"
                            :submit-label="createWorkspaceSubmitLabel"
                            :submit-loading-label="createWorkspaceSubmitLoadingLabel"
                            @dismiss-alerts="resetCreateMessages"
                            @back="goToPreviousCreateStage"
                            @continue-to-charges="goToCreateChargesStage"
                            @continue-to-review="goToCreateFinalizeStage"
                            @submit="createInvoice"
                        />
                    </CardContent>
                </Card>

                <BillingCreateAccessRestrictedCard
                    v-else-if="
                        billingPermissionsResolved &&
                        billingWorkspaceView === 'create'
                    "
                />
            </div>

            <BillingCreateContextDialog
                :state="createContextDialogState"
                :view="createContextDialogView"
                :actions="createContextDialogActions"
            />

            <BillingCreateWorkflowLinksBar :links="billingCreateWorkflowLinks" />

            <BillingQueueFiltersPanels
                :state="billingQueueFiltersPanelsState"
                :view="billingQueueFiltersPanelsView"
                :actions="billingQueueFiltersPanelsActions"
            />

            <InvoiceDetailsSheet
                :state="invoiceDetailsState"
                :view="invoiceDetailsView"
                :actions="invoiceDetailsActions"
                :helpers="invoiceDetailsHelpers"
            />

            <InvoiceEditDraftSheet
                :state="editDialogState"
                :view="editDialogView"
                :actions="editDialogActions"
                :helpers="editDialogHelpers"
            />

            <PaymentReversalDialog
                :open="paymentReversalDialogOpen"
                :invoice="paymentReversalDialogInvoice"
                :payment="paymentReversalDialogPayment"
                :payments="invoiceDetailsPayments"
                :error="paymentReversalDialogError"
                :submitting="paymentReversalSubmitting"
                :default-currency-code="defaultBillingCurrencyCode"
                @update:open="handlePaymentReversalDialogOpenChange"
                @clear-error="clearPaymentReversalDialogError"
                @submit="submitPaymentReversalDialog"
            />

            <InvoiceStatusDialogSheet
                :state="statusDialogState"
                :view="statusDialogView"
                :actions="statusDialogActions"
                :helpers="statusDialogHelpers"
            />
        </template>
        </div>
        <LeaveWorkflowDialog
                :open="createLeaveConfirmOpen"
                :title="BILLING_CREATE_LEAVE_TITLE"
                :description="BILLING_CREATE_LEAVE_DESCRIPTION"
                stay-label="Stay on invoice"
                leave-label="Leave page"
                @update:open="(open) => (open ? (createLeaveConfirmOpen = true) : cancelPendingCreateWorkflowLeave())"
                @confirm="confirmPendingCreateWorkflowLeave"
            />
    </AppLayout>
</template>



























































