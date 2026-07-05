
<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import CatalogLinkBadge from '@/components/shared/CatalogLinkBadge.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
    type CatalogStatusCounts,
    type Pagination,
    type CatalogListResponse,
    type CatalogResponse,
    type CatalogVersionsResponse,
    type CatalogPayerImpactSummary,
    type CatalogPayerImpactResponse,
    type StatusCountResponse,
    type Department,
    type DepartmentListResponse,
    type ClinicalCatalogType,
    type CreateIdentitySource,
    type ClinicalCatalogLookupItem,
    type ClinicalCatalogLookupListResponse,
    type CatalogAuditLog,
    type CatalogAuditLogListResponse,
    type ValidationErrorResponse,
    type ServiceTypeCountResponse,
    type ServiceTypeCounts,
    type StandardsCodes,
    type ScopeData,
    SERVICE_TYPE_OPTIONS,
    SERVICE_TYPE_TABS,
    UNIT_OPTIONS,
    PHARMACY_UNIT_OPTIONS,
    FACILITY_TIER_OPTIONS,
    CLINICAL_CATALOG_SOURCES,
    buildDepartmentOptions as buildDepartmentOptionsFromList,
    findDepartmentOption,
    clinicalCatalogGroupLabel,
    billingServiceTypeFromClinicalCatalogType,
    normalizeServiceCode,
    formatDateTime,
    formatMoney,
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
    catalogStatusDotClass as catalogStatusDotClassFn,
    metadataObject,
    metadataToFormText,
    parseMetadata,
} from '@/lib/billingServiceCatalog';
import type { AppIconName } from '@/lib/icons';
import { generateRequestKey } from '@/lib/idempotency';
import { INVENTORY_PROCUREMENT_STOCK_CONTROL_PATH } from '@/lib/inventoryProcurement';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import BillingServiceCatalogSyncDialog from '@/pages/billing/service-catalog/BillingServiceCatalogSyncDialog.vue';
import { type BreadcrumbItem } from '@/types';

const serviceTypeOptions = SERVICE_TYPE_OPTIONS;
const unitOptions = UNIT_OPTIONS;
const pharmacyUnitOptions = PHARMACY_UNIT_OPTIONS;
const facilityTierOptions = FACILITY_TIER_OPTIONS;
const clinicalCatalogSources = CLINICAL_CATALOG_SOURCES;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Billing Service Catalog', href: '/billing-service-catalog' },
];

const { permissionNames, permissionState, scope: platformScope, multiTenantIsolationEnabled } = usePlatformAccess();
const { activeCurrencyCode, loadCountryProfile } = usePlatformCountryProfile();

const permissionsResolved = computed(() => permissionNames.value !== null);
const canRead = computed(() => permissionState('billing.service-catalog.read') === 'allowed');
const canManageLegacy = computed(() => permissionState('billing.service-catalog.manage') === 'allowed');
const canManagePricing = computed(() => canManageLegacy.value || permissionState('billing.service-catalog.manage-pricing') === 'allowed');
const canViewAudit = computed(() => permissionState('billing.service-catalog.view-audit-logs') === 'allowed');
const canReadPayerContracts = computed(() => permissionState('billing.payer-contracts.read') === 'allowed');
const defaultCurrencyCode = computed(() => activeCurrencyCode.value || 'TZS');

const scope = computed<ScopeData | null>(() => (platformScope.value as ScopeData | null) ?? null);
const scopeUnresolved = computed(() => multiTenantIsolationEnabled.value && (scope.value?.resolvedFrom ?? 'none') === 'none');
const catalogReadOnly = computed(() => canRead.value && !canManagePricing.value);
const workspaceIntroText = computed(() => {
    const total = statusCounts.value.total;
    const base = `${total} billable service${total === 1 ? '' : 's'} in facility scope`;

    return catalogReadOnly.value
        ? `${base} · browse tariffs linked to clinical services and payer contracts`
        : `${base} · manage base prices, effective windows, and catalog versions`;
});

const pageLoading = ref(true);
const listLoading = ref(false);
const listError = ref<string | null>(null);
const items = ref<CatalogItem[]>([]);
const pagination = ref<Pagination | null>(null);
const statusCounts = ref<CatalogStatusCounts>({ active: 0, inactive: 0, retired: 0, other: 0, total: 0 });
const serviceTypeCounts = ref<ServiceTypeCounts>({ total: 0 });
const catalogExporting = ref(false);
const catalogPrinting = ref(false);

type AutoRefreshKey = 'off' | '30s' | '1m' | '5m';
const AUTO_REFRESH_INTERVAL_MS: Record<AutoRefreshKey, number> = { off: 0, '30s': 30_000, '1m': 60_000, '5m': 300_000 };
const AUTO_REFRESH_LABEL: Record<AutoRefreshKey, string> = { off: 'Auto: Off', '30s': 'Auto: 30s', '1m': 'Auto: 1m', '5m': 'Auto: 5m' };
const catalogAutoRefreshInterval = ref<AutoRefreshKey>('off');
let catalogAutoRefreshTimer: ReturnType<typeof setInterval> | null = null;
watch(catalogAutoRefreshInterval, (key) => {
    if (catalogAutoRefreshTimer !== null) {
        clearInterval(catalogAutoRefreshTimer);
        catalogAutoRefreshTimer = null;
    }
    const ms = AUTO_REFRESH_INTERVAL_MS[key];
    if (ms > 0) {
        catalogAutoRefreshTimer = setInterval(() => { void loadItems(); }, ms);
    }
});
const bulkStatusDialogOpen = ref(false);
const bulkStatusTarget = ref<CatalogStatus | null>(null);
const bulkStatusReason = ref('');
const bulkStatusBusy = ref(false);
const bulkStatusError = ref<string | null>(null);
const selectedItemIds = ref<string[]>([]);

const filters = reactive({
    q: '',
    serviceType: '',
    status: '',
    departmentId: '',
    currencyCode: '',
    lifecycle: '',
    sortBy: 'serviceName',
    sortDir: 'asc' as 'asc' | 'desc',
    perPage: 50,
    page: 1,
});

const createSheetOpen = ref(false);
const billingSyncDialogOpen = ref(false);

const createLoading = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createDiscardConfirmOpen = ref(false);
const createItemRequestKey = ref(generateRequestKey('billing-service-catalog-create'));
const createFamilyPreviewLoading = ref(false);
const createFamilyPreviewError = ref<string | null>(null);
const createFamilyPreviewItems = ref<CatalogItem[]>([]);
const clinicalCatalogLookupLoading = ref(false);
const clinicalCatalogLookupLoaded = ref(false);
const clinicalCatalogLookupError = ref<string | null>(null);
const clinicalCatalogLookupItems = ref<ClinicalCatalogLookupItem[]>([]);
const createClinicalCatalogTypeFilter = ref<ClinicalCatalogType | 'all'>('all');
const departmentsLoading = ref(false);
const departments = ref<Department[]>([]);
const createForm = reactive({
    identitySource: 'clinical' as CreateIdentitySource,
    clinicalCatalogItemId: '',
    serviceCode: '',
    serviceName: '',
    serviceType: '',
    departmentId: '',
    unit: '',
    basePrice: '',
    currencyCode: defaultCurrencyCode.value,
    taxRatePercent: '',
    isTaxable: 'false',
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
    priceUnit: '',
    unitsPerPack: '',
});

const detailsOpen = ref(false);
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

const catalogActiveFilterChips = computed(() => {
    const chips: string[] = [];

    if (filters.q.trim()) chips.push(`Search: ${filters.q.trim()}`);
    if (filters.serviceType.trim()) chips.push(`Type: ${formatEnumLabel(filters.serviceType.trim())}`);
    if (filters.status) chips.push(`Status: ${formatEnumLabel(filters.status)}`);
    if (filters.departmentId.trim()) chips.push(`Department: ${filterDepartmentSummary.value || filters.departmentId.trim()}`);
    if (filters.currencyCode.trim()) chips.push(`Currency: ${filters.currencyCode.trim().toUpperCase()}`);
    if (filters.lifecycle) {
        const lifecycleLabels: Record<string, string> = {
            effective: 'Effective now',
            scheduled: 'Scheduled',
            expired: 'Expired',
            no_window: 'No window',
        };
        chips.push(`Window: ${lifecycleLabels[filters.lifecycle] ?? filters.lifecycle}`);
    }
    if (filters.sortBy !== 'serviceName') chips.push(`Sort: ${formatEnumLabel(filters.sortBy)}`);
    if (filters.sortDir !== 'asc') chips.push('Descending');
    if (filters.perPage !== 50) chips.push(`${filters.perPage} per page`);

    return chips;
});

const catalogActiveFilterCount = computed(() => catalogActiveFilterChips.value.length);
const listFilterHintText = computed(() =>
    catalogActiveFilterCount.value > 0 ? `${catalogActiveFilterCount.value} filters applied` : 'Search by code, name, type, or department',
);

const canPrevPage = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNextPage = computed(() => {
    if (!pagination.value) return false;
    return pagination.value.currentPage < pagination.value.lastPage;
});
const pageItemIds = computed(() =>
    items.value.map((item) => String(item.id ?? '').trim()).filter((id) => id.length > 0),
);
const selectedCount = computed(() => selectedItemIds.value.length);
const allVisibleSelected = computed(() => (
    pageItemIds.value.length > 0 && pageItemIds.value.every((id) => selectedItemIds.value.includes(id))
));
const canUseBulkSelection = computed(() => canRead.value && canManagePricing.value);
const bulkStatusDialogTitle = computed(() => {
    if (bulkStatusTarget.value === 'retired') return 'Retire selected billable services';
    if (bulkStatusTarget.value === 'inactive') return 'Deactivate selected billable services';
    return 'Activate selected billable services';
});

const paginationPageNumbers = computed((): (number | '...')[] => {
    const total = pagination.value?.lastPage ?? 1;
    const current = pagination.value?.currentPage ?? 1;
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
        pages.push(page);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
});

const createTariffChecklist = computed(() => {
    const hasIdentity = createForm.serviceCode.trim() !== '' && createForm.serviceName.trim() !== '';
    const parsedBasePrice = parseDecimalOrNull(createForm.basePrice);
    const hasBaseTariff = parsedBasePrice !== null && parsedBasePrice !== 'invalid' && createForm.currencyCode.trim() !== '';
    const hasLifecyclePlan = createForm.effectiveFrom.trim() !== '' || createForm.effectiveTo.trim() !== '' || createForm.description.trim() !== '';

    return [
        {
            key: 'identity',
            label: 'Define service identity',
            helper: 'Stable code, name, and classification for downstream billing and clinical mappings.',
            complete: hasIdentity,
        },
        {
            key: 'tariff',
            label: 'Set base price',
            helper: 'Default price, currency, and tax posture for this service.',
            complete: hasBaseTariff,
        },
        {
            key: 'lifecycle',
            label: 'Plan lifecycle',
            helper: 'Effective window and notes so the price can start or stop cleanly.',
            complete: hasLifecyclePlan,
        },
    ];
});

function buildDepartmentOptions(preferredServiceType = ''): SearchableSelectOption[] {
    return buildDepartmentOptionsFromList(departments.value, preferredServiceType);
}

function resolvedClinicalCatalogServiceCode(item: ClinicalCatalogLookupItem | null): string {
    if (!item) return '';

    return normalizeServiceCode(item.billingServiceCode ?? '') || normalizeServiceCode(item.code ?? '');
}

function findClinicalCatalogLookupItem(value: string): ClinicalCatalogLookupItem | null {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) return null;

    return clinicalCatalogLookupItems.value.find((item) => String(item.id ?? '').trim().toLowerCase() === normalizedValue) ?? null;
}

const allDepartmentOptions = computed<SearchableSelectOption[]>(() => buildDepartmentOptions());
const createDepartmentOptions = computed<SearchableSelectOption[]>(() => buildDepartmentOptions(createForm.serviceType));
const filterDepartmentOptions = computed<SearchableSelectOption[]>(() => allDepartmentOptions.value);

const filterSelectedDepartmentOption = computed(() => findDepartmentOption(filterDepartmentOptions.value, filters.departmentId));

