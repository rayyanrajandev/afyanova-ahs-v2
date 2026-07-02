
<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import type { AcceptableValue } from 'reka-ui';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { usePendingWorkflowLeaveGuard } from '@/composables/usePendingWorkflowLeaveGuard';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGetBlob, apiRequestJson } from '@/lib/apiClient';
import {
    type CatalogStatus,
    type CatalogItem,
    type CatalogVersionsResponse,
    type CatalogPayerImpactSummary,
    type CatalogPayerImpactResponse,
    type Department,
    type DepartmentListResponse,
    type CatalogAuditLog,
    type CatalogAuditLogListResponse,
    type ValidationErrorResponse,
    type StandardsCodes,
    type ScopeData,
    SERVICE_TYPE_OPTIONS,
    FACILITY_TIER_OPTIONS,
    buildDepartmentOptions as buildDepartmentOptionsFromList,
    findDepartmentOption,
    formatDateTime,
    tariffWindowLabel,
    tariffLifecycleLabel,
    windowRangeValidationMessage,
    toDateTimeInput,
    datePartFromDateTimeInput,
    timePartFromDateTimeInput,
    mergeDateAndTimeInput,
    toApiDateTime,
    parseDecimalOrNull,
    statusVariant,
    metadataObject,
    metadataHasContent,
    metadataToFormText,
    parseMetadata,
} from '@/lib/billingServiceCatalog';
import type { CatalogResponse } from '@/lib/billingServiceCatalog';
import { generateRequestKey } from '@/lib/idempotency';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

const props = defineProps<{ itemId: string }>();

const serviceTypeOptions = SERVICE_TYPE_OPTIONS;
const facilityTierOptions = FACILITY_TIER_OPTIONS;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Billing Service Catalog', href: '/billing-service-catalog' },
    { title: 'Service price', href: '#' },
];

const { permissionNames, permissionState, scope: platformScope, multiTenantIsolationEnabled } = usePlatformAccess();
const { activeCurrencyCode, loadCountryProfile } = usePlatformCountryProfile();

const permissionsResolved = computed(() => permissionNames.value !== null);
const canManageLegacy = computed(() => permissionState('billing.service-catalog.manage') === 'allowed');
const canManageIdentity = computed(() => canManageLegacy.value || permissionState('billing.service-catalog.manage-identity') === 'allowed');

const identityFieldsLocked = computed(() => !!selectedItem.value?.clinicalCatalogItemId);
const canManagePricing = computed(() => canManageLegacy.value || permissionState('billing.service-catalog.manage-pricing') === 'allowed');
const canViewAudit = computed(() => permissionState('billing.service-catalog.view-audit-logs') === 'allowed');
const canReadPayerContracts = computed(() => permissionState('billing.payer-contracts.read') === 'allowed');
const defaultCurrencyCode = computed(() => activeCurrencyCode.value || 'TZS');

const scope = computed<ScopeData | null>(() => (platformScope.value as ScopeData | null) ?? null);
const scopeUnresolved = computed(() => multiTenantIsolationEnabled.value && (scope.value?.resolvedFrom ?? 'none') === 'none');

const pageLoading = ref(true);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);
const detailsDiscardConfirmOpen = ref(false);
const detailsTab = ref('overview');
const selectedItem = ref<CatalogItem | null>(null);
const versionHistoryLoading = ref(false);
const versionHistoryError = ref<string | null>(null);
const versionHistory = ref<CatalogItem[]>([]);
const payerImpactLoading = ref(false);
const payerImpactError = ref<string | null>(null);
const payerImpactSummary = ref<CatalogPayerImpactSummary | null>(null);

const detailsClinicalLinkagePending = ref(true);

const departmentsLoading = ref(false);
const departments = ref<Department[]>([]);

const identityLoading = ref(false);
const identityErrors = ref<Record<string, string[]>>({});
const identityRequestKey = ref(generateRequestKey('billing-service-catalog-identity'));
const pricingLoading = ref(false);
const pricingErrors = ref<Record<string, string[]>>({});
const pricingRequestKey = ref(generateRequestKey('billing-service-catalog-pricing'));
const editForm = reactive({
    serviceCode: '',
    serviceName: '',
    serviceType: '',
    departmentId: '',
    unit: '',
    basePrice: '',
    currencyCode: '',
    taxRatePercent: '',
    isTaxable: '',
    effectiveFrom: '',
    effectiveTo: '',
    description: '',
    facilityTier: '',
    standardsLocal: '',
    standardsNhif: '',
    standardsMsd: '',
    standardsLoinc: '',
    standardsSnomedCt: '',
    standardsCpt: '',
    standardsIcd: '',
    metadataText: '',
});

type StandardsForm = {
    standardsLocal: string;
    standardsNhif: string;
    standardsMsd: string;
    standardsLoinc: string;
    standardsSnomedCt: string;
    standardsCpt: string;
    standardsIcd: string;
};

function standardsCodesFromForm(form: StandardsForm): StandardsCodes | null {
    const codes: StandardsCodes = {
        LOCAL: form.standardsLocal.trim(),
        NHIF: form.standardsNhif.trim(),
        MSD: form.standardsMsd.trim(),
        LOINC: form.standardsLoinc.trim(),
        SNOMED_CT: form.standardsSnomedCt.trim(),
        CPT: form.standardsCpt.trim(),
        ICD: form.standardsIcd.trim(),
    };
    const compact = Object.fromEntries(Object.entries(codes).filter(([, value]) => String(value ?? '').trim() !== '')) as StandardsCodes;

    return Object.keys(compact).length > 0 ? compact : null;
}

function applyStandardsCodesToForm(form: StandardsForm, codes: StandardsCodes | null | undefined): void {
    form.standardsLocal = String(codes?.LOCAL ?? '');
    form.standardsNhif = String(codes?.NHIF ?? '');
    form.standardsMsd = String(codes?.MSD ?? '');
    form.standardsLoinc = String(codes?.LOINC ?? '');
    form.standardsSnomedCt = String(codes?.SNOMED_CT ?? '');
    form.standardsCpt = String(codes?.CPT ?? '');
    form.standardsIcd = String(codes?.ICD ?? '');
}

const revisionLoading = ref(false);
const revisionErrors = ref<Record<string, string[]>>({});
const revisionRequestKey = ref(generateRequestKey('billing-service-catalog-revision'));
const revisionForm = reactive({
    basePrice: '',
    taxRatePercent: '',
    isTaxable: '',
    effectiveFrom: '',
    effectiveTo: '',
    description: '',
    metadataText: '',
});

const statusLoading = ref(false);
const statusErrors = ref<Record<string, string[]>>({});
const statusRequestKey = ref(generateRequestKey('billing-service-catalog-status'));
const statusForm = reactive({ status: 'active' as CatalogStatus, reason: '' });

const auditLoading = ref(false);
const auditExporting = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<CatalogAuditLog[]>([]);
const auditMeta = ref<{ currentPage: number; lastPage: number } | null>(null);
const auditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });

function firstError(errors: Record<string, string[]> | null | undefined, key: string): string | null {
    return errors?.[key]?.[0] ?? null;
}

function formatMoneyLocal(value: string | null, currencyCode: string | null): string {
    const amount = Number.parseFloat(value ?? '');
    if (!Number.isFinite(amount)) {
        return `${value || '0.00'} ${currencyCode || defaultCurrencyCode.value}`;
    }

    return `${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} ${currencyCode || defaultCurrencyCode.value}`;
}

function tariffLifecycleVariant(effectiveFrom: string | null, effectiveTo: string | null): 'outline' | 'secondary' | 'destructive' {
    const label = tariffLifecycleLabel(effectiveFrom, effectiveTo);
    if (label === 'Scheduled') return 'outline';
    if (label === 'Expired window') return 'destructive';

    return 'secondary';
}

function versionFamilyRole(version: CatalogItem, selectedVersionId: string | null): string {
    if (String(version.id ?? '') === selectedVersionId) {
        return 'Current view';
    }

    const lifecycle = tariffLifecycleLabel(version.effectiveFrom, version.effectiveTo);
    if (lifecycle === 'Scheduled') return 'Scheduled revision';
    if (version.supersedesBillingServiceCatalogItemId) return 'Revision';
    if (lifecycle === 'Expired window') return 'Historical price';

    return 'Base version';
}

function versionFamilyRoleVariant(version: CatalogItem, selectedVersionId: string | null): 'secondary' | 'outline' | 'destructive' {
    const role = versionFamilyRole(version, selectedVersionId);
    if (role === 'Current view') return 'secondary';
    if (role === 'Historical price') return 'destructive';

    return 'outline';
}

function findSupersededVersionLabel(version: CatalogItem, history: CatalogItem[]): string | null {
    const supersededId = String(version.supersedesBillingServiceCatalogItemId ?? '').trim();
    if (!supersededId) return null;

    const matched = history.find((candidate) => String(candidate.id ?? '') === supersededId);
    if (!matched) return null;

    return `Supersedes v${matched.versionNumber || 1}`;
}

function compareVersionToPrevious(version: CatalogItem, history: CatalogItem[]): string | null {
    const currentVersion = version.versionNumber ?? 1;
    const previous = history.find((candidate) => (candidate.versionNumber ?? 0) === currentVersion - 1);
    if (!previous) return null;

    const currentPrice = Number.parseFloat(version.basePrice ?? '');
    const previousPrice = Number.parseFloat(previous.basePrice ?? '');
    if (!Number.isFinite(currentPrice) || !Number.isFinite(previousPrice)) {
        return `Based on v${previous.versionNumber || 1}`;
    }

    const delta = currentPrice - previousPrice;
    if (delta === 0) {
        return `No price change vs v${previous.versionNumber || 1}`;
    }

    const deltaLabel = Math.abs(delta).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return `${delta > 0 ? '+' : '-'}${deltaLabel} vs v${previous.versionNumber || 1}`;
}

function versionSummaryBadgeText(version: CatalogItem | null): string {
    if (!version) return 'Unavailable';

    return `v${version.versionNumber || 1}`;
}

function formatCoverageRange(min: number | null, max: number | null): string {
    if (min === null || max === null) {
        return 'No contract coverage defaults';
    }

    if (min === max) {
        return `${min.toFixed(0)}% default coverage`;
    }

    return `${min.toFixed(0)}%-${max.toFixed(0)}% default coverage`;
}

function rotateIdentityRequestKey(): void {
    identityRequestKey.value = generateRequestKey('billing-service-catalog-identity');
}

