<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type StatusCounts = { active: number; inactive: number; retired: number; other: number; total: number };
type ContractStatus = 'active' | 'inactive' | 'retired';
type PayerType = 'insurance' | 'employer' | 'government' | 'donor' | 'self_pay' | 'other';
type Contract = {
    id: string | null;
    contractCode: string | null;
    contractName: string | null;
    payerType: string | null;
    payerName: string | null;
    payerPlanCode: string | null;
    payerPlanName: string | null;
    currencyCode: string | null;
    defaultCoveragePercent: string | null;
    defaultCopayType: string | null;
    defaultCopayValue: string | null;
    requiresPreAuthorization: boolean | null;
    claimSubmissionDeadlineDays: number | null;
    settlementCycleDays: number | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    termsAndNotes?: string | null;
    status: string | null;
    statusReason: string | null;
    metadata?: Record<string, unknown> | null;
    updatedAt: string | null;
};
type Rule = {
    id: string | null;
    billingServiceCatalogItemId: string | null;
    ruleCode: string | null;
    ruleName: string | null;
    serviceCode: string | null;
    serviceType: string | null;
    department: string | null;
    diagnosisCode: string | null;
    priority: string | null;
    minPatientAgeYears: number | null;
    maxPatientAgeYears: number | null;
    gender: string | null;
    amountThreshold: string | null;
    quantityLimit: number | null;
    coverageDecision: string | null;
    coveragePercentOverride: string | null;
    copayType: string | null;
    copayValue: string | null;
    benefitLimitAmount: string | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    requiresAuthorization: boolean | null;
    autoApprove: boolean | null;
    authorizationValidityDays: number | null;
    ruleNotes?: string | null;
    ruleExpression?: Record<string, unknown> | null;
    status: string | null;
    statusReason: string | null;
    updatedAt: string | null;
};
type RuleExpressionClause = {
    field: string;
    operator: string;
    value: string | number | boolean | null;
};
type RuleExpression = {
    all: RuleExpressionClause[];
    window: {
        effectiveFrom: string | null;
        effectiveTo: string | null;
    };
    outcome: {
        coverageDecision: string;
        coveragePercentOverride: number | null;
        copayType: string | null;
        copayValue: number | null;
        benefitLimitAmount: number | null;
        requiresAuthorization: boolean;
        autoApprove: boolean;
        authorizationValidityDays: number | null;
    };
};
type PriceOverride = {
    id: string | null;
    billingPayerContractId: string | null;
    billingServiceCatalogItemId: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    serviceType: string | null;
    department: string | null;
    currencyCode: string | null;
    pricingStrategy: string | null;
    overrideValue: string | null;
    catalogPricingStatus: string | null;
    catalogBasePrice: string | null;
    catalogCurrencyCode: string | null;
    resolvedNegotiatedPrice: string | null;
    varianceAmount: string | null;
    variancePercent: string | null;
    varianceDirection: string | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    overrideNotes?: string | null;
    status: string | null;
    statusReason: string | null;
    updatedAt: string | null;
};
type AuditLog = {
    id: string;
    action: string | null;
    actionLabel?: string | null;
    actorId: number | null;
    actor?: { displayName?: string | null } | null;
    changes: Record<string, unknown> | unknown[] | null;
    createdAt: string | null;
};
type CatalogItem = {
    id: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    serviceType: string | null;
    department: string | null;
    basePrice: string | null;
    currencyCode: string | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    status: string | null;
};
type ApiError = { message?: string };
type ListResponse<T> = { data: T[]; meta: Pagination };
type ItemResponse<T> = { data: T };
type CountsResponse = { data: StatusCounts };
type AuditResponse = { data: AuditLog[]; meta: Pagination };
type PriceCatalogListResponse = { data: CatalogItem[]; meta: Pagination };
type PolicySummaryResponse = { data: PolicySummary };
type PriceOverrideFormState = {
    billingServiceCatalogItemId: string;
    serviceCode: string;
    serviceName: string;
    serviceType: string;
    department: string;
    pricingStrategy: string;
    overrideValue: string;
    effectiveFrom: string;
    effectiveTo: string;
    overrideNotes: string;
};
type RuleFormState = {
    billingServiceCatalogItemId: string;
    ruleCode: string;
    ruleName: string;
    serviceCode: string;
    serviceType: string;
    department: string;
    diagnosisCode: string;
    priority: string;
    minPatientAgeYears: string;
    maxPatientAgeYears: string;
    gender: string;
    amountThreshold: string;
    quantityLimit: string;
    coverageDecision: string;
    coveragePercentOverride: string;
    copayType: string;
    copayValue: string;
    benefitLimitAmount: string;
    effectiveFrom: string;
    effectiveTo: string;
    requiresAuthorization: string;
    autoApprove: string;
    authorizationValidityDays: string;
    ruleNotes: string;
};
type PolicySummaryOverview = {
    activePolicies: number;
    serviceFamilies: number;
    coveredPolicies: number;
    excludedPolicies: number;
    manualReviewPolicies: number;
    authorizationRequiredPolicies: number;
    autoApprovePolicies: number;
    benefitBandPolicies: number;
};
type PolicyFamilyMatrixRow = {
    key: string;
    label: string;
    policyCount: number;
    specificServiceCount: number;
    coveredPolicyCount: number;
    excludedPolicyCount: number;
    manualReviewPolicyCount: number;
    requiresAuthorizationCount: number;
    autoApproveCount: number;
    benefitBandCount: number;
    windowedPolicyCount: number;
    dominantDecision: string;
    coverageOverrideMin: string | null;
    coverageOverrideMax: string | null;
};
type PolicyBenefitBand = {
    ruleId: string | null;
    ruleCode: string | null;
    ruleName: string | null;
    serviceType: string | null;
    serviceCode: string | null;
    department: string | null;
    coverageDecision: string | null;
    coveragePercentOverride: string | null;
    copayType: string | null;
    copayValue: string | null;
    amountThreshold: string | null;
    quantityLimit: number | null;
    benefitLimitAmount: string | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    requiresAuthorization: boolean;
    autoApprove: boolean;
};
type PolicySummary = {
    overview: PolicySummaryOverview;
    familyMatrix: PolicyFamilyMatrixRow[];
    benefitBands: PolicyBenefitBand[];
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing Invoices', href: '/billing-invoices' },
    { title: 'Payer Contracts', href: '/billing-payer-contracts' },
];

const { permissionState, scope, multiTenantIsolationEnabled } = usePlatformAccess();
const { activeCurrencyCode, loadCountryProfile } = usePlatformCountryProfile();
const canRead = computed(() => permissionState('billing.payer-contracts.read') === 'allowed');
const canManage = computed(() => permissionState('billing.payer-contracts.manage') === 'allowed');
const canAudit = computed(() => permissionState('billing.payer-contracts.view-audit-logs') === 'allowed');
const canReadServiceCatalog = computed(() => permissionState('billing.service-catalog.read') === 'allowed');
const canManagePriceOverrides = computed(() => permissionState('billing.payer-contracts.manage-price-overrides') === 'allowed');
const canPriceOverrideAudit = computed(() => permissionState('billing.payer-contracts.view-price-override-audit-logs') === 'allowed');
const canManageRules = computed(() => permissionState('billing.payer-contracts.manage-authorization-rules') === 'allowed');
const canRuleAudit = computed(() => permissionState('billing.payer-contracts.view-authorization-audit-logs') === 'allowed');
const defaultCurrencyCode = computed(() => activeCurrencyCode.value || 'TZS');
const payerTypeOptions: PayerType[] = ['insurance', 'employer', 'government', 'donor', 'self_pay', 'other'];
const serviceTypeOptions = ['consultation', 'laboratory', 'radiology', 'pharmacy', 'procedure', 'admission', 'theatre', 'imaging', 'consumable', 'other'];
const priorityOptions = ['routine', 'urgent', 'stat', 'emergency'] as const;
const genderOptions = ['any', 'male', 'female', 'other', 'unknown'] as const;
const coverageDecisionOptions = ['inherit', 'covered', 'covered_with_rule', 'excluded', 'manual_review'] as const;

const loading = ref(true);
const listLoading = ref(false);
const listErrors = ref<string[]>([]);
const contracts = ref<Contract[]>([]);
const pagination = ref<Pagination | null>(null);
const counts = ref<StatusCounts>({ active: 0, inactive: 0, retired: 0, other: 0, total: 0 });
const filters = reactive({ q: '', status: '', payerType: '', page: 1, perPage: 20 });
const contractWorkspaceMode = ref<'list' | 'create'>('list');
const copayTypeOptions = ['none', 'fixed', 'percentage'] as const;

const createLoading = ref(false);
const createForm = reactive({
    contractCode: '',
    contractName: '',
    payerType: 'insurance',
    payerName: '',
    payerPlanCode: '',
    payerPlanName: '',
    currencyCode: defaultCurrencyCode.value,
    defaultCoveragePercent: '',
    defaultCopayType: 'none',
    defaultCopayValue: '',
    requiresPreAuthorization: 'true',
    claimSubmissionDeadlineDays: '',
    settlementCycleDays: '',
    effectiveFrom: '',
    effectiveTo: '',
    termsAndNotes: '',
});

const editContractOpen = ref(false);
const editContractLoading = ref(false);
const editContractTarget = ref<Contract | null>(null);
const editContractForm = reactive({
    contractCode: '',
    contractName: '',
    payerType: 'insurance',
    payerName: '',
    payerPlanCode: '',
    payerPlanName: '',
    currencyCode: defaultCurrencyCode.value,
    defaultCoveragePercent: '',
    defaultCopayType: 'none',
    defaultCopayValue: '',
    requiresPreAuthorization: 'true',
    claimSubmissionDeadlineDays: '',
    settlementCycleDays: '',
    effectiveFrom: '',
    effectiveTo: '',
    termsAndNotes: '',
});

const contractStatusOpen = ref(false);
const contractStatusLoading = ref(false);
const contractStatusError = ref<string | null>(null);
const contractStatusTarget = ref<'active' | 'inactive' | 'retired'>('active');
const contractStatusReason = ref('');
const contractStatusItem = ref<Contract | null>(null);

const emptyPolicySummaryOverview: PolicySummaryOverview = {
    activePolicies: 0,
    serviceFamilies: 0,
    coveredPolicies: 0,
    excludedPolicies: 0,
    manualReviewPolicies: 0,
    authorizationRequiredPolicies: 0,
    autoApprovePolicies: 0,
    benefitBandPolicies: 0,
};

const selectedContract = ref<Contract | null>(null);
const policySummaryLoading = ref(false);
const policySummaryError = ref<string | null>(null);
const policySummary = ref<PolicySummary | null>(null);
const priceOverridesLoading = ref(false);
const priceOverrideErrors = ref<string[]>([]);
const priceOverrides = ref<PriceOverride[]>([]);
const priceOverridesPagination = ref<Pagination | null>(null);
const priceOverrideFilters = reactive({ q: '', status: '', serviceType: '', pricingStrategy: '', page: 1, perPage: 20 });
const serviceCatalogLookupLoading = ref(false);
const serviceCatalogLookupError = ref<string | null>(null);
const serviceCatalogLookupItems = ref<CatalogItem[]>([]);

const createPriceOverrideLoading = ref(false);
const createPriceOverrideForm = reactive({
    billingServiceCatalogItemId: '',
    serviceCode: '',
    serviceName: '',
    serviceType: '',
    department: '',
    pricingStrategy: 'fixed_price',
    overrideValue: '',
    effectiveFrom: '',
    effectiveTo: '',
    overrideNotes: '',
});

const editPriceOverrideOpen = ref(false);
const editPriceOverrideLoading = ref(false);
const editPriceOverrideTarget = ref<PriceOverride | null>(null);
const editPriceOverrideForm = reactive({
    billingServiceCatalogItemId: '',
    serviceCode: '',
    serviceName: '',
    serviceType: '',
    department: '',
    pricingStrategy: 'fixed_price',
    overrideValue: '',
    effectiveFrom: '',
    effectiveTo: '',
    overrideNotes: '',
});

const priceOverrideStatusOpen = ref(false);
const priceOverrideStatusLoading = ref(false);
const priceOverrideStatusError = ref<string | null>(null);
const priceOverrideStatusTarget = ref<'active' | 'inactive' | 'retired'>('active');
const priceOverrideStatusReason = ref('');
const priceOverrideStatusItem = ref<PriceOverride | null>(null);

const rulesLoading = ref(false);
const rulesErrors = ref<string[]>([]);
const rules = ref<Rule[]>([]);
const rulesPagination = ref<Pagination | null>(null);
const ruleFilters = reactive({ q: '', status: '', serviceType: '', coverageDecision: '', page: 1, perPage: 20 });

const createRuleLoading = ref(false);
const createRuleForm = reactive({
    billingServiceCatalogItemId: '',
    ruleCode: '',
    ruleName: '',
    serviceCode: '',
    serviceType: '',
    department: '',
    diagnosisCode: '',
    priority: '',
    minPatientAgeYears: '',
    maxPatientAgeYears: '',
    gender: 'any',
    amountThreshold: '',
    quantityLimit: '',
    coverageDecision: 'covered_with_rule',
    coveragePercentOverride: '',
    copayType: 'none',
    copayValue: '',
    benefitLimitAmount: '',
    effectiveFrom: '',
    effectiveTo: '',
    requiresAuthorization: 'true',
    autoApprove: 'false',
    authorizationValidityDays: '',
    ruleNotes: '',
});

const editRuleOpen = ref(false);
const editRuleLoading = ref(false);
const editRuleTarget = ref<Rule | null>(null);
const editRuleForm = reactive({
    billingServiceCatalogItemId: '',
    ruleCode: '',
    ruleName: '',
    serviceCode: '',
    serviceType: '',
    department: '',
    diagnosisCode: '',
    priority: '',
    minPatientAgeYears: '',
    maxPatientAgeYears: '',
    gender: 'any',
    amountThreshold: '',
    quantityLimit: '',
    coverageDecision: 'covered_with_rule',
    coveragePercentOverride: '',
    copayType: 'none',
    copayValue: '',
    benefitLimitAmount: '',
    effectiveFrom: '',
    effectiveTo: '',
    requiresAuthorization: 'true',
    autoApprove: 'false',
    authorizationValidityDays: '',
    ruleNotes: '',
});

const ruleStatusOpen = ref(false);
const ruleStatusLoading = ref(false);
const ruleStatusError = ref<string | null>(null);
const ruleStatusTarget = ref<'active' | 'inactive' | 'retired'>('active');
const ruleStatusReason = ref('');
const ruleStatusItem = ref<Rule | null>(null);

const contractAuditTarget = ref<Contract | null>(null);
const contractAuditLoading = ref(false);
const contractAuditError = ref<string | null>(null);
const contractAuditExporting = ref(false);
const contractAuditLogs = ref<AuditLog[]>([]);

const ruleAuditTarget = ref<Rule | null>(null);
const ruleAuditLoading = ref(false);
const ruleAuditError = ref<string | null>(null);
const ruleAuditExporting = ref(false);
const ruleAuditLogs = ref<AuditLog[]>([]);
const priceOverrideAuditTarget = ref<PriceOverride | null>(null);
const priceOverrideAuditLoading = ref(false);
const priceOverrideAuditError = ref<string | null>(null);
const priceOverrideAuditExporting = ref(false);
const priceOverrideAuditLogs = ref<AuditLog[]>([]);

const contractShowInitialSkeleton = computed(() => loading.value);
const contractListRefreshing = computed(() => listLoading.value && !loading.value);
const contractActiveFilterChips = computed(() => {
    const chips: string[] = [];
    if (filters.status) chips.push(`Status: ${formatEnumLabel(filters.status)}`);
    if (filters.payerType) chips.push(`Payer type: ${formatEnumLabel(filters.payerType)}`);
    if (filters.q.trim()) chips.push(`Search: ${filters.q.trim()}`);
    return chips;
});
const contractWorkspaceFocusLabel = computed(() => {
    const parts = [filters.status ? formatEnumLabel(filters.status) : 'All contract statuses'];
    parts.push(filters.payerType ? `${formatEnumLabel(filters.payerType)} payers` : 'All payer types');
    return parts.join(' | ');
});
const contractCreateReady = computed(() => {
    return Boolean(
        createForm.contractCode.trim()
        && createForm.contractName.trim()
        && createForm.payerName.trim()
        && createForm.currencyCode.trim(),
    );
});
const contractCreateSummary = computed(() => ({
    identity: createForm.contractCode.trim() && createForm.contractName.trim()
        ? `${createForm.contractCode.trim()} | ${createForm.contractName.trim()}`
        : 'Contract identity pending',
    payer: createForm.payerName.trim()
        ? `${createForm.payerName.trim()} | ${formatEnumLabel(createForm.payerType)}`
        : `${formatEnumLabel(createForm.payerType)} payer pending`,
    billing: `${(createForm.currencyCode.trim() || defaultCurrencyCode.value).toUpperCase()} | ${createForm.defaultCoveragePercent.trim() ? `${createForm.defaultCoveragePercent.trim()}% cover` : 'Coverage pending'}`,
}));
const activeRuleCount = computed(() => rules.value.filter((item) => (item.status ?? '').toLowerCase() === 'active').length);
const activeAuthorizationRequiredRuleCount = computed(() => rules.value.filter((item) => (item.status ?? '').toLowerCase() === 'active' && item.requiresAuthorization === true).length);
const activeAutoApproveRuleCount = computed(() => rules.value.filter((item) => (item.status ?? '').toLowerCase() === 'active' && item.autoApprove === true).length);
const activeScopedRuleCount = computed(() => rules.value.filter((item) => (item.status ?? '').toLowerCase() === 'active' && (item.serviceCode || item.serviceType)).length);
const activeExcludedRuleCount = computed(() => rules.value.filter((item) => (item.status ?? '').toLowerCase() === 'active' && (item.coverageDecision ?? '').toLowerCase() === 'excluded').length);
const activeManualReviewRuleCount = computed(() => rules.value.filter((item) => (item.status ?? '').toLowerCase() === 'active' && (item.coverageDecision ?? '').toLowerCase() === 'manual_review').length);
const activeCoveredPolicyRuleCount = computed(() => rules.value.filter((item) => (item.status ?? '').toLowerCase() === 'active' && ['covered', 'covered_with_rule'].includes((item.coverageDecision ?? '').toLowerCase())).length);
const activePriceOverrideCount = computed(() => priceOverrides.value.filter((item) => (item.status ?? '').toLowerCase() === 'active').length);
const activeFixedPriceOverrideCount = computed(() => priceOverrides.value.filter((item) => (item.status ?? '').toLowerCase() === 'active' && (item.pricingStrategy ?? '').toLowerCase() === 'fixed_price').length);
const activeDiscountPriceOverrideCount = computed(() => priceOverrides.value.filter((item) => (item.status ?? '').toLowerCase() === 'active' && (item.pricingStrategy ?? '').toLowerCase() === 'discount_percent').length);
const serviceCatalogPriceOptions = computed<SearchableSelectOption[]>(() =>
    serviceCatalogLookupItems.value
        .map((item) => {
            const serviceCode = normalizeServiceCode(item.serviceCode);
            if (!serviceCode) return null;

            return {
                value: serviceCode,
                label: item.serviceName?.trim() || serviceCode,
                description: [
                    serviceCode,
                    item.serviceType ? formatEnumLabel(item.serviceType) : null,
                    item.department?.trim() || null,
                    item.basePrice?.trim() ? `${(item.currencyCode || defaultCurrencyCode.value).toUpperCase()} ${item.basePrice.trim()}` : null,
                ].filter(Boolean).join(' | '),
                keywords: [
                    serviceCode,
                    item.serviceName?.trim() || '',
                    item.serviceType?.trim() || '',
                    item.department?.trim() || '',
                ].filter(Boolean),
                group: item.serviceType ? formatEnumLabel(item.serviceType) : 'Other services',
            } satisfies SearchableSelectOption;
        })
        .filter((item): item is SearchableSelectOption => item !== null),
);
const createPriceOverrideServiceOptions = computed<SearchableSelectOption[]>(() =>
    withSyntheticServiceOption(
        serviceCatalogPriceOptions.value,
        createPriceOverrideForm.serviceCode,
        createPriceOverrideForm.serviceName,
        createPriceOverrideForm.serviceType,
        createPriceOverrideForm.department,
    ),
);
const editPriceOverrideServiceOptions = computed<SearchableSelectOption[]>(() =>
    withSyntheticServiceOption(
        serviceCatalogPriceOptions.value,
        editPriceOverrideForm.serviceCode,
        editPriceOverrideForm.serviceName,
        editPriceOverrideForm.serviceType,
        editPriceOverrideForm.department,
    ),
);
const selectedCreatePriceCatalogItem = computed(() => findCatalogItemForPriceOverrideForm(createPriceOverrideForm));
const selectedEditPriceCatalogItem = computed(() => findCatalogItemForPriceOverrideForm(editPriceOverrideForm));
const createRuleServiceOptions = computed<SearchableSelectOption[]>(() =>
    withSyntheticRuleServiceOption(
        serviceCatalogPriceOptions.value,
        createRuleForm.serviceCode,
        createRuleForm.serviceType,
        createRuleForm.department,
    ),
);
const editRuleServiceOptions = computed<SearchableSelectOption[]>(() =>
    withSyntheticRuleServiceOption(
        serviceCatalogPriceOptions.value,
        editRuleForm.serviceCode,
        editRuleForm.serviceType,
        editRuleForm.department,
    ),
);
const selectedCreateRuleCatalogItem = computed(() => findCatalogItemByServiceCode(createRuleForm.serviceCode, createRuleForm.billingServiceCatalogItemId));
const selectedEditRuleCatalogItem = computed(() => findCatalogItemByServiceCode(editRuleForm.serviceCode, editRuleForm.billingServiceCatalogItemId));
const createPriceOverrideServiceLookupEnabled = computed(() => canReadServiceCatalog.value && !serviceCatalogLookupError.value);
const editPriceOverrideServiceLookupEnabled = computed(() => canReadServiceCatalog.value && !serviceCatalogLookupError.value);
const createRuleServiceLookupEnabled = computed(() => canReadServiceCatalog.value && !serviceCatalogLookupError.value);
const editRuleServiceLookupEnabled = computed(() => canReadServiceCatalog.value && !serviceCatalogLookupError.value);
const createPriceOverrideServiceHelperText = computed(() => {
    if (!canReadServiceCatalog.value) {
        return 'Service Prices access is unavailable, so manual entry is being used for this contract.';
    }
    if (serviceCatalogLookupLoading.value) {
        return 'Loading active Service Prices for this contract currency.';
    }
    if (serviceCatalogLookupError.value) {
        return 'Service Prices could not be loaded right now. Manual entry is available as a fallback.';
    }
    if (serviceCatalogLookupItems.value.length === 0) {
        return `No active Service Prices were found for ${(selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase()}.`;
    }
    return `Search active Service Prices in ${(selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase()}.`;
});
const editPriceOverrideServiceHelperText = computed(() => {
    if (!canReadServiceCatalog.value) {
        return 'Service Prices access is unavailable, so this override stays on manual service details.';
    }
    if (serviceCatalogLookupLoading.value) {
        return 'Loading active Service Prices for this contract currency.';
    }
    if (serviceCatalogLookupError.value) {
        return 'Service Prices could not be loaded right now. Manual service details remain available.';
    }
    return `Search active Service Prices in ${(selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase()}.`;
});
const createRuleServiceHelperText = computed(() => {
    if (!canReadServiceCatalog.value) {
        return 'Service Prices access is unavailable, so manual service targeting is being used.';
    }
    if (serviceCatalogLookupLoading.value) {
        return 'Loading active Service Prices for policy targeting.';
    }
    if (serviceCatalogLookupError.value) {
        return 'Service Prices could not be loaded right now. Manual service targeting is available as a fallback.';
    }
    return 'Search active Service Prices to bind this policy to a real billing service.';
});
const editRuleServiceHelperText = computed(() => {
    if (!canReadServiceCatalog.value) {
        return 'Service Prices access is unavailable, so this policy stays on manual service targeting.';
    }
    if (serviceCatalogLookupLoading.value) {
        return 'Loading active Service Prices for policy targeting.';
    }
    if (serviceCatalogLookupError.value) {
        return 'Service Prices could not be loaded right now. Manual service targeting remains available.';
    }
    return 'Search active Service Prices to keep this policy aligned to the billing service list.';
});
const createPriceOverrideValueHelperText = computed(() =>
    draftNegotiatedPriceImpactSummary(
        selectedCreatePriceCatalogItem.value,
        createPriceOverrideForm.pricingStrategy,
        createPriceOverrideForm.overrideValue,
        selectedContract.value?.currencyCode || defaultCurrencyCode.value,
    ),
);
const editPriceOverrideValueHelperText = computed(() =>
    draftNegotiatedPriceImpactSummary(
        selectedEditPriceCatalogItem.value,
        editPriceOverrideForm.pricingStrategy,
        editPriceOverrideForm.overrideValue,
        selectedContract.value?.currencyCode || defaultCurrencyCode.value,
    ),
);
const createRuleConditionsSummary = computed(() => ruleConditionsSummary(createRuleForm));
const editRuleConditionsSummary = computed(() => ruleConditionsSummary(editRuleForm));
const createRuleEngineSummary = computed(() => ruleEngineSummary(buildRuleExpression(createRuleForm)));
const editRuleEngineSummary = computed(() => ruleEngineSummary(buildRuleExpression(editRuleForm)));
const policySummaryOverview = computed<PolicySummaryOverview>(() => policySummary.value?.overview ?? emptyPolicySummaryOverview);
const selectedContractClaimsReadiness = computed(() => {
    const item = selectedContract.value;
    if (!item) {
        return { value: 'No contract selected', helper: 'Choose a contract to review claim readiness and contract policy posture.' };
    }
    if (policySummaryLoading.value && policySummary.value === null) {
        return { value: 'Loading policy summary', helper: 'Refreshing active coverage and authorization posture for this contract.' };
    }
    if (policySummaryError.value && policySummary.value === null) {
        return { value: 'Policy summary unavailable', helper: 'Review the contract policy board after the summary request succeeds.' };
    }

    const normalizedStatus = (item.status ?? '').toLowerCase();
    if (normalizedStatus === 'retired') {
        return { value: 'Retired contract', helper: 'This contract should no longer be used for new billing or claims work.' };
    }
    if (normalizedStatus === 'inactive') {
        return { value: 'Paused contract', helper: 'Reactivate the contract before using it for new billing or claims work.' };
    }
    if (item.requiresPreAuthorization && policySummaryOverview.value.authorizationRequiredPolicies === 0 && policySummaryOverview.value.activePolicies === 0) {
        return { value: 'Needs policy setup', helper: 'The contract requires pre-authorization by default, but no active coverage policies are set yet.' };
    }
    if (policySummaryOverview.value.activePolicies === 0) {
        return { value: 'Base contract only', helper: 'Claims can reference this contract, but there are no active service-level coverage policies yet.' };
    }
    if (policySummaryOverview.value.excludedPolicies > 0 || policySummaryOverview.value.manualReviewPolicies > 0) {
        return {
            value: 'Policy-controlled',
            helper: `${policySummaryOverview.value.excludedPolicies} excluded | ${policySummaryOverview.value.manualReviewPolicies} manual review | ${policySummaryOverview.value.coveredPolicies} covered policy rule${policySummaryOverview.value.coveredPolicies === 1 ? '' : 's'}.`,
        };
    }
    if (policySummaryOverview.value.authorizationRequiredPolicies > 0) {
        return { value: 'Authorization-controlled', helper: `${policySummaryOverview.value.authorizationRequiredPolicies} active policy rule${policySummaryOverview.value.authorizationRequiredPolicies === 1 ? '' : 's'} require authorization before claim progression.` };
    }
    if (policySummaryOverview.value.autoApprovePolicies > 0) {
        return { value: 'Auto-approval ready', helper: `${policySummaryOverview.value.autoApprovePolicies} active policy rule${policySummaryOverview.value.autoApprovePolicies === 1 ? '' : 's'} can move without manual authorization hold.` };
    }
    return { value: 'Claim-ready', helper: 'The contract is active and carries service-level policies without authorization hold requirements.' };
});
const selectedContractSummaryCards = computed(() => {
    const item = selectedContract.value;
    if (!item) return [];

    return [
        {
            key: 'status',
            label: 'Contract posture',
            value: formatEnumLabel(item.status || 'unknown'),
            helper: `${formatEnumLabel(item.payerType || 'unknown')} | ${item.payerName || 'Payer not set'}`,
        },
        {
            key: 'readiness',
            label: 'Claims readiness',
            value: selectedContractClaimsReadiness.value.value,
            helper: selectedContractClaimsReadiness.value.helper,
        },
        {
            key: 'coverage',
            label: 'Coverage posture',
            value: formatCoverageLabel(item.defaultCoveragePercent, item.defaultCopayType, item.defaultCopayValue, item.currencyCode),
            helper: `${item.payerPlanName || item.payerPlanCode ? `${item.payerPlanName || item.payerPlanCode}` : 'Plan not set'} | ${formatContractWindowLabel(item.effectiveFrom, item.effectiveTo)}`,
        },
        {
            key: 'rules',
            label: 'Contract policy setup',
            value: `${policySummaryOverview.value.activePolicies} active polic${policySummaryOverview.value.activePolicies === 1 ? 'y' : 'ies'}`,
            helper: `${policySummaryOverview.value.serviceFamilies} families | ${policySummaryOverview.value.coveredPolicies} covered | ${policySummaryOverview.value.excludedPolicies} excluded | ${policySummaryOverview.value.manualReviewPolicies} manual review`,
        },
        {
            key: 'pricing',
            label: 'Negotiated pricing',
            value: `${activePriceOverrideCount.value} active override${activePriceOverrideCount.value === 1 ? '' : 's'}`,
            helper: `${activeFixedPriceOverrideCount.value} fixed | ${activeDiscountPriceOverrideCount.value} discount`,
        },
        {
            key: 'cycles',
            label: 'Operational cycle',
            value: formatOperationalCycleLabel(item.claimSubmissionDeadlineDays, item.settlementCycleDays),
            helper: item.termsAndNotes?.trim() ? 'Contract notes are captured for billing and claims staff.' : 'Add contract notes to document commercial and operational guidance.',
        },
    ];
});

