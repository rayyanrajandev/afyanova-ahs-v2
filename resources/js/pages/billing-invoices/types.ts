import type { AuditActorSummary } from '@/lib/audit';

export type ScopeData = {
    resolvedFrom: string;
    tenant: { code: string; name: string } | null;
    facility: { code: string; name: string } | null;
};

export type BillingInvoice = {
    id: string;
    invoiceNumber: string | null;
    patientId: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    billingPayerContractId: string | null;
    issuedByUserId: number | null;
    invoiceDate: string | null;
    currencyCode: string | null;
    subtotalAmount: string | number | null;
    discountAmount: string | number | null;
    taxAmount: string | number | null;
    totalAmount: string | number | null;
    paidAmount: string | number | null;
    lastPaymentAt: string | null;
    lastPaymentPayerType: string | null;
    lastPaymentMethod: string | null;
    lastPaymentReference: string | null;
    balanceAmount: string | number | null;
    paymentDueAt: string | null;
    notes: string | null;
    lineItems: BillingInvoiceLineItem[] | null;
    pricingMode: string | null;
    pricingContext: Record<string, unknown> | null;
    priceOverrideSummary: BillingInvoicePriceOverrideSummary | null;
    authorizationSummary: BillingInvoiceAuthorizationSummary | null;
    coverageSummary: BillingInvoiceCoverageSummary | null;
    visitCoverage: BillingInvoiceVisitCoverage | null;
    payerSummary: BillingInvoicePayerSummary | null;
    claimReadiness: BillingInvoiceClaimReadiness | null;
    status:
        | 'draft'
        | 'issued'
        | 'partially_paid'
        | 'paid'
        | 'cancelled'
        | 'voided'
        | string
        | null;
    statusReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    financePosting?: BillingInvoiceFinancePostingSummary | null;
};

export type BillingInvoiceFinanceLedgerSummary = {
    entryCount: number;
    postedCount: number;
    draftCount: number;
    reversedCount: number;
    latestPostingDate: string | null;
};

export type BillingInvoiceFinancePostingSummary = {
    infrastructure: {
        revenueRecognitionReady: boolean;
        glPostingReady: boolean;
        missingTables: string[];
    };
    recognition: {
        status: string;
        recognizedAt: string | null;
        recognitionMethod: string | null;
        recognizedAmount: number;
        adjustedAmount: number;
        netRevenue: number;
    };
    revenuePosting: BillingInvoiceFinanceLedgerSummary;
    paymentPosting: BillingInvoiceFinanceLedgerSummary;
    refundPosting: BillingInvoiceFinanceLedgerSummary;
};

export type BillingInvoiceLineItemPriceOverride = {
    id?: string | null;
    serviceCode?: string | null;
    serviceName?: string | null;
    pricingStrategy?: string | null;
    overrideValue?: string | number | null;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
} | null;

export type BillingInvoiceLineItemCoverage = {
    decision?: string | null;
    source?: string | null;
    selectedRuleId?: string | null;
    selectedRuleCode?: string | null;
    selectedRuleName?: string | null;
    effectiveCoveragePercent?: string | number | null;
    copayType?: string | null;
    copayValue?: string | number | null;
    benefitLimitAmount?: string | number | null;
    matchedRuleIds?: string[];
    matchedRuleCodes?: string[];
    matchedRuleCount?: number;
} | null;

export type BillingInvoiceAuthorizationSummary = {
    lineItemsRequiringAuthorization?: number;
    lineItemsAutoApproved?: number;
    matchedRuleCount?: number;
    matchedRuleCodes?: string[];
} | null;

export type BillingInvoiceCoverageSummary = {
    lineItemsExcluded?: number;
    lineItemsManualReview?: number;
    lineItemsCoveredWithRule?: number;
    lineItemsUsingPolicyRule?: number;
    matchedRuleCount?: number;
    matchedRuleCodes?: string[];
} | null;

export type BillingInvoicePriceOverrideSummary = {
    matchedOverrideCount?: number;
    matchedServiceCodes?: string[];
} | null;

