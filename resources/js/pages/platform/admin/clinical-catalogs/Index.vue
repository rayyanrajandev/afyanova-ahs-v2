<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AuditTimelineList from '@/components/audit/AuditTimelineList.vue';
import ClinicalCatalogBulkSheet from '@/components/platform/clinical-catalogs/ClinicalCatalogBulkSheet.vue';
import AppIcon from '@/components/AppIcon.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { CLINICAL_CATALOG_BULK_MAX_STATUS_IDS } from '@/lib/clinicalCatalogBulk';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type CatalogKey = 'lab-tests' | 'radiology-procedures' | 'theatre-procedures' | 'formulary-items';
type CatalogStatus = 'active' | 'inactive' | 'retired';
type BillingLinkStatus = 'linked' | 'pending_price' | 'review_required' | 'not_linked';
type ApiError = Error & { status?: number; payload?: { message?: string; errors?: Record<string, string[]> } };
type StandardsCodes = Partial<Record<'LOCAL' | 'LOINC' | 'SNOMED_CT' | 'NHIF' | 'MSD' | 'CPT' | 'ICD', string>>;

type BillingLinkItem = {
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

type BillingLink = {
    status: BillingLinkStatus | null;
    serviceCode: string | null;
    item: BillingLinkItem | null;
};

type ConsumptionInventoryOption = {
    id: string;
    itemCode: string | null;
    itemName: string | null;
    category: string | null;
    subcategory: string | null;
    unit: string | null;
    manufacturer: string | null;
    currentStock: string | null;
    reorderLevel: string | null;
    status: string | null;
};
type ConsumptionRecipeLine = {
    id: string | null;
    inventoryItemId: string;
    quantityPerOrder: string;
    unit: string;
    wasteFactorPercent: string;
    consumptionStage: string;
    isActive: boolean;
    notes: string | null;
    inventoryItem: ConsumptionInventoryOption | null;
};
type ConsumptionRecipeResponse = {
    data: {
        catalogItemId: string;
        catalogType: string;
        isRecipeSupported: boolean;
        eligibleCategories: string[];
        items: ConsumptionRecipeLine[];
    };
};
type ConsumptionInventoryOptionsResponse = { data: ConsumptionInventoryOption[] };
type Item = {
    id: string | null;
    catalogType: string | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    category: string | null;
    unit: string | null;
    billingServiceCode: string | null;
    billingLinkStatus: BillingLinkStatus | null;
    billingLink: BillingLink | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    codes: StandardsCodes | null;
    facilityTier: string | null;
    status: CatalogStatus | null;
    statusReason: string | null;
    updatedAt: string | null;
};

type Pager = { currentPage: number; perPage: number; total: number; lastPage: number };
type Counts = { active: number; inactive: number; retired: number; other: number; total: number };
type Department = {
    id: string | null;
    code: string | null;
    name: string | null;
    serviceType: string | null;
};
type DepartmentListResponse = { data: Department[]; meta: Pager };
type AuditLog = {
    id: string;
    action: string | null;
    actionLabel: string | null;
    actorId: number | null;
    actorType: string | null;
    actor: { displayName?: string | null } | null;
    changes: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string | null;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Facility setup', href: '/platform/admin/facility-config' },
    { title: 'Clinical Care Catalogs', href: '/platform/admin/clinical-catalogs' },
];

const domains = {
    'lab-tests': {
        label: 'Lab Tests',
        singular: 'Lab test',
        manage: 'platform.clinical-catalog.manage-lab-tests',
        codePlaceholder: 'LAB-CBC-001',
        namePlaceholder: 'Complete Blood Count',
        categoryLabel: 'Discipline',
        categoryPlaceholder: 'hematology',
        unitLabel: 'Reporting unit',
        unitPlaceholder: 'panel',
        domainSectionTitle: 'Lab workflow details',
        domainSectionDescription: 'Capture specimen handling, turnaround expectations, and patient preparation rules used during ordering and results review.',
    },
    'radiology-procedures': {
        label: 'Radiology',
        singular: 'Radiology procedure',
        manage: 'platform.clinical-catalog.manage-radiology-procedures',
        codePlaceholder: 'RAD-US-ABD-001',
        namePlaceholder: 'Abdominal Ultrasound',
        categoryLabel: 'Imaging family',
        categoryPlaceholder: 'ultrasound',
        unitLabel: 'Reporting unit',
        unitPlaceholder: 'study',
        domainSectionTitle: 'Imaging workflow details',
        domainSectionDescription: 'Capture modality, body site, contrast behavior, and duration signals so ordering and scheduling stay operationally accurate.',
    },
    'theatre-procedures': {
        label: 'Theatre Procedures',
        singular: 'Theatre procedure',
        manage: 'platform.clinical-catalog.manage-theatre-procedures',
        codePlaceholder: 'THR-APP-001',
        namePlaceholder: 'Appendectomy',
        categoryLabel: 'Procedure family',
        categoryPlaceholder: 'general_surgery',
        unitLabel: 'Booking unit',
        unitPlaceholder: 'procedure',
        domainSectionTitle: 'Theatre workflow details',
        domainSectionDescription: 'Capture operating class, anaesthesia expectation, sterile prep, and estimated duration for theatre planning and controls.',
    },
    'formulary-items': {
        label: 'Approved Medicines',
        singular: 'Medicine',
        manage: 'platform.clinical-catalog.manage-formulary',
        codePlaceholder: 'MED-AMOX-500CAP',
        namePlaceholder: 'Amoxicillin 500mg',
        categoryLabel: 'Therapeutic class',
        categoryPlaceholder: 'antibiotics',
        unitLabel: 'Dispensing unit',
        unitPlaceholder: 'capsule',
        domainSectionTitle: 'Medicine workflow details',
        domainSectionDescription: 'Capture strength, dosage form, route, pack behavior, and OTC posture so pharmacy and OTC workflows stay consistent.',
    },
} as const;

const { permissionNames, permissionState, scope, multiTenantIsolationEnabled } = usePlatformAccess();
const permissionsResolved = computed(() => permissionNames.value !== null);
const canRead = computed(() => permissionState('platform.clinical-catalog.read') === 'allowed');
const canAudit = computed(() => permissionState('platform.clinical-catalog.view-audit-logs') === 'allowed');
const scopeUnresolved = computed(() => multiTenantIsolationEnabled.value && (scope.value?.resolvedFrom ?? 'none') === 'none');

const catalogKey = ref<CatalogKey>('lab-tests');
const catalog = computed(() => domains[catalogKey.value]);
const canManage = computed(() => permissionState(catalog.value.manage) === 'allowed');
const clinicalCatalogReadOnly = computed(() => canRead.value && !canManage.value);
const workspaceIntroText = computed(() => {
    const domainLabel = catalog.value.label.toLowerCase();
    const base = `${counts.value.total} ${domainLabel} in facility scope`;

    return clinicalCatalogReadOnly.value
        ? `${base} · browse orderable definitions and billing linkage for care teams`
        : `${base} · maintain lab, radiology, theatre, and medicine definitions linked to billing`;
});
const base = computed(() => `/platform/admin/clinical-catalogs/${catalogKey.value}`);

const loading = ref(true);
const listLoading = ref(false);
const listError = ref<string | null>(null);
const items = ref<Item[]>([]);
const pager = ref<Pager | null>(null);
const counts = ref<Counts>({ active: 0, inactive: 0, retired: 0, other: 0, total: 0 });
const departments = ref<Department[]>([]);
const departmentsLoading = ref(false);
const SELECT_ALL_VALUE = '__all__';
const SELECT_NOT_SPECIFIED_VALUE = '__not_specified__';
const facilityTierOptions = [
    { value: 'dispensary', label: 'Dispensary' },
    { value: 'health_centre', label: 'Health centre' },
    { value: 'district_hospital', label: 'District hospital' },
    { value: 'regional_hospital', label: 'Regional hospital' },
    { value: 'zonal_referral', label: 'Zonal referral' },
] as const;
const consumptionStageOptions = [
    { value: 'per_order', label: 'Per order' },
    { value: 'sample_collection', label: 'Sample collection' },
    { value: 'processing', label: 'Processing' },
    { value: 'result_release', label: 'Result release' },
    { value: 'procedure_completion', label: 'Procedure completion' },
    { value: 'manual', label: 'Manual' },
] as const;
const filters = reactive({ q: '', status: '', category: '', perPage: 15, page: 1 });
const filtersSheetOpen = ref(false);
const createSheetOpen = ref(false);

const createBusy = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createForm = reactive(createClinicalDefinitionForm());

const detailsOpen = ref(false);
const editSheetOpen = ref(false);
const statusSheetOpen = ref(false);
const recipeSheetOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);
const selected = ref<Item | null>(null);
const detailsSheetTab = ref<'overview' | 'audit'>('overview');
const editBusy = ref(false);
const editErrors = ref<Record<string, string[]>>({});
const editForm = reactive(createClinicalDefinitionForm());
const consumptionRecipeLoading = ref(false);
const consumptionRecipeSaving = ref(false);
const consumptionRecipeError = ref<string | null>(null);
const consumptionRecipeErrors = ref<Record<string, string[]>>({});
const consumptionRecipeItems = ref<ConsumptionRecipeLine[]>([]);
const consumptionInventoryOptions = ref<ConsumptionInventoryOption[]>([]);
const consumptionRecipeForm = reactive({
    inventoryItemId: '',
    quantityPerOrder: '',
    unit: '',
    wasteFactorPercent: '0',
    consumptionStage: 'per_order',
    notes: '',
});
const statusBusy = ref(false);
const statusErrors = ref<Record<string, string[]>>({});
const statusForm = reactive({ status: 'active' as CatalogStatus, reason: '' });

type CheckboxCheckedState = boolean | 'indeterminate';

const bulkSheetOpen = ref(false);
const bulkStatusDialogOpen = ref(false);
const bulkStatusTarget = ref<CatalogStatus | null>(null);
const bulkStatusReason = ref('');
const bulkStatusBusy = ref(false);
const bulkStatusError = ref<string | null>(null);
const selectedItemIds = ref<string[]>([]);

const auditBusy = ref(false);
const auditExportBusy = ref(false);
const auditError = ref<string | null>(null);
const auditLogs = ref<AuditLog[]>([]);
const auditPager = ref<Pager | null>(null);
const auditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });
const clinicalStatusFilterSelectValue = computed(() => filters.status || SELECT_ALL_VALUE);
const auditActorTypeSelectValue = computed(() => auditFilters.actorType || SELECT_ALL_VALUE);

function preferredDepartmentServiceType(key: CatalogKey): string {
    if (key === 'lab-tests') return 'laboratory';
    if (key === 'radiology-procedures') return 'radiology';
    if (key === 'theatre-procedures') return 'theatre';
    return 'pharmacy';
}

function buildDepartmentOptions(key: CatalogKey): SearchableSelectOption[] {
    const normalizedServiceType = preferredDepartmentServiceType(key).trim().toLowerCase();
    const filteredDepartments = departments.value.filter((department) =>
        String(department.serviceType ?? '').trim().toLowerCase() === normalizedServiceType
    );
    const source = filteredDepartments.length > 0 ? filteredDepartments : departments.value;

    const options = source
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
            } satisfies SearchableSelectOption;
        })
        .filter((option): option is SearchableSelectOption => option !== null);

    return [
        {
            value: SELECT_NOT_SPECIFIED_VALUE,
            label: 'No department assigned',
            description: 'Use when this definition is shared across departments.',
            keywords: ['no department', 'shared', 'unassigned'],
            group: 'General',
        },
        ...options,
    ];
}

function findDepartmentOption(options: SearchableSelectOption[], value: string): SearchableSelectOption | null {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) return null;

    return options.find((option) => option.value.trim().toLowerCase() === normalizedValue) ?? null;
}

const createDepartmentOptions = computed<SearchableSelectOption[]>(() => buildDepartmentOptions(catalogKey.value));
const editDepartmentOptions = computed<SearchableSelectOption[]>(() => buildDepartmentOptions(selectedCatalogKey.value));

const createDepartmentFieldValue = computed({
    get: () => createForm.departmentId.trim() || SELECT_NOT_SPECIFIED_VALUE,
    set: (value: string) => {
        createForm.departmentId = value === SELECT_NOT_SPECIFIED_VALUE ? '' : value.trim();
    },
});

const editDepartmentFieldValue = computed({
    get: () => editForm.departmentId.trim() || SELECT_NOT_SPECIFIED_VALUE,
    set: (value: string) => {
        editForm.departmentId = value === SELECT_NOT_SPECIFIED_VALUE ? '' : value.trim();
    },
});

const createDepartmentEmptyText = computed(() => {
    if (departmentsLoading.value) return 'Loading departments...';
    if (!departments.value.length) return 'No departments are available from the hospital directory.';
    return 'No departments matched this search.';
});