const filterPayerTypeSelectValue = computed({
    get: () => filters.payerType || '__none__',
    set: (value: string) => {
        filters.payerType = value === '__none__' ? '' : value;
        filters.page = 1;
        void refreshPage();
    },
});
const createPayerTypeSelectValue = computed({
    get: () => createForm.payerType || 'insurance',
    set: (value: string) => {
        createForm.payerType = value;
    },
});
const createRequiresPreAuthorizationSelectValue = computed({
    get: () => createForm.requiresPreAuthorization || 'true',
    set: (value: string) => {
        createForm.requiresPreAuthorization = value;
    },
});
const createDefaultCopayTypeSelectValue = computed({
    get: () => createForm.defaultCopayType || 'none',
    set: (value: string) => {
        createForm.defaultCopayType = value;
        if (value === 'none') createForm.defaultCopayValue = '';
    },
});
const editPayerTypeSelectValue = computed({
    get: () => editContractForm.payerType || 'insurance',
    set: (value: string) => {
        editContractForm.payerType = value;
    },
});
const editDefaultCopayTypeSelectValue = computed({
    get: () => editContractForm.defaultCopayType || 'none',
    set: (value: string) => {
        editContractForm.defaultCopayType = value;
        if (value === 'none') editContractForm.defaultCopayValue = '';
    },
});
const editRequiresPreAuthorizationSelectValue = computed({
    get: () => editContractForm.requiresPreAuthorization || 'true',
    set: (value: string) => {
        editContractForm.requiresPreAuthorization = value;
    },
});
const priceOverrideFilterStatusSelectValue = computed({
    get: () => priceOverrideFilters.status || '__none__',
    set: (value: string) => {
        priceOverrideFilters.status = value === '__none__' ? '' : value;
        priceOverrideFilters.page = 1;
        void loadPriceOverrides();
    },
});
const priceOverrideFilterServiceTypeSelectValue = computed({
    get: () => priceOverrideFilters.serviceType || '__none__',
    set: (value: string) => {
        priceOverrideFilters.serviceType = value === '__none__' ? '' : value;
        priceOverrideFilters.page = 1;
        void loadPriceOverrides();
    },
});
const priceOverrideFilterPricingStrategySelectValue = computed({
    get: () => priceOverrideFilters.pricingStrategy || '__none__',
    set: (value: string) => {
        priceOverrideFilters.pricingStrategy = value === '__none__' ? '' : value;
        priceOverrideFilters.page = 1;
        void loadPriceOverrides();
    },
});
const createPriceOverrideServiceTypeSelectValue = computed({
    get: () => createPriceOverrideForm.serviceType || '__none__',
    set: (value: string) => {
        createPriceOverrideForm.serviceType = value === '__none__' ? '' : value;
    },
});
const createPriceOverrideServiceLookupValue = computed({
    get: () => createPriceOverrideForm.serviceCode || '',
    set: (value: string) => {
        createPriceOverrideForm.serviceCode = normalizeServiceCode(value);
        syncPriceOverrideFormWithCatalog(createPriceOverrideForm);
    },
});
const createRuleServiceLookupValue = computed({
    get: () => createRuleForm.serviceCode || '',
    set: (value: string) => {
        createRuleForm.serviceCode = normalizeServiceCode(value);
        syncRuleFormWithCatalog(createRuleForm);
    },
});
const createPriceOverridePricingStrategySelectValue = computed({
    get: () => createPriceOverrideForm.pricingStrategy || 'fixed_price',
    set: (value: string) => {
        createPriceOverrideForm.pricingStrategy = value;
    },
});
const editPriceOverrideServiceTypeSelectValue = computed({
    get: () => editPriceOverrideForm.serviceType || '__none__',
    set: (value: string) => {
        editPriceOverrideForm.serviceType = value === '__none__' ? '' : value;
    },
});
const editPriceOverrideServiceLookupValue = computed({
    get: () => editPriceOverrideForm.serviceCode || '',
    set: (value: string) => {
        editPriceOverrideForm.serviceCode = normalizeServiceCode(value);
        syncPriceOverrideFormWithCatalog(editPriceOverrideForm);
    },
});
const editRuleServiceLookupValue = computed({
    get: () => editRuleForm.serviceCode || '',
    set: (value: string) => {
        editRuleForm.serviceCode = normalizeServiceCode(value);
        syncRuleFormWithCatalog(editRuleForm);
    },
});
const editPriceOverridePricingStrategySelectValue = computed({
    get: () => editPriceOverrideForm.pricingStrategy || 'fixed_price',
    set: (value: string) => {
        editPriceOverrideForm.pricingStrategy = value;
    },
});
const ruleFilterStatusSelectValue = computed({
    get: () => ruleFilters.status || '__none__',
    set: (value: string) => {
        ruleFilters.status = value === '__none__' ? '' : value;
        ruleFilters.page = 1;
        void loadRules();
    },
});
const ruleFilterServiceTypeSelectValue = computed({
    get: () => ruleFilters.serviceType || '__none__',
    set: (value: string) => {
        ruleFilters.serviceType = value === '__none__' ? '' : value;
        ruleFilters.page = 1;
        void loadRules();
    },
});
const ruleFilterCoverageDecisionSelectValue = computed({
    get: () => ruleFilters.coverageDecision || '__none__',
    set: (value: string) => {
        ruleFilters.coverageDecision = value === '__none__' ? '' : value;
        ruleFilters.page = 1;
        void loadRules();
    },
});
const createRuleServiceTypeSelectValue = computed({
    get: () => createRuleForm.serviceType || '__none__',
    set: (value: string) => {
        createRuleForm.serviceType = value === '__none__' ? '' : value;
    },
});
const createRuleCoverageDecisionSelectValue = computed({
    get: () => createRuleForm.coverageDecision || 'covered_with_rule',
    set: (value: string) => {
        createRuleForm.coverageDecision = value;
    },
});
const createRulePrioritySelectValue = computed({
    get: () => createRuleForm.priority || '__none__',
    set: (value: string) => {
        createRuleForm.priority = value === '__none__' ? '' : value;
    },
});
const createRuleGenderSelectValue = computed({
    get: () => createRuleForm.gender || 'any',
    set: (value: string) => {
        createRuleForm.gender = value;
    },
});
const createRuleCopayTypeSelectValue = computed({
    get: () => createRuleForm.copayType || 'none',
    set: (value: string) => {
        createRuleForm.copayType = value;
        if (value === 'none') createRuleForm.copayValue = '';
    },
});
const editRuleServiceTypeSelectValue = computed({
    get: () => editRuleForm.serviceType || '__none__',
    set: (value: string) => {
        editRuleForm.serviceType = value === '__none__' ? '' : value;
    },
});
const editRuleCoverageDecisionSelectValue = computed({
    get: () => editRuleForm.coverageDecision || 'covered_with_rule',
    set: (value: string) => {
        editRuleForm.coverageDecision = value;
    },
});
const editRulePrioritySelectValue = computed({
    get: () => editRuleForm.priority || '__none__',
    set: (value: string) => {
        editRuleForm.priority = value === '__none__' ? '' : value;
    },
});
const editRuleGenderSelectValue = computed({
    get: () => editRuleForm.gender || 'any',
    set: (value: string) => {
        editRuleForm.gender = value;
    },
});
const editRuleCopayTypeSelectValue = computed({
    get: () => editRuleForm.copayType || 'none',
    set: (value: string) => {
        editRuleForm.copayType = value;
        if (value === 'none') editRuleForm.copayValue = '';
    },
});
const createRuleRequiresAuthorizationSelectValue = computed({
    get: () => createRuleForm.requiresAuthorization || 'true',
    set: (value: string) => {
        createRuleForm.requiresAuthorization = value;
    },
});
const createRuleAutoApproveSelectValue = computed({
    get: () => createRuleForm.autoApprove || 'false',
    set: (value: string) => {
        createRuleForm.autoApprove = value;
    },
});
const editRuleRequiresAuthorizationSelectValue = computed({
    get: () => editRuleForm.requiresAuthorization || 'true',
    set: (value: string) => {
        editRuleForm.requiresAuthorization = value;
    },
});
const editRuleAutoApproveSelectValue = computed({
    get: () => editRuleForm.autoApprove || 'false',
    set: (value: string) => {
        editRuleForm.autoApprove = value;
    },
});

const scopeWarning = computed(() => {
    if (loading.value) return null;
    if (!multiTenantIsolationEnabled.value) return null;
    if (!scope.value) return 'Platform access scope could not be loaded.';
    if (scope.value.resolvedFrom === 'none') return 'No tenant/facility scope is resolved. Payer contract workflows may be blocked by tenant isolation controls.';
    return null;
});

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
    const payload = (await response.json().catch(() => ({}))) as ApiError;
    if (!response.ok) throw new Error(payload.message ?? `${response.status} ${response.statusText}`);
    return payload as T;
}

function boolLabel(value: boolean | null): string {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'N/A';
}

function formatCoverageLabel(
    coveragePercent: string | null | undefined,
    copayType: string | null | undefined,
    copayValue: string | null | undefined,
    currencyCode: string | null | undefined,
): string {
    const parts: string[] = [];
    const normalizedCoverage = String(coveragePercent ?? '').trim();
    const normalizedCopayType = String(copayType ?? '').trim().toLowerCase();
    const normalizedCopayValue = String(copayValue ?? '').trim();
    const normalizedCurrency = String(currencyCode ?? '').trim().toUpperCase();

    if (normalizedCoverage) parts.push(`${normalizedCoverage}% cover`);
    else parts.push('Coverage not set');

    if (normalizedCopayType === 'fixed' && normalizedCopayValue) {
        parts.push(`Co-pay ${normalizedCurrency || defaultCurrencyCode.value} ${normalizedCopayValue}`);
    } else if (normalizedCopayType === 'percentage' && normalizedCopayValue) {
        parts.push(`Co-pay ${normalizedCopayValue}%`);
    } else {
        parts.push('No co-pay');
    }

    return parts.join(' | ');
}

function formatContractWindowLabel(effectiveFrom: string | null | undefined, effectiveTo: string | null | undefined): string {
    const from = String(effectiveFrom ?? '').trim();
    const to = String(effectiveTo ?? '').trim();
    if (from && to) return `${from} to ${to}`;
    if (from) return `From ${from}`;
    if (to) return `Until ${to}`;
    return 'No active window';
}

function formatOperationalCycleLabel(claimSubmissionDeadlineDays: number | null | string | undefined, settlementCycleDays: number | null | string | undefined): string {
    const claimDays = String(claimSubmissionDeadlineDays ?? '').trim();
    const settlementDays = String(settlementCycleDays ?? '').trim();
    const parts: string[] = [];
    parts.push(claimDays ? `Claims in ${claimDays} day${claimDays === '1' ? '' : 's'}` : 'Claim deadline not set');
    parts.push(settlementDays ? `Settle in ${settlementDays} day${settlementDays === '1' ? '' : 's'}` : 'Settlement cycle not set');
    return parts.join(' | ');
}

function formatPricingStrategyLabel(value: string | null | undefined): string {
    return ({
        fixed_price: 'Fixed price',
        discount_percent: 'Discount %',
        markup_percent: 'Markup %',
    } as Record<string, string>)[String(value ?? '').trim().toLowerCase()] ?? formatEnumLabel(value || 'pricing');
}

function formatPriceOverrideValue(
    pricingStrategy: string | null | undefined,
    overrideValue: string | null | undefined,
    currencyCode: string | null | undefined,
): string {
    const normalizedStrategy = String(pricingStrategy ?? '').trim().toLowerCase();
    const normalizedValue = String(overrideValue ?? '').trim();
    if (!normalizedValue) {
        return 'Price override not set';
    }

    if (normalizedStrategy === 'discount_percent') {
        return `${normalizedValue}% off base price`;
    }

    if (normalizedStrategy === 'markup_percent') {
        return `${normalizedValue}% markup on base price`;
    }

    return `${(currencyCode || defaultCurrencyCode.value).toUpperCase()} ${normalizedValue}`;
}

function formatCurrencyAmount(value: string | null | undefined, currencyCode: string | null | undefined): string {
    const normalizedValue = String(value ?? '').trim();
    if (!normalizedValue) return 'N/A';
    return `${(currencyCode || defaultCurrencyCode.value).toUpperCase()} ${normalizedValue}`;
}

function formatPriceOverrideImpact(item: PriceOverride): string {
    if ((item.catalogPricingStatus ?? '').trim().toLowerCase() !== 'matched_active_service_price') {
        return 'Base service price is not available for impact comparison.';
    }

    const basePrice = formatCurrencyAmount(item.catalogBasePrice, item.catalogCurrencyCode || item.currencyCode);
    const negotiatedPrice = formatCurrencyAmount(item.resolvedNegotiatedPrice, item.catalogCurrencyCode || item.currencyCode);
    const varianceAmount = String(item.varianceAmount ?? '').trim();
    const variancePercent = String(item.variancePercent ?? '').trim();

    if (!varianceAmount || !variancePercent) {
        return `${basePrice} base | ${negotiatedPrice} negotiated`;
    }

    const sign = varianceAmount.startsWith('-') ? '' : '+';
    return `${basePrice} base | ${negotiatedPrice} negotiated | ${sign}${varianceAmount} (${sign}${variancePercent}%)`;
}

function negotiatedPriceImpactBadgeVariant(direction: string | null | undefined): 'outline' | 'secondary' | 'destructive' {
    const normalizedDirection = String(direction ?? '').trim().toLowerCase();
    if (normalizedDirection === 'discount') return 'secondary';
    if (normalizedDirection === 'markup') return 'destructive';
    return 'outline';
}

function negotiatedPriceImpactLabel(item: PriceOverride): string {
    const normalizedDirection = String(item.varianceDirection ?? '').trim().toLowerCase();
    if ((item.catalogPricingStatus ?? '').trim().toLowerCase() !== 'matched_active_service_price') {
        return 'Base price missing';
    }
    if (normalizedDirection === 'discount') {
        return `Discount ${item.variancePercent ? `${Math.abs(Number(item.variancePercent)).toFixed(2)}%` : ''}`.trim();
    }
    if (normalizedDirection === 'markup') {
        return `Markup ${item.variancePercent ? `${Math.abs(Number(item.variancePercent)).toFixed(2)}%` : ''}`.trim();
    }
    return 'No price change';
}

function draftNegotiatedPriceImpactSummary(
    catalogItem: CatalogItem | null,
    pricingStrategy: string | null | undefined,
    overrideValue: string | null | undefined,
    currencyCode: string | null | undefined,
): string {
    const normalizedOverrideValue = String(overrideValue ?? '').trim();
    if (!normalizedOverrideValue) {
        return pricingStrategy === 'fixed_price'
            ? `Enter amount in ${(currencyCode || defaultCurrencyCode.value).toUpperCase()}.`
            : 'Enter the percentage to apply to the base service price.';
    }

    if (!catalogItem?.basePrice?.trim()) {
        return 'Base service price is not available yet, so impact preview will appear after service-price linkage is resolved.';
    }

    const baseAmount = Number(catalogItem.basePrice);
    const overrideAmount = Number(normalizedOverrideValue);
    if (Number.isNaN(baseAmount) || Number.isNaN(overrideAmount)) {
        return 'Enter a valid negotiated value to preview the pricing impact.';
    }

    let negotiatedAmount = overrideAmount;
    const normalizedStrategy = String(pricingStrategy ?? '').trim().toLowerCase();
    if (normalizedStrategy === 'discount_percent') {
        negotiatedAmount = baseAmount * (1 - (overrideAmount / 100));
    } else if (normalizedStrategy === 'markup_percent') {
        negotiatedAmount = baseAmount * (1 + (overrideAmount / 100));
    }

    const varianceAmount = negotiatedAmount - baseAmount;
    const variancePercent = baseAmount === 0 ? 0 : (varianceAmount / baseAmount) * 100;
    const sign = varianceAmount < 0 ? '' : '+';

    return [
        `${formatCurrencyAmount(baseAmount.toFixed(2), currencyCode)} base`,
        `${formatCurrencyAmount(negotiatedAmount.toFixed(2), currencyCode)} negotiated`,
        `${sign}${varianceAmount.toFixed(2)} (${sign}${variancePercent.toFixed(2)}%)`,
    ].join(' | ');
}

function normalizeServiceCode(value: string | null | undefined): string {
    return String(value ?? '').trim().toUpperCase();
}