export type BillingInvoiceLineItemAuthorization = {
    required?: boolean;
    autoApproved?: boolean;
    matchedRuleIds?: string[];
    matchedRuleCodes?: string[];
    matchedRuleCount?: number;
} | null;

export type BillingInvoiceLineItem = {
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal?: number | null;
    serviceCode?: string | null;
    unit?: string | null;
    notes?: string | null;
    sourceWorkflowKind?: string | null;
    sourceWorkflowId?: string | null;
    sourceWorkflowLabel?: string | null;
    sourcePerformedAt?: string | null;
    pricingSource?: string | null;
    pricingSourceId?: string | null;
    catalogServiceName?: string | null;
    catalogUnitPrice?: string | number | null;
    priceOverride?: BillingInvoiceLineItemPriceOverride;
    coverage?: BillingInvoiceLineItemCoverage;
    authorization?: BillingInvoiceLineItemAuthorization;
};

export type BillingChargeCaptureCandidate = {
    id: string;
    sourceWorkflowKind: string;
    sourceWorkflowId: string;
    sourceWorkflowLabel: string | null;
    patientId: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    sourceNumber: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    serviceType: string | null;
    sourceStatus: string | null;
    performedAt: string | null;
    quantity: string | number | null;
    unit: string | null;
    unitPrice: string | number | null;
    lineTotal: string | number | null;
    currencyCode: string | null;
    pricingStatus: 'priced' | 'missing_catalog_price' | 'missing_service_code' | string | null;
    pricingSource: string | null;
    pricingSourceId: string | null;
    alreadyInvoiced: boolean;
    invoiceId: string | null;
    invoiceNumber: string | null;
    invoiceStatus: string | null;
    suggestedLineItem: BillingInvoiceLineItem;
};

export type BillingChargeCaptureCandidateListResponse = {
    data: BillingChargeCaptureCandidate[];
    meta: {
        currencyCode: string;
        includeInvoiced: boolean;
        total: number;
        pending: number;
        alreadyInvoiced: number;
        priced: number;
        missingPrice: number;
    };
};

export type BillingInvoiceVisitCoverage = {
    source?: string | null;
    sourceId?: string | null;
    sourceNumber?: string | null;
    financialClass?: string | null;
    billingPayerContractId?: string | null;
    coverageReference?: string | null;
    coverageNotes?: string | null;
};

export type BillingInvoiceListResponse = {
    data: BillingInvoice[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

export type BillingInvoiceStatusCounts = {
    draft: number;
    issued: number;
    partially_paid: number;
    paid: number;
    cancelled: number;
    voided: number;
    other: number;
    total: number;
};

export type BillingInvoiceStatusCountsResponse = {
    data: BillingInvoiceStatusCounts;
};

export type BillingFinancialControlsSummary = {
    generatedAt: string | null;
    window: {
        from: string | null;
        to: string | null;
        asOf: string | null;
        currencyCode: string | null;
        payerType: string | null;
    };
    outstanding: {
        invoiceCount: number;
        balanceAmountTotal: number;
        overdueInvoiceCount: number;
        overdueBalanceAmountTotal: number;
        averageDaysOverdue: number;
    };
    agingBuckets: {
        current: { invoiceCount: number; balanceAmountTotal: number };
        days_1_30: { invoiceCount: number; balanceAmountTotal: number };
        days_31_60: { invoiceCount: number; balanceAmountTotal: number };
        days_61_90: { invoiceCount: number; balanceAmountTotal: number };
        days_over_90: { invoiceCount: number; balanceAmountTotal: number };
    };
    denials: {
        deniedClaimCount: number;
        partialDeniedClaimCount: number;
        deniedAmountTotal: number;
        topReasons: Array<{
            reason: string;
            claimCount: number;
            deniedAmountTotal: number;
        }>;
    };
    settlement: {
        approvedAmountTotal: number;
        settledAmountTotal: number;
        pendingSettlementAmount: number;
        settlementRatePercent: number;
        reconciliationStatusCounts: {
            pending: number;
            partial_settled: number;
            settled: number;
            other: number;
            total: number;
        };
    };
};

export type PatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
};

export type PatientResponse = {
    data: PatientSummary;
};

export type AppointmentSummary = {
    id: string;
    appointmentNumber: string | null;
    patientId: string | null;
    department: string | null;
    scheduledAt: string | null;
    durationMinutes: number | null;
    reason: string | null;
    financialClass: string | null;
    billingPayerContractId: string | null;
    coverageReference: string | null;
    coverageNotes: string | null;
    status:
        | 'scheduled'
        | 'checked_in'
        | 'completed'
        | 'cancelled'
        | 'no_show'
        | string
        | null;
    statusReason: string | null;
};

export type AdmissionSummary = {
    id: string;
    admissionNumber: string | null;
    patientId: string | null;
    ward: string | null;
    bed: string | null;
    admittedAt: string | null;
    financialClass: string | null;
    billingPayerContractId: string | null;
    coverageReference: string | null;
    coverageNotes: string | null;
    status:
        | 'admitted'
        | 'discharged'
        | 'transferred'
        | 'cancelled'
        | string
        | null;
    statusReason: string | null;
};

export type AppointmentResponse = {
    data: AppointmentSummary;
};

export type AdmissionResponse = {
    data: AdmissionSummary;
};

export type LinkedContextListResponse<T> = {
    data: T[];
    meta?: {
        currentPage?: number;
        perPage?: number;
        total?: number;
        lastPage?: number;
    };
};

export type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
    code?: string;
};