function rotatePricingRequestKey(): void {
    pricingRequestKey.value = generateRequestKey('billing-service-catalog-pricing');
}

function rotateRevisionRequestKey(): void {
    revisionRequestKey.value = generateRequestKey('billing-service-catalog-revision');
}

function rotateStatusRequestKey(): void {
    statusRequestKey.value = generateRequestKey('billing-service-catalog-status');
}

function boolLabel(value: boolean | null): string {
    if (value === null) return 'N/A';
    return value ? 'Yes' : 'No';
}

function parseBoolean(value: string): boolean | null {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
}

function metadataValuesEqual(stored: unknown, formText: string): boolean {
    const parsed = parseMetadata(formText);
    if (parsed === 'invalid') return false;

    return JSON.stringify(metadataObject(stored)) === JSON.stringify(parsed);
}

const editServiceTypeSelectValue = computed({
    get: () => editForm.serviceType || '__none__',
    set: (value: string) => {
        editForm.serviceType = value === '__none__' ? '' : value;
    },
});

const editUnitSelectValue = computed({
    get: () => editForm.unit || '__none__',
    set: (value: string) => {
        editForm.unit = value === '__none__' ? '' : value;
    },
});

const editTaxableSelectValue = computed({
    get: () => editForm.isTaxable || '__none__',
    set: (value: string) => {
        editForm.isTaxable = value === '__none__' ? '' : value;
    },
});

const revisionTaxableSelectValue = computed({
    get: () => revisionForm.isTaxable || '__none__',
    set: (value: string) => {
        revisionForm.isTaxable = value === '__none__' ? '' : value;
    },
});

const statusSelectValue = computed({
    get: () => statusForm.status,
    set: (value: string) => {
        statusForm.status = (value === 'inactive' || value === 'retired' ? value : 'active') as CatalogStatus;
    },
});

const auditActorTypeSelectValue = computed({
    get: () => auditFilters.actorType || '__all__',
    set: (value: string) => {
        auditFilters.actorType = value === '__all__' ? '' : value;
    },
});

const auditPerPageSelectValue = computed({
    get: () => String(auditFilters.perPage),
    set: (value: string) => {
        const parsed = Number.parseInt(value, 10);
        auditFilters.perPage = Number.isFinite(parsed) ? parsed : 20;
    },
});

const editTariffWindowValidationMessage = computed(() => windowRangeValidationMessage(editForm.effectiveFrom, editForm.effectiveTo));
const revisionWindowValidationMessage = computed(() => windowRangeValidationMessage(revisionForm.effectiveFrom, revisionForm.effectiveTo));

const revisionGovernanceMessage = computed(() => {
    if (revisionWindowValidationMessage.value) {
        return revisionWindowValidationMessage.value;
    }

    const startAt = toApiDateTime(revisionForm.effectiveFrom);
    if (!startAt) {
        return 'Choose when the new price version starts. The current version will close automatically one second before that time.';
    }

    return `The current price version will close automatically one second before ${formatDateTime(startAt)}. Use this only for a real pricing, tax, or lifecycle change.`;
});

function clinicalCatalogLinkLabel(item: CatalogItem | null): string {
    return item?.clinicalCatalogItemId ? 'Linked clinical definition' : 'Standalone billing price';
}

function clinicalCatalogLinkDetail(item: CatalogItem | null): string {
    const linkedItem = item?.clinicalCatalogItem;

    if (!item?.clinicalCatalogItemId || !linkedItem) {
        return 'No clinical catalog definition is linked yet. This price stays billing-only until a matching care catalog code is connected.';
    }

    const parts = [
        linkedItem.catalogType ? formatEnumLabel(linkedItem.catalogType) : null,
        linkedItem.code || null,
        linkedItem.status ? formatEnumLabel(linkedItem.status) : null,
    ].filter((value): value is string => Boolean(value && value.trim()));

    const summary = parts.length ? parts.join(' | ') : 'Linked clinical definition';

    return linkedItem.name ? `${linkedItem.name} | ${summary}` : summary;
}

const detailsWorkspaceSummaryCards = computed(() => {
    if (!selectedItem.value) return [];

    return [
        {
            key: 'clinical-link',
            label: 'Clinical linkage',
            value: clinicalCatalogLinkLabel(selectedItem.value),
            helper: clinicalCatalogLinkDetail(selectedItem.value),
        },
        {
            key: 'tariff',
            label: 'Current price',
            value: formatMoneyLocal(selectedItem.value.basePrice, selectedItem.value.currencyCode),
            helper: `Version ${selectedItem.value.versionNumber || 1}`,
        },
        {
            key: 'lifecycle',
            label: 'Price window',
            value: tariffLifecycleLabel(selectedItem.value.effectiveFrom, selectedItem.value.effectiveTo),
            helper: tariffWindowLabel(selectedItem.value.effectiveFrom, selectedItem.value.effectiveTo),
        },
        {
            key: 'impact',
            label: 'Payer impact',
            value: payerImpactSummary.value
                ? `${payerImpactSummary.value.activeContractCount} active contracts`
                : 'Contract context pending',
            helper: payerImpactSummary.value
                ? `${payerImpactSummary.value.matchingRuleCount} matching rules in ${payerImpactSummary.value.currencyCode || selectedItem.value.currencyCode || defaultCurrencyCode.value}`
                : 'Open History for contract reach and authorization pressure.',
        },
    ];
});

const revisionDraftReady = computed(() => revisionForm.basePrice.trim() !== '' && revisionForm.effectiveFrom.trim() !== '');

const revisionDraftSummary = computed(() => {
    const basePrice = revisionForm.basePrice.trim();
    const effectiveFrom = toApiDateTime(revisionForm.effectiveFrom);
    const effectiveTo = toApiDateTime(revisionForm.effectiveTo);

    if (!basePrice && !effectiveFrom && !effectiveTo) {
        return 'No new price version drafted';
    }

    return `${formatMoneyLocal(basePrice || null, selectedItem.value?.currencyCode || editForm.currencyCode || defaultCurrencyCode.value)} | ${tariffWindowLabel(effectiveFrom, effectiveTo)}`;
});

const statusSummaryCards = computed(() => {
    if (!selectedItem.value) return [];

    return [
        {
            key: 'current',
            label: 'Current status',
            value: formatEnumLabel(selectedItem.value.status),
            helper: selectedItem.value.statusReason || 'No status reason recorded',
        },
        {
            key: 'window',
            label: 'Active window',
            value: tariffLifecycleLabel(selectedItem.value.effectiveFrom, selectedItem.value.effectiveTo),
            helper: tariffWindowLabel(selectedItem.value.effectiveFrom, selectedItem.value.effectiveTo),
        },
        {
            key: 'next',
            label: 'Change target',
            value: formatEnumLabel(statusForm.status || selectedItem.value.status || 'active'),
            helper: statusForm.reason.trim() || 'Add a reason when pausing or retiring a price.',
        },
    ];
});

const versionHistoryImpactSummary = computed(() => {
    const versions = [...versionHistory.value];
    const live = versions.find((version) => {
        return (version.status ?? '').toLowerCase() === 'active'
            && tariffLifecycleLabel(version.effectiveFrom, version.effectiveTo) === 'Effective window active';
    }) ?? null;

    const scheduled = versions
        .filter((version) => tariffLifecycleLabel(version.effectiveFrom, version.effectiveTo) === 'Scheduled')
        .sort((left, right) => {
            const leftTime = left.effectiveFrom ? new Date(left.effectiveFrom).getTime() : Number.POSITIVE_INFINITY;
            const rightTime = right.effectiveFrom ? new Date(right.effectiveFrom).getTime() : Number.POSITIVE_INFINITY;

            return leftTime - rightTime;
        })[0] ?? null;

    const historical = versions
        .filter((version) => tariffLifecycleLabel(version.effectiveFrom, version.effectiveTo) === 'Expired window')
        .sort((left, right) => {
            const leftTime = left.effectiveTo ? new Date(left.effectiveTo).getTime() : 0;
            const rightTime = right.effectiveTo ? new Date(right.effectiveTo).getTime() : 0;

            return rightTime - leftTime;
        })[0] ?? null;

    return [
        {
            key: 'live',
            label: 'Current price',
            emptyLabel: 'No active price window',
            description: 'Price currently used by billing.',
            item: live,
        },
        {
            key: 'scheduled',
            label: 'Next scheduled price',
            emptyLabel: 'No scheduled revision',
            description: 'Next price that will take over this service code.',
            item: scheduled,
        },
        {
            key: 'historical',
            label: 'Latest previous price',
            emptyLabel: 'No historical version',
            description: 'Most recent replaced price in this service family.',
            item: historical,
        },
    ];
});

const editEffectiveFromDate = computed({
    get: () => datePartFromDateTimeInput(editForm.effectiveFrom),
    set: (value: string) => {
        editForm.effectiveFrom = mergeDateAndTimeInput(value, timePartFromDateTimeInput(editForm.effectiveFrom), '00:00');
    },
});

const editEffectiveFromTime = computed({
    get: () => timePartFromDateTimeInput(editForm.effectiveFrom),
    set: (value: string) => {
        editForm.effectiveFrom = mergeDateAndTimeInput(datePartFromDateTimeInput(editForm.effectiveFrom), value, '00:00');
    },
});

const editEffectiveToDate = computed({
    get: () => datePartFromDateTimeInput(editForm.effectiveTo),
    set: (value: string) => {
        editForm.effectiveTo = mergeDateAndTimeInput(value, timePartFromDateTimeInput(editForm.effectiveTo), '23:59');
    },
});

const editEffectiveToTime = computed({
    get: () => timePartFromDateTimeInput(editForm.effectiveTo),
    set: (value: string) => {
        editForm.effectiveTo = mergeDateAndTimeInput(datePartFromDateTimeInput(editForm.effectiveTo), value, '23:59');
    },
});

const revisionEffectiveFromDate = computed({
    get: () => datePartFromDateTimeInput(revisionForm.effectiveFrom),
    set: (value: string) => {
        revisionForm.effectiveFrom = mergeDateAndTimeInput(value, timePartFromDateTimeInput(revisionForm.effectiveFrom), '00:00');
    },
});

const revisionEffectiveFromTime = computed({
    get: () => timePartFromDateTimeInput(revisionForm.effectiveFrom),
    set: (value: string) => {
        revisionForm.effectiveFrom = mergeDateAndTimeInput(datePartFromDateTimeInput(revisionForm.effectiveFrom), value, '00:00');
    },
});