function withSyntheticServiceOption(
    options: SearchableSelectOption[],
    serviceCode: string | null | undefined,
    serviceName: string | null | undefined,
    serviceType: string | null | undefined,
    department: string | null | undefined,
): SearchableSelectOption[] {
    const normalizedCode = normalizeServiceCode(serviceCode);
    if (!normalizedCode) return options;

    const alreadyPresent = options.some((option) => normalizeServiceCode(option.value) === normalizedCode);
    if (alreadyPresent) return options;

    return [
        {
            value: normalizedCode,
            label: serviceName?.trim() || normalizedCode,
            description: [
                'Current negotiated target',
                serviceType ? formatEnumLabel(serviceType) : null,
                department?.trim() || null,
            ].filter(Boolean).join(' | '),
            keywords: [normalizedCode, serviceName?.trim() || '', serviceType?.trim() || '', department?.trim() || ''].filter(Boolean),
            group: serviceType ? formatEnumLabel(serviceType) : 'Existing negotiated target',
        },
        ...options,
    ];
}

function withSyntheticRuleServiceOption(
    options: SearchableSelectOption[],
    serviceCode: string | null | undefined,
    serviceType: string | null | undefined,
    department: string | null | undefined,
): SearchableSelectOption[] {
    const normalizedCode = normalizeServiceCode(serviceCode);
    if (!normalizedCode) return options;

    const alreadyPresent = options.some((option) => normalizeServiceCode(option.value) === normalizedCode);
    if (alreadyPresent) return options;

    return [
        {
            value: normalizedCode,
            label: normalizedCode,
            description: [
                serviceType ? formatEnumLabel(serviceType) : null,
                department?.trim() || null,
                'Current policy target',
            ].filter(Boolean).join(' | '),
            keywords: [normalizedCode, serviceType?.trim() || '', department?.trim() || ''].filter(Boolean),
            group: serviceType ? formatEnumLabel(serviceType) : 'Existing policy target',
        },
        ...options,
    ];
}

function findCatalogItemByServiceCode(serviceCode: string | null | undefined, preferredItemId: string | null | undefined = null): CatalogItem | null {
    const normalizedCode = normalizeServiceCode(serviceCode);
    const normalizedItemId = String(preferredItemId ?? '').trim();
    if (!normalizedCode && !normalizedItemId) return null;

    if (normalizedItemId) {
        const direct = serviceCatalogLookupItems.value.find((item) => (item.id ?? '').trim() === normalizedItemId);
        if (direct) return direct;
    }

    return serviceCatalogLookupItems.value.find((item) => normalizeServiceCode(item.serviceCode) === normalizedCode) ?? null;
}

function findCatalogItemForPriceOverrideForm(form: Pick<PriceOverrideFormState, 'billingServiceCatalogItemId' | 'serviceCode'>): CatalogItem | null {
    return findCatalogItemByServiceCode(form.serviceCode, form.billingServiceCatalogItemId);
}

function syncPriceOverrideFormWithCatalog(form: PriceOverrideFormState): void {
    const matchedItem = findCatalogItemForPriceOverrideForm(form);
    if (matchedItem) {
        form.billingServiceCatalogItemId = matchedItem.id ?? '';
        form.serviceCode = normalizeServiceCode(matchedItem.serviceCode);
        form.serviceName = matchedItem.serviceName?.trim() || form.serviceName;
        form.serviceType = matchedItem.serviceType?.trim() || '';
        form.department = matchedItem.department?.trim() || '';
        return;
    }

    if (!normalizeServiceCode(form.serviceCode)) {
        form.billingServiceCatalogItemId = '';
        form.serviceCode = '';
        form.serviceName = '';
        form.serviceType = '';
        form.department = '';
        return;
    }

    if (serviceCatalogLookupItems.value.length > 0) {
        form.billingServiceCatalogItemId = '';
    }
}

function syncRuleFormWithCatalog(form: RuleFormState): void {
    const matchedItem = findCatalogItemByServiceCode(form.serviceCode, form.billingServiceCatalogItemId);
    if (matchedItem) {
        form.billingServiceCatalogItemId = matchedItem.id ?? '';
        form.serviceCode = normalizeServiceCode(matchedItem.serviceCode);
        form.serviceType = matchedItem.serviceType?.trim() || '';
        form.department = matchedItem.department?.trim() || '';
        return;
    }

    if (!normalizeServiceCode(form.serviceCode)) {
        form.billingServiceCatalogItemId = '';
        form.serviceCode = '';
        form.serviceType = '';
        form.department = '';
        return;
    }

    if (serviceCatalogLookupItems.value.length > 0) {
        form.billingServiceCatalogItemId = '';
    }
}

function priceCatalogSelectionSummary(item: CatalogItem | null): string {
    if (!item) return 'Choose a service price to link this policy to a live billing service.';

    return [
        item.serviceCode?.trim() || 'Service code pending',
        item.serviceType ? formatEnumLabel(item.serviceType) : null,
        item.department?.trim() || null,
    ].filter(Boolean).join(' | ');
}

function formatCatalogBasePriceLabel(item: CatalogItem | null): string {
    const normalizedPrice = item?.basePrice?.trim();
    if (!normalizedPrice) return 'Base price pending';
    return `${(item?.currencyCode || selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase()} ${normalizedPrice}`;
}

function ruleConditionsSummary(form: Pick<RuleFormState, 'diagnosisCode' | 'priority' | 'minPatientAgeYears' | 'maxPatientAgeYears' | 'gender' | 'amountThreshold' | 'quantityLimit' | 'authorizationValidityDays' | 'benefitLimitAmount' | 'effectiveFrom' | 'effectiveTo'>): string {
    const parts: string[] = [];
    if (form.diagnosisCode.trim()) parts.push(`Dx ${form.diagnosisCode.trim().toUpperCase()}`);
    if (form.priority.trim()) parts.push(formatEnumLabel(form.priority));
    if (form.minPatientAgeYears.trim() || form.maxPatientAgeYears.trim()) {
        const min = form.minPatientAgeYears.trim() || '0';
        const max = form.maxPatientAgeYears.trim() || 'any';
        parts.push(`Age ${min}-${max}`);
    }
    if (form.gender.trim() && form.gender.trim().toLowerCase() !== 'any') parts.push(formatEnumLabel(form.gender));
    if (form.amountThreshold.trim()) parts.push(`Threshold ${(selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase()} ${form.amountThreshold.trim()}`);
    if (form.quantityLimit.trim()) parts.push(`Qty <= ${form.quantityLimit.trim()}`);
    if (form.benefitLimitAmount.trim()) parts.push(`Limit ${(selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase()} ${form.benefitLimitAmount.trim()}`);
    if (form.effectiveFrom.trim() || form.effectiveTo.trim()) parts.push(formatContractWindowLabel(form.effectiveFrom.trim() || null, form.effectiveTo.trim() || null));
    if (form.authorizationValidityDays.trim()) parts.push(`Valid ${form.authorizationValidityDays.trim()} days`);
    return parts.join(' | ') || 'No extra policy conditions yet.';
}

function numericRuleValue(value: string | number | null | undefined): number | null {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
}

function booleanRuleValue(value: string | boolean | null | undefined, fallback = false): boolean {
    if (typeof value === 'boolean') return value;
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    return fallback;
}

function buildRuleExpression(source: {
    billingServiceCatalogItemId: string | null | undefined;
    serviceCode: string | null | undefined;
    serviceType: string | null | undefined;
    department: string | null | undefined;
    diagnosisCode: string | null | undefined;
    priority: string | null | undefined;
    minPatientAgeYears: string | number | null | undefined;
    maxPatientAgeYears: string | number | null | undefined;
    gender: string | null | undefined;
    amountThreshold: string | number | null | undefined;
    quantityLimit: string | number | null | undefined;
    coverageDecision: string | null | undefined;
    coveragePercentOverride: string | number | null | undefined;
    copayType: string | null | undefined;
    copayValue: string | number | null | undefined;
    benefitLimitAmount: string | number | null | undefined;
    effectiveFrom: string | null | undefined;
    effectiveTo: string | null | undefined;
    requiresAuthorization: string | boolean | null | undefined;
    autoApprove: string | boolean | null | undefined;
    authorizationValidityDays: string | number | null | undefined;
}): RuleExpression {
    const clauses: RuleExpressionClause[] = [];
    const billingServiceCatalogItemId = nullableTrimmedValue(source.billingServiceCatalogItemId);
    const serviceCode = normalizeServiceCode(source.serviceCode);
    const serviceType = nullableTrimmedValue(source.serviceType);
    const department = nullableTrimmedValue(source.department);
    const diagnosisCode = nullableTrimmedValue(source.diagnosisCode)?.toUpperCase() ?? null;
    const priority = nullableTrimmedValue(source.priority);
    const minPatientAgeYears = numericRuleValue(source.minPatientAgeYears);
    const maxPatientAgeYears = numericRuleValue(source.maxPatientAgeYears);
    const gender = nullableTrimmedValue(source.gender)?.toLowerCase() ?? null;
    const amountThreshold = numericRuleValue(source.amountThreshold);
    const quantityLimit = numericRuleValue(source.quantityLimit);
    const coverageDecision = nullableTrimmedValue(source.coverageDecision) || 'covered_with_rule';
    const coveragePercentOverride = numericRuleValue(source.coveragePercentOverride);
    const copayType = nullableTrimmedValue(source.copayType);
    const copayValue = numericRuleValue(source.copayValue);
    const benefitLimitAmount = numericRuleValue(source.benefitLimitAmount);
    const effectiveFrom = nullableTrimmedValue(source.effectiveFrom);
    const effectiveTo = nullableTrimmedValue(source.effectiveTo);

    if (billingServiceCatalogItemId) clauses.push({ field: 'billingServiceCatalogItemId', operator: 'eq', value: billingServiceCatalogItemId });
    if (serviceCode) clauses.push({ field: 'serviceCode', operator: 'eq', value: serviceCode });
    if (serviceType) clauses.push({ field: 'serviceType', operator: 'eq', value: serviceType });
    if (department) clauses.push({ field: 'department', operator: 'eq', value: department });
    if (diagnosisCode) clauses.push({ field: 'diagnosisCode', operator: 'eq', value: diagnosisCode });
    if (priority) clauses.push({ field: 'priority', operator: 'eq', value: priority });
    if (minPatientAgeYears !== null) clauses.push({ field: 'patientAgeYears', operator: 'gte', value: minPatientAgeYears });
    if (maxPatientAgeYears !== null) clauses.push({ field: 'patientAgeYears', operator: 'lte', value: maxPatientAgeYears });
    if (gender && gender !== 'any') clauses.push({ field: 'gender', operator: 'eq', value: gender });
    if (amountThreshold !== null) clauses.push({ field: 'lineSubtotal', operator: 'gte', value: amountThreshold });
    if (quantityLimit !== null) clauses.push({ field: 'quantity', operator: 'lte', value: quantityLimit });

    return {
        all: clauses,
        window: {
            effectiveFrom,
            effectiveTo,
        },
        outcome: {
            coverageDecision,
            coveragePercentOverride,
            copayType,
            copayValue,
            benefitLimitAmount,
            requiresAuthorization: booleanRuleValue(source.requiresAuthorization, true),
            autoApprove: booleanRuleValue(source.autoApprove, false),
            authorizationValidityDays: numericRuleValue(source.authorizationValidityDays),
        },
    };
}

function normalizeRuleExpression(value: Rule['ruleExpression'] | null | undefined): RuleExpression | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const rawAll = Array.isArray((value as Record<string, unknown>).all) ? (value as Record<string, unknown>).all as unknown[] : [];
    const all = rawAll
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
        .map((item) => ({
            field: String(item.field ?? '').trim(),
            operator: String(item.operator ?? '').trim(),
            value: (item.value ?? null) as string | number | boolean | null,
        }))
        .filter((item) => item.field && item.operator);

    const rawOutcome = typeof (value as Record<string, unknown>).outcome === 'object' && (value as Record<string, unknown>).outcome !== null
        ? (value as Record<string, unknown>).outcome as Record<string, unknown>
        : {};
    const rawWindow = typeof (value as Record<string, unknown>).window === 'object' && (value as Record<string, unknown>).window !== null
        ? (value as Record<string, unknown>).window as Record<string, unknown>
        : {};

    return {
        all,
        window: {
            effectiveFrom: nullableTrimmedValue(String(rawWindow.effectiveFrom ?? '')),
            effectiveTo: nullableTrimmedValue(String(rawWindow.effectiveTo ?? '')),
        },
        outcome: {
            coverageDecision: nullableTrimmedValue(String(rawOutcome.coverageDecision ?? '')) || 'covered_with_rule',
            coveragePercentOverride: numericRuleValue(rawOutcome.coveragePercentOverride),
            copayType: nullableTrimmedValue(String(rawOutcome.copayType ?? '')),
            copayValue: numericRuleValue(rawOutcome.copayValue),
            benefitLimitAmount: numericRuleValue(rawOutcome.benefitLimitAmount),
            requiresAuthorization: booleanRuleValue(rawOutcome.requiresAuthorization, false),
            autoApprove: booleanRuleValue(rawOutcome.autoApprove, false),
            authorizationValidityDays: numericRuleValue(rawOutcome.authorizationValidityDays),
        },
    };
}

function ruleEngineSummary(expression: RuleExpression | null): string {
    if (!expression) return 'Policy expression pending.';
    const clauseCount = expression.all.length;
    const coverageDecision = formatEnumLabel(expression.outcome.coverageDecision || 'covered_with_rule');
    const routing = !expression.outcome.requiresAuthorization
        ? 'No authorization hold'
        : expression.outcome.autoApprove
            ? 'Authorization auto-approve'
            : 'Manual authorization hold';

    return [
        coverageDecision,
        `${clauseCount} condition${clauseCount === 1 ? '' : 's'}`,
        expression.outcome.coveragePercentOverride !== null ? `Cover ${expression.outcome.coveragePercentOverride.toFixed(2)}%` : null,
        formatRuleCopaySummary(expression.outcome.copayType, expression.outcome.copayValue),
        expression.outcome.benefitLimitAmount !== null ? `Limit ${(selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase()} ${expression.outcome.benefitLimitAmount.toFixed(2)}` : null,
        expression.window.effectiveFrom || expression.window.effectiveTo ? formatContractWindowLabel(expression.window.effectiveFrom, expression.window.effectiveTo) : null,
        routing,
        expression.outcome.authorizationValidityDays !== null ? `Valid ${expression.outcome.authorizationValidityDays} days` : null,
    ].filter(Boolean).join(' | ');
}

function storedRuleEngineSummary(item: Rule): string {
    return ruleEngineSummary(
        normalizeRuleExpression(item.ruleExpression) ?? buildRuleExpression({
            billingServiceCatalogItemId: item.billingServiceCatalogItemId,
            serviceCode: item.serviceCode,
            serviceType: item.serviceType,
            department: item.department,
            diagnosisCode: item.diagnosisCode,
            priority: item.priority,
            minPatientAgeYears: item.minPatientAgeYears,
            maxPatientAgeYears: item.maxPatientAgeYears,
            gender: item.gender,
            amountThreshold: item.amountThreshold,
            quantityLimit: item.quantityLimit,
            coverageDecision: item.coverageDecision,
            coveragePercentOverride: item.coveragePercentOverride,
            copayType: item.copayType,
            copayValue: item.copayValue,
            benefitLimitAmount: item.benefitLimitAmount,
            effectiveFrom: item.effectiveFrom,
            effectiveTo: item.effectiveTo,
            requiresAuthorization: item.requiresAuthorization,
            autoApprove: item.autoApprove,
            authorizationValidityDays: item.authorizationValidityDays,
        }),
    );
}

function formatRuleCopaySummary(copayType: string | null | undefined, copayValue: string | number | null | undefined): string | null {
    const normalizedType = String(copayType ?? '').trim().toLowerCase();
    const normalizedValue = String(copayValue ?? '').trim();
    const currency = (selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase();

    if (normalizedType === 'percentage' && normalizedValue) {
        return `Co-pay ${normalizedValue}%`;
    }

    if (normalizedType === 'fixed' && normalizedValue) {
        return `Co-pay ${currency} ${normalizedValue}`;
    }

    if (normalizedType === 'none') {
        return 'No co-pay';
    }

    return null;
}

function formatRuleCoverageSummary(item: Rule | RuleFormState): string {
    const parts: string[] = [formatEnumLabel((item.coverageDecision || 'covered_with_rule'))];
    if (String(item.coveragePercentOverride ?? '').trim()) {
        parts.push(`Cover ${String(item.coveragePercentOverride).trim()}%`);
    }
    const copaySummary = formatRuleCopaySummary(item.copayType, item.copayValue);
    if (copaySummary) parts.push(copaySummary);
    if (String(item.benefitLimitAmount ?? '').trim()) {
        parts.push(`Limit ${(selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase()} ${String(item.benefitLimitAmount).trim()}`);
    }
    if (String(item.effectiveFrom ?? '').trim() || String(item.effectiveTo ?? '').trim()) {
        parts.push(formatContractWindowLabel(String(item.effectiveFrom ?? '').trim() || null, String(item.effectiveTo ?? '').trim() || null));
    }
    return parts.join(' | ');
}

function formatPolicyCoverageRangeLabel(item: PolicyFamilyMatrixRow): string {
    if (item.coverageOverrideMin && item.coverageOverrideMax) {
        if (item.coverageOverrideMin === item.coverageOverrideMax) {
            return `Coverage override ${item.coverageOverrideMin}%`;
        }

        return `Coverage override ${item.coverageOverrideMin}% to ${item.coverageOverrideMax}%`;
    }

    return 'Uses contract default coverage';
}

function formatPolicyBandChips(item: PolicyBenefitBand): string[] {
    const chips: string[] = [];
    const currencyCode = (selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase();

    if (item.amountThreshold?.trim()) {
        chips.push(`Threshold ${currencyCode} ${item.amountThreshold.trim()}`);
    }
    if (item.quantityLimit !== null && item.quantityLimit !== undefined) {
        chips.push(`Qty <= ${item.quantityLimit}`);
    }
    if (item.benefitLimitAmount?.trim()) {
        chips.push(`Limit ${currencyCode} ${item.benefitLimitAmount.trim()}`);
    }

    const copaySummary = formatRuleCopaySummary(item.copayType, item.copayValue);
    if (copaySummary) {
        chips.push(copaySummary);
    }

    if (item.coveragePercentOverride?.trim()) {
        chips.push(`Cover ${item.coveragePercentOverride.trim()}%`);
    }

    if (item.effectiveFrom || item.effectiveTo) {
        chips.push(formatContractWindowLabel(item.effectiveFrom, item.effectiveTo));
    }

    chips.push(item.requiresAuthorization ? 'Requires auth' : 'No auth hold');

    if (item.autoApprove) {
        chips.push('Auto approve');
    }

    return chips;
}

function policyDecisionVariant(value: string | null | undefined): 'outline' | 'secondary' | 'destructive' {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'excluded') return 'destructive';
    if (normalized === 'covered' || normalized === 'covered_with_rule') return 'secondary';
    return 'outline';
}

function formatRuleConditionBadges(item: Rule): string[] {
    const chips: string[] = [];
    if (item.department?.trim()) chips.push(item.department.trim());
    if (item.diagnosisCode?.trim()) chips.push(`Dx ${item.diagnosisCode.trim().toUpperCase()}`);
    if (item.priority?.trim()) chips.push(formatEnumLabel(item.priority));
    if (item.gender?.trim() && item.gender.trim().toLowerCase() !== 'any') chips.push(formatEnumLabel(item.gender));
    if (item.minPatientAgeYears !== null || item.maxPatientAgeYears !== null) {
        chips.push(`Age ${item.minPatientAgeYears ?? 0}-${item.maxPatientAgeYears ?? 'any'}`);
    }
    if (item.amountThreshold?.trim()) chips.push(`Threshold ${(selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase()} ${item.amountThreshold.trim()}`);
    if (item.quantityLimit !== null) chips.push(`Qty <= ${item.quantityLimit}`);
    if (item.benefitLimitAmount?.trim()) chips.push(`Limit ${(selectedContract.value?.currencyCode || defaultCurrencyCode.value).toUpperCase()} ${item.benefitLimitAmount.trim()}`);
    if (item.authorizationValidityDays !== null) chips.push(`Valid ${item.authorizationValidityDays}d`);
    return chips;
}

function nullableTrimmedValue(value: string | null | undefined): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
}

function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(parsed);
}

function actorLabel(log: AuditLog): string {
    const displayName = log.actor?.displayName?.trim();
    if (displayName) return displayName;
    return log.actorId === null ? 'System' : `User #${log.actorId}`;
}

function actionLabel(log: AuditLog): string {
    if (log.actionLabel && log.actionLabel.trim()) return log.actionLabel;
    return formatEnumLabel(log.action || 'event');
}

function auditEntries(value: Record<string, unknown> | unknown[] | null): Array<[string, unknown]> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value).slice(0, 4);
}

function formatAuditValue(value: unknown): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') return value.trim() || 'N/A';
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive' || normalized === 'retired') return 'destructive';
    return 'outline';
}

function contractLabel(item: Contract | null): string {
    if (!item) return 'Unknown contract';
    if (item.contractCode && item.contractName) return `${item.contractCode} - ${item.contractName}`;
    return item.contractName || item.contractCode || item.id || 'Unknown contract';
}

function ruleLabel(item: Rule | null): string {
    if (!item) return 'Unknown rule';
    if (item.ruleCode && item.ruleName) return `${item.ruleCode} - ${item.ruleName}`;
    return item.ruleName || item.ruleCode || item.id || 'Unknown rule';
}
function applyCurrencyDefaults(): void {
    const currencyCode = defaultCurrencyCode.value;

    if (!createForm.currencyCode.trim() || createForm.currencyCode.trim().toUpperCase() === 'TZS') {
        createForm.currencyCode = currencyCode;
    }

    if (!editContractForm.currencyCode.trim() || editContractForm.currencyCode.trim().toUpperCase() === 'TZS') {
        editContractForm.currencyCode = currencyCode;
    }
}

function resetCreateContractForm() {
    Object.assign(createForm, {
        contractCode: '',
        contractName: '',
        payerType: 'insurance',
        payerName: '',
        payerPlanCode: '',
        payerPlanName: '',
        currencyCode: defaultCurrencyCode.value,
        defaultCoveragePercent: '',
        defaultCopayType: 'none',
        defaultCopayValue: '',
        requiresPreAuthorization: 'true',
        claimSubmissionDeadlineDays: '',
        settlementCycleDays: '',
        effectiveFrom: '',
        effectiveTo: '',
        termsAndNotes: '',
    });
}

function openContractListWorkspace(): void {
    contractWorkspaceMode.value = 'list';
}

function openContractCreateWorkspace(): void {
    contractWorkspaceMode.value = 'create';
}

function resetCreateRuleForm() {
    Object.assign(createRuleForm, {
        billingServiceCatalogItemId: '',
        ruleCode: '',
        ruleName: '',
        serviceCode: '',
        serviceType: '',
        department: '',
        diagnosisCode: '',
        priority: '',
        minPatientAgeYears: '',
        maxPatientAgeYears: '',
        gender: 'any',
        amountThreshold: '',
        quantityLimit: '',
        coverageDecision: 'covered_with_rule',
        coveragePercentOverride: '',
        copayType: 'none',
        copayValue: '',
        benefitLimitAmount: '',
        effectiveFrom: '',
        effectiveTo: '',
        requiresAuthorization: 'true',
        autoApprove: 'false',
        authorizationValidityDays: '',
        ruleNotes: '',
    });
}