export type AuthPermissionsResponse = {
    data?: Array<{ name?: string | null }>;
    meta?: { total?: number | null };
};

export type SearchForm = {
    q: string;
    patientId: string;
    status: string;
    statusIn: string[];
    currencyCode: string;
    from: string;
    to: string;
    paymentActivityFrom: string;
    paymentActivityTo: string;
    perPage: number;
    page: number;
};

export type BillingWorkspaceView = 'queue' | 'board' | 'create';
export type CreateContextLinkSource = 'none' | 'route' | 'auto' | 'manual';
export type CreateContextEditorTab = 'patient' | 'appointment' | 'admission';
export type InvoiceDetailsTab = 'overview' | 'workflows' | 'audit';

export type InvoiceWorkflowLink = {
    key: string;
    label: string;
    helper: string;
    href: string;
    icon: string;
};

export type InvoiceDetailsOperationalCard = {
    id: string;
    title: string;
    value: string;
    helper: string;
    badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
};

export type InvoiceDetailsOperationalPanel = {
    heading: string;
    title: string;
    description: string;
    toneClass: string;
    cards: InvoiceDetailsOperationalCard[];
};

export type InvoiceDetailsOperationalAction = {
    key: string;
    title: string;
    description: string;
    label: string;
    icon: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    detailRows?: Array<{
        label: string;
        value: string;
    }>;
    href?: string;
    onClick?: () => void;
};

export type BillingDialogPreviewCard = {
    title: string;
    value: string;
    helper: string;
    valueClass?: string;
};

export type BillingServiceCatalogItem = {
    id: string;
    serviceCode: string | null;
    serviceName: string | null;
    serviceType: string | null;
    department: string | null;
    unit: string | null;
    basePrice: string | number | null;
    currencyCode: string | null;
    taxRatePercent: string | number | null;
    isTaxable: boolean | null;
    description: string | null;
    status: string | null;
};

export type BillingPayerContract = {
    id: string;
    contractCode: string | null;
    contractName: string | null;
    payerType: string | null;
    payerName: string | null;
    payerPlanCode: string | null;
    payerPlanName: string | null;
    currencyCode: string | null;
    defaultCoveragePercent: string | number | null;
    defaultCopayType: 'fixed' | 'percentage' | 'none' | string | null;
    defaultCopayValue: string | number | null;
    requiresPreAuthorization: boolean | null;
    claimSubmissionDeadlineDays: number | null;
    settlementCycleDays: number | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    status: string | null;
};