const revisionEffectiveToDate = computed({
    get: () => datePartFromDateTimeInput(revisionForm.effectiveTo),
    set: (value: string) => {
        revisionForm.effectiveTo = mergeDateAndTimeInput(value, timePartFromDateTimeInput(revisionForm.effectiveTo), '23:59');
    },
});

const revisionEffectiveToTime = computed({
    get: () => timePartFromDateTimeInput(revisionForm.effectiveTo),
    set: (value: string) => {
        revisionForm.effectiveTo = mergeDateAndTimeInput(datePartFromDateTimeInput(revisionForm.effectiveTo), value, '23:59');
    },
});

const auditFromDate = computed({
    get: () => datePartFromDateTimeInput(auditFilters.from),
    set: (value: string) => {
        auditFilters.from = mergeDateAndTimeInput(value, timePartFromDateTimeInput(auditFilters.from), '00:00');
    },
});

const auditFromTime = computed({
    get: () => timePartFromDateTimeInput(auditFilters.from),
    set: (value: string) => {
        auditFilters.from = mergeDateAndTimeInput(datePartFromDateTimeInput(auditFilters.from), value, '00:00');
    },
});

const auditToDate = computed({
    get: () => datePartFromDateTimeInput(auditFilters.to),
    set: (value: string) => {
        auditFilters.to = mergeDateAndTimeInput(value, timePartFromDateTimeInput(auditFilters.to), '23:59');
    },
});

const auditToTime = computed({
    get: () => timePartFromDateTimeInput(auditFilters.to),
    set: (value: string) => {
        auditFilters.to = mergeDateAndTimeInput(datePartFromDateTimeInput(auditFilters.to), value, '23:59');
    },
});

const hasPendingIdentityWorkflow = computed(() => {
    const item = selectedItem.value;
    if (!item) return false;

    return (
        editForm.serviceCode.trim() !== String(item.serviceCode ?? '').trim()
        || editForm.serviceName.trim() !== String(item.serviceName ?? '').trim()
        || editForm.serviceType.trim() !== String(item.serviceType ?? '').trim()
        || editForm.departmentId.trim() !== String(item.departmentId ?? '').trim()
        || editForm.unit.trim() !== String(item.unit ?? '').trim()
        || editForm.facilityTier.trim() !== String(item.facilityTier ?? '').trim()
        || editForm.standardsLocal.trim() !== String(item.codes?.LOCAL ?? '').trim()
        || editForm.standardsNhif.trim() !== String(item.codes?.NHIF ?? '').trim()
        || editForm.standardsMsd.trim() !== String(item.codes?.MSD ?? '').trim()
        || editForm.standardsLoinc.trim() !== String(item.codes?.LOINC ?? '').trim()
        || editForm.standardsSnomedCt.trim() !== String(item.codes?.SNOMED_CT ?? '').trim()
        || editForm.standardsCpt.trim() !== String(item.codes?.CPT ?? '').trim()
        || editForm.standardsIcd.trim() !== String(item.codes?.ICD ?? '').trim()
    );
});

const hasPendingPricingWorkflow = computed(() => {
    const item = selectedItem.value;
    if (!item) return false;

    return (
        editForm.basePrice.trim() !== String(item.basePrice ?? '').trim()
        || editForm.currencyCode.trim().toUpperCase() !== String(item.currencyCode ?? defaultCurrencyCode.value).trim().toUpperCase()
        || editForm.taxRatePercent.trim() !== String(item.taxRatePercent ?? '').trim()
        || editForm.isTaxable !== (item.isTaxable === null ? '' : (item.isTaxable ? 'true' : 'false'))
        || editForm.effectiveFrom.trim() !== toDateTimeInput(item.effectiveFrom)
        || editForm.effectiveTo.trim() !== toDateTimeInput(item.effectiveTo)
        || editForm.description.trim() !== String(item.description ?? '').trim()
        || !metadataValuesEqual(item.metadata, editForm.metadataText)
    );
});

const showEditTechnicalMetadata = computed(() => (
    metadataHasContent(selectedItem.value?.metadata) || editForm.metadataText.trim() !== ''
));

const showRevisionTechnicalMetadata = computed(() => (
    metadataHasContent(selectedItem.value?.metadata) || revisionForm.metadataText.trim() !== ''
));

const hasPendingRevisionWorkflow = computed(() => {
    const item = selectedItem.value;
    if (!item) return false;

    return (
        revisionForm.basePrice.trim() !== String(item.basePrice ?? '').trim()
        || revisionForm.taxRatePercent.trim() !== String(item.taxRatePercent ?? '').trim()
        || revisionForm.isTaxable !== (item.isTaxable === null ? '' : (item.isTaxable ? 'true' : 'false'))
        || revisionForm.effectiveFrom.trim()
        || revisionForm.effectiveTo.trim()
        || revisionForm.description.trim() !== String(item.description ?? '').trim()
        || !metadataValuesEqual(item.metadata, revisionForm.metadataText)
    );
});

const hasPendingStatusWorkflow = computed(() => {
    const item = selectedItem.value;
    if (!item) return false;

    return (
        statusForm.status !== (item.status ?? 'active')
        || statusForm.reason.trim() !== String(item.statusReason ?? '').trim()
    );
});

const hasPendingCatalogDetailsWorkflow = computed(() => (
    hasPendingIdentityWorkflow.value
    || hasPendingPricingWorkflow.value
    || hasPendingRevisionWorkflow.value
    || hasPendingStatusWorkflow.value
));

const isSubmittingCatalogWorkflow = computed(() => (
    identityLoading.value
    || pricingLoading.value
    || revisionLoading.value
    || statusLoading.value
));

const {
    confirmOpen: leaveConfirmOpen,
    confirmLeave: confirmPendingCatalogWorkflowLeave,
    cancelLeave: cancelPendingCatalogWorkflowLeave,
} = usePendingWorkflowLeaveGuard({
    shouldBlock: computed(() => hasPendingCatalogDetailsWorkflow.value),
    isSubmitting: isSubmittingCatalogWorkflow,
    blockBrowserUnload: false,
});

function hydrateEditForm(item: CatalogItem): void {
    editForm.serviceCode = item.serviceCode ?? '';
    editForm.serviceName = item.serviceName ?? '';
    editForm.serviceType = item.serviceType ?? '';
    editForm.departmentId = item.departmentId ?? '';
    editForm.unit = item.unit ?? '';
    editForm.basePrice = item.basePrice ?? '';
    editForm.currencyCode = item.currencyCode ?? defaultCurrencyCode.value;
    editForm.taxRatePercent = item.taxRatePercent ?? '';
    editForm.isTaxable = item.isTaxable === null ? '' : (item.isTaxable ? 'true' : 'false');
    editForm.effectiveFrom = toDateTimeInput(item.effectiveFrom);
    editForm.effectiveTo = toDateTimeInput(item.effectiveTo);
    editForm.description = item.description ?? '';
    editForm.facilityTier = item.facilityTier ?? '';
    applyStandardsCodesToForm(editForm, item.codes);
    editForm.metadataText = metadataToFormText(item.metadata);

    statusForm.status = (item.status ?? 'active') as CatalogStatus;
    statusForm.reason = item.statusReason ?? '';
}

function hydrateRevisionForm(item: CatalogItem): void {
    revisionForm.basePrice = item.basePrice ?? '';
    revisionForm.taxRatePercent = item.taxRatePercent ?? '';
    revisionForm.isTaxable = item.isTaxable === null ? '' : (item.isTaxable ? 'true' : 'false');
    revisionForm.effectiveFrom = '';
    revisionForm.effectiveTo = '';
    revisionForm.description = item.description ?? '';
    revisionForm.metadataText = metadataToFormText(item.metadata);
}

function seedDetailsWorkspace(item: CatalogItem): void {
    selectedItem.value = { ...item };
    hydrateEditForm(item);
    hydrateRevisionForm(item);
}