function resetCreatePriceOverrideForm() {
    Object.assign(createPriceOverrideForm, {
        billingServiceCatalogItemId: '',
        serviceCode: '',
        serviceName: '',
        serviceType: '',
        department: '',
        pricingStrategy: 'fixed_price',
        overrideValue: '',
        effectiveFrom: '',
        effectiveTo: '',
        overrideNotes: '',
    });
}

function openContractEdit(item: Contract) {
    editContractTarget.value = item;
    Object.assign(editContractForm, {
        contractCode: item.contractCode || '',
        contractName: item.contractName || '',
        payerType: item.payerType || 'insurance',
        payerName: item.payerName || '',
        payerPlanCode: item.payerPlanCode || '',
        payerPlanName: item.payerPlanName || '',
        currencyCode: item.currencyCode || defaultCurrencyCode.value,
        defaultCoveragePercent: item.defaultCoveragePercent || '',
        defaultCopayType: item.defaultCopayType || 'none',
        defaultCopayValue: item.defaultCopayValue || '',
        requiresPreAuthorization: item.requiresPreAuthorization === false ? 'false' : 'true',
        claimSubmissionDeadlineDays: item.claimSubmissionDeadlineDays === null || item.claimSubmissionDeadlineDays === undefined ? '' : String(item.claimSubmissionDeadlineDays),
        settlementCycleDays: item.settlementCycleDays === null || item.settlementCycleDays === undefined ? '' : String(item.settlementCycleDays),
        effectiveFrom: item.effectiveFrom || '',
        effectiveTo: item.effectiveTo || '',
        termsAndNotes: item.termsAndNotes || '',
    });
    editContractOpen.value = true;
}

function openContractStatusDialog(item: Contract, target: 'active' | 'inactive' | 'retired') {
    contractStatusItem.value = item;
    contractStatusTarget.value = target;
    contractStatusReason.value = target === 'active' ? '' : item.statusReason ?? '';
    contractStatusError.value = null;
    contractStatusOpen.value = true;
}

function openRuleEdit(item: Rule) {
    editRuleTarget.value = item;
    Object.assign(editRuleForm, {
        billingServiceCatalogItemId: item.billingServiceCatalogItemId || '',
        ruleCode: item.ruleCode || '',
        ruleName: item.ruleName || '',
        serviceCode: item.serviceCode || '',
        serviceType: item.serviceType || '',
        department: item.department || '',
        diagnosisCode: item.diagnosisCode || '',
        priority: item.priority || '',
        minPatientAgeYears: item.minPatientAgeYears === null || item.minPatientAgeYears === undefined ? '' : String(item.minPatientAgeYears),
        maxPatientAgeYears: item.maxPatientAgeYears === null || item.maxPatientAgeYears === undefined ? '' : String(item.maxPatientAgeYears),
        gender: item.gender || 'any',
        amountThreshold: item.amountThreshold || '',
        quantityLimit: item.quantityLimit === null || item.quantityLimit === undefined ? '' : String(item.quantityLimit),
        coverageDecision: item.coverageDecision || 'covered_with_rule',
        coveragePercentOverride: item.coveragePercentOverride === null || item.coveragePercentOverride === undefined ? '' : String(item.coveragePercentOverride),
        copayType: item.copayType || 'none',
        copayValue: item.copayValue === null || item.copayValue === undefined ? '' : String(item.copayValue),
        benefitLimitAmount: item.benefitLimitAmount === null || item.benefitLimitAmount === undefined ? '' : String(item.benefitLimitAmount),
        effectiveFrom: item.effectiveFrom || '',
        effectiveTo: item.effectiveTo || '',
        requiresAuthorization: item.requiresAuthorization === false ? 'false' : 'true',
        autoApprove: item.autoApprove === true ? 'true' : 'false',
        authorizationValidityDays: item.authorizationValidityDays === null || item.authorizationValidityDays === undefined ? '' : String(item.authorizationValidityDays),
        ruleNotes: item.ruleNotes || '',
    });
    syncRuleFormWithCatalog(editRuleForm);
    editRuleOpen.value = true;
}

function openPriceOverrideEdit(item: PriceOverride) {
    editPriceOverrideTarget.value = item;
    Object.assign(editPriceOverrideForm, {
        billingServiceCatalogItemId: item.billingServiceCatalogItemId || '',
        serviceCode: item.serviceCode || '',
        serviceName: item.serviceName || '',
        serviceType: item.serviceType || '',
        department: item.department || '',
        pricingStrategy: item.pricingStrategy || 'fixed_price',
        overrideValue: item.overrideValue || '',
        effectiveFrom: item.effectiveFrom || '',
        effectiveTo: item.effectiveTo || '',
        overrideNotes: item.overrideNotes || '',
    });
    syncPriceOverrideFormWithCatalog(editPriceOverrideForm);
    editPriceOverrideOpen.value = true;
}

function openRuleStatusDialog(item: Rule, target: 'active' | 'inactive' | 'retired') {
    ruleStatusItem.value = item;
    ruleStatusTarget.value = target;
    ruleStatusReason.value = target === 'active' ? '' : item.statusReason ?? '';
    ruleStatusError.value = null;
    ruleStatusOpen.value = true;
}

function openPriceOverrideStatusDialog(item: PriceOverride, target: 'active' | 'inactive' | 'retired') {
    priceOverrideStatusItem.value = item;
    priceOverrideStatusTarget.value = target;
    priceOverrideStatusReason.value = target === 'active' ? '' : item.statusReason ?? '';
    priceOverrideStatusError.value = null;
    priceOverrideStatusOpen.value = true;
}

async function loadCounts() {
    if (!canRead.value) return;
    try {
        const response = await apiRequest<CountsResponse>('GET', '/billing-payer-contracts/status-counts', { query: { q: filters.q.trim() || null, payerType: filters.payerType || null } });
        counts.value = response.data ?? { active: 0, inactive: 0, retired: 0, other: 0, total: 0 };
    } catch {
        counts.value = { active: 0, inactive: 0, retired: 0, other: 0, total: 0 };
    }
}

async function loadContracts() {
    if (!canRead.value) {
        contracts.value = [];
        pagination.value = null;
        loading.value = false;
        listLoading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];

    try {
        const response = await apiRequest<ListResponse<Contract>>('GET', '/billing-payer-contracts', {
            query: {
                q: filters.q.trim() || null,
                status: filters.status || null,
                payerType: filters.payerType || null,
                page: filters.page,
                perPage: filters.perPage,
                sortBy: 'contractName',
                sortDir: 'asc',
            },
        });
        contracts.value = response.data ?? [];
        pagination.value = response.meta ?? null;
        if (selectedContract.value?.id) {
            const refreshedSelection = contracts.value.find((item) => item.id === selectedContract.value?.id) ?? null;
            if (refreshedSelection) selectedContract.value = refreshedSelection;
        }
    } catch (error) {
        contracts.value = [];
        pagination.value = null;
        listErrors.value.push(messageFromUnknown(error, 'Unable to load payer contracts.'));
    } finally {
        loading.value = false;
        listLoading.value = false;
    }
}

async function refreshPage() {
    await Promise.all([loadCountryProfile(), loadContracts(), loadCounts()]);
    applyCurrencyDefaults();
    if (selectedContract.value?.id) {
        await Promise.all([loadPriceOverrides(), loadRules(), loadServiceCatalogLookup(), loadPolicySummary()]);
    }
}

async function createContract() {
    if (!canManage.value || createLoading.value) return;
    const contractCode = createForm.contractCode.trim();
    const contractName = createForm.contractName.trim();
    const payerName = createForm.payerName.trim();
    const currencyCode = createForm.currencyCode.trim().toUpperCase();
    if (!contractCode || !contractName || !payerName || !currencyCode) {
        notifyError('Contract code, name, payer name, and currency are required.');
        return;
    }

    createLoading.value = true;
    try {
        const response = await apiRequest<ItemResponse<Contract>>('POST', '/billing-payer-contracts', {
            body: {
                contractCode,
                contractName,
                payerType: createForm.payerType,
                payerName,
                payerPlanCode: nullableTrimmedValue(createForm.payerPlanCode),
                payerPlanName: nullableTrimmedValue(createForm.payerPlanName),
                currencyCode,
                defaultCoveragePercent: nullableTrimmedValue(createForm.defaultCoveragePercent),
                defaultCopayType: createForm.defaultCopayType === 'none' ? null : createForm.defaultCopayType,
                defaultCopayValue: createForm.defaultCopayType === 'none' ? null : nullableTrimmedValue(createForm.defaultCopayValue),
                requiresPreAuthorization: createForm.requiresPreAuthorization === 'true',
                claimSubmissionDeadlineDays: nullableTrimmedValue(createForm.claimSubmissionDeadlineDays),
                settlementCycleDays: nullableTrimmedValue(createForm.settlementCycleDays),
                effectiveFrom: nullableTrimmedValue(createForm.effectiveFrom),
                effectiveTo: nullableTrimmedValue(createForm.effectiveTo),
                termsAndNotes: nullableTrimmedValue(createForm.termsAndNotes),
            },
        });
        notifySuccess(`Created ${contractLabel(response.data)}.`);
        resetCreateContractForm();
        contractWorkspaceMode.value = 'list';
        filters.page = 1;
        await refreshPage();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create payer contract.'));
    } finally {
        createLoading.value = false;
    }
}

async function saveContractEdit() {
    const id = editContractTarget.value?.id?.trim();
    if (!id || !canManage.value || editContractLoading.value) return;

    const contractCode = editContractForm.contractCode.trim();
    const contractName = editContractForm.contractName.trim();
    const payerName = editContractForm.payerName.trim();
    const currencyCode = editContractForm.currencyCode.trim().toUpperCase();
    if (!contractCode || !contractName || !payerName || !currencyCode) {
        notifyError('Contract code, name, payer name, and currency are required.');
        return;
    }

    editContractLoading.value = true;
    try {
        const response = await apiRequest<ItemResponse<Contract>>('PATCH', `/billing-payer-contracts/${id}`, {
            body: {
                contractCode,
                contractName,
                payerType: editContractForm.payerType,
                payerName,
                payerPlanCode: nullableTrimmedValue(editContractForm.payerPlanCode),
                payerPlanName: nullableTrimmedValue(editContractForm.payerPlanName),
                currencyCode,
                defaultCoveragePercent: nullableTrimmedValue(editContractForm.defaultCoveragePercent),
                defaultCopayType: editContractForm.defaultCopayType === 'none' ? null : editContractForm.defaultCopayType,
                defaultCopayValue: editContractForm.defaultCopayType === 'none' ? null : nullableTrimmedValue(editContractForm.defaultCopayValue),
                requiresPreAuthorization: editContractForm.requiresPreAuthorization === 'true',
                claimSubmissionDeadlineDays: nullableTrimmedValue(editContractForm.claimSubmissionDeadlineDays),
                settlementCycleDays: nullableTrimmedValue(editContractForm.settlementCycleDays),
                effectiveFrom: nullableTrimmedValue(editContractForm.effectiveFrom),
                effectiveTo: nullableTrimmedValue(editContractForm.effectiveTo),
                termsAndNotes: nullableTrimmedValue(editContractForm.termsAndNotes),
            },
        });
        if (selectedContract.value?.id === id) selectedContract.value = response.data;
        notifySuccess('Contract updated.');
        editContractOpen.value = false;
        await refreshPage();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update payer contract.'));
    } finally {
        editContractLoading.value = false;
    }
}

async function saveContractStatus() {
    const id = contractStatusItem.value?.id?.trim();
    if (!id || !canManage.value || contractStatusLoading.value) return;

    const reason = contractStatusReason.value.trim();
    if (contractStatusTarget.value !== 'active' && !reason) {
        contractStatusError.value = 'Reason is required for inactive or retired status.';
        return;
    }

    contractStatusLoading.value = true;
    contractStatusError.value = null;
    try {
        await apiRequest<ItemResponse<Contract>>('PATCH', `/billing-payer-contracts/${id}/status`, { body: { status: contractStatusTarget.value, reason: contractStatusTarget.value === 'active' ? null : reason } });
        notifySuccess('Contract status updated.');
        contractStatusOpen.value = false;
        await refreshPage();
    } catch (error) {
        contractStatusError.value = messageFromUnknown(error, 'Unable to update contract status.');
        notifyError(contractStatusError.value);
    } finally {
        contractStatusLoading.value = false;
    }
}

function selectContract(item: Contract) {
    selectedContract.value = item;
    policySummary.value = null;
    policySummaryError.value = null;
    priceOverrideAuditTarget.value = null;
    priceOverrideAuditLogs.value = [];
    ruleAuditTarget.value = null;
    ruleAuditLogs.value = [];
    priceOverrideFilters.page = 1;
    priceOverrides.value = [];
    priceOverridesPagination.value = null;
    ruleFilters.page = 1;
    rules.value = [];
    rulesPagination.value = null;
    serviceCatalogLookupItems.value = [];
    serviceCatalogLookupError.value = null;
    void loadPriceOverrides();
    void loadRules();
    void loadServiceCatalogLookup();
    void loadPolicySummary();
}

function clearSelectedContract() {
    selectedContract.value = null;
    policySummary.value = null;
    policySummaryError.value = null;
    policySummaryLoading.value = false;
    priceOverrides.value = [];
    priceOverridesPagination.value = null;
    rules.value = [];
    rulesPagination.value = null;
    priceOverrideAuditTarget.value = null;
    priceOverrideAuditLogs.value = [];
    ruleAuditTarget.value = null;
    ruleAuditLogs.value = [];
    serviceCatalogLookupItems.value = [];
    serviceCatalogLookupError.value = null;
}

async function loadPriceOverrides() {
    const contractId = selectedContract.value?.id?.trim();
    if (!contractId || !canRead.value) return;

    priceOverridesLoading.value = true;
    priceOverrideErrors.value = [];
    try {
        const response = await apiRequest<ListResponse<PriceOverride>>('GET', `/billing-payer-contracts/${contractId}/price-overrides`, {
            query: {
                q: priceOverrideFilters.q.trim() || null,
                status: priceOverrideFilters.status || null,
                serviceType: priceOverrideFilters.serviceType.trim() || null,
                pricingStrategy: priceOverrideFilters.pricingStrategy || null,
                page: priceOverrideFilters.page,
                perPage: priceOverrideFilters.perPage,
                sortBy: 'serviceName',
                sortDir: 'asc',
            },
        });
        priceOverrides.value = response.data ?? [];
        priceOverridesPagination.value = response.meta ?? null;
    } catch (error) {
        priceOverrides.value = [];
        priceOverridesPagination.value = null;
        priceOverrideErrors.value.push(messageFromUnknown(error, 'Unable to load contract price overrides.'));
    } finally {
        priceOverridesLoading.value = false;
    }
}

async function loadServiceCatalogLookup() {
    const contractId = selectedContract.value?.id?.trim();
    const currencyCode = (selectedContract.value?.currencyCode || defaultCurrencyCode.value).trim().toUpperCase();
    if (!contractId || !canReadServiceCatalog.value) {
        serviceCatalogLookupItems.value = [];
        serviceCatalogLookupError.value = canReadServiceCatalog.value ? null : 'billing.service-catalog.read permission is required to search live Service Prices.';
        serviceCatalogLookupLoading.value = false;
        return;
    }

    serviceCatalogLookupLoading.value = true;
    serviceCatalogLookupError.value = null;
    try {
        const response = await apiRequest<PriceCatalogListResponse>('GET', '/billing-service-catalog/items', {
            query: {
                status: 'active',
                lifecycle: 'effective',
                currencyCode,
                page: 1,
                perPage: 100,
                sortBy: 'serviceName',
                sortDir: 'asc',
            },
        });
        serviceCatalogLookupItems.value = response.data ?? [];
        syncPriceOverrideFormWithCatalog(createPriceOverrideForm);
        syncPriceOverrideFormWithCatalog(editPriceOverrideForm);
    } catch (error) {
        serviceCatalogLookupItems.value = [];
        serviceCatalogLookupError.value = messageFromUnknown(error, 'Unable to load Service Prices for negotiated pricing.');
    } finally {
        serviceCatalogLookupLoading.value = false;
    }
}

async function loadPolicySummary() {
    const contractId = selectedContract.value?.id?.trim();
    if (!contractId || !canRead.value) {
        policySummary.value = null;
        policySummaryError.value = null;
        policySummaryLoading.value = false;
        return;
    }

    policySummaryLoading.value = true;
    policySummaryError.value = null;
    try {
        const response = await apiRequest<PolicySummaryResponse>('GET', `/billing-payer-contracts/${contractId}/authorization-rules/summary`);
        policySummary.value = response.data ?? { overview: emptyPolicySummaryOverview, familyMatrix: [], benefitBands: [] };
    } catch (error) {
        policySummary.value = null;
        policySummaryError.value = messageFromUnknown(error, 'Unable to load contract policy summary.');
    } finally {
        policySummaryLoading.value = false;
    }
}

async function loadRules() {
    const contractId = selectedContract.value?.id?.trim();
    if (!contractId || !canRead.value) return;

    rulesLoading.value = true;
    rulesErrors.value = [];
    try {
        const response = await apiRequest<ListResponse<Rule>>('GET', `/billing-payer-contracts/${contractId}/authorization-rules`, {
            query: {
                q: ruleFilters.q.trim() || null,
                status: ruleFilters.status || null,
                serviceType: ruleFilters.serviceType.trim() || null,
                coverageDecision: ruleFilters.coverageDecision || null,
                page: ruleFilters.page,
                perPage: ruleFilters.perPage,
                sortBy: 'ruleName',
                sortDir: 'asc',
            },
        });
        rules.value = response.data ?? [];
        rulesPagination.value = response.meta ?? null;
    } catch (error) {
        rules.value = [];
        rulesPagination.value = null;
        rulesErrors.value.push(messageFromUnknown(error, 'Unable to load contract policies.'));
    } finally {
        rulesLoading.value = false;
    }
}

async function createPriceOverride() {
    const contractId = selectedContract.value?.id?.trim();
    if (!contractId || !canManagePriceOverrides.value || createPriceOverrideLoading.value) return;

    const serviceCode = createPriceOverrideForm.serviceCode.trim().toUpperCase();
    const overrideValue = createPriceOverrideForm.overrideValue.trim();
    if (!serviceCode || !overrideValue) {
        notifyError('Service code and negotiated price value are required.');
        return;
    }

    createPriceOverrideLoading.value = true;
    try {
        const response = await apiRequest<ItemResponse<PriceOverride>>('POST', `/billing-payer-contracts/${contractId}/price-overrides`, {
            body: {
                billingServiceCatalogItemId: nullableTrimmedValue(createPriceOverrideForm.billingServiceCatalogItemId),
                serviceCode,
                serviceName: nullableTrimmedValue(createPriceOverrideForm.serviceName),
                serviceType: createPriceOverrideForm.serviceType.trim() || null,
                department: nullableTrimmedValue(createPriceOverrideForm.department),
                pricingStrategy: createPriceOverrideForm.pricingStrategy,
                overrideValue,
                effectiveFrom: nullableTrimmedValue(createPriceOverrideForm.effectiveFrom),
                effectiveTo: nullableTrimmedValue(createPriceOverrideForm.effectiveTo),
                overrideNotes: nullableTrimmedValue(createPriceOverrideForm.overrideNotes),
            },
        });
        notifySuccess(`Created negotiated price for ${response.data.serviceCode || serviceCode}.`);
        resetCreatePriceOverrideForm();
        priceOverrideFilters.page = 1;
        await loadPriceOverrides();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create contract price override.'));
    } finally {
        createPriceOverrideLoading.value = false;
    }
}

async function createRule() {
    const contractId = selectedContract.value?.id?.trim();
    if (!contractId || !canManageRules.value || createRuleLoading.value) return;

    const ruleCode = createRuleForm.ruleCode.trim();
    const ruleName = createRuleForm.ruleName.trim();
    if (!ruleCode || !ruleName) {
        notifyError('Policy code and policy name are required.');
        return;
    }

    createRuleLoading.value = true;
    try {
        const response = await apiRequest<ItemResponse<Rule>>('POST', `/billing-payer-contracts/${contractId}/authorization-rules`, {
            body: {
                billingServiceCatalogItemId: nullableTrimmedValue(createRuleForm.billingServiceCatalogItemId),
                ruleCode,
                ruleName,
                serviceCode: createRuleForm.serviceCode.trim().toUpperCase() || null,
                serviceType: createRuleForm.serviceType.trim() || null,
                department: nullableTrimmedValue(createRuleForm.department),
                diagnosisCode: nullableTrimmedValue(createRuleForm.diagnosisCode),
                priority: createRuleForm.priority.trim() || null,
                minPatientAgeYears: nullableTrimmedValue(createRuleForm.minPatientAgeYears),
                maxPatientAgeYears: nullableTrimmedValue(createRuleForm.maxPatientAgeYears),
                gender: createRuleForm.gender.trim() || 'any',
                amountThreshold: nullableTrimmedValue(createRuleForm.amountThreshold),
                quantityLimit: nullableTrimmedValue(createRuleForm.quantityLimit),
                coverageDecision: createRuleForm.coverageDecision || 'covered_with_rule',
                coveragePercentOverride: nullableTrimmedValue(createRuleForm.coveragePercentOverride),
                copayType: createRuleForm.copayType || 'none',
                copayValue: createRuleForm.copayType === 'none' ? null : nullableTrimmedValue(createRuleForm.copayValue),
                benefitLimitAmount: nullableTrimmedValue(createRuleForm.benefitLimitAmount),
                effectiveFrom: nullableTrimmedValue(createRuleForm.effectiveFrom),
                effectiveTo: nullableTrimmedValue(createRuleForm.effectiveTo),
                requiresAuthorization: createRuleForm.requiresAuthorization === 'true',
                autoApprove: createRuleForm.autoApprove === 'true',
                authorizationValidityDays: nullableTrimmedValue(createRuleForm.authorizationValidityDays),
                ruleNotes: nullableTrimmedValue(createRuleForm.ruleNotes),
                ruleExpression: buildRuleExpression(createRuleForm),
            },
        });
        notifySuccess(`Created ${ruleLabel(response.data)}.`);
        resetCreateRuleForm();
        ruleFilters.page = 1;
        await Promise.all([loadRules(), loadPolicySummary()]);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create contract policy.'));
    } finally {
        createRuleLoading.value = false;
    }
}

async function savePriceOverrideEdit() {
    const contractId = selectedContract.value?.id?.trim();
    const overrideId = editPriceOverrideTarget.value?.id?.trim();
    if (!contractId || !overrideId || !canManagePriceOverrides.value || editPriceOverrideLoading.value) return;

    const serviceCode = editPriceOverrideForm.serviceCode.trim().toUpperCase();
    const overrideValue = editPriceOverrideForm.overrideValue.trim();
    if (!serviceCode || !overrideValue) {
        notifyError('Service code and negotiated price value are required.');
        return;
    }

    editPriceOverrideLoading.value = true;
    try {
        await apiRequest<ItemResponse<PriceOverride>>('PATCH', `/billing-payer-contracts/${contractId}/price-overrides/${overrideId}`, {
            body: {
                billingServiceCatalogItemId: nullableTrimmedValue(editPriceOverrideForm.billingServiceCatalogItemId),
                serviceCode,
                serviceName: nullableTrimmedValue(editPriceOverrideForm.serviceName),
                serviceType: editPriceOverrideForm.serviceType.trim() || null,
                department: nullableTrimmedValue(editPriceOverrideForm.department),
                pricingStrategy: editPriceOverrideForm.pricingStrategy,
                overrideValue,
                effectiveFrom: nullableTrimmedValue(editPriceOverrideForm.effectiveFrom),
                effectiveTo: nullableTrimmedValue(editPriceOverrideForm.effectiveTo),
                overrideNotes: nullableTrimmedValue(editPriceOverrideForm.overrideNotes),
            },
        });
        notifySuccess('Negotiated price updated.');
        editPriceOverrideOpen.value = false;
        await loadPriceOverrides();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update contract price override.'));
    } finally {
        editPriceOverrideLoading.value = false;
    }
}

