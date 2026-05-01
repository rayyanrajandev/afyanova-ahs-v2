<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ComboboxField from '@/components/forms/ComboboxField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type CatalogKey = 'lab-tests' | 'radiology-procedures' | 'theatre-procedures' | 'formulary-items';
type CatalogStatus = 'active' | 'inactive' | 'retired';
type BillingLinkStatus = 'linked' | 'pending_price' | 'review_required' | 'not_linked';
type ScopeData = { resolvedFrom: string };
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
type ClinicalWorkspaceView = 'queue' | 'register';
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
    { title: 'Administration', href: '/platform/admin/clinical-catalogs' },
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

const { permissionNames, permissionState, scope: sharedScope, multiTenantIsolationEnabled } = usePlatformAccess();
const permissionsResolved = computed(() => permissionNames.value !== null);
const canRead = computed(() => permissionState('platform.clinical-catalog.read') === 'allowed');
const canAudit = computed(() => permissionState('platform.clinical-catalog.view-audit-logs') === 'allowed');
const scope = computed<ScopeData | null>(() => (sharedScope.value as ScopeData | null) ?? null);
const scopeUnresolved = computed(() => multiTenantIsolationEnabled.value && (scope.value?.resolvedFrom ?? 'none') === 'none');

const catalogKey = ref<CatalogKey>('lab-tests');
const catalog = computed(() => domains[catalogKey.value]);
const canManage = computed(() => permissionState(catalog.value.manage) === 'allowed');
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
const clinicalWorkspaceView = ref<ClinicalWorkspaceView>('queue');
const compactClinicalQueueRows = ref(false);

const createBusy = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createForm = reactive(createClinicalDefinitionForm());

const sheetOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);
const selected = ref<Item | null>(null);
const detailsTab = ref<'overview' | 'status' | 'audit'>('overview');
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

const clinicalQueueStateLabel = computed(() => {
    const labels: string[] = [];

    if (filters.status) {
        labels.push(formatEnumLabel(filters.status));
    } else {
        labels.push('All statuses');
    }

    if (filters.category.trim()) {
        labels.push(`Category ${filters.category.trim()}`);
    } else {
        labels.push('All categories');
    }

    return labels.join(' | ');
});

const clinicalActiveFilterChips = computed(() => {
    const chips: string[] = [];

    if (filters.q.trim()) chips.push(`Search: ${filters.q.trim()}`);
    if (filters.status) chips.push(`Status: ${formatEnumLabel(filters.status)}`);
    if (filters.category.trim()) chips.push(`Category: ${filters.category.trim()}`);
    if (filters.perPage !== 15) chips.push(`${filters.perPage} per page`);

    return chips;
});

const clinicalCreateReady = computed(() => createForm.code.trim() !== '' && createForm.name.trim() !== '');
const clinicalCreateSummary = computed(() => {
    const code = createForm.code.trim();
    const name = createForm.name.trim();

    if (!code && !name) return 'No clinical definition drafted';
    if (code && name) return `${catalog.value.singular} | ${code} | ${name}`;

    return code || name;
});

const clinicalCatalogTabs = [
    { key: 'lab-tests' as const, label: 'Lab Tests', icon: 'flask-conical' as const },
    { key: 'radiology-procedures' as const, label: 'Radiology', icon: 'file-text' as const },
    { key: 'theatre-procedures' as const, label: 'Theatre', icon: 'scissors' as const },
    { key: 'formulary-items' as const, label: 'Medicines', icon: 'pill' as const },
];