function resetDetailsSecondaryData(): void {
    versionHistory.value = [];
    versionHistoryError.value = null;
    payerImpactSummary.value = null;
    payerImpactError.value = null;
    auditError.value = null;
    auditLogs.value = [];
    auditMeta.value = null;
    Object.assign(auditFilters, { q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: {
        query?: Record<string, string | number | null>;
        body?: Record<string, unknown>;
        entitlementContext?: string;
        idempotencyKey?: string | null;
        requestId?: string | null;
    },
): Promise<T> {
    return apiRequestJson<T>(method, path, {
        query: options?.query,
        body: options?.body,
        entitlementContext: options?.entitlementContext,
        idempotencyKey: options?.idempotencyKey,
        requestId: options?.requestId,
    });
}

async function loadDepartments(): Promise<void> {
    departmentsLoading.value = true;

    try {
        const response = await apiRequest<DepartmentListResponse>('GET', '/departments', {
            query: {
                page: 1,
                perPage: 100,
                sortBy: 'name',
                sortDir: 'asc',
            },
        });

        departments.value = response.data ?? [];
    } catch {
        departments.value = [];
    } finally {
        departmentsLoading.value = false;
    }
}

const allDepartmentOptions = computed<SearchableSelectOption[]>(() => buildDepartmentOptions());
const editDepartmentOptions = computed<SearchableSelectOption[]>(() => buildDepartmentOptions(editForm.serviceType));

function buildDepartmentOptions(preferredServiceType = ''): SearchableSelectOption[] {
    return buildDepartmentOptionsFromList(departments.value, preferredServiceType);
}

const editSelectedDepartmentOption = computed(
    () => findDepartmentOption(editDepartmentOptions.value, editForm.departmentId)
        ?? findDepartmentOption(allDepartmentOptions.value, editForm.departmentId),
);
const editDepartmentSummary = computed(() => editSelectedDepartmentOption.value?.label ?? selectedItem.value?.department ?? '');
const editDepartmentHelperText = computed(() => {
    if (departmentsLoading.value) return 'Loading live department list...';
    if (!departments.value.length) return 'Department directory is currently unavailable for this record.';

    const legacyDepartment = String(selectedItem.value?.department ?? '').trim();
    if (!editForm.departmentId.trim() && legacyDepartment) {
        return `Legacy department label: ${legacyDepartment}. Choose a department from the live list to normalize this record.`;
    }

    if (editForm.serviceType.trim()) {
        return `Showing departments matched to ${formatEnumLabel(editForm.serviceType)} first.`;
    }

    return 'Search the hospital department list by code or name.';
});
const editDepartmentEmptyText = computed(() => {
    if (departmentsLoading.value) return 'Loading departments...';
    if (!departments.value.length) return 'No departments are available from the hospital directory.';
    return 'No departments matched this search.';
});

async function loadDetails(id: string): Promise<void> {
    detailsLoading.value = true;
    detailsError.value = null;
    detailsClinicalLinkagePending.value = true;

    try {
        const response = await apiRequest<CatalogResponse>('GET', `/billing-service-catalog/items/${id}`);
        selectedItem.value = response.data;
        hydrateEditForm(response.data);
        hydrateRevisionForm(response.data);
    } catch (error) {
        detailsError.value = messageFromUnknown(error, 'Unable to load service catalog item details.');
    } finally {
        detailsLoading.value = false;
        detailsClinicalLinkagePending.value = false;
    }

    void loadVersionHistory(id);
    void loadPayerImpact(id);

    if (canViewAudit.value) {
        void loadAuditLogs(1);
    }
}

async function saveIdentity(): Promise<void> {
    const itemId = String(selectedItem.value?.id ?? '').trim();
    if (!itemId || !canManageIdentity.value || identityLoading.value || identityFieldsLocked.value) return;

    identityLoading.value = true;
    identityErrors.value = {};

    const localErrors: Record<string, string[]> = {};
    if (!editForm.serviceCode.trim()) localErrors.serviceCode = ['Service code is required.'];
    if (!editForm.serviceName.trim()) localErrors.serviceName = ['Service name is required.'];

    if (Object.keys(localErrors).length > 0) {
        identityErrors.value = localErrors;
        identityLoading.value = false;
        return;
    }

    try {
        const body: Record<string, unknown> = {
            serviceCode: editForm.serviceCode.trim(),
            serviceName: editForm.serviceName.trim(),
            serviceType: editForm.serviceType.trim() || null,
            unit: editForm.unit.trim() || null,
            facilityTier: editForm.facilityTier.trim() || null,
            codes: standardsCodesFromForm(editForm),
        };

        if (editForm.departmentId.trim()) {
            body.departmentId = editForm.departmentId.trim();
        } else if ((selectedItem.value?.departmentId ?? '').trim() !== '') {
            body.departmentId = null;
        }

        const requestKey = identityRequestKey.value;
        const response = await apiRequest<CatalogResponse>('PATCH', `/billing-service-catalog/items/${itemId}`, {
            body,
            entitlementContext: 'Billing service catalog identity update',
            idempotencyKey: requestKey,
            requestId: requestKey,
        });

        selectedItem.value = response.data;
        hydrateEditForm(response.data);
        rotateIdentityRequestKey();
        await loadPayerImpact(String(response.data.id ?? itemId));
        notifySuccess('Service details updated.');
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            identityErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(error, 'Unable to update service details.'));
        }
    } finally {
        identityLoading.value = false;
    }
}

async function savePricing(): Promise<void> {
    const itemId = String(selectedItem.value?.id ?? '').trim();
    if (!itemId || !canManagePricing.value || pricingLoading.value) return;

    pricingLoading.value = true;
    pricingErrors.value = {};

    const basePrice = parseDecimalOrNull(editForm.basePrice);
    const taxRatePercent = parseDecimalOrNull(editForm.taxRatePercent);
    const metadata = parseMetadata(editForm.metadataText);

    const localErrors: Record<string, string[]> = {};
    if (basePrice === null || basePrice === 'invalid') localErrors.basePrice = ['Base price must be a valid non-negative number.'];
    if (!editForm.currencyCode.trim()) localErrors.currencyCode = ['Currency code is required.'];
    if (taxRatePercent === 'invalid') localErrors.taxRatePercent = ['Tax rate must be a valid non-negative number.'];
    if (metadata === 'invalid') localErrors.metadata = ['System integration notes must be a valid JSON object.'];
    if (editTariffWindowValidationMessage.value) localErrors.effectiveTo = [editTariffWindowValidationMessage.value];

    if (Object.keys(localErrors).length > 0) {
        pricingErrors.value = localErrors;
        pricingLoading.value = false;
        return;
    }

    try {
        const requestKey = pricingRequestKey.value;
        const response = await apiRequest<CatalogResponse>('PATCH', `/billing-service-catalog/items/${itemId}`, {
            body: {
                basePrice,
                currencyCode: editForm.currencyCode.trim().toUpperCase(),
                taxRatePercent,
                isTaxable: parseBoolean(editForm.isTaxable),
                effectiveFrom: toApiDateTime(editForm.effectiveFrom),
                effectiveTo: toApiDateTime(editForm.effectiveTo),
                description: editForm.description.trim() || null,
                metadata,
            },
            entitlementContext: 'Billing service catalog pricing update',
            idempotencyKey: requestKey,
            requestId: requestKey,
        });

        selectedItem.value = response.data;
        hydrateEditForm(response.data);
        rotatePricingRequestKey();
        await loadPayerImpact(String(response.data.id ?? itemId));
        notifySuccess('Service pricing updated.');
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            pricingErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(error, 'Unable to update service pricing.'));
        }
    } finally {
        pricingLoading.value = false;
    }
}

async function saveStatus(): Promise<void> {
    const itemId = String(selectedItem.value?.id ?? '').trim();
    if (!itemId || !canManagePricing.value || statusLoading.value) return;

    statusLoading.value = true;
    statusErrors.value = {};

    const reason = statusForm.reason.trim();
    if ((statusForm.status === 'inactive' || statusForm.status === 'retired') && !reason) {
        statusErrors.value = { reason: ['Reason is required when status is inactive or retired.'] };
        statusLoading.value = false;
        return;
    }

    try {
        const requestKey = statusRequestKey.value;
        const response = await apiRequest<CatalogResponse>('PATCH', `/billing-service-catalog/items/${itemId}/status`, {
            body: {
                status: statusForm.status,
                reason: reason || null,
            },
            entitlementContext: 'Billing service catalog status update',
            idempotencyKey: requestKey,
            requestId: requestKey,
        });

        selectedItem.value = response.data;
        hydrateEditForm(response.data);
        rotateStatusRequestKey();
        await loadPayerImpact(String(response.data.id ?? itemId));
        notifySuccess('Service catalog item status updated.');
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            statusErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(error, 'Unable to update service catalog item status.'));
        }
    } finally {
        statusLoading.value = false;
    }
}

async function createRevision(): Promise<void> {
    const itemId = String(selectedItem.value?.id ?? '').trim();
    if (!itemId || !canManagePricing.value || revisionLoading.value) return;

    revisionLoading.value = true;
    revisionErrors.value = {};

    const basePrice = parseDecimalOrNull(revisionForm.basePrice);
    const taxRatePercent = parseDecimalOrNull(revisionForm.taxRatePercent);
    const metadata = parseMetadata(revisionForm.metadataText);

    const localErrors: Record<string, string[]> = {};
    if (basePrice === null || basePrice === 'invalid') localErrors.basePrice = ['Revision base price must be a valid non-negative number.'];
    if (!revisionForm.effectiveFrom.trim()) localErrors.effectiveFrom = ['Revision effective from is required.'];
    if (taxRatePercent === 'invalid') localErrors.taxRatePercent = ['Tax rate must be a valid non-negative number.'];
    if (metadata === 'invalid') localErrors.metadata = ['System integration notes must be a valid JSON object.'];
    if (revisionWindowValidationMessage.value) localErrors.effectiveTo = [revisionWindowValidationMessage.value];

    if (Object.keys(localErrors).length > 0) {
        revisionErrors.value = localErrors;
        revisionLoading.value = false;
        return;
    }

    try {
        const requestKey = revisionRequestKey.value;
        const response = await apiRequest<CatalogResponse>('POST', `/billing-service-catalog/items/${itemId}/revisions`, {
            body: {
                basePrice,
                taxRatePercent: taxRatePercent === null ? null : taxRatePercent,
                isTaxable: parseBoolean(revisionForm.isTaxable),
                effectiveFrom: toApiDateTime(revisionForm.effectiveFrom),
                effectiveTo: toApiDateTime(revisionForm.effectiveTo),
                description: revisionForm.description.trim() || null,
                metadata,
            },
            entitlementContext: 'Billing service catalog revision create',
            idempotencyKey: requestKey,
            requestId: requestKey,
        });

        selectedItem.value = response.data;
        hydrateEditForm(response.data);
        hydrateRevisionForm(response.data);
        rotateRevisionRequestKey();
        await loadVersionHistory(String(response.data.id ?? itemId));
        await loadPayerImpact(String(response.data.id ?? itemId));
        notifySuccess('Price version created.');
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            revisionErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(error, 'Unable to create the new price version.'));
        }
    } finally {
        revisionLoading.value = false;
    }
}

async function loadVersionHistory(itemId: string): Promise<void> {
    versionHistoryLoading.value = true;
    versionHistoryError.value = null;

    try {
        const response = await apiRequest<CatalogVersionsResponse>('GET', `/billing-service-catalog/items/${itemId}/versions`);
        versionHistory.value = response.data ?? [];
    } catch (error) {
        versionHistoryError.value = messageFromUnknown(error, 'Unable to load price history.');
        versionHistory.value = [];
    } finally {
        versionHistoryLoading.value = false;
    }
}

async function loadPayerImpact(itemId: string): Promise<void> {
    if (!canReadPayerContracts.value) {
        payerImpactSummary.value = null;
        payerImpactError.value = null;
        return;
    }

    payerImpactLoading.value = true;
    payerImpactError.value = null;

    try {
        const response = await apiRequest<CatalogPayerImpactResponse>('GET', `/billing-service-catalog/items/${itemId}/payer-impact`);
        payerImpactSummary.value = response.data ?? null;
    } catch (error) {
        payerImpactError.value = messageFromUnknown(error, 'Unable to load payer contract impact.');
        payerImpactSummary.value = null;
    } finally {
        payerImpactLoading.value = false;
    }
}

function openVersionFromHistory(version: CatalogItem): void {
    const itemId = String(version.id ?? '').trim();
    if (!itemId || itemId === String(selectedItem.value?.id ?? '').trim()) {
        return;
    }

    detailsTab.value = 'overview';
    detailsError.value = null;
    resetDetailsSecondaryData();
    seedDetailsWorkspace(version);
    void loadDetails(itemId);
}

