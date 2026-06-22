
<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import type { AcceptableValue } from 'reka-ui';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import RegistryListSkeleton from '@/components/list/RegistryListSkeleton.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { usePendingWorkflowLeaveGuard } from '@/composables/usePendingWorkflowLeaveGuard';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGetBlob, apiRequestJson } from '@/lib/apiClient';
import { generateRequestKey } from '@/lib/idempotency';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type CatalogStatus = 'active' | 'inactive' | 'retired';
type CheckboxCheckedState = boolean | 'indeterminate';
type StandardsCodes = Partial<Record<'LOCAL' | 'LOINC' | 'SNOMED_CT' | 'NHIF' | 'MSD' | 'CPT' | 'ICD', string>>;
type ClinicalCatalogLink = {
    id: string | null;
    catalogType: string | null;
    code: string | null;
    name: string | null;
    status: string | null;
};
type CatalogItem = {
    id: string | null;
    tenantId: string | null;
    facilityId: string | null;
    clinicalCatalogItemId: string | null;
    serviceCode: string | null;
    versionNumber: number | null;
    serviceName: string | null;
    serviceType: string | null;
    departmentId: string | null;
    department: string | null;
    unit: string | null;
    priceUnit: string | null;
    unitsPerPack: number | null;
    basePrice: string | null;
    currencyCode: string | null;
    taxRatePercent: string | null;
    isTaxable: boolean | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    codes: StandardsCodes | null;
    facilityTier: string | null;
    linkWarning: string | null;
    standardsWarnings: string[] | null;
    status: CatalogStatus | null;
    statusReason: string | null;
    supersedesBillingServiceCatalogItemId: string | null;
    clinicalCatalogItem: ClinicalCatalogLink | null;
    createdAt: string | null;
    updatedAt: string | null;
};
type CatalogStatusCounts = { active: number; inactive: number; retired: number; other: number; total: number };
type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type CatalogListResponse = { data: CatalogItem[]; meta: Pagination };
type CatalogResponse = { data: CatalogItem };
type CatalogVersionsResponse = { data: CatalogItem[] };
type CatalogPayerImpactSummary = {
    serviceCode: string | null;
    serviceType: string | null;
    department: string | null;
    currencyCode: string | null;
    activeContractCount: number;
    preAuthorizationContractCount: number;
    contractsWithMatchingRulesCount: number;
    matchingRuleCount: number;
    authorizationRequiredRuleCount: number;
    autoApproveRuleCount: number;
    serviceSpecificRuleCount: number;
    serviceTypeRuleCount: number;
    departmentRuleCount: number;
    coveragePercentMin: number | null;
    coveragePercentMax: number | null;
};
type CatalogPayerImpactResponse = { data: CatalogPayerImpactSummary };
type StatusCountResponse = { data: CatalogStatusCounts };
type Department = {
    id: string | null;
    code: string | null;
    name: string | null;
    serviceType: string | null;
};
type DepartmentListResponse = { data: Department[]; meta: Pagination };
type ClinicalCatalogType = 'lab_test' | 'radiology_procedure' | 'theatre_procedure' | 'formulary_item';
type CreateIdentitySource = 'clinical' | 'standalone';
type ClinicalCatalogLookupBillingItem = {
    id: string | null;
    clinicalCatalogItemId: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    status: string | null;
    versionNumber: number | null;
    basePrice: string | null;
    currencyCode: string | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
};
type ClinicalCatalogLookupLink = {
    status: string | null;
    serviceCode: string | null;
    item: ClinicalCatalogLookupBillingItem | null;
};
type ClinicalCatalogLookupItem = {
    id: string | null;
    catalogType: ClinicalCatalogType | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    category: string | null;
    unit: string | null;
    description: string | null;
    codes: StandardsCodes | null;
    facilityTier: string | null;
    billingServiceCode: string | null;
    billingLinkStatus: string | null;
    billingLink: ClinicalCatalogLookupLink | null;
    status: string | null;
};
type ClinicalCatalogLookupListResponse = { data: ClinicalCatalogLookupItem[]; meta: Pagination | null };
type CatalogAuditLog = {
    id: string;
    billingServiceCatalogItemId: string | null;
    actorId: number | null;
    action: string | null;
    changes: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string | null;
};
type CatalogAuditLogListResponse = { data: CatalogAuditLog[]; meta: Pagination };
type ValidationErrorResponse = { message?: string; errors?: Record<string, string[]> };

type ScopeData = {
    resolvedFrom: string;
    facility?: { name?: string | null; code?: string | null } | null;
    tenant?: { name?: string | null; code?: string | null } | null;
};

const serviceTypeOptions = [
    'consultation',
    'laboratory',
    'radiology',
    'pharmacy',
    'procedure',
    'admission',
    'theatre',
    'imaging',
    'consumable',
    'other',
];