const selectedSummaryCards = computed(() => {
    if (!selected.value) return [];

    return [
        {
            key: 'status',
            label: 'Current status',
            value: formatEnumLabel(selected.value.status),
            helper: selected.value.statusReason || 'No status reason recorded',
        },
        {
            key: 'billing',
            label: 'Billing linkage',
            value: billingLinkLabel(selected.value.billingLinkStatus),
            helper: billingLinkDetail(selected.value),
        },
        {
            key: 'classification',
            label: 'Classification',
            value: selected.value.category || 'Category not set',
            helper: `${selected.value.unit ? `Unit ${selected.value.unit}` : 'Unit not set'} | ${domainMetadataSummary(selected.value)}`,
        },
    ];
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

function openClinicalQueueWorkspace(): void {
    clinicalWorkspaceView.value = 'queue';
}

function openClinicalRegisterWorkspace(): void {
    clinicalWorkspaceView.value = 'register';
}

function setClinicalQueueDensity(compact: boolean): void {
    compactClinicalQueueRows.value = compact;
}

function applyClinicalStatusPreset(status: '' | CatalogStatus): void {
    filters.status = status;
    filters.page = 1;
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
        notifySuccess('Consumption recipe saved.');
        if (canAudit.value) await loadAudit(1);
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
        clinicalWorkspaceView.value = 'queue';
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
    sheetOpen.value = true;
    detailsLoading.value = true;
    detailsError.value = null;
    detailsTab.value = 'overview';
    selected.value = null;
    auditLogs.value = [];
    auditPager.value = null;
    resetConsumptionRecipeWorkspace();

    try {
        const response = await apiRequest<{ data: Item }>('GET', `${base.value}/${id}`);
        selected.value = response.data;
        hydrateEdit(response.data);
        await loadConsumptionRecipe(response.data);
        if (canAudit.value) await loadAudit(1);
    } catch (error) {
        detailsError.value = messageFromUnknown(error, 'Unable to load item details.');
    } finally {
        detailsLoading.value = false;
    }
}

function closeSheet(): void {
    sheetOpen.value = false;
    detailsTab.value = 'overview';
    selected.value = null;
    resetConsumptionRecipeWorkspace();
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

watch(catalogKey, () => {
    loading.value = true;
    clinicalWorkspaceView.value = 'queue';
    closeSheet();
    resetCreateForm();
    createErrors.value = {};
    filters.page = 1;
    void loadItems();
});

onMounted(() => {
    void Promise.all([loadItems(), loadDepartments()]);
});
</script>

<template>
    <Head title="Clinical Care Catalogs" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-hidden rounded-lg p-4 md:p-6">
            <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div class="space-y-1">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="book-open" class="size-7 text-primary" />
                        Clinical Care Catalogs
                    </h1>
                    <p class="text-sm text-muted-foreground">
                        Manage the clinical definitions that care teams select, then keep them linked to the shared billable service catalog without duplicating records.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{{ canRead ? 'Ready' : 'Access Restricted' }}</Badge>
                    <Button size="sm" variant="outline" class="gap-1.5" :disabled="listLoading" @click="loadItems()">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button
                        v-if="canRead"
                        size="sm"
                        class="gap-1.5"
                        :variant="clinicalWorkspaceView === 'queue' ? 'default' : 'outline'"
                        @click="openClinicalQueueWorkspace"
                    >
                        <AppIcon name="layout-list" class="size-3.5" />
                        Catalog Queue
                    </Button>
                    <Button
                        v-if="canManage"
                        size="sm"
                        class="gap-1.5"
                        :variant="clinicalWorkspaceView === 'register' ? 'default' : 'outline'"
                        @click="openClinicalRegisterWorkspace"
                    >
                        <AppIcon name="plus" class="size-3.5" />
                        Add Clinical Definition
                    </Button>
                    <Button size="sm" variant="outline" as-child class="gap-1.5">
                        <Link href="/billing-service-catalog">
                            <AppIcon name="receipt" class="size-3.5" />
                            Billable Service Catalog
                        </Link>
                    </Button>
                </div>
            </div>

            <Card class="rounded-lg border-sidebar-border/70">
                <CardHeader class="gap-2 pb-2">
                    <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                        <div class="space-y-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <CardTitle class="text-base">Clinical Domain Workspace</CardTitle>
                                <Badge variant="secondary" class="h-5 px-2 text-[10px]">Linked pricing</Badge>
                            </div>
                            <CardDescription class="text-xs">
                                Manage selectable care definitions for lab, radiology, theatre, and medicines in one operational workspace.
                            </CardDescription>
                        </div>
                        <div class="inline-flex items-center gap-2 rounded-md border bg-muted/10 px-3 py-1.5 text-xs text-muted-foreground">
                            <AppIcon name="receipt" class="size-3.5" />
                            <span>Shared service codes keep catalog selection and pricing aligned.</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent class="space-y-2.5">
                    <Tabs v-model="catalogKey">
                        <TabsList class="flex h-auto w-full items-center justify-start gap-1 overflow-x-auto rounded-lg bg-muted/20 p-1">
                            <TabsTrigger
                                v-for="tab in clinicalCatalogTabs"
                                :key="tab.key"
                                :value="tab.key"
                                class="h-8 shrink-0 gap-1.5 px-2.5"
                            >
                                <AppIcon :name="tab.icon" class="size-3.5" />
                                {{ tab.label }}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardContent>
            </Card>

            <Alert v-if="!permissionsResolved">
                <AlertTitle class="flex items-center gap-2"><AppIcon name="loader-circle" class="size-4 animate-spin" /> Resolving access</AlertTitle>
                <AlertDescription>Permission context is still loading.</AlertDescription>
            </Alert>
            <Alert v-else-if="!canRead" variant="destructive">
                <AlertTitle class="flex items-center gap-2"><AppIcon name="shield-alert" class="size-4" /> Access denied</AlertTitle>
                <AlertDescription>You do not have `platform.clinical-catalog.read`.</AlertDescription>
            </Alert>
            <Alert v-else-if="scopeUnresolved" variant="destructive">
                <AlertTitle class="flex items-center gap-2"><AppIcon name="alert-triangle" class="size-4" /> Scope unresolved</AlertTitle>
                <AlertDescription>Resolve tenant/facility scope before editing catalog items.</AlertDescription>
            </Alert>

            <div v-if="canRead" class="space-y-3">
                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                    <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div class="flex min-w-0 flex-col gap-2 xl:flex-1 xl:flex-row xl:flex-wrap xl:items-center">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="text-sm font-medium">Clinical definition queue</p>
                                <Badge variant="secondary">{{ clinicalQueueStateLabel }}</Badge>
                                <Badge variant="outline">{{ counts.total }} in scope</Badge>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 xl:gap-1.5">
                                <Button size="sm" class="h-8 gap-1.5 xl:h-7 xl:px-2.5" :variant="filters.status === '' ? 'default' : 'outline'" @click="applyClinicalStatusPreset('')">
                                    <span class="font-medium">{{ counts.total }}</span>
                                    All definitions
                                </Button>
                                <Button size="sm" class="h-8 gap-1.5 xl:h-7 xl:px-2.5" :variant="filters.status === 'active' ? 'default' : 'outline'" @click="applyClinicalStatusPreset('active')">
                                    <span class="font-medium">{{ counts.active }}</span>
                                    Active
                                </Button>
                                <Button size="sm" class="h-8 gap-1.5 xl:h-7 xl:px-2.5" :variant="filters.status === 'inactive' ? 'default' : 'outline'" @click="applyClinicalStatusPreset('inactive')">
                                    <span class="font-medium">{{ counts.inactive }}</span>
                                    Needs review
                                </Button>
                                <Button size="sm" class="h-8 gap-1.5 xl:h-7 xl:px-2.5" :variant="filters.status === 'retired' ? 'default' : 'outline'" @click="applyClinicalStatusPreset('retired')">
                                    <span class="font-medium">{{ counts.retired }}</span>
                                    Retired
                                </Button>
                            </div>
                        </div>
                        <div class="flex flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                <span>Showing {{ pager?.total ?? items.length }} definitions</span>
                                <span class="text-muted-foreground">|</span>
                                <span>{{ catalog.label }}</span>
                                <span class="text-muted-foreground">|</span>
                                <span>{{ compactClinicalQueueRows ? 'Compact rows' : 'Comfortable rows' }}</span>
                            </div>
                            <Button size="sm" variant="outline" as-child class="h-8 gap-1.5 xl:h-7">
                                <Link href="/billing-service-catalog">
                                    <AppIcon name="receipt" class="size-3.5" />
                                    Review prices
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <Card v-if="canRead && canManage && clinicalWorkspaceView === 'register'" class="rounded-lg border-sidebar-border/70">
                <CardHeader class="gap-3 pb-3">
                    <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div class="space-y-1">
                            <CardTitle class="flex items-center gap-2">
                                <AppIcon name="plus" class="size-4" />
                                Register Clinical Definition
                            </CardTitle>
                            <CardDescription>
                                Create the care-facing definition first, then attach the shared billing service code only when automatic pricing is required.
                            </CardDescription>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge :variant="clinicalCreateReady ? 'secondary' : 'outline'">
                                {{ clinicalCreateReady ? 'Ready to save' : 'Setup in progress' }}
                            </Badge>
                            <Badge variant="outline">{{ clinicalCreateSummary }}</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent class="space-y-3">
                    <div class="rounded-lg border bg-muted/10 p-3">
                        <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Definition setup</p>
                                <p class="text-xs text-muted-foreground">
                                    Register the shared clinical identity first, then complete the domain-specific workflow details for {{ catalog.singular.toLowerCase() }} operations.
                                </p>
                            </div>
                            <p class="text-xs text-muted-foreground">
                                Use the same shared code from the Billable Service Catalog when you want automatic charge capture later.
                            </p>
                        </div>
                    </div>
                    <div class="grid gap-3 md:grid-cols-3">
                        <div class="grid gap-1.5"><Label>Code</Label><Input v-model="createForm.code" :placeholder="catalog.codePlaceholder" /><p v-if="firstError(createErrors, 'code')" class="text-xs text-destructive">{{ firstError(createErrors, 'code') }}</p></div>
                        <div class="grid gap-1.5 md:col-span-2"><Label>Name</Label><Input v-model="createForm.name" :placeholder="catalog.namePlaceholder" /><p v-if="firstError(createErrors, 'name')" class="text-xs text-destructive">{{ firstError(createErrors, 'name') }}</p></div>
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
                        <div class="grid gap-1.5"><Label>{{ catalog.categoryLabel }}</Label><Input v-model="createForm.category" :placeholder="catalog.categoryPlaceholder" /></div>
                        <div class="grid gap-1.5"><Label>{{ catalog.unitLabel }}</Label><Input v-model="createForm.unit" :placeholder="catalog.unitPlaceholder" /></div>
                        <div class="grid gap-1.5 md:col-span-3"><Label>Linked Billing Service Code</Label><Input v-model="createForm.billingServiceCode" placeholder="Use the shared code from the Billable Service Catalog" /><p class="text-xs text-muted-foreground">This links the clinical item to an existing billing service family. It does not create a second billing record.</p><p v-if="firstError(createErrors, 'billingServiceCode')" class="text-xs text-destructive">{{ firstError(createErrors, 'billingServiceCode') }}</p></div>
                        <div class="grid gap-1.5 md:col-span-3"><Label>Description</Label><Textarea v-model="createForm.description" class="min-h-20" placeholder="Operational guidance for care teams" /></div>
                    </div>

                    <div class="rounded-lg border bg-background/70 p-3">
                        <div class="mb-3 space-y-1">
                            <p class="text-sm font-medium">{{ catalog.domainSectionTitle }}</p>
                            <p class="text-xs text-muted-foreground">{{ catalog.domainSectionDescription }}</p>
                        </div>

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
                    </div>

                    <details class="rounded-lg border bg-muted/10 p-3">
                        <summary class="cursor-pointer text-sm font-medium">Advanced / Standards</summary>
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
                                <Label>Additional Metadata JSON</Label>
                                <Textarea v-model="createForm.metadataText" class="min-h-24 font-mono text-xs" />
                                <p class="text-xs text-muted-foreground">Use this only for uncommon attributes that are not covered by the structured fields above.</p>
                                <p v-if="firstError(createErrors, 'metadata')" class="text-xs text-destructive">{{ firstError(createErrors, 'metadata') }}</p>
                            </div>
                        </div>
                    </details>

                    <div class="flex justify-between border-t pt-3">
                        <Button variant="outline" :disabled="createBusy" @click="openClinicalQueueWorkspace">Back to queue</Button>
                        <Button :disabled="createBusy" @click="createItem">{{ createBusy ? 'Creating...' : 'Create definition' }}</Button>
                    </div>
                </CardContent>
            </Card>

            <Card v-if="canRead && clinicalWorkspaceView === 'queue'" class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col">
                <CardHeader class="gap-2 pb-2">
                    <div class="space-y-1">
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                            {{ catalog.label }} Queue
                        </CardTitle>
                    </div>
                    <div class="flex w-full flex-col gap-2">
                        <div class="flex w-full flex-col gap-2 xl:flex-row xl:items-center">
                            <div class="min-w-0 flex-1">
                                <label for="clinical-q" class="sr-only">Search catalog</label>
                                <div class="relative min-w-0">
                                    <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                                    <Input id="clinical-q" v-model="filters.q" :placeholder="`Search code, name, ${catalog.categoryLabel.toLowerCase()}, or description`" class="h-9 pl-9" @keyup.enter="search" />
                                </div>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <div class="min-w-[180px] sm:min-w-[220px]">
                                    <label for="clinical-status" class="sr-only">Status</label>
                                    <Select :model-value="clinicalStatusFilterSelectValue" @update:model-value="updateClinicalStatusFilter">
                                        <SelectTrigger id="clinical-status" class="h-9 w-full"><SelectValue placeholder="All statuses" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem :value="SELECT_ALL_VALUE">All statuses</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                            <SelectItem value="retired">Retired</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="min-w-[180px] sm:min-w-[220px]">
                                    <label for="clinical-category" class="sr-only">Category</label>
                                    <Input id="clinical-category" v-model="filters.category" class="h-9" :placeholder="catalog.categoryLabel" @keyup.enter="search" />
                                </div>
                                <Button variant="outline" size="sm" class="h-9 gap-1.5" @click="search">
                                    <AppIcon name="search" class="size-3.5" />
                                    {{ listLoading ? 'Searching...' : 'Search' }}
                                </Button>
                                <div class="flex items-center gap-1 rounded-lg border bg-muted/10 p-1">
                                    <Button size="sm" class="h-7 px-2.5" :variant="compactClinicalQueueRows ? 'ghost' : 'default'" @click="setClinicalQueueDensity(false)">Comfortable</Button>
                                    <Button size="sm" class="h-7 px-2.5" :variant="compactClinicalQueueRows ? 'default' : 'ghost'" @click="setClinicalQueueDensity(true)">Compact</Button>
                                </div>
                                <Button v-if="clinicalActiveFilterChips.length > 0" variant="ghost" size="sm" class="h-9 gap-1.5" @click="resetFilters">Clear</Button>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/10 px-3 py-2.5 text-sm">
                            <span class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Current focus</span>
                            <span>{{ clinicalQueueStateLabel }}</span>
                            <span class="text-muted-foreground">|</span>
                            <span>{{ compactClinicalQueueRows ? 'Compact rows' : 'Comfortable rows' }}</span>
                            <template v-if="filters.category.trim()">
                                <span class="text-muted-foreground">|</span>
                                <span>{{ filters.category.trim() }}</span>
                            </template>
                        </div>
                        <div v-if="clinicalActiveFilterChips.length > 0" class="flex flex-wrap gap-2">
                            <Badge v-for="chip in clinicalActiveFilterChips" :key="`clinical-filter-${chip}`" variant="outline">{{ chip }}</Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent class="min-h-0 flex-1 p-0">
                    <Alert v-if="listError" variant="destructive" class="m-4"><AlertTitle>Queue load issue</AlertTitle><AlertDescription>{{ listError }}</AlertDescription></Alert>
                    <div v-else-if="loading || listLoading" class="space-y-2 p-4"><Skeleton class="h-12 w-full" /><Skeleton class="h-12 w-full" /><Skeleton class="h-12 w-full" /></div>
                    <div v-else-if="items.length === 0" class="m-4 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                        <template v-if="clinicalActiveFilterChips.length === 0 && counts.total === 0">
                            No clinical definitions exist yet. Start with the first lab test, radiology procedure, theatre procedure, or formulary medicine before building the Billable Service Catalog.
                        </template>
                        <template v-else>
                            No items matched the current filters.
                        </template>
                    </div>
                    <div v-else class="min-h-[12rem] p-4" :class="compactClinicalQueueRows ? 'space-y-2' : 'space-y-3'">
                        <div
                            v-for="item in items"
                            :key="String(item.id)"
                            :class="[compactClinicalQueueRows ? 'p-2.5' : 'p-3', 'rounded-lg border bg-background/70']"
                        >
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div :class="compactClinicalQueueRows ? 'space-y-1.5' : 'space-y-2'" class="min-w-0 flex-1">
                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                        <div class="min-w-0">
                                            <p class="text-sm font-semibold">{{ item.name || 'Unnamed item' }}</p>
                                            <div class="mt-1 flex flex-wrap items-center gap-2">
                                                <Badge variant="outline">{{ item.code || 'NO-CODE' }}</Badge>
                                                <Badge :variant="statusVariant(item.status)">{{ formatEnumLabel(item.status) }}</Badge>
                                                <Badge :variant="billingLinkVariant(item.billingLinkStatus)">{{ billingLinkLabel(item.billingLinkStatus) }}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span>{{ item.category || 'Category not set' }}</span>
                                        <span>|</span>
                                        <span>{{ item.unit || 'Unit not set' }}</span>
                                        <span>|</span>
                                        <span>{{ domainMetadataSummary(item) }}</span>
                                        <span>|</span>
                                        <span>Updated {{ fmtDate(item.updatedAt) }}</span>
                                    </div>
                                    <div class="rounded-md border border-dashed bg-muted/10 px-2.5 py-2 text-xs text-muted-foreground">
                                        {{ billingLinkDetail(item) }}
                                    </div>
                                </div>
                                <div class="flex shrink-0 items-center gap-2">
                                    <Button size="sm" variant="outline" @click="openDetails(item)">Open workspace</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center justify-between border-t px-4 py-3">
                        <Button variant="outline" size="sm" :disabled="listLoading || (pager?.currentPage ?? 1) <= 1" @click="prevPage">Previous</Button>
                        <p class="text-xs text-muted-foreground">Page {{ pager?.currentPage ?? 1 }} of {{ pager?.lastPage ?? 1 }}<span v-if="pager"> | {{ pager.total }} total</span></p>
                        <Button variant="outline" size="sm" :disabled="listLoading || !pager || pager.currentPage >= pager.lastPage" @click="nextPage">Next</Button>
                    </div>
                </CardContent>
            </Card>

            <Sheet :open="sheetOpen" @update:open="(open) => (open ? (sheetOpen = true) : closeSheet())">
                <SheetContent side="right" variant="workspace" size="4xl">
                    <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
                        <SheetTitle>{{ selected?.code || selected?.id || 'Catalog item details' }}</SheetTitle>
                        <SheetDescription>{{ selected?.name || `${catalog.label} workspace` }} | {{ billingLinkLabel(selected?.billingLinkStatus ?? null) }}</SheetDescription>
                    </SheetHeader>
                    <div class="min-h-0 flex-1 overflow-hidden">
                        <div v-if="detailsLoading" class="space-y-2 p-4">
                            <Skeleton class="h-14 w-full" />
                            <Skeleton class="h-14 w-full" />
                        </div>
                        <Alert v-else-if="detailsError" variant="destructive" class="m-4">
                            <AlertTitle>Details load issue</AlertTitle>
                            <AlertDescription>{{ detailsError }}</AlertDescription>
                        </Alert>
                        <Tabs v-else-if="selected" v-model="detailsTab" class="flex h-full min-h-0 flex-col">
                            <div class="shrink-0 border-b bg-muted/5 px-4 py-2.5">
                                <div class="space-y-4">
                                    <div class="grid gap-2 sm:grid-cols-3">
                                        <div
                                            v-for="card in selectedSummaryCards"
                                            :key="card.key"
                                            class="min-w-0 rounded-lg border bg-background/70 px-3 py-2"
                                        >
                                            <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{{ card.label }}</p>
                                            <div class="mt-1 flex items-start gap-2">
                                                <p class="shrink-0 text-sm font-semibold leading-5">{{ card.value }}</p>
                                                <p
                                                    class="min-w-0 flex-1 text-xs leading-5 text-muted-foreground line-clamp-1 sm:line-clamp-2 xl:line-clamp-1"
                                                    :title="card.helper"
                                                >
                                                    {{ card.helper }}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="pb-1">
                                        <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-transparent p-0">
                                            <TabsTrigger value="overview" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Overview</TabsTrigger>
                                            <TabsTrigger value="status" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Status</TabsTrigger>
                                            <TabsTrigger v-if="canAudit" value="audit" class="rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">Audit</TabsTrigger>
                                        </TabsList>
                                    </div>
                                </div>
                            </div>

                            <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                                <div class="space-y-4 p-4">
                                    <TabsContent value="overview" class="space-y-4">
                                        <Card>
                                            <CardHeader>
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="text-base">Billing Linkage</CardTitle>
                                                        <CardDescription>Shows whether this clinical definition already resolves to a usable service price.</CardDescription>
                                                    </div>
                                                    <Badge :variant="billingLinkVariant(selected.billingLinkStatus)">{{ billingLinkLabel(selected.billingLinkStatus) }}</Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-2">
                                                <p class="text-sm font-medium">{{ selected.billingLink?.item?.serviceName || selected.billingServiceCode || 'No billing service code linked' }}</p>
                                                <p class="text-sm text-muted-foreground">{{ billingLinkDetail(selected) }}</p>
                                                <div class="flex flex-wrap gap-2 pt-1">
                                                    <Button size="sm" variant="outline" as-child>
                                                        <Link href="/billing-service-catalog">Open Billable Service Catalog</Link>
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card v-if="supportsConsumptionRecipe">
                                            <CardHeader class="pb-3">
                                                <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                                    <div>
                                                        <CardTitle class="text-base">Stock Consumption Recipe</CardTitle>
                                                        <CardDescription>
                                                            Define physical stock consumed when this {{ domains[selectedCatalogKey].singular.toLowerCase() }} is performed. Lab tests, imaging, and theatre procedures do not link directly to inventory.
                                                        </CardDescription>
                                                    </div>
                                                    <Badge variant="outline">{{ consumptionRecipeSummary }}</Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3">
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
                                                    <div v-if="consumptionRecipeItems.length === 0" class="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
                                                        No stock recipe has been defined yet. This is safe for catalog setup, but stock deduction will need a recipe before automated consumption can run.
                                                    </div>

                                                    <div v-else class="space-y-2">
                                                        <div
                                                            v-for="line in consumptionRecipeItems"
                                                            :key="line.inventoryItemId"
                                                            class="rounded-lg border bg-background/70 p-3"
                                                        >
                                                            <div class="grid gap-3 xl:grid-cols-3 xl:items-end">
                                                                <div class="grid min-w-0 gap-1.5 xl:col-span-3">
                                                                    <Label>Stock item</Label>
                                                                    <p class="min-w-0 break-words rounded-md border bg-muted/20 px-3 py-2 text-sm font-medium">
                                                                        {{ inventoryOptionLabel(line.inventoryItem) }}
                                                                    </p>
                                                                </div>
                                                                <div class="grid min-w-0 gap-1.5">
                                                                    <Label>Qty/order</Label>
                                                                    <Input v-model="line.quantityPerOrder" :disabled="!canManage" inputmode="decimal" />
                                                                </div>
                                                                <div class="grid min-w-0 gap-1.5">
                                                                    <Label>Unit</Label>
                                                                    <Input v-model="line.unit" :disabled="!canManage" placeholder="unit" />
                                                                </div>
                                                                <div class="grid min-w-0 gap-1.5">
                                                                    <Label>Waste %</Label>
                                                                    <Input v-model="line.wasteFactorPercent" :disabled="!canManage" inputmode="decimal" />
                                                                </div>
                                                                <div class="grid min-w-0 gap-1.5">
                                                                    <Label>Stage</Label>
                                                                    <Select
                                                                        :disabled="!canManage"
                                                                        :model-value="line.consumptionStage || 'per_order'"
                                                                        @update:model-value="(value) => { line.consumptionStage = String(value); }"
                                                                    >
                                                                        <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem v-for="stage in consumptionStageOptions" :key="stage.value" :value="stage.value">{{ stage.label }}</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div v-if="canManage" class="grid min-w-0 gap-1.5">
                                                                    <Label class="opacity-0">Action</Label>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        class="w-full"
                                                                        @click="removeConsumptionRecipeLine(line.inventoryItemId)"
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div v-if="canManage || line.notes" class="mt-3 grid gap-1.5">
                                                                <Label>Notes</Label>
                                                                <Textarea v-model="line.notes" :disabled="!canManage" class="min-h-16" placeholder="Optional preparation or consumption note" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div v-if="canManage" class="rounded-lg border bg-muted/10 p-3">
                                                        <div class="grid gap-3 xl:grid-cols-3 xl:items-end">
                                                            <div class="grid min-w-0 gap-1.5 xl:col-span-3">
                                                                <Label>Add stock item</Label>
                                                                <Select
                                                                    :model-value="consumptionRecipeForm.inventoryItemId || SELECT_NOT_SPECIFIED_VALUE"
                                                                    @update:model-value="updateConsumptionInventorySelection"
                                                                >
                                                                    <SelectTrigger class="w-full">
                                                                        <SelectValue placeholder="Select eligible stock" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Select eligible stock</SelectItem>
                                                                        <SelectItem v-for="option in consumptionInventoryOptions" :key="option.id" :value="option.id">
                                                                            {{ inventoryOptionLabel(option) }}
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div class="grid min-w-0 gap-1.5">
                                                                <Label>Qty/order</Label>
                                                                <Input v-model="consumptionRecipeForm.quantityPerOrder" inputmode="decimal" placeholder="1" />
                                                            </div>
                                                            <div class="grid min-w-0 gap-1.5">
                                                                <Label>Unit</Label>
                                                                <Input v-model="consumptionRecipeForm.unit" placeholder="kit" />
                                                            </div>
                                                            <div class="grid min-w-0 gap-1.5">
                                                                <Label>Waste %</Label>
                                                                <Input v-model="consumptionRecipeForm.wasteFactorPercent" inputmode="decimal" placeholder="0" />
                                                            </div>
                                                            <div class="grid min-w-0 gap-1.5">
                                                                <Label>Stage</Label>
                                                                <Select v-model="consumptionRecipeForm.consumptionStage">
                                                                    <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem v-for="stage in consumptionStageOptions" :key="stage.value" :value="stage.value">{{ stage.label }}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div class="grid min-w-0 gap-1.5">
                                                                <Label class="opacity-0">Action</Label>
                                                                <Button type="button" variant="outline" size="sm" class="w-full" @click="addConsumptionRecipeLine">Add line</Button>
                                                            </div>
                                                            <div class="grid gap-1.5 xl:col-span-3">
                                                                <Label>Notes</Label>
                                                                <Textarea v-model="consumptionRecipeForm.notes" class="min-h-16" placeholder="Optional preparation or consumption note" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div class="flex justify-end border-t pt-3">
                                                        <Button v-if="canManage" variant="outline" :disabled="consumptionRecipeSaving" @click="saveConsumptionRecipe">
                                                            {{ consumptionRecipeSaving ? 'Saving recipe...' : 'Save Recipe' }}
                                                        </Button>
                                                    </div>
                                                </template>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle class="text-base">Edit Item</CardTitle>
                                                <CardDescription>Keep the clinical definition stable so care teams, billing, and audit trails stay aligned.</CardDescription>
                                            </CardHeader>
                                            <CardContent class="space-y-3">
                                                <div class="grid gap-3 md:grid-cols-3">
                                                    <div class="grid gap-1.5"><Label>Code</Label><Input v-model="editForm.code" :disabled="!canManage" /><p v-if="firstError(editErrors, 'code')" class="text-xs text-destructive">{{ firstError(editErrors, 'code') }}</p></div>
                                                    <div class="grid gap-1.5 md:col-span-2"><Label>Name</Label><Input v-model="editForm.name" :disabled="!canManage" /><p v-if="firstError(editErrors, 'name')" class="text-xs text-destructive">{{ firstError(editErrors, 'name') }}</p></div>
                                                    <ComboboxField
                                                        input-id="edit-clinical-definition-department"
                                                        label="Department"
                                                        v-model="editDepartmentFieldValue"
                                                        :options="editDepartmentOptions"
                                                        placeholder="Select department"
                                                        search-placeholder="Search department code or name"
                                                        :error-message="firstError(editErrors, 'departmentId')"
                                                        :empty-text="editDepartmentEmptyText"
                                                        :disabled="!canManage"
                                                        :reserve-message-space="false"
                                                    />
                                                    <div class="grid gap-1.5"><Label>{{ catalog.categoryLabel }}</Label><Input v-model="editForm.category" :disabled="!canManage" /></div>
                                                    <div class="grid gap-1.5"><Label>{{ catalog.unitLabel }}</Label><Input v-model="editForm.unit" :disabled="!canManage" /></div>
                                                    <div class="grid gap-1.5 md:col-span-3"><Label>Linked Billing Service Code</Label><Input v-model="editForm.billingServiceCode" :disabled="!canManage" placeholder="Use the shared code from the Billable Service Catalog" /><p class="text-xs text-muted-foreground">Keep this aligned with the billable service catalog. If the billing price exists, this catalog item will resolve automatically. If not, the linkage will stay in pending price state.</p><p v-if="firstError(editErrors, 'billingServiceCode')" class="text-xs text-destructive">{{ firstError(editErrors, 'billingServiceCode') }}</p></div>
                                                    <div class="grid gap-1.5 md:col-span-3"><Label>Description</Label><Textarea v-model="editForm.description" class="min-h-20" :disabled="!canManage" /></div>
                                                </div>

                                                <div class="rounded-lg border bg-background/70 p-3">
                                                    <div class="mb-3 space-y-1">
                                                        <p class="text-sm font-medium">{{ catalog.domainSectionTitle }}</p>
                                                        <p class="text-xs text-muted-foreground">{{ catalog.domainSectionDescription }}</p>
                                                    </div>

                                                    <div v-if="catalogKey === 'lab-tests'" class="grid gap-3 md:grid-cols-2">
                                                        <div class="grid gap-1.5"><Label>Sample type</Label><Input v-model="editForm.sampleType" :disabled="!canManage" /></div>
                                                        <div class="grid gap-1.5"><Label>Specimen container</Label><Input v-model="editForm.specimenContainer" :disabled="!canManage" /></div>
                                                        <div class="grid gap-1.5"><Label>Turnaround hours</Label><Input v-model="editForm.turnaroundHours" :disabled="!canManage" inputmode="numeric" /><p v-if="firstError(editErrors, 'turnaroundHours')" class="text-xs text-destructive">{{ firstError(editErrors, 'turnaroundHours') }}</p></div>
                                                        <div class="grid gap-1.5"><Label>Fasting required</Label><Select v-model="editForm.fastingRequired" :disabled="!canManage"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                                                    </div>

                                                    <div v-else-if="catalogKey === 'radiology-procedures'" class="grid gap-3 md:grid-cols-2">
                                                        <div class="grid gap-1.5"><Label>Modality</Label><Input v-model="editForm.modality" :disabled="!canManage" /></div>
                                                        <div class="grid gap-1.5"><Label>Body site</Label><Input v-model="editForm.bodySite" :disabled="!canManage" /></div>
                                                        <div class="grid gap-1.5"><Label>Study duration minutes</Label><Input v-model="editForm.studyDurationMinutes" :disabled="!canManage" inputmode="numeric" /><p v-if="firstError(editErrors, 'studyDurationMinutes')" class="text-xs text-destructive">{{ firstError(editErrors, 'studyDurationMinutes') }}</p></div>
                                                        <div class="grid gap-1.5"><Label>Contrast required</Label><Select v-model="editForm.contrastRequired" :disabled="!canManage"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                                                    </div>

                                                    <div v-else-if="catalogKey === 'theatre-procedures'" class="grid gap-3 md:grid-cols-2">
                                                        <div class="grid gap-1.5"><Label>Procedure class</Label><Input v-model="editForm.procedureClass" :disabled="!canManage" /></div>
                                                        <div class="grid gap-1.5"><Label>Anaesthesia type</Label><Input v-model="editForm.anesthesiaType" :disabled="!canManage" /></div>
                                                        <div class="grid gap-1.5"><Label>Expected duration minutes</Label><Input v-model="editForm.expectedDurationMinutes" :disabled="!canManage" inputmode="numeric" /><p v-if="firstError(editErrors, 'expectedDurationMinutes')" class="text-xs text-destructive">{{ firstError(editErrors, 'expectedDurationMinutes') }}</p></div>
                                                        <div class="grid gap-1.5"><Label>Sterile prep required</Label><Select v-model="editForm.sterilePrepRequired" :disabled="!canManage"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">Required</SelectItem><SelectItem value="no">Not required</SelectItem></SelectContent></Select></div>
                                                    </div>

                                                    <div v-else class="grid gap-3 md:grid-cols-2">
                                                        <div class="grid gap-1.5"><Label>Strength</Label><Input v-model="editForm.strength" :disabled="!canManage" /></div>
                                                        <div class="grid gap-1.5"><Label>Dosage form</Label><Input v-model="editForm.dosageForm" :disabled="!canManage" /></div>
                                                        <div class="grid gap-1.5"><Label>Route</Label><Input v-model="editForm.route" :disabled="!canManage" /></div>
                                                        <div class="grid gap-1.5"><Label>Pack size</Label><Input v-model="editForm.packSize" :disabled="!canManage" /></div>
                                                        <div class="grid gap-1.5 md:col-span-2"><Label>OTC sellable</Label><Select v-model="editForm.otcAllowed" :disabled="!canManage"><SelectTrigger class="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger><SelectContent><SelectItem :value="SELECT_NOT_SPECIFIED_VALUE">Not specified</SelectItem><SelectItem value="yes">OTC allowed</SelectItem><SelectItem value="no">Restricted</SelectItem></SelectContent></Select></div>
                                                    </div>
                                                </div>

                                                <details class="rounded-lg border bg-muted/10 p-3">
                                                    <summary class="cursor-pointer text-sm font-medium">Advanced / Standards</summary>
                                                    <div class="mt-3 space-y-3">
                                                        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                                            <div class="grid gap-1.5">
                                                                <Label>Minimum facility tier</Label>
                                                                <Select
                                                                    :disabled="!canManage"
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
                                                            <div class="grid gap-1.5"><Label>Local code</Label><Input v-model="editForm.standardsLocal" :disabled="!canManage" placeholder="Internal code" /></div>
                                                            <div class="grid gap-1.5"><Label>NHIF code</Label><Input v-model="editForm.standardsNhif" :disabled="!canManage" placeholder="NHIF tariff code" /></div>
                                                            <div class="grid gap-1.5"><Label>MSD code</Label><Input v-model="editForm.standardsMsd" :disabled="!canManage" placeholder="MSD reference" /></div>
                                                            <div class="grid gap-1.5"><Label>LOINC</Label><Input v-model="editForm.standardsLoinc" :disabled="!canManage" placeholder="Lab standard" /></div>
                                                            <div class="grid gap-1.5"><Label>SNOMED CT</Label><Input v-model="editForm.standardsSnomedCt" :disabled="!canManage" placeholder="Clinical concept" /></div>
                                                            <div class="grid gap-1.5"><Label>CPT</Label><Input v-model="editForm.standardsCpt" :disabled="!canManage" placeholder="Optional procedure code" /></div>
                                                            <div class="grid gap-1.5"><Label>ICD</Label><Input v-model="editForm.standardsIcd" :disabled="!canManage" placeholder="Optional diagnosis link" /></div>
                                                        </div>
                                                        <div class="grid gap-1.5">
                                                            <Label>Additional Metadata JSON</Label>
                                                            <Textarea v-model="editForm.metadataText" class="min-h-24 font-mono text-xs" :disabled="!canManage" />
                                                            <p class="text-xs text-muted-foreground">Use this only for uncommon attributes that are not covered by the structured fields above.</p>
                                                            <p v-if="firstError(editErrors, 'metadata')" class="text-xs text-destructive">{{ firstError(editErrors, 'metadata') }}</p>
                                                        </div>
                                                    </div>
                                                </details>

                                                <div class="flex justify-end border-t pt-3"><Button v-if="canManage" :disabled="editBusy" @click="saveItem">{{ editBusy ? 'Saving...' : 'Save Item' }}</Button></div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="status" class="space-y-4">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle class="text-base">Status Workflow</CardTitle>
                                                <CardDescription>Use status changes to control live availability without deleting historical definitions.</CardDescription>
                                            </CardHeader>
                                            <CardContent class="space-y-3">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <span class="text-sm">Current</span>
                                                    <Badge :variant="statusVariant(selected.status)">{{ formatEnumLabel(selected.status) }}</Badge>
                                                    <span class="text-xs text-muted-foreground">Reason: {{ selected.statusReason || 'N/A' }}</span>
                                                </div>
                                                <div class="grid gap-3 md:grid-cols-2">
                                                    <div class="grid gap-1.5"><Label>Target status</Label><Select v-model="statusForm.status"><SelectTrigger :disabled="!canManage"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent></Select></div>
                                                    <div class="grid gap-1.5 md:col-span-2"><Label>Reason</Label><Textarea v-model="statusForm.reason" class="min-h-24" :disabled="!canManage" placeholder="Required for inactive or retired" /><p v-if="firstError(statusErrors, 'reason')" class="text-xs text-destructive">{{ firstError(statusErrors, 'reason') }}</p></div>
                                                </div>
                                                <div class="flex justify-end border-t pt-3"><Button v-if="canManage" :disabled="statusBusy" @click="saveStatus">{{ statusBusy ? 'Saving...' : 'Save Status' }}</Button></div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent v-if="canAudit" value="audit" class="space-y-4">
                                        <Card>
                                            <CardHeader>
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="text-base">Audit Timeline</CardTitle>
                                                        <CardDescription>Filter and export the lifecycle trail for this clinical definition.</CardDescription>
                                                    </div>
                                                    <Button variant="outline" size="sm" :disabled="auditExportBusy" @click="exportAudit">{{ auditExportBusy ? 'Preparing...' : 'Export CSV' }}</Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3">
                                                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                    <div class="sm:col-span-2 lg:col-span-3 grid gap-1.5"><Label>Search</Label><Input v-model="auditFilters.q" /></div>
                                                    <div class="grid gap-1.5"><Label>Action</Label><Input v-model="auditFilters.action" /></div>
                                                    <div class="grid gap-1.5"><Label>Actor type</Label><Select :model-value="auditActorTypeSelectValue" @update:model-value="updateAuditActorTypeFilter"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem :value="SELECT_ALL_VALUE">All</SelectItem><SelectItem value="user">User</SelectItem><SelectItem value="system">System</SelectItem></SelectContent></Select></div>
                                                    <div class="grid gap-1.5"><Label>Actor ID</Label><Input v-model="auditFilters.actorId" inputmode="numeric" /></div>
                                                    <div class="grid gap-1.5"><Label>From</Label><Input v-model="auditFilters.from" type="datetime-local" /></div>
                                                    <div class="grid gap-1.5"><Label>To</Label><Input v-model="auditFilters.to" type="datetime-local" /></div>
                                                </div>
                                                <div class="flex justify-end gap-2 border-t pt-3"><Button variant="outline" size="sm" :disabled="auditBusy" @click="loadAudit(1)">Apply</Button></div>
                                                <Alert v-if="auditError" variant="destructive"><AlertTitle>Audit load issue</AlertTitle><AlertDescription>{{ auditError }}</AlertDescription></Alert>
                                                <div v-else-if="auditBusy" class="space-y-2"><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /></div>
                                                <div v-else-if="auditLogs.length === 0" class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No audit logs found.</div>
                                                <div v-else class="space-y-2"><div v-for="log in auditLogs" :key="log.id" class="rounded border p-2 text-sm"><p class="font-medium">{{ log.actionLabel || log.action || 'Event' }}</p><p class="text-xs text-muted-foreground">{{ fmtDate(log.createdAt) }} | {{ log.actor?.displayName || (log.actorId === null ? 'System' : `User #${log.actorId}`) }}</p><div class="mt-2 grid gap-2 lg:grid-cols-2"><pre class="max-h-24 overflow-auto rounded bg-muted/40 p-2 text-[11px]">{{ jsonPreview(log.changes ?? {}) }}</pre><pre class="max-h-24 overflow-auto rounded bg-muted/40 p-2 text-[11px]">{{ jsonPreview(log.metadata ?? {}) }}</pre></div></div></div>
                                                <div class="flex items-center justify-between border-t pt-2"><Button variant="outline" size="sm" :disabled="auditBusy || (auditPager?.currentPage ?? 1) <= 1" @click="loadAudit((auditPager?.currentPage ?? 1) - 1)">Previous</Button><p class="text-xs text-muted-foreground">Page {{ auditPager?.currentPage ?? 1 }} of {{ auditPager?.lastPage ?? 1 }}</p><Button variant="outline" size="sm" :disabled="auditBusy || !auditPager || auditPager.currentPage >= auditPager.lastPage" @click="loadAudit((auditPager?.currentPage ?? 1) + 1)">Next</Button></div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>
                                </div>
                            </ScrollArea>
                        </Tabs>
                    </div>
                    <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                        <Button variant="outline" @click="closeSheet">Close</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    </AppLayout>
</template>