export type BillingPayerContractListResponse = {
    data: BillingPayerContract[];
    meta?: {
        currentPage?: number;
        perPage?: number;
        total?: number;
        lastPage?: number;
    };
};

export type BillingInvoicePayerSummary = {
    settlementPath: string | null;
    payerType: string | null;
    payerName: string | null;
    contractId: string | null;
    contractCode: string | null;
    contractName: string | null;
    currencyCode: string | null;
    coveragePercent: string | number | null;
    coveredAmountByPercent: string | number | null;
    copayType: string | null;
    copayValue: string | number | null;
    copayAmount: string | number | null;
    expectedPayerAmount: string | number | null;
    expectedPatientAmount: string | number | null;
    requiresPreAuthorization: boolean | null;
    claimSubmissionDeadlineDays: number | null;
    claimSubmissionDueAt: string | null;
    settlementCycleDays: number | null;
};

export type BillingInvoiceClaimReadiness = {
    claimEligible: boolean;
    ready: boolean;
    state: string | null;
    blockingReasons: string[];
    guidance: string[];
    requiresPreAuthorization: boolean;
    requiresManualAuthorization: boolean;
    authorizationSummary?: BillingInvoiceAuthorizationSummary;
    coverageSummary?: BillingInvoiceCoverageSummary;
    expectedClaimAmount: string | number | null;
    claimSubmissionDueAt: string | null;
};

export type BillingInvoicePayerPreview = {
    selectedContract: BillingPayerContract | null;
    selectedContractMissing: boolean;
    settlementPathLabel: string;
    statusLabel: string;
    statusTone: 'default' | 'secondary' | 'outline' | 'destructive';
    totalAmount: number;
    expectedPayerAmount: number;
    expectedPatientAmount: number;
    coveragePercent: number;
    copayType: string | null;
    copayValue: number;
    copayAmount: number;
    requiresPreAuthorization: boolean;
    claimEligible: boolean;
    claimReady: boolean;
    currencyCode: string;
    currencyMismatch: boolean;
    effectiveWindowMismatch: boolean;
    blockingReasons: string[];
    guidance: string[];
};

export type BillingInvoiceCoveragePosture = {
    state:
        | 'contract_link_required'
        | 'coverage_review_required'
        | 'coverage_exception'
        | 'preauthorization_required'
        | 'authorization_required'
        | 'rule_based_cover'
        | 'contract_default'
        | 'no_claim_route'
        | 'not_applicable';
    label: string;
    description: string;
    badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
    toneClass: string;
};

export type BillingDraftExecutionPreview = {
    title: string;
    helper: string;
    badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
    toneClass: string;
    afterIssueLabel: string;
    afterIssueHelper: string;
};

export type BillingServiceCatalogListResponse = {
    data: BillingServiceCatalogItem[];
    meta?: {
        currentPage?: number;
        perPage?: number;
        total?: number;
        lastPage?: number;
    };
};

export type CreateForm = {
    patientId: string;
    appointmentId: string;
    admissionId: string;
    billingPayerContractId: string;
    invoiceDate: string;
    currencyCode: string;
    subtotalAmount: string;
    discountAmount: string;
    taxAmount: string;
    paidAmount: string;
    paymentDueAt: string;
    notes: string;
    lineItems: BillingInvoiceLineItemDraft[];
};

export type BillingCreateCoverageMode = 'self_pay' | 'third_party';
export type BillingQueueLaneFilter =
    | 'all'
    | 'cashier_collection'
    | 'third_party_settlement';
export type BillingQueueThirdPartyPhaseFilter =
    | 'all'
    | 'claim_submission'
    | 'remittance_reconciliation';