const unitOptions = ['service', 'study', 'test', 'item', 'session', 'day', 'procedure', 'dose', 'package'];
const pharmacyUnitOptions = ['tablet', 'capsule', 'vial', 'ampoule', 'sachet', 'bottle', 'inhaler', 'pack', 'box', 'strip', 'dose', 'ml', 'mg', 'g', 'iu'];
const facilityTierOptions = [
    { value: 'dispensary', label: 'Dispensary' },
    { value: 'health_centre', label: 'Health centre' },
    { value: 'district_hospital', label: 'District hospital' },
    { value: 'regional_hospital', label: 'Regional hospital' },
    { value: 'zonal_referral', label: 'Zonal referral' },
] as const;
const clinicalCatalogSources = [
    { type: 'lab_test', path: '/platform/admin/clinical-catalogs/lab-tests', label: 'Lab Tests', defaultServiceType: 'laboratory' },
    { type: 'radiology_procedure', path: '/platform/admin/clinical-catalogs/radiology-procedures', label: 'Radiology', defaultServiceType: 'radiology' },
    { type: 'theatre_procedure', path: '/platform/admin/clinical-catalogs/theatre-procedures', label: 'Theatre Procedures', defaultServiceType: 'theatre' },
    { type: 'formulary_item', path: '/platform/admin/clinical-catalogs/formulary-items', label: 'Formulary', defaultServiceType: 'pharmacy' },
] as const satisfies ReadonlyArray<{ type: ClinicalCatalogType; path: string; label: string; defaultServiceType: string }>;

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Tariffs & services', href: '/billing-service-catalog' },
];

const { permissionNames, permissionState, scope: platformScope, multiTenantIsolationEnabled } = usePlatformAccess();
const { activeCurrencyCode, loadCountryProfile } = usePlatformCountryProfile();

const permissionsResolved = computed(() => permissionNames.value !== null);
const canRead = computed(() => permissionState('billing.service-catalog.read') === 'allowed');
const canManageLegacy = computed(() => permissionState('billing.service-catalog.manage') === 'allowed');
const canManageIdentity = computed(() => canManageLegacy.value || permissionState('billing.service-catalog.manage-identity') === 'allowed');
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
const catalogExporting = ref(false);
const catalogPrinting = ref(false);
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
    perPage: 10,
    page: 1,
});

const filtersSheetOpen = ref(false);
const createSheetOpen = ref(false);

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
    if (filters.perPage !== 10) chips.push(`${filters.perPage} per page`);

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
    const normalizedServiceType = preferredServiceType.trim().toLowerCase();
    const source = normalizedServiceType
        ? departments.value.filter((department) => String(department.serviceType ?? '').trim().toLowerCase() === normalizedServiceType)
        : departments.value;

    return (source.length > 0 ? source : departments.value)
        .map((department) => {
            const id = String(department.id ?? '').trim();
            const name = String(department.name ?? '').trim();
            if (!id || !name) return null;

            const code = String(department.code ?? '').trim();
            const serviceType = String(department.serviceType ?? '').trim();

            return {
                value: id,
                label: code ? `${code} - ${name}` : name,
                description: serviceType ? `${formatEnumLabel(serviceType)} department` : 'Hospital department',
                keywords: [name, code, serviceType].filter((entry) => entry.trim().length > 0),
                group: serviceType ? formatEnumLabel(serviceType) : 'Other',
            } as SearchableSelectOption;
        })
        .filter((option): option is SearchableSelectOption => option !== null);
}

function clinicalCatalogSourceConfig(catalogType: string | null | undefined) {
    return clinicalCatalogSources.find((source) => source.type === catalogType) ?? null;
}

function clinicalCatalogGroupLabel(catalogType: string | null | undefined): string {
    return clinicalCatalogSourceConfig(catalogType)?.label ?? 'Clinical Catalogs';
}

function billingServiceTypeFromClinicalCatalogType(catalogType: string | null | undefined): string {
    return clinicalCatalogSourceConfig(catalogType)?.defaultServiceType ?? '';
}

function resolvedClinicalCatalogServiceCode(item: ClinicalCatalogLookupItem | null): string {
    if (!item) return '';

    return normalizeServiceCode(item.billingServiceCode ?? '') || normalizeServiceCode(item.code ?? '');
}

function findDepartmentOption(options: SearchableSelectOption[], value: string): SearchableSelectOption | null {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) return null;

    return options.find((option) => option.value.trim().toLowerCase() === normalizedValue) ?? null;
}

function findClinicalCatalogLookupItem(value: string): ClinicalCatalogLookupItem | null {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) return null;

    return clinicalCatalogLookupItems.value.find((item) => String(item.id ?? '').trim().toLowerCase() === normalizedValue) ?? null;
}

const allDepartmentOptions = computed<SearchableSelectOption[]>(() => buildDepartmentOptions());
const createDepartmentOptions = computed<SearchableSelectOption[]>(() => buildDepartmentOptions(createForm.serviceType));
const editDepartmentOptions = computed<SearchableSelectOption[]>(() => buildDepartmentOptions(editForm.serviceType));
const filterDepartmentOptions = computed<SearchableSelectOption[]>(() => allDepartmentOptions.value);