async function saveRuleEdit() {
    const contractId = selectedContract.value?.id?.trim();
    const ruleId = editRuleTarget.value?.id?.trim();
    if (!contractId || !ruleId || !canManageRules.value || editRuleLoading.value) return;

    const ruleCode = editRuleForm.ruleCode.trim();
    const ruleName = editRuleForm.ruleName.trim();
    if (!ruleCode || !ruleName) {
        notifyError('Policy code and policy name are required.');
        return;
    }

    editRuleLoading.value = true;
    try {
        await apiRequest<ItemResponse<Rule>>('PATCH', `/billing-payer-contracts/${contractId}/authorization-rules/${ruleId}`, {
            body: {
                billingServiceCatalogItemId: nullableTrimmedValue(editRuleForm.billingServiceCatalogItemId),
                ruleCode,
                ruleName,
                serviceCode: editRuleForm.serviceCode.trim().toUpperCase() || null,
                serviceType: editRuleForm.serviceType.trim() || null,
                department: nullableTrimmedValue(editRuleForm.department),
                diagnosisCode: nullableTrimmedValue(editRuleForm.diagnosisCode),
                priority: editRuleForm.priority.trim() || null,
                minPatientAgeYears: nullableTrimmedValue(editRuleForm.minPatientAgeYears),
                maxPatientAgeYears: nullableTrimmedValue(editRuleForm.maxPatientAgeYears),
                gender: editRuleForm.gender.trim() || 'any',
                amountThreshold: nullableTrimmedValue(editRuleForm.amountThreshold),
                quantityLimit: nullableTrimmedValue(editRuleForm.quantityLimit),
                coverageDecision: editRuleForm.coverageDecision || 'covered_with_rule',
                coveragePercentOverride: nullableTrimmedValue(editRuleForm.coveragePercentOverride),
                copayType: editRuleForm.copayType || 'none',
                copayValue: editRuleForm.copayType === 'none' ? null : nullableTrimmedValue(editRuleForm.copayValue),
                benefitLimitAmount: nullableTrimmedValue(editRuleForm.benefitLimitAmount),
                effectiveFrom: nullableTrimmedValue(editRuleForm.effectiveFrom),
                effectiveTo: nullableTrimmedValue(editRuleForm.effectiveTo),
                requiresAuthorization: editRuleForm.requiresAuthorization === 'true',
                autoApprove: editRuleForm.autoApprove === 'true',
                authorizationValidityDays: nullableTrimmedValue(editRuleForm.authorizationValidityDays),
                ruleNotes: editRuleForm.ruleNotes.trim() || null,
                ruleExpression: buildRuleExpression(editRuleForm),
            },
        });
        notifySuccess('Contract policy updated.');
        editRuleOpen.value = false;
        await Promise.all([loadRules(), loadPolicySummary()]);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update contract policy.'));
    } finally {
        editRuleLoading.value = false;
    }
}

async function saveRuleStatus() {
    const contractId = selectedContract.value?.id?.trim();
    const ruleId = ruleStatusItem.value?.id?.trim();
    if (!contractId || !ruleId || !canManageRules.value || ruleStatusLoading.value) return;

    const reason = ruleStatusReason.value.trim();
    if (ruleStatusTarget.value !== 'active' && !reason) {
        ruleStatusError.value = 'Reason is required for inactive or retired status.';
        return;
    }

    ruleStatusLoading.value = true;
    ruleStatusError.value = null;
    try {
        await apiRequest<ItemResponse<Rule>>('PATCH', `/billing-payer-contracts/${contractId}/authorization-rules/${ruleId}/status`, {
            body: { status: ruleStatusTarget.value, reason: ruleStatusTarget.value === 'active' ? null : reason },
        });
        notifySuccess('Policy status updated.');
        ruleStatusOpen.value = false;
        await Promise.all([loadRules(), loadPolicySummary()]);
    } catch (error) {
        ruleStatusError.value = messageFromUnknown(error, 'Unable to update contract policy status.');
        notifyError(ruleStatusError.value);
    } finally {
        ruleStatusLoading.value = false;
    }
}

async function savePriceOverrideStatus() {
    const contractId = selectedContract.value?.id?.trim();
    const overrideId = priceOverrideStatusItem.value?.id?.trim();
    if (!contractId || !overrideId || !canManagePriceOverrides.value || priceOverrideStatusLoading.value) return;

    const reason = priceOverrideStatusReason.value.trim();
    if (priceOverrideStatusTarget.value !== 'active' && !reason) {
        priceOverrideStatusError.value = 'Reason is required for inactive or retired status.';
        return;
    }

    priceOverrideStatusLoading.value = true;
    priceOverrideStatusError.value = null;
    try {
        await apiRequest<ItemResponse<PriceOverride>>('PATCH', `/billing-payer-contracts/${contractId}/price-overrides/${overrideId}/status`, {
            body: { status: priceOverrideStatusTarget.value, reason: priceOverrideStatusTarget.value === 'active' ? null : reason },
        });
        notifySuccess('Negotiated price status updated.');
        priceOverrideStatusOpen.value = false;
        await loadPriceOverrides();
    } catch (error) {
        priceOverrideStatusError.value = messageFromUnknown(error, 'Unable to update negotiated price status.');
        notifyError(priceOverrideStatusError.value);
    } finally {
        priceOverrideStatusLoading.value = false;
    }
}

async function loadContractAudit(item: Contract) {
    const contractId = item.id?.trim();
    if (!contractId || !canAudit.value) return;
    contractAuditTarget.value = item;
    contractAuditLoading.value = true;
    contractAuditError.value = null;
    try {
        const response = await apiRequest<AuditResponse>('GET', `/billing-payer-contracts/${contractId}/audit-logs`, { query: { page: 1, perPage: 20 } });
        contractAuditLogs.value = response.data ?? [];
    } catch (error) {
        contractAuditLogs.value = [];
        contractAuditError.value = messageFromUnknown(error, 'Unable to load contract audit logs.');
    } finally {
        contractAuditLoading.value = false;
    }
}

async function exportContractAuditLogsCsv() {
    const contractId = contractAuditTarget.value?.id?.trim();
    if (!contractId || !canAudit.value || contractAuditExporting.value) return;
    contractAuditExporting.value = true;
    try {
        const url = new URL(`/api/v1/billing-payer-contracts/${contractId}/audit-logs/export`, window.location.origin);
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        contractAuditExporting.value = false;
    }
}

async function loadPriceOverrideAudit(item: PriceOverride) {
    const contractId = selectedContract.value?.id?.trim();
    const overrideId = item.id?.trim();
    if (!contractId || !overrideId || !canPriceOverrideAudit.value) return;
    priceOverrideAuditTarget.value = item;
    priceOverrideAuditLoading.value = true;
    priceOverrideAuditError.value = null;
    try {
        const response = await apiRequest<AuditResponse>('GET', `/billing-payer-contracts/${contractId}/price-overrides/${overrideId}/audit-logs`, { query: { page: 1, perPage: 20 } });
        priceOverrideAuditLogs.value = response.data ?? [];
    } catch (error) {
        priceOverrideAuditLogs.value = [];
        priceOverrideAuditError.value = messageFromUnknown(error, 'Unable to load negotiated price audit logs.');
    } finally {
        priceOverrideAuditLoading.value = false;
    }
}

async function exportPriceOverrideAuditLogsCsv() {
    const contractId = selectedContract.value?.id?.trim();
    const overrideId = priceOverrideAuditTarget.value?.id?.trim();
    if (!contractId || !overrideId || !canPriceOverrideAudit.value || priceOverrideAuditExporting.value) return;
    priceOverrideAuditExporting.value = true;
    try {
        const url = new URL(`/api/v1/billing-payer-contracts/${contractId}/price-overrides/${overrideId}/audit-logs/export`, window.location.origin);
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        priceOverrideAuditExporting.value = false;
    }
}

async function loadRuleAudit(item: Rule) {
    const contractId = selectedContract.value?.id?.trim();
    const ruleId = item.id?.trim();
    if (!contractId || !ruleId || !canRuleAudit.value) return;
    ruleAuditTarget.value = item;
    ruleAuditLoading.value = true;
    ruleAuditError.value = null;
    try {
        const response = await apiRequest<AuditResponse>('GET', `/billing-payer-contracts/${contractId}/authorization-rules/${ruleId}/audit-logs`, { query: { page: 1, perPage: 20 } });
        ruleAuditLogs.value = response.data ?? [];
    } catch (error) {
        ruleAuditLogs.value = [];
        ruleAuditError.value = messageFromUnknown(error, 'Unable to load policy audit logs.');
    } finally {
        ruleAuditLoading.value = false;
    }
}

async function exportRuleAuditLogsCsv() {
    const contractId = selectedContract.value?.id?.trim();
    const ruleId = ruleAuditTarget.value?.id?.trim();
    if (!contractId || !ruleId || !canRuleAudit.value || ruleAuditExporting.value) return;
    ruleAuditExporting.value = true;
    try {
        const url = new URL(`/api/v1/billing-payer-contracts/${contractId}/authorization-rules/${ruleId}/audit-logs/export`, window.location.origin);
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        ruleAuditExporting.value = false;
    }
}

function searchContracts() { filters.page = 1; void refreshPage(); }
function resetContracts() { filters.q = ''; filters.status = ''; filters.payerType = ''; filters.page = 1; void refreshPage(); }
function setStatus(status: '' | ContractStatus) { filters.status = status; filters.page = 1; void refreshPage(); }
function prevPage() { if ((pagination.value?.currentPage ?? 1) > 1) { filters.page -= 1; void loadContracts(); } }
function nextPage() { if (pagination.value && pagination.value.currentPage < pagination.value.lastPage) { filters.page += 1; void loadContracts(); } }
function searchPriceOverrides() { priceOverrideFilters.page = 1; void loadPriceOverrides(); }
function resetPriceOverrides() {
    priceOverrideFilters.q = '';
    priceOverrideFilters.status = '';
    priceOverrideFilters.serviceType = '';
    priceOverrideFilters.pricingStrategy = '';
    priceOverrideFilters.page = 1;
    void loadPriceOverrides();
}
function prevPriceOverridesPage() {
    if ((priceOverridesPagination.value?.currentPage ?? 1) > 1) {
        priceOverrideFilters.page -= 1;
        void loadPriceOverrides();
    }
}
function nextPriceOverridesPage() {
    if (priceOverridesPagination.value && priceOverridesPagination.value.currentPage < priceOverridesPagination.value.lastPage) {
        priceOverrideFilters.page += 1;
        void loadPriceOverrides();
    }
}
function searchRules() { ruleFilters.page = 1; void loadRules(); }
function resetRules() { ruleFilters.q = ''; ruleFilters.status = ''; ruleFilters.serviceType = ''; ruleFilters.coverageDecision = ''; ruleFilters.page = 1; void loadRules(); }
function prevRulesPage() { if ((rulesPagination.value?.currentPage ?? 1) > 1) { ruleFilters.page -= 1; void loadRules(); } }
function nextRulesPage() { if (rulesPagination.value && rulesPagination.value.currentPage < rulesPagination.value.lastPage) { ruleFilters.page += 1; void loadRules(); } }

onMounted(refreshPage);
</script>