const createIdentitySourceTabsValue = computed({
    get: () => createForm.identitySource,
    set: (value: string) => {
        createForm.identitySource = value === 'standalone' ? 'standalone' : 'clinical';
    },
});
const createSelectedClinicalCatalogItem = computed(() => findClinicalCatalogLookupItem(createForm.clinicalCatalogItemId));
const createFilteredClinicalCatalogItems = computed(() => {
    if (createClinicalCatalogTypeFilter.value === 'all') {
        return clinicalCatalogLookupItems.value;
    }

    return clinicalCatalogLookupItems.value.filter((item) => item.catalogType === createClinicalCatalogTypeFilter.value);
});
const createClinicalCatalogItemOptions = computed<SearchableSelectOption[]>(() =>
    [...createFilteredClinicalCatalogItems.value]
        .sort((left, right) => {
            const leftGroup = clinicalCatalogGroupLabel(left.catalogType);
            const rightGroup = clinicalCatalogGroupLabel(right.catalogType);
            if (leftGroup !== rightGroup) return leftGroup.localeCompare(rightGroup);

            const leftLabel = `${left.name ?? ''} ${left.code ?? ''}`.trim();
            const rightLabel = `${right.name ?? ''} ${right.code ?? ''}`.trim();

            return leftLabel.localeCompare(rightLabel);
        })
        .map((item) => {
            const code = String(item.code ?? '').trim();
            const name = String(item.name ?? '').trim();
            const billingServiceCode = resolvedClinicalCatalogServiceCode(item);
            const linkedBillingItem = item.billingLink?.item;
            const linkSummary = linkedBillingItem
                ? `Already linked to tariff ${linkedBillingItem.serviceCode ?? billingServiceCode ?? 'NO-CODE'}`
                : billingServiceCode
                    ? `Billing code ${billingServiceCode}`
                    : 'Billing code will fall back to the clinical code';

            return {
                value: String(item.id ?? '').trim(),
                label: code ? `${code} - ${name || 'Unnamed item'}` : (name || 'Unnamed item'),
                description: [
                    linkSummary,
                    item.category ? formatEnumLabel(item.category) : null,
                    item.unit ? formatEnumLabel(item.unit) : null,
                ].filter((value): value is string => Boolean(value && value.trim())).join(' | '),
                keywords: [
                    code,
                    name,
                    billingServiceCode,
                    item.category ?? '',
                    item.unit ?? '',
                    clinicalCatalogGroupLabel(item.catalogType),
                ].filter((value) => value.trim().length > 0),
                group: clinicalCatalogGroupLabel(item.catalogType),
            } satisfies SearchableSelectOption;
        }),
);
const createClinicalCatalogHelperText = computed(() => {
    if (clinicalCatalogLookupLoading.value) return 'Loading active clinical definitions across lab, radiology, theatre, and formulary catalogs...';
    if (clinicalCatalogLookupError.value) return 'Clinical catalog lookup is unavailable right now. Use standalone mode only for true billing-only services.';
    if (!clinicalCatalogLookupItems.value.length) return 'No active clinical definitions are available yet. Add them in Clinical Catalog first.';
    if (!createFilteredClinicalCatalogItems.value.length) return `No active ${clinicalCatalogGroupLabel(createClinicalCatalogTypeFilter.value).toLowerCase()} definitions are available yet.`;
    return 'Select the existing clinical definition first. Service code and service name will be filled automatically from that record.';
});
const createClinicalCatalogEmptyText = computed(() => {
    if (clinicalCatalogLookupLoading.value) return 'Loading clinical definitions...';
    if (!clinicalCatalogLookupItems.value.length) return 'No active clinical definitions are available.';
    if (!createFilteredClinicalCatalogItems.value.length) return `No active ${clinicalCatalogGroupLabel(createClinicalCatalogTypeFilter.value).toLowerCase()} definitions are available.`;
    return 'No clinical definition matched this search.';
});
const createLinkedClinicalModeLocked = computed(() => (
    clinicalCatalogLookupLoaded.value
    && !clinicalCatalogLookupLoading.value
    && (clinicalCatalogLookupError.value !== null || clinicalCatalogLookupItems.value.length === 0)
));
const createClinicalFallbackCodeMessage = computed(() => {
    const item = createSelectedClinicalCatalogItem.value;
    if (!item) return null;
    if (normalizeServiceCode(item.billingServiceCode ?? '')) return null;

    const fallbackCode = normalizeServiceCode(item.code ?? '');
    if (!fallbackCode) return 'This clinical definition has no billing service code or clinical code yet. Set a code before saving a tariff.';

    return `This clinical definition does not have an explicit billing service code yet, so the tariff will use the clinical code ${fallbackCode}.`;
});
const createBasePriceHelperText = computed(() => {
    if (createForm.serviceType === 'pharmacy') {
        return 'For medicines, the actual price is determined by inventory unit prices. This base price is a fallback default.';
    }
    return null;
});
const createDepartmentHelperText = computed(() => {
    if (departmentsLoading.value) return 'Loading live department list...';
    if (!departments.value.length) return 'Department directory is currently unavailable. Refresh the page after department setup is confirmed.';
    if (createForm.serviceType.trim()) {
        return `Showing departments matched to ${formatEnumLabel(createForm.serviceType)} first.`;
    }

    return 'Search the hospital department list by code or name.';
});

const createDepartmentEmptyText = computed(() => {
    if (departmentsLoading.value) return 'Loading departments...';
    if (!departments.value.length) return 'No departments are available from the hospital directory.';
    return 'No departments matched this search.';
});

const filterDepartmentSummary = computed(() => filterSelectedDepartmentOption.value?.label ?? '');
const catalogShowInitialSkeleton = computed(() => pageLoading.value);
const catalogListRefreshing = computed(() => listLoading.value && !pageLoading.value);

const createServiceTypeSelectValue = computed({
    get: () => createForm.serviceType || '__none__',
    set: (value: string) => {
        createForm.serviceType = value === '__none__' ? '' : value;
    },
});

const createUnitSelectValue = computed({
    get: () => createForm.unit || '__none__',
    set: (value: string) => {
        createForm.unit = value === '__none__' ? '' : value;
    },
});

const createUnitOptions = computed(() => unitOptions);

const createTaxableSelectValue = computed({
    get: () => createForm.isTaxable || '__none__',
    set: (value: string) => {
        createForm.isTaxable = value === '__none__' ? '' : value;
    },
});

const createPriceUnitSelectValue = computed({
    get: () => createForm.priceUnit || '__none__',
    set: (value: string) => {
        createForm.priceUnit = value === '__none__' ? '' : value;
    },
});

const activeServiceTypeTab = computed(() => filters.serviceType || '__all__');

function setActiveServiceTypeTab(value: string): void {
    filters.serviceType = value === '__all__' ? '' : value;
    filters.page = 1;
    void loadItems();
}

const filterSortBySelectValue = computed(() => filters.sortBy);

const filterSortDirSelectValue = computed(() => filters.sortDir);

const filterPerPageSelectValue = computed(() => String(filters.perPage));


const createTariffReady = computed(() => (
    createTariffChecklist.value.every((step) => step.complete)
    && createTariffBlockers.value.length === 0
    && !(createFamilyPreviewLoading.value && createForm.serviceCode.trim() !== '')
));

const createFamilyPreviewPrimary = computed(() => createFamilyPreviewItems.value[0] ?? null);
const createFamilyAlreadyExists = computed(() => createFamilyPreviewItems.value.length > 0);
const createFamilyVersionCount = computed(() => createFamilyPreviewItems.value.length);

const createTariffIdentitySummary = computed(() => {
    const code = createForm.serviceCode.trim();
    const name = createForm.serviceName.trim();
    const selectedClinicalItem = createSelectedClinicalCatalogItem.value;

    if (createForm.identitySource === 'clinical' && selectedClinicalItem) {
        const sourceLabel = clinicalCatalogGroupLabel(selectedClinicalItem.catalogType);
        if (code && name) return `${sourceLabel} | ${code} | ${name}`;
    }
    if (!code && !name) return createForm.identitySource === 'clinical' ? 'No clinical definition selected' : 'No service identity drafted';
    if (code && name) return `${code} | ${name}`;

    return code || name;
});

const createTariffWindowValidationMessage = computed(() => windowRangeValidationMessage(createForm.effectiveFrom, createForm.effectiveTo));

const createTariffBlockers = computed(() => {
    const blockers: string[] = [];

    if (createForm.identitySource === 'clinical' && !createSelectedClinicalCatalogItem.value) {
        blockers.push(
            clinicalCatalogLookupError.value
                ? 'Clinical catalog lookup is unavailable. Restore catalog access or switch to standalone billing service for a true billing-only item.'
                : 'Select the clinical catalog item first so this tariff inherits the correct care definition.',
        );
    }

    if (createFamilyAlreadyExists.value) {
        blockers.push('This service code already exists in the current scope. Open the existing tariff family and create a new version instead of creating another base record.');
    }

    if (createTariffWindowValidationMessage.value) {
        blockers.push(createTariffWindowValidationMessage.value);
    }

    return blockers;
});

const hasPendingCreateCatalogWorkflow = computed(() => Boolean(
    createForm.identitySource !== 'clinical'
    || createForm.clinicalCatalogItemId.trim()
    || createForm.serviceCode.trim()
    || createForm.serviceName.trim()
    || createForm.serviceType.trim()
    || createForm.departmentId.trim()
    || createForm.unit.trim()
    || createForm.basePrice.trim()
    || createForm.currencyCode.trim().toUpperCase() !== defaultCurrencyCode.value.toUpperCase()
    || createForm.taxRatePercent.trim()
    || createForm.isTaxable !== 'false'
    || createForm.effectiveFrom.trim()
    || createForm.effectiveTo.trim()
    || createForm.description.trim()
    || createForm.facilityTier.trim()
    || createForm.standardsLocal.trim()
    || createForm.standardsNhif.trim()
    || createForm.standardsMsd.trim()
    || createForm.standardsLoinc.trim()
    || createForm.standardsSnomedCt.trim()
    || createForm.standardsCpt.trim()
    || createForm.standardsIcd.trim()
    || createForm.metadataText.trim() !== ''
));


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
    priceUnit: '',
    unitsPerPack: '',
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
const auditError = ref<string | null>(null);
const auditLogs = ref<CatalogAuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);
const auditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });

function firstError(errors: Record<string, string[]> | null | undefined, key: string): string | null {
    return errors?.[key]?.[0] ?? null;
}