export type BillingInvoicePayment = {
    id: string;
    billingInvoiceId: string | null;
    recordedByUserId: number | null;
    paymentAt: string | null;
    amount: string | number | null;
    cumulativePaidAmount: string | number | null;
    entryType: 'payment' | 'reversal' | string | null;
    reversalOfPaymentId: string | null;
    reversalReason: string | null;
    approvalCaseReference: string | null;
    payerType: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
    sourceAction: string | null;
    note: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

export type BillingInvoicePaymentListResponse = {
    data: BillingInvoicePayment[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

export type BillingInvoiceAuditLog = {
    id: string;
    billingInvoiceId: string | null;
    actorId: number | null;
    actorType: 'system' | 'user' | string | null;
    actor?: AuditActorSummary | null;
    action: string | null;
    actionLabel?: string | null;
    changes: Record<string, unknown> | unknown[] | null;
    metadata: Record<string, unknown> | unknown[] | null;
    createdAt: string | null;
};

export type BillingInvoiceAuditLogListResponse = {
    data: BillingInvoiceAuditLog[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

export type BillingInvoiceAuditExportJob = {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | string;
    rowCount: number | null;
    schemaVersion: string | null;
    errorMessage: string | null;
    createdAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    downloadUrl: string | null;
};

export type BillingInvoiceAuditExportJobResponse = {
    data: BillingInvoiceAuditExportJob;
};

export type BillingInvoiceAuditExportJobListResponse = {
    data: BillingInvoiceAuditExportJob[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

export type AuditExportJobStatusSummary = {
    total: number;
    completed: number;
    failed: number;
    queued: number;
    processing: number;
    backlog: number;
    other: number;
};

export type AuditExportStatusGroup = 'all' | 'failed' | 'backlog' | 'completed';

export type RecordBillingInvoicePaymentResponse = {
    data: {
        invoice: BillingInvoice;
        payment: BillingInvoicePayment;
    };
};

export type ReverseBillingInvoicePaymentResponse = {
    data: {
        invoice: BillingInvoice;
        reversal: BillingInvoicePayment;
    };
};

export type InvoiceDetailsPaymentsFilterForm = {
    q: string;
    payerType: string;
    paymentMethod: string;
    from: string;
    to: string;
    perPage: number;
};

export type InvoiceDetailsAuditLogsFilterForm = {
    q: string;
    action: string;
    actorType: string;
    actorId: string;
    from: string;
    to: string;
    perPage: number;
    page: number;
};

export type InvoiceDetailsAuditExportJobsFilterForm = {
    statusGroup: AuditExportStatusGroup;
    perPage: number;
    page: number;
};

export type BillingAuditExportRetryHandoffContext = {
    targetInvoiceId: string;
    jobId: string;
    statusGroup: AuditExportStatusGroup;
    page: number;
    perPage: number;
    savedAt: string;
};

export type BillingAuditExportRetryResumeTelemetry = {
    attempts: number;
    successes: number;
    failures: number;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastFailureReason: string | null;
};

export type BillingAuditExportRetryResumeTelemetryEventContext = {
    targetResourceId: string;
    exportJobId: string;
    handoffStatusGroup: AuditExportStatusGroup;
    handoffPage: number;
    handoffPerPage: number;
};

export type BillingClaimReferenceValidationFailureReason =
    | 'missing'
    | 'template'
    | 'format';

export type BillingClaimReferenceValidationTelemetry = {
    sessionStartedAt: string | null;
    lastUpdatedAt: string | null;
    totalFailures: number;
    recentWindowFailures: number;
    recentWindowStartedAt: string | null;
    lastFailureAt: string | null;
    lastFailureReason: BillingClaimReferenceValidationFailureReason | null;
    byReason: Record<string, number>;
    byPayerType: Record<string, number>;
    byPaymentMethod: Record<string, number>;
};

export type BillingClaimReferenceValidationPolicySource =
    | 'default'
    | 'env'
    | 'profile_override';

export type BillingClaimReferenceValidationPolicyOverrideResolution =
    | 'exact_profile_override'
    | 'default_override_fallback'
    | 'no_override';

export type BillingClaimReferenceValidationPolicyEnvDiagnostic = {
    key: string;
    raw: string;
    fallback: number;
};

export type BillingClaimReferenceValidationPolicyOverridesParseDiagnostic = {
    kind: 'invalid_json' | 'invalid_root';
    raw: string;
    detail: string;
};

export type BillingClaimReferenceValidationPolicyOverridesQualityDiagnostic =
    | {
          kind: 'empty_profile_key';
          rawProfileKey: string;
      }
    | {
          kind: 'invalid_profile_value';
          profileKey: string;
          detail: string;
      }
    | {
          kind: 'unknown_field';
          profileKey: string;
          field: string;
      }
    | {
          kind: 'clamped_field_value';
          profileKey: string;
          field: keyof BillingClaimReferenceValidationPolicyNumeric;
          raw: string;
          direction: 'below_min' | 'above_max';
          min: number;
          max: number;
          applied: number;
      };

export type BillingClaimReferenceValidationPolicyNumeric = {
    windowMinutes: number;
    inactivityMinutes: number;
    maxSessionAgeHours: number;
    frequentFailureThreshold: number;
};

export type BillingClaimReferenceValidationPolicyField =
    keyof BillingClaimReferenceValidationPolicyNumeric;

export type BillingClaimReferenceValidationPolicyCoverage = {
    explicitFields: BillingClaimReferenceValidationPolicyField[];
    inheritedFields: BillingClaimReferenceValidationPolicyField[];
};

export type BillingClaimReferenceValidationPolicyProfileProvenance =
    | 'facility_code_hit'
    | 'tenant_code_hit'
    | 'default_scope';

export type BillingClaimReferenceValidationPolicyProfileContext = {
    key: string;
    provenance: BillingClaimReferenceValidationPolicyProfileProvenance;
    facilityCodeRaw: string | null;
    tenantCodeRaw: string | null;
    facilityCode: string | null;
    tenantCode: string | null;
};

export type BillingClaimReferenceValidationPolicySelectionMismatch = {
    selectedKey: string;
    selectedProvenance: BillingClaimReferenceValidationPolicyProfileProvenance;
    alternateKey: string;
    alternateProvenance: BillingClaimReferenceValidationPolicyProfileProvenance;
};

export type BillingClaimReferenceValidationPolicyOverride =
    Partial<BillingClaimReferenceValidationPolicyNumeric>;

export type BillingClaimReferenceValidationPolicy = {
    windowMinutes: number;
    inactivityMinutes: number;
    maxSessionAgeHours: number;
    frequentFailureThreshold: number;
    profileKey: string;
    profileProvenance: BillingClaimReferenceValidationPolicyProfileProvenance;
    profileProvenanceContext: {
        facilityCodeRaw: string | null;
        tenantCodeRaw: string | null;
        facilityCode: string | null;
        tenantCode: string | null;
    };
    profileSelectionMismatch: BillingClaimReferenceValidationPolicySelectionMismatch | null;
    overrideResolution: BillingClaimReferenceValidationPolicyOverrideResolution;
    overrideMatchedKey: string | null;
    envDiagnostics: BillingClaimReferenceValidationPolicyEnvDiagnostic[];
    overridesParseDiagnostic: BillingClaimReferenceValidationPolicyOverridesParseDiagnostic | null;
    overridesQualityDiagnostics: BillingClaimReferenceValidationPolicyOverridesQualityDiagnostic[];
    overrideCoverage: BillingClaimReferenceValidationPolicyCoverage;
    sources: {
        overall: BillingClaimReferenceValidationPolicySource;
        windowMinutes: BillingClaimReferenceValidationPolicySource;
        inactivityMinutes: BillingClaimReferenceValidationPolicySource;
        maxSessionAgeHours: BillingClaimReferenceValidationPolicySource;
        frequentFailureThreshold: BillingClaimReferenceValidationPolicySource;
    };
};

export type BillingInvoiceLineItemDraft = {
    key: string;
    entryMode: 'catalog' | 'manual';
    catalogItemId: string;
    description: string;
    quantity: string;
    unitPrice: string;
    serviceCode: string;
    unit: string;
    notes: string;
    sourceWorkflowKind: string;
    sourceWorkflowId: string;
    sourceWorkflowLabel: string;
    sourcePerformedAt: string;
};

export type BillingInvoiceStatusAction =
    | 'issued'
    | 'record_payment'
    | 'partially_paid'
    | 'paid'
    | 'cancelled'
    | 'voided';