async function loadAuditLogs(page = 1): Promise<void> {
    if (!canViewAudit.value) return;

    const itemId = String(selectedItem.value?.id ?? '').trim();
    if (!itemId) return;

    auditLoading.value = true;
    auditError.value = null;
    auditFilters.page = page;

    try {
        const response = await apiRequest<CatalogAuditLogListResponse>('GET', `/billing-service-catalog/items/${itemId}/audit-logs`, {
            query: {
                q: auditFilters.q.trim() || null,
                action: auditFilters.action.trim() || null,
                actorType: auditFilters.actorType || null,
                actorId: auditFilters.actorId.trim() || null,
                from: toApiDateTime(auditFilters.from),
                to: toApiDateTime(auditFilters.to),
                perPage: auditFilters.perPage,
                page,
            },
        });

        auditLogs.value = response.data ?? [];
        auditMeta.value = response.meta ?? null;
    } catch (error) {
        auditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
        auditLogs.value = [];
        auditMeta.value = null;
    } finally {
        auditLoading.value = false;
    }
}

function resetAuditFilters(): void {
    Object.assign(auditFilters, { q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });
    void loadAuditLogs(1);
}

async function exportAuditLogs(): Promise<void> {
    if (!canViewAudit.value || auditExporting.value) return;

    const itemId = String(selectedItem.value?.id ?? '').trim();
    if (!itemId) return;

    auditExporting.value = true;

    try {
        const { blob, filename } = await apiGetBlob(`/billing-service-catalog/items/${itemId}/audit-logs/export`, {
            query: {
                q: auditFilters.q.trim() || null,
                action: auditFilters.action.trim() || null,
                actorType: auditFilters.actorType || null,
                actorId: auditFilters.actorId.trim() || null,
                from: toApiDateTime(auditFilters.from),
                to: toApiDateTime(auditFilters.to),
            },
            entitlementContext: 'Billing service catalog audit export',
        });

        const downloadName = filename ?? `billing-service-catalog-audit-${itemId}.csv`;
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = downloadName;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(objectUrl);

        notifySuccess('Audit CSV prepared.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export audit CSV.'));
    } finally {
        auditExporting.value = false;
    }
}

onMounted(async () => {
    await loadCountryProfile();
    await Promise.all([loadDetails(props.itemId), loadDepartments()]);
    pageLoading.value = false;
});

watch(
    () => editForm.serviceType,
    (serviceType) => {
        if (!serviceType) {
            editForm.unit = '';
        }
    },
);