function formatMoney(value: string | null, currencyCode: string | null): string {
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


function resetCreateCatalogForm(): void {
    createForm.identitySource = 'clinical';
    createForm.clinicalCatalogItemId = '';
    createClinicalCatalogTypeFilter.value = 'all';
    createForm.serviceCode = '';
    createForm.serviceName = '';
    createForm.serviceType = '';
    createForm.departmentId = '';
    createForm.unit = '';
    createForm.priceUnit = '';
    createForm.unitsPerPack = '';
    createForm.basePrice = '';
    createForm.currencyCode = defaultCurrencyCode.value;
    createForm.taxRatePercent = '';
    createForm.isTaxable = 'false';
    createForm.effectiveFrom = '';
    createForm.effectiveTo = '';
    createForm.description = '';
    createForm.facilityTier = '';
    applyStandardsCodesToForm(createForm, null);
    createForm.metadataText = '';
    clearCreateFamilyPreview();
    createErrors.value = {};
}

function rotateCreateItemRequestKey(): void {
    createItemRequestKey.value = generateRequestKey('billing-service-catalog-create');
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

function closeCreateSheet(): void {
    createSheetOpen.value = false;
    resetCreateCatalogForm();
    rotateCreateItemRequestKey();
}

function openCreateSheet(): void {
    if (!canManagePricing.value) return;
    resetCreateCatalogForm();
    if (createLinkedClinicalModeLocked.value) {
        createForm.identitySource = 'standalone';
    }
    rotateCreateItemRequestKey();
    createSheetOpen.value = true;
}

function requestCreateSheetOpenChange(open: boolean): void {
    if (open) {
        openCreateSheet();
        return;
    }

    if (createLoading.value) return;

    if (createSheetOpen.value && hasPendingCreateCatalogWorkflow.value) {
        createDiscardConfirmOpen.value = true;
        return;
    }

    closeCreateSheet();
}

function confirmCreateCatalogDiscard(): void {
    createDiscardConfirmOpen.value = false;
    closeCreateSheet();
}

function catalogStatusDotClass(item: CatalogItem): string {
    return catalogStatusDotClassFn(item);
}

function goToPage(page: number): void {
    filters.page = page;
    void loadItems();
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

function applyCurrencyDefaults(): void {
    const currencyCode = defaultCurrencyCode.value;

    if (!createForm.currencyCode.trim() || createForm.currencyCode.trim().toUpperCase() === 'TZS') {
        createForm.currencyCode = currencyCode;
    }

    if (!editForm.currencyCode.trim() || editForm.currencyCode.trim().toUpperCase() === 'TZS') {
        editForm.currencyCode = currencyCode;
    }
}

const createEffectiveFromDate = computed({
    get: () => datePartFromDateTimeInput(createForm.effectiveFrom),
    set: (value: string) => {
        createForm.effectiveFrom = mergeDateAndTimeInput(value, timePartFromDateTimeInput(createForm.effectiveFrom), '00:00');
    },
});

const createEffectiveFromTime = computed({
    get: () => timePartFromDateTimeInput(createForm.effectiveFrom),
    set: (value: string) => {
        createForm.effectiveFrom = mergeDateAndTimeInput(datePartFromDateTimeInput(createForm.effectiveFrom), value, '00:00');
    },
});

const createEffectiveToDate = computed({
    get: () => datePartFromDateTimeInput(createForm.effectiveTo),
    set: (value: string) => {
        createForm.effectiveTo = mergeDateAndTimeInput(value, timePartFromDateTimeInput(createForm.effectiveTo), '23:59');
    },
});

const createEffectiveToTime = computed({
    get: () => timePartFromDateTimeInput(createForm.effectiveTo),
    set: (value: string) => {
        createForm.effectiveTo = mergeDateAndTimeInput(datePartFromDateTimeInput(createForm.effectiveTo), value, '23:59');
    },
});


const hasPendingIdentityWorkflow = computed(() => {
    const item = selectedItem.value;
    if (!detailsOpen.value || !item) return false;

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
    if (!detailsOpen.value || !item) return false;

    return (
        editForm.basePrice.trim() !== String(item.basePrice ?? '').trim()
        || editForm.currencyCode.trim().toUpperCase() !== String(item.currencyCode ?? defaultCurrencyCode.value).trim().toUpperCase()
        || editForm.taxRatePercent.trim() !== String(item.taxRatePercent ?? '').trim()
        || editForm.isTaxable !== (item.isTaxable === null ? '' : (item.isTaxable ? 'true' : 'false'))
        || editForm.effectiveFrom.trim() !== toDateTimeInput(item.effectiveFrom)
        || editForm.effectiveTo.trim() !== toDateTimeInput(item.effectiveTo)
        || editForm.description.trim() !== String(item.description ?? '').trim()
        || editForm.priceUnit.trim() !== String(item.priceUnit ?? '').trim()
        || editForm.unitsPerPack.trim() !== String(item.unitsPerPack ?? '').trim()
        || !metadataValuesEqual(item.metadata, editForm.metadataText)
    );
});


const hasPendingRevisionWorkflow = computed(() => {
    const item = selectedItem.value;
    if (!detailsOpen.value || !item) return false;

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
    if (!detailsOpen.value || !item) return false;

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
    createLoading.value
    || identityLoading.value
    || pricingLoading.value
    || revisionLoading.value
    || statusLoading.value
));

const {
    confirmOpen: leaveConfirmOpen,
    confirmLeave: confirmPendingCatalogWorkflowLeave,
    cancelLeave: cancelPendingCatalogWorkflowLeave,
} = usePendingWorkflowLeaveGuard({
    shouldBlock: computed(() => (
        (createSheetOpen.value && hasPendingCreateCatalogWorkflow.value)
        || (detailsOpen.value && hasPendingCatalogDetailsWorkflow.value)
    )),
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
    editForm.priceUnit = item.priceUnit ?? '';
    editForm.unitsPerPack = item.unitsPerPack !== null ? String(item.unitsPerPack) : '';

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

let createFamilyPreviewRequestSequence = 0;
let createFamilyPreviewDebounceHandle: ReturnType<typeof setTimeout> | null = null;

function clearCreateFamilyPreview(): void {
    createFamilyPreviewError.value = null;
    createFamilyPreviewItems.value = [];
}

async function loadCreateFamilyPreview(serviceCode: string): Promise<void> {
    const normalizedServiceCode = normalizeServiceCode(serviceCode);
    if (!normalizedServiceCode) {
        clearCreateFamilyPreview();
        createFamilyPreviewLoading.value = false;
        return;
    }

    const requestSequence = ++createFamilyPreviewRequestSequence;
    createFamilyPreviewLoading.value = true;
    createFamilyPreviewError.value = null;

    try {
        const response = await apiRequest<CatalogListResponse>('GET', '/billing-service-catalog/items', {
            query: {
                q: normalizedServiceCode,
                perPage: 20,
                page: 1,
                sortBy: 'effectiveFrom',
                sortDir: 'desc',
            },
        });

        if (requestSequence !== createFamilyPreviewRequestSequence) {
            return;
        }

        createFamilyPreviewItems.value = (response.data ?? []).filter((item) => normalizeServiceCode(item.serviceCode ?? '') === normalizedServiceCode);
    } catch (error) {
        if (requestSequence !== createFamilyPreviewRequestSequence) {
            return;
        }

        createFamilyPreviewItems.value = [];
        createFamilyPreviewError.value = messageFromUnknown(error, 'Unable to check the existing tariff family.');
    } finally {
        if (requestSequence === createFamilyPreviewRequestSequence) {
            createFamilyPreviewLoading.value = false;
        }
    }
}

function openCreateFamilyPreview(): void {
    const candidate = createFamilyPreviewPrimary.value;
    if (!candidate) return;

    openDetails(candidate);
}

function applyCreateClinicalCatalogSelection(item: ClinicalCatalogLookupItem | null): void {
    if (!item) return;

    createForm.serviceCode = resolvedClinicalCatalogServiceCode(item);
    createForm.serviceName = String(item.name ?? '').trim();

    const recommendedServiceType = billingServiceTypeFromClinicalCatalogType(item.catalogType);
    if (recommendedServiceType) {
        createForm.serviceType = recommendedServiceType;
    }

    const departmentId = String(item.departmentId ?? '').trim();
    if (departmentId) {
        createForm.departmentId = departmentId;
    }

    const unit = String(item.unit ?? '').trim();
    if (unit) {
        createForm.unit = unit;
    }

    const meta = item.metadata ?? {};
    const priceUnit = String(meta.priceUnit ?? meta.price_unit ?? item.unit ?? '').trim();
    if (priceUnit) {
        createForm.priceUnit = priceUnit;
    }

    if (recommendedServiceType === 'pharmacy' && !createForm.basePrice.trim()) {
        createForm.basePrice = '0';
    }

    createForm.facilityTier = String(item.facilityTier ?? '').trim();
    applyStandardsCodesToForm(createForm, item.codes);

    if (!createForm.description.trim()) {
        createForm.description = String(item.description ?? '').trim();
    }
}

function clearCreateClinicalCatalogSelection(): void {
    createForm.clinicalCatalogItemId = '';

    if (createForm.identitySource === 'clinical') {
        createForm.serviceCode = '';
        createForm.serviceName = '';
        createForm.facilityTier = '';
        createForm.priceUnit = '';
        applyStandardsCodesToForm(createForm, null);
    }
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

async function loadClinicalCatalogLookupSource(source: (typeof clinicalCatalogSources)[number]): Promise<ClinicalCatalogLookupItem[]> {
    const results: ClinicalCatalogLookupItem[] = [];
    let page = 1;
    let lastPage = 1;

    do {
        const response = await apiRequest<ClinicalCatalogLookupListResponse>('GET', source.path, {
            query: {
                status: 'active',
                page,
                perPage: 100,
            },
        });

        results.push(...(response.data ?? []).map((item) => ({
            ...item,
            catalogType: item.catalogType ?? source.type,
        })));
        lastPage = Math.max(response.meta?.lastPage ?? 1, 1);
        page += 1;
    } while (page <= lastPage);

    return results;
}

async function loadClinicalCatalogLookupItems(): Promise<void> {
    if (clinicalCatalogLookupLoading.value) return;

    clinicalCatalogLookupLoading.value = true;
    clinicalCatalogLookupError.value = null;

    try {
        const responses = await Promise.all(
            clinicalCatalogSources.map((source) => loadClinicalCatalogLookupSource(source)),
        );

        clinicalCatalogLookupItems.value = responses.flat();
        clinicalCatalogLookupLoaded.value = true;
    } catch (error) {
        clinicalCatalogLookupItems.value = [];
        clinicalCatalogLookupError.value = messageFromUnknown(
            error,
            'Unable to load clinical catalog definitions for tariff creation.',
        );
    } finally {
        clinicalCatalogLookupLoading.value = false;
    }
}

async function loadStatusCounts(): Promise<void> {
    try {
        const response = await apiRequest<StatusCountResponse>('GET', '/billing-service-catalog/items/status-counts', {
            query: {
                q: filters.q.trim() || null,
                serviceType: filters.serviceType.trim() || null,
                departmentId: filters.departmentId.trim() || null,
                currencyCode: filters.currencyCode.trim().toUpperCase() || null,
                lifecycle: filters.lifecycle || null,
            },
        });

        statusCounts.value = response.data ?? { active: 0, inactive: 0, retired: 0, other: 0, total: 0 };
    } catch {
        statusCounts.value = { active: 0, inactive: 0, retired: 0, other: 0, total: 0 };
    }
}

async function loadServiceTypeCounts(): Promise<void> {
    try {
        const response = await apiRequest<ServiceTypeCountResponse>('GET', '/billing-service-catalog/items/service-type-counts', {
            query: {
                q: filters.q.trim() || null,
                departmentId: filters.departmentId.trim() || null,
                currencyCode: filters.currencyCode.trim().toUpperCase() || null,
                lifecycle: filters.lifecycle || null,
            },
        });

        serviceTypeCounts.value = response.data ?? { total: 0 };
    } catch {
        serviceTypeCounts.value = { total: 0 };
    }
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

async function loadItems(): Promise<void> {
    if (!canRead.value) {
        items.value = [];
        pagination.value = null;
        pageLoading.value = false;
        listLoading.value = false;
        return;
    }

    listLoading.value = true;
    listError.value = null;

    try {
        const [listResponse] = await Promise.all([
            apiRequest<CatalogListResponse>('GET', '/billing-service-catalog/items', {
                query: {
                    q: filters.q.trim() || null,
                    serviceType: filters.serviceType.trim() || null,
                    status: filters.status || null,
                    departmentId: filters.departmentId.trim() || null,
                    currencyCode: filters.currencyCode.trim().toUpperCase() || null,
                    lifecycle: filters.lifecycle || null,
                    sortBy: filters.sortBy,
                    sortDir: filters.sortDir,
                    perPage: filters.perPage,
                    page: filters.page,
                },
            }),
            loadStatusCounts(),
            loadServiceTypeCounts(),
        ]);

        items.value = listResponse.data ?? [];
        pagination.value = listResponse.meta ?? null;
    } catch (error) {
        listError.value = messageFromUnknown(error, 'Unable to load billing service catalog items.');
        items.value = [];
        pagination.value = null;
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}


function updateCatalogDepartmentFilter(value: string): void {
    filters.departmentId = value.trim();
    filters.page = 1;
    void loadItems();
}

function updateCatalogSortByFilter(value: string): void {
    filters.sortBy = value || 'serviceName';
    filters.page = 1;
    void loadItems();
}

function updateCatalogSortDirFilter(value: string): void {
    filters.sortDir = value === 'desc' ? 'desc' : 'asc';
    filters.page = 1;
    void loadItems();
}

function updateCatalogPerPageFilter(value: string): void {
    const parsed = Number.parseInt(value, 10);
    filters.perPage = Number.isFinite(parsed) ? parsed : 50;
    filters.page = 1;
    void loadItems();
}

function catalogExportQuery(): Record<string, string | number | null> {
    return {
        q: filters.q.trim() || null,
        serviceType: filters.serviceType.trim() || null,
        status: filters.status || null,
        departmentId: filters.departmentId.trim() || null,
        currencyCode: filters.currencyCode.trim().toUpperCase() || null,
        lifecycle: filters.lifecycle || null,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
    };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
}

async function exportCatalogItemsCsv(): Promise<void> {
    if (catalogExporting.value) return;

    catalogExporting.value = true;
    try {
        const { blob, filename } = await apiGetBlob('/billing-service-catalog/items/export', {
            query: catalogExportQuery(),
            entitlementContext: 'Billing service catalog export',
        });
        triggerBlobDownload(blob, filename ?? 'billing-service-catalog.csv');
        notifySuccess('Billable services exported.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export billable services.'));
    } finally {
        catalogExporting.value = false;
    }
}

async function loadFilteredCatalogItemsForPrint(): Promise<{ data: CatalogItem[]; total: number }> {
    const results: CatalogItem[] = [];
    let page = 1;
    let lastPage = 1;
    let total = 0;

    do {
        const response = await apiRequest<CatalogListResponse>('GET', '/billing-service-catalog/items', {
            query: {
                ...catalogExportQuery(),
                perPage: 100,
                page,
            },
        });

        results.push(...(response.data ?? []));
        total = response.meta?.total ?? results.length;
        lastPage = Math.max(response.meta?.lastPage ?? 1, 1);
        page += 1;
    } while (page <= lastPage);

    return { data: results, total };
}

function escapePrintHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function printCatalogItems(): Promise<void> {
    if (catalogPrinting.value) return;

    const title = 'Billable services';
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
        notifyError('Unable to open print preview.');
        return;
    }

    catalogPrinting.value = true;
    try {
        const printable = await loadFilteredCatalogItemsForPrint();
        const rows = printable.data.map((item) => `
            <tr>
                <td>${escapePrintHtml(item.serviceCode)}</td>
                <td>${escapePrintHtml(item.serviceName)}</td>
                <td>${escapePrintHtml(item.serviceType ? formatEnumLabel(item.serviceType) : '')}</td>
                <td>${escapePrintHtml(item.department)}</td>
                <td>${escapePrintHtml(formatMoney(item.basePrice, item.currencyCode))}</td>
                <td>${escapePrintHtml(formatEnumLabel(item.status))}</td>
                <td>${escapePrintHtml(tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo))}</td>
            </tr>
        `).join('');

        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <title>${escapePrintHtml(title)}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
                        h1 { font-size: 20px; margin: 0 0 4px; }
                        p { margin: 0 0 16px; color: #4b5563; font-size: 12px; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
                        th { background: #f3f4f6; font-weight: 700; }
                        @media print { body { margin: 12mm; } }
                    </style>
                </head>
                <body>
                    <h1>${escapePrintHtml(title)}</h1>
                    <p>Filtered records: ${escapePrintHtml(printable.total)}. Printed ${escapePrintHtml(new Date().toLocaleString())}.</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Service code</th>
                                <th>Service name</th>
                                <th>Type</th>
                                <th>Department</th>
                                <th>Price</th>
                                <th>Status</th>
                                <th>Window</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="7">No records match the current filters.</td></tr>'}</tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    } catch (error) {
        printWindow.close();
        notifyError(messageFromUnknown(error, 'Unable to print filtered billable services.'));
    } finally {
        catalogPrinting.value = false;
    }
}

function clearSelectedItems(): void {
    selectedItemIds.value = [];
}

function toggleItemSelection(itemId: string, checked: CheckboxCheckedState): void {
    const normalizedId = itemId.trim();
    if (!normalizedId) {
        return;
    }

    if (checked === true) {
        if (!selectedItemIds.value.includes(normalizedId)) {
            selectedItemIds.value = [...selectedItemIds.value, normalizedId];
        }
        return;
    }

    selectedItemIds.value = selectedItemIds.value.filter((id) => id !== normalizedId);
}

function toggleSelectAllVisible(checked: CheckboxCheckedState): void {
    const visible = new Set(pageItemIds.value);
    if (checked !== true) {
        selectedItemIds.value = selectedItemIds.value.filter((id) => !visible.has(id));
        return;
    }

    selectedItemIds.value = Array.from(new Set([...selectedItemIds.value, ...pageItemIds.value]));
}

function openBulkStatusDialog(status: CatalogStatus): void {
    if (!canUseBulkSelection.value || selectedCount.value === 0) {
        return;
    }

    bulkStatusTarget.value = status;
    bulkStatusReason.value = '';
    bulkStatusError.value = null;
    bulkStatusDialogOpen.value = true;
}

async function submitBulkStatusDialog(): Promise<void> {
    if (!canUseBulkSelection.value || !bulkStatusTarget.value || selectedCount.value === 0 || bulkStatusBusy.value) {
        return;
    }

    bulkStatusBusy.value = true;
    bulkStatusError.value = null;
    try {
        const response = await apiRequest<{ data: CatalogItem[]; meta: { updated: number; notFound: string[] } }>(
            'PATCH',
            '/billing-service-catalog/items/bulk-status',
            {
                body: {
                    itemIds: selectedItemIds.value,
                    status: bulkStatusTarget.value,
                    reason: bulkStatusReason.value.trim() || null,
                },
                entitlementContext: 'Billing service catalog bulk status',
            },
        );

        notifySuccess(`Updated ${response.meta.updated} billable service${response.meta.updated === 1 ? '' : 's'}.`);
        selectedItemIds.value = [];
        bulkStatusDialogOpen.value = false;
        await Promise.all([loadItems(), loadStatusCounts(), loadServiceTypeCounts()]);
    } catch (error) {
        bulkStatusError.value = messageFromUnknown(error, 'Unable to apply bulk status change.');
        notifyError(bulkStatusError.value);
    } finally {
        bulkStatusBusy.value = false;
    }
}

function resetFilters(): void {
    filters.q = '';
    filters.serviceType = '';
    filters.status = '';
    filters.departmentId = '';
    filters.currencyCode = '';
    filters.lifecycle = '';
    filters.sortBy = 'serviceName';
    filters.sortDir = 'asc';
    filters.perPage = 50;
    filters.page = 1;
    void loadItems();
}

function prevPage(): void {
    if ((pagination.value?.currentPage ?? 1) <= 1) return;
    filters.page -= 1;
    void loadItems();
}

function nextPage(): void {
    if (!pagination.value || pagination.value.currentPage >= pagination.value.lastPage) return;
    filters.page += 1;
    void loadItems();
}

async function createItem(): Promise<void> {
    if (!canManagePricing.value || createLoading.value) return;

    createLoading.value = true;
    createErrors.value = {};

    const basePrice = parseDecimalOrNull(createForm.basePrice);
    const taxRatePercent = parseDecimalOrNull(createForm.taxRatePercent);
    const unitsPerPack = createForm.unitsPerPack.trim() ? Number.parseInt(createForm.unitsPerPack.trim(), 10) : null;
    const metadata = parseMetadata(createForm.metadataText);

    const localErrors: Record<string, string[]> = {};
    if (createForm.identitySource === 'clinical' && !createForm.clinicalCatalogItemId.trim()) {
        localErrors.clinicalCatalogItemId = ['Select the clinical catalog item that this tariff belongs to.'];
    }
    if (!createForm.serviceCode.trim()) localErrors.serviceCode = ['Service code is required.'];
    if (!createForm.serviceName.trim()) localErrors.serviceName = ['Service name is required.'];
    if (basePrice === null || basePrice === 'invalid') localErrors.basePrice = ['Base price must be a valid non-negative number.'];
    if (!createForm.currencyCode.trim()) localErrors.currencyCode = ['Currency code is required.'];
    if (taxRatePercent === 'invalid') localErrors.taxRatePercent = ['Tax rate must be a valid non-negative number.'];
    if (unitsPerPack !== null && (Number.isNaN(unitsPerPack) || unitsPerPack < 1)) localErrors.unitsPerPack = ['Units per pack must be a positive whole number.'];
    if (metadata === 'invalid') localErrors.metadata = ['System integration notes must be a valid JSON object.'];
    if (createFamilyAlreadyExists.value) localErrors.serviceCode = ['Service code already exists in the current scope. Open the existing tariff family and create a new version instead.'];
    if (createTariffWindowValidationMessage.value) localErrors.effectiveTo = [createTariffWindowValidationMessage.value];

    if (Object.keys(localErrors).length > 0) {
        createErrors.value = localErrors;
        createLoading.value = false;
        return;
    }

    try {
        const requestKey = createItemRequestKey.value;
        await apiRequest<CatalogResponse>('POST', '/billing-service-catalog/items', {
            body: {
                clinicalCatalogItemId: createForm.identitySource === 'clinical'
                    ? (createForm.clinicalCatalogItemId.trim() || null)
                    : null,
                serviceCode: createForm.serviceCode.trim(),
                serviceName: createForm.serviceName.trim(),
                serviceType: createForm.serviceType.trim() || null,
                departmentId: createForm.departmentId.trim() || null,
                unit: createForm.unit.trim() || null,
                basePrice,
                currencyCode: createForm.currencyCode.trim().toUpperCase(),
                taxRatePercent,
                isTaxable: parseBoolean(createForm.isTaxable),
                effectiveFrom: toApiDateTime(createForm.effectiveFrom),
                effectiveTo: toApiDateTime(createForm.effectiveTo),
                description: createForm.description.trim() || null,
                facilityTier: createForm.facilityTier.trim() || null,
                codes: standardsCodesFromForm(createForm),
                priceUnit: createForm.priceUnit.trim() || null,
                unitsPerPack: unitsPerPack && !Number.isNaN(unitsPerPack) ? unitsPerPack : null,
                metadata,
            },
            entitlementContext: 'Billing service catalog create',
            idempotencyKey: requestKey,
            requestId: requestKey,
        });

        closeCreateSheet();
        notifySuccess('Service catalog item created.');
        await loadItems();
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(error, 'Unable to create service catalog item.'));
        }
    } finally {
        createLoading.value = false;
    }
}
async function loadDetails(id: string): Promise<void> {
    detailsLoading.value = true;
    detailsError.value = null;

    try {
        const response = await apiRequest<CatalogResponse>('GET', `/billing-service-catalog/items/${id}`);
        selectedItem.value = response.data;
        hydrateEditForm(response.data);
        hydrateRevisionForm(response.data);
    } catch (error) {
        detailsError.value = messageFromUnknown(error, 'Unable to load service catalog item details.');
    } finally {
        detailsLoading.value = false;
    }

    void loadVersionHistory(id);
    void loadPayerImpact(id);

    if (canViewAudit.value) {
        void loadAuditLogs(1);
    }
}

function openDetails(item: CatalogItem): void {
    const itemId = String(item.id ?? '').trim();
    if (!itemId) return;

    detailsOpen.value = true;
    detailsTab.value = 'overview';
    detailsError.value = null;
    identityErrors.value = {};
    pricingErrors.value = {};
    revisionErrors.value = {};
    statusErrors.value = {};
    resetDetailsSecondaryData();
    seedDetailsWorkspace(item);
    rotateIdentityRequestKey();
    rotatePricingRequestKey();
    rotateRevisionRequestKey();
    rotateStatusRequestKey();

    void loadDetails(itemId);
}

function closeDetails(): void {
    detailsOpen.value = false;
    selectedItem.value = null;
    versionHistory.value = [];
    payerImpactSummary.value = null;
    payerImpactError.value = null;
    rotateIdentityRequestKey();
    rotatePricingRequestKey();
    rotateRevisionRequestKey();
    rotateStatusRequestKey();
}

function requestDetailsOpenChange(open: boolean): void {
    if (open) {
        detailsOpen.value = true;
        return;
    }

    if (identityLoading.value || pricingLoading.value || revisionLoading.value || statusLoading.value) return;

    if (hasPendingCatalogDetailsWorkflow.value) {
        detailsDiscardConfirmOpen.value = true;
        return;
    }

    closeDetails();
}

function confirmDetailsDiscard(): void {
    detailsDiscardConfirmOpen.value = false;
    closeDetails();
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


onMounted(async () => {
    await loadCountryProfile();
    applyCurrencyDefaults();
    await Promise.all([loadItems(), loadDepartments(), loadClinicalCatalogLookupItems()]);
});

watch(
    () => [createSheetOpen.value, normalizeServiceCode(createForm.serviceCode)] as const,
    ([sheetOpen, serviceCode]) => {
        if (createFamilyPreviewDebounceHandle !== null) {
            clearTimeout(createFamilyPreviewDebounceHandle);
            createFamilyPreviewDebounceHandle = null;
        }

        if (!sheetOpen || !serviceCode) {
            clearCreateFamilyPreview();
            createFamilyPreviewLoading.value = false;
            return;
        }

        createFamilyPreviewDebounceHandle = setTimeout(() => {
            void loadCreateFamilyPreview(serviceCode);
        }, 250);
    },
);

watch(
    () => createForm.clinicalCatalogItemId,
    (value) => {
        if (!value.trim()) return;

        const selectedItem = findClinicalCatalogLookupItem(value);
        if (!selectedItem) return;

        applyCreateClinicalCatalogSelection(selectedItem);
    },
);

watch(
    createClinicalCatalogTypeFilter,
    (catalogType) => {
        const selectedItem = createSelectedClinicalCatalogItem.value;
        if (!selectedItem || catalogType === 'all' || selectedItem.catalogType === catalogType) return;

        clearCreateClinicalCatalogSelection();
    },
);

watch(
    () => [createSheetOpen.value, createForm.identitySource] as const,
    ([sheetOpen, identitySource]) => {
        if (
            sheetOpen
            && identitySource === 'clinical'
            && !clinicalCatalogLookupLoaded.value
            && !clinicalCatalogLookupLoading.value
        ) {
            void loadClinicalCatalogLookupItems();
        }

        if (identitySource === 'clinical' && createSelectedClinicalCatalogItem.value) {
            applyCreateClinicalCatalogSelection(createSelectedClinicalCatalogItem.value);
        }
    },
);

watch(
    () => editForm.serviceType,
    (serviceType) => {
        if (serviceType !== 'pharmacy') {
            editForm.priceUnit = '';
            editForm.unitsPerPack = '';
        }
        if (!serviceType) {
            editForm.unit = '';
        }
    },
);

watch(
    createLinkedClinicalModeLocked,
    (locked) => {
        if (locked && createForm.identitySource === 'clinical') {
            createForm.identitySource = 'standalone';
        }
    },
    { immediate: true },
);

watch(
    () => createForm.serviceType,
    (serviceType) => {
        if (serviceType !== 'pharmacy') {
            createForm.priceUnit = '';
            createForm.unitsPerPack = '';
        }
        if (!serviceType) {
            createForm.unit = '';
        }
    },
);

let searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

watch(
    () => filters.q,
    () => {
        if (searchDebounceHandle !== null) {
            clearTimeout(searchDebounceHandle);
        }
        searchDebounceHandle = setTimeout(() => {
            filters.page = 1;
            void loadItems();
        }, 300);
    },
);

onBeforeUnmount(() => {
    if (catalogAutoRefreshTimer !== null) {
        clearInterval(catalogAutoRefreshTimer);
        catalogAutoRefreshTimer = null;
    }
});
</script>
<template>
    <Head title="Billing Service Catalog" />

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
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">Billing Service Catalog</h1>
                                <Badge
                                    v-if="catalogReadOnly"
                                    variant="outline"
                                    class="h-5 px-1.5 text-[10px] font-medium"
                                >
                                    View only
                                </Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">{{ workspaceIntroText }}</p>
                            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">{{ platformScope?.facility?.name || 'No facility' }}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            class="h-8 w-8 p-0"
                            :disabled="listLoading"
                            title="Refresh"
                            @click="loadItems()"
                        >
                            <AppIcon :name="(listLoading ? 'loader-circle' : 'refresh-cw') as AppIconName" class="size-3.5" :class="listLoading ? 'animate-spin' : ''" />
                        </Button>
                        <Select v-model="catalogAutoRefreshInterval">
                            <SelectTrigger class="h-8 w-[8rem] rounded-lg text-xs data-[size=default]:h-8" :title="catalogAutoRefreshInterval !== 'off' ? `Auto-refresh every ${catalogAutoRefreshInterval}` : 'Auto-refresh off'">
                                <SelectValue placeholder="Auto" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem v-for="[key, label] in Object.entries(AUTO_REFRESH_LABEL)" :key="key" :value="key">{{ label }}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button v-if="canManagePricing" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                            <AppIcon name="plus" class="size-3.5" />
                            Add service price
                        </Button>
                        <Button v-if="canManagePricing" size="sm" variant="outline" class="h-8 gap-1.5" @click="billingSyncDialogOpen = true">
                            <AppIcon name="book-open" class="size-3.5" />
                            Sync from Clinical Catalog
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                                    <AppIcon name="ellipsis-vertical" class="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" class="w-48">
                                <DropdownMenuItem as-child>
                                    <Link href="/platform/admin/clinical-catalogs" class="gap-2">
                                        <AppIcon name="book-open" class="size-4" />
                                        Clinical catalogs
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link :href="INVENTORY_PROCUREMENT_STOCK_CONTROL_PATH" class="gap-2">
                                        <AppIcon name="package" class="size-4" />
                                        Inventory items
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem as-child>
                                    <Link href="/billing-payer-contracts" class="gap-2">
                                        <AppIcon name="shield-check" class="size-4" />
                                        Payer contracts
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
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

                            <Alert v-else-if="!canRead" variant="destructive">
                                <AlertTitle class="flex items-center gap-2">
                                    <AppIcon name="alert-triangle" class="size-4" />
                                    Access denied
                                </AlertTitle>
                <AlertDescription>
                    You do not have `billing.service-catalog.read`, so this page cannot load the price list.
                </AlertDescription>
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

            <Sheet v-if="canManagePricing" :open="createSheetOpen" @update:open="requestCreateSheetOpenChange">
                <SheetContent
                    side="right"
                    variant="workspace"
                    size="4xl"
                    class="flex h-full min-h-0 flex-col"
                >
                    <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left sm:px-5">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="plus" class="size-5 text-muted-foreground" />
                            Add service price
                        </SheetTitle>
                        <SheetDescription>
                            Link a clinical service or enter a standalone code, then set the hospital base price and effective window.
                        </SheetDescription>
                        <div class="mt-2 flex flex-wrap items-center gap-2">
                            <Badge :variant="createTariffReady ? 'secondary' : 'outline'">
                                {{ createTariffReady ? 'Ready to save' : 'Incomplete' }}
                            </Badge>
                            <Badge v-if="createForm.serviceCode.trim()" variant="outline" class="max-w-full truncate font-normal">
                                {{ createTariffIdentitySummary }}
                            </Badge>
                            <Badge
                                v-if="createForm.serviceCode.trim()"
                                :variant="createFamilyAlreadyExists ? 'destructive' : 'outline'"
                                class="font-normal"
                            >
                                {{
                                    createFamilyPreviewLoading
                                        ? 'Checking code'
                                        : createFamilyAlreadyExists
                                            ? 'Family exists'
                                            : 'New family'
                                }}
                            </Badge>
                        </div>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="grid gap-4 px-6 py-4">
                            <Alert
                                v-if="createLinkedClinicalModeLocked"
                                variant="default"
                                class="border-amber-500/30 bg-amber-500/10"
                            >
                                <AlertTitle class="text-amber-900 dark:text-amber-200">Clinical catalog unavailable</AlertTitle>
                                <AlertDescription class="text-xs text-amber-800 dark:text-amber-300">
                                    Add care definitions in Clinical Catalog first, or switch to standalone for billing-only services.
                                </AlertDescription>
                            </Alert>

                            <fieldset class="grid gap-3 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">Source</legend>
                                <Tabs v-model="createIdentitySourceTabsValue" class="space-y-3">
                                    <TabsList class="grid h-9 w-full grid-cols-2">
                                        <TabsTrigger value="clinical" :disabled="createLinkedClinicalModeLocked" class="text-xs sm:text-sm">
                                            Clinical catalog
                                        </TabsTrigger>
                                        <TabsTrigger value="standalone" class="text-xs sm:text-sm">Standalone</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="clinical" class="mt-0 space-y-3">
                                        <div class="grid gap-1.5">
                                            <Label for="create-price-clinical-catalog-type">Catalog type</Label>
                                            <Select v-model="createClinicalCatalogTypeFilter">
                                                <SelectTrigger id="create-price-clinical-catalog-type" class="w-full">
                                                    <SelectValue placeholder="All catalogs" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All catalogs</SelectItem>
                                                    <SelectItem
                                                        v-for="source in clinicalCatalogSources"
                                                        :key="source.type"
                                                        :value="source.type"
                                                    >
                                                        {{ source.label }}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <ComboboxField
                                            input-id="create-price-clinical-catalog-item"
                                            label="Clinical definition"
                                            required
                                            v-model="createForm.clinicalCatalogItemId"
                                            :options="createClinicalCatalogItemOptions"
                                            placeholder="Lab, radiology, theatre, or formulary item"
                                            search-placeholder="Search code, name, or billing code"
                                            :helper-text="createClinicalCatalogHelperText"
                                            :error-message="firstError(createErrors, 'clinicalCatalogItemId')"
                                            :empty-text="createClinicalCatalogEmptyText"
                                        />
                                        <div
                                            v-if="clinicalCatalogLookupError"
                                            class="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <p class="text-destructive">{{ clinicalCatalogLookupError }}</p>
                                            <Button size="sm" variant="outline" @click="loadClinicalCatalogLookupItems">Retry</Button>
                                        </div>
                                        <div
                                            v-else-if="createSelectedClinicalCatalogItem"
                                            class="flex items-start justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                                        >
                                            <div class="min-w-0 space-y-0.5">
                                                <p class="truncate text-sm font-medium">
                                                    {{ createSelectedClinicalCatalogItem.name || 'Unnamed definition' }}
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ createSelectedClinicalCatalogItem.code || 'No code' }}
                                                    <span class="text-border"> · </span>
                                                    {{ clinicalCatalogGroupLabel(createSelectedClinicalCatalogItem.catalogType) }}
                                                    <span v-if="resolvedClinicalCatalogServiceCode(createSelectedClinicalCatalogItem)">
                                                        <span class="text-border"> · </span>
                                                        Billing {{ resolvedClinicalCatalogServiceCode(createSelectedClinicalCatalogItem) }}
                                                    </span>
                                                </p>
                                                <p v-if="createClinicalFallbackCodeMessage" class="text-xs text-amber-700 dark:text-amber-300">
                                                    {{ createClinicalFallbackCodeMessage }}
                                                </p>
                                            </div>
                                            <Button size="sm" variant="ghost" class="shrink-0" @click="clearCreateClinicalCatalogSelection">
                                                Clear
                                            </Button>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="standalone" class="mt-0">
                                        <p class="text-xs text-muted-foreground">
                                            For consultations, admissions, and other charges without a clinical catalog definition.
                                        </p>
                                    </TabsContent>
                                </Tabs>

                                <div class="space-y-4 border-t border-border/60 pt-4">
                                        <div class="space-y-3">
                                            <div class="flex items-center gap-2">
                                                <p class="text-xs font-medium text-muted-foreground">Service</p>
                                                <CatalogLinkBadge
                                                    v-if="createForm.identitySource === 'clinical' && createSelectedClinicalCatalogItem"
                                                    source="clinical_catalog"
                                                    :catalog-type="createSelectedClinicalCatalogItem.catalogType"
                                                    :catalog-name="createSelectedClinicalCatalogItem.name"
                                                    :catalog-code="createSelectedClinicalCatalogItem.code"
                                                />
                                            </div>
                                        <div class="grid grid-cols-6 gap-3">
                                            <FormFieldShell
                                                input-id="create-price-service-code"
                                                label="Service code"
                                                required
                                                container-class="col-span-6 sm:col-span-2"
                                                :helper-text="createForm.identitySource === 'clinical' ? 'From clinical definition.' : 'One stable code per service family.'"
                                                :error-message="firstError(createErrors, 'serviceCode')"
                                            >
                                                <Input
                                                    id="create-price-service-code"
                                                    v-model="createForm.serviceCode"
                                                    placeholder="CONSULT-OPD-001"
                                                    :disabled="createForm.identitySource === 'clinical'"
                                                />
                                            </FormFieldShell>
                                            <FormFieldShell
                                                input-id="create-price-service-name"
                                                label="Service name"
                                                required
                                                container-class="col-span-6 sm:col-span-2"
                                                :helper-text="createForm.identitySource === 'clinical' ? 'From clinical definition.' : 'Name on bills and reports.'"
                                                :error-message="firstError(createErrors, 'serviceName')"
                                            >
                                                <Input
                                                    id="create-price-service-name"
                                                    v-model="createForm.serviceName"
                                                    placeholder="OPD Consultation"
                                                    :disabled="createForm.identitySource === 'clinical'"
                                                />
                                            </FormFieldShell>
                                            <FormFieldShell
                                                input-id="create-price-service-type"
                                                label="Service type"
                                                container-class="col-span-6 sm:col-span-2"
                                            >
                                                <Select v-model="createServiceTypeSelectValue">
                                                    <SelectTrigger id="create-price-service-type" class="w-full">
                                                        <SelectValue placeholder="Select service type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">No service type yet</SelectItem>
                                                        <SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">
                                                            {{ formatEnumLabel(option) }}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                            <ComboboxField
                                                input-id="create-price-department"
                                                label="Department"
                                                v-model="createForm.departmentId"
                                                :options="createDepartmentOptions"
                                                container-class="col-span-6 sm:col-span-3"
                                                placeholder="Select department"
                                                search-placeholder="Search department code or name"
                                                :helper-text="createDepartmentHelperText"
                                                :error-message="firstError(createErrors, 'departmentId')"
                                                :empty-text="createDepartmentEmptyText"
                                            />
                                            <FormFieldShell
                                                input-id="create-price-unit"
                                                label="Billing unit"
                                                container-class="col-span-6 sm:col-span-3"
                                            >
                                                <Select v-model="createUnitSelectValue">
                                                    <SelectTrigger id="create-price-unit" class="w-full">
                                                        <SelectValue placeholder="Select billing unit" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">No billing unit yet</SelectItem>
                                                        <SelectItem v-for="option in createUnitOptions" :key="option" :value="option">
                                                            {{ formatEnumLabel(option) }}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                            <FormFieldShell
                                                input-id="create-price-pharmacy-unit"
                                                label="Pharmacy unit"
                                                v-if="createForm.serviceType === 'pharmacy'"
                                                container-class="col-span-6 sm:col-span-3"
                                            >
                                                <Select v-model="createPriceUnitSelectValue">
                                                    <SelectTrigger id="create-price-pharmacy-unit" class="w-full">
                                                        <SelectValue placeholder="Select unit" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">No pharmacy unit</SelectItem>
                                                        <SelectItem v-for="option in pharmacyUnitOptions" :key="option" :value="option">
                                                            {{ formatEnumLabel(option) }}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                            <FormFieldShell
                                                input-id="create-price-units-per-pack"
                                                label="Units per pack"
                                                v-if="createForm.serviceType === 'pharmacy'"
                                                container-class="col-span-6 sm:col-span-3"
                                                :error-message="firstError(createErrors, 'unitsPerPack')"
                                            >
                                                <Input
                                                    id="create-price-units-per-pack"
                                                    v-model="createForm.unitsPerPack"
                                                    inputmode="numeric"
                                                    placeholder="e.g. 30"
                                                />
                                            </FormFieldShell>
                                        </div>

                                        <Alert v-if="createFamilyPreviewError" variant="destructive" class="text-sm">
                                            <AlertDescription>{{ createFamilyPreviewError }}</AlertDescription>
                                        </Alert>
                                        <div
                                            v-else-if="createFamilyPreviewLoading && createForm.serviceCode.trim()"
                                            class="flex items-center gap-2 text-xs text-muted-foreground"
                                        >
                                            <AppIcon name="loader-circle" class="size-3.5 animate-spin" />
                                            Checking whether this service code already has a tariff family…
                                        </div>
                                        <Alert v-else-if="createFamilyAlreadyExists" variant="destructive">
                                            <AlertTitle>Service code already in use</AlertTitle>
                                            <AlertDescription class="space-y-2 text-xs">
                                                <p>
                                                    {{ createFamilyPreviewPrimary?.serviceName || 'Unnamed service' }} already has
                                                    {{ createFamilyVersionCount }} version{{ createFamilyVersionCount === 1 ? '' : 's' }}.
                                                    Create a new version instead of another base record.
                                                </p>
                                                <Button size="sm" variant="outline" class="h-8" @click="openCreateFamilyPreview">
                                                    Open existing family
                                                </Button>
                                            </AlertDescription>
                                        </Alert>
                                    </div>

                                    <div class="space-y-3">
                                        <p class="text-xs font-medium text-muted-foreground">Base price</p>
                                        <div class="grid grid-cols-6 gap-3">
                                            <FormFieldShell
                                                input-id="create-price-base-price"
                                                label="Amount"
                                                required
                                                container-class="col-span-6 sm:col-span-3"
                                                :helper-text="createBasePriceHelperText"
                                                :error-message="firstError(createErrors, 'basePrice')"
                                            >
                                                <Input
                                                    id="create-price-base-price"
                                                    v-model="createForm.basePrice"
                                                    inputmode="decimal"
                                                    placeholder="25000"
                                                />
                                            </FormFieldShell>
                                            <FormFieldShell
                                                input-id="create-price-currency"
                                                label="Currency"
                                                required
                                                container-class="col-span-6 sm:col-span-3"
                                                :error-message="firstError(createErrors, 'currencyCode')"
                                            >
                                                <Input id="create-price-currency" v-model="createForm.currencyCode" maxlength="3" />
                                            </FormFieldShell>
                                            <FormFieldShell
                                                input-id="create-price-tax-rate"
                                                label="Tax rate %"
                                                container-class="col-span-6 sm:col-span-3"
                                                :error-message="firstError(createErrors, 'taxRatePercent')"
                                            >
                                                <Input
                                                    id="create-price-tax-rate"
                                                    v-model="createForm.taxRatePercent"
                                                    inputmode="decimal"
                                                    placeholder="0"
                                                />
                                            </FormFieldShell>
                                            <FormFieldShell
                                                input-id="create-price-taxable"
                                                label="Taxable"
                                                container-class="col-span-6 sm:col-span-3"
                                            >
                                                <Select v-model="createTaxableSelectValue">
                                                    <SelectTrigger id="create-price-taxable" class="w-full">
                                                        <SelectValue placeholder="Tax posture" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">Not set</SelectItem>
                                                        <SelectItem value="true">Yes</SelectItem>
                                                        <SelectItem value="false">No</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormFieldShell>
                                        </div>
                                    </div>

                                    <div class="space-y-3">
                                        <p class="text-xs font-medium text-muted-foreground">Effective window</p>
                                        <div class="grid grid-cols-6 gap-3">
                                            <div class="col-span-6 sm:col-span-3">
                                                <SingleDatePopoverField
                                                    input-id="create-price-effective-from-date"
                                                    label="Start date"
                                                    v-model="createEffectiveFromDate"
                                                    :error-message="firstError(createErrors, 'effectiveFrom')"
                                                />
                                            </div>
                                            <div class="col-span-6 sm:col-span-3">
                                                <TimePopoverField
                                                    input-id="create-price-effective-from-time"
                                                    label="Start time"
                                                    v-model="createEffectiveFromTime"
                                                    :disabled="!createEffectiveFromDate"
                                                />
                                            </div>
                                            <div class="col-span-6 sm:col-span-3">
                                                <SingleDatePopoverField
                                                    input-id="create-price-effective-to-date"
                                                    label="End date"
                                                    v-model="createEffectiveToDate"
                                                    helper-text="Leave blank for open-ended."
                                                    :error-message="firstError(createErrors, 'effectiveTo')"
                                                />
                                            </div>
                                            <div class="col-span-6 sm:col-span-3">
                                                <TimePopoverField
                                                    input-id="create-price-effective-to-time"
                                                    label="End time"
                                                    v-model="createEffectiveToTime"
                                                    :disabled="!createEffectiveToDate"
                                                />
                                            </div>
                                            <FormFieldShell
                                                input-id="create-price-description"
                                                label="Notes (optional)"
                                                container-class="col-span-6"
                                            >
                                                <Textarea
                                                    id="create-price-description"
                                                    v-model="createForm.description"
                                                    class="min-h-20"
                                                    placeholder="Registration or audit context"
                                                />
                                            </FormFieldShell>
                                            <div class="col-span-6">
                                                <details class="group">
                                                    <summary class="cursor-pointer text-sm font-medium">System integration notes (technical)</summary>
                                                    <p class="mt-2 text-xs text-muted-foreground">
                                                        For IT or integration teams only. Hospital billing staff can ignore this section.
                                                    </p>
                                                    <FormFieldShell
                                                        input-id="create-price-metadata"
                                                        label="Integration payload"
                                                        container-class="mt-3"
                                                        :error-message="firstError(createErrors, 'metadata')"
                                                    >
                                                        <Textarea id="create-price-metadata" v-model="createForm.metadataText" class="min-h-24 font-mono text-xs" placeholder='{"key": "value"}' />
                                                    </FormFieldShell>
                                                </details>
                                            </div>
                                        </div>
                                        <p v-if="createTariffWindowValidationMessage" class="text-xs text-destructive">
                                            {{ createTariffWindowValidationMessage }}
                                        </p>
                                    </div>
                                </div>
                            </fieldset>

                            <details class="rounded-lg border p-3">
                                <summary class="cursor-pointer text-sm font-medium text-muted-foreground">Billing standards (optional)</summary>
                                <div class="mt-3 grid grid-cols-6 gap-3">
                                    <FormFieldShell
                                        input-id="create-price-facility-tier"
                                        label="Minimum facility tier"
                                        container-class="col-span-6 sm:col-span-2"
                                    >
                                        <Select
                                            :model-value="createForm.facilityTier || '__none__'"
                                            @update:model-value="(value) => { createForm.facilityTier = value === '__none__' ? '' : String(value); }"
                                        >
                                            <SelectTrigger id="create-price-facility-tier" class="w-full">
                                                <SelectValue placeholder="All tiers" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none__">All tiers</SelectItem>
                                                <SelectItem v-for="tier in facilityTierOptions" :key="tier.value" :value="tier.value">
                                                    {{ tier.label }}
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormFieldShell>
                                    <FormFieldShell
                                        input-id="create-price-local-code"
                                        label="Local code"
                                        container-class="col-span-6 sm:col-span-2"
                                    >
                                        <Input id="create-price-local-code" v-model="createForm.standardsLocal" />
                                    </FormFieldShell>
                                    <FormFieldShell
                                        input-id="create-price-nhif-code"
                                        label="NHIF code"
                                        container-class="col-span-6 sm:col-span-2"
                                    >
                                        <Input id="create-price-nhif-code" v-model="createForm.standardsNhif" />
                                    </FormFieldShell>
                                    <FormFieldShell
                                        input-id="create-price-msd-code"
                                        label="MSD code"
                                        container-class="col-span-6 sm:col-span-2"
                                    >
                                        <Input id="create-price-msd-code" v-model="createForm.standardsMsd" />
                                    </FormFieldShell>
                                    <FormFieldShell
                                        input-id="create-price-loinc-code"
                                        label="LOINC"
                                        container-class="col-span-6 sm:col-span-2"
                                    >
                                        <Input id="create-price-loinc-code" v-model="createForm.standardsLoinc" />
                                    </FormFieldShell>
                                    <FormFieldShell
                                        input-id="create-price-snomed-code"
                                        label="SNOMED CT"
                                        container-class="col-span-6 sm:col-span-2"
                                    >
                                        <Input id="create-price-snomed-code" v-model="createForm.standardsSnomedCt" />
                                    </FormFieldShell>
                                    <FormFieldShell
                                        input-id="create-price-cpt-code"
                                        label="CPT"
                                        container-class="col-span-6 sm:col-span-2"
                                    >
                                        <Input id="create-price-cpt-code" v-model="createForm.standardsCpt" />
                                    </FormFieldShell>
                                    <FormFieldShell
                                        input-id="create-price-icd-code"
                                        label="ICD"
                                        container-class="col-span-6 sm:col-span-2"
                                    >
                                        <Input id="create-price-icd-code" v-model="createForm.standardsIcd" />
                                    </FormFieldShell>
                                </div>
                            </details>
                        </div>
                    </ScrollArea>
                    <SheetFooter class="shrink-0 gap-2 border-t bg-background px-4 py-3 sm:px-5">
                        <Button type="button" variant="outline" :disabled="createLoading" @click="requestCreateSheetOpenChange(false)">
                            Cancel
                        </Button>
                        <Button type="button" :disabled="createLoading || !createTariffReady" class="gap-1.5" @click="createItem">
                            <AppIcon name="plus" class="size-3.5" />
                            {{ createLoading ? 'Saving...' : 'Save new price' }}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <div v-if="canRead" class="flex min-w-0 flex-col gap-4">
                <Card class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <div class="flex flex-col gap-3 border-b px-4 py-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div class="min-w-0 shrink-0">
                                <div class="flex items-center gap-2">
                                    <h3 class="flex items-center gap-2 text-sm font-semibtold leading-none whitespace-nowrap">
                                        <AppIcon name="receipt" class="size-4 text-primary" />
                                        Billable services
                                    </h3>
                                    <Badge variant="secondary" class="h-5 px-1.5 text-[10px] tabular-nums">
                                        {{ pagination?.total ?? items.length }}
                                    </Badge>
                                </div>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{ listFilterHintText }}
                                </p>
                            </div>
                            <div class="flex min-w-0 items-center gap-2">
                                 <SearchInput
                                    v-model="filters.q"
                                    placeholder="Search code, name, type, or department"
                                    class="w-80 min-w-0 text-xs [&_input]:h-8"
                                />
                                <div class="flex shrink-0 items-center gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="h-8 gap-1.5 rounded-lg text-xs"
                                        :disabled="catalogExporting"
                                        @click="exportCatalogItemsCsv"
                                    >
                                        <AppIcon :name="catalogExporting ? 'loader-circle' : 'download'" :class="catalogExporting ? 'size-3.5 animate-spin' : 'size-3.5'" />
                                        Export
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="h-8 gap-1.5 rounded-lg text-xs"
                                        :disabled="catalogPrinting || catalogShowInitialSkeleton || listLoading"
                                        @click="printCatalogItems"
                                    >
                                        <AppIcon :name="catalogPrinting ? 'loader-circle' : 'printer'" :class="catalogPrinting ? 'size-3.5 animate-spin' : 'size-3.5'" />
                                        Print
                                    </Button>
                                    <Popover>
                                        <PopoverTrigger as-child>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                class="h-8 gap-1.5 rounded-lg text-xs"
                                            >
                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                Filters
                                                <Badge v-if="catalogActiveFilterCount > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
                                                    {{ catalogActiveFilterCount }}
                                                </Badge>
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" class="z-50 w-80 space-y-3">
                                            <div class="grid gap-3">
                                                <div class="grid gap-2">
                                                    <Label for="catalog-filter-q">Search</Label>
                                                    <Input
                                                        id="catalog-filter-q"
                                                        v-model="filters.q"
                                                        placeholder="Code, name, type, department"
                                                    />
                                                </div>
                                                <ComboboxField
                                                    input-id="catalog-filter-department"
                                                    label="Department"
                                                    :model-value="filters.departmentId"
                                                    @update:model-value="updateCatalogDepartmentFilter"
                                                    :options="filterDepartmentOptions"
                                                    placeholder="All departments"
                                                    search-placeholder="Search department code or name"
                                                    :empty-text="createDepartmentEmptyText"
                                                />
                                                <div class="grid gap-2">
                                                    <Label for="catalog-filter-currency">Currency</Label>
                                                    <Input
                                                        id="catalog-filter-currency"
                                                        v-model="filters.currencyCode"
                                                        maxlength="3"
                                                        :placeholder="defaultCurrencyCode"
                                                    />
                                                </div>
                                                <Separator />
                                                <div class="grid gap-2">
                                                    <Label for="catalog-filter-sort-by">Sort by</Label>
                                                    <Select :model-value="filterSortBySelectValue" @update:model-value="updateCatalogSortByFilter">
                                                        <SelectTrigger id="catalog-filter-sort-by" class="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="serviceName">Service name</SelectItem>
                                                            <SelectItem value="serviceCode">Service code</SelectItem>
                                                            <SelectItem value="serviceType">Service type</SelectItem>
                                                            <SelectItem value="department">Department</SelectItem>
                                                            <SelectItem value="basePrice">Base price</SelectItem>
                                                            <SelectItem value="currencyCode">Currency</SelectItem>
                                                            <SelectItem value="status">Status</SelectItem>
                                                            <SelectItem value="effectiveFrom">Effective from</SelectItem>
                                                            <SelectItem value="updatedAt">Updated</SelectItem>
                                                            <SelectItem value="createdAt">Created</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label for="catalog-filter-sort-dir">Direction</Label>
                                                    <Select :model-value="filterSortDirSelectValue" @update:model-value="updateCatalogSortDirFilter">
                                                        <SelectTrigger id="catalog-filter-sort-dir" class="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="asc">Ascending</SelectItem>
                                                            <SelectItem value="desc">Descending</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label for="catalog-filter-per-page">Per page</Label>
                                                    <Select :model-value="filterPerPageSelectValue" @update:model-value="updateCatalogPerPageFilter">
                                                        <SelectTrigger id="catalog-filter-per-page" class="w-full">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                             <SelectItem value="50">50</SelectItem>
                                                             <SelectItem value="100">100</SelectItem>
                                                             <SelectItem value="150">150</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="flex gap-2">
                                                    <Button size="sm" variant="outline" class="flex-1 gap-1.5" :disabled="listLoading" @click="resetFilters">
                                                        Reset
                                                    </Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                        <div
                            v-if="canUseBulkSelection && selectedCount > 0"
                            class="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
                        >
                            <div class="flex items-center gap-2">
                                <label class="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Checkbox
                                        id="billing-service-catalog-select-page"
                                        :checked="allVisibleSelected as boolean"
                                        :disabled="pageItemIds.length === 0 || bulkStatusBusy"
                                        @update:checked="toggleSelectAllVisible"
                                    />
                                    <span class="font-medium text-foreground">{{ selectedCount }} selected</span>
                                </label>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    class="h-6 px-2 text-xs"
                                    :disabled="bulkStatusBusy"
                                    @click="clearSelectedItems"
                                >
                                    Clear
                                </Button>
                            </div>
                            <div class="flex items-center gap-1.5">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    class="h-7 gap-1 text-xs"
                                    :disabled="bulkStatusBusy"
                                    @click="openBulkStatusDialog('active')"
                                >
                                    <AppIcon name="check-circle" class="size-3" />
                                    Activate
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    class="h-7 gap-1 text-xs"
                                    :disabled="bulkStatusBusy"
                                    @click="openBulkStatusDialog('inactive')"
                                >
                                    <AppIcon name="pause" class="size-3" />
                                    Deactivate
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    class="h-7 gap-1 text-xs"
                                    :disabled="bulkStatusBusy"
                                    @click="openBulkStatusDialog('retired')"
                                >
                                    <AppIcon name="trash-2" class="size-3" />
                                    Retire
                                </Button>
                            </div>
                        </div>
                        <div>
                            <Tabs
                                :model-value="activeServiceTypeTab"
                                class="w-full"
                                @update:model-value="setActiveServiceTypeTab"
                            >
                                <TabsList
                                    class="grid h-9 w-full grid-cols-6 gap-1 bg-muted/40 p-1 sm:grid-cols-11"
                                >
                                    <TabsTrigger
                                        v-for="tab in SERVICE_TYPE_TABS"
                                        :key="tab.value"
                                        :value="tab.value"
                                        class="gap-1.5 rounded-md border border-transparent px-2 text-muted-foreground data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm dark:data-[state=active]:border-primary/60 dark:data-[state=active]:bg-primary/25 dark:data-[state=active]:text-primary-foreground"
                                    >
                                        <span class="flex items-center gap-1 leading-none">
                                            <AppIcon :name="tab.icon" class="size-3" />
                                            {{ tab.label }}
                                        </span>
                                        <Badge variant="secondary" class="h-5 min-w-5 justify-center px-1 text-[10px] tabular-nums">
                                            {{ serviceTypeCounts[tab.value === '__all__' ? 'all' : tab.value] ?? 0 }}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                        <div v-if="catalogActiveFilterChips.length > 0" class="flex flex-wrap items-center gap-1.5 px-4 py-2">
                            <span class="text-[11px] text-muted-foreground">Filters:</span>
                            <Badge v-for="chip in catalogActiveFilterChips" :key="`catalog-filter-${chip}`" variant="outline" class="text-[11px]">
                                {{ chip }}
                            </Badge>
                            <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="resetFilters">
                                Clear all
                            </button>
                        </div>
                    </div>
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                    <div v-if="listError" class="p-4">
                        <Alert variant="destructive">
                            <AlertTitle>Price list load issue</AlertTitle>
                            <AlertDescription>{{ listError }}</AlertDescription>
                        </Alert>
                    </div>

                    <ScrollArea v-else class="min-h-0 flex-1">
                        <div>
                            <RegistryListSkeleton v-if="catalogShowInitialSkeleton" :count="6" />

                            <div
                                v-else-if="items.length === 0"
                                class="flex flex-col items-center gap-3 px-4 py-10 text-center"
                                :class="{ 'opacity-60': catalogListRefreshing }"
                            >
                                <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
                                    <AppIcon name="receipt" class="size-4 text-muted-foreground" />
                                </div>
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">
                                        {{ catalogListRefreshing ? 'Refreshing prices…' : 'No service prices found' }}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        <template v-if="catalogListRefreshing">
                                            Updating the list with your current filters.
                                        </template>
                                        <template v-else-if="catalogActiveFilterCount === 0 && (pagination?.total ?? 0) === 0">
                                            Start from Clinical Catalog, then register linked tariffs here so finance does not duplicate service codes.
                                        </template>
                                        <template v-else>
                                            Adjust or clear filters to widen the catalog.
                                        </template>
                                    </p>
                                </div>
                                <div class="flex flex-wrap justify-center gap-2">
                                    <Button
                                        v-if="catalogActiveFilterCount > 0"
                                        variant="outline"
                                        size="sm"
                                        class="h-8 gap-1.5"
                                        @click="resetFilters"
                                    >
                                        <AppIcon name="x" class="size-3.5" />
                                        Clear filters
                                    </Button>
                                    <Button v-if="canManagePricing" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                                        <AppIcon name="plus" class="size-3.5" />
                                        Add service price
                                    </Button>
                                    <Button v-if="canManagePricing" size="sm" variant="outline" class="h-8 gap-1.5" @click="billingSyncDialogOpen = true">
                                        <AppIcon name="book-open" class="size-3.5" />
                                        Sync from Clinical Catalog
                                    </Button>
                                </div>
                            </div>

                            <div
                                v-else
                                class="divide-y px-4"
                                :class="catalogListRefreshing ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'"
                            >
                                <RegistryListRow
                                    v-for="item in items"
                                    :key="String(item.id)"
                                    :status-dot-class="catalogStatusDotClass(item)"
                                    :status-title="`${formatEnumLabel(item.status)} · ${tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo)}`"
                                    @select="openDetails(item)"
                                >
                                    <template v-if="canUseBulkSelection" #leading>
                                        <Checkbox
                                            class="shrink-0"
                                            :model-value="selectedItemIds.includes(String(item.id ?? ''))"
                                            :disabled="!item.id || bulkStatusBusy"
                                            @update:model-value="(checked) => toggleItemSelection(String(item.id ?? ''), checked)"
                                            @click.stop
                                        />
                                    </template>
                                    <template #title>
                                        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <span class="truncate text-sm font-medium transition-colors hover:text-primary">
                                                {{ item.serviceName || 'Unnamed service' }}
                                            </span>
                                            <span class="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                                {{ item.serviceCode || '—' }}
                                            </span>
                                            <span v-if="item.serviceType && item.department !== formatEnumLabel(item.serviceType)" class="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                                {{ formatEnumLabel(item.serviceType) }}
                                            </span>
                                        </div>
                                    </template>
                                    <template #meta>
                                        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                            <span class="font-medium tabular-nums text-foreground">
                                                {{ formatMoney(item.basePrice, item.currencyCode) }}
                                            </span>
                                            <span class="text-border">·</span>
                                            <span>{{ item.department || 'No department' }}</span>
                                            <span class="text-border">·</span>
                                            <span class="text-muted-foreground/70">v{{ item.versionNumber || 1 }}</span>
                                            <span class="text-border">·</span>
                                            <span>{{ tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo) }}</span>
                                        </div>
                                    </template>
                                    <template #badges>
                                        <CatalogLinkBadge
                                            :source="item.clinicalCatalogItemId ? 'clinical_catalog' : 'standalone'"
                                            :catalog-type="item.clinicalCatalogItem?.catalogType"
                                            :catalog-name="item.clinicalCatalogItem?.name"
                                            :catalog-code="item.clinicalCatalogItem?.code"
                                        />
                                        <Badge :variant="statusVariant(item.status)" class="capitalize">
                                            {{ formatEnumLabel(item.status) }}
                                        </Badge>
                                    </template>
                                    <template #actions>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            class="h-8 rounded-lg text-xs"
                                            @click="openDetails(item)"
                                        >
                                            Details
                                        </Button>
                                    </template>
                                </RegistryListRow>
                            </div>
                        </div>
                    </ScrollArea>

                    <footer class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                        <p class="text-xs text-muted-foreground">
                            <template v-if="pagination">
                                Showing {{ items.length }} of {{ pagination.total }} · Page {{ pagination.currentPage }} of
                                {{ pagination.lastPage }}
                            </template>
                            <template v-else>No pagination data</template>
                        </p>
                        <div class="flex items-center gap-1">
                            <Button variant="outline" size="icon" class="size-8" :disabled="!canPrevPage || listLoading" @click="prevPage">
                                <AppIcon name="chevron-left" class="size-4" />
                            </Button>
                            <template v-for="page in paginationPageNumbers" :key="`catalog-page-${String(page)}`">
                                <span v-if="page === '...'" class="px-1 text-xs text-muted-foreground">…</span>
                                <Button
                                    v-else
                                    :variant="page === pagination?.currentPage ? 'default' : 'ghost'"
                                    size="icon"
                                    class="size-8 text-xs"
                                    :disabled="listLoading"
                                    @click="goToPage(page as number)"
                                >
                                    {{ page }}
                                </Button>
                            </template>
                            <Button variant="outline" size="icon" class="size-8" :disabled="!canNextPage || listLoading" @click="nextPage">
                                <AppIcon name="chevron-right" class="size-4" />
                            </Button>
                        </div>
                    </footer>
                </CardContent>
            </Card>

            <Sheet :open="detailsOpen" @update:open="requestDetailsOpenChange">
                <SheetContent side="right" variant="workspace" size="3xl">
                    <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                        <div class="flex flex-col gap-3">
                            <div class="space-y-1">
                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Service price summary</p>
                                <SheetTitle>{{ selectedItem?.serviceName || 'Service price details' }}</SheetTitle>
                                <SheetDescription>
                                    {{ selectedItem?.serviceCode || selectedItem?.id || 'Service code pending' }} | {{ clinicalCatalogLinkLabel(selectedItem) }}
                                </SheetDescription>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge v-if="detailsLoading" variant="secondary" class="gap-1.5">
                                    <AppIcon name="loader-circle" class="size-3 animate-spin" />
                                    Syncing
                                </Badge>
                                <Badge variant="outline">Version {{ selectedItem?.versionNumber || 1 }}</Badge>
                                <Badge v-if="selectedItem" :variant="statusVariant(selectedItem.status)">{{ formatEnumLabel(selectedItem.status) }}</Badge>
                                <Badge v-if="selectedItem" :variant="tariffLifecycleVariant(selectedItem.effectiveFrom, selectedItem.effectiveTo)">
                                    {{ tariffLifecycleLabel(selectedItem.effectiveFrom, selectedItem.effectiveTo) }}
                                </Badge>
                                <Badge v-if="selectedItem" :variant="selectedItem.clinicalCatalogItemId ? 'secondary' : 'outline'">
                                    {{ clinicalCatalogLinkLabel(selectedItem) }}
                                </Badge>
                            </div>
                            <div v-if="selectedItem?.supersedesBillingServiceCatalogItemId" class="text-xs text-muted-foreground">
                                This version replaces an earlier price version in the same service family.
                            </div>
                        </div>
                    </SheetHeader>

                    <ScrollArea class="min-h-0 flex-1">
                        <div v-if="selectedItem" class="space-y-5 p-5">
                            <!-- Price highlight -->
                            <div class="rounded-lg border bg-primary/5 px-4 py-3.5">
                                <div class="flex items-baseline justify-between gap-4">
                                    <div class="min-w-0">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Current base price</p>
                                        <p class="mt-0.5 text-2xl font-bold tracking-tight text-primary">{{ formatMoney(selectedItem.basePrice, selectedItem.currencyCode) }}</p>
                                    </div>
                                    <div class="shrink-0 text-right">
                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Version</p>
                                        <p class="mt-0.5 text-lg font-semibold">v{{ selectedItem.versionNumber || 1 }}</p>
                                    </div>
                                </div>
                                <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <span>{{ tariffWindowLabel(selectedItem.effectiveFrom, selectedItem.effectiveTo) }}</span>
                                    <span>·</span>
                                    <span>{{ tariffLifecycleLabel(selectedItem.effectiveFrom, selectedItem.effectiveTo) }}</span>
                                    <span v-if="selectedItem.taxRatePercent">·</span>
                                    <span v-if="selectedItem.taxRatePercent">{{ selectedItem.taxRatePercent }}% tax</span>
                                </div>
                            </div>

                            <!-- Identity & department row -->
                            <div class="grid gap-4 sm:grid-cols-2">
                                <div class="rounded-lg border bg-background/70 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Service identity</p>
                                    <p class="mt-1 text-sm font-semibold truncate">{{ selectedItem.serviceName }}</p>
                                    <p class="text-xs text-muted-foreground truncate">{{ selectedItem.serviceCode || 'Code pending' }}</p>
                                </div>
                                <div class="rounded-lg border bg-background/70 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Department</p>
                                    <p class="mt-1 text-sm font-semibold truncate">{{ selectedItem.department || selectedItem.departmentId || 'Unassigned' }}</p>
                                    <p class="text-xs text-muted-foreground">{{ formatEnumLabel(selectedItem.serviceType) }}</p>
                                </div>
                            </div>

                            <!-- Clinical linkage + payer impact -->
                            <div class="grid gap-4 sm:grid-cols-2">
                                <div class="rounded-lg border bg-background/70 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Clinical linkage</p>
                                    <p class="mt-1 text-sm font-semibold truncate">{{ clinicalCatalogLinkLabel(selectedItem) }}</p>
                                    <p class="text-xs text-muted-foreground truncate">{{ clinicalCatalogLinkDetail(selectedItem) }}</p>
                                </div>
                                <div class="rounded-lg border bg-background/70 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Payer impact</p>
                                    <p class="mt-1 text-sm font-semibold">{{ payerImpactSummary ? `${payerImpactSummary.activeContractCount} active contracts` : 'Loading...' }}</p>
                                    <p class="text-xs text-muted-foreground truncate">{{ payerImpactSummary ? `${payerImpactSummary.matchingRuleCount} matching rules` : 'Contract reach & auth pressure' }}</p>
                                </div>
                            </div>

                            <!-- Status & metadata row -->
                            <div class="grid gap-4 sm:grid-cols-2">
                                <div class="rounded-lg border bg-background/70 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                                    <div class="mt-1 flex items-center gap-2">
                                        <Badge :variant="statusVariant(selectedItem.status)">{{ formatEnumLabel(selectedItem.status) }}</Badge>
                                        <span class="text-xs text-muted-foreground truncate">{{ selectedItem.statusReason || 'No reason recorded' }}</span>
                                    </div>
                                </div>
                                <div class="rounded-lg border bg-background/70 px-3 py-2.5">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Last updated</p>
                                    <p class="mt-1 text-sm font-semibold">{{ formatDateTime(selectedItem.updatedAt) }}</p>
                                    <p class="text-xs text-muted-foreground">Created {{ formatDateTime(selectedItem.createdAt) }}</p>
                                </div>
                            </div>

                            <div v-if="selectedItem.supersedesBillingServiceCatalogItemId" class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                                <AppIcon name="info" class="mr-1 inline size-3.5 align-text-top" />
                                This version replaces an earlier price version in the same service family.
                            </div>
                        </div>
                    </ScrollArea>

                    <SheetFooter class="shrink-0 gap-2 border-t px-4 py-3 sm:px-6">
                        <Button v-if="selectedItem" as-child class="gap-1.5">
                            <Link :href="`/billing-service-catalog/${selectedItem.id}/prices`">
                                <AppIcon name="receipt" class="size-3.5" />
                                Manage Prices
                            </Link>
                        </Button>
                        <Button variant="outline" @click="requestDetailsOpenChange(false)">Close</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

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
                :open="createDiscardConfirmOpen"
                title="Discard new service price draft?"
                description="This new service price still has unsaved tariff details. Keep editing to finish the registration, or discard the draft."
                stay-label="Keep editing"
                leave-label="Discard draft"
                @update:open="createDiscardConfirmOpen = false"
                @confirm="confirmCreateCatalogDiscard"
            />

            <Dialog v-model:open="bulkStatusDialogOpen">
                <DialogContent class="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{{ bulkStatusDialogTitle }}</DialogTitle>
                        <DialogDescription>
                            Applies to {{ selectedCount }} selected billable service{{ selectedCount === 1 ? '' : 's' }}. Add a short reason for audit traceability.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-2">
                        <Label for="billing-bulk-status-reason">Reason</Label>
                        <Textarea
                            id="billing-bulk-status-reason"
                            v-model="bulkStatusReason"
                            class="min-h-20"
                            :placeholder="bulkStatusTarget === 'active' ? 'Optional activation note' : 'Required reason for deactivation or retirement'"
                        />
                    </div>
                    <Alert v-if="bulkStatusError" variant="destructive">
                        <AlertTitle>Bulk status issue</AlertTitle>
                        <AlertDescription>{{ bulkStatusError }}</AlertDescription>
                    </Alert>
                    <DialogFooter class="gap-2 sm:justify-end">
                        <Button variant="outline" :disabled="bulkStatusBusy" @click="bulkStatusDialogOpen = false">Cancel</Button>
                        <Button :disabled="bulkStatusBusy" @click="submitBulkStatusDialog">
                            {{ bulkStatusBusy ? 'Applying...' : 'Apply status' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <LeaveWorkflowDialog
                :open="detailsDiscardConfirmOpen"
                title="Discard service price changes?"
                description="This service price sheet still has unsaved edits. Keep editing to preserve the pricing update, or discard the unfinished changes."
                stay-label="Keep editing"
                leave-label="Discard changes"
                @update:open="detailsDiscardConfirmOpen = false"
                @confirm="confirmDetailsDiscard"
            />
        </div>
        </div>

        <BillingServiceCatalogSyncDialog
            :open="billingSyncDialogOpen"
            @update:open="billingSyncDialogOpen = $event"
            @synced="loadItems()"
        />
    </AppLayout>
</template>