const editDepartmentEmptyText = computed(() => {
    if (departmentsLoading.value) return 'Loading departments...';
    if (!departments.value.length) return 'No departments are available from the hospital directory.';
    return 'No departments matched this search.';
});

function csrfToken(): string | null {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

function firstError(errors: Record<string, string[]> | null | undefined, key: string): string | null {
    return errors?.[key]?.[0] ?? null;
}

function updateClinicalStatusFilter(value: string | null): void {
    filters.status = value === SELECT_ALL_VALUE || !value ? '' : value;
}

function updateAuditActorTypeFilter(value: string | null): void {
    auditFilters.actorType = value === SELECT_ALL_VALUE || !value ? '' : value;
}

function toApiDateTime(value: string): string | null {
    const v = value.trim();
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fmtDate(value: string | null): string {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const v = (status ?? '').toLowerCase();
    if (v === 'active') return 'secondary';
    if (v === 'inactive' || v === 'retired') return 'destructive';
    return 'outline';
}

function billingLinkVariant(status: BillingLinkStatus | null): 'outline' | 'secondary' | 'destructive' {
    if (status === 'linked') return 'secondary';
    if (status === 'pending_price' || status === 'review_required') return 'destructive';
    return 'outline';
}

function billingLinkLabel(status: BillingLinkStatus | null): string {
    if (status === 'linked') return 'Linked to service price';
    if (status === 'pending_price') return 'Waiting for service price';
    if (status === 'review_required') return 'Billing review required';
    return 'No billing link';
}

function formatMoney(value: string | null, currencyCode: string | null): string {
    const amount = Number(value ?? '');
    if (!Number.isFinite(amount)) {
        return 'Price not available';
    }

    const currency = (currencyCode ?? '').trim().toUpperCase() || 'TZS';

    return new Intl.NumberFormat('en-TZ', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

function billingLinkDetail(item: Item | null): string {
    const link = item?.billingLink;
    const linkedItem = link?.item;

    if ((item?.billingLinkStatus ?? null) === 'linked' && linkedItem) {
        return `${linkedItem.serviceName || linkedItem.serviceCode || 'Billing price'} | ${formatMoney(linkedItem.basePrice, linkedItem.currencyCode)} | Version ${linkedItem.versionNumber || 1}`;
    }

    if ((item?.billingLinkStatus ?? null) === 'pending_price') {
        return `Billing code ${link?.serviceCode || item?.billingServiceCode || 'not set'} is saved, but no active service price has been registered yet.`;
    }

    if ((item?.billingLinkStatus ?? null) === 'review_required') {
        return `Billing code ${link?.serviceCode || item?.billingServiceCode || 'not set'} exists, but the tariff is inactive, expired, or not yet live.`;
    }

    return 'This clinical item is still standalone and will not price automatically until a shared billing service code is linked.';
}

function createClinicalDefinitionForm() {
    return {
        code: '',
        name: '',
        departmentId: '',
        category: '',
        unit: '',
        billingServiceCode: '',
        description: '',
        facilityTier: '',
        standardsLocal: '',
        standardsNhif: '',
        standardsMsd: '',
        standardsLoinc: '',
        standardsSnomedCt: '',
        standardsCpt: '',
        standardsIcd: '',
        metadataText: '{}',
        sampleType: '',
        specimenContainer: '',
        turnaroundHours: '',
        fastingRequired: '',
        modality: '',
        bodySite: '',
        contrastRequired: '',
        studyDurationMinutes: '',
        procedureClass: '',
        anesthesiaType: '',
        expectedDurationMinutes: '',
        sterilePrepRequired: '',
        strength: '',
        dosageForm: '',
        route: '',
        otcAllowed: '',
        packSize: '',
    };
}

type ClinicalDefinitionForm = ReturnType<typeof createClinicalDefinitionForm>;

function standardsCodesFromForm(form: ClinicalDefinitionForm): StandardsCodes | null {
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

function applyStandardsCodesToForm(form: ClinicalDefinitionForm, codes: StandardsCodes | null | undefined): void {
    form.standardsLocal = String(codes?.LOCAL ?? '');
    form.standardsNhif = String(codes?.NHIF ?? '');
    form.standardsMsd = String(codes?.MSD ?? '');
    form.standardsLoinc = String(codes?.LOINC ?? '');
    form.standardsSnomedCt = String(codes?.SNOMED_CT ?? '');
    form.standardsCpt = String(codes?.CPT ?? '');
    form.standardsIcd = String(codes?.ICD ?? '');
}

function itemCatalogKey(item: Item | null): CatalogKey {
    const catalogType = String(item?.catalogType ?? '').trim().toLowerCase();

    if (catalogType === 'lab_test') return 'lab-tests';
    if (catalogType === 'radiology_procedure') return 'radiology-procedures';
    if (catalogType === 'theatre_procedure') return 'theatre-procedures';
    if (catalogType === 'formulary_item') return 'formulary-items';

    return catalogKey.value;
}

function knownMetadataKeysForCatalog(key: CatalogKey): string[] {
    if (key === 'lab-tests') return ['sampleType', 'specimenContainer', 'turnaroundHours', 'fastingRequired'];
    if (key === 'radiology-procedures') return ['modality', 'bodySite', 'contrastRequired', 'studyDurationMinutes'];
    if (key === 'theatre-procedures') return ['procedureClass', 'anesthesiaType', 'expectedDurationMinutes', 'sterilePrepRequired'];

    return ['strength', 'dosageForm', 'route', 'otcAllowed', 'packSize'];
}

function metadataObject(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function metadataStringValue(metadata: Record<string, unknown>, key: string): string {
    const value = metadata[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }

    return typeof value === 'string' ? value.trim() : '';
}

function metadataBooleanSelectValue(metadata: Record<string, unknown>, key: string): '' | 'yes' | 'no' {
    const value = metadata[key];

    if (value === true) return 'yes';
    if (value === false) return 'no';

    return '';
}

function scrubMetadataForDomain(key: CatalogKey, metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
    const sanitized = metadataObject(metadata);

    for (const field of [...knownMetadataKeysForCatalog(key), 'billingServiceCode', 'billing_service_code']) {
        delete sanitized[field];
    }

    return sanitized;
}

function applyDomainMetadataToForm(form: ReturnType<typeof createClinicalDefinitionForm>, key: CatalogKey, metadata: Record<string, unknown> | null | undefined): void {
    const values = metadataObject(metadata);

    form.sampleType = '';
    form.specimenContainer = '';
    form.turnaroundHours = '';
    form.fastingRequired = '';
    form.modality = '';
    form.bodySite = '';
    form.contrastRequired = '';
    form.studyDurationMinutes = '';
    form.procedureClass = '';
    form.anesthesiaType = '';
    form.expectedDurationMinutes = '';
    form.sterilePrepRequired = '';
    form.strength = '';
    form.dosageForm = '';
    form.route = '';
    form.otcAllowed = '';
    form.packSize = '';

    if (key === 'lab-tests') {
        form.sampleType = metadataStringValue(values, 'sampleType');
        form.specimenContainer = metadataStringValue(values, 'specimenContainer');
        form.turnaroundHours = metadataStringValue(values, 'turnaroundHours');
        form.fastingRequired = metadataBooleanSelectValue(values, 'fastingRequired');
        return;
    }

    if (key === 'radiology-procedures') {
        form.modality = metadataStringValue(values, 'modality');
        form.bodySite = metadataStringValue(values, 'bodySite');
        form.contrastRequired = metadataBooleanSelectValue(values, 'contrastRequired');
        form.studyDurationMinutes = metadataStringValue(values, 'studyDurationMinutes');
        return;
    }

    if (key === 'theatre-procedures') {
        form.procedureClass = metadataStringValue(values, 'procedureClass');
        form.anesthesiaType = metadataStringValue(values, 'anesthesiaType');
        form.expectedDurationMinutes = metadataStringValue(values, 'expectedDurationMinutes');
        form.sterilePrepRequired = metadataBooleanSelectValue(values, 'sterilePrepRequired');
        return;
    }

    form.strength = metadataStringValue(values, 'strength');
    form.dosageForm = metadataStringValue(values, 'dosageForm');
    form.route = metadataStringValue(values, 'route');
    form.otcAllowed = metadataBooleanSelectValue(values, 'otcAllowed');
    form.packSize = metadataStringValue(values, 'packSize');
}

function booleanValueFromSelect(value: string): boolean | null {
    if (value === 'yes') return true;
    if (value === 'no') return false;

    return null;
}

function appendIfPresent(target: Record<string, unknown>, key: string, value: string): void {
    const normalized = value.trim();
    if (normalized !== '') {
        target[key] = normalized;
    }
}

function buildKnownDomainMetadata(form: ReturnType<typeof createClinicalDefinitionForm>, key: CatalogKey): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    if (key === 'lab-tests') {
        appendIfPresent(metadata, 'sampleType', form.sampleType);
        appendIfPresent(metadata, 'specimenContainer', form.specimenContainer);
        appendIfPresent(metadata, 'turnaroundHours', form.turnaroundHours);
        const fastingRequired = booleanValueFromSelect(form.fastingRequired);
        if (fastingRequired !== null) metadata.fastingRequired = fastingRequired;
        return metadata;
    }

    if (key === 'radiology-procedures') {
        appendIfPresent(metadata, 'modality', form.modality);
        appendIfPresent(metadata, 'bodySite', form.bodySite);
        appendIfPresent(metadata, 'studyDurationMinutes', form.studyDurationMinutes);
        const contrastRequired = booleanValueFromSelect(form.contrastRequired);
        if (contrastRequired !== null) metadata.contrastRequired = contrastRequired;
        return metadata;
    }

    if (key === 'theatre-procedures') {
        appendIfPresent(metadata, 'procedureClass', form.procedureClass);
        appendIfPresent(metadata, 'anesthesiaType', form.anesthesiaType);
        appendIfPresent(metadata, 'expectedDurationMinutes', form.expectedDurationMinutes);
        const sterilePrepRequired = booleanValueFromSelect(form.sterilePrepRequired);
        if (sterilePrepRequired !== null) metadata.sterilePrepRequired = sterilePrepRequired;
        return metadata;
    }

    appendIfPresent(metadata, 'strength', form.strength);
    appendIfPresent(metadata, 'dosageForm', form.dosageForm);
    appendIfPresent(metadata, 'route', form.route);
    appendIfPresent(metadata, 'packSize', form.packSize);
    const otcAllowed = booleanValueFromSelect(form.otcAllowed);
    if (otcAllowed !== null) metadata.otcAllowed = otcAllowed;

    return metadata;
}

function positiveWholeNumberError(value: string, label: string): string[] | null {
    const normalized = value.trim();
    if (normalized === '') return null;
    if (!/^\d+$/.test(normalized) || Number(normalized) <= 0) {
        return [`${label} must be a whole number greater than 0.`];
    }

    return null;
}

function applyDomainValidation(errors: Record<string, string[]>, form: ReturnType<typeof createClinicalDefinitionForm>, key: CatalogKey): void {
    if (key === 'lab-tests') {
        const turnaroundHoursError = positiveWholeNumberError(form.turnaroundHours, 'Turnaround hours');
        if (turnaroundHoursError) errors.turnaroundHours = turnaroundHoursError;
        return;
    }

    if (key === 'radiology-procedures') {
        const studyDurationMinutesError = positiveWholeNumberError(form.studyDurationMinutes, 'Study duration minutes');
        if (studyDurationMinutesError) errors.studyDurationMinutes = studyDurationMinutesError;
        return;
    }

    if (key === 'theatre-procedures') {
        const expectedDurationMinutesError = positiveWholeNumberError(form.expectedDurationMinutes, 'Expected duration minutes');
        if (expectedDurationMinutesError) errors.expectedDurationMinutes = expectedDurationMinutesError;
    }
}

function buildMetadataPayload(form: ReturnType<typeof createClinicalDefinitionForm>, key: CatalogKey): Record<string, unknown> | null | 'invalid' {
    const extraMetadata = parseMetadata(form.metadataText);
    if (extraMetadata === 'invalid') return 'invalid';

    const metadata = {
        ...scrubMetadataForDomain(key, extraMetadata),
        ...buildKnownDomainMetadata(form, key),
    };

    return Object.keys(metadata).length > 0 ? metadata : null;
}

function domainMetadataSummary(item: Item | null): string {
    if (!item) return 'Domain-specific workflow details not set.';

    const key = itemCatalogKey(item);
    const metadata = metadataObject(item.metadata);
    const parts: string[] = [];

    if (key === 'lab-tests') {
        if (metadataStringValue(metadata, 'sampleType')) parts.push(`Specimen ${metadataStringValue(metadata, 'sampleType')}`);
        if (metadataStringValue(metadata, 'specimenContainer')) parts.push(`Container ${metadataStringValue(metadata, 'specimenContainer')}`);
        if (metadataStringValue(metadata, 'turnaroundHours')) parts.push(`TAT ${metadataStringValue(metadata, 'turnaroundHours')}h`);
        if (metadataBooleanSelectValue(metadata, 'fastingRequired')) parts.push(`Fasting ${metadataBooleanSelectValue(metadata, 'fastingRequired') === 'yes' ? 'required' : 'not required'}`);
    } else if (key === 'radiology-procedures') {
        if (metadataStringValue(metadata, 'modality')) parts.push(`Modality ${metadataStringValue(metadata, 'modality')}`);
        if (metadataStringValue(metadata, 'bodySite')) parts.push(`Site ${metadataStringValue(metadata, 'bodySite')}`);
        if (metadataStringValue(metadata, 'studyDurationMinutes')) parts.push(`${metadataStringValue(metadata, 'studyDurationMinutes')} min`);
        if (metadataBooleanSelectValue(metadata, 'contrastRequired')) parts.push(`Contrast ${metadataBooleanSelectValue(metadata, 'contrastRequired') === 'yes' ? 'required' : 'not required'}`);
    } else if (key === 'theatre-procedures') {
        if (metadataStringValue(metadata, 'procedureClass')) parts.push(`Class ${metadataStringValue(metadata, 'procedureClass')}`);
        if (metadataStringValue(metadata, 'anesthesiaType')) parts.push(`Anaesthesia ${metadataStringValue(metadata, 'anesthesiaType')}`);
        if (metadataStringValue(metadata, 'expectedDurationMinutes')) parts.push(`${metadataStringValue(metadata, 'expectedDurationMinutes')} min`);
        if (metadataBooleanSelectValue(metadata, 'sterilePrepRequired')) parts.push(`Sterile prep ${metadataBooleanSelectValue(metadata, 'sterilePrepRequired') === 'yes' ? 'required' : 'not required'}`);
    } else {
        if (metadataStringValue(metadata, 'strength')) parts.push(metadataStringValue(metadata, 'strength'));
        if (metadataStringValue(metadata, 'dosageForm')) parts.push(metadataStringValue(metadata, 'dosageForm'));
        if (metadataStringValue(metadata, 'route')) parts.push(`Route ${metadataStringValue(metadata, 'route')}`);
        if (metadataStringValue(metadata, 'packSize')) parts.push(`Pack ${metadataStringValue(metadata, 'packSize')}`);
        if (metadataBooleanSelectValue(metadata, 'otcAllowed')) parts.push(metadataBooleanSelectValue(metadata, 'otcAllowed') === 'yes' ? 'OTC allowed' : 'Restricted');
    }

    return parts.length > 0 ? parts.join(' | ') : 'Domain-specific workflow details not set.';
}

const catalogScopeText = computed(() => `${counts.value.total} ${catalog.value.label.toLowerCase()} in scope`);
const listFilterHintText = computed(() =>
    filterCount.value > 0 ? `${filterCount.value} filters applied` : 'Use filters for category or page size',
);
const filterCount = computed(() => {
    let count = 0;
    if (filters.q.trim()) count += 1;
    if (filters.status) count += 1;
    if (filters.category.trim()) count += 1;
    if (filters.perPage !== 15) count += 1;
    return count;
});
const filterChips = computed(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];

    if (filters.q.trim()) {
        chips.push({
            key: 'q',
            label: `"${filters.q.trim()}"`,
            clear: () => {
                filters.q = '';
                filters.page = 1;
                void loadItems();
            },
        });
    }
    if (filters.status) {
        chips.push({
            key: 'status',
            label: formatEnumLabel(filters.status),
            clear: () => {
                filters.status = '';
                filters.page = 1;
                void loadItems();
            },
        });
    }
    if (filters.category.trim()) {
        chips.push({
            key: 'category',
            label: filters.category.trim(),
            clear: () => {
                filters.category = '';
                filters.page = 1;
                void loadItems();
            },
        });
    }
    if (filters.perPage !== 15) {
        chips.push({
            key: 'perPage',
            label: `${filters.perPage} per page`,
            clear: () => {
                filters.perPage = 15;
                filters.page = 1;
                void loadItems();
            },
        });
    }

    return chips;
});
const createButtonLabel = computed(() => `Create ${catalog.value.singular.toLowerCase()}`);
const canPrev = computed(() => (pager.value?.currentPage ?? 1) > 1);
const canNext = computed(() => !!pager.value && pager.value.currentPage < pager.value.lastPage);
const paginationPageNumbers = computed((): (number | '...')[] => {
    const total = pager.value?.lastPage ?? 1;
    const current = pager.value?.currentPage ?? 1;
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

const clinicalCatalogTabs = [
    { key: 'lab-tests' as const, label: 'Lab Tests', icon: 'flask-conical' as const },
    { key: 'radiology-procedures' as const, label: 'Radiology', icon: 'file-text' as const },
    { key: 'theatre-procedures' as const, label: 'Theatre', icon: 'scissors' as const },
    { key: 'formulary-items' as const, label: 'Medicines', icon: 'pill' as const },
] as const;

const activeCatalogTab = computed(() => clinicalCatalogTabs.find((tab) => tab.key === catalogKey.value) ?? clinicalCatalogTabs[0]);
const pageItemIds = computed(() =>
    items.value.map((item) => String(item.id ?? '').trim()).filter((id) => id.length > 0),
);
const selectedCount = computed(() => selectedItemIds.value.length);
const allVisibleSelected = computed(
    () => pageItemIds.value.length > 0 && pageItemIds.value.every((id) => selectedItemIds.value.includes(id)),
);
const canUseBulkSelection = computed(() => canRead.value && canManage.value);
const bulkStatusDialogTitle = computed(() => {
    if (bulkStatusTarget.value === 'retired') return 'Retire selected definitions';
    if (bulkStatusTarget.value === 'inactive') return 'Deactivate selected definitions';
    return 'Activate selected definitions';
});
const detailsSheetTabGridClass = computed(() => (canAudit.value ? 'grid-cols-2' : 'grid-cols-1'));
const editSheetTitle = computed(() => `Edit ${catalog.value.singular.toLowerCase()}`);
const selectedDepartmentLabel = computed(() => {
    const departmentId = String(selected.value?.departmentId ?? '').trim();
    if (!departmentId) return 'Not linked';

    const match = departments.value.find((department) => String(department.id ?? '').trim() === departmentId);
    if (!match) return departmentId;

    const code = String(match.code ?? '').trim();
    const name = String(match.name ?? '').trim();

    return code && name ? `${code} - ${name}` : name || code || departmentId;
});

const selectedCatalogKey = computed<CatalogKey>(() => itemCatalogKey(selected.value));
const supportsConsumptionRecipe = computed(() => selected.value !== null && selectedCatalogKey.value !== 'formulary-items');
const selectedConsumptionInventoryItem = computed(() => (
    consumptionInventoryOptions.value.find((item) => item.id === consumptionRecipeForm.inventoryItemId) ?? null
));
const consumptionRecipePayload = computed(() => consumptionRecipeItems.value.map((item) => ({
    inventoryItemId: item.inventoryItemId,
    quantityPerOrder: item.quantityPerOrder,
    unit: item.unit,
    wasteFactorPercent: item.wasteFactorPercent,
    consumptionStage: item.consumptionStage,
    notes: item.notes,
})));
const consumptionRecipeSummary = computed(() => {
    const count = consumptionRecipeItems.value.length;
    if (count === 0) return 'No stock recipe defined yet';

    return `${count} stock line${count === 1 ? '' : 's'} defined`;
});
const consumptionRecipeValidationMessage = computed(() => {
    const errors = consumptionRecipeErrors.value;

    return firstError(errors, 'recipeForm') || firstError(errors, 'items') || Object.values(errors)[0]?.[0] || null;
});

function setStatus(status: '' | CatalogStatus): void {
    filters.status = status;
    filters.page = 1;
    void loadItems();
}

function openCreateSheet(): void {
    resetCreateForm();
    createErrors.value = {};
    createSheetOpen.value = true;
}

function closeCreateSheet(open?: boolean): void {
    if (open === true) {
        createSheetOpen.value = true;
        return;
    }
    createSheetOpen.value = false;
}

function applyFiltersFromSheet(): void {
    filtersSheetOpen.value = false;
    search();
}

function resetFiltersFromSheet(): void {
    filtersSheetOpen.value = false;
    resetFilters();
}

function goToPage(page: number): void {
    filters.page = page;
    void loadItems();
}

function parseMetadata(text: string): Record<string, unknown> | null | 'invalid' {
    const v = text.trim();
    if (!v) return null;
    try {
        const p = JSON.parse(v) as unknown;
        return p !== null && !Array.isArray(p) && typeof p === 'object' ? (p as Record<string, unknown>) : 'invalid';
    } catch {
        return 'invalid';
    }
}

function jsonPreview(value: unknown): string {
    try {
        return JSON.stringify(value ?? {}, null, 2);
    } catch {
        return '{}';
    }
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
    path: string,
    options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options?.query ?? {}).forEach(([k, v]) => {
        if (v === null || v === '') return;
        url.searchParams.set(k, String(v));
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
    const payload = (await response.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> };
    if (!response.ok) {
        const err = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiError;
        err.status = response.status;
        err.payload = payload;
        throw err;
    }

    return payload as T;
}

function resetCreateForm(): void {
    Object.assign(createForm, createClinicalDefinitionForm());
}

function resetConsumptionRecipeWorkspace(): void {
    consumptionRecipeLoading.value = false;
    consumptionRecipeSaving.value = false;
    consumptionRecipeError.value = null;
    consumptionRecipeErrors.value = {};
    consumptionRecipeItems.value = [];
    consumptionInventoryOptions.value = [];
    Object.assign(consumptionRecipeForm, {
        inventoryItemId: '',
        quantityPerOrder: '',
        unit: '',
        wasteFactorPercent: '0',
        consumptionStage: 'per_order',
        notes: '',
    });
}

function consumptionRecipeBasePath(key: CatalogKey): string | null {
    if (key === 'formulary-items') return null;

    return `/platform/admin/clinical-catalogs/${key}`;
}

function inventoryOptionLabel(item: ConsumptionInventoryOption | null): string {
    if (!item) return 'Select stock item';

    return `${item.itemName || 'Unnamed stock'} (${item.itemCode || 'NO-CODE'})`;
}

function updateConsumptionInventorySelection(value: unknown): void {
    const inventoryItemId = value === SELECT_NOT_SPECIFIED_VALUE ? '' : String(value);
    consumptionRecipeForm.inventoryItemId = inventoryItemId;

    const option = consumptionInventoryOptions.value.find((item) => item.id === inventoryItemId);
    if (option?.unit && !consumptionRecipeForm.unit.trim()) {
        consumptionRecipeForm.unit = option.unit;
    }
}

function addConsumptionRecipeLine(): void {
    const selectedInventoryItem = selectedConsumptionInventoryItem.value;
    if (!selectedInventoryItem || !consumptionRecipeForm.quantityPerOrder.trim()) {
        consumptionRecipeErrors.value = {
            recipeForm: ['Select an eligible stock item and enter quantity per order.'],
        };
        return;
    }

    if (consumptionRecipeItems.value.some((item) => item.inventoryItemId === selectedInventoryItem.id)) {
        consumptionRecipeErrors.value = {
            recipeForm: ['This stock item is already in the recipe. Update the existing line or remove it first.'],
        };
        return;
    }

    consumptionRecipeItems.value = [
        ...consumptionRecipeItems.value,
        {
            id: null,
            inventoryItemId: selectedInventoryItem.id,
            quantityPerOrder: consumptionRecipeForm.quantityPerOrder.trim(),
            unit: consumptionRecipeForm.unit.trim() || selectedInventoryItem.unit || 'unit',
            wasteFactorPercent: consumptionRecipeForm.wasteFactorPercent.trim() || '0',
            consumptionStage: consumptionRecipeForm.consumptionStage || 'per_order',
            isActive: true,
            notes: consumptionRecipeForm.notes.trim() || null,
            inventoryItem: selectedInventoryItem,
        },
    ];
    consumptionRecipeErrors.value = {};
    Object.assign(consumptionRecipeForm, {
        inventoryItemId: '',
        quantityPerOrder: '',
        unit: '',
        wasteFactorPercent: '0',
        consumptionStage: 'per_order',
        notes: '',
    });
}

function removeConsumptionRecipeLine(inventoryItemId: string): void {
    consumptionRecipeItems.value = consumptionRecipeItems.value.filter((item) => item.inventoryItemId !== inventoryItemId);
}

async function loadConsumptionRecipe(item: Item): Promise<void> {
    const key = itemCatalogKey(item);
    const path = consumptionRecipeBasePath(key);
    const id = String(item.id ?? '').trim();
    if (!path || !id) {
        resetConsumptionRecipeWorkspace();
        return;
    }

    consumptionRecipeLoading.value = true;
    consumptionRecipeError.value = null;
    consumptionRecipeErrors.value = {};

    try {
        const [recipeResponse, optionsResponse] = await Promise.all([
            apiRequest<ConsumptionRecipeResponse>('GET', `${path}/${id}/consumption-recipe`),
            apiRequest<ConsumptionInventoryOptionsResponse>('GET', `${path}/consumption-inventory-options`, { query: { limit: 150 } }),
        ]);
        consumptionRecipeItems.value = recipeResponse.data.items ?? [];
        consumptionInventoryOptions.value = optionsResponse.data ?? [];
    } catch (error) {
        consumptionRecipeError.value = messageFromUnknown(error, 'Unable to load consumption recipe.');
        consumptionRecipeItems.value = [];
        consumptionInventoryOptions.value = [];
    } finally {
        consumptionRecipeLoading.value = false;
    }
}

async function saveConsumptionRecipe(): Promise<void> {
    const id = String(selected.value?.id ?? '').trim();
    const path = consumptionRecipeBasePath(selectedCatalogKey.value);
    if (!id || !path || !canManage.value || consumptionRecipeSaving.value) return;

    consumptionRecipeSaving.value = true;
    consumptionRecipeError.value = null;
    consumptionRecipeErrors.value = {};

    try {
        const response = await apiRequest<ConsumptionRecipeResponse>('PUT', `${path}/${id}/consumption-recipe`, {
            body: { items: consumptionRecipePayload.value },
        });
        consumptionRecipeItems.value = response.data.items ?? [];
        recipeSheetOpen.value = false;
        notifySuccess('Consumption recipe saved.');
        if (canAudit.value) {
            auditLogs.value = [];
            auditPager.value = null;
            await loadAudit(1);
        }
    } catch (error) {
        const apiError = error as ApiError;
        if (apiError.status === 422 && apiError.payload?.errors) consumptionRecipeErrors.value = apiError.payload.errors;
        else consumptionRecipeError.value = messageFromUnknown(error, 'Unable to save consumption recipe.');
    } finally {
        consumptionRecipeSaving.value = false;
    }
}

async function loadCounts(): Promise<void> {
    try {
        const response = await apiRequest<{ data: Counts }>('GET', `${base.value}/status-counts`, {
            query: { q: filters.q.trim() || null, category: filters.category.trim() || null },
        });
        counts.value = response.data ?? { active: 0, inactive: 0, retired: 0, other: 0, total: 0 };
    } catch {
        counts.value = { active: 0, inactive: 0, retired: 0, other: 0, total: 0 };
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
        pager.value = null;
        loading.value = false;
        listLoading.value = false;
        return;
    }

    listLoading.value = true;
    listError.value = null;

    try {
        const [response] = await Promise.all([
            apiRequest<{ data: Item[]; meta: Pager }>('GET', base.value, {
                query: {
                    q: filters.q.trim() || null,
                    status: filters.status || null,
                    category: filters.category.trim() || null,
                    perPage: filters.perPage,
                    page: filters.page,
                },
            }),
            loadCounts(),
        ]);

        items.value = response.data ?? [];
        pager.value = response.meta ?? null;
    } catch (error) {
        listError.value = messageFromUnknown(error, 'Unable to load clinical catalog items.');
        items.value = [];
        pager.value = null;
    } finally {
        listLoading.value = false;
        loading.value = false;
    }
}

function search(): void {
    filters.page = 1;
    void loadItems();
}

function resetFilters(): void {
    filters.q = '';
    filters.status = '';
    filters.category = '';
    filters.perPage = 15;
    filters.page = 1;
    void loadItems();
}

function prevPage(): void {
    if ((pager.value?.currentPage ?? 1) <= 1) return;
    filters.page -= 1;
    void loadItems();
}

function nextPage(): void {
    if (!pager.value || pager.value.currentPage >= pager.value.lastPage) return;
    filters.page += 1;
    void loadItems();
}

function hydrateEdit(item: Item): void {
    const key = itemCatalogKey(item);
    const baseMetadata = scrubMetadataForDomain(key, item.metadata ?? {});

    Object.assign(editForm, createClinicalDefinitionForm(), {
        code: item.code ?? '',
        name: item.name ?? '',
        departmentId: item.departmentId ?? '',
        category: item.category ?? '',
        unit: item.unit ?? '',
        billingServiceCode: item.billingServiceCode ?? '',
        description: item.description ?? '',
        facilityTier: item.facilityTier ?? '',
        metadataText: jsonPreview(baseMetadata),
    });
    applyStandardsCodesToForm(editForm, item.codes);
    applyDomainMetadataToForm(editForm, key, item.metadata ?? {});
    statusForm.status = (item.status ?? 'active') as CatalogStatus;
    statusForm.reason = item.statusReason ?? '';
}

function syncItem(updated: Item): void {
    const index = items.value.findIndex((x) => x.id === updated.id);
    if (index >= 0) items.value[index] = updated;
}

async function createItem(): Promise<void> {
    if (!canManage.value || createBusy.value) return;

    createBusy.value = true;
    createErrors.value = {};
    const metadata = buildMetadataPayload(createForm, catalogKey.value);
    const localErrors: Record<string, string[]> = {};
    if (!createForm.code.trim()) localErrors.code = ['Code is required.'];
    if (!createForm.name.trim()) localErrors.name = ['Name is required.'];
    if (metadata === 'invalid') localErrors.metadata = ['Additional metadata must be a valid JSON object.'];
    applyDomainValidation(localErrors, createForm, catalogKey.value);
    if (Object.keys(localErrors).length) {
        createErrors.value = localErrors;
        createBusy.value = false;
        return;
    }

    try {
        await apiRequest('POST', base.value, {
            body: {
                code: createForm.code.trim(),
                name: createForm.name.trim(),
                departmentId: createForm.departmentId.trim() || null,
                category: createForm.category.trim() || null,
                unit: createForm.unit.trim() || null,
                billingServiceCode: createForm.billingServiceCode.trim() || null,
                description: createForm.description.trim() || null,
                facilityTier: createForm.facilityTier.trim() || null,
                codes: standardsCodesFromForm(createForm),
                metadata,
            },
        });
        resetCreateForm();
        createSheetOpen.value = false;
        notifySuccess(`${catalog.value.label} item created.`);
        await loadItems();
    } catch (error) {
        const apiError = error as ApiError;
        if (apiError.status === 422 && apiError.payload?.errors) createErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to create clinical catalog item.'));
    } finally {
        createBusy.value = false;
    }
}

async function openDetails(item: Item): Promise<void> {
    const id = String(item.id ?? '').trim();
    if (!id) return;
    detailsOpen.value = true;
    editSheetOpen.value = false;
    statusSheetOpen.value = false;
    recipeSheetOpen.value = false;
    detailsLoading.value = true;
    detailsError.value = null;
    detailsSheetTab.value = 'overview';
    selected.value = item;
    hydrateEdit(item);
    auditLogs.value = [];
    auditPager.value = null;
    resetConsumptionRecipeWorkspace();

    try {
        const response = await apiRequest<{ data: Item }>('GET', `${base.value}/${id}`);
        selected.value = response.data;
        hydrateEdit(response.data);
    } catch (error) {
        detailsError.value = messageFromUnknown(error, 'Unable to load item details.');
    } finally {
        detailsLoading.value = false;
    }
}

function closeDetails(): void {
    detailsOpen.value = false;
    editSheetOpen.value = false;
    statusSheetOpen.value = false;
    recipeSheetOpen.value = false;
    detailsSheetTab.value = 'overview';
    selected.value = null;
    resetConsumptionRecipeWorkspace();
}

function openEditSheet(): void {
    if (!selected.value || !canManage.value) return;
    editErrors.value = {};
    hydrateEdit(selected.value);
    editSheetOpen.value = true;
}

function closeEditSheet(open?: boolean): void {
    if (open === true) {
        editSheetOpen.value = true;
        return;
    }
    editSheetOpen.value = false;
}

function openStatusSheet(preset?: CatalogStatus): void {
    if (!selected.value || !canManage.value) return;
    statusErrors.value = {};
    statusForm.status = preset ?? ((selected.value.status ?? 'active') as CatalogStatus);
    statusForm.reason = selected.value.statusReason ?? '';
    statusSheetOpen.value = true;
}

function closeStatusSheet(open?: boolean): void {
    if (open === true) {
        statusSheetOpen.value = true;
        return;
    }
    statusSheetOpen.value = false;
}

async function openRecipeSheet(): Promise<void> {
    if (!selected.value || !supportsConsumptionRecipe.value) return;
    consumptionRecipeError.value = null;
    recipeSheetOpen.value = true;
    if (consumptionRecipeItems.value.length === 0 && !consumptionRecipeLoading.value) {
        await loadConsumptionRecipe(selected.value);
    }
}

function closeRecipeSheet(open?: boolean): void {
    if (open === true) {
        recipeSheetOpen.value = true;
        return;
    }
    recipeSheetOpen.value = false;
}

async function saveItem(): Promise<void> {
    const id = String(selected.value?.id ?? '').trim();
    if (!id || !canManage.value || editBusy.value) return;

    editBusy.value = true;
    editErrors.value = {};
    const metadata = buildMetadataPayload(editForm, itemCatalogKey(selected.value));
    const localErrors: Record<string, string[]> = {};
    if (!editForm.code.trim()) localErrors.code = ['Code is required.'];
    if (!editForm.name.trim()) localErrors.name = ['Name is required.'];
    if (metadata === 'invalid') localErrors.metadata = ['Additional metadata must be a valid JSON object.'];
    applyDomainValidation(localErrors, editForm, itemCatalogKey(selected.value));
    if (Object.keys(localErrors).length) {
        editErrors.value = localErrors;
        editBusy.value = false;
        return;
    }

    try {
        const response = await apiRequest<{ data: Item }>('PATCH', `${base.value}/${id}`, {
            body: {
                code: editForm.code.trim(),
                name: editForm.name.trim(),
                departmentId: editForm.departmentId.trim() || null,
                category: editForm.category.trim() || null,
                unit: editForm.unit.trim() || null,
                billingServiceCode: editForm.billingServiceCode.trim() || null,
                description: editForm.description.trim() || null,
                facilityTier: editForm.facilityTier.trim() || null,
                codes: standardsCodesFromForm(editForm),
                metadata,
            },
        });
        selected.value = response.data;
        hydrateEdit(response.data);
        syncItem(response.data);
        editSheetOpen.value = false;
        notifySuccess('Item updated.');
        await loadCounts();
    } catch (error) {
        const apiError = error as ApiError;
        if (apiError.status === 422 && apiError.payload?.errors) editErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to update item.'));
    } finally {
        editBusy.value = false;
    }
}

async function saveStatus(): Promise<void> {
    const id = String(selected.value?.id ?? '').trim();
    if (!id || !canManage.value || statusBusy.value) return;

    statusBusy.value = true;
    statusErrors.value = {};
    const reason = statusForm.reason.trim();
    if ((statusForm.status === 'inactive' || statusForm.status === 'retired') && !reason) {
        statusErrors.value = { reason: ['Reason is required when status is inactive or retired.'] };
        statusBusy.value = false;
        return;
    }

    try {
        const response = await apiRequest<{ data: Item }>('PATCH', `${base.value}/${id}/status`, { body: { status: statusForm.status, reason: reason || null } });
        selected.value = response.data;
        hydrateEdit(response.data);
        syncItem(response.data);
        statusSheetOpen.value = false;
        notifySuccess('Status updated.');
        await loadCounts();
    } catch (error) {
        const apiError = error as ApiError;
        if (apiError.status === 422 && apiError.payload?.errors) statusErrors.value = apiError.payload.errors;
        else notifyError(messageFromUnknown(error, 'Unable to update status.'));
    } finally {
        statusBusy.value = false;
    }
}

async function loadAudit(page = 1): Promise<void> {
    if (!canAudit.value) return;
    const id = String(selected.value?.id ?? '').trim();
    if (!id) return;

    auditBusy.value = true;
    auditError.value = null;
    auditFilters.page = page;

    try {
        const response = await apiRequest<{ data: AuditLog[]; meta: Pager }>('GET', `${base.value}/${id}/audit-logs`, {
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
        auditPager.value = response.meta ?? null;
    } catch (error) {
        auditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
        auditLogs.value = [];
        auditPager.value = null;
    } finally {
        auditBusy.value = false;
    }
}

async function exportAudit(): Promise<void> {
    if (!canAudit.value || auditExportBusy.value) return;
    const id = String(selected.value?.id ?? '').trim();
    if (!id) return;

    auditExportBusy.value = true;
    try {
        const url = new URL(`/api/v1${base.value}/${id}/audit-logs/export`, window.location.origin);
        const q: Record<string, string | null> = {
            q: auditFilters.q.trim() || null,
            action: auditFilters.action.trim() || null,
            actorType: auditFilters.actorType || null,
            actorId: auditFilters.actorId.trim() || null,
            from: toApiDateTime(auditFilters.from),
            to: toApiDateTime(auditFilters.to),
        };
        Object.entries(q).forEach(([k, v]) => {
            if (!v) return;
            url.searchParams.set(k, v);
        });

        const headers: Record<string, string> = { Accept: 'text/csv,application/json', 'X-Requested-With': 'XMLHttpRequest' };
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;

        const response = await fetch(url.toString(), { method: 'GET', credentials: 'same-origin', headers });
        if (!response.ok) {
            const payload = (await response.json().catch(() => ({}))) as { message?: string };
            throw new Error(payload.message ?? `${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `clinical-catalog-audit-${catalogKey.value}-${id}.csv`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(objectUrl);
        notifySuccess('Audit CSV prepared.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export audit CSV.'));
    } finally {
        auditExportBusy.value = false;
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
    if (checked !== true) {
        const visible = new Set(pageItemIds.value);
        selectedItemIds.value = selectedItemIds.value.filter((id) => !visible.has(id));
        return;
    }

    selectedItemIds.value = Array.from(new Set([...selectedItemIds.value, ...pageItemIds.value]));
}

function openBulkStatusDialog(status: CatalogStatus): void {
    if (!canManage.value || selectedCount.value === 0) {
        return;
    }

    bulkStatusTarget.value = status;
    bulkStatusReason.value = '';
    bulkStatusError.value = null;
    bulkStatusDialogOpen.value = true;
}

async function submitBulkStatusDialog(): Promise<void> {
    if (!canManage.value || !bulkStatusTarget.value || selectedCount.value === 0 || bulkStatusBusy.value) {
        return;
    }

    if (selectedCount.value > CLINICAL_CATALOG_BULK_MAX_STATUS_IDS) {
        bulkStatusError.value = `Select up to ${CLINICAL_CATALOG_BULK_MAX_STATUS_IDS} items for bulk status changes.`;
        return;
    }

    bulkStatusBusy.value = true;
    bulkStatusError.value = null;

    try {
        const response = await apiRequest<{
            data: { updatedCount: number; skippedItemIds: string[]; failed: Array<{ itemId: string; message: string }> };
        }>('PATCH', `${base.value}/bulk-status`, {
            body: {
                itemIds: selectedItemIds.value,
                status: bulkStatusTarget.value,
                reason: bulkStatusReason.value.trim() || null,
            },
        });

        const failedCount = response.data.failed?.length ?? 0;
        const skippedCount = response.data.skippedItemIds?.length ?? 0;
        notifySuccess(
            `${response.data.updatedCount ?? 0} updated${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}${failedCount > 0 ? `, ${failedCount} failed` : ''}.`,
        );
        bulkStatusDialogOpen.value = false;
        clearSelectedItems();
        await Promise.all([loadItems(), loadStatusCounts()]);
    } catch (error) {
        bulkStatusError.value = messageFromUnknown(error, 'Unable to apply bulk status change.');
        notifyError(bulkStatusError.value);
    } finally {
        bulkStatusBusy.value = false;
    }
}

watch(catalogKey, () => {
    loading.value = true;
    clearSelectedItems();
    closeDetails();
    closeCreateSheet();
    resetCreateForm();
    createErrors.value = {};
    filters.page = 1;
    void loadItems();
});

watch(
    () => [detailsOpen.value, detailsSheetTab.value, selected.value?.id ?? null] as const,
    ([open, tab, itemId]) => {
        if (!open || !itemId || tab !== 'audit' || !canAudit.value) return;
        if (auditBusy.value || auditLogs.value.length > 0 || auditPager.value !== null) return;
        void loadAudit(1);
    },
);

onMounted(() => {
    void Promise.all([loadItems(), loadDepartments()]);
});
</script>

<template>
    <Head :title="`Clinical Care Catalogs · ${catalog.label}`" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <!-- Page header -->
            <section class="rounded-lg border border-border bg-card shadow-sm">
                <div class="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:gap-6">
                    <div class="flex min-w-0 items-center gap-3">
                        <div
                            class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                            aria-hidden="true"
                        >
                            <AppIcon name="book-open" class="size-5" />
                        </div>
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-center gap-2">
                                <h1 class="text-base font-semibold tracking-tight md:text-lg">
                                    Clinical Care Catalogs
                                </h1>
                                <Badge
                                    v-if="clinicalCatalogReadOnly"
                                    variant="outline"
                                    class="h-5 px-1.5 text-[10px] font-medium"
                                >
                                    View only
                                </Badge>
                            </div>
                            <p class="truncate text-xs text-muted-foreground">
                                {{ workspaceIntroText }}
                            </p>
                            <div class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5 text-xs text-muted-foreground">
                                <span class="inline-flex items-center gap-1">
                                    <AppIcon name="building-2" class="size-3 opacity-75" aria-hidden="true" />
                                    <span class="font-medium text-foreground">
                                        {{ scope?.facility?.name || 'No facility' }}
                                    </span>
                                </span>
                                <span class="select-none text-border" aria-hidden="true">·</span>
                                <span>{{ scope?.tenant?.name || 'No tenant' }}</span>
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
                        <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                            <AppIcon name="plus" class="size-3.5" />
                            {{ createButtonLabel }}
                        </Button>
                        <Button
                            v-if="canRead"
                            variant="outline"
                            size="sm"
                            class="h-8 gap-1.5"
                            @click="bulkSheetOpen = true"
                        >
                            <AppIcon name="layout-grid" class="size-3.5" />
                            Bulk workspace
                        </Button>
                        <Button variant="outline" size="sm" as-child class="h-8 gap-1.5">
                            <Link href="/billing-service-catalog">
                                <AppIcon name="receipt" class="size-3.5" />
                                Billable catalog
                            </Link>
                        </Button>
                    </div>
                </div>

                <div v-if="canRead" class="border-t px-4 pb-4 pt-4 md:px-4">
                    <p id="clinical-catalog-domain-label" class="mb-2.5 text-xs font-semibold text-foreground">
                        Catalog domain
                    </p>
                    <div
                        class="grid grid-cols-2 gap-2 sm:grid-cols-4"
                        role="tablist"
                        aria-labelledby="clinical-catalog-domain-label"
                    >
                        <button
                            v-for="tab in clinicalCatalogTabs"
                            :key="tab.key"
                            type="button"
                            role="tab"
                            :aria-selected="catalogKey === tab.key"
                            class="flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            :class="
                                catalogKey === tab.key
                                    ? 'border-primary bg-primary text-primary-foreground shadow-md'
                                    : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent'
                            "
                            @click="catalogKey = tab.key"
                        >
                            <AppIcon
                                :name="tab.icon"
                                class="size-4 shrink-0"
                                :class="catalogKey === tab.key ? 'text-primary-foreground' : 'text-muted-foreground'"
                            />
                            <span>{{ tab.label }}</span>
                        </button>
                    </div>
                </div>
            </section>

            <Alert v-if="!permissionsResolved">
                <AlertTitle class="flex items-center gap-2"><AppIcon name="loader-circle" class="size-4 animate-spin" /> Resolving access</AlertTitle>
                <AlertDescription>Permission context is still loading.</AlertDescription>
            </Alert>
            <Alert v-else-if="canRead && scopeUnresolved" variant="destructive">
                <AlertTitle class="flex items-center gap-2"><AppIcon name="alert-triangle" class="size-4" /> Scope unresolved</AlertTitle>
                <AlertDescription>Resolve tenant/facility scope before editing catalog items.</AlertDescription>
            </Alert>

            <!-- Single column layout -->
            <div class="flex min-w-0 flex-col gap-4">

            <Card v-if="canRead" class="flex min-h-0 flex-1 flex-col rounded-lg border-sidebar-border/70 shadow-sm">
                <div class="flex flex-col gap-3 border-b px-4 py-3">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div class="min-w-0">
                            <h3 class="flex items-center gap-2 text-sm font-semibold leading-none">
                                <AppIcon :name="activeCatalogTab.icon" class="size-4 text-primary" />
                                {{ catalog.label }}
                            </h3>
                            <p class="mt-1 text-xs text-muted-foreground">
                                {{ catalogScopeText }} · {{ listFilterHintText }}
                            </p>
                        </div>
                        <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-2xl">
                            <SearchInput
                                v-model="filters.q"
                                :placeholder="`Search code, name, or ${catalog.categoryLabel.toLowerCase()}`"
                                class="min-w-0 flex-1 text-xs [&_input]:h-8"
                                @keyup.enter="search"
                            />
                            <Button variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs" @click="filtersSheetOpen = true">
                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                Filters
                                <Badge v-if="filterCount > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
                                    {{ filterCount }}
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
                                id="clinical-catalog-select-page"
                                :model-value="allVisibleSelected"
                                :disabled="pageItemIds.length === 0 || bulkStatusBusy"
                                @update:model-value="toggleSelectAllVisible"
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
                            :class="{ 'border-primary bg-primary/5': filters.status === '' }"
                            @click="setStatus('')"
                        >
                            <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
                            <span class="font-medium tabular-nums">{{ counts.total }}</span>
                            <span class="text-muted-foreground">All</span>
                        </button>
                        <button
                            type="button"
                            class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                            :class="{ 'border-primary bg-primary/5': filters.status === 'active' }"
                            @click="setStatus('active')"
                        >
                            <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            <span class="font-medium tabular-nums">{{ counts.active }}</span>
                            <span class="text-muted-foreground">Active</span>
                        </button>
                        <button
                            type="button"
                            class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                            :class="{ 'border-primary bg-primary/5': filters.status === 'inactive' }"
                            @click="setStatus('inactive')"
                        >
                            <span class="inline-block h-2 w-2 rounded-full bg-amber-500" />
                            <span class="font-medium tabular-nums">{{ counts.inactive }}</span>
                            <span class="text-muted-foreground">Inactive</span>
                        </button>
                        <button
                            type="button"
                            class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                            :class="{ 'border-primary bg-primary/5': filters.status === 'retired' }"
                            @click="setStatus('retired')"
                        >
                            <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
                            <span class="font-medium tabular-nums">{{ counts.retired }}</span>
                            <span class="text-muted-foreground">Retired</span>
                        </button>
                    </div>
                </div>
                <div v-if="filterChips.length" class="flex flex-wrap items-center gap-1.5 border-b px-4 py-2">
                    <span class="text-[11px] text-muted-foreground">Filters:</span>
                    <button
                        v-for="chip in filterChips"
                        :key="chip.key"
                        type="button"
                        class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                        @click="chip.clear"
                    >
                        {{ chip.label }}
                        <AppIcon name="circle-x" class="size-3" />
                    </button>
                    <button class="ml-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline" @click="resetFilters">
                        Clear all
                    </button>
                </div>
                <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="min-h-[12rem]">
                            <Alert v-if="listError" variant="destructive" class="m-4">
                                <AlertTitle>List load issue</AlertTitle>
                                <AlertDescription>{{ listError }}</AlertDescription>
                            </Alert>
                            <div v-else-if="loading || listLoading" class="divide-y px-4">
                                <div v-for="index in 6" :key="`clinical-skeleton-${index}`" class="flex items-center gap-3 py-3">
                                    <Skeleton class="size-2 shrink-0 rounded-full" />
                                    <div class="min-w-0 flex-1 space-y-2">
                                        <Skeleton class="h-4 w-48" />
                                        <Skeleton class="h-3.5 w-64 max-w-full" />
                                    </div>
                                    <Skeleton class="hidden h-5 w-20 shrink-0 rounded-full sm:block" />
                                    <Skeleton class="h-8 w-16 shrink-0 rounded-md" />
                                </div>
                            </div>
                            <div v-else-if="items.length === 0" class="flex flex-col items-center gap-3 px-4 py-10 text-center">
                                <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
                                    <AppIcon :name="activeCatalogTab.icon" class="size-4 text-muted-foreground" />
                                </div>
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">No {{ catalog.label.toLowerCase() }} found</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            filterCount > 0
                                                ? 'Adjust or clear filters to widen the catalog.'
                                                : `Create the first ${catalog.singular.toLowerCase()} before linking prices in the billable catalog.`
                                        }}
                                    </p>
                                </div>
                                <div class="flex flex-wrap justify-center gap-2">
                                    <Button v-if="filterCount > 0" variant="outline" size="sm" class="h-8 gap-1.5" @click="resetFilters">
                                        <AppIcon name="x" class="size-3.5" />
                                        Clear filters
                                    </Button>
                                    <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                                        <AppIcon name="plus" class="size-3.5" />
                                        {{ createButtonLabel }}
                                    </Button>
                                </div>
                            </div>
                            <div v-else class="divide-y px-4">
                                <div
                                    v-for="item in items"
                                    :key="String(item.id)"
                                    class="flex items-center gap-3 py-3 transition-colors hover:bg-muted/30"
                                >
                                    <Checkbox
                                        v-if="canUseBulkSelection"
                                        class="shrink-0"
                                        :model-value="selectedItemIds.includes(String(item.id ?? ''))"
                                        :disabled="!item.id || bulkStatusBusy"
                                        @update:model-value="(checked) => toggleItemSelection(String(item.id ?? ''), checked)"
                                        @click.stop
                                    />
                                    <span
                                        class="size-2 shrink-0 rounded-full"
                                        :class="
                                            (item.status ?? '').toLowerCase() === 'active'
                                                ? 'bg-emerald-500'
                                                : (item.status ?? '').toLowerCase() === 'retired'
                                                  ? 'bg-rose-500'
                                                  : 'bg-amber-500'
                                        "
                                        :title="(item.status ?? 'unknown').toString()"
                                    />
                                    <div class="min-w-0 flex-1">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="truncate text-sm font-medium">{{ item.name || 'Unnamed item' }}</p>
                                            <Badge variant="outline" class="h-5 px-1.5 text-[10px]">{{ item.code || 'NO-CODE' }}</Badge>
                                            <Badge
                                                :variant="billingLinkVariant(item.billingLinkStatus)"
                                                class="hidden h-5 px-1.5 text-[10px] sm:inline-flex"
                                            >
                                                {{ billingLinkLabel(item.billingLinkStatus) }}
                                            </Badge>
                                        </div>
                                        <p class="mt-0.5 truncate text-xs text-muted-foreground">
                                            {{ item.category || 'Category not set' }}
                                            · {{ item.unit || 'Unit not set' }}
                                            · {{ domainMetadataSummary(item) }}
                                        </p>
                                    </div>
                                    <Badge
                                        :variant="statusVariant(item.status)"
                                        class="hidden h-5 shrink-0 px-1.5 text-[10px] sm:inline-flex"
                                    >
                                        {{ formatEnumLabel(item.status) }}
                                    </Badge>
                                    <Button size="sm" variant="outline" class="h-8 shrink-0 rounded-lg text-xs" @click="openDetails(item)">
                                        View details
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    <footer class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                        <p class="text-xs text-muted-foreground">
                            <template v-if="pager">
                                Showing {{ items.length }} of {{ pager.total }} · Page {{ pager.currentPage }} of {{ pager.lastPage }}
                            </template>
                            <template v-else>No pagination data</template>
                        </p>
                        <div class="flex items-center gap-1">
                            <Button variant="outline" size="icon" class="size-8" :disabled="!canPrev || listLoading" @click="prevPage">
                                <AppIcon name="chevron-left" class="size-4" />
                            </Button>
                            <template v-for="page in paginationPageNumbers" :key="String(page)">
                                <span v-if="page === '...'" class="px-1 text-xs text-muted-foreground">…</span>
                                <Button
                                    v-else
                                    :variant="page === pager?.currentPage ? 'default' : 'ghost'"
                                    size="icon"
                                    class="size-8 text-xs"
                                    :disabled="listLoading"
                                    @click="goToPage(page as number)"
                                >
                                    {{ page }}
                                </Button>
                            </template>
                            <Button variant="outline" size="icon" class="size-8" :disabled="!canNext || listLoading" @click="nextPage">
                                <AppIcon name="chevron-right" class="size-4" />
                            </Button>
                        </div>
                    </footer>
                </CardContent>
            </Card>

            <Card v-else-if="permissionsResolved" class="rounded-lg border-sidebar-border/70">
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <AppIcon name="book-open" class="size-5 text-muted-foreground" />
                        Clinical Care Catalogs
                    </CardTitle>
                    <CardDescription>Clinical catalog access is permission restricted.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertTitle>Access restricted</AlertTitle>
                        <AlertDescription>Request <code>platform.clinical-catalog.read</code> permission.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            <Sheet v-if="canRead" :open="filtersSheetOpen" @update:open="filtersSheetOpen = $event">
                <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                    <SheetHeader>
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            Catalog filters
                        </SheetTitle>
                        <SheetDescription>Filter {{ catalog.label.toLowerCase() }} without crowding the list.</SheetDescription>
                    </SheetHeader>
                    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div class="rounded-lg border p-3">
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="clinical-filter-q">Search</Label>
                                    <Input
                                        id="clinical-filter-q"
                                        v-model="filters.q"
                                        placeholder="Code, name, or description"
                                        @keyup.enter="applyFiltersFromSheet"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="clinical-filter-status">Status</Label>
                                    <Select :model-value="clinicalStatusFilterSelectValue" @update:model-value="updateClinicalStatusFilter">
                                        <SelectTrigger id="clinical-filter-status" class="w-full">
                                            <SelectValue placeholder="All statuses" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="SELECT_ALL_VALUE">All statuses</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                            <SelectItem value="retired">Retired</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="clinical-filter-category">{{ catalog.categoryLabel }}</Label>
                                    <Input
                                        id="clinical-filter-category"
                                        v-model="filters.category"
                                        :placeholder="catalog.categoryPlaceholder"
                                        @keyup.enter="applyFiltersFromSheet"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="clinical-filter-per-page">Results per page</Label>
                                    <Select :model-value="String(filters.perPage)" @update:model-value="filters.perPage = Number($event)">
                                        <SelectTrigger id="clinical-filter-per-page" class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
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
                        <Button variant="outline" :disabled="listLoading && filterCount === 0" @click="resetFiltersFromSheet">
                            Reset filters
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Sheet v-if="canManage" :open="createSheetOpen" @update:open="closeCreateSheet">
                <SheetContent side="right" variant="workspace" size="4xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="plus" class="size-5 text-muted-foreground" />
                            {{ createButtonLabel }}
                        </SheetTitle>
                        <SheetDescription>
                            Register the clinical definition first. Link a billing service code only when automatic pricing is required.
                        </SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="grid gap-4 px-6 py-4">
                            <fieldset class="grid gap-3 rounded-lg border p-3 md:grid-cols-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground md:col-span-3">Definition identity</legend>
                                <div class="grid gap-1.5">
                                    <Label>Code</Label>
                                    <Input v-model="createForm.code" :placeholder="catalog.codePlaceholder" />
                                    <p v-if="firstError(createErrors, 'code')" class="text-xs text-destructive">{{ firstError(createErrors, 'code') }}</p>
                                </div>
                                <div class="grid gap-1.5 md:col-span-2">
                                    <Label>Name</Label>
                                    <Input v-model="createForm.name" :placeholder="catalog.namePlaceholder" />
                                    <p v-if="firstError(createErrors, 'name')" class="text-xs text-destructive">{{ firstError(createErrors, 'name') }}</p>
                                </div>
                                <ComboboxField
                                    input-id="create-clinical-definition-department"
                                    label="Department"
                                    v-model="createDepartmentFieldValue"
                                    :options="createDepartmentOptions"
                                    placeholder="Select department"
                                    search-placeholder="Search department code or name"
                                    :error-message="firstError(createErrors, 'departmentId')"
                                    :empty-text="createDepartmentEmptyText"
                                    :reserve-message-space="false"
                                />
                                <div class="grid gap-1.5">
                                    <Label>{{ catalog.categoryLabel }}</Label>
                                    <Input v-model="createForm.category" :placeholder="catalog.categoryPlaceholder" />
                                </div>
                                <div class="grid gap-1.5">
                                    <Label>{{ catalog.unitLabel }}</Label>
                                    <Input v-model="createForm.unit" :placeholder="catalog.unitPlaceholder" />
                                </div>
                                <div class="grid gap-1.5 md:col-span-3">
                                    <Label>Linked billing service code</Label>
                                    <Input v-model="createForm.billingServiceCode" placeholder="Shared code from Billable Service Catalog" />
                                    <p class="text-xs text-muted-foreground">Links to an existing billing service. Does not create a duplicate billing record.</p>
                                    <p v-if="firstError(createErrors, 'billingServiceCode')" class="text-xs text-destructive">{{ firstError(createErrors, 'billingServiceCode') }}</p>
                                </div>
                                <div class="grid gap-1.5 md:col-span-3">
                                    <Label>Description</Label>
                                    <Textarea v-model="createForm.description" class="min-h-20" placeholder="Operational guidance for care teams" />
                                </div>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">{{ catalog.domainSectionTitle }}</legend>
                                <p class="text-xs text-muted-foreground">{{ catalog.domainSectionDescription }}</p>
                                <div v-if="catalogKey === 'lab-tests'" class="grid gap-3 md:grid-cols-2">
                                    <div class="grid gap-1.5"><Label>Sample type</Label><Input v-model="createForm.sampleType" placeholder="blood" /></div>
                                    <div class="grid gap-1.5"><Label>Specimen container</Label><Input v-model="createForm.specimenContainer" placeholder="EDTA tube" /></div>
                                    <div class="grid gap-1.5"><Label>Turnaround hours</Label><Input v-model="createForm.turnaroundHours" inputmode="numeric" placeholder="4" /><p v-if="firstError(createErrors, 'turnaroundHours')" class="text-xs text-destructive">{{ firstError(createErrors, 'turnaroundHours') }}</p></div>
                                    <div class="grid gap-1.5"><Label>Fasting required</Label><Select v-model="createForm.fastingRequired"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                                </div>
                                <div v-else-if="catalogKey === 'radiology-procedures'" class="grid gap-3 md:grid-cols-2">
                                    <div class="grid gap-1.5"><Label>Modality</Label><Input v-model="createForm.modality" placeholder="ultrasound" /></div>
                                    <div class="grid gap-1.5"><Label>Body site</Label><Input v-model="createForm.bodySite" placeholder="abdomen" /></div>
                                    <div class="grid gap-1.5"><Label>Study duration minutes</Label><Input v-model="createForm.studyDurationMinutes" inputmode="numeric" placeholder="30" /><p v-if="firstError(createErrors, 'studyDurationMinutes')" class="text-xs text-destructive">{{ firstError(createErrors, 'studyDurationMinutes') }}</p></div>
                                    <div class="grid gap-1.5"><Label>Contrast required</Label><Select v-model="createForm.contrastRequired"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                                </div>
                                <div v-else-if="catalogKey === 'theatre-procedures'" class="grid gap-3 md:grid-cols-2">
                                    <div class="grid gap-1.5"><Label>Procedure class</Label><Input v-model="createForm.procedureClass" placeholder="major" /></div>
                                    <div class="grid gap-1.5"><Label>Anaesthesia type</Label><Input v-model="createForm.anesthesiaType" placeholder="general" /></div>
                                    <div class="grid gap-1.5"><Label>Expected duration minutes</Label><Input v-model="createForm.expectedDurationMinutes" inputmode="numeric" placeholder="90" /><p v-if="firstError(createErrors, 'expectedDurationMinutes')" class="text-xs text-destructive">{{ firstError(createErrors, 'expectedDurationMinutes') }}</p></div>
                                    <div class="grid gap-1.5"><Label>Sterile prep required</Label><Select v-model="createForm.sterilePrepRequired"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                                </div>
                                <div v-else class="grid gap-3 md:grid-cols-2">
                                    <div class="grid gap-1.5"><Label>Strength</Label><Input v-model="createForm.strength" placeholder="500 mg" /></div>
                                    <div class="grid gap-1.5"><Label>Dosage form</Label><Input v-model="createForm.dosageForm" placeholder="capsule" /></div>
                                    <div class="grid gap-1.5"><Label>Route</Label><Input v-model="createForm.route" placeholder="oral" /></div>
                                    <div class="grid gap-1.5"><Label>Pack size</Label><Input v-model="createForm.packSize" placeholder="10 capsules" /></div>
                                    <div class="grid gap-1.5 md:col-span-2"><Label>OTC sellable</Label><Select v-model="createForm.otcAllowed"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">OTC allowed</SelectItem><SelectItem value="no">Restricted</SelectItem></SelectContent></Select></div>
                                </div>
                            </fieldset>

                            <details class="rounded-lg border bg-muted/10 p-3">
                                <summary class="cursor-pointer text-sm font-medium">Advanced / standards</summary>
                                <div class="mt-3 space-y-3">
                                    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div class="grid gap-1.5">
                                            <Label>Minimum facility tier</Label>
                                            <Select
                                                :model-value="createForm.facilityTier || SELECT_NOT_SPECIFIED_VALUE"
                                                @update:model-value="(value) => { createForm.facilityTier = value === SELECT_NOT_SPECIFIED_VALUE ? '' : String(value); }"
                                            >
                                                <SelectTrigger class="w-full"><SelectValue placeholder="All tiers" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">All tiers</SelectItem>
                                                    <SelectItem v-for="tier in facilityTierOptions" :key="tier.value" :value="tier.value">{{ tier.label }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-1.5"><Label>Local code</Label><Input v-model="createForm.standardsLocal" placeholder="Internal code" /></div>
                                        <div class="grid gap-1.5"><Label>NHIF code</Label><Input v-model="createForm.standardsNhif" placeholder="NHIF tariff code" /></div>
                                        <div class="grid gap-1.5"><Label>MSD code</Label><Input v-model="createForm.standardsMsd" placeholder="MSD reference" /></div>
                                        <div class="grid gap-1.5"><Label>LOINC</Label><Input v-model="createForm.standardsLoinc" placeholder="Lab standard" /></div>
                                        <div class="grid gap-1.5"><Label>SNOMED CT</Label><Input v-model="createForm.standardsSnomedCt" placeholder="Clinical concept" /></div>
                                        <div class="grid gap-1.5"><Label>CPT</Label><Input v-model="createForm.standardsCpt" placeholder="Optional procedure code" /></div>
                                        <div class="grid gap-1.5"><Label>ICD</Label><Input v-model="createForm.standardsIcd" placeholder="Optional diagnosis link" /></div>
                                    </div>
                                    <div class="grid gap-1.5">
                                        <Label>Additional metadata JSON</Label>
                                        <Textarea v-model="createForm.metadataText" class="min-h-24 font-mono text-xs" />
                                        <p v-if="firstError(createErrors, 'metadata')" class="text-xs text-destructive">{{ firstError(createErrors, 'metadata') }}</p>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </ScrollArea>
                    <SheetFooter class="shrink-0 gap-2 border-t px-4 py-3">
                        <Button variant="outline" :disabled="createBusy" @click="closeCreateSheet()">Cancel</Button>
                        <Button :disabled="createBusy" @click="createItem">{{ createBusy ? 'Creating...' : createButtonLabel }}</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Sheet :open="detailsOpen" @update:open="(open) => (open ? (detailsOpen = true) : closeDetails())">
                <SheetContent side="right" variant="workspace" size="5xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader
                        v-if="selected"
                        class="shrink-0 border-b bg-background/95 px-4 py-3 pr-12 text-left sm:px-5"
                    >
                        <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2 text-base">
                            <AppIcon :name="activeCatalogTab.icon" class="size-5 text-muted-foreground" />
                            <span class="min-w-0 truncate">{{ selected.name || 'Unnamed item' }}</span>
                            <Badge v-if="selected.code" variant="outline" class="shrink-0 font-normal">{{ selected.code }}</Badge>
                            <Badge :variant="statusVariant(selected.status)" class="shrink-0 capitalize">
                                {{ formatEnumLabel(selected.status) }}
                            </Badge>
                        </SheetTitle>
                        <SheetDescription class="text-xs">
                            {{ billingLinkLabel(selected.billingLinkStatus) }}
                            · {{ selected.category || 'No category' }}
                            · {{ selected.unit || 'No unit' }}
                        </SheetDescription>
                    </SheetHeader>
                    <div class="min-h-0 flex-1 overflow-hidden">
                        <div v-if="detailsLoading && !selected" class="space-y-2 p-4">
                            <Skeleton class="h-14 w-full" />
                            <Skeleton class="h-14 w-full" />
                        </div>
                        <Alert v-else-if="detailsError && !selected" variant="destructive" class="m-4">
                            <AlertTitle>Details load issue</AlertTitle>
                            <AlertDescription>{{ detailsError }}</AlertDescription>
                        </Alert>
                        <Tabs v-else-if="selected" v-model="detailsSheetTab" class="flex h-full min-h-0 flex-col">
                            <div class="shrink-0 border-b bg-background px-4 py-2 sm:px-5">
                                <TabsList
                                    class="grid h-auto w-full gap-1 rounded-md bg-muted p-1"
                                    :class="detailsSheetTabGridClass"
                                >
                                    <TabsTrigger value="overview" class="h-9 gap-1.5 text-xs sm:text-sm">
                                        <AppIcon name="layout-grid" class="size-3.5" />
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger v-if="canAudit" value="audit" class="h-9 gap-1.5 text-xs sm:text-sm">
                                        <AppIcon name="file-text" class="size-3.5" />
                                        Audit
                                        <Badge
                                            v-if="auditPager"
                                            variant="secondary"
                                            class="h-4 min-w-4 px-1 text-xs"
                                        >
                                            {{ auditPager.total }}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                                <TabsContent value="overview" class="m-0 space-y-3 px-4 py-3 sm:px-5">
                                    <div
                                        v-if="
                                            selected.status &&
                                            selected.status.toLowerCase() !== 'active' &&
                                            selected.statusReason
                                        "
                                        class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs"
                                    >
                                        <AppIcon name="alert-triangle" class="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                        <span class="text-amber-700 dark:text-amber-300">
                                            <span class="font-semibold capitalize">{{ formatEnumLabel(selected.status) }}</span>:
                                            {{ selected.statusReason }}
                                        </span>
                                    </div>
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    Identity
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Code</span>
                                                    <span class="font-medium">{{ selected.code || '—' }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Name</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{ selected.name || '—' }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Department</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{ selectedDepartmentLabel }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">{{ catalog.categoryLabel }}</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{ selected.category || '—' }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">{{ catalog.unitLabel }}</span>
                                                    <span class="font-medium">{{ selected.unit || '—' }}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    Billing
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Linkage</span>
                                                    <Badge :variant="billingLinkVariant(selected.billingLinkStatus)" class="shrink-0">
                                                        {{ billingLinkLabel(selected.billingLinkStatus) }}
                                                    </Badge>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Service</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">
                                                        {{ selected.billingLink?.item?.serviceName || selected.billingServiceCode || '—' }}
                                                    </span>
                                                </div>
                                                <div class="py-2 text-xs text-muted-foreground">{{ billingLinkDetail(selected) }}</div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                    <Card class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none">
                                        <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                            <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                Workflow
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent class="px-3 py-3 text-sm text-muted-foreground">
                                            {{ domainMetadataSummary(selected) }}
                                        </CardContent>
                                    </Card>
                                    <Card
                                        v-if="selected.description"
                                        class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none"
                                    >
                                        <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                            <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                Description
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent class="px-3 py-3 text-sm whitespace-pre-wrap">{{ selected.description }}</CardContent>
                                    </Card>
                                    <Card v-if="supportsConsumptionRecipe" class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none">
                                        <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                            <div class="flex items-center justify-between gap-2">
                                                <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    Stock recipe
                                                </CardTitle>
                                                <Badge variant="outline">{{ consumptionRecipeSummary }}</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent class="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                                            <p class="text-sm text-muted-foreground">
                                                Physical stock consumed when this {{ domains[selectedCatalogKey].singular.toLowerCase() }} is performed.
                                            </p>
                                            <Button v-if="canManage" size="sm" variant="outline" class="gap-1.5" @click="openRecipeSheet">
                                                <AppIcon name="package" class="size-3.5" />
                                                Manage recipe
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent v-if="canAudit" value="audit" class="m-0 space-y-3 px-4 py-3 sm:px-5">
                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                        <p class="text-sm text-muted-foreground">Lifecycle trail for this definition.</p>
                                        <Button variant="outline" size="sm" :disabled="auditExportBusy" @click="exportAudit">
                                            {{ auditExportBusy ? 'Preparing...' : 'Export CSV' }}
                                        </Button>
                                    </div>
                                    <Alert v-if="auditError" variant="destructive">
                                        <AlertTitle>Audit load issue</AlertTitle>
                                        <AlertDescription>{{ auditError }}</AlertDescription>
                                    </Alert>
                                    <div v-else-if="auditBusy" class="space-y-2">
                                        <Skeleton class="h-14 w-full" />
                                        <Skeleton class="h-14 w-full" />
                                    </div>
                                    <AuditTimelineList
                                        v-else
                                        :logs="auditLogs"
                                        :format-date-time="fmtDate"
                                        empty-message="No audit logs found for this clinical definition."
                                        actor-fallback-label="User"
                                    />
                                </TabsContent>
                            </ScrollArea>
                        </Tabs>
                    </div>

                    <SheetFooter
                        class="shrink-0 flex-col-reverse gap-2 border-t bg-background px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                        <Button variant="outline" size="sm" class="gap-1.5" @click="closeDetails">
                            <AppIcon name="circle-x" class="size-3.5" />
                            Close
                        </Button>
                        <div v-if="selected" class="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button
                                v-if="canManage"
                                size="sm"
                                variant="outline"
                                class="gap-1.5"
                                @click="openStatusSheet()"
                            >
                                <AppIcon name="activity" class="size-3.5" />
                                Change status
                            </Button>
                            <Button v-if="canManage" size="sm" class="gap-1.5" @click="openEditSheet">
                                <AppIcon name="pencil" class="size-3.5" />
                                {{ editSheetTitle }}
                            </Button>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>


            
            <Sheet v-if="canManage" :open="editSheetOpen" @update:open="closeEditSheet">
                <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="pencil" class="size-5 text-muted-foreground" />
                            {{ editSheetTitle }}
                        </SheetTitle>
                        <SheetDescription v-if="selected">
                            Update {{ selected.code }} while keeping billing and audit history aligned.
                        </SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="grid gap-4 px-6 py-4">
                            <fieldset class="grid gap-3 rounded-lg border p-3 md:grid-cols-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground md:col-span-3">Definition identity</legend>
                                <div class="grid gap-1.5">
                                    <Label>Code</Label>
                                    <Input v-model="editForm.code" :placeholder="catalog.codePlaceholder" />
                                    <p v-if="firstError(editErrors, 'code')" class="text-xs text-destructive">{{ firstError(editErrors, 'code') }}</p>
                                </div>
                                <div class="grid gap-1.5 md:col-span-2">
                                    <Label>Name</Label>
                                    <Input v-model="editForm.name" :placeholder="catalog.namePlaceholder" />
                                    <p v-if="firstError(editErrors, 'name')" class="text-xs text-destructive">{{ firstError(editErrors, 'name') }}</p>
                                </div>
                                <ComboboxField
                                    input-id="edit-clinical-definition-department"
                                    label="Department"
                                    v-model="editDepartmentFieldValue"
                                    :options="editDepartmentOptions"
                                    placeholder="Select department"
                                    search-placeholder="Search department code or name"
                                    :error-message="firstError(editErrors, 'departmentId')"
                                    :empty-text="editDepartmentEmptyText"
                                    :reserve-message-space="false"
                                />
                                <div class="grid gap-1.5">
                                    <Label>{{ catalog.categoryLabel }}</Label>
                                    <Input v-model="editForm.category" :placeholder="catalog.categoryPlaceholder" />
                                </div>
                                <div class="grid gap-1.5">
                                    <Label>{{ catalog.unitLabel }}</Label>
                                    <Input v-model="editForm.unit" :placeholder="catalog.unitPlaceholder" />
                                </div>
                                <div class="grid gap-1.5 md:col-span-3">
                                    <Label>Linked billing service code</Label>
                                    <Input v-model="editForm.billingServiceCode" placeholder="Shared code from Billable Service Catalog" />
                                    <p class="text-xs text-muted-foreground">Links to an existing billing service. Does not create a duplicate billing record.</p>
                                    <p v-if="firstError(editErrors, 'billingServiceCode')" class="text-xs text-destructive">{{ firstError(editErrors, 'billingServiceCode') }}</p>
                                </div>
                                <div class="grid gap-1.5 md:col-span-3">
                                    <Label>Description</Label>
                                    <Textarea v-model="editForm.description" class="min-h-20" placeholder="Operational guidance for care teams" />
                                </div>
                            </fieldset>

                            <fieldset class="grid gap-3 rounded-lg border p-3">
                                <legend class="px-2 text-sm font-medium text-muted-foreground">{{ catalog.domainSectionTitle }}</legend>
                                <p class="text-xs text-muted-foreground">{{ catalog.domainSectionDescription }}</p>
                                <div v-if="selectedCatalogKey === 'lab-tests'" class="grid gap-3 md:grid-cols-2">
                                    <div class="grid gap-1.5"><Label>Sample type</Label><Input v-model="editForm.sampleType" placeholder="blood" /></div>
                                    <div class="grid gap-1.5"><Label>Specimen container</Label><Input v-model="editForm.specimenContainer" placeholder="EDTA tube" /></div>
                                    <div class="grid gap-1.5"><Label>Turnaround hours</Label><Input v-model="editForm.turnaroundHours" inputmode="numeric" placeholder="4" /><p v-if="firstError(editErrors, 'turnaroundHours')" class="text-xs text-destructive">{{ firstError(editErrors, 'turnaroundHours') }}</p></div>
                                    <div class="grid gap-1.5"><Label>Fasting required</Label><Select v-model="editForm.fastingRequired"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                                </div>
                                <div v-else-if="selectedCatalogKey === 'radiology-procedures'" class="grid gap-3 md:grid-cols-2">
                                    <div class="grid gap-1.5"><Label>Modality</Label><Input v-model="editForm.modality" placeholder="ultrasound" /></div>
                                    <div class="grid gap-1.5"><Label>Body site</Label><Input v-model="editForm.bodySite" placeholder="abdomen" /></div>
                                    <div class="grid gap-1.5"><Label>Study duration minutes</Label><Input v-model="editForm.studyDurationMinutes" inputmode="numeric" placeholder="30" /><p v-if="firstError(editErrors, 'studyDurationMinutes')" class="text-xs text-destructive">{{ firstError(editErrors, 'studyDurationMinutes') }}</p></div>
                                    <div class="grid gap-1.5"><Label>Contrast required</Label><Select v-model="editForm.contrastRequired"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                                </div>
                                <div v-else-if="selectedCatalogKey === 'theatre-procedures'" class="grid gap-3 md:grid-cols-2">
                                    <div class="grid gap-1.5"><Label>Procedure class</Label><Input v-model="editForm.procedureClass" placeholder="major" /></div>
                                    <div class="grid gap-1.5"><Label>Anaesthesia type</Label><Input v-model="editForm.anesthesiaType" placeholder="general" /></div>
                                    <div class="grid gap-1.5"><Label>Expected duration minutes</Label><Input v-model="editForm.expectedDurationMinutes" inputmode="numeric" placeholder="90" /><p v-if="firstError(editErrors, 'expectedDurationMinutes')" class="text-xs text-destructive">{{ firstError(editErrors, 'expectedDurationMinutes') }}</p></div>
                                    <div class="grid gap-1.5"><Label>Sterile prep required</Label><Select v-model="editForm.sterilePrepRequired"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                                </div>
                                <div v-else class="grid gap-3 md:grid-cols-2">
                                    <div class="grid gap-1.5"><Label>Strength</Label><Input v-model="editForm.strength" placeholder="500 mg" /></div>
                                    <div class="grid gap-1.5"><Label>Dosage form</Label><Input v-model="editForm.dosageForm" placeholder="capsule" /></div>
                                    <div class="grid gap-1.5"><Label>Route</Label><Input v-model="editForm.route" placeholder="oral" /></div>
                                    <div class="grid gap-1.5"><Label>Pack size</Label><Input v-model="editForm.packSize" placeholder="10 capsules" /></div>
                                    <div class="grid gap-1.5 md:col-span-2"><Label>OTC sellable</Label><Select v-model="editForm.otcAllowed"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">OTC allowed</SelectItem><SelectItem value="no">Restricted</SelectItem></SelectContent></Select></div>
                                </div>
                            </fieldset>

                            <details class="rounded-lg border bg-muted/10 p-3">
                                <summary class="cursor-pointer text-sm font-medium">Advanced / standards</summary>
                                <div class="mt-3 space-y-3">
                                    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div class="grid gap-1.5">
                                            <Label>Minimum facility tier</Label>
                                            <Select
                                                :model-value="editForm.facilityTier || SELECT_NOT_SPECIFIED_VALUE"
                                                @update:model-value="(value) => { editForm.facilityTier = value === SELECT_NOT_SPECIFIED_VALUE ? '' : String(value); }"
                                            >
                                                <SelectTrigger class="w-full"><SelectValue placeholder="All tiers" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">All tiers</SelectItem>
                                                    <SelectItem v-for="tier in facilityTierOptions" :key="tier.value" :value="tier.value">{{ tier.label }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-1.5"><Label>Local code</Label><Input v-model="editForm.standardsLocal" placeholder="Internal code" /></div>
                                        <div class="grid gap-1.5"><Label>NHIF code</Label><Input v-model="editForm.standardsNhif" placeholder="NHIF tariff code" /></div>
                                        <div class="grid gap-1.5"><Label>MSD code</Label><Input v-model="editForm.standardsMsd" placeholder="MSD reference" /></div>
                                        <div class="grid gap-1.5"><Label>LOINC</Label><Input v-model="editForm.standardsLoinc" placeholder="Lab standard" /></div>
                                        <div class="grid gap-1.5"><Label>SNOMED CT</Label><Input v-model="editForm.standardsSnomedCt" placeholder="Clinical concept" /></div>
                                        <div class="grid gap-1.5"><Label>CPT</Label><Input v-model="editForm.standardsCpt" placeholder="Optional procedure code" /></div>
                                        <div class="grid gap-1.5"><Label>ICD</Label><Input v-model="editForm.standardsIcd" placeholder="Optional diagnosis link" /></div>
                                    </div>
                                    <div class="grid gap-1.5">
                                        <Label>Additional metadata JSON</Label>
                                        <Textarea v-model="editForm.metadataText" class="min-h-24 font-mono text-xs" />
                                        <p v-if="firstError(editErrors, 'metadata')" class="text-xs text-destructive">{{ firstError(editErrors, 'metadata') }}</p>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </ScrollArea>
                    <SheetFooter class="shrink-0 gap-2 border-t px-4 py-3">
                        <Button variant="outline" :disabled="editBusy" @click="closeEditSheet()">Cancel</Button>
                        <Button :disabled="editBusy" @click="saveItem">{{ editBusy ? 'Saving...' : 'Save changes' }}</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>


            <Sheet v-if="canManage" :open="statusSheetOpen" @update:open="closeStatusSheet">
                <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="activity" class="size-5 text-muted-foreground" />
                            Change status
                        </SheetTitle>
                        <SheetDescription v-if="selected">
                            Control availability for {{ selected.name || selected.code }} without deleting history.
                        </SheetDescription>
                    </SheetHeader>
                    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                        <div v-if="selected" class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                            <span class="text-muted-foreground">Current</span>
                            <Badge :variant="statusVariant(selected.status)">{{ formatEnumLabel(selected.status) }}</Badge>
                        </div>
                        <div class="grid gap-3 rounded-lg border p-3">
                            <div class="grid gap-1.5">
                                <Label>Target status</Label>
                                <Select v-model="statusForm.status">
                                    <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="retired">Retired</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-1.5">
                                <Label>Reason</Label>
                                <Textarea v-model="statusForm.reason" class="min-h-24" placeholder="Required when setting inactive or retired" />
                                <p v-if="firstError(statusErrors, 'reason')" class="text-xs text-destructive">{{ firstError(statusErrors, 'reason') }}</p>
                            </div>
                        </div>
                    </div>
                    <SheetFooter class="shrink-0 gap-2 border-t px-4 py-3">
                        <Button variant="outline" :disabled="statusBusy" @click="closeStatusSheet()">Cancel</Button>
                        <Button :disabled="statusBusy" @click="saveStatus">{{ statusBusy ? 'Saving...' : 'Save status' }}</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Sheet v-if="canManage" :open="recipeSheetOpen" @update:open="closeRecipeSheet">
                <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="package" class="size-5 text-muted-foreground" />
                            Stock consumption recipe
                        </SheetTitle>
                        <SheetDescription v-if="selected">
                            Define inventory consumed when {{ selected.name || 'this procedure' }} is performed.
                        </SheetDescription>
                    </SheetHeader>
                    <ScrollArea class="min-h-0 flex-1">
                        <div class="space-y-4 px-4 py-4">
                            <Alert v-if="consumptionRecipeError" variant="destructive">
                                <AlertTitle>Recipe load issue</AlertTitle>
                                <AlertDescription>{{ consumptionRecipeError }}</AlertDescription>
                            </Alert>
                            <Alert v-if="consumptionRecipeValidationMessage" variant="destructive">
                                <AlertTitle>Recipe needs review</AlertTitle>
                                <AlertDescription>{{ consumptionRecipeValidationMessage }}</AlertDescription>
                            </Alert>
                            <div v-if="consumptionRecipeLoading" class="space-y-2">
                                <Skeleton class="h-12 w-full" />
                                <Skeleton class="h-12 w-full" />
                            </div>
                            <template v-else>
                                <div v-if="consumptionRecipeItems.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                    No stock lines yet. Add inventory consumed per order or stage.
                                </div>
                                <div v-else class="space-y-2">
                                    <div v-for="line in consumptionRecipeItems" :key="line.inventoryItemId" class="rounded-lg border p-3">
                                        <div class="grid gap-3 md:grid-cols-2">
                                            <div class="grid gap-1.5 md:col-span-2">
                                                <Label>Stock item</Label>
                                                <p class="rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium">{{ inventoryOptionLabel(line.inventoryItem) }}</p>
                                            </div>
                                            <div class="grid gap-1.5"><Label>Qty/order</Label><Input v-model="line.quantityPerOrder" inputmode="decimal" /></div>
                                            <div class="grid gap-1.5"><Label>Unit</Label><Input v-model="line.unit" /></div>
                                            <div class="grid gap-1.5"><Label>Waste %</Label><Input v-model="line.wasteFactorPercent" inputmode="decimal" /></div>
                                            <div class="grid gap-1.5">
                                                <Label>Stage</Label>
                                                <Select
                                                    :model-value="line.consumptionStage || 'per_order'"
                                                    @update:model-value="(value) => { line.consumptionStage = String(value); }"
                                                >
                                                    <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem v-for="stage in consumptionStageOptions" :key="stage.value" :value="stage.value">{{ stage.label }}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-1.5 md:col-span-2"><Label>Notes</Label><Textarea v-model="line.notes" class="min-h-16" /></div>
                                        </div>
                                        <Button type="button" variant="outline" size="sm" class="mt-3" @click="removeConsumptionRecipeLine(line.inventoryItemId)">Remove line</Button>
                                    </div>
                                </div>
                                <fieldset class="grid gap-3 rounded-lg border p-3">
                                    <legend class="px-2 text-sm font-medium text-muted-foreground">Add stock line</legend>
                                    <div class="grid gap-3 md:grid-cols-2">
                                        <div class="grid gap-1.5 md:col-span-2">
                                            <Label>Stock item</Label>
                                            <Select
                                                :model-value="consumptionRecipeForm.inventoryItemId || SELECT_NOT_SPECIFIED_VALUE"
                                                @update:model-value="updateConsumptionInventorySelection"
                                            >
                                                <SelectTrigger class="w-full"><SelectValue placeholder="Select eligible stock" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Select eligible stock</SelectItem>
                                                    <SelectItem v-for="option in consumptionInventoryOptions" :key="option.id" :value="option.id">{{ inventoryOptionLabel(option) }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-1.5"><Label>Qty/order</Label><Input v-model="consumptionRecipeForm.quantityPerOrder" inputmode="decimal" placeholder="1" /></div>
                                        <div class="grid gap-1.5"><Label>Unit</Label><Input v-model="consumptionRecipeForm.unit" placeholder="kit" /></div>
                                        <div class="grid gap-1.5"><Label>Waste %</Label><Input v-model="consumptionRecipeForm.wasteFactorPercent" inputmode="decimal" placeholder="0" /></div>
                                        <div class="grid gap-1.5">
                                            <Label>Stage</Label>
                                            <Select v-model="consumptionRecipeForm.consumptionStage">
                                                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem v-for="stage in consumptionStageOptions" :key="stage.value" :value="stage.value">{{ stage.label }}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-1.5 md:col-span-2"><Label>Notes</Label><Textarea v-model="consumptionRecipeForm.notes" class="min-h-16" /></div>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" class="w-fit" @click="addConsumptionRecipeLine">Add line</Button>
                                </fieldset>
                            </template>
                        </div>
                    </ScrollArea>
                    <SheetFooter class="shrink-0 gap-2 border-t px-4 py-3">
                        <Button variant="outline" :disabled="consumptionRecipeSaving" @click="closeRecipeSheet()">Cancel</Button>
                        <Button :disabled="consumptionRecipeSaving" @click="saveConsumptionRecipe">{{ consumptionRecipeSaving ? 'Saving...' : 'Save recipe' }}</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <ClinicalCatalogBulkSheet
                v-model:open="bulkSheetOpen"
                :catalog-key="catalogKey"
                :api-base="base"
                :catalog-label="catalog.label"
                :can-manage="canManage"
                :list-filters="{ q: filters.q, status: filters.status, category: filters.category }"
                :selected-item-ids="selectedItemIds"
                @completed="void Promise.all([loadItems(), loadStatusCounts()])"
            />

            <Dialog v-model:open="bulkStatusDialogOpen">
                <DialogContent class="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{{ bulkStatusDialogTitle }}</DialogTitle>
                        <DialogDescription>
                            Applies to {{ selectedCount }} selected {{ catalog.label.toLowerCase() }}. Add a short reason for audit traceability.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-2">
                        <Label for="bulk-status-reason">Reason (optional)</Label>
                        <Textarea id="bulk-status-reason" v-model="bulkStatusReason" class="min-h-20" placeholder="Why is this bulk status change needed?" />
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

            </div>
        </div>
    </AppLayout>
</template>