const editSelectedDepartmentOption = computed(
    () => findDepartmentOption(editDepartmentOptions.value, editForm.departmentId)
        ?? findDepartmentOption(allDepartmentOptions.value, editForm.departmentId),
);
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
    if (!clinicalCatalogLookupItems.value.length) return 'No active clinical definitions are available yet. Add them in Clinical Care Catalogs first.';
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
const filterDepartmentSummary = computed(() => filterSelectedDepartmentOption.value?.label ?? '');
const catalogShowInitialSkeleton = computed(() => pageLoading.value);
const catalogListRefreshing = computed(() => listLoading.value && !pageLoading.value);
const detailsClinicalLinkagePending = computed(
    () => detailsLoading.value && Boolean(selectedItem.value?.clinicalCatalogItemId) && !selectedItem.value?.clinicalCatalogItem,
);

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

const filterServiceTypeSelectValue = computed(() => filters.serviceType || '__none__');

const filterSortBySelectValue = computed(() => filters.sortBy);

const filterSortDirSelectValue = computed(() => filters.sortDir);

const filterPerPageSelectValue = computed(() => String(filters.perPage));

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

const editUnitOptions = computed(() => unitOptions);

const editPriceUnitSelectValue = computed({
    get: () => editForm.priceUnit || '__none__',
    set: (value: string) => {
        editForm.priceUnit = value === '__none__' ? '' : value;
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
const editTariffWindowValidationMessage = computed(() => windowRangeValidationMessage(editForm.effectiveFrom, editForm.effectiveTo));
const revisionWindowValidationMessage = computed(() => windowRangeValidationMessage(revisionForm.effectiveFrom, revisionForm.effectiveTo));

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
            value: formatMoney(selectedItem.value.basePrice, selectedItem.value.currencyCode),
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

const itemWorkspacePostureCards = computed(() => {
    if (!selectedItem.value) return [];

    return [
        {
            key: 'version',
            label: 'Current version',
            value: `v${selectedItem.value.versionNumber || 1}`,
            helper: formatMoney(selectedItem.value.basePrice, selectedItem.value.currencyCode),
        },
        {
            key: 'clinical-link',
            label: 'Clinical linkage',
            value: clinicalCatalogLinkLabel(selectedItem.value),
            helper: clinicalCatalogLinkDetail(selectedItem.value),
        },
        {
            key: 'lifecycle',
            label: 'Price window',
            value: tariffLifecycleLabel(selectedItem.value.effectiveFrom, selectedItem.value.effectiveTo),
            helper: tariffWindowLabel(selectedItem.value.effectiveFrom, selectedItem.value.effectiveTo),
        },
        {
            key: 'governance',
            label: 'Status',
            value: formatEnumLabel(selectedItem.value.status),
            helper: selectedItem.value.statusReason || 'No status reason recorded',
        },
        {
            key: 'impact',
            label: 'Contract reach',
            value: payerImpactSummary.value
                ? `${payerImpactSummary.value.activeContractCount} active contracts`
                : 'Contract context pending',
            helper: payerImpactSummary.value
                ? `${payerImpactSummary.value.matchingRuleCount} matching rules and ${payerImpactSummary.value.preAuthorizationContractCount} pre-auth defaults`
                : 'Price History loads contract reach and authorization pressure.',
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

    return `${formatMoney(basePrice || null, selectedItem.value?.currencyCode || editForm.currencyCode || defaultCurrencyCode.value)} | ${tariffWindowLabel(effectiveFrom, effectiveTo)}`;
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
const auditExporting = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<CatalogAuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);
const auditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });

function firstError(errors: Record<string, string[]> | null | undefined, key: string): string | null {
    return errors?.[key]?.[0] ?? null;
}

function toDateTimeInput(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function datePartFromDateTimeInput(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '';
    const splitIndex = normalized.indexOf('T');
    return splitIndex >= 0 ? normalized.slice(0, splitIndex) : normalized.slice(0, 10);
}

function timePartFromDateTimeInput(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '';
    const splitIndex = normalized.indexOf('T');
    if (splitIndex < 0) return '';
    return normalized.slice(splitIndex + 1, splitIndex + 6);
}

function mergeDateAndTimeInput(datePart: string, timePart: string, fallbackTime: string): string {
    const normalizedDate = datePart.trim();
    if (!normalizedDate) return '';

    const normalizedTime = timePart.trim() || fallbackTime;
    return `${normalizedDate}T${normalizedTime}`;
}

function toApiDateTime(value: string): string | null {
    const normalized = value.trim();
    if (!normalized) return null;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
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

function tariffWindowLabel(effectiveFrom: string | null, effectiveTo: string | null): string {
    if (!effectiveFrom && !effectiveTo) return 'No effective window configured';
    if (effectiveFrom && !effectiveTo) return `Effective from ${formatDateTime(effectiveFrom)}`;
    if (!effectiveFrom && effectiveTo) return `Valid until ${formatDateTime(effectiveTo)}`;

    return `${formatDateTime(effectiveFrom)} to ${formatDateTime(effectiveTo)}`;
}

function windowRangeValidationMessage(effectiveFromInput: string, effectiveToInput: string): string | null {
    const effectiveFrom = toApiDateTime(effectiveFromInput);
    const effectiveTo = toApiDateTime(effectiveToInput);

    if (!effectiveFrom || !effectiveTo) return null;

    const fromTime = new Date(effectiveFrom).getTime();
    const toTime = new Date(effectiveTo).getTime();
    if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;

    if (toTime <= fromTime) {
        return 'Effective to must be later than effective from.';
    }

    return null;
}

function tariffLifecycleLabel(effectiveFrom: string | null, effectiveTo: string | null): string {
    const now = new Date();
    const from = effectiveFrom ? new Date(effectiveFrom) : null;
    const to = effectiveTo ? new Date(effectiveTo) : null;

    if (from && !Number.isNaN(from.getTime()) && from > now) return 'Scheduled';
    if (to && !Number.isNaN(to.getTime()) && to < now) return 'Expired window';
    if (from || to) return 'Effective window active';

    return 'No window';
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

function normalizeServiceCode(value: string): string {
    return value.trim().toUpperCase();
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

function applyFiltersFromSheet(): void {
    filtersSheetOpen.value = false;
    search();
}

function resetFiltersFromSheet(): void {
    filtersSheetOpen.value = false;
    resetFilters();
}

function applyCatalogListModePreset(
    mode: 'all' | 'active' | 'scheduled' | 'review' | 'retired',
): void {
    if (mode === 'all') {
        filters.status = '';
        filters.lifecycle = '';
    } else if (mode === 'active') {
        filters.status = 'active';
        filters.lifecycle = '';
    } else if (mode === 'scheduled') {
        filters.status = '';
        filters.lifecycle = 'scheduled';
    } else if (mode === 'review') {
        filters.status = 'inactive';
        filters.lifecycle = '';
    } else {
        filters.status = 'retired';
        filters.lifecycle = '';
    }

    filters.page = 1;
    void loadItems();
}

function catalogListModeIsActive(
    mode: 'all' | 'active' | 'scheduled' | 'review' | 'retired',
): boolean {
    if (mode === 'all') {
        return filters.status === '' && filters.lifecycle === '';
    }

    if (mode === 'active') {
        return filters.status === 'active' && filters.lifecycle === '';
    }

    if (mode === 'scheduled') {
        return filters.status === '' && filters.lifecycle === 'scheduled';
    }

    if (mode === 'review') {
        return filters.status === 'inactive' && filters.lifecycle === '';
    }

    return filters.status === 'retired' && filters.lifecycle === '';
}

function catalogStatusDotClass(item: CatalogItem): string {
    const lifecycle = tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo);
    if (lifecycle === 'Scheduled') return 'bg-blue-500';

    const status = String(item.status ?? '').toLowerCase();
    if (status === 'active') return 'bg-emerald-500';
    if (status === 'inactive') return 'bg-amber-500';
    if (status === 'retired') return 'bg-rose-500';
    return 'bg-slate-400';
}

function goToPage(page: number): void {
    filters.page = page;
    void loadItems();
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive' || normalized === 'retired') return 'destructive';
    return 'outline';
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

function parseDecimalOrNull(value: string): number | null | 'invalid' {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return 'invalid';
    return parsed;
}

function metadataObject(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return null;
    if (typeof value !== 'object') return null;
    if (Object.keys(value as Record<string, unknown>).length === 0) return null;

    return value as Record<string, unknown>;
}

function metadataHasContent(value: unknown): boolean {
    return metadataObject(value) !== null;
}

function metadataToFormText(value: unknown): string {
    const object = metadataObject(value);
    if (!object) return '';

    return JSON.stringify(object, null, 2);
}

function metadataValuesEqual(stored: unknown, formText: string): boolean {
    const parsed = parseMetadata(formText);
    if (parsed === 'invalid') return false;

    return JSON.stringify(metadataObject(stored)) === JSON.stringify(parsed);
}

function parseMetadata(value: string): Record<string, unknown> | null | 'invalid' {
    const normalized = value.trim();
    if (!normalized) return null;

    try {
        const parsed = JSON.parse(normalized) as unknown;
        if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') return 'invalid';
        return parsed as Record<string, unknown>;
    } catch {
        return 'invalid';
    }
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

const showEditTechnicalMetadata = computed(() => (
    metadataHasContent(selectedItem.value?.metadata) || editForm.metadataText.trim() !== ''
));

const showRevisionTechnicalMetadata = computed(() => (
    metadataHasContent(selectedItem.value?.metadata) || revisionForm.metadataText.trim() !== ''
));

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

function syncItemInList(updated: CatalogItem): void {
    const index = items.value.findIndex((entry) => entry.id === updated.id);
    if (index >= 0) items.value[index] = updated;
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

function search(): void {
    filters.page = 1;
    void loadItems();
}

function updateCatalogServiceTypeFilter(value: string): void {
    filters.serviceType = value === '__none__' ? '' : value;
    filters.page = 1;
    void loadItems();
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
    filters.perPage = Number.isFinite(parsed) ? parsed : 10;
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
        await Promise.all([loadItems(), loadStatusCounts()]);
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
    filters.perPage = 10;
    filters.page = 1;
    filtersSheetOpen.value = false;
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
                unitsPerPack: createForm.unitsPerPack.trim() ? Number.parseInt(createForm.unitsPerPack.trim(), 10) : null,
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

async function saveIdentity(): Promise<void> {
    const itemId = String(selectedItem.value?.id ?? '').trim();
    if (!itemId || !canManageIdentity.value || identityLoading.value) return;

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
        syncItemInList(response.data);
        rotateIdentityRequestKey();
        await loadPayerImpact(String(response.data.id ?? itemId));
        notifySuccess('Service details updated.');
        await loadStatusCounts();
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
                priceUnit: editForm.priceUnit.trim() || null,
                unitsPerPack: editForm.unitsPerPack.trim() ? Number.parseInt(editForm.unitsPerPack.trim(), 10) : null,
                metadata,
            },
            entitlementContext: 'Billing service catalog pricing update',
            idempotencyKey: requestKey,
            requestId: requestKey,
        });

        selectedItem.value = response.data;
        hydrateEditForm(response.data);
        syncItemInList(response.data);
        rotatePricingRequestKey();
        await loadPayerImpact(String(response.data.id ?? itemId));
        notifySuccess('Service pricing updated.');
        await loadStatusCounts();
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
        syncItemInList(response.data);
        rotateStatusRequestKey();
        await loadPayerImpact(String(response.data.id ?? itemId));
        notifySuccess('Service catalog item status updated.');
        await loadStatusCounts();
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
        await loadItems();
        await loadStatusCounts();
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
</script>
<template>
    <Head title="Tariffs & services" />

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
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">Tariffs &amp; services</h1>
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
                    <div class="flex flex-shrink-0 flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            :disabled="listLoading"
                            @click="loadItems()"
                        >
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                        </Button>
                        <Button v-if="canManagePricing" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                            <AppIcon name="plus" class="size-3.5" />
                            Add service price
                        </Button>
                        <Button size="sm" variant="outline" as-child class="h-8 gap-1.5">
                            <Link href="/platform/admin/clinical-catalogs">
                                <AppIcon name="book-open" class="size-3.5" />
                                Clinical catalogs
                            </Link>
                        </Button>
                        <Button size="sm" variant="outline" as-child class="h-8 gap-1.5">
                            <Link href="/billing-payer-contracts">
                                <AppIcon name="shield-check" class="size-3.5" />
                                Payer contracts
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
                                    Add care definitions in Clinical Care Catalogs first, or switch to standalone for billing-only services.
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
                                        <p class="text-xs font-medium text-muted-foreground">Service</p>
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
                <Card class="flex flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                    <div class="flex flex-col gap-3 border-b px-4 py-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div class="min-w-0">
                                <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                    <AppIcon name="receipt" class="size-4 text-primary" />
                                    Billable services
                                </h3>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{ pagination?.total ?? items.length }} in scope · {{ listFilterHintText }}
                                </p>
                            </div>
                            <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                                <SearchInput
                                    v-model="filters.q"
                                    placeholder="Search code, name, type, or department"
                                    class="min-w-0 flex-1 text-xs [&_input]:h-8"
                                    @keyup.enter="search"
                                />
                                                        <Select
                                                            :model-value="filterServiceTypeSelectValue"
                                                            @update:model-value="(value: AcceptableValue) => updateCatalogServiceTypeFilter(String(value as string))"
                                                        >
                                    <SelectTrigger class="h-8 w-full min-w-[10rem] text-xs sm:w-[11rem]">
                                        <SelectValue placeholder="All types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">All types</SelectItem>
                                        <SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">
                                            {{ formatEnumLabel(option) }}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="h-8 gap-1.5 rounded-lg text-xs"
                                    @click="filtersSheetOpen = true"
                                >
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    Filters
                                    <Badge v-if="catalogActiveFilterCount > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
                                        {{ catalogActiveFilterCount }}
                                    </Badge>
                                </Button>
                            </div>
                        </div>
                        <div
                            v-if="canUseBulkSelection"
                            class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2"
                        >
                            <label class="flex items-center gap-2 text-xs text-muted-foreground">
                                <Checkbox
                                    id="billing-service-catalog-select-page"
                                    :checked="allVisibleSelected as boolean"
                                    :disabled="pageItemIds.length === 0 || bulkStatusBusy"
                                    @update:checked="toggleSelectAllVisible"
                                />
                                Select page
                            </label>
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="text-xs text-muted-foreground">{{ selectedCount }} selected</span>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    class="h-8"
                                    :disabled="selectedCount === 0 || bulkStatusBusy"
                                    @click="openBulkStatusDialog('active')"
                                >
                                    Activate
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    class="h-8"
                                    :disabled="selectedCount === 0 || bulkStatusBusy"
                                    @click="openBulkStatusDialog('inactive')"
                                >
                                    Deactivate
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    class="h-8"
                                    :disabled="selectedCount === 0 || bulkStatusBusy"
                                    @click="openBulkStatusDialog('retired')"
                                >
                                    Retire
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    class="h-8"
                                    :disabled="selectedCount === 0 || bulkStatusBusy"
                                    @click="clearSelectedItems"
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': catalogListModeIsActive('all') }"
                                @click="applyCatalogListModePreset('all')"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                                <span class="font-medium tabular-nums">{{ statusCounts.total }}</span>
                                <span class="text-muted-foreground">All</span>
                            </button>
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': catalogListModeIsActive('active') }"
                                @click="applyCatalogListModePreset('active')"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                <span class="font-medium tabular-nums">{{ statusCounts.active }}</span>
                                <span class="text-muted-foreground">Active</span>
                            </button>
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': catalogListModeIsActive('scheduled') }"
                                @click="applyCatalogListModePreset('scheduled')"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-blue-500" />
                                <span class="text-muted-foreground">Scheduled</span>
                            </button>
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': catalogListModeIsActive('review') }"
                                @click="applyCatalogListModePreset('review')"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-amber-500" />
                                <span class="font-medium tabular-nums">{{ statusCounts.inactive }}</span>
                                <span class="text-muted-foreground">Review</span>
                            </button>
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                                :class="{ 'border-primary bg-primary/5': catalogListModeIsActive('retired') }"
                                @click="applyCatalogListModePreset('retired')"
                            >
                                <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                                <span class="font-medium tabular-nums">{{ statusCounts.retired }}</span>
                                <span class="text-muted-foreground">Retired</span>
                            </button>
                        </div>
                    </div>
                    <div v-if="catalogActiveFilterChips.length > 0" class="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
                        <span class="text-[11px] text-muted-foreground">Filters:</span>
                        <Badge v-for="chip in catalogActiveFilterChips" :key="`catalog-filter-${chip}`" variant="outline" class="text-[11px]">
                            {{ chip }}
                        </Badge>
                        <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="resetFilters">
                            Clear all
                        </button>
                    </div>
                    <CardContent class="flex flex-col overflow-hidden p-0">
                    <div v-if="listError" class="p-4">
                        <Alert variant="destructive">
                            <AlertTitle>Price list load issue</AlertTitle>
                            <AlertDescription>{{ listError }}</AlertDescription>
                        </Alert>
                    </div>

                    <ScrollArea v-else class="max-h-[min(70vh,42rem)]">
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
                                            Start from Clinical Care Catalog, then register linked tariffs here so finance does not duplicate service codes.
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
                                            <span class="shrink-0 text-xs text-muted-foreground">{{ item.serviceCode || 'No code' }}</span>
                                            <span class="shrink-0 text-xs font-medium tabular-nums text-foreground">
                                                {{ formatMoney(item.basePrice, item.currencyCode) }}
                                            </span>
                                        </div>
                                    </template>
                                    <template #meta>
                                        <p class="truncate text-xs text-muted-foreground">
                                            {{ item.serviceType ? formatEnumLabel(item.serviceType) : 'Type not set' }}
                                            <span class="text-border"> · </span>
                                            {{ item.department || 'No department' }}
                                            <span class="text-border"> · </span>
                                            v{{ item.versionNumber || 1 }}
                                            <span class="text-border"> · </span>
                                            {{ tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo) }}
                                            <span class="text-border"> · </span>
                                            {{ clinicalCatalogLinkLabel(item) }}
                                        </p>
                                    </template>
                                    <template #badges>
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

            <Sheet :open="filtersSheetOpen" @update:open="filtersSheetOpen = $event">
                <SheetContent side="right" variant="form" size="2xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader>
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            Catalog filters
                        </SheetTitle>
                        <SheetDescription>Narrow the price list without crowding the registry.</SheetDescription>
                    </SheetHeader>
                    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="catalog-filter-q">Search</Label>
                                    <Input
                                        id="catalog-filter-q"
                                        v-model="filters.q"
                                        placeholder="Code, name, type, department"
                                        @keyup.enter="applyFiltersFromSheet"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="catalog-filter-type">Service type</Label>
                                    <Select
                                        :model-value="filterServiceTypeSelectValue"
                                        @update:model-value="updateCatalogServiceTypeFilter"
                                    >
                                        <SelectTrigger id="catalog-filter-type" class="w-full">
                                            <SelectValue placeholder="All types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">All types</SelectItem>
                                            <SelectItem v-for="option in serviceTypeOptions" :key="option" :value="option">
                                                {{ formatEnumLabel(option) }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <ComboboxField
                                    input-id="catalog-filter-department"
                                    label="Department"
                                    :model-value="filters.departmentId"
                                    @update:model-value="updateCatalogDepartmentFilter"
                                    :options="filterDepartmentOptions"
                                    placeholder="All departments"
                                    search-placeholder="Search department code or name"
                                    helper-text="Limit results to one hospital department."
                                    :empty-text="createDepartmentEmptyText"
                                />
                                <div class="grid gap-2">
                                    <Label for="catalog-filter-currency">Currency</Label>
                                    <Input
                                        id="catalog-filter-currency"
                                        v-model="filters.currencyCode"
                                        maxlength="3"
                                        :placeholder="defaultCurrencyCode"
                                        @keyup.enter="applyFiltersFromSheet"
                                    />
                                </div>
                                <Separator />
                                <div class="grid gap-2">
                                    <Label for="catalog-filter-sort-by">Sort by</Label>
                                    <Select
                                        :model-value="filterSortBySelectValue"
                                        @update:model-value="updateCatalogSortByFilter"
                                    >
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
                                    <Select
                                        :model-value="filterSortDirSelectValue"
                                        @update:model-value="updateCatalogSortDirFilter"
                                    >
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
                                    <Label for="catalog-filter-per-page">Results per page</Label>
                                    <Select
                                        :model-value="filterPerPageSelectValue"
                                        @update:model-value="updateCatalogPerPageFilter"
                                    >
                                        <SelectTrigger id="catalog-filter-per-page" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="15">15</SelectItem>
                                            <SelectItem value="25">25</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <SheetFooter class="gap-2 border-t px-4 py-3">
                        <Button :disabled="listLoading" class="gap-1.5" @click="applyFiltersFromSheet">
                            <AppIcon name="search" class="size-3.5" />
                            Apply filters
                        </Button>
                        <Button variant="outline" :disabled="listLoading && catalogActiveFilterCount === 0" @click="resetFiltersFromSheet">
                            Reset filters
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Sheet :open="detailsOpen" @update:open="requestDetailsOpenChange">
                <SheetContent side="right" variant="workspace" size="6xl">
                    <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                        <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div class="space-y-1">
                                <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Service price</p>
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
                                <Button size="sm" variant="outline" as-child class="gap-1.5">
                                    <Link href="/billing-payer-contracts">
                                        <AppIcon name="shield-check" class="size-3.5" />
                                        Payer contracts
                                    </Link>
                                </Button>
                            </div>
                        </div>
                        <div v-if="selectedItem?.supersedesBillingServiceCatalogItemId" class="mt-2 text-xs text-muted-foreground">
                            This version replaces an earlier price version in the same service family.
                        </div>
                        <div v-if="selectedItem" class="mt-3 flex flex-wrap items-stretch gap-2">
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
                    </SheetHeader>

                    <div class="min-h-0 flex-1 overflow-hidden">
                        <Tabs v-if="selectedItem" v-model="detailsTab" class="flex h-full min-h-0 flex-col">
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
                                                        <Input id="edit-price-service-code" v-model="editForm.serviceCode" :disabled="!canManageIdentity" />
                                                    </FormFieldShell>
                                                    <FormFieldShell input-id="edit-price-service-name" label="Service name" container-class="md:col-span-2" :error-message="firstError(identityErrors, 'serviceName')">
                                                        <Input id="edit-price-service-name" v-model="editForm.serviceName" :disabled="!canManageIdentity" />
                                                    </FormFieldShell>
                                                    <FormFieldShell input-id="edit-price-service-type" label="Service type">
                                                        <Select v-model="editServiceTypeSelectValue" @update:model-value="(value: AcceptableValue) => updateCatalogServiceTypeFilter(String(value as string))">
                                                            <SelectTrigger id="edit-price-service-type" class="w-full" :disabled="!canManageIdentity">
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
                                                        :disabled="!canManageIdentity"
                                                    />
                                                    <FormFieldShell input-id="edit-price-unit" label="Billing unit">
                                                        <Select v-model="editUnitSelectValue">
                                                            <SelectTrigger id="edit-price-unit" class="w-full" :disabled="!canManageIdentity">
                                                                <SelectValue placeholder="Select unit" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__none__">Select unit</SelectItem>
                                                                <SelectItem v-for="option in editUnitOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormFieldShell>
                                                    <FormFieldShell input-id="edit-price-pharmacy-unit" label="Pharmacy unit" v-if="editForm.serviceType === 'pharmacy'">
                                                        <Select v-model="editPriceUnitSelectValue">
                                                            <SelectTrigger id="edit-price-pharmacy-unit" class="w-full" :disabled="!canManageIdentity">
                                                                <SelectValue placeholder="Select unit" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__none__">No pharmacy unit</SelectItem>
                                                                <SelectItem v-for="option in pharmacyUnitOptions" :key="option" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormFieldShell>
                                                    <FormFieldShell input-id="edit-price-units-per-pack" label="Units per pack" v-if="editForm.serviceType === 'pharmacy'">
                                                        <Input id="edit-price-units-per-pack" v-model="editForm.unitsPerPack" inputmode="numeric" :disabled="!canManageIdentity" placeholder="e.g. 30" />
                                                    </FormFieldShell>
                                                </div>
                                                <details class="mt-3 rounded-lg border bg-muted/10 p-3">
                                                    <summary class="cursor-pointer text-sm font-medium">Advanced / Standards</summary>
                                                    <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                        <FormFieldShell input-id="edit-price-facility-tier" label="Minimum facility tier">
                                                                <Select
                                                                    :disabled="!canManageIdentity"
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
                                                        <FormFieldShell input-id="edit-price-local-code" label="Local code"><Input id="edit-price-local-code" v-model="editForm.standardsLocal" :disabled="!canManageIdentity" placeholder="Internal code" /></FormFieldShell>
                                                        <FormFieldShell input-id="edit-price-nhif-code" label="NHIF code"><Input id="edit-price-nhif-code" v-model="editForm.standardsNhif" :disabled="!canManageIdentity" placeholder="NHIF tariff code" /></FormFieldShell>
                                                        <FormFieldShell input-id="edit-price-msd-code" label="MSD code"><Input id="edit-price-msd-code" v-model="editForm.standardsMsd" :disabled="!canManageIdentity" placeholder="MSD reference" /></FormFieldShell>
                                                        <FormFieldShell input-id="edit-price-loinc-code" label="LOINC"><Input id="edit-price-loinc-code" v-model="editForm.standardsLoinc" :disabled="!canManageIdentity" placeholder="Lab standard" /></FormFieldShell>
                                                        <FormFieldShell input-id="edit-price-snomed-code" label="SNOMED CT"><Input id="edit-price-snomed-code" v-model="editForm.standardsSnomedCt" :disabled="!canManageIdentity" placeholder="Clinical concept" /></FormFieldShell>
                                                        <FormFieldShell input-id="edit-price-cpt-code" label="CPT"><Input id="edit-price-cpt-code" v-model="editForm.standardsCpt" :disabled="!canManageIdentity" placeholder="Optional procedure code" /></FormFieldShell>
                                                        <FormFieldShell input-id="edit-price-icd-code" label="ICD"><Input id="edit-price-icd-code" v-model="editForm.standardsIcd" :disabled="!canManageIdentity" placeholder="Optional diagnosis link" /></FormFieldShell>
                                                    </div>
                                                </details>
                                            </div>

                                            <div class="rounded-lg border p-3">
                                                <div class="mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                                    <div>
                                                        <p class="text-sm font-medium">Price overview</p>
                                                        <p class="text-xs text-muted-foreground">Review the current price state before editing.</p>
                                                    </div>
                                                    <Button size="sm" variant="outline" @click="detailsTab = 'history'">Open history</Button>
                                                </div>
                                                <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                                    <div
                                                        v-for="card in itemWorkspacePostureCards"
                                                        :key="card.key"
                                                        class="rounded-lg border bg-muted/10 px-3 py-2"
                                                    >
                                                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ card.label }}</p>
                                                        <p class="mt-1 text-sm font-semibold">{{ card.value }}</p>
                                                        <p class="mt-1 text-xs text-muted-foreground">{{ card.helper }}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                                            <p class="text-xs text-muted-foreground">Updated {{ formatDateTime(selectedItem.updatedAt) }}</p>
                                            <div class="flex items-center gap-2">
                                                <Button v-if="canManagePricing" size="sm" variant="outline" @click="detailsTab = 'version'">Open new version</Button>
                                                <Button v-if="canManageIdentity" :disabled="identityLoading" @click="saveIdentity">{{ identityLoading ? 'Saving...' : 'Save service details' }}</Button>
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
                                                    <span>{{ formatMoney(editForm.basePrice || null, editForm.currencyCode || null) }}</span>
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
                                                    <Select v-model="editTaxableSelectValue" @update:model-value="(value: AcceptableValue) => updateCatalogServiceTypeFilter(String(value as string))">
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
                                                    This tab manages the live base price only. Use payer contracts for insurer-specific pricing and use New Price Version whenever the amount or active window changes.
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
                                                    <span><span class="font-medium text-muted-foreground">Current:</span> {{ formatMoney(selectedItem.basePrice, selectedItem.currencyCode) }}</span>
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
                                                <p class="text-xs text-muted-foreground">This keeps the current price auditable while preparing the next billing window.</p>
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
                                                                <span class="font-semibold">{{ formatMoney(summary.item.basePrice, summary.item.currencyCode) }}</span>
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
                                                    The most recent live, scheduled, and previous prices appear above. Use the timeline below when you need the full version trail.
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
                                                                <p class="text-sm font-medium">{{ formatMoney(version.basePrice, version.currencyCode) }}</p>
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

                    <SheetFooter class="border-t px-4 py-3">
                        <Button variant="outline" @click="requestDetailsOpenChange(false)">Close</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
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
    </AppLayout>
</template>