</script>
<template>
    <Head :title="`${selectedItem?.serviceName || 'Service price'} - Billing Service Catalog`" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="receipt" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">
                                    {{ selectedItem?.serviceName || 'Service price' }}
                                </h1>
                                <Badge v-if="selectedItem" :variant="statusVariant(selectedItem.status)" class="capitalize">
                                    {{ formatEnumLabel(selectedItem.status) }}
                                </Badge>
                                <Badge v-if="selectedItem" variant="outline">
                                    Version {{ selectedItem.versionNumber || 1 }}
                                </Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">
                                {{ selectedItem?.serviceCode || 'Loading...' }} | {{ clinicalCatalogLinkLabel(selectedItem) }}
                            </p>
                            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">{{ platformScope?.facility?.name || 'No facility' }}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 items-center gap-2">
                        <Button size="sm" variant="outline" class="gap-1.5" as-child>
                            <Link href="/billing-service-catalog">
                                <AppIcon name="chevron-left" class="size-3.5" />
                                Billing Service Catalog
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            <Alert v-if="!permissionsResolved">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="loader-circle" class="size-4 animate-spin" />
                    Resolving access
                </AlertTitle>
                <AlertDescription>Permission context is still loading.</AlertDescription>
            </Alert>

            <Alert v-else-if="scopeUnresolved" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="alert-triangle" class="size-4" />
                    Scope unresolved
                </AlertTitle>
                <AlertDescription>
                    Multi-tenant isolation is enabled but no tenant/facility scope was resolved. Resolve scope before editing service catalog items.
                </AlertDescription>
            </Alert>

            <template v-else-if="selectedItem">
                <div class="flex flex-col gap-4">
                    <div v-if="selectedItem?.supersedesBillingServiceCatalogItemId" class="text-xs text-muted-foreground">
                        This version replaces an earlier price version in the same service family.
                    </div>
                    <div v-if="selectedItem" class="flex flex-wrap items-stretch gap-2">
                        <div
                            v-for="card in detailsWorkspaceSummaryCards"
                            :key="card.key"
                            class="min-w-[180px] flex-1 rounded-lg border bg-background/70 px-3 py-2.5"
                        >
                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ card.label }}</p>
                            <p class="mt-1 text-sm font-semibold">{{ card.value }}</p>
                            <p class="mt-1 text-xs text-muted-foreground">{{ card.helper }}</p>
                        </div>
                    </div>

                    <Card class="flex flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                        <div class="min-h-0 flex-1 overflow-hidden">
                            <Tabs v-model="detailsTab" class="flex h-full min-h-0 flex-col">
                                <div class="border-b bg-muted/5 px-4 py-2.5">
                                    <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
                                        <TabsTrigger value="overview" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Overview</TabsTrigger>
                                        <TabsTrigger value="current" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Current Price</TabsTrigger>
                                        <TabsTrigger v-if="canManagePricing" value="version" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">New Version</TabsTrigger>
                                        <TabsTrigger value="history" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Price History</TabsTrigger>
                                        <TabsTrigger value="status" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Status</TabsTrigger>
                                        <TabsTrigger v-if="canViewAudit" value="audit" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Audit</TabsTrigger>
                                    </TabsList>
                                </div>

                                <ScrollArea class="min-h-0 flex-1">
                                    <div class="space-y-4 p-4">
                                        <Alert v-if="detailsError" variant="destructive">
                                            <AlertTitle>Details sync issue</AlertTitle>
                                            <AlertDescription>{{ detailsError }}</AlertDescription>
                                        </Alert>

                                        <TabsContent value="overview" class="space-y-3">
                                            <div class="space-y-3">
                                                <div class="rounded-lg border border-dashed bg-muted/10 p-3">
                                                    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                                        <div>
                                                            <p class="text-sm font-medium">Clinical linkage</p>
                                                            <p class="text-xs text-muted-foreground">This shows whether the billing price is linked to a clinical care definition or remains billing-only.</p>
                                                        </div>
                                                        <Badge :variant="selectedItem?.clinicalCatalogItemId ? 'secondary' : 'outline'">
                                                            {{ clinicalCatalogLinkLabel(selectedItem) }}
                                                        </Badge>
                                                    </div>
                                                    <div v-if="detailsClinicalLinkagePending" class="mt-3 space-y-2">
                                                        <Skeleton class="h-4 w-56" />
                                                        <Skeleton class="h-3 w-full max-w-md" />
                                                    </div>
                                                    <template v-else>
                                                        <p class="mt-3 text-sm font-medium">{{ selectedItem?.clinicalCatalogItem?.name || 'No linked clinical definition' }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">{{ clinicalCatalogLinkDetail(selectedItem) }}</p>
                                                    </template>
                                                </div>

                                                <Alert v-if="!detailsLoading && (selectedItem?.linkWarning || (selectedItem?.standardsWarnings?.length ?? 0) > 0)">
                                                    <AlertTitle>Governance review</AlertTitle>
                                                    <AlertDescription class="space-y-1">
                                                        <p v-if="selectedItem?.linkWarning">{{ selectedItem.linkWarning }}</p>
                                                        <p v-for="warning in selectedItem?.standardsWarnings ?? []" :key="warning">{{ warning }}</p>
                                                    </AlertDescription>
                                                </Alert>

                                                <Alert v-if="identityFieldsLocked">
                                                    <AlertTitle>Synced from Clinical Catalog</AlertTitle>
                                                    <AlertDescription>Identity fields are managed by the linked clinical definition and cannot be edited here. Update the source in Clinical Catalog instead.</AlertDescription>
                                                </Alert>

                                                <div class="rounded-lg border p-3">
                                                    <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                                        <div>
                                                            <p class="text-sm font-medium">Service identity</p>
                                                            <p class="text-xs text-muted-foreground">Keep this record stable for pricing, payer rules, and any linked clinical care definition.</p>
                                                        </div>
                                                        <div class="rounded-lg border bg-muted/10 px-3 py-2 text-sm">
                                                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                                <span>{{ editForm.serviceCode || 'Code not set' }}</span>
                                                                <span class="text-muted-foreground">|</span>
                                                                <span>{{ editForm.serviceType ? formatEnumLabel(editForm.serviceType) : 'Type not set' }}</span>
                                                                <span class="text-muted-foreground">|</span>
                                                                <span>{{ editDepartmentSummary || 'Department not set' }}</span>
                                                                <span class="text-muted-foreground">|</span>
                                                                <span>{{ editForm.unit ? formatEnumLabel(editForm.unit) : 'Unit not set' }}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="mt-3 grid gap-3 md:grid-cols-3">
                                                        <FormFieldShell input-id="edit-price-service-code" label="Service code" :error-message="firstError(identityErrors, 'serviceCode')">
                                                            <Input id="edit-price-service-code" v-model="editForm.serviceCode" :disabled="!canManageIdentity || identityFieldsLocked" />
                                                        </FormFieldShell>
                                                        <FormFieldShell input-id="edit-price-service-name" label="Service name" container-class="md:col-span-2" :error-message="firstError(identityErrors, 'serviceName')">
                                                            <Input id="edit-price-service-name" v-model="editForm.serviceName" :disabled="!canManageIdentity || identityFieldsLocked" />
                                                        </FormFieldShell>
                                                        <FormFieldShell input-id="edit-price-service-type" label="Service type">
                                                            <Select v-model="editServiceTypeSelectValue">
                                                                <SelectTrigger id="edit-price-service-type" class="w-full" :disabled="!canManageIdentity || identityFieldsLocked">
                                                                    <SelectValue placeholder="Select type" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="__none__">Select type</SelectItem>
                                                                    <SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormFieldShell>
                                                        <ComboboxField
                                                            input-id="edit-price-department"
                                                            label="Department"
                                                            v-model="editForm.departmentId"
                                                            :options="editDepartmentOptions"
                                                            placeholder="Select department"
                                                            search-placeholder="Search department code or name"
                                                            :helper-text="editDepartmentHelperText"
                                                            :error-message="firstError(identityErrors, 'departmentId')"
                                                            :empty-text="editDepartmentEmptyText"
                                                            :disabled="!canManageIdentity || identityFieldsLocked"
                                                        />
                                                        <FormFieldShell input-id="edit-price-unit" label="Billing unit">
                                                            <Select v-model="editUnitSelectValue">
                                                                <SelectTrigger id="edit-price-unit" class="w-full" :disabled="!canManageIdentity || identityFieldsLocked">
                                                                    <SelectValue placeholder="Select unit" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="__none__">Select unit</SelectItem>
                                                                    <SelectItem v-for="option in editUnitOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormFieldShell>
                                                    </div>
                                                    <details class="mt-3 rounded-lg border bg-muted/10 p-3">
                                                        <summary class="cursor-pointer text-sm font-medium">Advanced / Standards</summary>
                                                        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                            <FormFieldShell input-id="edit-price-facility-tier" label="Minimum facility tier">
                                                                <Select
                                                                    :disabled="!canManageIdentity || identityFieldsLocked"
                                                                    :model-value="editForm.facilityTier || '__none__'"
                                                                    @update:model-value="(value: AcceptableValue) => { editForm.facilityTier = value === '__none__' ? '' : String(value as string); }"
                                                                >
                                                                    <SelectTrigger id="edit-price-facility-tier" class="w-full">
                                                                        <SelectValue placeholder="All tiers" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="__none__">All tiers</SelectItem>
                                                                        <SelectItem v-for="tier in facilityTierOptions" :key="tier.value" :value="tier.value">{{ tier.label }}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormFieldShell>
                                                            <FormFieldShell input-id="edit-price-local-code" label="Local code"><Input id="edit-price-local-code" v-model="editForm.standardsLocal" :disabled="!canManageIdentity || identityFieldsLocked" placeholder="Internal code" /></FormFieldShell>
                                                            <FormFieldShell input-id="edit-price-nhif-code" label="NHIF code"><Input id="edit-price-nhif-code" v-model="editForm.standardsNhif" :disabled="!canManageIdentity || identityFieldsLocked" placeholder="NHIF tariff code" /></FormFieldShell>
                                                            <FormFieldShell input-id="edit-price-msd-code" label="MSD code"><Input id="edit-price-msd-code" v-model="editForm.standardsMsd" :disabled="!canManageIdentity || identityFieldsLocked" placeholder="MSD reference" /></FormFieldShell>
                                                            <FormFieldShell input-id="edit-price-loinc-code" label="LOINC"><Input id="edit-price-loinc-code" v-model="editForm.standardsLoinc" :disabled="!canManageIdentity || identityFieldsLocked" placeholder="Lab standard" /></FormFieldShell>
                                                            <FormFieldShell input-id="edit-price-snomed-code" label="SNOMED CT"><Input id="edit-price-snomed-code" v-model="editForm.standardsSnomedCt" :disabled="!canManageIdentity || identityFieldsLocked" placeholder="Clinical concept" /></FormFieldShell>
                                                            <FormFieldShell input-id="edit-price-cpt-code" label="CPT"><Input id="edit-price-cpt-code" v-model="editForm.standardsCpt" :disabled="!canManageIdentity || identityFieldsLocked" placeholder="Optional procedure code" /></FormFieldShell>
                                                            <FormFieldShell input-id="edit-price-icd-code" label="ICD"><Input id="edit-price-icd-code" v-model="editForm.standardsIcd" :disabled="!canManageIdentity || identityFieldsLocked" placeholder="Optional diagnosis link" /></FormFieldShell>
                                                        </div>
                                                    </details>
                                                </div>

                                            </div>
                                            <div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                <p class="text-xs text-muted-foreground">Updated {{ formatDateTime(selectedItem.updatedAt) }}</p>
                                                <div class="flex items-center gap-2">
                                                    <Button v-if="canManagePricing" size="sm" variant="outline" @click="detailsTab = 'version'">Open new version</Button>
                                                    <Button v-if="canManageIdentity" :disabled="identityLoading || identityFieldsLocked" @click="saveIdentity">{{ identityLoading ? 'Saving...' : 'Save service details' }}</Button>
                                                </div>
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="current" class="space-y-3">
                                            <div class="rounded-lg border p-3">
                                                <div class="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                                    <div>
                                                        <p class="text-sm font-medium">Current price setup</p>
                                                        <p class="text-xs text-muted-foreground">Manage the live base price, tax posture, active window, and notes.</p>
                                                    </div>
                                                    <Button v-if="canManagePricing" size="sm" variant="outline" @click="detailsTab = 'version'">Open new version</Button>
                                                </div>
                                                <div class="rounded-lg border bg-muted/10 px-3 py-2 text-sm">
                                                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        <span>{{ formatMoneyLocal(editForm.basePrice || null, editForm.currencyCode || null) }}</span>
                                                        <span class="text-muted-foreground">|</span>
                                                        <span>{{ editForm.taxRatePercent?.trim() ? `${editForm.taxRatePercent}%` : 'No tax rate' }} / {{ boolLabel(parseBoolean(editForm.isTaxable)) }}</span>
                                                        <span class="text-muted-foreground">|</span>
                                                        <span>{{ tariffWindowLabel(toApiDateTime(editForm.effectiveFrom), toApiDateTime(editForm.effectiveTo)) }}</span>
                                                    </div>
                                                </div>
                                                <div v-if="editTariffWindowValidationMessage" class="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                                                    {{ editTariffWindowValidationMessage }}
                                                </div>
                                                <div class="mt-3 grid gap-3 md:grid-cols-4">
                                                    <FormFieldShell input-id="edit-price-base-price" label="Base price" :error-message="firstError(pricingErrors, 'basePrice')">
                                                        <Input id="edit-price-base-price" v-model="editForm.basePrice" inputmode="decimal" :disabled="!canManagePricing" />
                                                    </FormFieldShell>
                                                    <FormFieldShell input-id="edit-price-currency" label="Currency" :error-message="firstError(pricingErrors, 'currencyCode')">
                                                        <Input id="edit-price-currency" v-model="editForm.currencyCode" maxlength="3" :disabled="!canManagePricing" />
                                                    </FormFieldShell>
                                                    <FormFieldShell input-id="edit-price-tax-rate" label="Tax rate %" :error-message="firstError(pricingErrors, 'taxRatePercent')">
                                                        <Input id="edit-price-tax-rate" v-model="editForm.taxRatePercent" inputmode="decimal" :disabled="!canManagePricing" />
                                                    </FormFieldShell>
                                                    <FormFieldShell input-id="edit-price-taxable" label="Taxable">
                                                        <Select v-model="editTaxableSelectValue">
                                                            <SelectTrigger id="edit-price-taxable" class="w-full" :disabled="!canManagePricing">
                                                                <SelectValue placeholder="N/A" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__none__">N/A</SelectItem>
                                                                <SelectItem value="true">Yes</SelectItem>
                                                                <SelectItem value="false">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormFieldShell>
                                                    <SingleDatePopoverField
                                                        input-id="edit-price-effective-from-date"
                                                        label="Effective from"
                                                        v-model="editEffectiveFromDate"
                                                        :disabled="!canManagePricing"
                                                    />
                                                    <TimePopoverField
                                                        input-id="edit-price-effective-from-time"
                                                        label="Start time"
                                                        v-model="editEffectiveFromTime"
                                                        :disabled="!canManagePricing"
                                                    />
                                                    <SingleDatePopoverField
                                                        input-id="edit-price-effective-to-date"
                                                        label="Effective to"
                                                        v-model="editEffectiveToDate"
                                                        :disabled="!canManagePricing"
                                                    />
                                                    <TimePopoverField
                                                        input-id="edit-price-effective-to-time"
                                                        label="End time"
                                                        v-model="editEffectiveToTime"
                                                        :disabled="!canManagePricing"
                                                    />
                                                    <div class="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground md:col-span-4">
                                                        For the live base price only. Use payer contracts for insurer-specific rates; use New Version for lifecycle changes.
                                                    </div>
                                                    <FormFieldShell input-id="edit-price-description" label="Description" container-class="md:col-span-4">
                                                        <Textarea id="edit-price-description" v-model="editForm.description" class="min-h-20" :disabled="!canManagePricing" />
                                                    </FormFieldShell>
                                                    <details
                                                        v-if="showEditTechnicalMetadata"
                                                        class="rounded-lg border border-dashed bg-muted/10 p-3 md:col-span-4"
                                                    >
                                                        <summary class="cursor-pointer text-sm font-medium">System integration notes (technical)</summary>
                                                        <p class="mt-2 text-xs text-muted-foreground">
                                                            For IT or integration teams only. Hospital billing staff can ignore this section.
                                                        </p>
                                                        <FormFieldShell
                                                            input-id="edit-price-metadata"
                                                            label="Integration payload"
                                                            container-class="mt-3"
                                                            :error-message="firstError(pricingErrors, 'metadata')"
                                                        >
                                                            <Textarea id="edit-price-metadata" v-model="editForm.metadataText" class="min-h-24 font-mono text-xs" :disabled="!canManagePricing" />
                                                        </FormFieldShell>
                                                    </details>
                                                </div>
                                            </div>
                                            <div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                <p class="text-xs text-muted-foreground">Updated {{ formatDateTime(selectedItem.updatedAt) }}</p>
                                                <div class="flex items-center gap-2">
                                                    <Button size="sm" variant="outline" @click="detailsTab = 'status'">Open status</Button>
                                                    <Button v-if="canManagePricing" :disabled="pricingLoading || Boolean(editTariffWindowValidationMessage)" @click="savePricing">{{ pricingLoading ? 'Saving...' : 'Save current price' }}</Button>
                                                </div>
                                            </div>
                                        </TabsContent>
                                        <TabsContent v-if="canManagePricing" value="version" class="space-y-3">
                                            <div class="rounded-lg border p-3">
                                                <div class="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                                    <div>
                                                        <p class="text-sm font-medium">New price version</p>
                                                        <p class="text-xs text-muted-foreground">Create the next price window without overwriting the current live version.</p>
                                                    </div>
                                                    <Badge :variant="revisionDraftReady ? 'secondary' : 'outline'">
                                                        {{ revisionDraftReady ? 'Ready to create' : 'Setup in progress' }}
                                                    </Badge>
                                                </div>
                                                <div class="mb-3 rounded-lg border bg-muted/10 px-3 py-2.5">
                                                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                                        <span><span class="font-medium text-muted-foreground">Current:</span> {{ formatMoneyLocal(selectedItem.basePrice, selectedItem.currencyCode) }}</span>
                                                        <span class="text-muted-foreground">|</span>
                                                        <span><span class="font-medium text-muted-foreground">Window:</span> {{ tariffWindowLabel(selectedItem.effectiveFrom, selectedItem.effectiveTo) }}</span>
                                                        <span class="text-muted-foreground">|</span>
                                                        <span><span class="font-medium text-muted-foreground">Draft:</span> {{ revisionDraftSummary }}</span>
                                                    </div>
                                                </div>
                                                <div class="grid gap-3 md:grid-cols-2">
                                                    <FormFieldShell input-id="revision-base-price" label="New base price" :error-message="firstError(revisionErrors, 'basePrice')">
                                                        <Input id="revision-base-price" v-model="revisionForm.basePrice" inputmode="decimal" />
                                                    </FormFieldShell>
                                                    <div class="grid gap-3 sm:grid-cols-2">
                                                        <SingleDatePopoverField
                                                            input-id="revision-effective-from-date"
                                                            label="New price starts"
                                                            v-model="revisionEffectiveFromDate"
                                                            :error-message="firstError(revisionErrors, 'effectiveFrom')"
                                                        />
                                                        <TimePopoverField
                                                            input-id="revision-effective-from-time"
                                                            label="Start time"
                                                            v-model="revisionEffectiveFromTime"
                                                        />
                                                    </div>
                                                    <FormFieldShell input-id="revision-tax-rate" label="Tax rate %" :error-message="firstError(revisionErrors, 'taxRatePercent')">
                                                        <Input id="revision-tax-rate" v-model="revisionForm.taxRatePercent" inputmode="decimal" />
                                                    </FormFieldShell>
                                                    <div class="grid gap-3 sm:grid-cols-2">
                                                        <SingleDatePopoverField
                                                            input-id="revision-effective-to-date"
                                                            label="New price ends"
                                                            v-model="revisionEffectiveToDate"
                                                            :error-message="firstError(revisionErrors, 'effectiveTo')"
                                                        />
                                                        <TimePopoverField
                                                            input-id="revision-effective-to-time"
                                                            label="End time"
                                                            v-model="revisionEffectiveToTime"
                                                        />
                                                    </div>
                                                    <FormFieldShell input-id="revision-taxable" label="Taxable">
                                                        <Select v-model="revisionTaxableSelectValue">
                                                            <SelectTrigger id="revision-taxable" class="w-full">
                                                                <SelectValue placeholder="N/A" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__none__">N/A</SelectItem>
                                                                <SelectItem value="true">Yes</SelectItem>
                                                                <SelectItem value="false">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormFieldShell>
                                                    <div class="rounded-lg border bg-muted/10 px-3 py-2 text-xs text-muted-foreground md:col-span-2">
                                                        {{ revisionGovernanceMessage }}
                                                    </div>
                                                    <div v-if="revisionWindowValidationMessage" class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive md:col-span-2">
                                                        {{ revisionWindowValidationMessage }}
                                                    </div>
                                                    <FormFieldShell input-id="revision-description" label="Change notes" container-class="md:col-span-2">
                                                        <Textarea id="revision-description" v-model="revisionForm.description" class="min-h-16" />
                                                    </FormFieldShell>
                                                </div>
                                                <details
                                                    v-if="showRevisionTechnicalMetadata"
                                                    class="mt-3 rounded-lg border border-dashed bg-muted/10 p-3"
                                                >
                                                    <summary class="cursor-pointer text-sm font-medium">System integration notes (technical)</summary>
                                                    <p class="mt-2 text-xs text-muted-foreground">
                                                        Leave blank unless IT needs to carry integration data into the new price version.
                                                    </p>
                                                    <FormFieldShell
                                                        input-id="revision-metadata"
                                                        label="Integration payload"
                                                        container-class="mt-3"
                                                        :error-message="firstError(revisionErrors, 'metadata')"
                                                    >
                                                        <Textarea id="revision-metadata" v-model="revisionForm.metadataText" class="min-h-20 font-mono text-xs" />
                                                    </FormFieldShell>
                                                </details>
                                                <div class="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <p class="text-xs text-muted-foreground">Keeps the current price auditable while preparing the next billing window.</p>
                                                    <Button :disabled="revisionLoading || Boolean(revisionWindowValidationMessage)" @click="createRevision">{{ revisionLoading ? 'Creating version...' : 'Create new version' }}</Button>
                                                </div>
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="history" class="space-y-3">
                                            <div class="rounded-lg border p-3">
                                                <div class="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                    <div>
                                                        <p class="text-sm font-medium">Price history</p>
                                                        <p class="text-xs text-muted-foreground">Current, replaced, and scheduled price versions for this service code.</p>
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <Button size="sm" variant="outline" @click="detailsTab = 'current'">Open current price</Button>
                                                        <Button v-if="canManagePricing" size="sm" variant="outline" @click="detailsTab = 'version'">Open new version</Button>
                                                    </div>
                                                </div>
                                                <div
                                                    v-if="!versionHistoryError && !versionHistoryLoading && versionHistory.length > 0"
                                                    class="mb-3 grid gap-2 lg:grid-cols-3"
                                                >
                                                    <div
                                                        v-for="summary in versionHistoryImpactSummary"
                                                        :key="summary.key"
                                                        class="rounded-lg border bg-muted/10 px-3 py-2.5"
                                                    >
                                                        <div class="flex items-start justify-between gap-3">
                                                            <div class="min-w-0 space-y-1">
                                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ summary.label }}</p>
                                                                <p class="text-xs text-muted-foreground">{{ summary.description }}</p>
                                                            </div>
                                                            <Badge :variant="summary.item ? 'outline' : 'secondary'">
                                                                {{ versionSummaryBadgeText(summary.item) }}
                                                            </Badge>
                                                        </div>
                                                        <div class="mt-2">
                                                            <template v-if="summary.item">
                                                                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                                                    <span class="font-semibold">{{ formatMoneyLocal(summary.item.basePrice, summary.item.currencyCode) }}</span>
                                                                    <span class="text-muted-foreground">{{ tariffWindowLabel(summary.item.effectiveFrom, summary.item.effectiveTo) }}</span>
                                                                </div>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    {{ compareVersionToPrevious(summary.item, versionHistory) || versionFamilyRole(summary.item, String(selectedItem?.id ?? '')) }}
                                                                </p>
                                                            </template>
                                                            <template v-else>
                                                                <p class="text-sm font-medium text-muted-foreground">{{ summary.emptyLabel }}</p>
                                                            </template>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div v-if="canReadPayerContracts" class="mb-3 rounded-lg border p-3">
                                                    <div class="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div>
                                                            <p class="text-sm font-medium">Contract impact</p>
                                                            <p class="text-xs text-muted-foreground">
                                                                Active contracts and authorization rules currently aligned to this service price.
                                                            </p>
                                                        </div>
                                                        <div class="flex items-center gap-2">
                                                            <Badge variant="outline">{{ selectedItem?.currencyCode || payerImpactSummary?.currencyCode || defaultCurrencyCode }}</Badge>
                                                            <Button as-child variant="outline" size="sm">
                                                                <Link href="/billing-payer-contracts">Open contracts</Link>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    <div v-if="payerImpactError" class="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                                                        {{ payerImpactError }}
                                                    </div>
                                                    <div v-else-if="payerImpactLoading" class="grid gap-3 md:grid-cols-3">
                                                        <Skeleton class="h-24 w-full" />
                                                        <Skeleton class="h-24 w-full" />
                                                        <Skeleton class="h-24 w-full" />
                                                    </div>
                                                    <div v-else-if="payerImpactSummary" class="space-y-2">
                                                        <div class="grid gap-2 md:grid-cols-3">
                                                            <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Contract Reach</p>
                                                                <p class="mt-1 text-lg font-semibold">{{ payerImpactSummary.activeContractCount }}</p>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    active contracts pricing in {{ payerImpactSummary.currencyCode || selectedItem?.currencyCode || defaultCurrencyCode }}
                                                                </p>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    {{ payerImpactSummary.contractsWithMatchingRulesCount }} contract{{ payerImpactSummary.contractsWithMatchingRulesCount === 1 ? '' : 's' }} already carry matching authorization logic
                                                                </p>
                                                            </div>
                                                            <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Coverage Defaults</p>
                                                                <p class="mt-1 text-lg font-semibold">
                                                                    {{ formatCoverageRange(payerImpactSummary.coveragePercentMin, payerImpactSummary.coveragePercentMax) }}
                                                                </p>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    The base price remains the default source; contracts currently affect coverage and claim workflow rather than replacing the service price itself.
                                                                </p>
                                                            </div>
                                                            <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                                                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Authorization Pressure</p>
                                                                <p class="mt-1 text-lg font-semibold">{{ payerImpactSummary.matchingRuleCount }} matching rules</p>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    {{ payerImpactSummary.authorizationRequiredRuleCount }} require authorization, {{ payerImpactSummary.autoApproveRuleCount }} auto-approve, {{ payerImpactSummary.preAuthorizationContractCount }} contracts require pre-auth by default
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                            <Badge variant="outline">Service code rules {{ payerImpactSummary.serviceSpecificRuleCount }}</Badge>
                                                            <Badge variant="outline">Service type rules {{ payerImpactSummary.serviceTypeRuleCount }}</Badge>
                                                            <Badge variant="outline">Department rules {{ payerImpactSummary.departmentRuleCount }}</Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div v-if="versionHistoryError" class="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                                                    {{ versionHistoryError }}
                                                </div>
                                                <div v-else-if="versionHistoryLoading" class="space-y-2">
                                                    <Skeleton class="h-16 w-full" />
                                                    <Skeleton class="h-16 w-full" />
                                                </div>
                                                <div v-else-if="versionHistory.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                                                    No price versions found for this service code.
                                                </div>
                                                <div v-else class="space-y-2">
                                                    <div class="rounded-lg border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                                                        Most recent live, scheduled, and historical prices above. Full version trail below.
                                                    </div>
                                                    <div v-for="version in versionHistory" :key="String(version.id)" class="rounded-lg border bg-background/70 p-3">
                                                        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                            <div class="min-w-0 space-y-2">
                                                                <div class="flex flex-wrap items-center gap-2">
                                                                    <Badge variant="outline">v{{ version.versionNumber || 1 }}</Badge>
                                                                    <Badge :variant="versionFamilyRoleVariant(version, String(selectedItem?.id ?? ''))">
                                                                        {{ versionFamilyRole(version, String(selectedItem?.id ?? '')) }}
                                                                    </Badge>
                                                                    <Badge :variant="statusVariant(version.status)">{{ formatEnumLabel(version.status) }}</Badge>
                                                                    <Badge :variant="tariffLifecycleVariant(version.effectiveFrom, version.effectiveTo)">{{ tariffLifecycleLabel(version.effectiveFrom, version.effectiveTo) }}</Badge>
                                                                </div>
                                                                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                                    <p class="text-sm font-medium">{{ formatMoneyLocal(version.basePrice, version.currencyCode) }}</p>
                                                                    <p class="text-xs text-muted-foreground">{{ tariffWindowLabel(version.effectiveFrom, version.effectiveTo) }}</p>
                                                                    <p class="text-xs text-muted-foreground">Updated {{ formatDateTime(version.updatedAt) }}</p>
                                                                </div>
                                                                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                                    <span v-if="findSupersededVersionLabel(version, versionHistory)">{{ findSupersededVersionLabel(version, versionHistory) }}</span>
                                                                    <span v-if="compareVersionToPrevious(version, versionHistory)">{{ compareVersionToPrevious(version, versionHistory) }}</span>
                                                                </div>
                                                            </div>
                                                            <div class="flex shrink-0 items-center gap-2">
                                                                <Button
                                                                    v-if="version.id !== selectedItem?.id"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    @click="openVersionFromHistory(version)"
                                                                >
                                                                    View this version
                                                                </Button>
                                                                <Badge v-else variant="secondary">Viewing</Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="status" class="space-y-3">
                                            <div class="rounded-lg border p-3">
                                                <div class="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                    <div>
                                                        <p class="text-sm font-medium">Status</p>
                                                        <p class="text-xs text-muted-foreground">Pause, reactivate, or retire this service price with the right reason trail.</p>
                                                    </div>
                                                    <Button size="sm" variant="outline" @click="detailsTab = 'history'">Open history</Button>
                                                </div>
                                                <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                                    <div
                                                        v-for="card in statusSummaryCards"
                                                        :key="card.key"
                                                        class="rounded-lg border bg-muted/10 px-3 py-2.5"
                                                    >
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ card.label }}</p>
                                                        <p class="mt-1 text-sm font-semibold">{{ card.value }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">{{ card.helper }}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div class="rounded-lg border p-3">
                                                <div class="mb-3">
                                                    <p class="text-sm font-medium">Change status</p>
                                                    <p class="text-xs text-muted-foreground">Use `Inactive` for temporary hold and `Retired` when this price should no longer be used.</p>
                                                </div>
                                                <div class="grid gap-3 md:grid-cols-2">
                                                    <FormFieldShell input-id="status-target" label="New status">
                                                        <Select v-model="statusSelectValue">
                                                            <SelectTrigger id="status-target" class="w-full" :disabled="!canManagePricing">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="active">Active</SelectItem>
                                                                <SelectItem value="inactive">Inactive</SelectItem>
                                                                <SelectItem value="retired">Retired</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormFieldShell>
                                                    <div class="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                                                        A reason is required when the price is being paused or retired. Keep it short and operational so billing staff can understand the change quickly.
                                                    </div>
                                                    <FormFieldShell input-id="status-reason" label="Reason" container-class="md:col-span-2" :error-message="firstError(statusErrors, 'reason')">
                                                        <Textarea id="status-reason" v-model="statusForm.reason" class="min-h-24" :disabled="!canManagePricing" placeholder="Required for inactive or retired prices" />
                                                    </FormFieldShell>
                                                </div>
                                            </div>

                                            <div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                <p class="text-xs text-muted-foreground">Use status changes for operational control, not for price edits.</p>
                                                <Button v-if="canManagePricing" :disabled="statusLoading" @click="saveStatus">{{ statusLoading ? 'Saving...' : 'Save status change' }}</Button>
                                            </div>
                                        </TabsContent>

                                        <TabsContent v-if="canViewAudit" value="audit" class="space-y-3">
                                            <Card class="rounded-lg border">
                                                <CardHeader class="pb-3">
                                                    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div>
                                                            <CardTitle class="text-base">Audit timeline</CardTitle>
                                                            <CardDescription>Search lifecycle logs, then narrow only when you need deeper trace details.</CardDescription>
                                                        </div>
                                                        <Button variant="outline" size="sm" :disabled="auditExporting" @click="exportAuditLogs">
                                                            {{ auditExporting ? 'Preparing...' : 'Export CSV' }}
                                                        </Button>
                                                    </div>
                                                </CardHeader>
                                                <CardContent class="space-y-3">
                                                    <div class="grid gap-3">
                                                        <FormFieldShell input-id="audit-search" label="Text search">
                                                            <Input id="audit-search" v-model="auditFilters.q" placeholder="created, updated, status.updated..." />
                                                        </FormFieldShell>
                                                        <div class="grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-2 lg:grid-cols-3">
                                                            <FormFieldShell input-id="audit-action" label="Action">
                                                                <Input id="audit-action" v-model="auditFilters.action" />
                                                            </FormFieldShell>
                                                            <FormFieldShell input-id="audit-actor-type" label="Actor type">
                                                                <Select v-model="auditActorTypeSelectValue">
                                                                    <SelectTrigger id="audit-actor-type" class="w-full">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="__all__">All</SelectItem>
                                                                        <SelectItem value="user">User</SelectItem>
                                                                        <SelectItem value="system">System</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormFieldShell>
                                                            <FormFieldShell input-id="audit-actor-id" label="Actor ID">
                                                                <Input id="audit-actor-id" v-model="auditFilters.actorId" inputmode="numeric" />
                                                            </FormFieldShell>
                                                            <SingleDatePopoverField input-id="audit-from-date" label="From date" v-model="auditFromDate" />
                                                            <TimePopoverField input-id="audit-from-time" label="From time" v-model="auditFromTime" />
                                                            <SingleDatePopoverField input-id="audit-to-date" label="To date" v-model="auditToDate" />
                                                            <TimePopoverField input-id="audit-to-time" label="To time" v-model="auditToTime" />
                                                            <FormFieldShell input-id="audit-per-page" label="Per page">
                                                                <Select v-model="auditPerPageSelectValue">
                                                                    <SelectTrigger id="audit-per-page" class="w-full">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="10">10</SelectItem>
                                                                        <SelectItem value="20">20</SelectItem>
                                                                        <SelectItem value="50">50</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormFieldShell>
                                                        </div>
                                                    </div>
                                                    <div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                        <p class="text-xs text-muted-foreground">Export respects the current audit filters.</p>
                                                        <div class="flex flex-wrap items-center gap-2">
                                                            <Button variant="outline" size="sm" :disabled="auditLoading" @click="resetAuditFilters">Reset</Button>
                                                            <Button size="sm" :disabled="auditLoading" @click="loadAuditLogs(1)">{{ auditLoading ? 'Applying...' : 'Apply filters' }}</Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            <Alert v-if="auditError" variant="destructive"><AlertTitle>Audit load issue</AlertTitle><AlertDescription>{{ auditError }}</AlertDescription></Alert>
                                            <div v-else-if="auditLoading" class="space-y-2"><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /></div>
                                            <div v-else-if="auditLogs.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No audit logs found.</div>
                                            <div v-else class="space-y-2">
                                                <div v-for="log in auditLogs" :key="log.id" class="rounded-lg border p-3 text-sm">
                                                    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                        <div class="space-y-1">
                                                            <p class="font-medium">{{ log.action || 'event' }}</p>
                                                            <p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }} | {{ log.actorId === null ? 'System' : `User #${log.actorId}` }}</p>
                                                        </div>
                                                        <Badge variant="outline">{{ log.actorId === null ? 'System' : 'User' }}</Badge>
                                                    </div>
                                                    <p v-if="log.billingServiceCatalogItemId" class="mt-2 text-xs text-muted-foreground">
                                                        Price record {{ log.billingServiceCatalogItemId }}
                                                    </p>
                                                </div>
                                            </div>

                                            <div class="flex items-center justify-between border-t pt-2">
                                                <Button variant="outline" size="sm" :disabled="auditLoading || (auditMeta?.currentPage ?? 1) <= 1" @click="loadAuditLogs((auditMeta?.currentPage ?? 1) - 1)">Previous</Button>
                                                <p class="text-xs text-muted-foreground">Page {{ auditMeta?.currentPage ?? 1 }} of {{ auditMeta?.lastPage ?? 1 }}</p>
                                                <Button variant="outline" size="sm" :disabled="auditLoading || !auditMeta || auditMeta.currentPage >= auditMeta.lastPage" @click="loadAuditLogs((auditMeta?.currentPage ?? 1) + 1)">Next</Button>
                                            </div>
                                        </TabsContent>
                                    </div>
                                </ScrollArea>
                            </Tabs>
                        </div>
                    </Card>
                </div>
            </template>

            <template v-else-if="!pageLoading && !selectedItem">
                <div class="flex flex-col items-center gap-3 px-4 py-10 text-center">
                    <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
                        <AppIcon name="receipt" class="size-4 text-muted-foreground" />
                    </div>
                    <div class="space-y-1">
                        <p class="text-sm font-medium">Service price not found</p>
                        <p class="text-xs text-muted-foreground">
                            The requested service catalog item could not be loaded. It may have been removed or you may not have access.
                        </p>
                    </div>
                    <Button size="sm" variant="outline" class="gap-1.5" as-child>
                        <Link href="/billing-service-catalog">
                            <AppIcon name="chevron-left" class="size-3.5" />
                            Billing Service Catalog
                        </Link>
                    </Button>
                </div>
            </template>

            <div v-else class="space-y-3">
                <Skeleton class="h-10 w-full" />
                <Skeleton class="h-4 w-3/4" />
                <Skeleton class="h-64 w-full" />
            </div>

            <LeaveWorkflowDialog
                :open="leaveConfirmOpen"
                title="Leave billing service catalog workflow?"
                description="A billing service catalog form still has unsaved pricing or governance changes. Stay here to finish the work, or leave this page and discard the unfinished updates."
                stay-label="Stay on workflow"
                leave-label="Leave page"
                @update:open="cancelPendingCatalogWorkflowLeave"
                @confirm="confirmPendingCatalogWorkflowLeave"
            />

            <LeaveWorkflowDialog
                :open="detailsDiscardConfirmOpen"
                title="Discard service price changes?"
                description="This service price still has unsaved edits. Keep editing to preserve the pricing update, or discard the unfinished changes."
                stay-label="Keep editing"
                leave-label="Discard changes"
                @update:open="detailsDiscardConfirmOpen = false"
                @confirm="detailsDiscardConfirmOpen = false"
            />
        </div>
    </AppLayout>
</template>