<template>
    <Head title="Payer Contracts" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight"><AppIcon name="shield-check" class="size-7 text-primary" />Payer Contracts</h1>
                    <p class="mt-1 text-sm text-muted-foreground">Manage payer agreements, coverage posture, negotiated prices, and contract policies from one billing workspace.</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <div class="flex items-center gap-1 rounded-lg border bg-muted/10 p-1">
                        <Button size="sm" class="h-8 px-3" :variant="contractWorkspaceMode === 'list' ? 'default' : 'ghost'" @click="openContractListWorkspace">
                            Contract List
                        </Button>
                        <Button v-if="canManage" size="sm" class="h-8 px-3" :variant="contractWorkspaceMode === 'create' ? 'default' : 'ghost'" @click="openContractCreateWorkspace">
                            Add Contract
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" as-child class="gap-1.5">
                        <Link href="/billing-corporate">
                            <AppIcon name="building-2" class="size-3.5" />
                            Corporate Billing
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" :disabled="listLoading" class="gap-1.5" @click="refreshPage"><AppIcon name="activity" class="size-3.5" />{{ listLoading ? 'Refreshing...' : 'Refresh' }}</Button>
                </div>
            </div>

            <Card class="rounded-lg border-sidebar-border/70">
                <CardHeader class="pb-3">
                    <CardTitle class="flex items-center gap-2">
                        <AppIcon name="layout-list" class="size-4 text-muted-foreground" />
                        Connected Workflows
                    </CardTitle>
                    <CardDescription>Move between pricing, billing, and claims work without losing payer context.</CardDescription>
                </CardHeader>
                <CardContent class="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" as-child class="gap-1.5">
                        <Link href="/billing-corporate">
                            <AppIcon name="building-2" class="size-3.5" />
                            Corporate Billing
                        </Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child class="gap-1.5">
                        <Link href="/billing-invoices">
                            <AppIcon name="receipt" class="size-3.5" />
                            Billing Invoices
                        </Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child class="gap-1.5">
                        <Link href="/billing-service-catalog">
                            <AppIcon name="list" class="size-3.5" />
                            Service Prices
                        </Link>
                    </Button>
                    <Button size="sm" variant="outline" as-child class="gap-1.5">
                        <Link href="/claims-insurance">
                            <AppIcon name="activity" class="size-3.5" />
                            Claims &amp; Insurance
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            <Alert v-if="scopeWarning" variant="destructive"><AlertTitle>Scope warning</AlertTitle><AlertDescription>{{ scopeWarning }}</AlertDescription></Alert>
            <Alert v-if="listErrors.length" variant="destructive"><AlertTitle>Request error</AlertTitle><AlertDescription><p v-for="errorMessage in listErrors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p></AlertDescription></Alert>

            <Card v-if="canRead && contractWorkspaceMode === 'list'" class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70">
                <CardHeader class="gap-2 pb-2">
                    <div class="space-y-1">
                        <CardTitle class="flex items-center gap-2"><AppIcon name="layout-list" class="size-5 text-muted-foreground" />Contract List</CardTitle>
                        <CardDescription>Showing {{ contracts.length }} of {{ pagination?.total ?? contracts.length }} payer contracts in the current list.</CardDescription>
                    </div>
                    <div class="space-y-2">
                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status focus</p>
                        <div class="flex flex-wrap items-center gap-2">
                            <Button size="sm" class="h-8 gap-1.5" :variant="filters.status === '' ? 'default' : 'outline'" @click="setStatus('')"><span class="font-medium">{{ counts.total }}</span>All contracts</Button>
                            <Button size="sm" class="h-8 gap-1.5" :variant="filters.status === 'active' ? 'default' : 'outline'" @click="setStatus('active')"><span class="font-medium">{{ counts.active }}</span>Active</Button>
                            <Button size="sm" class="h-8 gap-1.5" :variant="filters.status === 'inactive' ? 'default' : 'outline'" @click="setStatus('inactive')"><span class="font-medium">{{ counts.inactive }}</span>Inactive</Button>
                            <Button size="sm" class="h-8 gap-1.5" :variant="filters.status === 'retired' ? 'default' : 'outline'" @click="setStatus('retired')"><span class="font-medium">{{ counts.retired }}</span>Retired</Button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <div class="flex w-full flex-col gap-2 xl:flex-row xl:items-center">
                            <div class="min-w-0 flex-1">
                                <label for="contract-q" class="sr-only">Search contracts</label>
                                <div class="relative min-w-0">
                                    <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <Input id="contract-q" v-model="filters.q" placeholder="Search contract code, contract name, or payer" class="h-9 pl-9" @keyup.enter="searchContracts" />
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <div class="min-w-[180px] sm:min-w-[220px]">
                                    <label for="contract-payer-type" class="sr-only">Payer type</label>
                                    <Select v-model="filterPayerTypeSelectValue">
                                        <SelectTrigger id="contract-payer-type" class="h-9 w-full">
                                            <SelectValue placeholder="All payer types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">All payer types</SelectItem>
                                            <SelectItem v-for="option in payerTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button variant="outline" size="sm" class="h-9 gap-1.5" @click="searchContracts"><AppIcon name="search" class="size-3.5" />{{ listLoading ? 'Searching...' : 'Search' }}</Button>
                                <Button v-if="contractActiveFilterChips.length > 0" variant="ghost" size="sm" class="h-9 gap-1.5" @click="resetContracts">Clear</Button>
                                <Button v-if="canManage" size="sm" class="h-9 gap-1.5" @click="openContractCreateWorkspace"><AppIcon name="plus" class="size-3.5" />Add Contract</Button>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/10 px-3 py-2.5 text-sm">
                            <span class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Current focus</span>
                            <span>{{ contractWorkspaceFocusLabel }}</span>
                            <template v-if="filters.q.trim()">
                                <span class="text-muted-foreground">|</span>
                                <span>Search "{{ filters.q.trim() }}"</span>
                            </template>
                        </div>
                        <div v-if="contractActiveFilterChips.length > 0" class="flex flex-wrap items-center gap-2 border-t pt-2">
                            <Badge v-for="chip in contractActiveFilterChips" :key="`contract-filter-${chip}`" variant="outline">{{ chip }}</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="min-h-[12rem] space-y-3 p-4">
                            <div v-if="contractShowInitialSkeleton" class="space-y-2"><Skeleton class="h-24 w-full rounded-lg" /><Skeleton class="h-24 w-full rounded-lg" /><Skeleton class="h-24 w-full rounded-lg" /></div>
                            <template v-else>
                                <div v-if="contractListRefreshing" class="sticky top-0 z-10 -mb-1 flex justify-end pb-2">
                                    <Badge variant="secondary" class="gap-1.5 shadow-sm"><AppIcon name="loader-circle" class="size-3.5 animate-spin" />Refreshing contracts</Badge>
                                </div>
                                <div v-if="contracts.length === 0" class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No payer contracts matched the current list filters.</div>
                                <div v-else class="space-y-3" :class="contractListRefreshing ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'">
                                    <div v-for="item in contracts" :key="item.id || item.contractCode || item.contractName" :class="['rounded-lg border bg-background/70 p-3', selectedContract?.id === item.id ? 'border-primary/40 bg-primary/5' : '', (item.status ?? '').toLowerCase() === 'inactive' ? 'border-l-4 border-l-amber-500' : '', (item.status ?? '').toLowerCase() === 'retired' ? 'border-l-4 border-l-rose-500' : '']">
                                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div class="min-w-0 flex-1 space-y-2">
                                                <div class="flex flex-wrap items-start justify-between gap-2">
                                                    <p class="min-w-0 text-sm font-semibold">{{ contractLabel(item) }}</p>
                                                    <p class="shrink-0 text-sm font-medium">{{ item.currencyCode || defaultCurrencyCode }}</p>
                                                </div>
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <Badge variant="outline">{{ formatEnumLabel(item.payerType || 'unknown') }}</Badge>
                                                    <Badge variant="outline">{{ item.payerName || 'Payer not set' }}</Badge>
                                                    <Badge :variant="statusVariant(item.status)">{{ formatEnumLabel(item.status || 'unknown') }}</Badge>
                                                    <Badge :variant="item.requiresPreAuthorization ? 'destructive' : 'secondary'">{{ item.requiresPreAuthorization ? 'Pre-auth required' : 'No pre-auth' }}</Badge>
                                                </div>
                                                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    <span>{{ formatCoverageLabel(item.defaultCoveragePercent, item.defaultCopayType, item.defaultCopayValue, item.currencyCode) }}</span>
                                                    <span>|</span>
                                                    <span>{{ formatOperationalCycleLabel(item.claimSubmissionDeadlineDays, item.settlementCycleDays) }}</span>
                                                </div>
                                                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                    <span>Updated {{ formatDateTime(item.updatedAt) }}</span>
                                                    <span>|</span>
                                                    <span>{{ item.payerPlanName || item.payerPlanCode ? `Plan ${item.payerPlanName || item.payerPlanCode}` : 'Plan not set' }}</span>
                                                    <span>|</span>
                                                    <span>{{ formatContractWindowLabel(item.effectiveFrom, item.effectiveTo) }}</span>
                                                </div>
                                                <div v-if="item.statusReason" class="rounded-md border border-dashed bg-muted/10 px-2.5 py-2 text-xs text-muted-foreground">Status note: {{ item.statusReason }}</div>
                                            </div>
                                            <div class="flex shrink-0 flex-wrap items-center gap-2">
                                                <Button size="sm" class="gap-1.5" :variant="selectedContract?.id === item.id ? 'secondary' : 'default'" @click="selectContract(item)"><AppIcon name="shield-check" class="size-3.5" />{{ selectedContract?.id === item.id ? 'Policies open' : 'Open policies' }}</Button>
                                                <Button v-if="canManage" size="sm" variant="outline" class="gap-1.5" @click="openContractEdit(item)"><AppIcon name="pencil" class="size-3.5" />Edit</Button>
                                                <Button v-if="canManage" size="sm" :variant="(item.status ?? '').toLowerCase() === 'active' ? 'destructive' : 'secondary'" @click="openContractStatusDialog(item, (item.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active')">{{ (item.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}</Button>
                                                <Button v-if="canManage && (item.status ?? '').toLowerCase() !== 'retired'" size="sm" variant="destructive" @click="openContractStatusDialog(item, 'retired')">Retire</Button>
                                                <Button v-if="canAudit" size="sm" variant="outline" class="gap-1.5" @click="loadContractAudit(item)"><AppIcon name="activity" class="size-3.5" />Audit</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </ScrollArea>
                    <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/10 px-4 py-3">
                        <p class="text-xs text-muted-foreground">Showing {{ contracts.length }} on this page<span v-if="pagination"> | {{ pagination.total }} total</span> | Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}</p>
                        <div class="flex items-center gap-2"><Button variant="outline" size="sm" :disabled="listLoading || (pagination?.currentPage ?? 1) <= 1" @click="prevPage">Previous</Button><Button variant="outline" size="sm" :disabled="listLoading || !pagination || pagination.currentPage >= pagination.lastPage" @click="nextPage">Next</Button></div>
                    </footer>
                </CardContent>
            </Card>

            <Card v-if="contractWorkspaceMode === 'create'" id="create-payer-contract" class="rounded-lg border-sidebar-border/70">
                <CardHeader class="gap-3">
                    <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div class="space-y-1">
                            <CardTitle class="flex items-center gap-2"><AppIcon name="plus" class="size-5 text-muted-foreground" />Add Payer Contract</CardTitle>
                            <CardDescription>Create a billing contract record with the minimum fields needed for coverage and authorization control.</CardDescription>
                        </div>
                        <div class="rounded-lg border bg-muted/10 px-3 py-2 text-sm">
                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>{{ contractCreateReady ? 'Ready to save' : 'Setup in progress' }}</span>
                                <span class="text-muted-foreground">|</span>
                                <span>{{ formatEnumLabel(createForm.payerType) }}</span>
                                <span class="text-muted-foreground">|</span>
                                <span>{{ (createForm.currencyCode.trim() || defaultCurrencyCode).toUpperCase() }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-3">
                        <div class="rounded-lg border bg-muted/10 px-3 py-2.5"><p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Contract identity</p><p class="mt-1 text-sm font-medium">{{ contractCreateSummary.identity }}</p></div>
                        <div class="rounded-lg border bg-muted/10 px-3 py-2.5"><p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Payer setup</p><p class="mt-1 text-sm font-medium">{{ contractCreateSummary.payer }}</p></div>
                        <div class="rounded-lg border bg-muted/10 px-3 py-2.5"><p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Billing posture</p><p class="mt-1 text-sm font-medium">{{ contractCreateSummary.billing }}</p></div>
                    </div>
                </CardHeader>
                <CardContent class="space-y-4">
                    <Alert v-if="!canManage" variant="destructive"><AlertTitle>Create access restricted</AlertTitle><AlertDescription>Request <code>billing.payer-contracts.manage</code> permission.</AlertDescription></Alert>
                    <template v-else>
                            <div class="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
                                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    <FormFieldShell input-id="create-contract-code" label="Contract code"><Input id="create-contract-code" v-model="createForm.contractCode" /></FormFieldShell>
                                    <FormFieldShell input-id="create-contract-name" label="Contract name"><Input id="create-contract-name" v-model="createForm.contractName" /></FormFieldShell>
                                    <FormFieldShell input-id="create-payer-type" label="Payer type">
                                        <Select v-model="createPayerTypeSelectValue">
                                            <SelectTrigger id="create-payer-type" class="w-full"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem v-for="option in payerTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                        </Select>
                                    </FormFieldShell>
                                    <FormFieldShell input-id="create-payer-name" label="Payer name"><Input id="create-payer-name" v-model="createForm.payerName" /></FormFieldShell>
                                    <FormFieldShell input-id="create-payer-plan-code" label="Plan code"><Input id="create-payer-plan-code" v-model="createForm.payerPlanCode" /></FormFieldShell>
                                    <FormFieldShell input-id="create-payer-plan-name" label="Plan name"><Input id="create-payer-plan-name" v-model="createForm.payerPlanName" /></FormFieldShell>
                                    <FormFieldShell input-id="create-currency" label="Currency"><Input id="create-currency" v-model="createForm.currencyCode" maxlength="3" /></FormFieldShell>
                                    <FormFieldShell input-id="create-coverage-percent" label="Default coverage %"><Input id="create-coverage-percent" v-model="createForm.defaultCoveragePercent" inputmode="decimal" placeholder="80" /></FormFieldShell>
                                    <FormFieldShell input-id="create-copay-type" label="Co-pay type">
                                        <Select v-model="createDefaultCopayTypeSelectValue">
                                            <SelectTrigger id="create-copay-type" class="w-full"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem v-for="option in copayTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                        </Select>
                                    </FormFieldShell>
                                    <FormFieldShell input-id="create-copay-value" label="Co-pay value" :helper-text="createForm.defaultCopayType === 'fixed' ? 'Fixed amount in contract currency.' : createForm.defaultCopayType === 'percentage' ? 'Percentage applied as member co-pay.' : 'No co-pay when type is none.'">
                                        <Input id="create-copay-value" v-model="createForm.defaultCopayValue" inputmode="decimal" :disabled="createForm.defaultCopayType === 'none'" />
                                    </FormFieldShell>
                                    <FormFieldShell input-id="create-preauth" label="Requires pre-authorization">
                                        <Select v-model="createRequiresPreAuthorizationSelectValue">
                                            <SelectTrigger id="create-preauth" class="w-full"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                                        </Select>
                                    </FormFieldShell>
                                    <FormFieldShell input-id="create-claim-submission-deadline" label="Claim deadline days"><Input id="create-claim-submission-deadline" v-model="createForm.claimSubmissionDeadlineDays" inputmode="numeric" placeholder="30" /></FormFieldShell>
                                    <FormFieldShell input-id="create-settlement-cycle" label="Settlement cycle days"><Input id="create-settlement-cycle" v-model="createForm.settlementCycleDays" inputmode="numeric" placeholder="45" /></FormFieldShell>
                                    <SingleDatePopoverField input-id="create-effective-from" label="Effective from" v-model="createForm.effectiveFrom" />
                                    <SingleDatePopoverField input-id="create-effective-to" label="Effective to" v-model="createForm.effectiveTo" />
                                    <FormFieldShell input-id="create-contract-notes" label="Terms and notes" container-class="md:col-span-2 xl:col-span-3">
                                        <Textarea id="create-contract-notes" v-model="createForm.termsAndNotes" class="min-h-24" />
                                    </FormFieldShell>
                                </div>
                            <div class="rounded-lg border bg-muted/10 p-4">
                                <p class="text-sm font-medium">What this contract controls</p>
                                <p class="mt-1 text-xs text-muted-foreground">Create the contract record here first. Service-specific coverage policies, exclusions, and authorization routing can be added immediately after saving.</p>
                                <div class="mt-3 space-y-2 text-sm">
                                    <div class="rounded-lg border bg-background/70 px-3 py-2"><p class="font-medium">Coverage owner</p><p class="mt-1 text-xs text-muted-foreground">Use the payer name that billing and claims staff recognize day to day.</p></div>
                                    <div class="rounded-lg border bg-background/70 px-3 py-2"><p class="font-medium">Default policy posture</p><p class="mt-1 text-xs text-muted-foreground">This sets the contract-level expectation before line-level coverage policies are added.</p></div>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <p class="text-xs text-muted-foreground">Use consistent contract codes so pricing, claims, and billing can reference the same payer record.</p>
                            <div class="flex items-center gap-2">
                                <Button variant="outline" @click="openContractListWorkspace">Back to list</Button>
                                <Button :disabled="createLoading" class="gap-1.5" @click="createContract"><AppIcon name="plus" class="size-3.5" />{{ createLoading ? 'Creating...' : 'Save contract' }}</Button>
                            </div>
                        </div>
                    </template>
                </CardContent>
            </Card>

            <Card v-if="selectedContract && canRead" class="rounded-lg border-sidebar-border/70">
                <CardHeader class="gap-3">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <CardTitle class="flex items-center gap-2"><AppIcon name="shield-check" class="size-5 text-muted-foreground" />Contract Operations</CardTitle>
                            <CardDescription>{{ contractLabel(selectedContract) }}</CardDescription>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <Button v-if="canManage" variant="outline" size="sm" class="gap-1.5" @click="openContractEdit(selectedContract)">
                                <AppIcon name="pencil" class="size-3.5" />
                                Edit contract
                            </Button>
                            <Button v-if="canAudit" variant="outline" size="sm" class="gap-1.5" @click="loadContractAudit(selectedContract)">
                                <AppIcon name="activity" class="size-3.5" />
                                Contract audit
                            </Button>
                            <Button variant="outline" size="sm" @click="clearSelectedContract">Close</Button>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/10 px-3 py-2.5 text-sm">
                        <span class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Contract context</span>
                        <span>{{ formatEnumLabel(selectedContract.payerType || 'unknown') }}</span>
                        <span class="text-muted-foreground">|</span>
                        <span>{{ selectedContract.payerName || 'Payer not set' }}</span>
                        <span class="text-muted-foreground">|</span>
                        <span>{{ selectedContract.requiresPreAuthorization ? 'Pre-auth required by default' : 'Pre-auth not required by default' }}</span>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <div
                            v-for="card in selectedContractSummaryCards"
                            :key="card.key"
                            class="rounded-lg border bg-background/70 px-3 py-2.5"
                        >
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ card.label }}</p>
                            <p class="mt-1 text-sm font-semibold">{{ card.value }}</p>
                            <p class="mt-1 text-xs text-muted-foreground">{{ card.helper }}</p>
                        </div>
                    </div>
                    <div v-if="selectedContract.termsAndNotes?.trim()" class="rounded-lg border bg-muted/10 px-3 py-2.5">
                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Terms and notes</p>
                        <p class="mt-1 text-sm">{{ selectedContract.termsAndNotes }}</p>
                    </div>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)]">
                        <div class="space-y-3 rounded-lg border bg-background/70 p-4">
                            <div class="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <h3 class="text-sm font-semibold">Coverage Matrix</h3>
                                    <p class="mt-1 text-xs text-muted-foreground">Read the active contract policy posture by service family before working line-level claims and billing exceptions.</p>
                                </div>
                                <Badge variant="outline">{{ policySummaryOverview.activePolicies }} active polic{{ policySummaryOverview.activePolicies === 1 ? 'y' : 'ies' }}</Badge>
                            </div>
                            <Alert v-if="policySummaryError" variant="destructive">
                                <AlertTitle>Policy summary issue</AlertTitle>
                                <AlertDescription>{{ policySummaryError }}</AlertDescription>
                            </Alert>
                            <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Service families</p>
                                    <p class="mt-1 text-sm font-semibold">{{ policySummaryOverview.serviceFamilies }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Excluded</p>
                                    <p class="mt-1 text-sm font-semibold">{{ policySummaryOverview.excludedPolicies }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Manual Review</p>
                                    <p class="mt-1 text-sm font-semibold">{{ policySummaryOverview.manualReviewPolicies }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Benefit Bands</p>
                                    <p class="mt-1 text-sm font-semibold">{{ policySummaryOverview.benefitBandPolicies }}</p>
                                </div>
                            </div>
                            <div v-if="policySummaryLoading && !policySummary" class="space-y-2">
                                <Skeleton class="h-20 w-full rounded-lg" />
                                <Skeleton class="h-20 w-full rounded-lg" />
                                <Skeleton class="h-20 w-full rounded-lg" />
                            </div>
                            <div v-else-if="(policySummary?.familyMatrix?.length ?? 0) === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                No active service-family policies are set for this contract yet.
                            </div>
                            <div v-else class="space-y-2">
                                <div v-for="row in policySummary?.familyMatrix ?? []" :key="row.key" class="rounded-lg border bg-muted/10 p-3">
                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p class="text-sm font-medium">{{ row.label }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ row.policyCount }} active polic{{ row.policyCount === 1 ? 'y' : 'ies' }} | {{ row.specificServiceCount }} service-specific</p>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge :variant="policyDecisionVariant(row.dominantDecision)">{{ formatEnumLabel(row.dominantDecision) }}</Badge>
                                            <Badge variant="outline">{{ formatPolicyCoverageRangeLabel(row) }}</Badge>
                                        </div>
                                    </div>
                                    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span>{{ row.coveredPolicyCount }} covered</span>
                                        <span>|</span>
                                        <span>{{ row.excludedPolicyCount }} excluded</span>
                                        <span>|</span>
                                        <span>{{ row.manualReviewPolicyCount }} manual review</span>
                                    </div>
                                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span>{{ row.requiresAuthorizationCount }} require auth</span>
                                        <span>|</span>
                                        <span>{{ row.autoApproveCount }} auto-approve</span>
                                        <span>|</span>
                                        <span>{{ row.benefitBandCount }} banded</span>
                                        <span>|</span>
                                        <span>{{ row.windowedPolicyCount }} windowed</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-3 rounded-lg border bg-background/70 p-4">
                            <div>
                                <h3 class="text-sm font-semibold">Benefit Bands & Limits</h3>
                                <p class="mt-1 text-xs text-muted-foreground">Track thresholded, time-bound, co-pay, and capped policies that materially change claim and billing behavior.</p>
                            </div>
                            <div v-if="policySummaryLoading && !policySummary" class="space-y-2">
                                <Skeleton class="h-16 w-full rounded-lg" />
                                <Skeleton class="h-16 w-full rounded-lg" />
                                <Skeleton class="h-16 w-full rounded-lg" />
                            </div>
                            <div v-else-if="(policySummary?.benefitBands?.length ?? 0) === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                No active benefit bands or limit-driven policies are set yet.
                            </div>
                            <div v-else class="space-y-2">
                                <div v-for="item in policySummary?.benefitBands ?? []" :key="item.ruleId || item.ruleCode || item.ruleName" class="rounded-lg border bg-muted/10 p-3">
                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p class="text-sm font-medium">{{ item.ruleName || item.ruleCode || 'Policy band' }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">
                                                {{ item.serviceType ? formatEnumLabel(item.serviceType) : item.serviceCode ? 'Service-specific' : 'All services' }}
                                                <span v-if="item.serviceCode"> | {{ item.serviceCode }}</span>
                                                <span v-if="item.department"> | {{ item.department }}</span>
                                            </p>
                                        </div>
                                        <Badge :variant="policyDecisionVariant(item.coverageDecision)">{{ formatEnumLabel(item.coverageDecision || 'covered_with_rule') }}</Badge>
                                    </div>
                                    <div class="mt-2 flex flex-wrap gap-1">
                                        <Badge v-for="chip in formatPolicyBandChips(item)" :key="`${item.ruleId || item.ruleCode || item.ruleName}-${chip}`" variant="outline" class="text-[10px]">{{ chip }}</Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-3">
                        <div class="flex flex-wrap items-start justify-between gap-2">
                            <div>
                                <h3 class="text-sm font-semibold">Negotiated Prices</h3>
                                <p class="mt-1 text-xs text-muted-foreground">Set insurer-specific prices that should override the base service price during billing.</p>
                            </div>
                        </div>
                        <Alert v-if="priceOverrideErrors.length" variant="destructive"><AlertTitle>Price override request error</AlertTitle><AlertDescription><p v-for="errorMessage in priceOverrideErrors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p></AlertDescription></Alert>
                        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
                            <div class="min-w-0 flex-1">
                                <label for="price-override-q" class="sr-only">Search negotiated prices</label>
                                <div class="relative min-w-0">
                                    <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <Input id="price-override-q" v-model="priceOverrideFilters.q" placeholder="Search service code or service name" class="h-9 pl-9" @keyup.enter="searchPriceOverrides" />
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <div class="min-w-[180px]">
                                    <label for="price-override-status" class="sr-only">Negotiated price status</label>
                                    <Select v-model="priceOverrideFilterStatusSelectValue">
                                        <SelectTrigger id="price-override-status" class="h-9 w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
                                        <SelectContent><SelectItem value="__none__">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div class="min-w-[180px]">
                                    <label for="price-override-service-type" class="sr-only">Negotiated price service type</label>
                                    <Select v-model="priceOverrideFilterServiceTypeSelectValue">
                                        <SelectTrigger id="price-override-service-type" class="h-9 w-full"><SelectValue placeholder="All service types" /></SelectTrigger>
                                        <SelectContent><SelectItem value="__none__">All service types</SelectItem><SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div class="min-w-[180px]">
                                    <label for="price-override-strategy" class="sr-only">Negotiated price strategy</label>
                                    <Select v-model="priceOverrideFilterPricingStrategySelectValue">
                                        <SelectTrigger id="price-override-strategy" class="h-9 w-full"><SelectValue placeholder="All pricing styles" /></SelectTrigger>
                                        <SelectContent><SelectItem value="__none__">All pricing styles</SelectItem><SelectItem value="fixed_price">Fixed price</SelectItem><SelectItem value="discount_percent">Discount %</SelectItem><SelectItem value="markup_percent">Markup %</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <Button variant="outline" size="sm" class="h-9 gap-1.5" @click="searchPriceOverrides"><AppIcon name="search" class="size-3.5" />{{ priceOverridesLoading ? 'Searching...' : 'Search' }}</Button>
                                <Button variant="ghost" size="sm" class="h-9 gap-1.5" @click="resetPriceOverrides">Clear</Button>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <div v-if="priceOverridesLoading" class="space-y-2"><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /></div>
                            <div v-else-if="priceOverrides.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No negotiated prices found for this contract.</div>
                            <div v-else class="space-y-2">
                                <div v-for="item in priceOverrides" :key="item.id || item.serviceCode || item.serviceName" class="rounded-lg border bg-background/70 p-3">
                                    <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                        <div class="space-y-1">
                                            <p class="text-sm font-semibold">{{ item.serviceName || item.serviceCode || 'Negotiated service price' }}</p>
                                            <div class="flex flex-wrap items-center gap-2">
                                                <Badge variant="outline">{{ item.serviceCode || 'Service code pending' }}</Badge>
                                                <Badge variant="outline">{{ item.serviceType ? formatEnumLabel(item.serviceType) : 'Service type not set' }}</Badge>
                                                <Badge variant="outline">{{ formatPricingStrategyLabel(item.pricingStrategy) }}</Badge>
                                                <Badge :variant="negotiatedPriceImpactBadgeVariant(item.varianceDirection)">{{ negotiatedPriceImpactLabel(item) }}</Badge>
                                                <Badge :variant="statusVariant(item.status)">{{ formatEnumLabel(item.status || 'unknown') }}</Badge>
                                            </div>
                                            <p class="text-xs text-muted-foreground">{{ formatPriceOverrideValue(item.pricingStrategy, item.overrideValue, item.currencyCode) }} | {{ formatContractWindowLabel(item.effectiveFrom, item.effectiveTo) }}</p>
                                            <p class="text-xs text-muted-foreground">{{ formatPriceOverrideImpact(item) }}</p>
                                            <p v-if="item.overrideNotes" class="text-xs text-muted-foreground">{{ item.overrideNotes }}</p>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Button v-if="canManagePriceOverrides" size="sm" variant="outline" class="gap-1.5" @click="openPriceOverrideEdit(item)"><AppIcon name="pencil" class="size-3.5" />Edit</Button>
                                            <Button v-if="canManagePriceOverrides" size="sm" :variant="(item.status ?? '').toLowerCase() === 'active' ? 'destructive' : 'secondary'" @click="openPriceOverrideStatusDialog(item, (item.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active')">{{ (item.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}</Button>
                                            <Button v-if="canManagePriceOverrides && (item.status ?? '').toLowerCase() !== 'retired'" size="sm" variant="destructive" @click="openPriceOverrideStatusDialog(item, 'retired')">Retire</Button>
                                            <Button v-if="canPriceOverrideAudit" size="sm" variant="outline" class="gap-1.5" @click="loadPriceOverrideAudit(item)"><AppIcon name="activity" class="size-3.5" />Audit</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/10 px-4 py-3"><p class="text-xs text-muted-foreground">Showing {{ priceOverrides.length }} of {{ priceOverridesPagination?.total ?? 0 }} negotiated prices | Page {{ priceOverridesPagination?.currentPage ?? 1 }} of {{ priceOverridesPagination?.lastPage ?? 1 }}</p><div class="flex items-center gap-2"><Button variant="outline" size="sm" :disabled="priceOverridesLoading || (priceOverridesPagination?.currentPage ?? 1) <= 1" @click="prevPriceOverridesPage">Previous</Button><Button variant="outline" size="sm" :disabled="priceOverridesLoading || !priceOverridesPagination || priceOverridesPagination.currentPage >= priceOverridesPagination.lastPage" @click="nextPriceOverridesPage">Next</Button></div></footer>
                        <div class="space-y-3 border-t pt-3">
                            <div>
                                <h3 class="text-sm font-semibold">Add Negotiated Price</h3>
                                <p class="mt-1 text-xs text-muted-foreground">Link negotiated pricing to a live service price so billing stays aligned with the central service list.</p>
                            </div>
                            <Alert v-if="!canManagePriceOverrides" variant="destructive"><AlertTitle>Create access restricted</AlertTitle><AlertDescription>Request <code>billing.payer-contracts.manage-price-overrides</code> permission.</AlertDescription></Alert>
                            <template v-else>
                                <Alert v-if="serviceCatalogLookupError" variant="destructive">
                                    <AlertTitle>Service Prices lookup issue</AlertTitle>
                                    <AlertDescription>{{ serviceCatalogLookupError }}</AlertDescription>
                                </Alert>
                                <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    <template v-if="createPriceOverrideServiceLookupEnabled">
                                        <ComboboxField
                                            input-id="create-price-override-service-code"
                                            v-model="createPriceOverrideServiceLookupValue"
                                            label="Service price"
                                            :options="createPriceOverrideServiceOptions"
                                            placeholder="Choose a service price"
                                            search-placeholder="Search service code or service name"
                                            :helper-text="createPriceOverrideServiceHelperText"
                                            empty-text="No active Service Prices matched this search."
                                            container-class="md:col-span-2"
                                        />
                                        <div class="rounded-lg border bg-muted/10 p-3 md:col-span-2 xl:col-span-1">
                                            <p class="text-sm font-medium">{{ selectedCreatePriceCatalogItem?.serviceName || createPriceOverrideForm.serviceName || 'Service not selected' }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ priceCatalogSelectionSummary(selectedCreatePriceCatalogItem) }}</p>
                                            <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                <span>{{ formatCatalogBasePriceLabel(selectedCreatePriceCatalogItem) }}</span>
                                                <span>{{ formatContractWindowLabel(selectedCreatePriceCatalogItem?.effectiveFrom || null, selectedCreatePriceCatalogItem?.effectiveTo || null) }}</span>
                                            </div>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <FormFieldShell input-id="create-price-override-service-code" label="Service code"><Input id="create-price-override-service-code" v-model="createPriceOverrideForm.serviceCode" /></FormFieldShell>
                                        <FormFieldShell input-id="create-price-override-service-name" label="Service name"><Input id="create-price-override-service-name" v-model="createPriceOverrideForm.serviceName" placeholder="Use the exact service label used in billing." /></FormFieldShell>
                                        <FormFieldShell input-id="create-price-override-service-type" label="Service type">
                                            <Select v-model="createPriceOverrideServiceTypeSelectValue">
                                                <SelectTrigger id="create-price-override-service-type" class="w-full"><SelectValue placeholder="All service types" /></SelectTrigger>
                                                <SelectContent><SelectItem value="__none__">All service types</SelectItem><SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                            </Select>
                                        </FormFieldShell>
                                        <FormFieldShell input-id="create-price-override-department" label="Department">
                                            <Input id="create-price-override-department" v-model="createPriceOverrideForm.department" placeholder="Optional when service lookup is unavailable" />
                                        </FormFieldShell>
                                    </template>
                                    <FormFieldShell input-id="create-price-override-strategy" label="Pricing style">
                                        <Select v-model="createPriceOverridePricingStrategySelectValue">
                                            <SelectTrigger id="create-price-override-strategy" class="w-full"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="fixed_price">Fixed price</SelectItem><SelectItem value="discount_percent">Discount %</SelectItem><SelectItem value="markup_percent">Markup %</SelectItem></SelectContent>
                                        </Select>
                                    </FormFieldShell>
                                    <FormFieldShell input-id="create-price-override-value" label="Negotiated value" :helper-text="createPriceOverrideValueHelperText">
                                        <Input id="create-price-override-value" v-model="createPriceOverrideForm.overrideValue" inputmode="decimal" />
                                    </FormFieldShell>
                                    <SingleDatePopoverField input-id="create-price-override-effective-from" label="Effective from" v-model="createPriceOverrideForm.effectiveFrom" />
                                    <SingleDatePopoverField input-id="create-price-override-effective-to" label="Effective to" v-model="createPriceOverrideForm.effectiveTo" />
                                    <FormFieldShell input-id="create-price-override-notes" label="Notes" container-class="md:col-span-2 xl:col-span-3">
                                        <Textarea id="create-price-override-notes" v-model="createPriceOverrideForm.overrideNotes" class="min-h-20" />
                                    </FormFieldShell>
                                </div>
                                <div class="flex justify-end"><Button :disabled="createPriceOverrideLoading" class="gap-1.5" @click="createPriceOverride"><AppIcon name="plus" class="size-3.5" />{{ createPriceOverrideLoading ? 'Creating...' : 'Save negotiated price' }}</Button></div>
                            </template>
                        </div>
                    </div>
                    <Separator />
                    <Alert v-if="rulesErrors.length" variant="destructive"><AlertTitle>Policy request error</AlertTitle><AlertDescription><p v-for="errorMessage in rulesErrors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p></AlertDescription></Alert>
                    <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
                        <div class="min-w-0 flex-1">
                            <label for="rule-q" class="sr-only">Search policies</label>
                            <div class="relative min-w-0">
                                <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input id="rule-q" v-model="ruleFilters.q" placeholder="Search policy code or policy name" class="h-9 pl-9" @keyup.enter="searchRules" />
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <div class="min-w-[180px]">
                                <label for="rule-status" class="sr-only">Policy status</label>
                                <Select v-model="ruleFilterStatusSelectValue">
                                    <SelectTrigger id="rule-status" class="h-9 w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
                                    <SelectContent><SelectItem value="__none__">All statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div class="min-w-[180px]">
                                <label for="rule-service-type" class="sr-only">Service type</label>
                                <Select v-model="ruleFilterServiceTypeSelectValue">
                                    <SelectTrigger id="rule-service-type" class="h-9 w-full"><SelectValue placeholder="All service types" /></SelectTrigger>
                                    <SelectContent><SelectItem value="__none__">All service types</SelectItem><SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div class="min-w-[190px]">
                                <label for="rule-coverage-decision" class="sr-only">Coverage decision</label>
                                <Select v-model="ruleFilterCoverageDecisionSelectValue">
                                    <SelectTrigger id="rule-coverage-decision" class="h-9 w-full"><SelectValue placeholder="All policy decisions" /></SelectTrigger>
                                    <SelectContent><SelectItem value="__none__">All policy decisions</SelectItem><SelectItem v-for="option in coverageDecisionOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <Button variant="outline" size="sm" class="h-9 gap-1.5" @click="searchRules"><AppIcon name="search" class="size-3.5" />{{ rulesLoading ? 'Searching...' : 'Search' }}</Button>
                            <Button variant="ghost" size="sm" class="h-9 gap-1.5" @click="resetRules">Clear</Button>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div v-if="rulesLoading" class="space-y-2"><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /></div>
                        <div v-else-if="rules.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No policies found for this contract.</div>
                        <div v-else class="space-y-2">
                            <div v-for="item in rules" :key="item.id || item.ruleCode || item.ruleName" class="rounded-lg border bg-background/70 p-3">
                                <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                    <div class="space-y-1">
                                        <p class="text-sm font-semibold">{{ ruleLabel(item) }}</p>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline">{{ item.serviceCode || 'ANY-SERVICE' }}</Badge>
                                            <Badge variant="outline">{{ item.serviceType ? formatEnumLabel(item.serviceType) : 'All service types' }}</Badge>
                                            <Badge v-if="item.department" variant="outline">{{ item.department }}</Badge>
                                            <Badge :variant="policyDecisionVariant(item.coverageDecision)">{{ formatEnumLabel(item.coverageDecision || 'covered_with_rule') }}</Badge>
                                            <Badge :variant="statusVariant(item.status)">{{ formatEnumLabel(item.status || 'unknown') }}</Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">{{ formatRuleCoverageSummary(item) }}</p>
                                        <p class="text-xs text-muted-foreground">Requires authorization {{ boolLabel(item.requiresAuthorization) }} | Auto approve {{ boolLabel(item.autoApprove) }}</p>
                                        <div v-if="formatRuleConditionBadges(item).length" class="flex flex-wrap gap-1">
                                            <Badge v-for="chip in formatRuleConditionBadges(item)" :key="`${item.id || item.ruleCode}-${chip}`" variant="outline" class="text-[10px]">{{ chip }}</Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">Policy engine {{ storedRuleEngineSummary(item) }}</p>
                                        <p v-if="item.ruleNotes" class="text-xs text-muted-foreground">{{ item.ruleNotes }}</p>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2"><Button v-if="canManageRules" size="sm" variant="outline" class="gap-1.5" @click="openRuleEdit(item)"><AppIcon name="pencil" class="size-3.5" />Edit</Button><Button v-if="canManageRules" size="sm" :variant="(item.status ?? '').toLowerCase() === 'active' ? 'destructive' : 'secondary'" @click="openRuleStatusDialog(item, (item.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active')">{{ (item.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}</Button><Button v-if="canManageRules && (item.status ?? '').toLowerCase() !== 'retired'" size="sm" variant="destructive" @click="openRuleStatusDialog(item, 'retired')">Retire</Button><Button v-if="canRuleAudit" size="sm" variant="outline" class="gap-1.5" @click="loadRuleAudit(item)"><AppIcon name="activity" class="size-3.5" />Audit</Button></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/10 px-4 py-3"><p class="text-xs text-muted-foreground">Showing {{ rules.length }} of {{ rulesPagination?.total ?? 0 }} policies | Page {{ rulesPagination?.currentPage ?? 1 }} of {{ rulesPagination?.lastPage ?? 1 }}</p><div class="flex items-center gap-2"><Button variant="outline" size="sm" :disabled="rulesLoading || (rulesPagination?.currentPage ?? 1) <= 1" @click="prevRulesPage">Previous</Button><Button variant="outline" size="sm" :disabled="rulesLoading || !rulesPagination || rulesPagination.currentPage >= rulesPagination.lastPage" @click="nextRulesPage">Next</Button></div></footer>
                    <Separator />
                    <div class="space-y-3">
                        <div>
                            <h3 class="text-sm font-semibold">Add Coverage Policy</h3>
                            <p class="mt-1 text-xs text-muted-foreground">Define service coverage, exclusions, member conditions, and authorization routing for this payer contract.</p>
                        </div>
                        <Alert v-if="!canManageRules" variant="destructive"><AlertTitle>Create access restricted</AlertTitle><AlertDescription>Request <code>billing.payer-contracts.manage-authorization-rules</code> permission.</AlertDescription></Alert>
                        <template v-else>
                            <Alert v-if="serviceCatalogLookupError" variant="destructive"><AlertTitle>Service Prices lookup issue</AlertTitle><AlertDescription>{{ serviceCatalogLookupError }}</AlertDescription></Alert>
                            <div class="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
                                <div class="space-y-4">
                                    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        <FormFieldShell input-id="create-rule-code" label="Policy code"><Input id="create-rule-code" v-model="createRuleForm.ruleCode" /></FormFieldShell>
                                        <FormFieldShell input-id="create-rule-name" label="Policy name" container-class="md:col-span-2"><Input id="create-rule-name" v-model="createRuleForm.ruleName" /></FormFieldShell>
                                    </div>

                                    <div class="space-y-3 rounded-lg border bg-background/60 p-3">
                                        <div>
                                            <p class="text-sm font-medium">Service targeting</p>
                                            <p class="mt-1 text-xs text-muted-foreground">Anchor the rule to a live billing service when possible, then narrow further only if the payer contract needs extra constraints.</p>
                                        </div>
                                        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                            <template v-if="createRuleServiceLookupEnabled">
                                                <ComboboxField
                                                    input-id="create-rule-service-code"
                                                    v-model="createRuleServiceLookupValue"
                                                    label="Service price"
                                                    :options="createRuleServiceOptions"
                                                    placeholder="Choose a service price"
                                                    search-placeholder="Search service code or service name"
                                                    :helper-text="createRuleServiceHelperText"
                                                    empty-text="No active Service Prices matched this search."
                                                    container-class="md:col-span-2"
                                                />
                                                <div class="rounded-lg border bg-muted/10 p-3 md:col-span-2 xl:col-span-1">
                                                    <p class="text-sm font-medium">{{ selectedCreateRuleCatalogItem?.serviceName || createRuleForm.serviceCode || 'Service not selected' }}</p>
                                                    <p class="mt-1 text-xs text-muted-foreground">{{ priceCatalogSelectionSummary(selectedCreateRuleCatalogItem) }}</p>
                                                </div>
                                            </template>
                                            <template v-else>
                                                <FormFieldShell input-id="create-rule-service-code" label="Service code"><Input id="create-rule-service-code" v-model="createRuleForm.serviceCode" /></FormFieldShell>
                                                <FormFieldShell input-id="create-rule-service-type" label="Service type">
                                                    <Select v-model="createRuleServiceTypeSelectValue">
                                                        <SelectTrigger id="create-rule-service-type" class="w-full"><SelectValue placeholder="All service types" /></SelectTrigger>
                                                        <SelectContent><SelectItem value="__none__">All service types</SelectItem><SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                                    </Select>
                                                </FormFieldShell>
                                                <FormFieldShell input-id="create-rule-department" label="Department"><Input id="create-rule-department" v-model="createRuleForm.department" /></FormFieldShell>
                                            </template>
                                            <FormFieldShell v-if="createRuleServiceLookupEnabled" input-id="create-rule-service-type-manual" label="Service family">
                                                <Select v-model="createRuleServiceTypeSelectValue">
                                                    <SelectTrigger id="create-rule-service-type-manual" class="w-full"><SelectValue placeholder="All service types" /></SelectTrigger>
                                                    <SelectContent><SelectItem value="__none__">All service types</SelectItem><SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                            <FormFieldShell v-if="createRuleServiceLookupEnabled" input-id="create-rule-department-manual" label="Department scope"><Input id="create-rule-department-manual" v-model="createRuleForm.department" placeholder="Optional department narrowing" /></FormFieldShell>
                                            <FormFieldShell input-id="create-rule-diagnosis" label="Diagnosis code"><Input id="create-rule-diagnosis" v-model="createRuleForm.diagnosisCode" placeholder="Optional ICD or internal diagnosis code" /></FormFieldShell>
                                            <FormFieldShell input-id="create-rule-priority" label="Priority">
                                                <Select v-model="createRulePrioritySelectValue">
                                                    <SelectTrigger id="create-rule-priority" class="w-full"><SelectValue placeholder="Any priority" /></SelectTrigger>
                                                    <SelectContent><SelectItem value="__none__">Any priority</SelectItem><SelectItem v-for="option in priorityOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                        </div>
                                    </div>

                                    <div class="space-y-3 rounded-lg border bg-background/60 p-3">
                                        <div>
                                            <p class="text-sm font-medium">Benefit posture</p>
                                            <p class="mt-1 text-xs text-muted-foreground">Set whether the service is covered, excluded, or needs manual review, then capture coverage override, co-pay, limit, and policy window.</p>
                                        </div>
                                        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                            <FormFieldShell input-id="create-rule-coverage-decision" label="Coverage decision">
                                                <Select v-model="createRuleCoverageDecisionSelectValue">
                                                    <SelectTrigger id="create-rule-coverage-decision" class="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem v-for="option in coverageDecisionOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                            <FormFieldShell input-id="create-rule-coverage-percent" label="Coverage % override" helper-text="Leave blank to inherit the contract default coverage.">
                                                <Input id="create-rule-coverage-percent" v-model="createRuleForm.coveragePercentOverride" inputmode="decimal" placeholder="85" />
                                            </FormFieldShell>
                                            <FormFieldShell input-id="create-rule-copay-type" label="Co-pay type">
                                                <Select v-model="createRuleCopayTypeSelectValue">
                                                    <SelectTrigger id="create-rule-copay-type" class="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem v-for="option in copayTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                            <FormFieldShell input-id="create-rule-copay-value" label="Co-pay value" :helper-text="createRuleForm.copayType === 'fixed' ? 'Fixed amount in contract currency.' : createRuleForm.copayType === 'percentage' ? 'Percentage charged as member co-pay.' : 'No co-pay is applied when type is none.'">
                                                <Input id="create-rule-copay-value" v-model="createRuleForm.copayValue" inputmode="decimal" :disabled="createRuleForm.copayType === 'none'" />
                                            </FormFieldShell>
                                            <FormFieldShell input-id="create-rule-benefit-limit" label="Benefit limit amount" :helper-text="`Optional limit in ${(selectedContract?.currencyCode || defaultCurrencyCode).toUpperCase()}.`">
                                                <Input id="create-rule-benefit-limit" v-model="createRuleForm.benefitLimitAmount" inputmode="decimal" />
                                            </FormFieldShell>
                                            <SingleDatePopoverField input-id="create-rule-effective-from" label="Policy effective from" v-model="createRuleForm.effectiveFrom" />
                                            <SingleDatePopoverField input-id="create-rule-effective-to" label="Policy effective to" v-model="createRuleForm.effectiveTo" />
                                        </div>
                                    </div>

                                    <div class="space-y-3 rounded-lg border bg-background/60 p-3">
                                        <div>
                                            <p class="text-sm font-medium">Claim routing</p>
                                            <p class="mt-1 text-xs text-muted-foreground">Set whether this rule blocks for authorization, auto-approves, and how long approved authorizations remain valid.</p>
                                        </div>
                                        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                            <FormFieldShell input-id="create-rule-requires-auth" label="Requires authorization">
                                                <Select v-model="createRuleRequiresAuthorizationSelectValue">
                                                    <SelectTrigger id="create-rule-requires-auth" class="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                            <FormFieldShell input-id="create-rule-auto-approve" label="Auto approve">
                                                <Select v-model="createRuleAutoApproveSelectValue">
                                                    <SelectTrigger id="create-rule-auto-approve" class="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem value="false">No</SelectItem><SelectItem value="true">Yes</SelectItem></SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                            <FormFieldShell input-id="create-rule-validity" label="Authorization validity days"><Input id="create-rule-validity" v-model="createRuleForm.authorizationValidityDays" inputmode="numeric" placeholder="14" /></FormFieldShell>
                                        </div>
                                    </div>

                                    <div class="space-y-3 rounded-lg border bg-background/60 p-3">
                                        <div>
                                            <p class="text-sm font-medium">Member and financial conditions</p>
                                            <p class="mt-1 text-xs text-muted-foreground">Use these to constrain the rule by age, gender, value threshold, or quantity before authorization logic applies.</p>
                                        </div>
                                        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                            <FormFieldShell input-id="create-rule-min-age" label="Min age"><Input id="create-rule-min-age" v-model="createRuleForm.minPatientAgeYears" inputmode="numeric" placeholder="0" /></FormFieldShell>
                                            <FormFieldShell input-id="create-rule-max-age" label="Max age"><Input id="create-rule-max-age" v-model="createRuleForm.maxPatientAgeYears" inputmode="numeric" placeholder="120" /></FormFieldShell>
                                            <FormFieldShell input-id="create-rule-gender" label="Gender">
                                                <Select v-model="createRuleGenderSelectValue">
                                                    <SelectTrigger id="create-rule-gender" class="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem v-for="option in genderOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                            <FormFieldShell input-id="create-rule-amount-threshold" label="Amount threshold"><Input id="create-rule-amount-threshold" v-model="createRuleForm.amountThreshold" inputmode="decimal" :placeholder="selectedContract?.currencyCode || defaultCurrencyCode" /></FormFieldShell>
                                            <FormFieldShell input-id="create-rule-quantity-limit" label="Quantity limit"><Input id="create-rule-quantity-limit" v-model="createRuleForm.quantityLimit" inputmode="numeric" placeholder="1" /></FormFieldShell>
                                        </div>
                                    </div>

                                    <FormFieldShell input-id="create-rule-notes" label="Policy notes">
                                        <Textarea id="create-rule-notes" v-model="createRuleForm.ruleNotes" class="min-h-20" />
                                    </FormFieldShell>
                                </div>
                                <div class="rounded-lg border bg-muted/10 p-4">
                                    <p class="text-sm font-medium">Policy posture</p>
                                    <div class="mt-3 space-y-2 text-sm">
                                        <div class="rounded-lg border bg-background/70 px-3 py-2">
                                            <p class="font-medium">{{ selectedCreateRuleCatalogItem?.serviceName || createRuleForm.ruleName || 'Policy target pending' }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ priceCatalogSelectionSummary(selectedCreateRuleCatalogItem) }}</p>
                                        </div>
                                        <div class="rounded-lg border bg-background/70 px-3 py-2">
                                            <p class="font-medium">Conditions</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ createRuleConditionsSummary }}</p>
                                        </div>
                                        <div class="rounded-lg border bg-background/70 px-3 py-2">
                                            <p class="font-medium">Coverage posture</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ formatRuleCoverageSummary(createRuleForm) }}</p>
                                        </div>
                                        <div class="rounded-lg border bg-background/70 px-3 py-2">
                                            <p class="font-medium">Routing posture</p>
                                            <p class="mt-1 text-xs text-muted-foreground">Requires authorization {{ createRuleForm.requiresAuthorization === 'true' ? 'Yes' : 'No' }} | Auto approve {{ createRuleForm.autoApprove === 'true' ? 'Yes' : 'No' }}{{ createRuleForm.authorizationValidityDays.trim() ? ` | Valid ${createRuleForm.authorizationValidityDays.trim()} days` : '' }}</p>
                                        </div>
                                        <div class="rounded-lg border bg-background/70 px-3 py-2">
                                            <p class="font-medium">Policy engine</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ createRuleEngineSummary }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex justify-end"><Button :disabled="createRuleLoading" class="gap-1.5" @click="createRule"><AppIcon name="plus" class="size-3.5" />{{ createRuleLoading ? 'Creating...' : 'Save policy' }}</Button></div>
                        </template>
                    </div>
                </CardContent>
            </Card>
            <Card v-if="contractAuditTarget" class="rounded-lg border-sidebar-border/70">
                <CardHeader><div class="flex flex-wrap items-start justify-between gap-2"><div><CardTitle class="flex items-center gap-2"><AppIcon name="activity" class="size-5 text-muted-foreground" />Contract Audit</CardTitle><CardDescription>{{ contractLabel(contractAuditTarget) }}</CardDescription></div><Button v-if="canAudit" size="sm" variant="outline" class="gap-1.5" :disabled="contractAuditLoading || contractAuditExporting" @click="exportContractAuditLogsCsv"><AppIcon name="download" class="size-3.5" />{{ contractAuditExporting ? 'Preparing...' : 'Export CSV' }}</Button></div></CardHeader>
                <CardContent>
                    <Alert v-if="contractAuditError" variant="destructive"><AlertTitle>Audit load issue</AlertTitle><AlertDescription>{{ contractAuditError }}</AlertDescription></Alert>
                    <div v-else-if="contractAuditLoading" class="space-y-2"><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /></div>
                    <div v-else-if="contractAuditLogs.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No audit logs found for this contract.</div>
                    <div v-else class="space-y-2"><div v-for="log in contractAuditLogs" :key="log.id" class="rounded-lg border p-3"><p class="text-sm font-medium">{{ actionLabel(log) }}</p><p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }} | {{ actorLabel(log) }}</p><div v-if="auditEntries(log.changes).length > 0" class="mt-2 flex flex-wrap gap-1"><Badge v-for="[changeKey, changeValue] in auditEntries(log.changes)" :key="`${log.id}-${changeKey}`" variant="outline" class="text-[10px]">{{ changeKey }}: {{ formatAuditValue(changeValue) }}</Badge></div></div></div>
                </CardContent>
            </Card>

            <Card v-if="priceOverrideAuditTarget" class="rounded-lg border-sidebar-border/70">
                <CardHeader><div class="flex flex-wrap items-start justify-between gap-2"><div><CardTitle class="flex items-center gap-2"><AppIcon name="activity" class="size-5 text-muted-foreground" />Negotiated Price Audit</CardTitle><CardDescription>{{ priceOverrideAuditTarget.serviceName || priceOverrideAuditTarget.serviceCode || 'Negotiated price' }}</CardDescription></div><Button v-if="canPriceOverrideAudit" size="sm" variant="outline" class="gap-1.5" :disabled="priceOverrideAuditLoading || priceOverrideAuditExporting" @click="exportPriceOverrideAuditLogsCsv"><AppIcon name="download" class="size-3.5" />{{ priceOverrideAuditExporting ? 'Preparing...' : 'Export CSV' }}</Button></div></CardHeader>
                <CardContent>
                    <Alert v-if="priceOverrideAuditError" variant="destructive"><AlertTitle>Audit load issue</AlertTitle><AlertDescription>{{ priceOverrideAuditError }}</AlertDescription></Alert>
                    <div v-else-if="priceOverrideAuditLoading" class="space-y-2"><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /></div>
                    <div v-else-if="priceOverrideAuditLogs.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No audit logs found for this negotiated price.</div>
                    <div v-else class="space-y-2"><div v-for="log in priceOverrideAuditLogs" :key="log.id" class="rounded-lg border p-3"><p class="text-sm font-medium">{{ actionLabel(log) }}</p><p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }} | {{ actorLabel(log) }}</p><div v-if="auditEntries(log.changes).length > 0" class="mt-2 flex flex-wrap gap-1"><Badge v-for="[changeKey, changeValue] in auditEntries(log.changes)" :key="`${log.id}-${changeKey}`" variant="outline" class="text-[10px]">{{ changeKey }}: {{ formatAuditValue(changeValue) }}</Badge></div></div></div>
                </CardContent>
            </Card>

            <Card v-if="ruleAuditTarget" class="rounded-lg border-sidebar-border/70">
                <CardHeader><div class="flex flex-wrap items-start justify-between gap-2"><div><CardTitle class="flex items-center gap-2"><AppIcon name="activity" class="size-5 text-muted-foreground" />Policy Audit</CardTitle><CardDescription>{{ ruleLabel(ruleAuditTarget) }}</CardDescription></div><Button v-if="canRuleAudit" size="sm" variant="outline" class="gap-1.5" :disabled="ruleAuditLoading || ruleAuditExporting" @click="exportRuleAuditLogsCsv"><AppIcon name="download" class="size-3.5" />{{ ruleAuditExporting ? 'Preparing...' : 'Export CSV' }}</Button></div></CardHeader>
                <CardContent>
                    <Alert v-if="ruleAuditError" variant="destructive"><AlertTitle>Audit load issue</AlertTitle><AlertDescription>{{ ruleAuditError }}</AlertDescription></Alert>
                    <div v-else-if="ruleAuditLoading" class="space-y-2"><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /></div>
                    <div v-else-if="ruleAuditLogs.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No audit logs found for this policy.</div>
                    <div v-else class="space-y-2"><div v-for="log in ruleAuditLogs" :key="log.id" class="rounded-lg border p-3"><p class="text-sm font-medium">{{ actionLabel(log) }}</p><p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }} | {{ actorLabel(log) }}</p><div v-if="auditEntries(log.changes).length > 0" class="mt-2 flex flex-wrap gap-1"><Badge v-for="[changeKey, changeValue] in auditEntries(log.changes)" :key="`${log.id}-${changeKey}`" variant="outline" class="text-[10px]">{{ changeKey }}: {{ formatAuditValue(changeValue) }}</Badge></div></div></div>
                </CardContent>
            </Card>

            <Dialog :open="editContractOpen" @update:open="(open) => (editContractOpen = open)">
                <DialogContent size="xl">
                    <DialogHeader><DialogTitle>Edit Payer Contract</DialogTitle><DialogDescription>Update payer contract details and terms.</DialogDescription></DialogHeader>
                    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <FormFieldShell input-id="edit-contract-code" label="Contract code"><Input id="edit-contract-code" v-model="editContractForm.contractCode" /></FormFieldShell>
                        <FormFieldShell input-id="edit-contract-name" label="Contract name"><Input id="edit-contract-name" v-model="editContractForm.contractName" /></FormFieldShell>
                        <FormFieldShell input-id="edit-contract-payer-type" label="Payer type">
                            <Select v-model="editPayerTypeSelectValue">
                                <SelectTrigger id="edit-contract-payer-type" class="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem v-for="option in payerTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                            </Select>
                        </FormFieldShell>
                        <FormFieldShell input-id="edit-contract-payer-name" label="Payer name"><Input id="edit-contract-payer-name" v-model="editContractForm.payerName" /></FormFieldShell>
                        <FormFieldShell input-id="edit-payer-plan-code" label="Plan code"><Input id="edit-payer-plan-code" v-model="editContractForm.payerPlanCode" /></FormFieldShell>
                        <FormFieldShell input-id="edit-payer-plan-name" label="Plan name"><Input id="edit-payer-plan-name" v-model="editContractForm.payerPlanName" /></FormFieldShell>
                        <FormFieldShell input-id="edit-contract-currency" label="Currency"><Input id="edit-contract-currency" v-model="editContractForm.currencyCode" maxlength="3" /></FormFieldShell>
                        <FormFieldShell input-id="edit-coverage-percent" label="Default coverage %"><Input id="edit-coverage-percent" v-model="editContractForm.defaultCoveragePercent" inputmode="decimal" /></FormFieldShell>
                        <FormFieldShell input-id="edit-copay-type" label="Co-pay type">
                            <Select v-model="editDefaultCopayTypeSelectValue">
                                <SelectTrigger id="edit-copay-type" class="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem v-for="option in copayTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                            </Select>
                        </FormFieldShell>
                        <FormFieldShell input-id="edit-copay-value" label="Co-pay value" :helper-text="editContractForm.defaultCopayType === 'fixed' ? 'Fixed amount in contract currency.' : editContractForm.defaultCopayType === 'percentage' ? 'Percentage applied as member co-pay.' : 'No co-pay when type is none.'">
                            <Input id="edit-copay-value" v-model="editContractForm.defaultCopayValue" inputmode="decimal" :disabled="editContractForm.defaultCopayType === 'none'" />
                        </FormFieldShell>
                        <FormFieldShell input-id="edit-contract-preauth" label="Requires pre-authorization">
                            <Select v-model="editRequiresPreAuthorizationSelectValue">
                                <SelectTrigger id="edit-contract-preauth" class="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                            </Select>
                        </FormFieldShell>
                        <FormFieldShell input-id="edit-claim-submission-deadline" label="Claim deadline days"><Input id="edit-claim-submission-deadline" v-model="editContractForm.claimSubmissionDeadlineDays" inputmode="numeric" /></FormFieldShell>
                        <FormFieldShell input-id="edit-settlement-cycle" label="Settlement cycle days"><Input id="edit-settlement-cycle" v-model="editContractForm.settlementCycleDays" inputmode="numeric" /></FormFieldShell>
                        <SingleDatePopoverField input-id="edit-effective-from" label="Effective from" v-model="editContractForm.effectiveFrom" />
                        <SingleDatePopoverField input-id="edit-effective-to" label="Effective to" v-model="editContractForm.effectiveTo" />
                        <FormFieldShell input-id="edit-contract-notes" label="Terms and notes" container-class="md:col-span-2 xl:col-span-3">
                            <Textarea id="edit-contract-notes" v-model="editContractForm.termsAndNotes" class="min-h-20" />
                        </FormFieldShell>
                    </div>
                    <DialogFooter class="gap-2"><Button variant="outline" :disabled="editContractLoading" @click="editContractOpen = false">Cancel</Button><Button class="gap-1.5" :disabled="editContractLoading" @click="saveContractEdit"><AppIcon name="save" class="size-3.5" />{{ editContractLoading ? 'Saving...' : 'Save Changes' }}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="contractStatusOpen" @update:open="(open) => (contractStatusOpen = open)">
                <DialogContent variant="action" size="lg">
                    <DialogHeader><DialogTitle>{{ contractStatusTarget === 'active' ? 'Activate Contract' : contractStatusTarget === 'retired' ? 'Retire Contract' : 'Deactivate Contract' }}</DialogTitle><DialogDescription>{{ contractStatusTarget === 'active' ? 'Confirm contract activation.' : 'Reason is required for this status transition.' }}</DialogDescription></DialogHeader>
                    <div class="space-y-3"><Alert v-if="contractStatusError" variant="destructive"><AlertTitle>Status update failed</AlertTitle><AlertDescription>{{ contractStatusError }}</AlertDescription></Alert><FormFieldShell v-if="contractStatusTarget !== 'active'" input-id="contract-status-reason" label="Reason"><Textarea id="contract-status-reason" v-model="contractStatusReason" class="min-h-20" placeholder="Required reason" /></FormFieldShell></div>
                    <DialogFooter class="gap-2"><Button variant="outline" :disabled="contractStatusLoading" @click="contractStatusOpen = false">Cancel</Button><Button :disabled="contractStatusLoading" @click="saveContractStatus">{{ contractStatusLoading ? 'Saving...' : 'Confirm' }}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="editPriceOverrideOpen" @update:open="(open) => (editPriceOverrideOpen = open)">
                <DialogContent size="xl">
                    <DialogHeader><DialogTitle>Edit Negotiated Price</DialogTitle><DialogDescription>Update the insurer-specific price override for this contract.</DialogDescription></DialogHeader>
                    <Alert v-if="serviceCatalogLookupError" variant="destructive">
                        <AlertTitle>Service Prices lookup issue</AlertTitle>
                        <AlertDescription>{{ serviceCatalogLookupError }}</AlertDescription>
                    </Alert>
                    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <template v-if="editPriceOverrideServiceLookupEnabled">
                            <ComboboxField
                                input-id="edit-price-override-service-code"
                                v-model="editPriceOverrideServiceLookupValue"
                                label="Service price"
                                :options="editPriceOverrideServiceOptions"
                                placeholder="Choose a service price"
                                search-placeholder="Search service code or service name"
                                :helper-text="editPriceOverrideServiceHelperText"
                                empty-text="No active Service Prices matched this search."
                                container-class="md:col-span-2"
                            />
                            <div class="rounded-lg border bg-muted/10 p-3 md:col-span-2 xl:col-span-1">
                                <p class="text-sm font-medium">{{ selectedEditPriceCatalogItem?.serviceName || editPriceOverrideForm.serviceName || 'Service not selected' }}</p>
                                <p class="mt-1 text-xs text-muted-foreground">{{ priceCatalogSelectionSummary(selectedEditPriceCatalogItem) }}</p>
                                <div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <span>{{ formatCatalogBasePriceLabel(selectedEditPriceCatalogItem) }}</span>
                                    <span>{{ formatContractWindowLabel(selectedEditPriceCatalogItem?.effectiveFrom || null, selectedEditPriceCatalogItem?.effectiveTo || null) }}</span>
                                </div>
                            </div>
                        </template>
                        <template v-else>
                            <FormFieldShell input-id="edit-price-override-service-code" label="Service code"><Input id="edit-price-override-service-code" v-model="editPriceOverrideForm.serviceCode" /></FormFieldShell>
                            <FormFieldShell input-id="edit-price-override-service-name" label="Service name"><Input id="edit-price-override-service-name" v-model="editPriceOverrideForm.serviceName" /></FormFieldShell>
                            <FormFieldShell input-id="edit-price-override-service-type" label="Service type">
                                <Select v-model="editPriceOverrideServiceTypeSelectValue">
                                    <SelectTrigger id="edit-price-override-service-type" class="w-full"><SelectValue placeholder="All service types" /></SelectTrigger>
                                    <SelectContent><SelectItem value="__none__">All service types</SelectItem><SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                </Select>
                            </FormFieldShell>
                            <FormFieldShell input-id="edit-price-override-department" label="Department"><Input id="edit-price-override-department" v-model="editPriceOverrideForm.department" /></FormFieldShell>
                        </template>
                        <FormFieldShell input-id="edit-price-override-strategy" label="Pricing style">
                            <Select v-model="editPriceOverridePricingStrategySelectValue">
                                <SelectTrigger id="edit-price-override-strategy" class="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="fixed_price">Fixed price</SelectItem><SelectItem value="discount_percent">Discount %</SelectItem><SelectItem value="markup_percent">Markup %</SelectItem></SelectContent>
                            </Select>
                        </FormFieldShell>
                        <FormFieldShell input-id="edit-price-override-value" label="Negotiated value" :helper-text="editPriceOverrideValueHelperText">
                            <Input id="edit-price-override-value" v-model="editPriceOverrideForm.overrideValue" inputmode="decimal" />
                        </FormFieldShell>
                        <SingleDatePopoverField input-id="edit-price-override-effective-from" label="Effective from" v-model="editPriceOverrideForm.effectiveFrom" />
                        <SingleDatePopoverField input-id="edit-price-override-effective-to" label="Effective to" v-model="editPriceOverrideForm.effectiveTo" />
                        <FormFieldShell input-id="edit-price-override-notes" label="Notes" container-class="md:col-span-2 xl:col-span-3">
                            <Textarea id="edit-price-override-notes" v-model="editPriceOverrideForm.overrideNotes" class="min-h-20" />
                        </FormFieldShell>
                    </div>
                    <DialogFooter class="gap-2"><Button variant="outline" :disabled="editPriceOverrideLoading" @click="editPriceOverrideOpen = false">Cancel</Button><Button class="gap-1.5" :disabled="editPriceOverrideLoading" @click="savePriceOverrideEdit"><AppIcon name="save" class="size-3.5" />{{ editPriceOverrideLoading ? 'Saving...' : 'Save Changes' }}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="priceOverrideStatusOpen" @update:open="(open) => (priceOverrideStatusOpen = open)">
                <DialogContent variant="action" size="lg">
                    <DialogHeader><DialogTitle>{{ priceOverrideStatusTarget === 'active' ? 'Activate Negotiated Price' : priceOverrideStatusTarget === 'retired' ? 'Retire Negotiated Price' : 'Deactivate Negotiated Price' }}</DialogTitle><DialogDescription>{{ priceOverrideStatusTarget === 'active' ? 'Confirm negotiated price activation.' : 'Reason is required for this status transition.' }}</DialogDescription></DialogHeader>
                    <div class="space-y-3"><Alert v-if="priceOverrideStatusError" variant="destructive"><AlertTitle>Status update failed</AlertTitle><AlertDescription>{{ priceOverrideStatusError }}</AlertDescription></Alert><FormFieldShell v-if="priceOverrideStatusTarget !== 'active'" input-id="price-override-status-reason" label="Reason"><Textarea id="price-override-status-reason" v-model="priceOverrideStatusReason" class="min-h-20" placeholder="Required reason" /></FormFieldShell></div>
                    <DialogFooter class="gap-2"><Button variant="outline" :disabled="priceOverrideStatusLoading" @click="priceOverrideStatusOpen = false">Cancel</Button><Button :disabled="priceOverrideStatusLoading" @click="savePriceOverrideStatus">{{ priceOverrideStatusLoading ? 'Saving...' : 'Confirm' }}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

                <Dialog :open="editRuleOpen" @update:open="(open) => (editRuleOpen = open)">
                <DialogContent size="xl">
                    <DialogHeader><DialogTitle>Edit Coverage Policy</DialogTitle><DialogDescription>Update policy criteria, benefit posture, and claim-routing behavior.</DialogDescription></DialogHeader>
                    <Alert v-if="serviceCatalogLookupError" variant="destructive"><AlertTitle>Service Prices lookup issue</AlertTitle><AlertDescription>{{ serviceCatalogLookupError }}</AlertDescription></Alert>
                    <div class="rounded-lg border bg-muted/10 px-3 py-2">
                        <p class="text-sm font-medium">Policy engine</p>
                        <p class="mt-1 text-xs text-muted-foreground">{{ editRuleEngineSummary }}</p>
                    </div>
                    <div class="rounded-lg border bg-muted/10 px-3 py-2">
                        <p class="text-sm font-medium">Current conditions</p>
                        <p class="mt-1 text-xs text-muted-foreground">{{ editRuleConditionsSummary }}</p>
                    </div>
                    <div class="space-y-4">
                        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <FormFieldShell input-id="edit-rule-code" label="Policy code"><Input id="edit-rule-code" v-model="editRuleForm.ruleCode" /></FormFieldShell>
                            <FormFieldShell input-id="edit-rule-name" label="Policy name" container-class="md:col-span-2"><Input id="edit-rule-name" v-model="editRuleForm.ruleName" /></FormFieldShell>
                        </div>

                        <div class="space-y-3 rounded-lg border bg-background/60 p-3">
                            <div>
                                <p class="text-sm font-medium">Service targeting</p>
                                <p class="mt-1 text-xs text-muted-foreground">Keep the rule aligned to a live billing service, then narrow it only where payer policy truly requires it.</p>
                            </div>
                            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <template v-if="editRuleServiceLookupEnabled">
                                    <ComboboxField
                                        input-id="edit-rule-service-code"
                                        v-model="editRuleServiceLookupValue"
                                        label="Service price"
                                        :options="editRuleServiceOptions"
                                        placeholder="Choose a service price"
                                        search-placeholder="Search service code or service name"
                                        :helper-text="editRuleServiceHelperText"
                                        empty-text="No active Service Prices matched this search."
                                        container-class="md:col-span-2"
                                    />
                                    <div class="rounded-lg border bg-muted/10 p-3 md:col-span-2 xl:col-span-1">
                                        <p class="text-sm font-medium">{{ selectedEditRuleCatalogItem?.serviceName || editRuleForm.serviceCode || 'Service not selected' }}</p>
                                        <p class="mt-1 text-xs text-muted-foreground">{{ priceCatalogSelectionSummary(selectedEditRuleCatalogItem) }}</p>
                                    </div>
                                </template>
                                <template v-else>
                                    <FormFieldShell input-id="edit-rule-service-code-manual" label="Service code"><Input id="edit-rule-service-code-manual" v-model="editRuleForm.serviceCode" /></FormFieldShell>
                                    <FormFieldShell input-id="edit-rule-service-type" label="Service type">
                                        <Select v-model="editRuleServiceTypeSelectValue">
                                            <SelectTrigger id="edit-rule-service-type" class="w-full"><SelectValue placeholder="All service types" /></SelectTrigger>
                                            <SelectContent><SelectItem value="__none__">All service types</SelectItem><SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                        </Select>
                                    </FormFieldShell>
                                    <FormFieldShell input-id="edit-rule-department" label="Department"><Input id="edit-rule-department" v-model="editRuleForm.department" /></FormFieldShell>
                                </template>
                                <FormFieldShell v-if="editRuleServiceLookupEnabled" input-id="edit-rule-service-type-manual" label="Service family">
                                    <Select v-model="editRuleServiceTypeSelectValue">
                                        <SelectTrigger id="edit-rule-service-type-manual" class="w-full"><SelectValue placeholder="All service types" /></SelectTrigger>
                                        <SelectContent><SelectItem value="__none__">All service types</SelectItem><SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                    </Select>
                                </FormFieldShell>
                                <FormFieldShell v-if="editRuleServiceLookupEnabled" input-id="edit-rule-department-manual" label="Department scope"><Input id="edit-rule-department-manual" v-model="editRuleForm.department" placeholder="Optional department narrowing" /></FormFieldShell>
                                <FormFieldShell input-id="edit-rule-diagnosis" label="Diagnosis code"><Input id="edit-rule-diagnosis" v-model="editRuleForm.diagnosisCode" /></FormFieldShell>
                                <FormFieldShell input-id="edit-rule-priority" label="Priority">
                                    <Select v-model="editRulePrioritySelectValue">
                                        <SelectTrigger id="edit-rule-priority" class="w-full"><SelectValue placeholder="Any priority" /></SelectTrigger>
                                        <SelectContent><SelectItem value="__none__">Any priority</SelectItem><SelectItem v-for="option in priorityOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                    </Select>
                                </FormFieldShell>
                            </div>
                        </div>

                        <div class="space-y-3 rounded-lg border bg-background/60 p-3">
                            <div>
                                <p class="text-sm font-medium">Benefit posture</p>
                                <p class="mt-1 text-xs text-muted-foreground">Adjust coverage decision, co-pay, benefit limits, and the policy window applied to this contract rule.</p>
                            </div>
                            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <FormFieldShell input-id="edit-rule-coverage-decision" label="Coverage decision">
                                    <Select v-model="editRuleCoverageDecisionSelectValue">
                                        <SelectTrigger id="edit-rule-coverage-decision" class="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem v-for="option in coverageDecisionOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                    </Select>
                                </FormFieldShell>
                                <FormFieldShell input-id="edit-rule-coverage-percent" label="Coverage % override" helper-text="Leave blank to inherit the contract default coverage.">
                                    <Input id="edit-rule-coverage-percent" v-model="editRuleForm.coveragePercentOverride" inputmode="decimal" />
                                </FormFieldShell>
                                <FormFieldShell input-id="edit-rule-copay-type" label="Co-pay type">
                                    <Select v-model="editRuleCopayTypeSelectValue">
                                        <SelectTrigger id="edit-rule-copay-type" class="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem v-for="option in copayTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                    </Select>
                                </FormFieldShell>
                                <FormFieldShell input-id="edit-rule-copay-value" label="Co-pay value" :helper-text="editRuleForm.copayType === 'fixed' ? 'Fixed amount in contract currency.' : editRuleForm.copayType === 'percentage' ? 'Percentage charged as member co-pay.' : 'No co-pay is applied when type is none.'">
                                    <Input id="edit-rule-copay-value" v-model="editRuleForm.copayValue" inputmode="decimal" :disabled="editRuleForm.copayType === 'none'" />
                                </FormFieldShell>
                                <FormFieldShell input-id="edit-rule-benefit-limit" label="Benefit limit amount" :helper-text="`Optional limit in ${(selectedContract?.currencyCode || defaultCurrencyCode).toUpperCase()}.`">
                                    <Input id="edit-rule-benefit-limit" v-model="editRuleForm.benefitLimitAmount" inputmode="decimal" />
                                </FormFieldShell>
                                <SingleDatePopoverField input-id="edit-rule-effective-from" label="Policy effective from" v-model="editRuleForm.effectiveFrom" />
                                <SingleDatePopoverField input-id="edit-rule-effective-to" label="Policy effective to" v-model="editRuleForm.effectiveTo" />
                            </div>
                            <div class="rounded-lg border bg-muted/10 px-3 py-2">
                                <p class="text-sm font-medium">Coverage posture</p>
                                <p class="mt-1 text-xs text-muted-foreground">{{ formatRuleCoverageSummary(editRuleForm) }}</p>
                            </div>
                        </div>

                        <div class="space-y-3 rounded-lg border bg-background/60 p-3">
                            <div>
                                <p class="text-sm font-medium">Claim routing</p>
                                <p class="mt-1 text-xs text-muted-foreground">Adjust whether this rule holds for authorization, auto-approves, and how long the resulting approval remains valid.</p>
                            </div>
                            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <FormFieldShell input-id="edit-rule-requires-auth" label="Requires authorization">
                                    <Select v-model="editRuleRequiresAuthorizationSelectValue">
                                        <SelectTrigger id="edit-rule-requires-auth" class="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                                    </Select>
                                </FormFieldShell>
                                <FormFieldShell input-id="edit-rule-auto-approve" label="Auto approve">
                                    <Select v-model="editRuleAutoApproveSelectValue">
                                        <SelectTrigger id="edit-rule-auto-approve" class="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="false">No</SelectItem><SelectItem value="true">Yes</SelectItem></SelectContent>
                                    </Select>
                                </FormFieldShell>
                                <FormFieldShell input-id="edit-rule-validity" label="Authorization validity days"><Input id="edit-rule-validity" v-model="editRuleForm.authorizationValidityDays" inputmode="numeric" /></FormFieldShell>
                            </div>
                        </div>

                        <div class="space-y-3 rounded-lg border bg-background/60 p-3">
                            <div>
                                <p class="text-sm font-medium">Member and financial conditions</p>
                                <p class="mt-1 text-xs text-muted-foreground">Use these to narrow the rule by patient profile, claim value, or expected utilization.</p>
                            </div>
                            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <FormFieldShell input-id="edit-rule-min-age" label="Min age"><Input id="edit-rule-min-age" v-model="editRuleForm.minPatientAgeYears" inputmode="numeric" /></FormFieldShell>
                                <FormFieldShell input-id="edit-rule-max-age" label="Max age"><Input id="edit-rule-max-age" v-model="editRuleForm.maxPatientAgeYears" inputmode="numeric" /></FormFieldShell>
                                <FormFieldShell input-id="edit-rule-gender" label="Gender">
                                    <Select v-model="editRuleGenderSelectValue">
                                        <SelectTrigger id="edit-rule-gender" class="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem v-for="option in genderOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem></SelectContent>
                                    </Select>
                                </FormFieldShell>
                                <FormFieldShell input-id="edit-rule-amount-threshold" label="Amount threshold"><Input id="edit-rule-amount-threshold" v-model="editRuleForm.amountThreshold" inputmode="decimal" /></FormFieldShell>
                                <FormFieldShell input-id="edit-rule-quantity-limit" label="Quantity limit"><Input id="edit-rule-quantity-limit" v-model="editRuleForm.quantityLimit" inputmode="numeric" /></FormFieldShell>
                            </div>
                        </div>

                        <FormFieldShell input-id="edit-rule-notes" label="Policy notes">
                            <Textarea id="edit-rule-notes" v-model="editRuleForm.ruleNotes" class="min-h-20" />
                        </FormFieldShell>
                    </div>
                    <DialogFooter class="gap-2"><Button variant="outline" :disabled="editRuleLoading" @click="editRuleOpen = false">Cancel</Button><Button class="gap-1.5" :disabled="editRuleLoading" @click="saveRuleEdit"><AppIcon name="save" class="size-3.5" />{{ editRuleLoading ? 'Saving...' : 'Save Policy' }}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="ruleStatusOpen" @update:open="(open) => (ruleStatusOpen = open)">
                <DialogContent variant="action" size="lg">
                    <DialogHeader><DialogTitle>{{ ruleStatusTarget === 'active' ? 'Activate Policy' : ruleStatusTarget === 'retired' ? 'Retire Policy' : 'Deactivate Policy' }}</DialogTitle><DialogDescription>{{ ruleStatusTarget === 'active' ? 'Confirm policy activation.' : 'Reason is required for this status transition.' }}</DialogDescription></DialogHeader>
                    <div class="space-y-3"><Alert v-if="ruleStatusError" variant="destructive"><AlertTitle>Status update failed</AlertTitle><AlertDescription>{{ ruleStatusError }}</AlertDescription></Alert><FormFieldShell v-if="ruleStatusTarget !== 'active'" input-id="rule-status-reason" label="Reason"><Textarea id="rule-status-reason" v-model="ruleStatusReason" class="min-h-20" placeholder="Required reason" /></FormFieldShell></div>
                    <DialogFooter class="gap-2"><Button variant="outline" :disabled="ruleStatusLoading" @click="ruleStatusOpen = false">Cancel</Button><Button :disabled="ruleStatusLoading" @click="saveRuleStatus">{{ ruleStatusLoading ? 'Saving...' : 'Confirm' }}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
