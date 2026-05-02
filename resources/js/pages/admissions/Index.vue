<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import LinkedContextLookupField from '@/components/context/LinkedContextLookupField.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import {
    usePlatformAccess,
    type PermissionState,
} from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    FINANCIAL_CLASS_OPTIONS,
    compactVisitCoverageSummary,
    financialClassLabel,
    normalizeFinancialClass,
} from '@/lib/financialCoverage';
import { createLocaleTranslator } from '@/lib/locale';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type ScopeData = {
    resolvedFrom: string;
    tenant: { code: string; name: string } | null;
    facility: { code: string; name: string } | null;
};

type Admission = {
    id: string;
    admissionNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    attendingClinicianUserId: number | null;
    ward: string | null;
    bed: string | null;
    admittedAt: string | null;
    dischargedAt: string | null;
    admissionReason: string | null;
    notes: string | null;
    financialClass: string | null;
    billingPayerContractId: string | null;
    coverageReference: string | null;
    coverageNotes: string | null;
    status: 'admitted' | 'discharged' | 'transferred' | 'cancelled' | string | null;
    statusReason: string | null;
    dischargeDestination: string | null;
    followUpPlan: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
};

type AdmissionListResponse = {
    data: Admission[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

type AdmissionStatusCounts = {
    admitted: number;
    discharged: number;
    transferred: number;
    cancelled: number;
    other: number;
    total: number;
};

type AdmissionStatusCountsResponse = {
    data: AdmissionStatusCounts;
};

type AdmissionAuditLog = {
    id: string;
    admissionId: string | null;
    actorId: number | null;
    action: string | null;
    changes: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string | null;
};

type AdmissionAuditLogListResponse = {
    data: AdmissionAuditLog[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

type PatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
};

type PatientResponse = {
    data: PatientSummary;
};

type AppointmentSummary = {
    id: string;
    appointmentNumber: string | null;
    patientId: string | null;
    clinicianUserId: number | null;
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

type AppointmentResponse = {
    data: AppointmentSummary;
};

type LinkedContextListResponse<T> = {
    data: T[];
    meta?: { currentPage: number; perPage: number; total: number; lastPage: number };
};

type BillingPayerContract = {
    id: string;
    contractCode: string | null;
    contractName: string | null;
    payerType: string | null;
    payerName: string | null;
    payerPlanCode: string | null;
    payerPlanName: string | null;
    currencyCode: string | null;
    status: string | null;
};

type BillingPayerContractListResponse = {
    data: BillingPayerContract[];
    meta?: { currentPage?: number; perPage?: number; total?: number; lastPage?: number };
};

type WardBedResource = {
    id: string | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    wardName: string | null;
    bedNumber: string | null;
    location: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
};

type WardBedRegistryListResponse = LinkedContextListResponse<WardBedResource>;

type WardRegistryBedOption = {
    key: string;
    value: string;
    label: string;
    resource: WardBedResource;
    occupiedAdmission: Admission | null;
    isOccupied: boolean;
    isSelectable: boolean;
    occupancyLabel: string | null;
    meta: string;
};

type MedicalRecordSummary = {
    id: string;
    recordNumber: string | null;
    patientId: string | null;
    admissionId: string | null;
    encounterAt: string | null;
    recordType: string | null;
    status: string | null;
};

type MedicalRecordListResponse = LinkedContextListResponse<MedicalRecordSummary>;

type LaboratoryOrderSummary = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    admissionId: string | null;
    orderedAt: string | null;
    testName: string | null;
    status: string | null;
};

type LaboratoryOrderListResponse = LinkedContextListResponse<LaboratoryOrderSummary>;

type PharmacyOrderSummary = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    admissionId: string | null;
    orderedAt: string | null;
    medicationName: string | null;
    status: string | null;
    dispensedAt: string | null;
    balanceAmount?: string | number | null;
};

type PharmacyOrderListResponse = LinkedContextListResponse<PharmacyOrderSummary>;

type BillingInvoiceSummary = {
    id: string;
    invoiceNumber: string | null;
    patientId: string | null;
    admissionId: string | null;
    invoiceDate: string | null;
    status: string | null;
    balanceAmount: string | number | null;
};

type BillingInvoiceListResponse = LinkedContextListResponse<BillingInvoiceSummary>;

type DischargeManualChecklistKey =
    | 'medicationCounsellingNoted'
    | 'paymentPlanConfirmed'
    | 'transportConfirmed';

type DischargeManualChecklistState = {
    medicationCounsellingNoted: boolean;
    paymentPlanConfirmed: boolean;
    transportConfirmed: boolean;
};

type DischargeReadinessModuleKey =
    | 'medicalRecords'
    | 'laboratoryOrders'
    | 'pharmacyOrders'
    | 'billingInvoices';

type DischargeReadinessData = {
    medicalRecords: MedicalRecordSummary[];
    laboratoryOrders: LaboratoryOrderSummary[];
    pharmacyOrders: PharmacyOrderSummary[];
    billingInvoices: BillingInvoiceSummary[];
    issues: Partial<Record<DischargeReadinessModuleKey, string>>;
};

type DischargeReadinessCacheEntry = {
    loading: boolean;
    error: string | null;
    data: DischargeReadinessData | null;
};

type DischargeReadinessItem = {
    key: string;
    label: string;
    description: string;
    statusText: string;
    required: boolean;
    complete: boolean;
    source: 'live' | 'manual' | 'mixed' | 'unavailable';
    manualKey?: DischargeManualChecklistKey;
    actionLabel?: string;
    actionHref?: string;
};

type DischargeReadinessSection = {
    key: string;
    label: string;
    description: string;
    items: DischargeReadinessItem[];
};

type InpatientNoteWorkflowSummary = {
    state: 'missing' | 'draft' | 'documented';
    badgeLabel: string;
    badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
    title: string;
    description: string;
    guidance: string;
    noteCount: number;
    latestRecord: MedicalRecordSummary | null;
    latestRecordedAtLabel: string | null;
    primaryActionLabel: string | null;
    primaryActionHref: string | null;
    secondaryActionLabel: string | null;
    secondaryActionHref: string | null;
};

type CreateContextLinkSource = 'none' | 'route' | 'auto' | 'manual';
type CreateContextEditorTab = 'patient' | 'appointment';
type AdmissionWorkspaceView = 'queue' | 'board' | 'new';
type DetailsSheetTab = 'overview' | 'workflows' | 'audit';
type AdtTimelineEventKind = 'admit' | 'transfer' | 'discharge' | 'cancel';
type AdtTimelineEventSource = 'audit' | 'current-state';

type AdtTimelineEvent = {
    key: string;
    kind: AdtTimelineEventKind;
    title: string;
    timestamp: string | null;
    description: string;
    reason: string | null;
    placementSummary: string | null;
    placementOrigin: string | null;
    handoffSummary: string | null;
    icon: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    source: AdtTimelineEventSource;
};

type ValidationErrorResponse = { message?: string; errors?: Record<string, string[]> };
type AuthPermissionsResponse = { data?: Array<{ name?: string | null }> };

type StaffProfileSummary = {
    id: string;
    userId: number | null;
    userName: string | null;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    status: string | null;
};

type ApiListResponse<T> = {
    data: T[];
    meta?: {
        currentPage?: number;
        lastPage?: number;
        total?: number;
        current_page?: number;
        last_page?: number;
    };
};

type SearchForm = {
    q: string;
    status: string;
    ward: string;
    from: string;
    to: string;
    perPage: number;
    page: number;
};

type CreateForm = {
    patientId: string;
    appointmentId: string;
    attendingClinicianUserId: string;
    ward: string;
    bed: string;
    admittedAt: string;
    admissionReason: string;
    notes: string;
    financialClass: string;
    billingPayerContractId: string;
    coverageReference: string;
    coverageNotes: string;
};

const admissionsW2En = {
    'return.backToAppointments': 'Back to Appointments',
} as const;

type AdmissionsW2Key = keyof typeof admissionsW2En;

const tW2 = createLocaleTranslator<AdmissionsW2Key>({
    en: admissionsW2En,
    sw: {
        'return.backToAppointments': 'Rudi kwenye miadi',
    },
});

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Admissions', href: '/admissions' }];
const pageLoading = ref(true);
const listLoading = ref(false);
const createLoading = ref(false);
const actionLoadingId = ref<string | null>(null);
const listErrors = ref<string[]>([]);
const createErrors = ref<Record<string, string[]>>({});
const actionMessage = ref<string | null>(null);
const createMessage = ref<string | null>(null);
const admissions = ref<Admission[]>([]);
const admissionStatusCounts = ref<AdmissionStatusCounts | null>(null);
const pagination = ref<AdmissionListResponse['meta'] | null>(null);
const patientDirectory = ref<Record<string, PatientSummary>>({});
const createAppointmentSummary = ref<AppointmentSummary | null>(null);
const createAppointmentSummaryLoading = ref(false);
const createAppointmentSummaryError = ref<string | null>(null);
const createAppointmentSuggestions = ref<AppointmentSummary[]>([]);
const createAppointmentSuggestionsLoading = ref(false);
const createAppointmentSuggestionsError = ref<string | null>(null);
const createAppointmentAutoLinkDismissed = ref(false);
const wardBedRegistry = ref<WardBedResource[]>([]);
const wardBedRegistryLoading = ref(false);
const wardBedRegistryError = ref<string | null>(null);
const dischargeDestinationOptions = ref<SearchableSelectOption[]>([]);
const dischargeDestinationOptionsLoading = ref(false);
const dischargeDestinationOptionsError = ref<string | null>(null);
const activePlacementAdmissionsRegistry = ref<Admission[]>([]);
const activePlacementAdmissionsRegistryLoading = ref(false);
const activePlacementAdmissionsRegistryError = ref<string | null>(null);
const {
    permissionState,
    scope: sharedScope,
    multiTenantIsolationEnabled,
    isFacilitySuperAdmin,
} = usePlatformAccess();
const scope = ref<ScopeData | null>((sharedScope.value as ScopeData | null) ?? null);
const admissionReadPermissionState = ref<PermissionState>(permissionState('admissions.read'));
const canReadAdmissions = computed(() => admissionReadPermissionState.value === 'allowed');
const isAdmissionReadPermissionResolved = computed(
    () => admissionReadPermissionState.value !== 'unknown',
);
const wardBedRegistryPermissionState = ref<PermissionState>(
    permissionState('platform.resources.read'),
);
const inpatientWardReadPermissionState = ref<PermissionState>(
    permissionState('inpatient.ward.read'),
);
const wardBedRegistryManagePermissionState = ref<PermissionState>(
    permissionState('platform.resources.manage-ward-beds'),
);
const canReadOperationalWardBedRegistry = computed(
    () => inpatientWardReadPermissionState.value === 'allowed',
);
const canReadWardBedRegistry = computed(
    () => wardBedRegistryPermissionState.value === 'allowed' || canReadOperationalWardBedRegistry.value,
);
const canManageWardBedRegistry = computed(
    () => wardBedRegistryManagePermissionState.value === 'allowed',
);
const isWardBedRegistryPermissionResolved = computed(
    () => wardBedRegistryPermissionState.value !== 'unknown',
);
const canViewAdmissionAudit = ref(false);
const canCreateAdmissions = ref(false);
const canUpdateAdmissionStatus = ref(false);
const canReadPatients = ref(false);
const canReadMedicalRecords = ref(false);
const canCreateMedicalRecords = ref(false);
const canUpdateMedicalRecords = ref(false);
const canReadLaboratoryOrders = ref(false);
const canReadPharmacyOrders = ref(false);
const canReadBillingInvoices = ref(false);
const canReadBillingPayerContracts = ref(false);
const canReadAppointments = ref(false);
const canReadClinicianDirectory = ref(false);
const clinicianDirectoryLoading = ref(false);
const clinicianDirectoryError = ref<string | null>(null);
const clinicianDirectory = ref<StaffProfileSummary[]>([]);
const clinicianDirectoryAccessRestricted = ref(false);
const billingPayerContractsLoading = ref(false);
const billingPayerContractsError = ref<string | null>(null);
const billingPayerContracts = ref<BillingPayerContract[]>([]);
const billingPayerContractsLoaded = ref(false);
const tenantIsolationEnabled = ref(multiTenantIsolationEnabled.value);
const clinicianOptions = computed<SearchableSelectOption[]>(() =>
    clinicianDirectory.value
        .filter((profile) => profile.userId !== null && (profile.status ?? '').trim().toLowerCase() !== 'inactive')
        .map((profile) => {
            const userId = Number(profile.userId);
            const userName = String(profile.userName ?? '').trim();
            const employeeNumber = String(profile.employeeNumber ?? '').trim();
            const jobTitle = String(profile.jobTitle ?? '').trim();
            const department = String(profile.department ?? '').trim();
            const label = [userName || employeeNumber || `User ${userId}`, jobTitle].filter(Boolean).join(' - ');

            return {
                value: String(userId),
                label: label || `User ${userId}`,
                description: [department || null, employeeNumber || null, `User ID ${userId}`].filter(Boolean).join(' | '),
                keywords: [userName, employeeNumber, jobTitle, department, String(userId)].filter(Boolean),
                group: department || 'Clinical staff',
            } satisfies SearchableSelectOption;
        }),
);
const clinicianDirectoryAvailable = computed(() => clinicianOptions.value.length > 0);
const linkedAppointmentClinicianOption = computed<SearchableSelectOption | null>(() => {
    const linkedClinicianUserId = Number(createAppointmentSummary.value?.clinicianUserId ?? 0);
    if (!Number.isFinite(linkedClinicianUserId) || linkedClinicianUserId <= 0) return null;

    const existingOption = clinicianOptions.value.find(
        (option) => normalizeLookupValue(option.value) === normalizeLookupValue(String(linkedClinicianUserId)),
    );
    if (existingOption) return existingOption;

    const linkedClinicianLabel = clinicianProfileLabel(linkedClinicianUserId) ?? `User ID ${linkedClinicianUserId}`;

    return {
        value: String(linkedClinicianUserId),
        label: linkedClinicianLabel,
        description: `Linked from appointment handoff | User ID ${linkedClinicianUserId}`,
        keywords: [linkedClinicianLabel, String(linkedClinicianUserId)],
        group: 'Linked appointment',
    } satisfies SearchableSelectOption;
});
const admissionClinicianOptions = computed<SearchableSelectOption[]>(() => {
    const linkedOption = linkedAppointmentClinicianOption.value;
    if (!linkedOption) return clinicianOptions.value;

    const hasLinkedOption = clinicianOptions.value.some(
        (option) => normalizeLookupValue(option.value) === normalizeLookupValue(linkedOption.value),
    );

    return hasLinkedOption ? clinicianOptions.value : [linkedOption, ...clinicianOptions.value];
});
const linkedAppointmentClinicianLabel = computed(() => linkedAppointmentClinicianOption.value?.label ?? null);
const statusDialogDischargeDestinationOptions = computed<SearchableSelectOption[]>(() => {
    const value = statusDialogDischargeDestination.value.trim();
    if (!value) return dischargeDestinationOptions.value;

    const exists = dischargeDestinationOptions.value.some(
        (option) => normalizeLookupValue(option.value) === normalizeLookupValue(value),
    );
    if (exists) return dischargeDestinationOptions.value;

    return [
        {
            value,
            label: `${value} (Current)`,
            group: 'Existing value',
            description: 'Saved discharge destination not currently in the common destination list.',
            keywords: [value, 'current', 'custom'],
        },
        ...dischargeDestinationOptions.value,
    ];
});
const statusDialogDischargeDestinationHelperText = computed(() => {
    if (dischargeDestinationOptionsLoading.value) {
        return 'Loading common discharge destinations.';
    }
    if (dischargeDestinationOptionsError.value) {
        return `${dischargeDestinationOptionsError.value} You can still enter a custom destination.`;
    }
    return 'Choose a common discharge destination or type a custom one when needed.';
});
const admissionClinicianHelperText = computed(() => {
    const linkedClinician = linkedAppointmentClinicianLabel.value;
    const currentClinicianUserId = createForm.attendingClinicianUserId.trim();
    const autoClinicianUserId = createAdmissionAutoClinicianUserId.value.trim();

    if (linkedClinician && currentClinicianUserId && currentClinicianUserId === autoClinicianUserId) {
        return `Auto-filled from the linked appointment clinician: ${linkedClinician}. Update it only if the inpatient team is changing.`;
    }
    if (linkedClinician) {
        return `Linked appointment clinician: ${linkedClinician}`;
    }
    if (clinicianDirectoryLoading.value) {
        return 'Loading active clinician directory.';
    }
    if (clinicianDirectoryAccessRestricted.value) {
        return 'Clinician directory access is unavailable for this user. Attending clinician can be assigned later by authorized staff.';
    }
    if (clinicianDirectoryError.value) {
        return clinicianDirectoryError.value;
    }
    if (clinicianDirectoryAvailable.value) {
        return 'Select the attending clinician from active staff profiles.';
    }
    return 'No active clinicians with linked user IDs are available right now. Attending clinician can be assigned later.';
});
const auditActorTypeOptions = [
    { value: '', label: 'All actors' },
    { value: 'user', label: 'User only' },
    { value: 'system', label: 'System only' },
];
const statusDialogOpen = ref(false);
const statusDialogAdmission = ref<Admission | null>(null);
const statusDialogAction = ref<'discharged' | 'transferred' | 'cancelled' | null>(null);
const statusDialogReason = ref('');
const statusDialogDischargeDestination = ref('');
const statusDialogFollowUpPlan = ref('');
const statusDialogReceivingWard = ref('');
const statusDialogReceivingBed = ref('');
const statusDialogError = ref<string | null>(null);
const detailsSheetOpen = ref(false);
const detailsSheetTab = ref<DetailsSheetTab>('overview');
const detailsSheetAdmission = ref<Admission | null>(null);
const detailsAppointmentSummary = ref<AppointmentSummary | null>(null);
const detailsAppointmentSummaryLoading = ref(false);
const detailsAppointmentSummaryError = ref<string | null>(null);
const detailsDischargeReadinessOpen = ref(true);
const detailsAdtTimelineLoading = ref(false);
const detailsAdtTimelineError = ref<string | null>(null);
const detailsAdtTimelineLogs = ref<AdmissionAuditLog[]>([]);
const detailsAuditFiltersOpen = ref(false);
const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditLogs = ref<AdmissionAuditLog[]>([]);
const detailsAuditMeta = ref<AdmissionAuditLogListResponse['meta'] | null>(null);
const detailsAuditExporting = ref(false);
const transferOriginByAdmissionId = reactive<Record<string, string | null>>({});
const pendingTransferOriginAdmissionIds = new Set<string>();
const detailsAuditFilters = reactive({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    page: 1,
    perPage: 20,
});

const mobileFiltersDrawerOpen = ref(false);
const compactAdmissionRows = useLocalStorageBoolean('opd.admissionRows.compact', false);
const dischargeReadinessByAdmissionId = reactive<Record<string, DischargeReadinessCacheEntry>>({});
const dischargeManualChecklistByAdmissionId = reactive<Record<string, DischargeManualChecklistState>>({});

const today = new Date().toISOString().slice(0, 10);
const initialContextAppointmentId = queryParam('appointmentId').trim();
const initialFocusedAdmissionId = queryParam('focusAdmissionId').trim();
const searchForm = reactive<SearchForm>({
    q: queryParam('q'),
    status: queryParam('status') || 'admitted',
    ward: queryParam('ward'),
    from: queryDateParam('from', today),
    to: queryDateParam('to'),
    perPage: 10,
    page: 1,
});
const initialAdmissionWorkspaceView = queryParam('view').toLowerCase();
const admissionWorkspaceView = ref<AdmissionWorkspaceView>(
    initialAdmissionWorkspaceView === 'board' || initialAdmissionWorkspaceView === 'new'
        ? (initialAdmissionWorkspaceView as AdmissionWorkspaceView)
        : queryParam('from') === 'appointments' ||
            Boolean(queryParam('appointmentId').trim()) ||
            Boolean(queryParam('patientId').trim())
          ? 'new'
          : 'queue',
);
const admissionBrowseView = ref<'queue' | 'board'>(
    initialAdmissionWorkspaceView === 'board' ? 'board' : 'queue',
);

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function transferOriginFromAuditLogs(admission: Admission, logs: AdmissionAuditLog[]): string | null {
    const currentPlacement = formatPlacementLabel(admission.ward, admission.bed);
    const sortedLogs = [...logs].sort((left, right) => {
        const leftTime = parseTimelineTimestamp(left.createdAt) ?? 0;
        const rightTime = parseTimelineTimestamp(right.createdAt) ?? 0;
        return rightTime - leftTime;
    });

    let fallbackOrigin: string | null = null;

    for (const log of sortedLogs) {
        if (log.action !== 'admission.status.updated') continue;
        const toStatus = auditTransitionStatus(log, 'to');
        if ((toStatus ?? '').trim().toLowerCase() !== 'transferred') continue;

        const placementBefore = formatPlacementLabel(
            auditFieldBeforeValue(log, 'ward'),
            auditFieldBeforeValue(log, 'bed'),
        );
        const placementAfter = formatPlacementLabel(
            auditFieldAfterValue(log, 'ward'),
            auditFieldAfterValue(log, 'bed'),
        );

        if (!fallbackOrigin && placementBefore) {
            fallbackOrigin = placementBefore;
        }

        if (currentPlacement && placementAfter && placementAfter === currentPlacement) {
            return placementBefore;
        }
    }

    return fallbackOrigin;
}

function admissionTransferOriginLabel(admission: Admission | null | undefined): string | null {
    if (!admission || !isTransferredAdmissionStatus(admission.status)) return null;
    if (!Object.prototype.hasOwnProperty.call(transferOriginByAdmissionId, admission.id)) return null;
    return transferOriginByAdmissionId[admission.id] ?? null;
}

async function hydrateTransferOrigin(admission: Admission) {
    if (!canViewAdmissionAudit.value || !isTransferredAdmissionStatus(admission.status)) return;
    if (!admission.id || pendingTransferOriginAdmissionIds.has(admission.id)) return;
    if (Object.prototype.hasOwnProperty.call(transferOriginByAdmissionId, admission.id)) return;

    pendingTransferOriginAdmissionIds.add(admission.id);

    try {
        const response = await apiRequest<AdmissionAuditLogListResponse>(
            'GET',
            `/admissions/${admission.id}/audit-logs`,
            {
                query: {
                    page: 1,
                    perPage: 100,
                },
            },
        );

        transferOriginByAdmissionId[admission.id] = transferOriginFromAuditLogs(
            admission,
            response.data ?? [],
        );
    } catch {
        transferOriginByAdmissionId[admission.id] = null;
    } finally {
        pendingTransferOriginAdmissionIds.delete(admission.id);
    }
}

async function hydrateVisibleTransferOrigins(rows: Admission[]) {
    if (!canViewAdmissionAudit.value) return;

    const transferredRows = rows.filter((admission) => isTransferredAdmissionStatus(admission.status));
    await Promise.all(transferredRows.map((admission) => hydrateTransferOrigin(admission)));
}

function queryDateParam(name: string, fallback = ''): string {
    const value = queryParam(name);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function defaultAdmittedAtLocal(): string {
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

const createForm = reactive<CreateForm>({
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    attendingClinicianUserId: '',
    ward: '',
    bed: '',
    admittedAt: defaultAdmittedAtLocal(),
    admissionReason: '',
    notes: '',
    financialClass: 'self_pay',
    billingPayerContractId: '',
    coverageReference: '',
    coverageNotes: '',
});
const createContextEditorOpen = ref(createForm.patientId.trim() === '');
const createContextEditorInitialSelection = reactive({
    patientId: createForm.patientId.trim(),
    appointmentId: createForm.appointmentId.trim(),
});
const createContextEditorTab = ref<CreateContextEditorTab>(
    createForm.appointmentId.trim() ? 'appointment' : 'patient',
);
const openedFromAppointments = queryParam('from') === 'appointments';
const appointmentsReturnHref = initialContextAppointmentId
    ? `/appointments?focusAppointmentId=${encodeURIComponent(initialContextAppointmentId)}`
    : '/appointments';
const createAppointmentLinkSource = ref<CreateContextLinkSource>(
    createForm.appointmentId.trim()
        ? openedFromAppointments && createForm.appointmentId.trim() === initialContextAppointmentId
            ? 'route'
            : 'manual'
        : 'none',
);
const createAdmissionAutoReason = ref('');
const createAdmissionAutoClinicianUserId = ref('');
const createAdmissionAutoCoverageSignature = ref('');

let searchDebounceTimer: number | null = null;
const pendingPatientLookupIds = new Set<string>();
let createAppointmentSummaryRequestId = 0;
let detailsAppointmentSummaryRequestId = 0;
let createAppointmentSuggestionsRequestId = 0;
let pendingCreateAppointmentLinkSource: CreateContextLinkSource | null = null;
let dischargeReadinessRequestId = 0;

function csrfToken(): string | null {
    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return element?.content ?? null;
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: {
        query?: Record<string, string | number | null | undefined>;
        body?: Record<string, unknown>;
    },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
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
    const payload = (await response.json().catch(() => ({}))) as ValidationErrorResponse;
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }
    return payload as T;
}

function billingPayerContractById(id: string | null | undefined): BillingPayerContract | null {
    const normalized = String(id ?? '').trim();
    if (!normalized) return null;

    return billingPayerContracts.value.find((contract) => contract.id === normalized) ?? null;
}

function payerContractLabel(contract: BillingPayerContract): string {
    return (contract.contractName ?? contract.contractCode ?? contract.payerName ?? 'Unnamed payer contract').trim();
}

function payerContractDescription(contract: BillingPayerContract): string {
    return [
        contract.contractCode,
        contract.payerName,
        contract.payerPlanName,
        contract.currencyCode,
    ]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' | ');
}

const createBillingPayerContractOptions = computed<SearchableSelectOption[]>(() =>
    billingPayerContracts.value.map((contract) => ({
        value: contract.id,
        label: payerContractLabel(contract),
        description: payerContractDescription(contract),
        group: financialClassLabel(contract.payerType),
        keywords: [
            contract.contractCode,
            contract.contractName,
            contract.payerName,
            contract.payerPlanCode,
            contract.payerPlanName,
            contract.currencyCode,
            financialClassLabel(contract.payerType),
        ]
            .map((value) => String(value ?? '').trim())
            .filter(Boolean),
    })),
);

const selectedCreateBillingPayerContract = computed(() =>
    billingPayerContractById(createForm.billingPayerContractId),
);

const createCoverageSummary = computed(() =>
    compactVisitCoverageSummary({
        financialClass: createForm.financialClass,
        billingPayerContractId: createForm.billingPayerContractId,
        coverageReference: createForm.coverageReference,
        coverageNotes: createForm.coverageNotes,
    }),
);

function admissionCoverageSignature(source: {
    financialClass?: string | null;
    billingPayerContractId?: string | null;
    coverageReference?: string | null;
    coverageNotes?: string | null;
}): string {
    return JSON.stringify({
        financialClass: normalizeFinancialClass(source.financialClass),
        billingPayerContractId: String(source.billingPayerContractId ?? '').trim(),
        coverageReference: String(source.coverageReference ?? '').trim(),
        coverageNotes: String(source.coverageNotes ?? '').trim(),
    });
}

async function loadBillingPayerContracts(): Promise<void> {
    if (!canReadBillingPayerContracts.value) {
        billingPayerContracts.value = [];
        billingPayerContractsError.value = null;
        billingPayerContractsLoading.value = false;
        billingPayerContractsLoaded.value = false;
        return;
    }

    billingPayerContractsLoading.value = true;
    billingPayerContractsError.value = null;

    try {
        const response = await apiRequest<BillingPayerContractListResponse>('GET', '/billing-payer-contracts', {
            query: {
                status: 'active',
                perPage: 200,
                sortBy: 'contractName',
                sortDir: 'asc',
            },
        });
        billingPayerContracts.value = response.data ?? [];
    } catch (error) {
        billingPayerContracts.value = [];
        billingPayerContractsError.value = messageFromUnknown(error, 'Unable to load payer contracts.');
    } finally {
        billingPayerContractsLoading.value = false;
        billingPayerContractsLoaded.value = true;
    }
}

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

function normalizeLocalDateTimeForApi(value: string): string {
    if (!value) return value;

    const localDate = new Date(value);
    if (Number.isNaN(localDate.getTime())) {
        const normalized = value.replace('T', ' ');
        return normalized.length === 16 ? `${normalized}:00` : normalized;
    }

    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    const hours = String(localDate.getUTCHours()).padStart(2, '0');
    const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function createFieldError(key: string): string | null {
    return createErrors.value[key]?.[0] ?? null;
}

function formatEnumLabel(value: string | null | undefined): string {
    const normalized = value?.trim();
    if (!normalized) return 'Unknown';

    return normalized
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeLookupValue(value: string | null | undefined): string {
    return value?.trim().toLowerCase() ?? '';
}

function wardBedResourceWardValue(resource: WardBedResource): string {
    return resource.wardName?.trim() || '';
}

function wardBedResourceBedValue(resource: WardBedResource): string {
    return resource.bedNumber?.trim() || resource.name?.trim() || resource.code?.trim() || '';
}

function wardBedResourceBedLabel(resource: WardBedResource): string {
    const primary = wardBedResourceBedValue(resource) || 'Unnamed bed';
    const details = [resource.location?.trim(), resource.code?.trim()]
        .filter((value): value is string => Boolean(value) && value !== primary);

    return [primary, ...details].join(' | ');
}

function wardBedPlacementKey(ward: string | null | undefined, bed: string | null | undefined): string {
    const normalizedWard = normalizeLookupValue(ward);
    const normalizedBed = normalizeLookupValue(bed);

    return normalizedWard && normalizedBed ? `${normalizedWard}::${normalizedBed}` : '';
}

function locationBadgeParts(value: string | null | undefined): string[] {
    return (value ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
}
function isAdmittedStatus(value: string | null | undefined): boolean {
    return (value ?? '').trim().toLowerCase() === 'admitted';
}

function hasActivePlacementStatus(value: string | null | undefined): boolean {
    const normalized = (value ?? '').trim().toLowerCase();

    return normalized === 'admitted' || normalized === 'transferred';
}
function normalizeDateTimeQueryValue(value: string | null | undefined): string | null {
    if (!value) return null;
    return value.replace('T', ' ').slice(0, 19);
}

function parseDateTimeValue(value: string | null | undefined): number | null {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function matchesAdmissionContext(
    admission: Admission,
    rowAdmissionId: string | null | undefined,
    rowPatientId: string | null | undefined,
    rowTimestamp: string | null | undefined,
): boolean {
    const admissionId = rowAdmissionId?.trim() ?? '';
    if (admissionId) return admissionId === admission.id;

    const patientId = rowPatientId?.trim() ?? '';
    if (!patientId || patientId !== (admission.patientId ?? '').trim()) return false;

    const admissionStartedAt = parseDateTimeValue(admission.admittedAt ?? admission.createdAt ?? null);
    const rowOccurredAt = parseDateTimeValue(rowTimestamp);

    if (admissionStartedAt !== null && rowOccurredAt !== null) {
        return rowOccurredAt >= admissionStartedAt;
    }

    return true;
}

function normalizeMedicalRecordSummaryStatus(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function normalizeMedicalRecordSummaryType(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function medicalRecordSummaryOccurredAtTimestamp(record: MedicalRecordSummary): number {
    return parseDateTimeValue(record.encounterAt) ?? 0;
}

function sortMedicalRecordSummariesByOccurredAtDesc(
    records: MedicalRecordSummary[],
): MedicalRecordSummary[] {
    return [...records].sort(
        (left, right) =>
            medicalRecordSummaryOccurredAtTimestamp(right)
            - medicalRecordSummaryOccurredAtTimestamp(left),
    );
}

function isDocumentedMedicalRecordSummary(record: MedicalRecordSummary): boolean {
    const status = normalizeMedicalRecordSummaryStatus(record.status);
    return status === 'finalized' || status === 'amended';
}

function isDischargeMedicalRecordSummary(record: MedicalRecordSummary): boolean {
    const recordType = normalizeMedicalRecordSummaryType(record.recordType);
    return recordType === 'discharge_note' || recordType === 'discharge_summary';
}

function defaultDischargeReadinessEntry(): DischargeReadinessCacheEntry {
    return {
        loading: false,
        error: null,
        data: null,
    };
}

function defaultDischargeManualChecklistState(): DischargeManualChecklistState {
    return {
        medicationCounsellingNoted: false,
        paymentPlanConfirmed: false,
        transportConfirmed: false,
    };
}

function dischargeReadinessEntryFor(admissionId: string | null | undefined): DischargeReadinessCacheEntry {
    if (!admissionId) return defaultDischargeReadinessEntry();
    return dischargeReadinessByAdmissionId[admissionId] ?? defaultDischargeReadinessEntry();
}

function dischargeManualChecklistStateFor(admissionId: string | null | undefined): DischargeManualChecklistState {
    if (!admissionId) return defaultDischargeManualChecklistState();
    if (!dischargeManualChecklistByAdmissionId[admissionId]) {
        dischargeManualChecklistByAdmissionId[admissionId] = defaultDischargeManualChecklistState();
    }
    return dischargeManualChecklistByAdmissionId[admissionId];
}

function updateDischargeManualChecklist(
    admissionId: string,
    key: DischargeManualChecklistKey,
    checked: boolean | 'indeterminate',
) {
    dischargeManualChecklistStateFor(admissionId)[key] = checked === true;
}

function modulePatientHref(
    path: string,
    admission: Admission | null,
    extraQuery?: Record<string, string | null | undefined>,
): string {
    const params = new URLSearchParams();
    const patientId = (admission?.patientId ?? '').trim();
    if (patientId) params.set('patientId', patientId);
    const from = (admission?.admittedAt ?? '').slice(0, 10);
    if (from) params.set('from', from);

    Object.entries(extraQuery ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        params.set(key, value);
    });

    const query = params.toString();
    return query ? `${path}?${query}` : path;
}

function dischargeReadinessIcon(item: DischargeReadinessItem): string {
    if (item.complete) return 'check-circle';
    if (item.source === 'manual') return 'circle';
    if (item.source === 'unavailable') return 'shield-check';
    return 'alert-triangle';
}

function dischargeReadinessIconClass(item: DischargeReadinessItem): string {
    if (item.complete) return 'text-emerald-700 dark:text-emerald-200';
    if (item.source === 'manual') return 'text-muted-foreground';
    if (item.source === 'unavailable') return 'text-amber-700 dark:text-amber-200';
    return 'text-amber-700 dark:text-amber-200';
}

function dischargeReadinessIconContainerClass(item: DischargeReadinessItem): string {
    if (item.complete) return 'border-emerald-200/80 bg-emerald-100/80 dark:border-emerald-900/70 dark:bg-emerald-950/35';
    if (item.required) return 'border-amber-200/80 bg-amber-100/80 dark:border-amber-900/70 dark:bg-amber-950/35';
    return 'border-border/70 bg-background/90 dark:bg-muted/20';
}

function dischargeReadinessRowClass(item: DischargeReadinessItem): string {
    if (item.complete) return 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/20';
    if (item.required) return 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/20';
    return 'border-border/70 bg-muted/30 dark:bg-muted/15';
}

function dischargeReadinessBadgeVariant(item: DischargeReadinessItem): 'default' | 'secondary' | 'outline' | 'destructive' {
    return 'outline';
}

function dischargeReadinessBadgeClass(item: DischargeReadinessItem): string {
    if (item.complete) return 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200';
    if (item.required) return 'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200';
    return 'border-border/70 bg-muted/50 text-muted-foreground dark:bg-muted/20';
}

function dischargeReadinessBadgeLabel(item: DischargeReadinessItem): string {
    if (item.complete) return item.required ? 'Required complete' : 'Optional complete';
    if (item.source === 'unavailable') return item.required ? 'Required check unavailable' : 'Optional check unavailable';
    if (item.source === 'manual') return item.required ? 'Required manual check' : 'Optional manual check';
    return item.required ? 'Required' : 'Optional';
}

function summarizeDischargeReadiness(sections: DischargeReadinessSection[]) {
    const items = sections.flatMap((section) => section.items);
    const requiredItems = items.filter((item) => item.required);
    const optionalItems = items.filter((item) => !item.required);

    return {
        requiredComplete: requiredItems.filter((item) => item.complete).length,
        requiredTotal: requiredItems.length,
        optionalComplete: optionalItems.filter((item) => item.complete).length,
        optionalTotal: optionalItems.length,
        blockingItems: requiredItems.filter((item) => !item.complete),
    };
}


function dischargeReadinessHeaderSummary(
    entry: DischargeReadinessCacheEntry,
    summary: ReturnType<typeof summarizeDischargeReadiness>,
): string {
    if (entry.loading) {
        return 'Checking linked Medical Records, Lab, Pharmacy, and Billing signals.';
    }

    if (entry.error) {
        return 'Live discharge-readiness checks are unavailable for this admission.';
    }

    return `${summary.requiredComplete}/${summary.requiredTotal} required complete | ${summary.optionalComplete}/${summary.optionalTotal} optional complete`;
}
function buildDischargeReadinessSections(admission: Admission | null): DischargeReadinessSection[] {
    if (!admission || !hasActivePlacementStatus(admission.status)) return [];

    const entry = dischargeReadinessEntryFor(admission.id);
    const data = entry.data;
    const issues = data?.issues ?? {};
    const manualState = dischargeManualChecklistStateFor(admission.id);
    const medicalRecordCreateHref = admissionMedicalRecordCreateHref(admission, 'discharge_note');
    const laboratoryHref = modulePatientHref('/laboratory-orders', admission);
    const pharmacyHref = modulePatientHref('/pharmacy-orders', admission);
    const billingHref = modulePatientHref('/billing-invoices', admission);

    const relevantMedicalRecords = (data?.medicalRecords ?? []).filter((record) =>
        matchesAdmissionContext(admission, record.admissionId, record.patientId, record.encounterAt),
    );
    const dischargeMedicalRecords = sortMedicalRecordSummariesByOccurredAtDesc(
        relevantMedicalRecords.filter((record) => isDischargeMedicalRecordSummary(record)),
    );
    const latestDischargeSummary = dischargeMedicalRecords[0] ?? null;
    const draftDischargeSummary =
        latestDischargeSummary &&
        normalizeMedicalRecordSummaryStatus(latestDischargeSummary.status) === 'draft'
            ? latestDischargeSummary
            : null;
    const documentedDischargeSummary = dischargeMedicalRecords.find((record) =>
        isDocumentedMedicalRecordSummary(record),
    ) ?? null;
    const dischargeSummaryActionHref = documentedDischargeSummary
        ? (canReadMedicalRecords.value
            ? admissionMedicalRecordDetailsHref(admission, documentedDischargeSummary)
            : undefined)
        : draftDischargeSummary
          ? (canUpdateMedicalRecords.value
                ? admissionMedicalRecordEditHref(admission, draftDischargeSummary)
                : canReadMedicalRecords.value
                  ? admissionMedicalRecordDetailsHref(admission, draftDischargeSummary)
                  : undefined)
          : (canCreateMedicalRecords.value ? medicalRecordCreateHref : undefined);
    const dischargeSummaryActionLabel = documentedDischargeSummary
        ? (canReadMedicalRecords.value ? 'Open discharge note' : undefined)
        : draftDischargeSummary
          ? (canUpdateMedicalRecords.value ? 'Continue discharge note' : canReadMedicalRecords.value ? 'Open draft note' : undefined)
          : (canCreateMedicalRecords.value ? 'Start discharge note' : undefined);
    const dischargeSummaryStatusText = issues.medicalRecords
        ? 'Unable to verify from Medical Records.'
        : documentedDischargeSummary
          ? `${formatEnumLabel(documentedDischargeSummary.recordType)} ${documentedDischargeSummary.recordNumber || 'record'} is documented for this admission.`
          : draftDischargeSummary
            ? `${draftDischargeSummary.recordNumber || 'Discharge note draft'} is in progress and still needs finalization before discharge can be confirmed.`
            : 'No documented discharge note found for this admission.';

    const relevantLaboratoryOrders = (data?.laboratoryOrders ?? []).filter((order) =>
        matchesAdmissionContext(admission, order.admissionId, order.patientId, order.orderedAt),
    );
    const pendingLaboratoryOrders = relevantLaboratoryOrders.filter((order) => {
        const status = (order.status ?? '').trim().toLowerCase();
        return status === 'ordered' || status === 'collected' || status === 'in_progress';
    });

    const relevantPharmacyOrders = (data?.pharmacyOrders ?? []).filter((order) =>
        matchesAdmissionContext(admission, order.admissionId, order.patientId, order.dispensedAt ?? order.orderedAt),
    );
    const dispensedPharmacyOrder = relevantPharmacyOrders.find(
        (order) => (order.status ?? '').trim().toLowerCase() === 'dispensed',
    );

    const relevantBillingInvoices = (data?.billingInvoices ?? []).filter((invoice) =>
        matchesAdmissionContext(admission, invoice.admissionId, invoice.patientId, invoice.invoiceDate),
    );
    const issuedBillingInvoices = relevantBillingInvoices.filter((invoice) => {
        const status = (invoice.status ?? '').trim().toLowerCase();
        return status !== '' && status !== 'draft';
    });
    const settledBillingInvoice = relevantBillingInvoices.find((invoice) => {
        const status = (invoice.status ?? '').trim().toLowerCase();
        const balanceValue =
            typeof invoice.balanceAmount === 'number'
                ? invoice.balanceAmount
                : Number.parseFloat(String(invoice.balanceAmount ?? 'NaN'));
        return status === 'paid' || (!Number.isNaN(balanceValue) && balanceValue <= 0);
    });

    const sections: DischargeReadinessSection[] = [
        {
            key: 'clinical',
            label: 'Clinical',
            description: 'Required checks before discharge can be confirmed.',
            items: [
                {
                    key: 'discharge-summary',
                    label: 'Discharge summary written',
                    description: 'Checks for the final discharge clinical record linked to this admission.',
                    statusText: dischargeSummaryStatusText,
                    required: true,
                    complete: Boolean(documentedDischargeSummary),
                    source: issues.medicalRecords ? 'unavailable' : 'live',
                    actionLabel: dischargeSummaryActionLabel,
                    actionHref: dischargeSummaryActionHref,
                },
                {
                    key: 'pending-lab-results',
                    label: 'Pending lab results reviewed',
                    description: 'Discharge pauses when open or in-progress lab work still exists.',
                    statusText: issues.laboratoryOrders
                        ? 'Unable to verify from Laboratory Orders.'
                        : pendingLaboratoryOrders.length === 0
                            ? 'No pending laboratory orders are linked to this admission.'
                            : `${pendingLaboratoryOrders.length} pending laboratory ${pendingLaboratoryOrders.length === 1 ? 'order remains' : 'orders remain'}.`,
                    required: true,
                    complete: !issues.laboratoryOrders && pendingLaboratoryOrders.length === 0,
                    source: issues.laboratoryOrders ? 'unavailable' : 'live',
                    actionLabel: canReadLaboratoryOrders.value ? 'Open lab orders' : undefined,
                    actionHref: canReadLaboratoryOrders.value ? laboratoryHref : undefined,
                },
            ],
        },
        {
            key: 'medication',
            label: 'Medication',
            description: 'Optional discharge medication steps and bedside education.',
            items: [
                {
                    key: 'discharge-prescription',
                    label: 'Discharge prescription issued',
                    description: 'Looks for a dispensed pharmacy order linked to this admission.',
                    statusText: issues.pharmacyOrders
                        ? 'Unable to verify from Pharmacy Orders.'
                        : dispensedPharmacyOrder
                            ? `Dispensed order ${dispensedPharmacyOrder.orderNumber || 'available'} found.`
                            : 'No dispensed pharmacy order found for this admission.',
                    required: false,
                    complete: !issues.pharmacyOrders && Boolean(dispensedPharmacyOrder),
                    source: issues.pharmacyOrders ? 'unavailable' : 'live',
                    actionLabel: canReadPharmacyOrders.value ? 'Open pharmacy' : undefined,
                    actionHref: canReadPharmacyOrders.value ? pharmacyHref : undefined,
                },
                {
                    key: 'medication-counselling',
                    label: 'Medication counselling noted',
                    description: 'Manual confirmation that discharge counselling was completed.',
                    statusText: manualState.medicationCounsellingNoted
                        ? 'Counselling confirmed for this discharge.'
                        : 'Mark this once counselling is documented.',
                    required: false,
                    complete: manualState.medicationCounsellingNoted,
                    source: 'manual',
                    manualKey: 'medicationCounsellingNoted',
                },
            ],
        },
        {
            key: 'administrative',
            label: 'Administrative',
            description: 'Optional billing completion and patient payment planning.',
            items: [
                {
                    key: 'invoice-issued',
                    label: 'Invoice issued',
                    description: 'Checks for a non-draft billing invoice linked to this admission.',
                    statusText: issues.billingInvoices
                        ? 'Unable to verify from Billing.'
                        : issuedBillingInvoices.length > 0
                            ? `${issuedBillingInvoices.length} billing ${issuedBillingInvoices.length === 1 ? 'invoice is' : 'invoices are'} on file.`
                            : 'No non-draft billing invoice found for this admission.',
                    required: false,
                    complete: !issues.billingInvoices && issuedBillingInvoices.length > 0,
                    source: issues.billingInvoices ? 'unavailable' : 'live',
                    actionLabel: canReadBillingInvoices.value ? 'Open billing' : undefined,
                    actionHref: canReadBillingInvoices.value ? billingHref : undefined,
                },
                {
                    key: 'payment-settled',
                    label: 'Payment settled or plan confirmed',
                    description: 'Auto-completes when the invoice is paid, or can be marked manually after plan confirmation.',
                    statusText: issues.billingInvoices
                        ? 'Unable to verify billing settlement automatically.'
                        : settledBillingInvoice
                            ? `Billing settled on ${settledBillingInvoice.invoiceNumber || 'latest invoice'}.`
                            : manualState.paymentPlanConfirmed
                                ? 'Payment plan confirmed for discharge.'
                                : issuedBillingInvoices.length > 0
                                    ? 'Invoice exists, but payment is still open.'
                                    : 'No payment plan or settled invoice recorded yet.',
                    required: false,
                    complete: !issues.billingInvoices && Boolean(settledBillingInvoice || manualState.paymentPlanConfirmed),
                    source: issues.billingInvoices
                        ? 'unavailable'
                        : settledBillingInvoice
                            ? 'mixed'
                            : 'manual',
                    manualKey: settledBillingInvoice ? undefined : 'paymentPlanConfirmed',
                    actionLabel: canReadBillingInvoices.value ? 'Open billing' : undefined,
                    actionHref: canReadBillingInvoices.value ? billingHref : undefined,
                },
            ],
        },
        {
            key: 'logistics',
            label: 'Logistics',
            description: 'Optional handoff confirmation before the patient leaves the ward.',
            items: [
                {
                    key: 'transport',
                    label: 'Transport arranged or self-discharge confirmed',
                    description: 'Manual confirmation for transport or patient self-discharge.',
                    statusText: manualState.transportConfirmed
                        ? 'Transport/self-discharge confirmation captured.'
                        : 'Mark this once the patient transport plan is confirmed.',
                    required: false,
                    complete: manualState.transportConfirmed,
                    source: 'manual',
                    manualKey: 'transportConfirmed',
                },
            ],
        },
    ];

    return sections;
}

async function loadDischargeReadiness(admission: Admission, options?: { force?: boolean }) {
    const admissionId = admission.id.trim();
    const patientId = admission.patientId?.trim() ?? '';

    if (!admissionId) return;

    const existingEntry = dischargeReadinessEntryFor(admissionId);
    if (!options?.force && (existingEntry.loading || existingEntry.data)) {
        return;
    }

    if (!patientId) {
        dischargeReadinessByAdmissionId[admissionId] = {
            loading: false,
            error: 'Patient context is missing, so discharge readiness cannot be checked.',
            data: {
                medicalRecords: [],
                laboratoryOrders: [],
                pharmacyOrders: [],
                billingInvoices: [],
                issues: {
                    medicalRecords: 'Patient context missing.',
                    laboratoryOrders: 'Patient context missing.',
                    pharmacyOrders: 'Patient context missing.',
                    billingInvoices: 'Patient context missing.',
                },
            },
        };
        return;
    }

    dischargeReadinessByAdmissionId[admissionId] = {
        loading: true,
        error: null,
        data: existingEntry.data,
    };

    const requestId = ++dischargeReadinessRequestId;
    const from = normalizeDateTimeQueryValue(admission.admittedAt ?? admission.createdAt ?? null);

    const [medicalRecordsResult, laboratoryOrdersResult, pharmacyOrdersResult, billingInvoicesResult] = await Promise.allSettled([
        canReadMedicalRecords.value
            ? apiRequest<MedicalRecordListResponse>('GET', '/medical-records', {
                query: {
                    patientId,
                    admissionId: admission.id,
                    from,
                    page: 1,
                    perPage: 50,
                    sortBy: 'encounterAt',
                    sortDir: 'desc',
                },
            })
            : Promise.reject(new Error('Medical Records access is not available.')),
        canReadLaboratoryOrders.value
            ? apiRequest<LaboratoryOrderListResponse>('GET', '/laboratory-orders', {
                query: {
                    patientId,
                    from,
                    page: 1,
                    perPage: 50,
                    sortBy: 'orderedAt',
                    sortDir: 'desc',
                },
            })
            : Promise.reject(new Error('Laboratory Orders access is not available.')),
        canReadPharmacyOrders.value
            ? apiRequest<PharmacyOrderListResponse>('GET', '/pharmacy-orders', {
                query: {
                    patientId,
                    from,
                    page: 1,
                    perPage: 50,
                    sortBy: 'orderedAt',
                    sortDir: 'desc',
                },
            })
            : Promise.reject(new Error('Pharmacy Orders access is not available.')),
        canReadBillingInvoices.value
            ? apiRequest<BillingInvoiceListResponse>('GET', '/billing-invoices', {
                query: {
                    patientId,
                    from,
                    page: 1,
                    perPage: 50,
                    sortBy: 'invoiceDate',
                    sortDir: 'desc',
                },
            })
            : Promise.reject(new Error('Billing access is not available.')),
    ]);

    if (requestId !== dischargeReadinessRequestId) return;

    const issues: Partial<Record<DischargeReadinessModuleKey, string>> = {};

    if (medicalRecordsResult.status === 'rejected') {
        issues.medicalRecords = messageFromUnknown(medicalRecordsResult.reason, 'Unable to load Medical Records.');
    }

    if (laboratoryOrdersResult.status === 'rejected') {
        issues.laboratoryOrders = messageFromUnknown(laboratoryOrdersResult.reason, 'Unable to load Laboratory Orders.');
    }

    if (pharmacyOrdersResult.status === 'rejected') {
        issues.pharmacyOrders = messageFromUnknown(pharmacyOrdersResult.reason, 'Unable to load Pharmacy Orders.');
    }

    if (billingInvoicesResult.status === 'rejected') {
        issues.billingInvoices = messageFromUnknown(billingInvoicesResult.reason, 'Unable to load Billing.');
    }

    dischargeReadinessByAdmissionId[admissionId] = {
        loading: false,
        error: Object.keys(issues).length === 4 ? 'All linked discharge-readiness checks are unavailable.' : null,
        data: {
            medicalRecords: medicalRecordsResult.status === 'fulfilled' ? medicalRecordsResult.value.data ?? [] : [],
            laboratoryOrders: laboratoryOrdersResult.status === 'fulfilled' ? laboratoryOrdersResult.value.data ?? [] : [],
            pharmacyOrders: pharmacyOrdersResult.status === 'fulfilled' ? pharmacyOrdersResult.value.data ?? [] : [],
            billingInvoices: billingInvoicesResult.status === 'fulfilled' ? billingInvoicesResult.value.data ?? [] : [],
            issues,
        },
    };
}

const detailsDischargeReadinessEntry = computed(() =>
    dischargeReadinessEntryFor(detailsSheetAdmission.value?.id),
);

const detailsDischargeReadinessSections = computed(() =>
    buildDischargeReadinessSections(detailsSheetAdmission.value),
);

const detailsDischargeReadinessSummary = computed(() =>
    summarizeDischargeReadiness(detailsDischargeReadinessSections.value),
);

const detailsDischargeReadinessHeaderSummary = computed(() =>
    dischargeReadinessHeaderSummary(detailsDischargeReadinessEntry.value, detailsDischargeReadinessSummary.value),
);

const detailsDischargeManualState = computed(() =>
    dischargeManualChecklistStateFor(detailsSheetAdmission.value?.id),
);

const statusDialogDischargeReadinessEntry = computed(() =>
    dischargeReadinessEntryFor(statusDialogAdmission.value?.id),
);

const statusDialogDischargeReadinessSections = computed(() =>
    statusDialogAction.value === 'discharged'
        ? buildDischargeReadinessSections(statusDialogAdmission.value)
        : [],
);

const statusDialogDischargeReadinessSummary = computed(() =>
    summarizeDischargeReadiness(statusDialogDischargeReadinessSections.value),
);

const statusDialogDischargeReadinessHeaderSummary = computed(() =>
    dischargeReadinessHeaderSummary(statusDialogDischargeReadinessEntry.value, statusDialogDischargeReadinessSummary.value),
);

const statusDialogCanConfirmDischarge = computed(() => {
    if (statusDialogAction.value !== 'discharged') return true;
    const entry = statusDialogDischargeReadinessEntry.value;
    const summary = statusDialogDischargeReadinessSummary.value;
    if (entry.loading) return false;
    if (entry.error) return true;
    return summary.requiredComplete === summary.requiredTotal;
});

const statusDialogDischargeBlockReason = computed(() => {
    if (statusDialogAction.value !== 'discharged') return '';
    const entry = statusDialogDischargeReadinessEntry.value;
    if (entry.loading) return 'Checking required discharge steps first.';
    if (entry.error) return '';
    const blockingItem = statusDialogDischargeReadinessSummary.value.blockingItems[0];
    if (!blockingItem) return '';
    return `Complete required discharge steps first: ${blockingItem.label}.`;
});

const statusDialogTransferPlacementBlockedReason = computed(() => {
    if (statusDialogAction.value !== 'transferred') return '';
    if (wardBedRegistryLoading.value) {
        return 'Ward and bed registry is still loading.';
    }
    if (!canReadWardBedRegistry.value) {
        return 'Ward/bed registry access is required before the transfer handoff can be completed.';
    }
    if (wardBedRegistryError.value) {
        return 'Ward/bed registry could not be loaded. Refresh and try again.';
    }
    if (!wardBedRegistryAvailable.value) {
        return 'No active wards are available in the backend ward/bed registry.';
    }
    if (!statusDialogReceivingWard.value.trim()) {
        return 'Select the receiving ward from the backend ward/bed registry.';
    }
    if (statusDialogReceivingBedOptions.value.length === 0) {
        return 'Selected receiving ward has no active beds in the backend ward/bed registry.';
    }
    if (selectableStatusDialogReceivingBedOptions.value.length === 0) {
        return 'All active beds in the selected receiving ward are currently occupied.';
    }
    if (!statusDialogReceivingBed.value.trim()) {
        return 'Select an available receiving bed from the backend ward/bed registry.';
    }
    if (statusDialogSelectedReceivingBedOption.value && !statusDialogSelectedReceivingBedOption.value.isSelectable) {
        return 'Selected receiving bed is already occupied. Choose another bed.';
    }

    const currentPlacement = formatPlacementLabel(
        statusDialogAdmission.value?.ward,
        statusDialogAdmission.value?.bed,
    );
    const receivingPlacement = formatPlacementLabel(
        statusDialogReceivingWard.value,
        statusDialogReceivingBed.value,
    );
    if (currentPlacement && receivingPlacement && currentPlacement === receivingPlacement) {
        return 'Select a different receiving ward or bed for this transfer.';
    }

    return '';
});

const statusDialogActionBlockedReason = computed(() => {
    if (statusDialogAction.value === 'discharged') {
        return statusDialogCanConfirmDischarge.value ? '' : statusDialogDischargeBlockReason.value;
    }
    if (statusDialogAction.value === 'transferred') {
        return statusDialogTransferPlacementBlockedReason.value;
    }
    return '';
});
const detailsDischargeFollowUpActions = computed(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission || !isDischargedAdmissionStatus(admission.status)) return [];

    const actions: Array<{ key: string; label: string; href: string; icon: string }> = [];

    if (canReadAppointments.value) {
        actions.push({
            key: 'appointments',
            label: 'Schedule post-discharge review',
            href: admissionFollowUpWorkflowHref(admission),
            icon: 'calendar-clock',
        });
    }

    if (canReadMedicalRecords.value) {
        actions.push({
            key: 'medical-records',
            label: 'Open medical records',
            href: modulePatientHref('/medical-records', admission),
            icon: 'file-text',
        });
    }

    if (canReadBillingInvoices.value) {
        actions.push({
            key: 'billing',
            label: 'Open billing follow-up',
            href: modulePatientHref('/billing-invoices', admission),
            icon: 'credit-card',
        });
    }

    return actions;
});

const detailsDischargeFollowUpSummary = computed(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission || !isDischargedAdmissionStatus(admission.status)) return null;

    const plan = admission.followUpPlan?.trim();
    if (plan) return plan;

    return 'No follow-up plan was recorded. Use Appointments or Medical Records to document the next review step.';
});

const detailsAdmissionRelevantMedicalRecords = computed<MedicalRecordSummary[]>(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission || !hasActivePlacementStatus(admission.status)) return [];

    return sortMedicalRecordSummariesByOccurredAtDesc(
        (detailsDischargeReadinessEntry.value.data?.medicalRecords ?? []).filter((record) =>
            matchesAdmissionContext(admission, record.admissionId, record.patientId, record.encounterAt),
        ),
    );
});

const detailsAdmissionOpeningNoteSummary = computed<InpatientNoteWorkflowSummary | null>(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission || !hasActivePlacementStatus(admission.status)) return null;

    const relevantMedicalRecords = detailsAdmissionRelevantMedicalRecords.value;
    const admissionNotes = relevantMedicalRecords.filter(
        (record) => normalizeMedicalRecordSummaryType(record.recordType) === 'admission_note',
    );
    const latestRecord = admissionNotes[0] ?? null;
    const latestDraftRecord = admissionNotes.find(
        (record) => normalizeMedicalRecordSummaryStatus(record.status) === 'draft',
    ) ?? null;
    const latestDocumentedRecord = admissionNotes.find((record) =>
        isDocumentedMedicalRecordSummary(record),
    ) ?? null;
    const openAllHref = canReadMedicalRecords.value
        ? admissionMedicalRecordBrowseHref(admission)
        : null;

    if (!latestRecord) {
        return {
            state: 'missing',
            badgeLabel: 'Missing',
            badgeVariant: 'destructive',
            title: 'Opening admission note still needed',
            description: 'Capture one admission note as the opening inpatient clerking record for this stay before later follow-up notes accumulate.',
            guidance: 'Use one admission note for the opening history and initial plan, then continue the stay with progress notes instead of starting another opening clerking note.',
            noteCount: 0,
            latestRecord: null,
            latestRecordedAtLabel: null,
            primaryActionLabel: canCreateMedicalRecords.value ? 'Start admission note' : openAllHref ? 'Open medical records' : null,
            primaryActionHref: canCreateMedicalRecords.value
                ? admissionMedicalRecordCreateHref(admission, 'admission_note')
                : openAllHref,
            secondaryActionLabel: openAllHref && canCreateMedicalRecords.value ? 'Open medical records' : null,
            secondaryActionHref: openAllHref && canCreateMedicalRecords.value ? openAllHref : null,
        };
    }

    if (latestDraftRecord && !latestDocumentedRecord) {
        const draftHref = canUpdateMedicalRecords.value
            ? admissionMedicalRecordEditHref(admission, latestDraftRecord)
            : canReadMedicalRecords.value
              ? admissionMedicalRecordDetailsHref(admission, latestDraftRecord)
              : null;

        return {
            state: 'draft',
            badgeLabel: 'Draft in progress',
            badgeVariant: 'secondary',
            title: 'Opening admission note is in progress',
            description: `${latestDraftRecord.recordNumber || 'Admission note draft'} is already linked to this stay. Finalize it once the opening clerking is complete.`,
            guidance: 'Keep the opening admission note as the first inpatient document for this stay, then move later reviews into progress notes and linked orders.',
            noteCount: admissionNotes.length,
            latestRecord: latestDraftRecord,
            latestRecordedAtLabel: latestDraftRecord.encounterAt ? formatDateTime(latestDraftRecord.encounterAt) : null,
            primaryActionLabel: draftHref
                ? canUpdateMedicalRecords.value
                    ? 'Continue admission note'
                    : 'Open draft note'
                : null,
            primaryActionHref: draftHref,
            secondaryActionLabel: openAllHref && draftHref !== openAllHref ? 'Open medical records' : null,
            secondaryActionHref: openAllHref && draftHref !== openAllHref ? openAllHref : null,
        };
    }

    const documentedRecord = latestDocumentedRecord ?? latestRecord;
    const documentedStatus = normalizeMedicalRecordSummaryStatus(documentedRecord.status);
    const documentedHref = canReadMedicalRecords.value
        ? admissionMedicalRecordDetailsHref(admission, documentedRecord)
        : null;

    return {
        state: 'documented',
        badgeLabel: documentedStatus === 'amended' ? 'Amended' : 'Documented',
        badgeVariant: documentedStatus === 'amended' ? 'secondary' : 'default',
        title: 'Opening admission note is documented',
        description: `${documentedRecord.recordNumber || 'Admission note'} is already linked to this stay. Keep later inpatient follow-up in progress notes so the opening clerking note stays clear.`,
        guidance: 'Use progress notes for ongoing ward reviews, treatment response updates, and later inpatient follow-up. Keep the admission note as the opening clinical summary for the stay.',
        noteCount: admissionNotes.length,
        latestRecord: documentedRecord,
        latestRecordedAtLabel: documentedRecord.encounterAt ? formatDateTime(documentedRecord.encounterAt) : null,
        primaryActionLabel: documentedHref ? 'Open admission note' : null,
        primaryActionHref: documentedHref,
        secondaryActionLabel: openAllHref && documentedHref !== openAllHref ? 'Open medical records' : null,
        secondaryActionHref: openAllHref && documentedHref !== openAllHref ? openAllHref : null,
    };
});

const detailsAdmissionProgressNoteSummary = computed<InpatientNoteWorkflowSummary | null>(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission || !hasActivePlacementStatus(admission.status)) return null;

    const progressNotes = detailsAdmissionRelevantMedicalRecords.value.filter(
        (record) => normalizeMedicalRecordSummaryType(record.recordType) === 'progress_note',
    );
    const latestRecord = progressNotes[0] ?? null;
    const latestDraftRecord =
        latestRecord &&
        normalizeMedicalRecordSummaryStatus(latestRecord.status) === 'draft'
            ? latestRecord
            : null;
    const latestDocumentedRecord = progressNotes.find((record) =>
        isDocumentedMedicalRecordSummary(record),
    ) ?? null;
    const openHistoryHref = canReadMedicalRecords.value
        ? admissionMedicalRecordBrowseHref(admission, {
            recordType: 'progress_note',
        })
        : null;

    if (!latestRecord) {
        return {
            state: 'missing',
            badgeLabel: 'Not started',
            badgeVariant: 'outline',
            title: 'Daily progress note not started yet',
            description: 'Use progress notes for ongoing inpatient reviews after the opening admission note is complete.',
            guidance: 'Capture interval change, treatment response, and the updated ward plan in progress notes throughout the stay.',
            noteCount: 0,
            latestRecord: null,
            latestRecordedAtLabel: null,
            primaryActionLabel: canCreateMedicalRecords.value ? 'Start progress note' : openHistoryHref ? 'Open progress notes' : null,
            primaryActionHref: canCreateMedicalRecords.value
                ? admissionMedicalRecordCreateHref(admission, 'progress_note')
                : openHistoryHref,
            secondaryActionLabel: openHistoryHref && canCreateMedicalRecords ? 'Open progress notes' : null,
            secondaryActionHref: openHistoryHref && canCreateMedicalRecords ? openHistoryHref : null,
        };
    }

    if (latestDraftRecord) {
        const draftHref = canUpdateMedicalRecords.value
            ? admissionMedicalRecordEditHref(admission, latestDraftRecord)
            : canReadMedicalRecords.value
              ? admissionMedicalRecordDetailsHref(admission, latestDraftRecord)
              : null;

        return {
            state: 'draft',
            badgeLabel: 'Draft in progress',
            badgeVariant: 'secondary',
            title: 'Daily progress note is in progress',
            description: `${latestDraftRecord.recordNumber || 'Progress note draft'} is already linked to this stay. Continue it to keep the latest inpatient follow-up up to date.`,
            guidance: 'Use progress notes for daily reviews, treatment response updates, and changes in the ward plan while the stay remains active.',
            noteCount: progressNotes.length,
            latestRecord: latestDraftRecord,
            latestRecordedAtLabel: latestDraftRecord.encounterAt ? formatDateTime(latestDraftRecord.encounterAt) : null,
            primaryActionLabel: draftHref
                ? canUpdateMedicalRecords.value
                    ? 'Continue progress note'
                    : 'Open draft note'
                : null,
            primaryActionHref: draftHref,
            secondaryActionLabel: openHistoryHref && draftHref !== openHistoryHref ? 'Open progress notes' : null,
            secondaryActionHref: openHistoryHref && draftHref !== openHistoryHref ? openHistoryHref : null,
        };
    }

    const documentedRecord = latestDocumentedRecord ?? latestRecord;
    const documentedStatus = normalizeMedicalRecordSummaryStatus(documentedRecord.status);
    const documentedHref = canReadMedicalRecords.value
        ? admissionMedicalRecordDetailsHref(admission, documentedRecord)
        : null;

    return {
        state: 'documented',
        badgeLabel: documentedStatus === 'amended' ? 'Amended' : 'Documented',
        badgeVariant: documentedStatus === 'amended' ? 'secondary' : 'default',
        title: 'Progress note continuity is active',
        description: `${documentedRecord.recordNumber || 'Progress note'} is the latest inpatient follow-up note linked to this stay.`,
        guidance: 'Keep using progress notes for daily ward reviews, treatment response, and updated plans until discharge documentation is ready.',
        noteCount: progressNotes.length,
        latestRecord: documentedRecord,
        latestRecordedAtLabel: documentedRecord.encounterAt ? formatDateTime(documentedRecord.encounterAt) : null,
        primaryActionLabel: documentedHref ? 'Open latest progress note' : null,
        primaryActionHref: documentedHref,
        secondaryActionLabel: openHistoryHref && documentedHref !== openHistoryHref ? 'Open progress notes' : null,
        secondaryActionHref: openHistoryHref && documentedHref !== openHistoryHref ? openHistoryHref : null,
    };
});

const detailsAdmissionDischargeNoteSummary = computed<InpatientNoteWorkflowSummary | null>(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission || !hasActivePlacementStatus(admission.status)) return null;

    const dischargeNotes = detailsAdmissionRelevantMedicalRecords.value.filter((record) =>
        isDischargeMedicalRecordSummary(record),
    );
    const latestRecord = dischargeNotes[0] ?? null;
    const latestDraftRecord =
        latestRecord &&
        normalizeMedicalRecordSummaryStatus(latestRecord.status) === 'draft'
            ? latestRecord
            : null;
    const latestDocumentedRecord = dischargeNotes.find((record) =>
        isDocumentedMedicalRecordSummary(record),
    ) ?? null;
    const openHistoryHref = canReadMedicalRecords.value
        ? admissionMedicalRecordBrowseHref(admission, {
            recordType: 'discharge_note',
        })
        : null;

    if (!latestRecord) {
        return {
            state: 'missing',
            badgeLabel: 'Not started',
            badgeVariant: 'outline',
            title: 'Discharge note not started yet',
            description: 'Use a discharge note to summarize completed inpatient care, discharge condition, medicines, and follow-up instructions.',
            guidance: 'Keep daily follow-up in progress notes until discharge is clinically appropriate, then draft the discharge note before confirming the admission closeout.',
            noteCount: 0,
            latestRecord: null,
            latestRecordedAtLabel: null,
            primaryActionLabel: canCreateMedicalRecords.value ? 'Start discharge note' : openHistoryHref ? 'Open discharge notes' : null,
            primaryActionHref: canCreateMedicalRecords.value
                ? admissionMedicalRecordCreateHref(admission, 'discharge_note')
                : openHistoryHref,
            secondaryActionLabel: openHistoryHref && canCreateMedicalRecords ? 'Open discharge notes' : null,
            secondaryActionHref: openHistoryHref && canCreateMedicalRecords ? openHistoryHref : null,
        };
    }

    if (latestDraftRecord) {
        const draftHref = canUpdateMedicalRecords.value
            ? admissionMedicalRecordEditHref(admission, latestDraftRecord)
            : canReadMedicalRecords.value
              ? admissionMedicalRecordDetailsHref(admission, latestDraftRecord)
              : null;

        return {
            state: 'draft',
            badgeLabel: 'Draft in progress',
            badgeVariant: 'secondary',
            title: 'Discharge note is in progress',
            description: `${latestDraftRecord.recordNumber || 'Discharge note draft'} is already linked to this stay. Finalize it when the discharge plan and bedside checks are complete.`,
            guidance: 'Use the discharge note for the final clinical summary of the stay, then confirm discharge destination and follow-up in the admission closeout workflow.',
            noteCount: dischargeNotes.length,
            latestRecord: latestDraftRecord,
            latestRecordedAtLabel: latestDraftRecord.encounterAt ? formatDateTime(latestDraftRecord.encounterAt) : null,
            primaryActionLabel: draftHref
                ? canUpdateMedicalRecords.value
                    ? 'Continue discharge note'
                    : 'Open draft note'
                : null,
            primaryActionHref: draftHref,
            secondaryActionLabel: openHistoryHref && draftHref !== openHistoryHref ? 'Open discharge notes' : null,
            secondaryActionHref: openHistoryHref && draftHref !== openHistoryHref ? openHistoryHref : null,
        };
    }

    const documentedRecord = latestDocumentedRecord ?? latestRecord;
    const documentedStatus = normalizeMedicalRecordSummaryStatus(documentedRecord.status);
    const documentedHref = canReadMedicalRecords.value
        ? admissionMedicalRecordDetailsHref(admission, documentedRecord)
        : null;

    return {
        state: 'documented',
        badgeLabel: documentedStatus === 'amended' ? 'Amended' : 'Documented',
        badgeVariant: documentedStatus === 'amended' ? 'secondary' : 'default',
        title: 'Discharge note is ready',
        description: `${documentedRecord.recordNumber || 'Discharge note'} is linked to this stay and can support discharge confirmation once the remaining admission closeout checks are satisfied.`,
        guidance: 'Review destination, follow-up plan, counselling, and other readiness items, then confirm discharge when the team is ready to close the stay.',
        noteCount: dischargeNotes.length,
        latestRecord: documentedRecord,
        latestRecordedAtLabel: documentedRecord.encounterAt ? formatDateTime(documentedRecord.encounterAt) : null,
        primaryActionLabel: documentedHref ? 'Open discharge note' : null,
        primaryActionHref: documentedHref,
        secondaryActionLabel: openHistoryHref && documentedHref !== openHistoryHref ? 'Open discharge notes' : null,
        secondaryActionHref: openHistoryHref && documentedHref !== openHistoryHref ? openHistoryHref : null,
    };
});

const detailsWorkflowActionTitle = computed(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission) return 'ADT actions';
    if (isDischargedAdmissionStatus(admission.status)) return 'Post-discharge actions';
    if (isTransferredAdmissionStatus(admission.status)) return 'Receiving unit actions';
    if (isCancelledAdmissionStatus(admission.status)) return 'Administrative review';
    return 'Active ADT actions';
});

const detailsWorkflowActionDescription = computed(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission) return 'Use the current admission state to continue the inpatient workflow.';
    if (isDischargedAdmissionStatus(admission.status)) {
        return 'Carry this closed stay into follow-up, records, or billing review.';
    }
    if (isTransferredAdmissionStatus(admission.status)) {
        return 'Manage the receiving-unit stay, placement changes, and downstream clinical work.';
    }
    if (isCancelledAdmissionStatus(admission.status)) {
        return 'This admission is closed. Review linked records or return to the queue.';
    }
    return 'Run the active inpatient ADT actions and keep the opening admission note aligned with this stay.';
});

const detailsShiftHandoffSummary = computed(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission) return null;

    const latestEvent =
        detailsAdtTimelineEvents.value[detailsAdtTimelineEvents.value.length - 1] ?? null;
    const readinessEntry = detailsDischargeReadinessEntry.value;
    const readinessSummary = detailsDischargeReadinessSummary.value;
    const blockingItem = readinessSummary.blockingItems[0] ?? null;
    const handoffSource = admission.appointmentId ? 'Consultation handoff' : 'Direct admission';

    let recommendationTitle = 'Review admission status';
    let recommendationDescription = 'Use the current admission context to decide the next workflow step.';
    let tone: 'default' | 'secondary' | 'outline' | 'destructive' = 'outline';
    let primaryActionType: 'link' | 'status' | 'none' = 'none';
    let primaryActionLabel: string | null = null;
    let primaryActionHref: string | null = null;
    let primaryActionStatus: 'discharged' | 'transferred' | 'cancelled' | null = null;

    if (!hasActivePlacementStatus(admission.status)) {
        tone = statusVariant(admission.status);
        if ((admission.status ?? '').trim().toLowerCase() === 'discharged') {
            recommendationTitle = 'Discharge follow-up ready';
            recommendationDescription = admission.followUpPlan?.trim()
                ? `Follow-up plan captured: ${admission.followUpPlan.trim()}`
                : 'Use downstream workflows to schedule review, finalize discharge documentation, and close remaining follow-up.';
            primaryActionType = 'link';
            if (canReadAppointments.value) {
                primaryActionLabel = 'Schedule post-discharge review';
                primaryActionHref = admissionFollowUpWorkflowHref(admission);
            } else {
                primaryActionLabel = 'Open medical records';
                primaryActionHref = modulePatientHref('/medical-records', admission);
            }
        } else if ((admission.status ?? '').trim().toLowerCase() === 'transferred') {
            recommendationTitle = 'Receiving team handoff required';
            recommendationDescription = 'Use the latest ADT event and ward placement context to continue care in the receiving unit.';
            primaryActionType = 'link';
            primaryActionLabel = 'Back to queue';
            primaryActionHref = '/admissions';
        } else {
            recommendationTitle = 'Admission is no longer active';
            recommendationDescription = 'No active inpatient handoff remains for this admission. Review notes or audit history if follow-up is needed.';
            primaryActionType = 'link';
            primaryActionLabel = 'Back to queue';
            primaryActionHref = '/admissions';
        }
    } else if (readinessEntry.loading) {
        tone = 'secondary';
        recommendationTitle = 'Checking discharge readiness';
        recommendationDescription = 'Linked Medical Records, Lab, Pharmacy, and Billing checks are still loading for this patient.';
    } else if (readinessEntry.error) {
        tone = 'secondary';
        recommendationTitle = 'Discharge readiness unavailable';
        recommendationDescription = readinessEntry.error;
    } else if (blockingItem) {
        tone = 'destructive';
        recommendationTitle = 'Next shift action';
        recommendationDescription = `${readinessSummary.blockingItems.length} required discharge ${readinessSummary.blockingItems.length === 1 ? 'step is' : 'steps are'} still open. Prioritize ${blockingItem.label.toLowerCase()}.`;

        if (blockingItem.key === 'discharge-summary') {
            primaryActionType = 'link';
            primaryActionLabel = 'Open medical records';
            primaryActionHref = modulePatientHref('/medical-records', admission);
        } else if (blockingItem.key === 'pending-lab-results') {
            primaryActionType = 'link';
            primaryActionLabel = 'Open lab orders';
            primaryActionHref = modulePatientHref('/laboratory-orders', admission);
        } else {
            primaryActionType = 'link';
            primaryActionLabel = 'Review admission';
            primaryActionHref = '/admissions';
        }
    } else {
        tone = 'default';
        recommendationTitle = 'Ready for discharge review';
        recommendationDescription = 'Required discharge checks are complete. The next shift can review optional items and proceed with discharge when clinically appropriate.';
        primaryActionType = 'status';
        primaryActionLabel = 'Start discharge';
        primaryActionStatus = 'discharged';
    }

    return {
        handoffSource,
        latestEventTitle: latestEvent?.title ?? 'No ADT event yet',
        latestEventTime: latestEvent?.timestamp ? formatDateTime(latestEvent.timestamp) : 'No timestamp available',
        latestEventDescription:
            latestEvent?.description ??
            'Admission movement history is not available yet.',
        blockerCount: readinessSummary.blockingItems.length,
        requiredProgress: `${readinessSummary.requiredComplete}/${readinessSummary.requiredTotal}`,
        recommendationTitle,
        recommendationDescription,
        tone,
        primaryActionType,
        primaryActionLabel,
        primaryActionHref,
        primaryActionStatus,
    };
});

const occupancyBoardClosureHelperText = computed(
    () =>
        'Transferred admissions remain visible in the receiving bed. Discharged and voided admissions drop off the bed board once the placement is closed.',
);

const detailsClosureSummary = computed(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission || !isClosedAdmissionStatus(admission.status)) return null;

    if (isDischargedAdmissionStatus(admission.status)) {
        return {
            badgeLabel: 'Closed',
            title: 'Discharged from inpatient stay',
            timestampLabel: formatDateTime(admission.dischargedAt || admission.updatedAt),
            impactLabel: 'Bed impact',
            impactValue: 'Placement released from inpatient occupancy.',
            contextLabel: 'Destination',
            contextValue: admission.dischargeDestination || 'Not recorded',
            noteLabel: 'Follow-up',
            noteValue:
                admission.followUpPlan?.trim() ||
                admission.statusReason?.trim() ||
                'No follow-up plan recorded.',
        };
    }

    if (isTransferredAdmissionStatus(admission.status)) {
        const placement = formatPlacementLabel(admission.ward, admission.bed);
        return {
            badgeLabel: 'Receiving unit active',
            title: 'Transferred to receiving ward',
            timestampLabel: formatDateTime(admission.updatedAt),
            impactLabel: 'Current placement',
            impactValue: placement || 'Receiving ward and bed are recorded on this admission.',
            contextLabel: 'Receiving ward/bed',
            contextValue: placement || 'Not recorded',
            noteLabel: 'Transfer note',
            noteValue: admission.statusReason?.trim() || 'No transfer note recorded.',
        };
    }

    return {
        badgeLabel: 'Voided',
        title: 'Admission record voided',
        timestampLabel: formatDateTime(admission.updatedAt),
        impactLabel: 'Bed impact',
        impactValue: 'No active inpatient bed should remain assigned to this admission.',
        contextLabel: 'Final state',
        contextValue: 'Voided as an administrative correction',
        noteLabel: 'Void note',
        noteValue: admission.statusReason?.trim() || 'No void note recorded.',
    };
});

function stringifyAuditValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'None';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function appointmentReturnHref(appointmentId?: string | null): string {
    const selectedAppointmentId = (appointmentId ?? '').trim() || createForm.appointmentId.trim();
    if (!selectedAppointmentId) return '/appointments';
    return `/appointments?focusAppointmentId=${encodeURIComponent(selectedAppointmentId)}`;
}

function contextHref(
    path: string,
    options?: {
        patientId?: string | null;
        appointmentId?: string | null;
        admissionId?: string | null;
        includeTabNew?: boolean;
        extraQuery?: Record<string, string | null | undefined>;
    },
): string {
    const params = new URLSearchParams();

    if (options?.includeTabNew) {
        params.set('tab', 'new');
    }

    const patientId = (options?.patientId ?? '').trim();
    const appointmentId = (options?.appointmentId ?? '').trim();
    const admissionId = (options?.admissionId ?? '').trim();

    if (patientId) params.set('patientId', patientId);
    if (appointmentId) params.set('appointmentId', appointmentId);
    if (admissionId) params.set('admissionId', admissionId);
    Object.entries(options?.extraQuery ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        params.set(key, value);
    });

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

function createWorkflowHref(
    path: string,
    options?: {
        includeTabNew?: boolean;
        extraQuery?: Record<string, string | null | undefined>;
    },
): string {
    return contextHref(path, {
        patientId: createForm.patientId,
        appointmentId: createForm.appointmentId,
        includeTabNew: options?.includeTabNew,
        extraQuery: options?.extraQuery,
    });
}

function admissionDetailsWorkflowHref(
    path: string,
    admission: Admission | null,
    options?: {
        includeTabNew?: boolean;
        extraQuery?: Record<string, string | null | undefined>;
    },
): string {
    return contextHref(path, {
        patientId: admission?.patientId ?? '',
        appointmentId: admission?.appointmentId ?? '',
        admissionId: admission?.id ?? '',
        includeTabNew: options?.includeTabNew,
        extraQuery: options?.extraQuery,
    });
}

function admissionMedicalRecordCreateHref(
    admission: Admission | null,
    recordType: string,
): string {
    return admissionDetailsWorkflowHref('/medical-records', admission, {
        includeTabNew: true,
        extraQuery: {
            createRecordType: recordType,
            from: 'admissions',
        },
    });
}

function admissionMedicalRecordDetailsHref(
    admission: Admission | null,
    record: MedicalRecordSummary | null,
): string {
    return admissionDetailsWorkflowHref('/medical-records', admission, {
        extraQuery: {
            recordId: record?.id ?? null,
        },
    });
}

function admissionMedicalRecordEditHref(
    admission: Admission | null,
    record: MedicalRecordSummary | null,
): string {
    return admissionDetailsWorkflowHref('/medical-records', admission, {
        includeTabNew: true,
        extraQuery: {
            editRecordId: record?.id ?? null,
            from: 'admissions',
        },
    });
}

function admissionMedicalRecordBrowseHref(
    admission: Admission | null,
    filters?: {
        recordType?: string | null;
        status?: string | null;
    },
): string {
    return admissionDetailsWorkflowHref('/medical-records', admission, {
        extraQuery: {
            tab: 'list',
            recordType: filters?.recordType ?? null,
            status: filters?.status ?? null,
        },
    });
}

function admissionFollowUpWorkflowHref(admission: Admission | null): string {
    const params = new URLSearchParams();
    const patientId = (admission?.patientId ?? '').trim();
    if (patientId) params.set('patientId', patientId);
    const sourceAdmissionId = (admission?.id ?? '').trim();
    if (sourceAdmissionId) params.set('sourceAdmissionId', sourceAdmissionId);
    params.set('tab', 'new');
    params.set('createReason', 'Post-discharge review');

    const clinicianUserId = admission?.attendingClinicianUserId;
    if (typeof clinicianUserId === 'number' && Number.isFinite(clinicianUserId) && clinicianUserId > 0) {
        params.set('createClinicianUserId', String(clinicianUserId));
    }

    const noteParts = [
        admission?.followUpPlan?.trim() ? 'Follow-up plan: ' + admission.followUpPlan.trim() : null,
        admission?.dischargeDestination?.trim() ? 'Discharged to: ' + admission.dischargeDestination.trim() : null,
        admission?.admissionNumber?.trim() ? 'Source admission: ' + admission.admissionNumber.trim() : null,
    ].filter((value) => Boolean(value));

    if (noteParts.length > 0) {
        params.set('createNotes', noteParts.join(' | '));
    }

    return '/appointments?' + params.toString();
}

function isDischargedAdmissionStatus(status: string | null | undefined): boolean {
    return (status ?? '').trim().toLowerCase() === 'discharged';
}

function isTransferredAdmissionStatus(status: string | null | undefined): boolean {
    return (status ?? '').trim().toLowerCase() === 'transferred';
}

function isCancelledAdmissionStatus(status: string | null | undefined): boolean {
    return (status ?? '').trim().toLowerCase() === 'cancelled';
}

function isClosedAdmissionStatus(status: string | null | undefined): boolean {
    return (
        isDischargedAdmissionStatus(status) ||
        isCancelledAdmissionStatus(status)
    );
}

function setCreateAppointmentLink(value: string, source: CreateContextLinkSource) {
    pendingCreateAppointmentLinkSource = source;
    createForm.appointmentId = value;
}

function resetCreateAppointmentSuggestions() {
    createAppointmentSuggestions.value = [];
    createAppointmentSuggestionsLoading.value = false;
    createAppointmentSuggestionsError.value = null;
}

async function hydratePatientSummary(patientId: string) {
    const normalizedId = patientId.trim();
    if (!normalizedId) return;
    if (patientDirectory.value[normalizedId] || pendingPatientLookupIds.has(normalizedId)) {
        return;
    }

    pendingPatientLookupIds.add(normalizedId);

    try {
        const response = await apiRequest<PatientResponse>('GET', `/patients/${normalizedId}`);
        patientDirectory.value = {
            ...patientDirectory.value,
            [normalizedId]: response.data,
        };
    } catch {
        // Non-blocking. Admissions should still work when summary hydration fails.
    } finally {
        pendingPatientLookupIds.delete(normalizedId);
    }
}

async function hydrateVisiblePatients(rows: Admission[]) {
    const ids = [
        ...new Set(
            rows
                .map((row) => row.patientId)
                .filter((id): id is string => Boolean(id)),
        ),
    ];

    await Promise.all(ids.map((id) => hydratePatientSummary(id)));
}

function openCreateContextEditor(tab: CreateContextEditorTab = 'patient') {
    createContextEditorTab.value = tab;
    createContextEditorOpen.value = true;
}

function closeCreateContextEditorAfterSelection(
    kind: 'patientId' | 'appointmentId',
    selected: { id: string } | null,
) {
    if (!createContextEditorOpen.value || !selected) return;

    const nextId = selected.id?.trim?.() ?? '';
    if (!nextId) return;

    if (createContextEditorInitialSelection[kind] === nextId) return;

    createContextEditorOpen.value = false;
}

watch(createContextEditorOpen, (isOpen) => {
    if (!isOpen) return;

    createContextEditorInitialSelection.patientId = createForm.patientId.trim();
    createContextEditorInitialSelection.appointmentId = createForm.appointmentId.trim();
});

function clearCreateAppointmentLink(options?: { suppressAuto?: boolean; focusEditor?: boolean }) {
    const shouldSuppress =
        options?.suppressAuto ?? createAppointmentLinkSource.value === 'auto';
    if (shouldSuppress) {
        createAppointmentAutoLinkDismissed.value = true;
    }

    createAppointmentSummary.value = null;
    createAppointmentSummaryError.value = null;
    createAppointmentSummaryLoading.value = false;
    setCreateAppointmentLink('', 'none');

    if (options?.focusEditor ?? true) {
        openCreateContextEditor('appointment');
    }
}

function selectSuggestedAppointment(
    appointment: AppointmentSummary,
    options?: {
        source?: Extract<CreateContextLinkSource, 'auto' | 'manual'>;
        focusEditor?: boolean;
    },
) {
    if ((options?.source ?? 'manual') === 'auto') {
        createAppointmentAutoLinkDismissed.value = false;
    }

    createAppointmentSummary.value = appointment;
    createAppointmentSummaryError.value = null;
    createAppointmentSummaryLoading.value = false;
    setCreateAppointmentLink(appointment.id, options?.source ?? 'manual');

    if (options?.focusEditor) {
        openCreateContextEditor('appointment');
    }
}

function applySuggestedAppointmentSelection(appointment: AppointmentSummary) {
    selectSuggestedAppointment(appointment, { source: 'manual' });
    createContextEditorOpen.value = false;
}

async function loadCreateAppointmentSummary(appointmentId: string) {
    const normalizedId = appointmentId.trim();
    const requestId = ++createAppointmentSummaryRequestId;

    if (!normalizedId) {
        createAppointmentSummary.value = null;
        createAppointmentSummaryError.value = null;
        createAppointmentSummaryLoading.value = false;
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
            'Unable to load appointment handoff context.',
        );
    } finally {
        if (requestId === createAppointmentSummaryRequestId) {
            createAppointmentSummaryLoading.value = false;
        }
    }
}

async function loadDetailsAppointmentSummary(appointmentId: string) {
    const normalizedId = appointmentId.trim();
    const requestId = ++detailsAppointmentSummaryRequestId;

    if (!normalizedId) {
        detailsAppointmentSummary.value = null;
        detailsAppointmentSummaryError.value = null;
        detailsAppointmentSummaryLoading.value = false;
        return;
    }

    if (!canReadAppointments.value) {
        detailsAppointmentSummary.value = null;
        detailsAppointmentSummaryError.value = 'Appointment context is unavailable for this user.';
        detailsAppointmentSummaryLoading.value = false;
        return;
    }

    if (
        detailsAppointmentSummary.value?.id === normalizedId &&
        !detailsAppointmentSummaryError.value
    ) {
        detailsAppointmentSummaryLoading.value = false;
        return;
    }

    detailsAppointmentSummaryLoading.value = true;
    detailsAppointmentSummaryError.value = null;

    try {
        const response = await apiRequest<AppointmentResponse>('GET', `/appointments/${normalizedId}`);

        if (requestId !== detailsAppointmentSummaryRequestId) return;

        detailsAppointmentSummary.value = response.data;

        const linkedPatientId = response.data.patientId?.trim() ?? '';
        if (linkedPatientId !== '') {
            void hydratePatientSummary(linkedPatientId);
        }
    } catch (error) {
        if (requestId !== detailsAppointmentSummaryRequestId) return;

        detailsAppointmentSummary.value = null;
        detailsAppointmentSummaryError.value = messageFromUnknown(
            error,
            'Unable to load linked appointment context.',
        );
    } finally {
        if (requestId === detailsAppointmentSummaryRequestId) {
            detailsAppointmentSummaryLoading.value = false;
        }
    }
}

async function loadCreateAppointmentSuggestions(patientId: string) {
    const normalizedId = patientId.trim();
    const requestId = ++createAppointmentSuggestionsRequestId;

    if (!normalizedId) {
        resetCreateAppointmentSuggestions();
        return;
    }

    createAppointmentSuggestionsLoading.value = true;
    createAppointmentSuggestionsError.value = null;

    try {
        const response = await apiRequest<LinkedContextListResponse<AppointmentSummary>>(
            'GET',
            '/appointments',
            {
                query: {
                    patientId: normalizedId,
                    status: 'checked_in',
                    perPage: 3,
                    page: 1,
                    sortBy: 'scheduledAt',
                    sortDir: 'desc',
                },
            },
        );

        if (requestId !== createAppointmentSuggestionsRequestId) return;

        createAppointmentSuggestions.value = (response.data ?? []).filter(
            (appointment) =>
                (appointment.patientId?.trim() ?? '') === normalizedId &&
                (appointment.status?.trim().toLowerCase() ?? '') === 'checked_in',
        );
        createAppointmentSuggestionsError.value = null;

        if (
            !createForm.appointmentId.trim() &&
            !createAppointmentAutoLinkDismissed.value &&
            createAppointmentSuggestions.value.length === 1
        ) {
            selectSuggestedAppointment(createAppointmentSuggestions.value[0], {
                source: 'auto',
            });
        }
    } catch (error) {
        if (requestId !== createAppointmentSuggestionsRequestId) return;

        createAppointmentSuggestions.value = [];
        createAppointmentSuggestionsError.value = messageFromUnknown(
            error,
            'Unable to load checked-in appointment suggestions.',
        );
    } finally {
        if (requestId === createAppointmentSuggestionsRequestId) {
            createAppointmentSuggestionsLoading.value = false;
        }
    }
}

function statusVariant(status: string | null) {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'admitted') return 'secondary';
    if (normalized === 'discharged') return 'default';
    if (normalized === 'transferred') return 'outline';
    if (normalized === 'cancelled') return 'destructive';
    return 'outline';
}

function admissionStatusLabel(status: string | null | undefined): string {
    if ((status ?? '').trim().toLowerCase() === 'cancelled') return 'Voided';
    return formatEnumLabel(status);
}

function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function patientName(summary: PatientSummary): string {
    return (
        [summary.firstName, summary.middleName, summary.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        summary.patientNumber ||
        'Selected patient'
    );
}

function admissionPatientSummary(admission: Admission): PatientSummary | null {
    if (!admission.patientId) return null;
    return patientDirectory.value[admission.patientId] ?? null;
}

function admissionPatientLabel(admission: Admission): string {
    const summary = admissionPatientSummary(admission);
    if (!summary) return admission.patientId ? 'Patient selected' : 'Patient not linked';
    return patientName(summary);
}

function admissionPatientMeta(admission: Admission): string {
    const summary = admissionPatientSummary(admission);
    const patientNumber = summary?.patientNumber?.trim();
    if (patientNumber) return `Patient No. ${patientNumber}`;
    return admission.patientId ? 'Patient record linked' : 'Patient not linked';
}

function admissionBedLabel(admission: Admission): string {
    const bed = admission.bed?.trim();
    return bed ? bed : 'Bed pending';
}

function admissionWardLabel(admission: Admission): string {
    const ward = admission.ward?.trim();
    return ward ? ward : 'Ward pending';
}

function formatPlacementLabel(ward: unknown, bed: unknown): string | null {
    const normalizedWard = typeof ward === 'string' ? ward.trim() : '';
    const normalizedBed = typeof bed === 'string' ? bed.trim() : '';
    if (!normalizedWard && !normalizedBed) return null;
    return `${normalizedWard || 'Ward pending'} / ${normalizedBed || 'Bed pending'}`;
}

function admissionHandoffLabel(admission: Admission): string | null {
    return admission.appointmentId ? 'From consultation' : null;
}

function clinicianProfileLabel(userId: number | null | undefined): string | null {
    const normalizedUserId = Number(userId ?? 0);
    if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) return null;

    const profile = clinicianDirectory.value.find((row) => row.userId === normalizedUserId);
    if (!profile) return null;

    const userName = String(profile.userName ?? '').trim();
    const employeeNumber = String(profile.employeeNumber ?? '').trim();
    const jobTitle = String(profile.jobTitle ?? '').trim();
    const label = [userName || employeeNumber || `User ${normalizedUserId}`, jobTitle].filter(Boolean).join(' - ');

    return label || `User ${normalizedUserId}`;
}

function admissionClinicianLabel(admission: Admission | null): string {
    if (!admission?.attendingClinicianUserId) return 'Not recorded';
    return clinicianProfileLabel(admission.attendingClinicianUserId) ?? `User ID ${admission.attendingClinicianUserId}`;
}

function admissionPatientLinkLabel(admission: Admission | null): string {
    if (!admission?.patientId) return 'Patient not linked';
    return admissionPatientMeta(admission);
}

function detailsAuditQuery() {
    return {
        q: detailsAuditFilters.q.trim() || null,
        action: detailsAuditFilters.action.trim() || null,
        actorType: detailsAuditFilters.actorType || null,
        actorId: detailsAuditFilters.actorId.trim() || null,
        from: detailsAuditFilters.from || null,
        to: detailsAuditFilters.to || null,
        page: detailsAuditFilters.page,
        perPage: detailsAuditFilters.perPage,
    };
}

function auditActorLabel(log: AdmissionAuditLog): string {
    return log.actorId === null || log.actorId === undefined
        ? 'System'
        : `User ID ${log.actorId}`;
}

function auditLogChangeKeys(log: AdmissionAuditLog): string[] {
    if (!log.changes || typeof log.changes !== 'object') return [];
    return Object.keys(log.changes).sort((left, right) => left.localeCompare(right));
}

function auditLogMetadataPreview(log: AdmissionAuditLog): Array<{ key: string; value: string }> {
    if (!log.metadata || typeof log.metadata !== 'object') return [];

    return Object.entries(log.metadata)
        .slice(0, 3)
        .map(([key, value]) => ({
            key,
            value: stringifyAuditValue(value),
        }));
}

function auditLogActorTypeLabel(log: AdmissionAuditLog): string {
    return log.actorId === null || log.actorId === undefined ? 'System' : 'User';
}

function auditFieldBeforeValue(log: AdmissionAuditLog, key: string): unknown {
    const field = log.changes?.[key];
    if (!field || typeof field !== 'object') return null;
    return (field as Record<string, unknown>).before ?? null;
}

function auditFieldAfterValue(log: AdmissionAuditLog, key: string): unknown {
    const field = log.changes?.[key];
    if (!field || typeof field !== 'object') return null;
    return (field as Record<string, unknown>).after ?? null;
}

function auditTransitionStatus(log: AdmissionAuditLog, direction: 'from' | 'to'): string | null {
    const transition = log.metadata?.transition;
    if (!transition || typeof transition !== 'object') return null;
    const value = (transition as Record<string, unknown>)[direction];
    return typeof value === 'string' ? value : null;
}

function adtTimelineEventPresentation(kind: AdtTimelineEventKind): {
    title: string;
    icon: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
} {
    if (kind === 'admit') {
        return { title: 'Admitted', icon: 'bed-double', variant: 'secondary' };
    }

    if (kind === 'transfer') {
        return { title: 'Transferred', icon: 'layout-list', variant: 'outline' };
    }

    if (kind === 'discharge') {
        return { title: 'Discharged', icon: 'user-x', variant: 'secondary' };
    }

        return { title: 'Voided', icon: 'circle-x', variant: 'destructive' };
}

function adtTimelineKindOrder(kind: AdtTimelineEventKind): number {
    if (kind === 'admit') return 0;
    if (kind === 'transfer') return 1;
    if (kind === 'discharge') return 2;
    return 3;
}

function parseTimelineTimestamp(value: string | null): number | null {
    if (!value) return null;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
}

function currentStatusToTimelineKind(status: string | null | undefined): AdtTimelineEventKind | null {
    const normalized = status?.trim().toLowerCase() ?? '';
    if (normalized === 'admitted') return 'admit';
    if (normalized === 'transferred') return 'transfer';
    if (normalized === 'discharged') return 'discharge';
    if (normalized === 'cancelled') return 'cancel';
    return null;
}

async function loadDetailsAdtTimeline(admission: Admission) {
    if (!canViewAdmissionAudit.value) {
        detailsAdtTimelineLogs.value = [];
        detailsAdtTimelineLoading.value = false;
        detailsAdtTimelineError.value = null;
        return;
    }

    detailsAdtTimelineLoading.value = true;
    detailsAdtTimelineError.value = null;

    try {
        const response = await apiRequest<AdmissionAuditLogListResponse>(
            'GET',
            `/admissions/${admission.id}/audit-logs`,
            {
                query: {
                    page: 1,
                    perPage: 100,
                },
            },
        );

        detailsAdtTimelineLogs.value = response.data ?? [];
    } catch (error) {
        detailsAdtTimelineLogs.value = [];
        detailsAdtTimelineError.value = messageFromUnknown(
            error,
            'Unable to load ADT timeline history.',
        );
    } finally {
        detailsAdtTimelineLoading.value = false;
    }
}

async function loadDetailsAuditLogs(admissionId: string) {
    if (!canViewAdmissionAudit.value) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditLoading.value = false;
        detailsAuditError.value = null;
        return;
    }

    detailsAuditLoading.value = true;
    detailsAuditError.value = null;
    try {
        const response = await apiRequest<AdmissionAuditLogListResponse>(
            'GET',
            `/admissions/${admissionId}/audit-logs`,
            { query: detailsAuditQuery() },
        );
        detailsAuditLogs.value = response.data ?? [];
        detailsAuditMeta.value = response.meta;
    } catch (error) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load admission audit logs.');
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    if (!detailsSheetAdmission.value) return;
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs(detailsSheetAdmission.value.id);
}

function resetDetailsAuditFilters() {
    if (!detailsSheetAdmission.value) return;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    void loadDetailsAuditLogs(detailsSheetAdmission.value.id);
}

function goToDetailsAuditPage(page: number) {
    if (!detailsSheetAdmission.value) return;
    detailsAuditFilters.page = Math.max(page, 1);
    void loadDetailsAuditLogs(detailsSheetAdmission.value.id);
}

async function exportDetailsAuditLogsCsv() {
    if (!detailsSheetAdmission.value || !canViewAdmissionAudit.value || detailsAuditExporting.value) {
        return;
    }

    detailsAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/admissions/${detailsSheetAdmission.value.id}/audit-logs/export`,
            window.location.origin,
        );
        Object.entries(detailsAuditQuery()).forEach(([key, value]) => {
            if (value === null || value === '') return;
            if (key === 'page' || key === 'perPage') return;
            url.searchParams.set(key, String(value));
        });
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        detailsAuditExporting.value = false;
    }
}

function openAdmissionDetailsSheet(admission: Admission) {
    detailsSheetTab.value = 'overview';
    detailsDischargeReadinessOpen.value = true;
    detailsAuditFiltersOpen.value = false;
    detailsSheetAdmission.value = admission;
    detailsAppointmentSummary.value = null;
    detailsAppointmentSummaryError.value = null;
    detailsAppointmentSummaryLoading.value = false;
    detailsAdtTimelineLogs.value = [];
    detailsAdtTimelineError.value = null;
    detailsAdtTimelineLoading.value = false;
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    if (hasActivePlacementStatus(admission.status)) {
        void loadDischargeReadiness(admission);
    }
    if (admission.appointmentId?.trim() && canReadAppointments.value) {
        void loadDetailsAppointmentSummary(admission.appointmentId);
    } else if (admission.appointmentId?.trim()) {
        detailsAppointmentSummaryError.value = 'Appointment context is unavailable for this user.';
    }
    void loadDetailsAdtTimeline(admission);
    if (canViewAdmissionAudit.value) {
        void loadDetailsAuditLogs(admission.id);
    }
    detailsSheetOpen.value = true;
}

async function openFocusedAdmissionFromQuery(): Promise<void> {
    if (!canReadAdmissions.value || !initialFocusedAdmissionId) return;

    const inList =
        admissions.value.find((admission) => admission.id === initialFocusedAdmissionId)
        ?? activePlacementAdmissions.value.find(
            (admission) => admission.id === initialFocusedAdmissionId,
        )
        ?? null;
    if (inList) {
        openAdmissionDetailsSheet(inList);
        return;
    }

    try {
        const response = await apiRequest<{ data: Admission }>(
            'GET',
            `/admissions/${initialFocusedAdmissionId}`,
        );
        if (response.data) {
            openAdmissionDetailsSheet(response.data);
        }
    } catch {
        // Keep the queue usable even when the deep-linked admission cannot be reopened.
    }
}

function closeAdmissionDetailsSheet() {
    detailsSheetOpen.value = false;
    detailsDischargeReadinessOpen.value = true;
    detailsAuditFiltersOpen.value = false;
    detailsAppointmentSummary.value = null;
    detailsAppointmentSummaryError.value = null;
    detailsAppointmentSummaryLoading.value = false;
    detailsAdtTimelineLogs.value = [];
    detailsAdtTimelineError.value = null;
    detailsAdtTimelineLoading.value = false;
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
}

async function loadScope() {
    try {
        const response = await apiRequest<{ data: ScopeData }>('GET', '/platform/access-scope');
        scope.value = response.data;
    } catch (error) {
        listErrors.value.push(`Scope: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

async function loadAdmissionPermissions() {
    try {
        const response = await apiRequest<AuthPermissionsResponse>('GET', '/auth/me/permissions');
        const names = new Set((response.data ?? []).map((permission) => permission.name?.trim()).filter(Boolean));
        const hasSuperAdminAccess = isFacilitySuperAdmin.value;
        admissionReadPermissionState.value = hasSuperAdminAccess || names.has('admissions.read') ? 'allowed' : 'denied';
        wardBedRegistryPermissionState.value = hasSuperAdminAccess || names.has('platform.resources.read')
            ? 'allowed'
            : 'denied';
        inpatientWardReadPermissionState.value = hasSuperAdminAccess || names.has('inpatient.ward.read')
            ? 'allowed'
            : 'denied';
        wardBedRegistryManagePermissionState.value = hasSuperAdminAccess || names.has('platform.resources.manage-ward-beds')
            ? 'allowed'
            : 'denied';
        canViewAdmissionAudit.value = hasSuperAdminAccess || names.has('admissions.view-audit-logs');
        canCreateAdmissions.value = hasSuperAdminAccess || names.has('admissions.create');
        canUpdateAdmissionStatus.value = hasSuperAdminAccess || names.has('admissions.update-status');
        canReadPatients.value = hasSuperAdminAccess || names.has('patients.read');
        canReadMedicalRecords.value = hasSuperAdminAccess || names.has('medical.records.read');
        canCreateMedicalRecords.value = canReadMedicalRecords.value && (hasSuperAdminAccess || names.has('medical.records.create'));
        canUpdateMedicalRecords.value = canReadMedicalRecords.value && (hasSuperAdminAccess || names.has('medical.records.update'));
        canReadLaboratoryOrders.value = hasSuperAdminAccess || names.has('laboratory.orders.read');
        canReadPharmacyOrders.value = hasSuperAdminAccess || names.has('pharmacy.orders.read');
        canReadBillingInvoices.value = hasSuperAdminAccess || names.has('billing.invoices.read');
        canReadBillingPayerContracts.value = hasSuperAdminAccess || names.has('billing.payer-contracts.read');
        canReadAppointments.value = hasSuperAdminAccess || names.has('appointments.read');
        canReadClinicianDirectory.value = hasSuperAdminAccess || names.has('staff.clinical-directory.read');
        if (!canCreateAdmissions.value && admissionWorkspaceView.value === 'new') {
            setAdmissionWorkspaceView(admissionBrowseView.value);
        }
    } catch {
        const hasSuperAdminAccess = isFacilitySuperAdmin.value;
        admissionReadPermissionState.value = hasSuperAdminAccess ? 'allowed' : 'denied';
        wardBedRegistryPermissionState.value = hasSuperAdminAccess ? 'allowed' : 'denied';
        canViewAdmissionAudit.value = hasSuperAdminAccess;
        canCreateAdmissions.value = hasSuperAdminAccess;
        canUpdateAdmissionStatus.value = hasSuperAdminAccess;
        canReadPatients.value = hasSuperAdminAccess;
        canReadMedicalRecords.value = hasSuperAdminAccess;
        canCreateMedicalRecords.value = hasSuperAdminAccess;
        canUpdateMedicalRecords.value = hasSuperAdminAccess;
        canReadLaboratoryOrders.value = hasSuperAdminAccess;
        canReadPharmacyOrders.value = hasSuperAdminAccess;
        canReadBillingInvoices.value = hasSuperAdminAccess;
        canReadBillingPayerContracts.value = hasSuperAdminAccess;
        canReadAppointments.value = hasSuperAdminAccess;
        canReadClinicianDirectory.value = hasSuperAdminAccess;
        if (!canCreateAdmissions.value && admissionWorkspaceView.value === 'new') {
            setAdmissionWorkspaceView(admissionBrowseView.value);
        }
    }
}

async function loadClinicianDirectory() {
    clinicianDirectoryLoading.value = true;
    clinicianDirectoryError.value = null;
    clinicianDirectoryAccessRestricted.value = false;
    try {
        const response = await apiRequest<ApiListResponse<StaffProfileSummary>>('GET', '/staff/clinical-directory', {
            query: {
                status: 'active',
                clinicalOnly: 'true',
                page: 1,
                perPage: 200,
            },
        });
        clinicianDirectory.value = response.data ?? [];
        canReadClinicianDirectory.value = true;
    } catch (error) {
        clinicianDirectory.value = [];
        if ((error as { status?: number } | null)?.status === 403) {
            clinicianDirectoryAccessRestricted.value = true;
            clinicianDirectoryError.value = null;
            canReadClinicianDirectory.value = false;
        } else {
            clinicianDirectoryError.value = messageFromUnknown(error, 'Unable to load active clinician directory.');
        }
    } finally {
        clinicianDirectoryLoading.value = false;
    }
}

async function loadDischargeDestinationOptions() {
    if (!canReadAdmissions.value) {
        dischargeDestinationOptions.value = [];
        dischargeDestinationOptionsError.value = null;
        dischargeDestinationOptionsLoading.value = false;
        return;
    }

    dischargeDestinationOptionsLoading.value = true;
    dischargeDestinationOptionsError.value = null;
    try {
        const response = await apiRequest<ApiListResponse<SearchableSelectOption>>(
            'GET',
            '/admissions/discharge-destination-options',
        );
        dischargeDestinationOptions.value = response.data ?? [];
    } catch (error) {
        dischargeDestinationOptions.value = [];
        dischargeDestinationOptionsError.value = messageFromUnknown(error, 'Unable to load common discharge destinations.');
    } finally {
        dischargeDestinationOptionsLoading.value = false;
    }
}

async function loadWardBedRegistry() {
    if (!canReadWardBedRegistry.value) {
        wardBedRegistry.value = [];
        wardBedRegistryError.value = null;
        wardBedRegistryLoading.value = false;
        return;
    }

    wardBedRegistryLoading.value = true;
    wardBedRegistryError.value = null;
    try {
        let page = 1;
        let lastPage = 1;
        const items: WardBedResource[] = [];

        do {
            const wardBedRegistryPath = wardBedRegistryPermissionState.value === 'allowed'
                ? '/platform/admin/ward-beds'
                : '/inpatient-ward/ward-beds';
            const response = await apiRequest<WardBedRegistryListResponse>('GET', wardBedRegistryPath, {
                query: {
                    page,
                    perPage: 200,
                    sortBy: 'name',
                    sortDir: 'asc',
                },
            });

            items.push(...(response.data ?? []));
            lastPage = response.meta?.lastPage ?? 1;
            page += 1;
        } while (page <= lastPage);

        wardBedRegistry.value = items
            .filter((resource) => (resource.status ?? '').trim().toLowerCase() !== 'inactive')
            .sort((left, right) => {
                const wardComparison = wardBedResourceWardValue(left).localeCompare(
                    wardBedResourceWardValue(right),
                    undefined,
                    { sensitivity: 'base', numeric: true },
                );
                if (wardComparison !== 0) return wardComparison;

                return wardBedResourceBedValue(left).localeCompare(
                    wardBedResourceBedValue(right),
                    undefined,
                    { sensitivity: 'base', numeric: true },
                );
            });
    } catch (error) {
        wardBedRegistry.value = [];
        wardBedRegistryError.value = messageFromUnknown(error, 'Unable to load ward and bed registry.');
    } finally {
        wardBedRegistryLoading.value = false;
    }
}

async function loadAdmissions() {
    if (!canReadAdmissions.value) {
        admissions.value = [];
        pagination.value = null;
        listLoading.value = false;
        pageLoading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];
    try {
        const response = await apiRequest<AdmissionListResponse>('GET', '/admissions', {
            query: {
                q: searchForm.q.trim() || null,
                status: searchForm.status || null,
                ward: searchForm.ward.trim() || null,
                from: searchForm.from ? `${searchForm.from} 00:00:00` : null,
                to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                page: searchForm.page,
                perPage: searchForm.perPage,
                sortBy: 'admittedAt',
                sortDir: 'desc',
            },
        });
        admissions.value = response.data;
        pagination.value = response.meta;
        void hydrateVisiblePatients(response.data);
        void hydrateVisibleTransferOrigins(response.data);
    } catch (error) {
        admissions.value = [];
        pagination.value = null;
        listErrors.value = [error instanceof Error ? error.message : 'Unable to load admissions.'];
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}

async function loadActivePlacementAdmissionsRegistry() {
    if (!canReadAdmissions.value) {
        activePlacementAdmissionsRegistry.value = [];
        activePlacementAdmissionsRegistryError.value = null;
        activePlacementAdmissionsRegistryLoading.value = false;
        return;
    }

    activePlacementAdmissionsRegistryLoading.value = true;
    activePlacementAdmissionsRegistryError.value = null;

    try {
        const rows: Admission[] = [];

        for (const status of ['admitted', 'transferred'] as const) {
            let page = 1;
            let lastPage = 1;

            do {
                const response = await apiRequest<AdmissionListResponse>('GET', '/admissions', {
                    query: {
                        status,
                        page,
                        perPage: 100,
                        sortBy: 'admittedAt',
                        sortDir: 'desc',
                    },
                });

                rows.push(...(response.data ?? []));
                lastPage = response.meta?.lastPage ?? 1;
                page += 1;
            } while (page <= lastPage);
        }

        const uniqueRows = Array.from(
            new Map(rows.map((admission) => [admission.id, admission])).values(),
        );

        activePlacementAdmissionsRegistry.value = uniqueRows;
        void hydrateVisiblePatients(uniqueRows);
    } catch (error) {
        activePlacementAdmissionsRegistry.value = [];
        activePlacementAdmissionsRegistryError.value = messageFromUnknown(
            error,
            'Unable to load live bed occupancy.',
        );
    } finally {
        activePlacementAdmissionsRegistryLoading.value = false;
    }
}

async function loadAdmissionStatusCounts() {
    if (!canReadAdmissions.value) {
        admissionStatusCounts.value = null;
        return;
    }

    try {
        const response = await apiRequest<AdmissionStatusCountsResponse>('GET', '/admissions/status-counts', {
            query: {
                q: searchForm.q.trim() || null,
                patientId: queryParam('patientId') || null,
                ward: searchForm.ward.trim() || null,
                from: searchForm.from ? `${searchForm.from} 00:00:00` : null,
                to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
            },
        });
        admissionStatusCounts.value = response.data;
    } catch {
        admissionStatusCounts.value = null;
    }
}

async function refreshPage() {
    clearSearchDebounce();
    await Promise.all([loadScope(), loadAdmissionPermissions()]);
    await Promise.all([
        loadAdmissions(),
        loadAdmissionStatusCounts(),
        loadWardBedRegistry(),
        loadClinicianDirectory(),
        loadDischargeDestinationOptions(),
        loadActivePlacementAdmissionsRegistry(),
        loadBillingPayerContracts(),
    ]);
}

async function initialPageLoad() {
    clearSearchDebounce();
    if (
        !scope.value ||
        !isAdmissionReadPermissionResolved.value ||
        !isWardBedRegistryPermissionResolved.value
    ) {
        await refreshPage();
        return;
    }

    await Promise.all([
        loadAdmissions(),
        loadAdmissionStatusCounts(),
        loadWardBedRegistry(),
        loadClinicianDirectory(),
        loadDischargeDestinationOptions(),
        loadActivePlacementAdmissionsRegistry(),
        loadBillingPayerContracts(),
    ]);

    if (initialFocusedAdmissionId) {
        await openFocusedAdmissionFromQuery();
    }
}

async function createAdmission() {
    if (createLoading.value) return;
    if (!canCreateAdmissions.value) {
        notifyError('Request admissions.create permission to admit a patient.');
        return;
    }

    createErrors.value = {};
    createMessage.value = null;

    const locationErrors = createAdmissionLocationErrors();
    if (Object.keys(locationErrors).length > 0) {
        createErrors.value = locationErrors;
        notifyError(createAdmissionLocationBlockedReason.value ?? 'Ward and bed must come from the backend registry.');
        return;
    }

    createLoading.value = true;

    try {
        const clinicianUserId = Number.parseInt(createForm.attendingClinicianUserId.trim(), 10);
        const response = await apiRequest<{ data: Admission }>('POST', '/admissions', {
            body: {
                patientId: createForm.patientId.trim(),
                appointmentId: createForm.appointmentId.trim() || null,
                attendingClinicianUserId: Number.isNaN(clinicianUserId) ? null : clinicianUserId,
                ward: createForm.ward.trim() || null,
                bed: createForm.bed.trim() || null,
                admittedAt: normalizeLocalDateTimeForApi(createForm.admittedAt),
                admissionReason: createForm.admissionReason.trim() || null,
                notes: createForm.notes.trim() || null,
                financialClass: createForm.financialClass || 'self_pay',
                billingPayerContractId: createForm.billingPayerContractId.trim() || null,
                coverageReference: createForm.coverageReference.trim() || null,
                coverageNotes: createForm.coverageNotes.trim() || null,
            },
        });
        createMessage.value = `Created ${response.data.admissionNumber ?? 'admission'} successfully.`;
        notifySuccess(createMessage.value);
        createForm.bed = '';
        createForm.attendingClinicianUserId = createAdmissionAutoClinicianUserId.value.trim();
        createForm.admissionReason = createAdmissionAutoReason.value.trim();
        createForm.notes = '';
        createForm.admittedAt = defaultAdmittedAtLocal();
        void Promise.all([loadAdmissions(), loadAdmissionStatusCounts(), loadActivePlacementAdmissionsRegistry()]);
    } catch (error) {
        const apiError = error as Error & { status?: number; payload?: ValidationErrorResponse };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
        } else {
            notifyError(messageFromUnknown(apiError, 'Unable to create admission.'));
        }
    } finally {
        createLoading.value = false;
    }
}

function openAdmissionStatusDialog(admission: Admission, status: 'discharged' | 'transferred' | 'cancelled') {
    if (!canUpdateAdmissionStatus.value) {
        notifyError('Request admissions.update-status permission to change admission status.');
        return;
    }

    statusDialogAdmission.value = admission;
    statusDialogAction.value = status;
    statusDialogReason.value = admission.statusReason ?? '';
    statusDialogDischargeDestination.value = status === 'discharged' ? admission.dischargeDestination?.trim() ?? '' : '';
    statusDialogFollowUpPlan.value = status === 'discharged' ? admission.followUpPlan?.trim() ?? '' : '';
    statusDialogReceivingWard.value = status === 'transferred' ? admission.ward?.trim() ?? '' : '';
    statusDialogReceivingBed.value = status === 'transferred' ? admission.bed?.trim() ?? '' : '';
    statusDialogError.value = null;
    if (status === 'discharged' && hasActivePlacementStatus(admission.status)) {
        void loadDischargeReadiness(admission);
    }
    statusDialogOpen.value = true;
}

function closeAdmissionStatusDialog() {
    statusDialogOpen.value = false;
    statusDialogError.value = null;
    statusDialogAction.value = null;
    statusDialogAdmission.value = null;
    statusDialogReason.value = '';
    statusDialogDischargeDestination.value = '';
    statusDialogFollowUpPlan.value = '';
    statusDialogReceivingWard.value = '';
    statusDialogReceivingBed.value = '';
}

const statusDialogTitle = computed(() => {
    if (statusDialogAction.value === 'discharged') return 'Discharge patient';
    if (statusDialogAction.value === 'transferred') return 'Transfer ward/bed';
    return 'Void admission record';
});

const statusDialogDescription = computed(() => {
    const label = statusDialogAdmission.value?.admissionNumber ?? 'this admission';
    if (statusDialogAction.value === 'discharged') return `Capture discharge destination, follow-up plan, discharge note, and readiness checks for ${label}.`;
    if (statusDialogAction.value === 'transferred') {
        return `Capture the receiving ward, receiving bed, and transfer handoff note for ${label}.`;
    }
    return `Use this only when ${label} was entered in error and should be removed from active inpatient work.`;
});

const statusDialogReasonLabel = computed(() => {
    if (statusDialogAction.value === 'discharged') return 'Discharge note';
    if (statusDialogAction.value === 'transferred') return 'Transfer note';
    return 'Void note';
});

const statusDialogReasonPlaceholder = computed(() => {
    if (statusDialogAction.value === 'discharged') return 'Required discharge note';
    if (statusDialogAction.value === 'transferred') return 'Required transfer handoff note';
    return 'Required void note';
});

const statusActionButtonLabel = computed(() => {
    if (statusDialogAction.value === 'discharged') return 'Confirm discharge';
    if (statusDialogAction.value === 'transferred') return 'Confirm transfer';
    return 'Confirm void';
});

function admissionDispositionNoteLabel(status: string | null | undefined) {
    if (status === 'discharged') return 'Discharge note';
    if (status === 'transferred') return 'Transfer note';
    if (status === 'cancelled') return 'Void note';
    return 'Status note';
}

function normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized ? normalized : null;
}

function dischargeHandoffSummary(destination: unknown, followUpPlan: unknown): string | null {
    const items: string[] = [];
    const normalizedDestination = normalizeOptionalText(destination);
    const normalizedFollowUpPlan = normalizeOptionalText(followUpPlan);

    if (normalizedDestination) items.push(`Destination: ${normalizedDestination}`);
    if (normalizedFollowUpPlan) items.push(`Follow-up: ${normalizedFollowUpPlan}`);

    return items.length ? items.join(' | ') : null;
}

function admissionNotesSectionTitle(status: string | null | undefined) {
    if (status === 'discharged' || status === 'transferred' || status === 'cancelled') {
        return 'Notes & disposition';
    }

    return 'Notes & status';
}

async function submitAdmissionStatusDialog() {
    if (!statusDialogAdmission.value || !statusDialogAction.value || actionLoadingId.value) return;
    if (!canUpdateAdmissionStatus.value) {
        statusDialogError.value = 'Request admissions.update-status permission to change admission status.';
        return;
    }

    const reason = statusDialogReason.value.trim();
    if (!reason) {
        statusDialogError.value = `${statusDialogReasonLabel.value} is required.`;
        return;
    }

    if (statusDialogAction.value === 'discharged') {
        if (!statusDialogDischargeDestination.value.trim()) {
            statusDialogError.value = 'Discharge destination is required.';
            return;
        }

        if (statusDialogDischargeReadinessEntry.value.loading) {
            statusDialogError.value = 'Discharge readiness is still loading.';
            return;
        }

        if (!statusDialogCanConfirmDischarge.value) {
            statusDialogError.value = statusDialogDischargeBlockReason.value || 'Complete required discharge steps first.';
            return;
        }
    }

    if (statusDialogAction.value === 'transferred' && statusDialogActionBlockedReason.value) {
        statusDialogError.value = statusDialogActionBlockedReason.value;
        return;
    }

    const dischargeDestination =
        statusDialogAction.value === 'discharged' ? statusDialogDischargeDestination.value.trim() || null : null;
    const followUpPlan =
        statusDialogAction.value === 'discharged' ? statusDialogFollowUpPlan.value.trim() || null : null;
    const receivingWard =
        statusDialogAction.value === 'transferred' ? statusDialogReceivingWard.value.trim() || null : null;
    const receivingBed =
        statusDialogAction.value === 'transferred' ? statusDialogReceivingBed.value.trim() || null : null;

    actionLoadingId.value = statusDialogAdmission.value.id;
    actionMessage.value = null;
    listErrors.value = [];
    statusDialogError.value = null;

    try {
        const response = await apiRequest<{ data: Admission }>(
            'PATCH',
            `/admissions/${statusDialogAdmission.value.id}/status`,
            {
                body: {
                    status: statusDialogAction.value,
                    reason,
                    dischargeDestination,
                    followUpPlan,
                    receivingWard,
                    receivingBed,
                },
            },
        );
        actionMessage.value = `${response.data.admissionNumber ?? 'Admission'} marked ${formatEnumLabel(statusDialogAction.value).toLowerCase()}.`;
        if (detailsSheetAdmission.value?.id === response.data.id) {
            detailsSheetAdmission.value = response.data;
            void loadDetailsAdtTimeline(response.data);
        }
        await Promise.all([loadAdmissions(), loadAdmissionStatusCounts(), loadActivePlacementAdmissionsRegistry()]);
        closeAdmissionStatusDialog();
    } catch (error) {
        statusDialogError.value = error instanceof Error ? error.message : 'Unable to update admission status.';
    } finally {
        actionLoadingId.value = null;
    }
}
function submitSearch() {
    clearSearchDebounce();
    searchForm.page = 1;
    void Promise.all([loadAdmissions(), loadAdmissionStatusCounts()]);
}

function resetFilters() {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.status = 'admitted';
    searchForm.ward = '';
    searchForm.from = today;
    searchForm.to = '';
    searchForm.perPage = 10;
    searchForm.page = 1;
    void Promise.all([loadAdmissions(), loadAdmissionStatusCounts()]);
}

const scopeWarning = computed(() => {
    if (pageLoading.value) return null;
    if (!tenantIsolationEnabled.value) return null;
    if (!scope.value) return 'Platform access scope could not be loaded.';
    if (scope.value.resolvedFrom === 'none') return 'No tenant/facility scope is resolved. Admission actions may be blocked.';
    return null;
});

const scopeStatusLabel = computed(() => {
    if (!scope.value) return 'Scope Unavailable';
    return scope.value.resolvedFrom === 'none' ? 'Scope Unresolved' : 'Scope Ready';
});

function matchesAdmissionPreset(options: { status?: string }): boolean {
    if (searchForm.q.trim()) return false;
    if (searchForm.ward.trim()) return false;
    if (searchForm.to) return false;
    if (searchForm.from !== today) return false;
    return (options.status ?? '') === searchForm.status;
}

const admissionQueuePresetState = computed(() => ({
    admitted: matchesAdmissionPreset({ status: 'admitted' }),
    discharged: matchesAdmissionPreset({ status: 'discharged' }),
    transferred: matchesAdmissionPreset({ status: 'transferred' }),
    cancelled: matchesAdmissionPreset({ status: 'cancelled' }),
}));

const activeAdmissionQueuePresetLabel = computed(() => {
    if (admissionQueuePresetState.value.admitted) return 'Admitted here';
    if (admissionQueuePresetState.value.discharged) return 'Discharged';
    if (admissionQueuePresetState.value.transferred) return 'Transferred in';
    if (admissionQueuePresetState.value.cancelled) return 'Voided';
    return null;
});

const activeAdmissionDateFilterBadgeLabel = computed(() => {
    if (!searchForm.to && searchForm.from === today) return null;
    if (activeAdmissionQueuePresetLabel.value) return null;

    const from = searchForm.from.trim();
    const to = searchForm.to.trim();
    if (from && to && from === to) return `Admission Date: ${from}`;
    return 'Admission Date Active';
});

const visibleAdmissionStatusCounts = computed(() => {
    const counts = {
        admitted: 0,
        discharged: 0,
        transferred: 0,
        cancelled: 0,
        other: 0,
    };

    for (const admission of admissions.value) {
        const status = (admission.status ?? '').toLowerCase();
        if (status === 'admitted') {
            counts.admitted += 1;
            continue;
        }
        if (status === 'discharged') {
            counts.discharged += 1;
            continue;
        }
        if (status === 'transferred') {
            counts.transferred += 1;
            continue;
        }
        if (status === 'cancelled') {
            counts.cancelled += 1;
            continue;
        }
        counts.other += 1;
    }

    return counts;
});

const summaryAdmissionStatusCounts = computed<AdmissionStatusCounts>(() => {
    if (admissionStatusCounts.value) return admissionStatusCounts.value;

    const fallbackVisibleTotal =
        visibleAdmissionStatusCounts.value.admitted +
        visibleAdmissionStatusCounts.value.discharged +
        visibleAdmissionStatusCounts.value.transferred +
        visibleAdmissionStatusCounts.value.cancelled +
        visibleAdmissionStatusCounts.value.other;

    const fallbackTotal = Math.max(fallbackVisibleTotal, pagination.value?.total ?? 0);

    return {
        admitted: visibleAdmissionStatusCounts.value.admitted,
        discharged: visibleAdmissionStatusCounts.value.discharged,
        transferred: visibleAdmissionStatusCounts.value.transferred,
        cancelled: visibleAdmissionStatusCounts.value.cancelled,
        other: visibleAdmissionStatusCounts.value.other,
        total: fallbackTotal,
    };
});

const statusSelectValue = computed({
    get: () => searchForm.status || 'all',
    set: (v: string) => {
        searchForm.status = v === 'all' ? '' : v;
        submitSearch();
    },
});

function queueCountLabel(value: number | null | undefined): string {
    if (value === null || value === undefined) return '--';
    return String(value);
}

function isAdmissionSummaryFilterActive(
    statusKey: 'admitted' | 'discharged' | 'transferred' | 'cancelled',
): boolean {
    return searchForm.status === statusKey;
}

function applyAdmissionSummaryFilter(
    statusKey: 'admitted' | 'discharged' | 'transferred' | 'cancelled',
) {
    searchForm.status = statusKey;
    searchForm.page = 1;
    submitSearch();
}

const hasActiveAdmissionFilters = computed(() => {
    if (searchForm.q.trim()) return true;
    if (searchForm.ward.trim()) return true;
    if (searchForm.from !== today) return true;
    if (searchForm.to) return true;
    return false;
});

const hasAdvancedAdmissionFilters = computed(() => {
    if (searchForm.ward.trim()) return true;
    if (searchForm.from !== today) return true;
    if (searchForm.to) return true;
    return false;
});

const activeAdmissionAdvancedFilterCount = computed(() => {
    let count = 0;
    if (searchForm.ward.trim()) count += 1;
    if (searchForm.from !== today) count += 1;
    if (searchForm.to) count += 1;
    return count;
});

const admissionRowDensityLabel = computed(() =>
    compactAdmissionRows.value ? 'Compact' : 'Comfortable',
);

const admissionToolbarStateLabel = computed(() => {
    const parts: string[] = [];

    if (hasActiveAdmissionFilters.value || hasAdvancedAdmissionFilters.value) {
        parts.push('Filtered');
    }

    if (compactAdmissionRows.value) {
        parts.push('Compact');
    }

    return parts.length > 0 ? parts.join(' | ') : null;
});

const createPatientSummary = computed<PatientSummary | null>(() => {
    const id = createForm.patientId.trim();
    if (!id) return null;
    return patientDirectory.value[id] ?? null;
});

const hasCreateAppointmentContext = computed(
    () => createForm.appointmentId.trim() !== '',
);

const createAdmissionFromAppointments = computed(
    () => openedFromAppointments && hasCreateAppointmentContext.value,
);

const createAdmissionTitle = computed(() =>
    hasCreateAppointmentContext.value ? 'Admit patient' : 'Create admission',
);

const createAdmissionDescription = computed(() =>
    hasCreateAppointmentContext.value
        ? 'Confirm the checked-in handoff, then capture ward, bed, and admission reason.'
        : 'Create an inpatient admission and capture the ward placement details.',
);

const createAdmissionHandoffSummary = computed(() => {
    if (createAdmissionFromAppointments.value) {
        return 'Checked-in appointment stays linked to this admission.';
    }

    if (hasCreateAppointmentContext.value) {
        return 'Review the linked appointment before assigning ward and bed.';
    }

    return 'Select the patient, then optionally link the checked-in appointment.';
});

const createPatientContextLabel = computed(() => {
    if (!createPatientSummary.value) {
        return createForm.patientId.trim() ? 'Selected patient' : 'Patient not selected';
    }

    return patientName(createPatientSummary.value);
});

const createPatientContextMeta = computed(() => {
    const patientNumber = createPatientSummary.value?.patientNumber?.trim();
    return patientNumber
        ? `Patient No. ${patientNumber}`
        : createForm.patientId.trim()
          ? 'Patient record linked'
          : 'Select the patient to begin admission.';
});

const createAppointmentContextLabel = computed(() => {
    const appointmentNumber = createAppointmentSummary.value?.appointmentNumber?.trim();
    if (appointmentNumber) return appointmentNumber;
    if (hasCreateAppointmentContext.value) return 'Linked appointment';
    return 'No linked appointment';
});

const createAppointmentContextMeta = computed(() => {
    if (createAppointmentSummaryLoading.value) return 'Loading appointment handoff...';
    if (createAppointmentSummaryError.value) return createAppointmentSummaryError.value;

    if (!createAppointmentSummary.value) {
        return hasCreateAppointmentContext.value
            ? 'Appointment handoff will appear once the link is resolved.'
            : 'Link the checked-in appointment when admission starts from consultation.';
    }

    const parts = [
        createAppointmentSummary.value.scheduledAt
            ? formatDateTime(createAppointmentSummary.value.scheduledAt)
            : null,
        createAppointmentSummary.value.department?.trim() || null,
    ].filter(Boolean);

    return parts.length > 0
        ? parts.join(' | ')
        : 'Appointment handoff ready';
});

const createAppointmentContextReason = computed(() => {
    const value = createAppointmentSummary.value?.reason?.trim();
    return value ? `Reason: ${value}` : null;
});

const createAppointmentContextClinician = computed(() => {
    const label = linkedAppointmentClinicianLabel.value;
    return label ? `Clinician: ${label}` : null;
});

const createAdmissionReasonHelperText = computed(() => {
    const linkedReason = createAppointmentSummary.value?.reason?.trim() ?? '';
    const currentReason = createForm.admissionReason.trim();
    const autoReason = createAdmissionAutoReason.value.trim();

    if (linkedReason && currentReason === autoReason) {
        return 'Auto-filled from the linked appointment reason. Update it only if the inpatient admission needs more specific wording.';
    }

    if (linkedReason) {
        return `Linked appointment reason: ${linkedReason}`;
    }

    if (hasCreateAppointmentContext.value) {
        return 'Capture why this consultation or visit is becoming an inpatient admission.';
    }

    return 'Capture why inpatient admission is needed.';
});

const detailsAppointmentContextLabel = computed(() => {
    const appointmentNumber = detailsAppointmentSummary.value?.appointmentNumber?.trim();
    if (appointmentNumber) return appointmentNumber;
    if (detailsSheetAdmission.value?.appointmentId) return 'Linked appointment';
    return 'No linked appointment';
});

const detailsAppointmentContextMeta = computed(() => {
    if (detailsAppointmentSummaryLoading.value) return 'Loading appointment handoff...';
    if (detailsAppointmentSummaryError.value) return detailsAppointmentSummaryError.value;

    if (!detailsAppointmentSummary.value) {
        if (detailsSheetAdmission.value?.appointmentId && !canReadAppointments.value) {
            return 'Appointment context is unavailable for this user.';
        }

        return detailsSheetAdmission.value?.appointmentId
            ? 'Appointment handoff will appear once the link is resolved.'
            : 'No upstream appointment link is attached.';
    }

    const parts = [
        detailsAppointmentSummary.value.scheduledAt
            ? formatDateTime(detailsAppointmentSummary.value.scheduledAt)
            : null,
        detailsAppointmentSummary.value.department?.trim() || null,
    ].filter(Boolean);

    return parts.length > 0
        ? parts.join(' | ')
        : 'Appointment handoff ready';
});

const detailsAppointmentContextReason = computed(() => {
    const value = detailsAppointmentSummary.value?.reason?.trim();
    return value || null;
});

const detailsAppointmentContextStatusLabel = computed(() => {
    const status = detailsAppointmentSummary.value?.status?.trim();
    if (!status) {
        if (detailsSheetAdmission.value?.appointmentId && !canReadAppointments.value) return 'Restricted';
        return detailsSheetAdmission.value?.appointmentId ? 'Linked' : 'None';
    }

    if (status.toLowerCase() === 'checked_in') return 'Checked In';
    return formatEnumLabel(status);
});
const createAppointmentContextStatusLabel = computed(() => {
    const status = createAppointmentSummary.value?.status?.trim();
    if (!status) {
        return createAdmissionFromAppointments.value
            ? 'Queue handoff'
            : hasCreateAppointmentContext.value
              ? 'Linked'
              : null;
    }

    if (status.toLowerCase() === 'checked_in') return 'Checked In';
    return formatEnumLabel(status);
});

const createAppointmentContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    const normalized = createAppointmentSummary.value?.status?.trim().toLowerCase() ?? '';
    if (!normalized && createAdmissionFromAppointments.value) return 'default';
    if (!normalized && hasCreateAppointmentContext.value) return 'secondary';
    if (normalized === 'checked_in') return 'default';
    if (normalized === 'scheduled') return 'secondary';
    if (normalized === 'cancelled' || normalized === 'no_show') return 'destructive';
    return 'outline';
});

const createAppointmentContextSourceLabel = computed(() => {
    if (!hasCreateAppointmentContext.value) return null;
    if (createAppointmentLinkSource.value === 'auto') return 'Auto-linked';
    if (createAppointmentLinkSource.value === 'route') return 'Route context';
    if (createAppointmentLinkSource.value === 'manual') return 'Chosen';
    return null;
});

const createContextEditorDescription = computed(() => {
    if (createContextEditorTab.value === 'appointment') {
        return 'Link the checked-in appointment that led to this admission, or review the suggested handoff.';
    }

    return 'Search for the patient first. Changing the patient clears any mismatched appointment handoff.';
});

const showAppointmentSuggestionPanel = computed(() => {
    if (!createForm.patientId.trim()) return false;
    if (createAppointmentSuggestionsLoading.value || Boolean(createAppointmentSuggestionsError.value)) {
        return true;
    }

    return !hasCreateAppointmentContext.value && createAppointmentSuggestions.value.length > 0;
});

const detailsAuditHasActiveFilters = computed(() =>
    Boolean(
        detailsAuditFilters.q.trim() ||
            detailsAuditFilters.action.trim() ||
            detailsAuditFilters.actorType ||
            detailsAuditFilters.actorId.trim() ||
            detailsAuditFilters.from ||
            detailsAuditFilters.to ||
            detailsAuditFilters.perPage !== 20,
    ),
);

const detailsAuditSummary = computed(() => {
    const total = detailsAuditMeta.value?.total ?? detailsAuditLogs.value.length;
    let changedEntries = 0;
    let userEntries = 0;

    for (const log of detailsAuditLogs.value) {
        if (auditLogChangeKeys(log).length > 0) changedEntries += 1;
        if (log.actorId !== null && log.actorId !== undefined) userEntries += 1;
    }

    return {
        total,
        changedEntries,
        userEntries,
    };
});

const detailsAdtTimelineEvents = computed<AdtTimelineEvent[]>(() => {
    const admission = detailsSheetAdmission.value;
    if (!admission) return [];

    const events: AdtTimelineEvent[] = [];
    const logsAscending = [...detailsAdtTimelineLogs.value].sort((left, right) => {
        const leftTime = parseTimelineTimestamp(left.createdAt) ?? 0;
        const rightTime = parseTimelineTimestamp(right.createdAt) ?? 0;
        return leftTime - rightTime;
    });

    const createLog = logsAscending.find((log) => log.action === 'admission.created');
    if (createLog) {
        const presentation = adtTimelineEventPresentation('admit');
        events.push({
            key: `adt-${createLog.id}-admit`,
            kind: 'admit',
            title: presentation.title,
            timestamp: admission.admittedAt || createLog.createdAt,
            description: admission.appointmentId
                ? 'Admission started from a consultation handoff.'
                : 'Admission record was created directly.',
            reason: admission.admissionReason?.trim() || null,
            placementSummary: null,
            placementOrigin: null,
            handoffSummary: null,
            icon: presentation.icon,
            variant: presentation.variant,
            source: 'audit',
        });
    }

    for (const log of logsAscending) {
        if (log.action !== 'admission.status.updated') continue;

        const kind = currentStatusToTimelineKind(auditTransitionStatus(log, 'to'));
        if (!kind || kind === 'admit') continue;

        const presentation = adtTimelineEventPresentation(kind);
        const fromStatus = auditTransitionStatus(log, 'from');
        const toStatus = auditTransitionStatus(log, 'to');
        const reasonValue = auditFieldAfterValue(log, 'status_reason');
        const reason =
            typeof reasonValue === 'string' && reasonValue.trim() !== '' ? reasonValue.trim() : null;
        const timestamp =
            kind === 'discharge'
                ? ((auditFieldAfterValue(log, 'discharged_at') as string | null) ?? log.createdAt)
                : log.createdAt;
        const placementBefore = formatPlacementLabel(
            auditFieldBeforeValue(log, 'ward'),
            auditFieldBeforeValue(log, 'bed'),
        );
        const placementAfter = formatPlacementLabel(
            auditFieldAfterValue(log, 'ward'),
            auditFieldAfterValue(log, 'bed'),
        );
        const dischargeDestination = auditFieldAfterValue(log, 'discharge_destination');
        const followUpPlan = auditFieldAfterValue(log, 'follow_up_plan');
        const handoffSummary = kind === 'discharge'
            ? dischargeHandoffSummary(dischargeDestination, followUpPlan)
            : null;
        let description =
            fromStatus && toStatus
                ? `Status moved from ${formatEnumLabel(fromStatus)} to ${formatEnumLabel(toStatus)}.`
                : `Status changed to ${presentation.title}.`;

        if (kind === 'transfer') {
            if (placementBefore && placementAfter && placementBefore !== placementAfter) {
                description = `Transferred from ${placementBefore} to ${placementAfter}.`;
            } else if (placementAfter) {
                description = `Transferred to ${placementAfter}.`;
            }
        }

        if (kind === 'discharge') {
            const normalizedDestination = normalizeOptionalText(dischargeDestination);
            if (normalizedDestination) {
                description = `Discharged to ${normalizedDestination}.`;
            }
        }

        events.push({
            key: `adt-${log.id}-${kind}`,
            kind,
            title: presentation.title,
            timestamp,
            description,
            reason,
            placementSummary: kind === 'transfer' ? placementAfter : null,
            placementOrigin: kind === 'transfer' ? placementBefore : null,
            handoffSummary,
            icon: presentation.icon,
            variant: presentation.variant,
            source: 'audit',
        });
    }

    if (!events.some((event) => event.kind === 'admit')) {
        const presentation = adtTimelineEventPresentation('admit');
        events.push({
            key: `adt-fallback-admit-${admission.id}`,
            kind: 'admit',
            title: presentation.title,
            timestamp: admission.admittedAt || admission.createdAt || null,
            description: 'Admission event inferred from the current record because the create audit entry is unavailable.',
            reason: admission.admissionReason?.trim() || null,
            placementSummary: null,
            placementOrigin: null,
            handoffSummary: null,
            icon: presentation.icon,
            variant: presentation.variant,
            source: 'current-state',
        });
    }

    const currentKind = currentStatusToTimelineKind(admission.status);
    if (
        currentKind &&
        currentKind !== 'admit' &&
        !events.some((event) => event.kind === currentKind)
    ) {
        const presentation = adtTimelineEventPresentation(currentKind);
        const currentPlacement =
            currentKind === 'transfer'
                ? formatPlacementLabel(admission.ward, admission.bed)
                : null;
        const currentHandoffSummary =
            currentKind === 'discharge'
                ? dischargeHandoffSummary(admission.dischargeDestination, admission.followUpPlan)
                : null;

        events.push({
            key: `adt-fallback-${currentKind}-${admission.id}`,
            kind: currentKind,
            title: presentation.title,
            timestamp:
                currentKind === 'discharge'
                    ? admission.dischargedAt || admission.updatedAt || null
                    : admission.updatedAt || null,
            description:
                currentKind === 'transfer' && currentPlacement
                    ? `Current transfer placement is ${currentPlacement}. Matching status transition audit entry is unavailable.`
                    : currentKind === 'discharge' && normalizeOptionalText(admission.dischargeDestination)
                        ? `Current discharge destination is ${normalizeOptionalText(admission.dischargeDestination)}. Matching status transition audit entry is unavailable.`
                        : 'Current admission state is shown because a matching status transition audit entry is unavailable.',
            reason: admission.statusReason?.trim() || null,
            placementSummary: currentPlacement,
            placementOrigin: null,
            handoffSummary: currentHandoffSummary,
            icon: presentation.icon,
            variant: presentation.variant,
            source: 'current-state',
        });
    }

    return events.sort((left, right) => {
        const leftTime = parseTimelineTimestamp(left.timestamp);
        const rightTime = parseTimelineTimestamp(right.timestamp);

        if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
            return leftTime - rightTime;
        }

        if (leftTime !== null && rightTime === null) return -1;
        if (leftTime === null && rightTime !== null) return 1;

        const kindDelta = adtTimelineKindOrder(left.kind) - adtTimelineKindOrder(right.kind);
        if (kindDelta !== 0) return kindDelta;

        return left.key.localeCompare(right.key);
    });
});
const detailsAdtTimelineFallbackCount = computed(
    () =>
        detailsAdtTimelineEvents.value.filter((event) => event.source === 'current-state').length,
);

const detailsAdtTimelineHelperText = computed(() => {
    if (!detailsSheetAdmission.value) return null;
    if (!canViewAdmissionAudit.value) {
        return 'Audit access is unavailable, so the timeline is based on the current admission state.';
    }

    if (detailsAdtTimelineError.value) {
        return 'Audit history could not be loaded. Current-state fallback is shown where possible.';
    }

    if (detailsAdtTimelineFallbackCount.value > 0) {
        return 'Some ADT events are inferred from the current record because matching audit entries are missing.';
    }

    return 'Sequence is derived from the immutable admission audit trail.';
});

const createErrorSummary = computed(() =>
    Object.entries(createErrors.value).flatMap(([field, messages]) =>
        messages.map((message, index) => ({
            key: `${field}-${index}-${message}`,
            message,
        })),
    ),
);

const admissionWorkspaceFilterHelperText = computed(() =>
    admissionWorkspaceView.value === 'board'
        ? 'Use ward and date range to shape the bed board.'
        : 'Use ward, date range, and row density to shape the admissions queue.',
);

type BedBoardCellState = 'occupied' | 'available' | 'pending' | 'maintenance';

type AdmissionOccupancyBedCell = {
    key: string;
    ward: string;
    bedLabel: string;
    state: BedBoardCellState;
    admission: Admission | null;
    patientLabel: string | null;
    patientMeta: string | null;
    admittedAtLabel: string | null;
    handoffLabel: string | null;
    transferOriginLabel: string | null;
    initials: string | null;
    durationLabel: string | null;
    locationLabel: string | null;
};

type AdmissionOccupancyWardGroup = {
    ward: string;
    occupiedCount: number;
    availableCount: number;
    pendingCount: number;
    maintenanceCount: number;
    cells: AdmissionOccupancyBedCell[];
};

const activeAdmittedAdmissions = computed(() =>
    admissions.value.filter(
        (admission) => (admission.status ?? '').trim().toLowerCase() === 'admitted',
    ),
);

const activePlacementAdmissions = computed(() =>
    admissions.value.filter((admission) => hasActivePlacementStatus(admission.status)),
);

const activeWardBedRegistry = computed(() =>
    wardBedRegistry.value.filter(
        (resource) => (resource.status ?? '').trim().toLowerCase() === 'active',
    ),
);

const wardBedRegistryAvailable = computed(() => activeWardBedRegistry.value.length > 0);

const wardRegistryOptions = computed(() =>
    Array.from(
        new Set(
            activeWardBedRegistry.value
                .map((resource) => wardBedResourceWardValue(resource))
                .filter(Boolean),
        ),
    ).sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }),
    ),
);

const occupiedPlacementAdmissionByBedKey = computed(() => {
    const placements = new Map<string, Admission>();

    for (const admission of activePlacementAdmissionsRegistry.value) {
        const key = wardBedPlacementKey(admission.ward, admission.bed);
        if (!key || placements.has(key)) continue;
        placements.set(key, admission);
    }

    return placements;
});

function wardRegistryBedOccupancyLabel(admission: Admission | null): string {
    if (!admission) return 'Currently occupied';

    const parts: string[] = [];
    const admissionNumber = admission.admissionNumber?.trim();
    if (admissionNumber) {
        parts.push(admissionNumber);
    }

    const summary = admissionPatientSummary(admission);
    if (summary) {
        parts.push(patientName(summary));
    }

    return parts.length > 0 ? `Occupied by ${parts.join(' ? ')}` : 'Currently occupied';
}

function wardRegistryBedOptionMeta(resource: WardBedResource, occupiedAdmission: Admission | null): string {
    return [
        occupiedAdmission ? wardRegistryBedOccupancyLabel(occupiedAdmission) : '',
        resource.location?.trim(),
        resource.notes?.trim(),
    ]
        .filter((value): value is string => Boolean(value))
        .join(' | ');
}

function wardRegistryBedOptionsFor(
    wardValue: string | null | undefined,
    options?: { currentAdmissionId?: string | null },
): WardRegistryBedOption[] {
    const selectedWard = normalizeLookupValue(wardValue);
    if (!selectedWard) return [];

    const currentAdmissionId = options?.currentAdmissionId?.trim() ?? '';

    return activeWardBedRegistry.value
        .filter(
            (resource) =>
                normalizeLookupValue(wardBedResourceWardValue(resource)) === selectedWard &&
                Boolean(wardBedResourceBedValue(resource)),
        )
        .map((resource) => {
            const value = wardBedResourceBedValue(resource);
            const occupiedAdmission = occupiedPlacementAdmissionByBedKey.value.get(
                wardBedPlacementKey(wardBedResourceWardValue(resource), value),
            ) ?? null;
            const occupiedByDifferentAdmission = Boolean(
                occupiedAdmission && occupiedAdmission.id !== currentAdmissionId,
            );

            return {
                key:
                    resource.id?.trim() ||
                    `${wardBedResourceWardValue(resource)}:${value}`,
                value,
                label: wardBedResourceBedLabel(resource),
                resource,
                occupiedAdmission,
                isOccupied: occupiedByDifferentAdmission,
                isSelectable: !occupiedByDifferentAdmission,
                occupancyLabel: occupiedByDifferentAdmission
                    ? wardRegistryBedOccupancyLabel(occupiedAdmission)
                    : null,
                meta: wardRegistryBedOptionMeta(
                    resource,
                    occupiedByDifferentAdmission ? occupiedAdmission : null,
                ),
            };
        })
        .sort((left, right) => {
            if (left.isOccupied !== right.isOccupied) {
                return left.isOccupied ? 1 : -1;
            }

            return left.label.localeCompare(right.label, undefined, {
                sensitivity: 'base',
                numeric: true,
            });
        });
}

const wardRegistryBedOptions = computed(() => wardRegistryBedOptionsFor(createForm.ward));

const selectableWardRegistryBedOptions = computed(() =>
    wardRegistryBedOptions.value.filter((option) => option.isSelectable),
);

const statusDialogReceivingBedOptions = computed(() =>
    wardRegistryBedOptionsFor(statusDialogReceivingWard.value, {
        currentAdmissionId:
            statusDialogAction.value === 'transferred'
                ? (statusDialogAdmission.value?.id ?? null)
                : null,
    }),
);

const selectableStatusDialogReceivingBedOptions = computed(() =>
    statusDialogReceivingBedOptions.value.filter((option) => option.isSelectable),
);

const selectedWardBedOption = computed(() => {
    const selectedBed = normalizeLookupValue(createForm.bed);
    if (!selectedBed) return null;

    return (
        wardRegistryBedOptions.value.find(
            (option) => normalizeLookupValue(option.value) === selectedBed,
        ) ?? null
    );
});

const selectedWardBedResource = computed(() => selectedWardBedOption.value?.resource ?? null);

const statusDialogSelectedReceivingBedOption = computed(() => {
    const selectedBed = normalizeLookupValue(statusDialogReceivingBed.value);
    if (!selectedBed) return null;

    return (
        statusDialogReceivingBedOptions.value.find(
            (option) => normalizeLookupValue(option.value) === selectedBed,
        ) ?? null
    );
});

const statusDialogSelectedReceivingBedResource = computed(
    () => statusDialogSelectedReceivingBedOption.value?.resource ?? null,
);

const wardBedRegistryHelperText = computed(() => {
    if (wardBedRegistryLoading.value) {
        return 'Loading ward and bed options from the backend registry.';
    }
    if (!canReadWardBedRegistry.value) {
        return 'Ward/bed registry access is required to create an admission.';
    }
    if (wardBedRegistryError.value) {
        return 'Ward/bed registry could not be loaded. Refresh and try again.';
    }
    if (activePlacementAdmissionsRegistryLoading.value) {
        return 'Ward and bed options are loaded. Checking live occupancy from active admissions...';
    }
    if (activePlacementAdmissionsRegistryError.value) {
        return 'Ward and bed options are loaded. Live occupancy could not be confirmed, so backend validation will still verify availability.';
    }
    if (wardBedRegistryAvailable.value) {
        return 'Ward and bed options are loaded from the backend ward/bed registry. Occupied beds stay marked unavailable.';
    }
    return 'No active ward/bed resources are available in the backend ward/bed registry.';
});

const selectedWardBedResourceMeta = computed(() =>
    selectedWardBedOption.value?.meta ?? '',
);

const statusDialogSelectedReceivingBedResourceMeta = computed(() =>
    statusDialogSelectedReceivingBedOption.value?.meta ?? '',
);
const bedBoardRegistryAvailable = computed(() => wardBedRegistry.value.length > 0);

const bedBoardOccupancyKey = wardBedPlacementKey;

function admissionPatientInitials(admission: Admission): string {
    const summary = admissionPatientSummary(admission);
    const nameParts = [summary?.firstName, summary?.lastName]
        .map((value) => value?.trim() ?? '')
        .filter(Boolean);

    if (nameParts.length > 0) {
        return nameParts
            .slice(0, 2)
            .map((value) => value.charAt(0).toUpperCase())
            .join('');
    }

    const patientNumber = summary?.patientNumber?.trim();
    if (patientNumber) {
        return patientNumber.replace(/[^A-Za-z0-9]/g, '').slice(-2).toUpperCase() || 'PT';
    }

    return 'PT';
}

function admissionStayDurationLabel(admission: Admission): string {
    const admittedAt = parseDateTimeValue(admission.admittedAt);
    if (admittedAt === null) return 'No date';

    const now = Date.now();
    const difference = Math.max(0, now - admittedAt);
    const days = Math.floor(difference / 86_400_000);

    return days === 0 ? 'Today' : `${days}d`;
}

function bedBoardCellVariantClasses(state: BedBoardCellState): string {
    if (state === 'occupied') {
        return 'border-primary/25 bg-primary/[0.04] text-foreground hover:bg-primary/[0.08] dark:border-primary/25 dark:bg-primary/10 dark:hover:bg-primary/15';
    }
    if (state === 'pending') {
        return 'border-amber-200/80 bg-amber-50/70 text-foreground hover:bg-amber-100/75 dark:border-amber-900/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/30';
    }
    if (state === 'maintenance') {
        return 'border-rose-200/80 bg-rose-50/75 text-foreground hover:bg-rose-100/80 dark:border-rose-900/70 dark:bg-rose-950/20 dark:hover:bg-rose-950/30';
    }

    return 'border-emerald-200/80 bg-emerald-50/70 text-foreground hover:bg-emerald-100/75 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30';
}

function bedBoardIconContainerClasses(state: BedBoardCellState): string {
    if (state === 'occupied') return 'border-primary/25 bg-primary/10 dark:border-primary/30 dark:bg-primary/15';
    if (state === 'pending') return 'border-amber-200/80 bg-amber-100/80 dark:border-amber-900/70 dark:bg-amber-950/30';
    if (state === 'maintenance') return 'border-rose-200/80 bg-rose-100/80 dark:border-rose-900/70 dark:bg-rose-950/30';
    return 'border-emerald-200/80 bg-emerald-100/80 dark:border-emerald-900/70 dark:bg-emerald-950/30';
}

function bedBoardIconClasses(state: BedBoardCellState): string {
    if (state === 'occupied') return 'text-primary dark:text-primary';
    if (state === 'pending') return 'text-amber-700 dark:text-amber-200';
    if (state === 'maintenance') return 'text-rose-600 dark:text-rose-200';
    return 'text-emerald-600 dark:text-emerald-200';
}

function bedBoardStateBadgeVariant(state: BedBoardCellState): 'secondary' | 'outline' | 'destructive' | 'default' {
    if (state === 'occupied') return 'outline';
    if (state === 'pending') return 'outline';
    if (state === 'maintenance') return 'outline';
    return 'outline';
}

function bedBoardStateBadgeClasses(state: BedBoardCellState): string {
    if (state === 'occupied') return 'border-primary/25 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15 dark:text-primary-foreground';
    if (state === 'pending') return 'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200';
    if (state === 'maintenance') return 'border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200';
    return 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200';
}

function bedBoardStateLabel(state: BedBoardCellState): string {
    if (state === 'occupied') return 'Occupied';
    if (state === 'pending') return 'Pending';
    if (state === 'maintenance') return 'Maintenance';
    return 'Available';
}

function bedBoardPlacementBadgeLabel(admission: Admission | null | undefined): string | null {
    if (!admission) return null;

    return isTransferredAdmissionStatus(admission.status) ? 'Transferred in' : null;
}

function bedBoardWardSortRank(ward: string): number {
    return normalizeLookupValue(ward) === 'pending placement' ? 1 : 0;
}

const createAdmissionLocationBlockedReason = computed(() => {
    if (wardBedRegistryLoading.value) {
        return 'Ward and bed registry is still loading.';
    }
    if (!canReadWardBedRegistry.value) {
        return 'Ward/bed registry access is required to create an admission.';
    }
    if (wardBedRegistryError.value) {
        return 'Ward/bed registry could not be loaded. Refresh and try again.';
    }
    if (!wardBedRegistryAvailable.value) {
        return 'No active wards are available in the backend ward/bed registry.';
    }
    if (!createForm.ward.trim()) {
        return 'Select a ward from the backend ward/bed registry.';
    }
    if (wardRegistryBedOptions.value.length === 0) {
        return 'Selected ward has no active beds in the backend ward/bed registry.';
    }
    if (selectableWardRegistryBedOptions.value.length === 0) {
        return 'All active beds in the selected ward are currently occupied.';
    }
    if (!createForm.bed.trim()) {
        return 'Select an available bed from the backend ward/bed registry.';
    }
    if (selectedWardBedOption.value && !selectedWardBedOption.value.isSelectable) {
        return 'Selected bed is already occupied. Choose another bed.';
    }

    return null;
});

const createAdmissionActionDisabled = computed(
    () => !canCreateAdmissions.value || createLoading.value || !createForm.patientId.trim() || Boolean(createAdmissionLocationBlockedReason.value),
);

function createAdmissionLocationErrors(): Record<string, string[]> {
    if (wardBedRegistryLoading.value) {
        return { ward: ['Ward and bed registry is still loading.'] };
    }
    if (!canReadWardBedRegistry.value) {
        return { ward: ['Ward/bed registry access is required to create an admission.'] };
    }
    if (wardBedRegistryError.value) {
        return { ward: ['Ward/bed registry could not be loaded. Refresh and try again.'] };
    }
    if (!wardBedRegistryAvailable.value) {
        return { ward: ['No active wards are available in the backend ward/bed registry.'] };
    }
    if (!createForm.ward.trim()) {
        return { ward: ['Select a ward from the backend ward/bed registry.'] };
    }
    if (wardRegistryBedOptions.value.length === 0) {
        return { bed: ['Selected ward has no active beds in the backend ward/bed registry.'] };
    }
    if (selectableWardRegistryBedOptions.value.length === 0) {
        return { bed: ['All active beds in the selected ward are currently occupied.'] };
    }
    if (!createForm.bed.trim()) {
        return { bed: ['Select an available bed from the backend ward/bed registry.'] };
    }
    if (selectedWardBedOption.value && !selectedWardBedOption.value.isSelectable) {
        return { bed: ['Selected bed is already occupied. Choose another bed.'] };
    }

    return {};
}

const occupancyBoardGroups = computed<AdmissionOccupancyWardGroup[]>(() => {
    const groups = new Map<string, AdmissionOccupancyWardGroup>();

    const matchedAdmissionIds = new Set<string>();
    const admissionsByBedKey = new Map<string, Admission>();

    for (const admission of activePlacementAdmissions.value) {
        const occupancyKey = bedBoardOccupancyKey(admission.ward, admission.bed);
        if (!occupancyKey || admissionsByBedKey.has(occupancyKey)) continue;
        admissionsByBedKey.set(occupancyKey, admission);
    }

    for (const resource of wardBedRegistry.value) {
        const ward = wardBedResourceWardValue(resource) || 'Ward pending';
        const bedLabel = wardBedResourceBedValue(resource) || 'Bed pending';
        const occupancyKey = bedBoardOccupancyKey(resource.wardName, wardBedResourceBedValue(resource));
        const admission = occupancyKey ? (admissionsByBedKey.get(occupancyKey) ?? null) : null;

        if (!groups.has(ward)) {
            groups.set(ward, {
                ward,
                occupiedCount: 0,
                availableCount: 0,
                pendingCount: 0,
                maintenanceCount: 0,
                cells: [],
            });
        }

        const group = groups.get(ward)!;
        const isActiveResource = (resource.status ?? '').trim().toLowerCase() === 'active';
        const state: BedBoardCellState = admission ? 'occupied' : isActiveResource ? 'available' : 'maintenance';

        if (admission) matchedAdmissionIds.add(admission.id);
        if (state === 'occupied') group.occupiedCount += 1;
        else if (state === 'available') group.availableCount += 1;
        else if (state === 'maintenance') group.maintenanceCount += 1;

        group.cells.push({
            key: resource.id?.trim() || `registry-${ward}-${bedLabel}`,
            ward,
            bedLabel,
            state,
            admission,
            patientLabel: admission ? admissionPatientLabel(admission) : null,
            patientMeta: admission ? admissionPatientMeta(admission) : null,
            admittedAtLabel: admission ? formatDateTime(admission.admittedAt) : null,
            handoffLabel: admission ? admissionHandoffLabel(admission) : null,
            transferOriginLabel: admission ? admissionTransferOriginLabel(admission) : null,
            initials: admission ? admissionPatientInitials(admission) : null,
            durationLabel: admission ? admissionStayDurationLabel(admission) : null,
            locationLabel: resource.location?.trim() || null,
        });
    }

    for (const admission of activePlacementAdmissions.value) {
        if (matchedAdmissionIds.has(admission.id)) continue;

        const hasWard = Boolean(admission.ward?.trim());
        const ward = hasWard ? admissionWardLabel(admission) : 'Pending placement';

        if (!groups.has(ward)) {
            groups.set(ward, {
                ward,
                occupiedCount: 0,
                availableCount: 0,
                pendingCount: 0,
                maintenanceCount: 0,
                cells: [],
            });
        }

        const group = groups.get(ward)!;
        group.pendingCount += 1;
        group.cells.push({
            key: `pending-${admission.id}`,
            ward,
            bedLabel: admissionBedLabel(admission),
            state: 'pending',
            admission,
            patientLabel: admissionPatientLabel(admission),
            patientMeta: admissionPatientMeta(admission),
            admittedAtLabel: formatDateTime(admission.admittedAt),
            handoffLabel: admissionHandoffLabel(admission),
            transferOriginLabel: admissionTransferOriginLabel(admission),
            initials: admissionPatientInitials(admission),
            durationLabel: admissionStayDurationLabel(admission),
            locationLabel: admission.ward?.trim() || null,
        });
    }

    return Array.from(groups.values())
        .map((group) => ({
            ...group,
            cells: [...group.cells].sort((left, right) => {
                const stateRank =
                    (left.state === 'occupied' || left.state === 'pending' ? 0 : 1) -
                    (right.state === 'occupied' || right.state === 'pending' ? 0 : 1);
                if (stateRank !== 0) return stateRank;

                return left.bedLabel.localeCompare(right.bedLabel, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                });
            }),
        }))
        .sort((left, right) => {
            const rankDelta = bedBoardWardSortRank(left.ward) - bedBoardWardSortRank(right.ward);
            if (rankDelta !== 0) return rankDelta;

            return left.ward.localeCompare(right.ward, undefined, {
                numeric: true,
                sensitivity: 'base',
            });
        });
});

const occupancyBoardSummary = computed(() => ({
    occupiedBeds: occupancyBoardGroups.value.reduce((total, group) => total + group.occupiedCount, 0),
    availableBeds: occupancyBoardGroups.value.reduce((total, group) => total + group.availableCount, 0),
    pendingBeds: occupancyBoardGroups.value.reduce((total, group) => total + group.pendingCount, 0),
    maintenanceBeds: occupancyBoardGroups.value.reduce((total, group) => total + group.maintenanceCount, 0),
    configuredBeds: wardBedRegistry.value.length,
    wardsInView: occupancyBoardGroups.value.length,
    bedPending: activePlacementAdmissions.value.filter(
        (admission) => !admission.bed?.trim(),
    ).length,
    consultationHandoffs: activePlacementAdmissions.value.filter(
        (admission) => Boolean(admission.appointmentId),
    ).length,
}));

function setAdmissionWorkspaceView(view: AdmissionWorkspaceView) {
    if (view === 'new' && !canCreateAdmissions.value) {
        notifyError('Request admissions.create permission to admit a patient.');
        return;
    }

    admissionWorkspaceView.value = view;
    if (view !== 'new') {
        admissionBrowseView.value = view;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.replaceState({}, '', url.toString());
}

function resetFiltersFromMobileDrawer() {
    resetFilters();
    mobileFiltersDrawerOpen.value = false;
}

function submitSearchFromMobileDrawer() {
    submitSearch();
    mobileFiltersDrawerOpen.value = false;
}

function prevPage() {
    if ((pagination.value?.currentPage ?? 1) <= 1) return;
    clearSearchDebounce();
    searchForm.page -= 1;
    void Promise.all([loadAdmissions(), loadAdmissionStatusCounts()]);
}

function nextPage() {
    if (
        !pagination.value ||
        pagination.value.currentPage >= pagination.value.lastPage
    )
        return;
    clearSearchDebounce();
    searchForm.page += 1;
    void Promise.all([loadAdmissions(), loadAdmissionStatusCounts()]);
}


watch(
    () => createForm.patientId,
    (value, previousValue) => {
        const patientId = value.trim();
        const previousPatientId = (previousValue ?? '').trim();
        if (patientId === previousPatientId) return;

        if (!patientId) {
            resetCreateAppointmentSuggestions();
            createAppointmentAutoLinkDismissed.value = false;
            if (createForm.appointmentId.trim()) {
                clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
            }
            createContextEditorTab.value = 'patient';
            return;
        }

        void hydratePatientSummary(patientId);

        if (
            previousPatientId &&
            patientId !== previousPatientId &&
            createForm.appointmentId.trim()
        ) {
            const linkedPatientId = createAppointmentSummary.value?.patientId?.trim() ?? '';
            if (!linkedPatientId || linkedPatientId !== patientId) {
                clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
            }
        }

        createAppointmentAutoLinkDismissed.value = false;
        void loadCreateAppointmentSuggestions(patientId);
    },
    { immediate: true },
);

watch(
    () => createForm.appointmentId,
    (value, previousValue) => {
        const appointmentId = value.trim();
        if (appointmentId === (previousValue ?? '').trim()) return;

        if (!appointmentId) {
            pendingCreateAppointmentLinkSource = null;
            createAppointmentLinkSource.value = 'none';
            void loadCreateAppointmentSummary('');
            return;
        }

        if (pendingCreateAppointmentLinkSource) {
            createAppointmentLinkSource.value = pendingCreateAppointmentLinkSource;
            pendingCreateAppointmentLinkSource = null;
        } else if (
            openedFromAppointments &&
            appointmentId === initialContextAppointmentId &&
            createAppointmentLinkSource.value === 'route'
        ) {
            createAppointmentLinkSource.value = 'route';
        } else {
            createAppointmentLinkSource.value = 'manual';
        }

        void loadCreateAppointmentSummary(appointmentId);
    },
    { immediate: true },
);

watch(
    () => createAppointmentSummary.value?.reason?.trim() ?? '',
    (value) => {
        const linkedReason = value.trim();
        const currentReason = createForm.admissionReason.trim();
        const previousAutoReason = createAdmissionAutoReason.value.trim();
        const shouldReplace = currentReason === '' || (previousAutoReason !== '' && currentReason === previousAutoReason);

        if (linkedReason && shouldReplace) {
            createForm.admissionReason = linkedReason;
        }

        if (!linkedReason && previousAutoReason !== '' && currentReason === previousAutoReason) {
            createForm.admissionReason = '';
        }

        createAdmissionAutoReason.value = linkedReason;
    },
    { immediate: true },
);
watch(
    () => String(createAppointmentSummary.value?.clinicianUserId ?? '').trim(),
    (value) => {
        const linkedClinicianUserId = value.trim();
        const currentClinicianUserId = createForm.attendingClinicianUserId.trim();
        const previousAutoClinicianUserId = createAdmissionAutoClinicianUserId.value.trim();
        const shouldReplace =
            currentClinicianUserId === '' ||
            (previousAutoClinicianUserId !== '' && currentClinicianUserId === previousAutoClinicianUserId);

        if (linkedClinicianUserId && shouldReplace) {
            createForm.attendingClinicianUserId = linkedClinicianUserId;
        }

        if (
            !linkedClinicianUserId &&
            previousAutoClinicianUserId !== '' &&
            currentClinicianUserId === previousAutoClinicianUserId
        ) {
            createForm.attendingClinicianUserId = '';
        }

        createAdmissionAutoClinicianUserId.value = linkedClinicianUserId;
    },
    { immediate: true },
);
watch(
    () => admissionCoverageSignature(createAppointmentSummary.value ?? {}),
    () => {
        const linkedAppointment = createAppointmentSummary.value;
        const previousAutoSignature = createAdmissionAutoCoverageSignature.value;
        const currentSignature = admissionCoverageSignature(createForm);
        const emptySignature = admissionCoverageSignature({ financialClass: 'self_pay' });
        const shouldReplace =
            currentSignature === emptySignature ||
            (previousAutoSignature !== '' && currentSignature === previousAutoSignature);

        if (!linkedAppointment) {
            if (previousAutoSignature !== '' && currentSignature === previousAutoSignature) {
                createForm.financialClass = 'self_pay';
                createForm.billingPayerContractId = '';
                createForm.coverageReference = '';
                createForm.coverageNotes = '';
            }
            createAdmissionAutoCoverageSignature.value = '';
            return;
        }

        const linkedCoverage = {
            financialClass: linkedAppointment.financialClass,
            billingPayerContractId: linkedAppointment.billingPayerContractId,
            coverageReference: linkedAppointment.coverageReference,
            coverageNotes: linkedAppointment.coverageNotes,
        };
        const linkedSignature = admissionCoverageSignature(linkedCoverage);

        if (shouldReplace) {
            createForm.financialClass = normalizeFinancialClass(linkedCoverage.financialClass);
            createForm.billingPayerContractId = linkedCoverage.billingPayerContractId?.trim() ?? '';
            createForm.coverageReference = linkedCoverage.coverageReference?.trim() ?? '';
            createForm.coverageNotes = linkedCoverage.coverageNotes?.trim() ?? '';
        }

        createAdmissionAutoCoverageSignature.value = linkedSignature;
    },
    { immediate: true },
);
watch(
    () => selectedCreateBillingPayerContract.value?.payerType ?? '',
    (payerType) => {
        const normalized = String(payerType ?? '').trim();
        if (!normalized) return;

        createForm.financialClass = normalizeFinancialClass(normalized);
    },
);
watch(canReadBillingPayerContracts, (allowed) => {
    if (!allowed) {
        billingPayerContracts.value = [];
        billingPayerContractsError.value = null;
        billingPayerContractsLoaded.value = false;
        return;
    }

    if (!billingPayerContractsLoaded.value && !billingPayerContractsLoading.value) {
        void loadBillingPayerContracts();
    }
});
watch(
    wardRegistryOptions,
    (options) => {
        if (!canReadWardBedRegistry.value) return;
        if (wardBedRegistryLoading.value) return;

        const currentWard = createForm.ward.trim();
        if (!currentWard) return;

        const hasMatch = options.some(
            (option) => normalizeLookupValue(option) === normalizeLookupValue(currentWard),
        );
        if (!hasMatch) {
            createForm.ward = '';
            createForm.bed = '';
        }
    },
    { immediate: true },
);

watch(
    () => createForm.ward,
    (value, previousValue) => {
        if ((value ?? '').trim() === (previousValue ?? '').trim()) return;
        if (!canReadWardBedRegistry.value) return;
        if (wardBedRegistryLoading.value) return;

        const currentBed = createForm.bed.trim();
        if (!currentBed) return;

        const bedStillExists = wardRegistryBedOptions.value.some(
            (option) =>
                normalizeLookupValue(option.value) === normalizeLookupValue(currentBed) &&
                option.isSelectable,
        );
        if (!bedStillExists) {
            createForm.bed = '';
        }
    },
);

watch(
    wardRegistryBedOptions,
    (options) => {
        if (!canReadWardBedRegistry.value) return;
        if (wardBedRegistryLoading.value) return;

        const currentBed = createForm.bed.trim();
        if (!currentBed) return;

        const hasMatch = options.some(
            (option) =>
                normalizeLookupValue(option.value) === normalizeLookupValue(currentBed) &&
                option.isSelectable,
        );
        if (!hasMatch) {
            createForm.bed = '';
        }
    },
    { immediate: true },
);

watch(
    () => statusDialogReceivingWard.value,
    (value, previousValue) => {
        if (statusDialogAction.value !== 'transferred') return;
        if ((value ?? '').trim() === (previousValue ?? '').trim()) return;
        if (!canReadWardBedRegistry.value) return;
        if (wardBedRegistryLoading.value) return;

        const currentBed = statusDialogReceivingBed.value.trim();
        if (!currentBed) return;

        const bedStillExists = statusDialogReceivingBedOptions.value.some(
            (option) =>
                normalizeLookupValue(option.value) === normalizeLookupValue(currentBed) &&
                option.isSelectable,
        );
        if (!bedStillExists) {
            statusDialogReceivingBed.value = '';
        }
    },
);

watch(
    statusDialogReceivingBedOptions,
    (options) => {
        if (statusDialogAction.value !== 'transferred') return;
        if (!canReadWardBedRegistry.value) return;
        if (wardBedRegistryLoading.value) return;

        const currentBed = statusDialogReceivingBed.value.trim();
        if (!currentBed) return;

        const hasMatch = options.some(
            (option) =>
                normalizeLookupValue(option.value) === normalizeLookupValue(currentBed) &&
                option.isSelectable,
        );
        if (!hasMatch) {
            statusDialogReceivingBed.value = '';
        }
    },
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
            void Promise.all([loadAdmissions(), loadAdmissionStatusCounts()]);
            searchDebounceTimer = null;
        }, 350);
    },
);

onBeforeUnmount(clearSearchDebounce);
onMounted(initialPageLoad);
</script>

<template>
    <Head title="Admissions" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <!-- PAGE HEADER -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="bed-double" class="size-7 text-primary" />
                        Admissions
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Create and manage inpatient admissions.
                    </p>
                    <Link
                        v-if="openedFromAppointments"
                        :href="appointmentsReturnHref"
                        class="mt-1 inline-flex text-xs text-muted-foreground underline underline-offset-2"
                    >
                        {{ tW2('return.backToAppointments') }}
                    </Link>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Popover>
                        <PopoverTrigger as-child>
                            <Button variant="outline" size="sm" class="h-8 px-2.5">
                                <Badge :variant="scopeWarning ? 'destructive' : 'secondary'">
                                    {{ scopeStatusLabel }}
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" class="w-72 space-y-1 text-xs">
                            <p v-if="scope?.tenant">
                                Tenant: {{ scope.tenant.name }} ({{ scope.tenant.code }})
                            </p>
                            <p v-if="scope?.facility">
                                Facility: {{ scope.facility.name }} ({{ scope.facility.code }})
                            </p>
                            <p v-if="!scope" class="text-destructive">
                                Scope could not be loaded.
                            </p>
                        </PopoverContent>
                    </Popover>
                    <Button
                        variant="outline"
                        size="sm"
                        :disabled="listLoading"
                        class="gap-1.5"
                        @click="refreshPage"
                    >
                        <AppIcon name="activity" class="size-3.5" />
                        {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button
                        v-if="canReadAdmissions && admissionWorkspaceView !== 'new'"
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="setAdmissionWorkspaceView(admissionWorkspaceView === 'board' ? 'queue' : 'board')"
                    >
                        <AppIcon
                            :name="admissionWorkspaceView === 'board' ? 'layout-list' : 'bed-double'"
                            class="size-3.5"
                        />
                        {{ admissionWorkspaceView === 'board' ? 'Admission Queue' : 'Bed Board' }}
                    </Button>
                    <Button
                        v-if="canCreateAdmissions"
                        :variant="admissionWorkspaceView === 'new' ? 'outline' : 'default'"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="setAdmissionWorkspaceView(admissionWorkspaceView === 'new' ? admissionBrowseView : 'new')"
                    >
                        <AppIcon
                            :name="admissionWorkspaceView === 'new' ? (admissionBrowseView === 'board' ? 'bed-double' : 'layout-list') : 'plus'"
                            class="size-3.5"
                        />
                        {{
                            admissionWorkspaceView === 'new'
                                ? admissionBrowseView === 'board'
                                    ? 'Bed Board'
                                    : 'Admission Queue'
                                : 'Create Admission'
                        }}
                    </Button>
                </div>
            </div>


            <!-- ALERTS -->
            <Alert v-if="scopeWarning" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="alert-triangle" class="size-4" />
                    Scope warning
                </AlertTitle>
                <AlertDescription>{{ scopeWarning }}</AlertDescription>
            </Alert>
            <Alert v-if="actionMessage">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="check-circle" class="size-4" />
                    Status updated
                </AlertTitle>
                <AlertDescription>{{ actionMessage }}</AlertDescription>
            </Alert>
            <Alert v-if="listErrors.length" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="circle-x" class="size-4" />
                    Request error
                </AlertTitle>
                <AlertDescription>
                    <p v-for="errorMessage in listErrors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p>
                </AlertDescription>
            </Alert>

            <!-- QUEUE BAR -->
            <div v-if="canReadAdmissions && admissionWorkspaceView !== 'new'" class="rounded-lg border bg-muted/30 px-3 py-2">
                <div class="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                        :class="isAdmissionSummaryFilterActive('admitted') ? 'border-primary bg-primary/10' : ''"
                        @click="applyAdmissionSummaryFilter('admitted')"
                    >
                        <span class="font-medium text-foreground">{{ queueCountLabel(summaryAdmissionStatusCounts.admitted) }}</span>
                        <span class="text-muted-foreground">Admitted here</span>
                    </button>
                    <button
                        type="button"
                        class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                        :class="isAdmissionSummaryFilterActive('discharged') ? 'border-primary bg-primary/10' : ''"
                        @click="applyAdmissionSummaryFilter('discharged')"
                    >
                        <span class="font-medium text-foreground">{{ queueCountLabel(summaryAdmissionStatusCounts.discharged) }}</span>
                        <span class="text-muted-foreground">Discharged</span>
                    </button>
                    <button
                        type="button"
                        class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                        :class="isAdmissionSummaryFilterActive('transferred') ? 'border-primary bg-primary/10' : ''"
                        @click="applyAdmissionSummaryFilter('transferred')"
                    >
                        <span class="font-medium text-foreground">{{ queueCountLabel(summaryAdmissionStatusCounts.transferred) }}</span>
                        <span class="text-muted-foreground">Transferred in</span>
                    </button>
                    <button
                        type="button"
                        class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                        :class="isAdmissionSummaryFilterActive('cancelled') ? 'border-primary bg-primary/10' : ''"
                        @click="applyAdmissionSummaryFilter('cancelled')"
                    >
                        <span class="font-medium text-foreground">{{ queueCountLabel(summaryAdmissionStatusCounts.cancelled) }}</span>
                        <span class="text-muted-foreground">Voided</span>
                    </button>
                </div>
            </div>
            <div v-else-if="!isAdmissionReadPermissionResolved" class="rounded-lg border bg-muted/20 px-4 py-3">
                <p class="text-xs text-muted-foreground">Loading access context...</p>
            </div>

            <Card v-if="canReadAdmissions && admissionWorkspaceView === 'board'" class="rounded-lg border-sidebar-border/70">
                <CardHeader class="gap-3">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div class="space-y-1">
                            <CardTitle class="flex items-center gap-2">
                                <AppIcon name="bed-double" class="size-5 text-muted-foreground" />
                                Bed board
                            </CardTitle>
                            <CardDescription>
                                Backend ward and bed registry overlaid with current admitted patients. Consultation handoffs stay marked on occupied or pending-placement cells.
                            </CardDescription>
                        </div>
                        <Badge variant="outline">
                            {{ occupancyBoardSummary.occupiedBeds }} / {{ occupancyBoardSummary.configuredBeds }} occupied
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent class="space-y-4">
                    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div class="rounded-lg border bg-muted/20 p-3">
                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Occupied beds
                            </p>
                            <p class="mt-2 text-2xl font-semibold">
                                {{ occupancyBoardSummary.occupiedBeds }}
                            </p>
                        </div>
                        <div class="rounded-lg border bg-muted/20 p-3">
                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Available beds
                            </p>
                            <p class="mt-2 text-2xl font-semibold">
                                {{ occupancyBoardSummary.availableBeds }}
                            </p>
                        </div>
                        <div class="rounded-lg border bg-muted/20 p-3">
                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Pending placement
                            </p>
                            <p class="mt-2 text-2xl font-semibold">
                                {{ occupancyBoardSummary.pendingBeds }}
                            </p>
                        </div>
                        <div class="rounded-lg border bg-muted/20 p-3">
                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Maintenance
                            </p>
                            <p class="mt-2 text-2xl font-semibold">
                                {{ occupancyBoardSummary.maintenanceBeds }}
                            </p>
                        </div>
                        <div class="rounded-lg border bg-muted/20 p-3">
                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Wards in view
                            </p>
                            <p class="mt-2 text-2xl font-semibold">
                                {{ occupancyBoardSummary.wardsInView }}
                            </p>
                        </div>
                    </div>

                    <div class="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground dark:bg-muted/10">
                        {{ occupancyBoardClosureHelperText }}
                    </div>

                    <div
                        v-if="pageLoading || listLoading || wardBedRegistryLoading"
                        class="grid gap-3 xl:grid-cols-3"
                    >
                        <Skeleton class="h-32 w-full" />
                        <Skeleton class="h-32 w-full" />
                        <Skeleton class="h-32 w-full" />
                    </div>
                    <div
                        v-else-if="wardBedRegistryError"
                        class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                    >
                        Ward-bed registry could not be loaded, so the board cannot be rendered right now.
                    </div>
                    <div
                        v-else-if="!canReadWardBedRegistry"
                        class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                    >
                        Ward/bed registry visibility is not available for this user, so the board cannot be rendered here.
                    </div>
                    <div
                        v-else-if="!bedBoardRegistryAvailable"
                        class="rounded-lg border border-dashed p-6"
                    >
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p class="text-sm font-medium text-foreground">Ward/bed registry is not ready yet.</p>
                                <p class="mt-1 text-sm text-muted-foreground">
                                    {{ canManageWardBedRegistry
                                        ? 'Add at least one active ward/bed to enable the admissions board.'
                                        : 'The admissions board becomes available once ward/bed setup is completed for this facility.' }}
                                </p>
                            </div>
                            <Button v-if="canManageWardBedRegistry" size="sm" variant="outline" as-child class="gap-1.5">
                                <Link href="/platform/admin/ward-beds"><AppIcon name="bed-double" class="size-3.5" />Open Ward/Beds</Link>
                            </Button>
                        </div>
                    </div>
                    <div
                        v-else-if="occupancyBoardGroups.length === 0"
                        class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                    >
                        No current admissions are visible in this view. All configured beds are available.
                    </div>
                    <div
                        v-else
                        class="grid gap-3 xl:grid-cols-3"
                    >
                        <div
                            v-for="group in occupancyBoardGroups"
                            :key="`admission-occupancy-${group.ward}`"
                            class="rounded-lg border p-3"
                        >
                            <div class="flex items-center justify-between gap-2 border-b pb-3">
                                <div>
                                    <p class="text-sm font-medium">{{ group.ward }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ group.occupiedCount }} occupied | {{ group.availableCount }} available | {{ group.pendingCount }} pending
                                    </p>
                                </div>
                                <Badge variant="secondary">
                                    {{ group.cells.length }}
                                </Badge>
                            </div>
                            <div class="mt-3 grid gap-2 sm:grid-cols-2">
                                <div
                                    v-for="slot in group.cells"
                                    :key="slot.key"
                                    :class="[
                                        'min-h-[4.75rem] rounded-md border px-2.5 py-2 text-left transition-colors',
                                        bedBoardCellVariantClasses(slot.state),
                                        slot.admission ? 'cursor-pointer' : 'cursor-default',
                                    ]"
                                    :role="slot.admission ? 'button' : undefined"
                                    :tabindex="slot.admission ? 0 : undefined"
                                    @click="slot.admission ? openAdmissionDetailsSheet(slot.admission) : undefined"
                                    @keydown.enter.prevent="slot.admission ? openAdmissionDetailsSheet(slot.admission) : undefined"
                                    @keydown.space.prevent="slot.admission ? openAdmissionDetailsSheet(slot.admission) : undefined"
                                >
                                    <div class="flex items-start justify-between gap-2">
                                        <div class="flex min-w-0 items-start gap-2.5">
                                            <div :class="['mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border', bedBoardIconContainerClasses(slot.state)]">
                                                <AppIcon name="bed-double" :class="['size-3.5', bedBoardIconClasses(slot.state)]" />
                                            </div>
                                            <div class="min-w-0 space-y-1">
                                                <div class="flex min-w-0 items-center gap-2">
                                                    <p class="truncate text-sm font-medium">{{ slot.bedLabel }}</p>
                                                    <Badge
                                                        v-if="slot.state === 'occupied' || slot.state === 'pending'"
                                                        variant="outline"
                                                        class="h-5 shrink-0 px-1.5 text-[10px] font-medium"
                                                    >
                                                        {{ slot.durationLabel }}
                                                    </Badge>
                                                </div>
                                                <p
                                                    v-if="slot.state === 'occupied' || slot.state === 'pending'"
                                                    class="truncate text-sm font-medium text-foreground"
                                                >
                                                    {{ slot.patientLabel }}
                                                </p>
                                                <p
                                                    v-else-if="slot.state === 'maintenance'"
                                                    class="text-[11px] text-muted-foreground"
                                                >
                                                    Not assignable.
                                                </p>
                                            </div>
                                        </div>
                                        <Badge :variant="bedBoardStateBadgeVariant(slot.state)" :class="bedBoardStateBadgeClasses(slot.state)">
                                            {{ bedBoardStateLabel(slot.state) }}
                                        </Badge>
                                    </div>
                                    <div
                                        v-if="slot.state === 'occupied' || slot.state === 'pending'"
                                        class="mt-1.5 flex items-center justify-between gap-2"
                                    >
                                        <div class="flex min-w-0 items-center gap-1.5 overflow-hidden">
                                            <Badge v-if="slot.handoffLabel" variant="outline" class="h-5 px-1.5 text-[10px]">
                                                {{ slot.handoffLabel }}
                                            </Badge>
                                            <Badge v-if="bedBoardPlacementBadgeLabel(slot.admission)" variant="outline" class="h-5 px-1.5 text-[10px]">
                                                {{ bedBoardPlacementBadgeLabel(slot.admission) }}
                                            </Badge>
                                        </div>
                                        <Popover v-if="slot.admission">
                                            <PopoverTrigger as-child>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    class="h-6 shrink-0 px-1.5 text-[10px] text-muted-foreground"
                                                    @click.stop
                                                >
                                                    More
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent align="end" class="w-72 space-y-2 p-3 text-xs" @click.stop>
                                                <div class="space-y-1">
                                                    <p class="text-sm font-medium text-foreground">{{ slot.patientLabel }}</p>
                                                    <p v-if="slot.patientMeta" class="text-muted-foreground">{{ slot.patientMeta }}</p>
                                                </div>
                                                <div class="grid gap-2 sm:grid-cols-2">
                                                    <div>
                                                        <p class="font-medium text-muted-foreground">Admission</p>
                                                        <p class="mt-0.5 text-foreground">{{ slot.admission.admissionNumber || 'Admission' }}</p>
                                                    </div>
                                                    <div>
                                                        <p class="font-medium text-muted-foreground">Admitted</p>
                                                        <p class="mt-0.5 text-foreground">{{ slot.admittedAtLabel }}</p>
                                                    </div>
                                                    <div v-if="slot.handoffLabel">
                                                        <p class="font-medium text-muted-foreground">Handoff</p>
                                                        <p class="mt-0.5 text-foreground">{{ slot.handoffLabel }}</p>
                                                    </div>
                                                    <div v-if="bedBoardPlacementBadgeLabel(slot.admission)">
                                                        <p class="font-medium text-muted-foreground">Placement</p>
                                                        <p class="mt-0.5 text-foreground">
                                                            {{
                                                                slot.transferOriginLabel
                                                                    ? `${bedBoardPlacementBadgeLabel(slot.admission)} from ${slot.transferOriginLabel}`
                                                                    : bedBoardPlacementBadgeLabel(slot.admission)
                                                            }}
                                                        </p>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- SINGLE COLUMN: Admission Queue card -->
            <div class="flex min-w-0 flex-col gap-4">
                <Card v-if="canReadAdmissions && admissionWorkspaceView === 'queue'" class="border-sidebar-border/70 flex min-h-0 flex-1 flex-col rounded-lg">
                    <CardHeader class="shrink-0 gap-3 pb-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div class="min-w-0 flex flex-wrap items-center gap-1.5">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                                    Admission Queue
                                </CardTitle>
                                <CardDescription>
                                    {{ pagination?.total ?? 0 }} admissions{{
                                        searchForm.from || searchForm.to ? ' in selected date range' : ''
                                    }}
                                </CardDescription>
                            </div>

                            <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-2xl">
                                <div class="relative min-w-0 flex-1">
                                    <AppIcon
                                        name="search"
                                        class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="admissions-q"
                                        v-model="searchForm.q"
                                        placeholder="Admission number, reason, notes..."
                                        class="h-9 pl-9"
                                        @keyup.enter="submitSearch"
                                    />
                                </div>

                                <Select v-model="statusSelectValue">
                                    <SelectTrigger
                                        class="h-9 w-full bg-background sm:w-40"
                                        aria-label="Filter admissions by status"
                                    >
                                        <SelectValue placeholder="All statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        <SelectItem value="admitted">Admitted</SelectItem>
                                        <SelectItem value="discharged">Discharged</SelectItem>
                                        <SelectItem value="transferred">Transferred</SelectItem>
                                        <SelectItem value="cancelled">Voided</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Popover>
                                    <PopoverTrigger as-child>
                                        <Button variant="outline" size="sm" class="hidden gap-1.5 md:inline-flex">
                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                            All filters
                                            <Badge v-if="activeAdmissionAdvancedFilterCount" variant="secondary" class="ml-1 text-[10px]">
                                                {{ activeAdmissionAdvancedFilterCount }}
                                            </Badge>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="end"
                                        class="flex max-h-[32rem] w-[20rem] flex-col overflow-hidden rounded-md border bg-popover p-0 shadow-md"
                                    >
                                        <div class="flex flex-1 flex-col gap-0 overflow-y-auto">
                                            <div class="shrink-0 space-y-1 border-b px-4 py-3">
                                                <p class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                                    All filters
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    Narrow the queue beyond the main toolbar.
                                                </p>
                                            </div>
                                            <div class="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
                                                <div class="grid gap-2">
                                                    <Label for="admissions-ward-popover">Ward</Label>
                                                    <Input id="admissions-ward-popover" v-model="searchForm.ward" placeholder="General Ward" />
                                                </div>
                                                <DateRangeFilterPopover
                                                    input-base-id="admission-date-range-popover"
                                                    title="Admission date range"
                                                    helper-text="From / to for the admissions queue."
                                                    from-label="From"
                                                    to-label="To"
                                                    inline
                                                    :number-of-months="1"
                                                    v-model:from="searchForm.from"
                                                    v-model:to="searchForm.to"
                                                />
                                            </div>
                                            <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    class="gap-1.5"
                                                    :disabled="listLoading && !hasActiveAdmissionFilters"
                                                    @click="resetFilters"
                                                >
                                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                    Reset
                                                </Button>
                                                <Button size="sm" class="gap-1.5" :disabled="listLoading" @click="submitSearch">
                                                    <AppIcon name="eye" class="size-3.5" />
                                                    Apply filters
                                                </Button>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="w-full gap-1.5 md:hidden"
                                    @click="mobileFiltersDrawerOpen = true"
                                >
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    All filters
                                    <Badge v-if="activeAdmissionAdvancedFilterCount" variant="secondary" class="ml-1 text-[10px]">
                                        {{ activeAdmissionAdvancedFilterCount }}
                                    </Badge>
                                </Button>
                                <Popover>
                                    <PopoverTrigger as-child>
                                        <Button variant="outline" size="sm" class="gap-1.5">
                                            <AppIcon name="eye" class="size-3.5" />
                                            View
                                            <Badge variant="secondary" class="ml-1 text-[10px]">
                                                {{ admissionRowDensityLabel }}
                                            </Badge>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" class="w-72 space-y-4">
                                        <div class="space-y-1">
                                            <p class="text-sm font-medium">Queue view</p>
                                            <p class="text-xs text-muted-foreground">
                                                Choose how much admission detail to keep visible in each row.
                                            </p>
                                        </div>
                                        <div class="space-y-2">
                                            <Label class="text-xs font-medium text-muted-foreground">Row density</Label>
                                            <div class="grid grid-cols-2 gap-2">
                                                <Button
                                                    size="sm"
                                                    :variant="compactAdmissionRows ? 'outline' : 'default'"
                                                    @click="compactAdmissionRows = false"
                                                >
                                                    Comfortable
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    :variant="compactAdmissionRows ? 'default' : 'outline'"
                                                    @click="compactAdmissionRows = true"
                                                >
                                                    Compact
                                                </Button>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent
                        class="flex min-h-0 flex-1 flex-col overflow-hidden px-0 pb-0 pt-0"
                        :class="compactAdmissionRows ? 'space-y-2' : 'space-y-3'"
                    >
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem] px-4 pb-4" :class="compactAdmissionRows ? 'space-y-2' : 'space-y-3'">
                                <div v-if="pageLoading || listLoading" class="space-y-2">
                                    <Skeleton class="h-16 w-full" />
                                    <Skeleton class="h-16 w-full" />
                                </div>
                                <div v-else-if="admissions.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                                    No admissions match the current filters.
                                </div>
                                <div v-else :class="compactAdmissionRows ? 'space-y-2' : 'space-y-3'">
                                    <div
                                        v-for="admission in admissions"
                                        :key="admission.id"
                                        class="rounded-lg border p-3"
                                    >
                                        <div class="flex flex-wrap items-start justify-between gap-2">
                                            <div class="space-y-1">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <p class="text-sm font-semibold">
                                                        {{ admission.admissionNumber || 'Admission' }}
                                                    </p>
                                                    <Badge
                                                        v-if="admissionHandoffLabel(admission)"
                                                        variant="outline"
                                                    >
                                                        {{ admissionHandoffLabel(admission) }}
                                                    </Badge>
                                                </div>
                                                <p class="text-sm text-foreground">
                                                    {{ admissionPatientLabel(admission) }}
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ admissionPatientMeta(admission) }} | {{ admissionWardLabel(admission) }} | {{ admissionBedLabel(admission) }}
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    Admitted: {{ formatDateTime(admission.admittedAt) }} | Discharged: {{ formatDateTime(admission.dischargedAt) }}
                                                </p>
                                            </div>
                                            <div class="flex flex-wrap items-center gap-2">
                                                <Badge :variant="statusVariant(admission.status)">{{ admissionStatusLabel(admission.status) }}</Badge>
                                                <Button size="sm" variant="outline" class="gap-1.5" @click="openAdmissionDetailsSheet(admission)"><AppIcon name="eye" class="size-3.5" />Open admission</Button>
                                                <Button v-if="hasActivePlacementStatus(admission.status) && canUpdateAdmissionStatus" size="sm" variant="outline" class="gap-1.5" :disabled="actionLoadingId === admission.id" @click="openAdmissionStatusDialog(admission, 'transferred')"><AppIcon name="layout-list" class="size-3.5" />{{ actionLoadingId === admission.id ? 'Updating...' : 'Transfer ward/bed' }}</Button>
                                                <Button v-if="hasActivePlacementStatus(admission.status) && canUpdateAdmissionStatus" size="sm" class="gap-1.5" :disabled="actionLoadingId === admission.id" @click="openAdmissionStatusDialog(admission, 'discharged')"><AppIcon name="user-x" class="size-3.5" />{{ actionLoadingId === admission.id ? 'Updating...' : 'Discharge patient' }}</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                            <template v-if="pagination">
                                <p class="text-xs text-muted-foreground">
                                    <template v-if="pagination.total !== undefined">
                                        Showing {{ admissions.length }} of {{ pagination.total }} &middot;
                                        Page {{ pagination.currentPage }} of {{ pagination.lastPage }}
                                    </template>
                                    <template v-else>No pagination data</template>
                                </p>
                                <div class="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="listLoading || (pagination.currentPage ?? 1) <= 1"
                                        @click="prevPage"
                                    >
                                        <AppIcon name="chevron-left" class="size-3.5" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="listLoading || (pagination.currentPage ?? 1) >= (pagination.lastPage ?? 1)"
                                        @click="nextPage"
                                    >
                                        Next
                                        <AppIcon name="chevron-right" class="size-3.5" />
                                    </Button>
                                </div>
                            </template>
                            <p v-else class="text-xs text-muted-foreground">No pagination data</p>
                        </footer>
                    </CardContent>
                </Card>

                <Card v-else-if="!canReadAdmissions && isAdmissionReadPermissionResolved" class="rounded-lg border-sidebar-border/70">
                    <CardHeader><CardTitle class="flex items-center gap-2"><AppIcon name="shield-check" class="size-4 text-muted-foreground" />Admissions List</CardTitle></CardHeader>
                    <CardContent><Alert variant="destructive"><AlertTitle class="flex items-center gap-2"><AppIcon name="shield-check" class="size-4" />Admissions read access restricted</AlertTitle><AlertDescription>Request <code>admissions.read</code> permission to view admissions.</AlertDescription></Alert></CardContent>
                </Card>
                <Card v-else-if="!canReadAdmissions" class="rounded-lg border-sidebar-border/70">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2"><AppIcon name="activity" class="size-4 text-muted-foreground" />Admissions List</CardTitle>
                        <CardDescription>Loading access context...</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-3">
                        <Skeleton class="h-4 w-1/3" />
                        <Skeleton class="h-4 w-2/3" />
                        <Skeleton class="h-16 w-full" />
                    </CardContent>
                </Card>

                <Card v-if="admissionWorkspaceView === 'new' && canCreateAdmissions" class="rounded-lg border-sidebar-border/70">
                    <CardHeader class="gap-3 pb-3">
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="plus" class="size-5 text-muted-foreground" />
                            {{ createAdmissionTitle }}
                        </CardTitle>
                        <CardDescription>
                            {{ createAdmissionDescription }}
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-6">
                        <Alert v-if="createMessage"><AlertTitle class="flex items-center gap-2"><AppIcon name="check-circle" class="size-4" />Admission created</AlertTitle><AlertDescription>{{ createMessage }}</AlertDescription></Alert>
                        <Alert v-if="createErrorSummary.length" variant="destructive">
                            <AlertTitle class="flex items-center gap-2">
                                <AppIcon name="circle-x" class="size-4" />
                                Admission entry needs attention
                            </AlertTitle>
                            <AlertDescription>
                                <ul class="space-y-1 text-xs">
                                    <li
                                        v-for="errorItem in createErrorSummary"
                                        :key="errorItem.key"
                                    >
                                        {{ errorItem.message }}
                                    </li>
                                </ul>
                            </AlertDescription>
                        </Alert>
                        <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                            <div class="flex flex-col gap-3">
                                <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                    <div class="min-w-0 space-y-1">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge :variant="createAdmissionFromAppointments ? 'default' : hasCreateAppointmentContext ? 'secondary' : 'outline'">
                                                {{
                                                    createAdmissionFromAppointments
                                                        ? 'Consultation handoff'
                                                        : hasCreateAppointmentContext
                                                          ? 'Linked appointment'
                                                          : 'Direct admission'
                                                }}
                                            </Badge>
                                            <Badge
                                                v-if="createAppointmentContextStatusLabel"
                                                :variant="createAppointmentContextStatusVariant"
                                            >
                                                {{ createAppointmentContextStatusLabel }}
                                            </Badge>
                                            <Badge
                                                v-if="createAppointmentContextSourceLabel"
                                                variant="outline"
                                            >
                                                {{ createAppointmentContextSourceLabel }}
                                            </Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">
                                            {{ createAdmissionHandoffSummary }}
                                        </p>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            class="gap-1.5"
                                            @click="openCreateContextEditor(hasCreateAppointmentContext ? 'appointment' : 'patient')"
                                        >
                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                            {{ createForm.patientId ? 'Change context' : 'Set context' }}
                                        </Button>
                                    </div>
                                </div>

                                <div class="grid gap-2 lg:grid-cols-2">
                                    <div
                                        class="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2"
                                        :class="createForm.patientId ? 'border-primary/30 bg-primary/5' : 'bg-background/80'"
                                    >
                                        <AppIcon
                                            name="user"
                                            class="size-3.5 shrink-0 text-muted-foreground"
                                        />
                                        <div class="min-w-0 flex-1">
                                            <div class="flex min-w-0 items-center gap-2">
                                                <span
                                                    class="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                                                >
                                                    Patient
                                                </span>
                                                <span
                                                    class="truncate text-sm font-medium"
                                                    :title="createPatientContextMeta"
                                                >
                                                    {{ createPatientContextLabel }}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        class="flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2"
                                        :class="hasCreateAppointmentContext ? 'border-primary/30 bg-primary/5' : 'bg-background/80'"
                                    >
                                        <AppIcon
                                            name="calendar-clock"
                                            class="size-3.5 shrink-0 text-muted-foreground"
                                        />
                                        <div class="min-w-0 flex-1">
                                            <div class="flex min-w-0 items-center gap-2">
                                                <span
                                                    class="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                                                >
                                                    Appointment
                                                </span>
                                                <span
                                                    class="truncate text-sm font-medium"
                                                    :title="[createAppointmentContextLabel, createAppointmentContextMeta, createAppointmentContextClinician, createAppointmentContextReason].filter(Boolean).join(' | ')"
                                                >
                                                    {{ createAppointmentContextLabel }}
                                                </span>
                                            </div>
                                        </div>
                                        <div class="flex shrink-0 flex-wrap items-center gap-1.5">
                                            <Badge
                                                v-if="createAppointmentContextStatusLabel"
                                                :variant="createAppointmentContextStatusVariant"
                                                class="text-[10px]"
                                            >
                                                {{ createAppointmentContextStatusLabel }}
                                            </Badge>
                                            <Badge
                                                v-if="createAppointmentContextSourceLabel"
                                                variant="outline"
                                                class="text-[10px]"
                                            >
                                                {{ createAppointmentContextSourceLabel }}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div v-if="createForm.patientId" class="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" as-child class="gap-1.5">
                                        <Link :href="createWorkflowHref('/medical-records', { includeTabNew: true })">
                                            <AppIcon name="file-text" class="size-3.5" />
                                            Continue in Medical Records
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <Dialog v-model:open="createContextEditorOpen">
                            <DialogContent size="3xl" class="overflow-visible rounded-lg">
                                <DialogHeader>
                                    <DialogTitle class="flex items-center gap-2">
                                        <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                                        Review or change context
                                    </DialogTitle>
                                    <DialogDescription>
                                        {{ createContextEditorDescription }}
                                    </DialogDescription>
                                </DialogHeader>
                                <div class="space-y-4 pr-1">
                                    <Tabs v-model="createContextEditorTab" class="w-full">
                                        <TabsList class="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-2">
                                            <TabsTrigger
                                                value="patient"
                                                class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"
                                            >
                                                <AppIcon name="user" class="size-3.5" />
                                                Patient
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="appointment"
                                                :disabled="!createForm.patientId.trim()"
                                                class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"
                                            >
                                                <AppIcon name="calendar-clock" class="size-3.5" />
                                                Appointment
                                            </TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="patient" class="mt-3 rounded-lg border bg-muted/20 p-4">
                                            <div class="grid gap-3">
                                                <PatientLookupField
                                                    input-id="admission-create-patient-id"
                                                    v-model="createForm.patientId"
                                                    @selected="closeCreateContextEditorAfterSelection('patientId', $event)"
                                                    label="Patient"
                                                    placeholder="Search patient by name, patient number, phone, email, or national ID"
                                                    helper-text="Select the patient being admitted. Changing the patient clears any mismatched appointment handoff."
                                                    :error-message="createFieldError('patientId')"
                                                    patient-status="active"
                                                />
                                            </div>
                                        </TabsContent>
                                        <TabsContent value="appointment" class="mt-3 rounded-lg border bg-muted/20 p-4">
                                            <div class="grid gap-3">
                                                <LinkedContextLookupField
                                                    input-id="admission-create-appointment-id"
                                                    v-model="createForm.appointmentId"
                                                    @selected="closeCreateContextEditorAfterSelection('appointmentId', $event)"
                                                    :patient-id="createForm.patientId"
                                                    label="Appointment Link"
                                                    resource="appointments"
                                                    placeholder="Search linked checked-in appointment"
                                                    helper-text="Optional. Link the checked-in appointment that led to this admission."
                                                    :error-message="createFieldError('appointmentId')"
                                                    status="checked_in"
                                                />
                                                <div
                                                    v-if="showAppointmentSuggestionPanel"
                                                    class="rounded-lg border border-dashed bg-background px-3 py-2.5"
                                                >
                                                    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                        <div class="min-w-0 space-y-1">
                                                            <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                                Checked-in handoff
                                                            </p>
                                                            <p
                                                                v-if="createAppointmentSuggestionsError"
                                                                class="text-xs text-destructive"
                                                            >
                                                                {{ createAppointmentSuggestionsError }}
                                                            </p>
                                                            <p
                                                                v-else-if="createAppointmentSuggestionsLoading"
                                                                class="text-sm text-muted-foreground"
                                                            >
                                                                Checking active checked-in appointments...
                                                            </p>
                                                            <template
                                                                v-else-if="!hasCreateAppointmentContext && createAppointmentSuggestions.length === 1"
                                                            >
                                                                <p class="text-sm font-medium">
                                                                    {{ createAppointmentSuggestions[0].appointmentNumber || 'Checked-in appointment' }}
                                                                </p>
                                                                <p class="text-xs text-muted-foreground">
                                                                    {{
                                                                        [
                                                                            createAppointmentSuggestions[0].scheduledAt
                                                                                ? formatDateTime(createAppointmentSuggestions[0].scheduledAt)
                                                                                : null,
                                                                            createAppointmentSuggestions[0].department || null,
                                                                        ]
                                                                            .filter(Boolean)
                                                                            .join(' | ')
                                                                    }}
                                                                </p>
                                                            </template>
                                                            <p
                                                                v-else-if="!hasCreateAppointmentContext && createAppointmentSuggestions.length > 1"
                                                                class="text-sm text-muted-foreground"
                                                            >
                                                                {{ createAppointmentSuggestions.length }} checked-in appointments found for this patient. Use the search field above to choose the correct handoff.
                                                            </p>
                                                        </div>
                                                        <Button
                                                            v-if="!createAppointmentSuggestionsLoading && !createAppointmentSuggestionsError && !hasCreateAppointmentContext && createAppointmentSuggestions.length === 1"
                                                            size="sm"
                                                            class="gap-1.5 sm:self-start"
                                                            @click="applySuggestedAppointmentSelection(createAppointmentSuggestions[0])"
                                                        >
                                                            Use suggestion
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div
                                                    v-if="hasCreateAppointmentContext"
                                                    class="flex flex-wrap gap-2"
                                                >
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        class="gap-1.5"
                                                        @click="clearCreateAppointmentLink({ focusEditor: false })"
                                                    >
                                                        <AppIcon name="circle-x" class="size-3.5" />
                                                        Remove appointment link
                                                    </Button>
                                                    <Button
                                                        v-if="!openedFromAppointments && canReadAppointments"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="appointmentReturnHref()">
                                                            <AppIcon name="calendar-clock" class="size-3.5" />
                                                            Open in Appointments
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <div class="space-y-3 rounded-lg border bg-muted/20 p-3">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Admission payment coverage</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ createCoverageSummary }}
                                    </p>
                                </div>
                                <Badge variant="outline" class="w-fit">
                                    Visit-level
                                </Badge>
                            </div>

                            <div class="grid gap-3 md:grid-cols-2">
                                <SearchableSelectField
                                    input-id="admission-create-financial-class"
                                    v-model="createForm.financialClass"
                                    label="Financial class"
                                    :options="FINANCIAL_CLASS_OPTIONS"
                                    placeholder="Select payment coverage"
                                    search-placeholder="Search self-pay, insurance, employer..."
                                    helper-text="Set once for this inpatient stay. Billing will inherit it when an invoice is created."
                                    :error-message="createFieldError('financialClass')"
                                    :disabled="createLoading"
                                />

                                <SearchableSelectField
                                    v-if="canReadBillingPayerContracts"
                                    input-id="admission-create-payer-contract"
                                    v-model="createForm.billingPayerContractId"
                                    label="Payer contract"
                                    :options="createBillingPayerContractOptions"
                                    placeholder="Leave blank for self-pay"
                                    search-placeholder="Search payer, plan, or contract code"
                                    :helper-text="billingPayerContractsLoading ? 'Loading active payer contracts...' : 'Optional. Select when this stay is covered by an active payer contract.'"
                                    :error-message="createFieldError('billingPayerContractId')"
                                    :disabled="billingPayerContractsLoading || createLoading"
                                    empty-text="No active payer contract matched that search."
                                />
                                <Alert v-else class="py-2">
                                    <AlertTitle>Payer contract access unavailable</AlertTitle>
                                    <AlertDescription>
                                        Financial class can still be captured here; Billing can link the exact contract later.
                                    </AlertDescription>
                                </Alert>
                            </div>

                            <Alert v-if="canReadBillingPayerContracts && billingPayerContractsError" variant="destructive" class="py-2">
                                <AlertTitle>Payer contracts unavailable</AlertTitle>
                                <AlertDescription>{{ billingPayerContractsError }}</AlertDescription>
                            </Alert>

                            <div class="grid gap-3 md:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="admission-create-coverage-reference">Member / authorization reference</Label>
                                    <Input
                                        id="admission-create-coverage-reference"
                                        v-model="createForm.coverageReference"
                                        placeholder="Policy, member, or authorization number"
                                    />
                                    <p v-if="createFieldError('coverageReference')" class="text-xs text-destructive">{{ createFieldError('coverageReference') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="admission-create-coverage-notes">Coverage notes</Label>
                                    <Textarea
                                        id="admission-create-coverage-notes"
                                        v-model="createForm.coverageNotes"
                                        class="min-h-20 resize-y"
                                        placeholder="Eligibility notes, card details, or payer instructions."
                                    />
                                    <p v-if="createFieldError('coverageNotes')" class="text-xs text-destructive">{{ createFieldError('coverageNotes') }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Location & time -->
                        <div class="space-y-3">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Location & time</p>
                                <Badge :variant="createAdmissionLocationBlockedReason ? 'destructive' : 'secondary'" class="text-[11px]">
                                    Backend registry
                                </Badge>
                            </div>
                            <div class="grid gap-3 md:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="admission-create-ward">Ward</Label>
                                    <Select
                                        v-model="createForm.ward"
                                        :disabled="wardBedRegistryLoading || !canReadWardBedRegistry || !!wardBedRegistryError || !wardBedRegistryAvailable"
                                    >
                                        <SelectTrigger
                                            id="admission-create-ward"
                                            :class="[
                                                'w-full',
                                                createFieldError('ward')
                                                    ? 'border-destructive focus-visible:ring-destructive/20'
                                                    : '',
                                            ]"
                                        >
                                            <SelectValue placeholder="Select ward" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                v-for="ward in wardRegistryOptions"
                                                :key="`admission-create-ward-${ward}`"
                                                :value="ward"
                                            >
                                                {{ ward }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p class="text-xs text-muted-foreground">{{ wardBedRegistryHelperText }}</p>
                                    <p v-if="createFieldError('ward')" class="text-xs text-destructive">{{ createFieldError('ward') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="admission-create-bed">Bed</Label>
                                    <Select
                                        v-model="createForm.bed"
                                        :disabled="
                                            wardBedRegistryLoading ||
                                            !canReadWardBedRegistry ||
                                            !!wardBedRegistryError ||
                                            !wardBedRegistryAvailable ||
                                            !createForm.ward.trim() ||
                                            wardRegistryBedOptions.length === 0
                                        "
                                    >
                                        <SelectTrigger
                                            id="admission-create-bed"
                                            :class="[
                                                'w-full',
                                                createFieldError('bed')
                                                    ? 'border-destructive focus-visible:ring-destructive/20'
                                                    : '',
                                            ]"
                                        >
                                            <SelectValue :placeholder="createForm.ward.trim() ? 'Select bed' : 'Select ward first'" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                v-for="option in wardRegistryBedOptions"
                                                :key="`admission-create-bed-${option.key}`"
                                                :value="option.value"
                                                :disabled="!option.isSelectable"
                                            >
                                                <span class="flex w-full items-center justify-between gap-2">
                                                    <span class="truncate">{{ option.label }}</span>
                                                    <span
                                                        v-if="option.isOccupied"
                                                        class="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200"
                                                    >
                                                        Occupied
                                                    </span>
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p
                                        v-if="!canReadWardBedRegistry"
                                        class="text-xs text-muted-foreground"
                                    >
                                        Registry permission is required before a bed can be assigned.
                                    </p>
                                    <p
                                        v-else-if="wardBedRegistryError"
                                        class="text-xs text-muted-foreground"
                                    >
                                        Refresh the page after ward/bed registry access is restored.
                                    </p>
                                    <p
                                        v-else-if="!createForm.ward.trim()"
                                        class="text-xs text-muted-foreground"
                                    >
                                        Choose a ward first to load matching backend bed options.
                                    </p>
                                    <p
                                        v-else-if="selectedWardBedResourceMeta"
                                        class="text-xs text-muted-foreground"
                                    >
                                        {{ selectedWardBedResourceMeta }}
                                    </p>
                                    <p
                                        v-else-if="!wardBedRegistryLoading && createForm.ward.trim() && wardRegistryBedOptions.length === 0"
                                        class="text-xs text-muted-foreground"
                                    >
                                        No active beds are configured for the selected ward.
                                    </p>
                                    <p
                                        v-else-if="!wardBedRegistryLoading && createForm.ward.trim() && selectableWardRegistryBedOptions.length === 0"
                                        class="text-xs text-muted-foreground"
                                    >
                                        All active beds in the selected ward are currently occupied.
                                    </p>
                                    <p v-if="createFieldError('bed')" class="text-xs text-destructive">{{ createFieldError('bed') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="admission-create-admitted-at">Admitted at</Label>
                                    <Input id="admission-create-admitted-at" v-model="createForm.admittedAt" type="datetime-local" />
                                    <p v-if="createFieldError('admittedAt')" class="text-xs text-destructive">{{ createFieldError('admittedAt') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <SearchableSelectField
                                        input-id="admission-create-clinician-user-id"
                                        v-model="createForm.attendingClinicianUserId"
                                        label="Attending clinician"
                                        :options="admissionClinicianOptions"
                                        placeholder="Select clinician"
                                        search-placeholder="Search by name, employee number, role, department, or user ID"
                                        :helper-text="admissionClinicianHelperText"
                                        :error-message="createFieldError('attendingClinicianUserId')"
                                        empty-text="No active clinicians are available right now."
                                        :disabled="clinicianDirectoryLoading || createLoading || clinicianDirectoryAccessRestricted"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Reason & notes -->
                        <div class="space-y-3">
                            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Details</p>
                            <div class="grid gap-3 md:grid-cols-2 md:items-start">
                                <div class="grid gap-2">
                                    <Label for="admission-create-reason">Admission reason</Label>
                                    <Textarea id="admission-create-reason" v-model="createForm.admissionReason" class="min-h-20 resize-y" placeholder="Reason for inpatient admission" />
                                    <p class="text-xs text-muted-foreground">{{ createAdmissionReasonHelperText }}</p>
                                    <p v-if="createFieldError('admissionReason')" class="text-xs text-destructive">{{ createFieldError('admissionReason') }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="admission-create-notes">Notes</Label>
                                    <Textarea id="admission-create-notes" v-model="createForm.notes" class="min-h-20 resize-y" placeholder="Optional notes" />
                                    <p v-if="createFieldError('notes')" class="text-xs text-destructive">{{ createFieldError('notes') }}</p>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div class="flex flex-wrap items-center justify-end gap-2">
                            <Button
                                v-if="createMessage || createErrorSummary.length"
                                variant="outline"
                                class="gap-1.5"
                                :disabled="createLoading"
                                @click="createMessage = null; createErrors = {}"
                            >
                                <AppIcon name="circle-x" class="size-3.5" />
                                Dismiss alerts
                            </Button>
                            <Button class="gap-1.5" :disabled="createAdmissionActionDisabled" @click="createAdmission">
                                <AppIcon name="plus" class="size-3.5" />
                                {{ createLoading ? 'Saving...' : 'Admit patient' }}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

            <!-- Related workflows -->
            <div v-if="canReadAdmissions && (canReadPatients || canReadAppointments || canReadMedicalRecords)" class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-2.5">
                <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <AppIcon name="activity" class="size-3.5" />
                    Related workflows
                </span>
                <Button v-if="canReadPatients" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link href="/patients">
                        <AppIcon name="users" class="size-3.5" />
                        Patients
                    </Link>
                </Button>
                <Button v-if="canReadAppointments" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link href="/appointments">
                        <AppIcon name="calendar-clock" class="size-3.5" />
                        Appointments
                    </Link>
                </Button>
                <Button v-if="canReadMedicalRecords" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link href="/medical-records">
                        <AppIcon name="file-text" class="size-3.5" />
                        Medical Records
                    </Link>
                </Button>
            </div>
            </div>

            <!-- Mobile filters drawer -->
            <Drawer
                :open="mobileFiltersDrawerOpen"
                @update:open="mobileFiltersDrawerOpen = $event"
            >
                <DrawerContent class="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            All filters
                        </DrawerTitle>
                        <DrawerDescription>
                            Narrow the queue beyond the main toolbar.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
                        <div class="grid gap-2">
                            <Label for="admissions-ward-drawer">Ward</Label>
                            <Input id="admissions-ward-drawer" v-model="searchForm.ward" placeholder="General Ward" />
                        </div>
                        <DateRangeFilterPopover
                            input-base-id="admission-date-range-drawer"
                            title="Admission date range"
                            from-label="From"
                            to-label="To"
                            inline
                            :number-of-months="1"
                            v-model:from="searchForm.from"
                            v-model:to="searchForm.to"
                        />
                    </div>
                    <DrawerFooter class="gap-2">
                        <Button :disabled="listLoading" class="gap-1.5" @click="submitSearchFromMobileDrawer">
                            <AppIcon name="eye" class="size-3.5" />
                            Apply filters
                        </Button>
                        <Button variant="outline" class="gap-1.5" @click="resetFiltersFromMobileDrawer">
                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                            Reset
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            <Sheet
                :open="detailsSheetOpen"
                @update:open="(open) => (open ? (detailsSheetOpen = true) : closeAdmissionDetailsSheet())"
            >
                <SheetContent
                    side="right"
                    variant="workspace"
                    size="3xl"
                >
                    <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2 text-lg">
                            <AppIcon name="bed-double" class="size-5 text-primary" />
                            Admission Details
                        </SheetTitle>
                        <SheetDescription class="sr-only">
                            Review admission context, continue care workflows, and inspect the audit trail.
                        </SheetDescription>
                    </SheetHeader>

                    <ScrollArea v-if="detailsSheetAdmission" class="min-h-0 flex-1">
                        <div class="space-y-3 p-3">
                            <div class="sticky top-0 z-10 rounded-md border bg-background/95 p-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                <div class="flex items-start gap-3">
                                    <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                        {{ detailsSheetAdmission.admissionNumber?.slice(-2) ?? '--' }}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex flex-wrap items-start justify-between gap-2">
                                            <div class="min-w-0 flex flex-wrap items-center gap-1.5">
                                                <p class="text-base font-semibold leading-tight">
                                                    {{ detailsSheetAdmission.admissionNumber || 'Admission' }}
                                                </p>
                                                <p class="text-sm text-muted-foreground">
                                                    {{ admissionPatientLabel(detailsSheetAdmission) }}
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ formatDateTime(detailsSheetAdmission.admittedAt) }}
                                                    <span class="ml-1">
                                                        | {{ admissionWardLabel(detailsSheetAdmission) }} / {{ admissionBedLabel(detailsSheetAdmission) }}
                                                    </span>
                                                </p>
                                            </div>
                                            <Badge :variant="statusVariant(detailsSheetAdmission.status)" class="shrink-0">
                                                        {{ admissionStatusLabel(detailsSheetAdmission.status) }}
                                            </Badge>
                                        </div>
                                        <div
                                            v-if="detailsClosureSummary"
                                            class="mt-2 rounded-md bg-muted/35 px-2.5 py-2 dark:bg-muted/15"
                                        >
                                            <div class="flex flex-wrap items-start justify-between gap-2">
                                                <div class="min-w-0 space-y-0.5">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="text-sm font-medium text-foreground">
                                                            {{ detailsClosureSummary.title }}
                                                        </p>
                                                        <Badge variant="secondary" class="text-[10px]">
                                                            {{ detailsClosureSummary.badgeLabel }}
                                                        </Badge>
                                                    </div>
                                                    <p class="text-[11px] text-muted-foreground">
                                                        {{ detailsClosureSummary.timestampLabel }}
                                                    </p>
                                                </div>
                                            </div>
                                            <div class="mt-2 grid gap-1.5 md:grid-cols-3">
                                                <div class="rounded-md bg-background/60 px-2.5 py-1.5 dark:bg-background/30">
                                                    <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{{ detailsClosureSummary.impactLabel }}</p>
                                                    <p class="mt-1 text-sm text-foreground">{{ detailsClosureSummary.impactValue }}</p>
                                                </div>
                                                <div class="rounded-md bg-background/60 px-2.5 py-1.5 dark:bg-background/30">
                                                    <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{{ detailsClosureSummary.contextLabel }}</p>
                                                    <p class="mt-1 text-sm text-foreground">{{ detailsClosureSummary.contextValue }}</p>
                                                </div>
                                                <div class="rounded-md bg-background/60 px-2.5 py-1.5 dark:bg-background/30">
                                                    <p class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{{ detailsClosureSummary.noteLabel }}</p>
                                                    <p class="mt-1 text-sm text-foreground">{{ detailsClosureSummary.noteValue }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Tabs v-model="detailsSheetTab" class="w-full">
                                <TabsList class="grid w-full grid-cols-3">
                                    <TabsTrigger value="overview" class="inline-flex items-center gap-1.5 text-xs sm:text-sm">
                                        <AppIcon name="layout-grid" class="size-3.5" />
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger value="workflows" class="inline-flex items-center gap-1.5 text-xs sm:text-sm">
                                        <AppIcon name="activity" class="size-3.5" />
                                        Workflows
                                    </TabsTrigger>
                                    <TabsTrigger value="audit" class="inline-flex items-center gap-1.5 text-xs sm:text-sm">
                                        <AppIcon name="file-text" class="size-3.5" />
                                        Audit
                                        <Badge
                                            v-if="detailsAuditMeta || detailsAuditLogs.length"
                                            variant="secondary"
                                            class="h-4 min-w-4 px-1 text-[10px]"
                                        >
                                            {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>
                                <TabsContent value="overview" class="mt-3 space-y-3">
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="bed-double" class="size-4 text-muted-foreground" />
                                                    Admission
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="space-y-2 px-4 pt-0 text-sm">
                                                <div class="flex justify-between gap-4">
                                                    <span class="text-muted-foreground">Status</span>
                                                    <span class="font-medium">{{ admissionStatusLabel(detailsSheetAdmission.status) }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4">
                                                    <span class="text-muted-foreground">Admitted here</span>
                                                    <span class="font-medium">{{ formatDateTime(detailsSheetAdmission.admittedAt) }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4">
                                                    <span class="text-muted-foreground">Visit handoff</span>
                                                    <span class="font-medium">
                                                        {{ admissionHandoffLabel(detailsSheetAdmission) || 'Direct admission' }}
                                                    </span>
                                                </div>
                                                <div class="flex justify-between gap-4">
                                                    <span class="text-muted-foreground">Attending clinician</span>
                                                    <span class="font-medium text-right">
                                                        {{ admissionClinicianLabel(detailsSheetAdmission) }}
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="user" class="size-4 text-muted-foreground" />
                                                    Patient & placement
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="space-y-2 px-4 pt-0 text-sm">
                                                <div class="flex justify-between gap-4">
                                                    <span class="text-muted-foreground">Patient</span>
                                                    <span class="font-medium text-right">{{ admissionPatientLabel(detailsSheetAdmission) }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4">
                                                    <span class="text-muted-foreground">Record</span>
                                                    <span class="font-medium text-right">{{ admissionPatientMeta(detailsSheetAdmission) }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4">
                                                    <span class="text-muted-foreground">Ward</span>
                                                    <span class="font-medium">{{ admissionWardLabel(detailsSheetAdmission) }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4">
                                                    <span class="text-muted-foreground">Bed</span>
                                                    <span class="font-medium">{{ admissionBedLabel(detailsSheetAdmission) }}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                <AppIcon name="link" class="size-4 text-muted-foreground" />
                                                Linked context
                                            </CardTitle>
                                            <CardDescription class="text-xs">
                                                Upstream appointment and patient record context for this admission.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent class="grid gap-3 px-4 pt-0 text-sm md:grid-cols-2 xl:grid-cols-3">
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Queue origin</p>
                                                <p class="text-foreground">{{ admissionHandoffLabel(detailsSheetAdmission) || 'Direct admission' }}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Linked appointment</p>
                                                <p class="text-foreground">{{ detailsAppointmentContextLabel }}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Appointment status</p>
                                                <p class="text-foreground">{{ detailsAppointmentContextStatusLabel }}</p>
                                            </div>
                                            <div class="space-y-1 md:col-span-2 xl:col-span-1">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Appointment context</p>
                                                <p class="text-foreground">{{ detailsAppointmentContextMeta }}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Visit reason</p>
                                                <p class="text-foreground">{{ detailsAppointmentContextReason || 'No visit reason recorded.' }}</p>
                                            </div>
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Patient record</p>
                                                <p class="text-foreground">{{ admissionPatientLinkLabel(detailsSheetAdmission) }}</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card
                                        v-if="detailsShiftHandoffSummary"
                                        class="rounded-lg !gap-4 !py-4"
                                    >
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <div class="flex flex-wrap items-start justify-between gap-2">
                                                <div>
                                                    <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                        <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                                                        ADT next step
                                                    </CardTitle>
                                                    <CardDescription class="mt-0.5 text-xs">
                                                        The current ADT recommendation for this stay, placement, and downstream handoff.
                                                    </CardDescription>
                                                </div>
                                                <Badge :variant="detailsShiftHandoffSummary.tone">
                                                    {{ detailsShiftHandoffSummary.recommendationTitle }}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent class="space-y-4 px-4 pt-0">
                                            <div class="grid gap-3 sm:grid-cols-3">
                                                <div class="rounded-lg border bg-muted/20 p-3">
                                                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Admission source</p>
                                                    <p class="mt-2 text-sm font-medium text-foreground">
                                                        {{ detailsShiftHandoffSummary.handoffSource }}
                                                    </p>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        {{ admissionHandoffLabel(detailsSheetAdmission) || 'No upstream appointment link is attached.' }}
                                                    </p>
                                                </div>
                                                <div class="rounded-lg border bg-muted/20 p-3">
                                                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Latest ADT event</p>
                                                    <p class="mt-2 text-sm font-medium text-foreground">
                                                        {{ detailsShiftHandoffSummary.latestEventTitle }}
                                                    </p>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        {{ detailsShiftHandoffSummary.latestEventTime }}
                                                    </p>
                                                </div>
                                                <div class="rounded-lg border bg-muted/20 p-3">
                                                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Required discharge checks</p>
                                                    <p class="mt-2 text-sm font-medium text-foreground">
                                                        {{ detailsShiftHandoffSummary.requiredProgress }} complete
                                                    </p>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        {{ detailsShiftHandoffSummary.blockerCount }} blocker{{ detailsShiftHandoffSummary.blockerCount === 1 ? '' : 's' }} currently open
                                                    </p>
                                                </div>
                                            </div>

                                            <div class="rounded-lg border bg-muted/20 p-4 dark:bg-muted/10">
                                                <div class="flex flex-wrap items-start justify-between gap-3">
                                                    <div class="min-w-0 flex-1">
                                                        <p class="text-sm font-medium text-foreground">
                                                            {{ detailsShiftHandoffSummary.recommendationTitle }}
                                                        </p>
                                                        <p class="mt-1 text-sm text-muted-foreground">
                                                            {{ detailsShiftHandoffSummary.recommendationDescription }}
                                                        </p>
                                                        <p class="mt-2 text-xs text-muted-foreground">
                                                            {{ detailsShiftHandoffSummary.latestEventDescription }}
                                                        </p>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2">
                                                        <Button
                                                            v-if="detailsShiftHandoffSummary.primaryActionType === 'status' && detailsShiftHandoffSummary.primaryActionStatus && canUpdateAdmissionStatus"
                                                            size="sm"
                                                            class="gap-1.5"
                                                            :disabled="actionLoadingId === detailsSheetAdmission.id"
                                                            @click="openAdmissionStatusDialog(detailsSheetAdmission, detailsShiftHandoffSummary.primaryActionStatus)"
                                                        >
                                                            <AppIcon name="user-x" class="size-3.5" />
                                                            {{ detailsShiftHandoffSummary.primaryActionLabel }}
                                                        </Button>
                                                        <Button
                                                            v-else-if="detailsShiftHandoffSummary.primaryActionType === 'link' && detailsShiftHandoffSummary.primaryActionHref && detailsShiftHandoffSummary.primaryActionLabel"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link :href="detailsShiftHandoffSummary.primaryActionHref">
                                                                <AppIcon name="arrow-up-right" class="size-3.5" />
                                                                {{ detailsShiftHandoffSummary.primaryActionLabel }}
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <div class="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                        <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                                        ADT timeline
                                                    </CardTitle>
                                                    <CardDescription class="mt-0.5 text-xs">
                                                        {{ detailsAdtTimelineHelperText }}
                                                    </CardDescription>
                                                </div>
                                                <Badge
                                                    v-if="detailsAdtTimelineFallbackCount > 0"
                                                    variant="outline"
                                                    class="text-[10px]"
                                                >
                                                    {{ detailsAdtTimelineFallbackCount }} fallback
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent class="px-4 pt-0">
                                            <div v-if="detailsAdtTimelineLoading" class="space-y-2">
                                                <Skeleton class="h-14 w-full" />
                                                <Skeleton class="h-14 w-full" />
                                            </div>
                                            <div v-else class="space-y-3">
                                                <Alert
                                                    v-if="detailsAdtTimelineError"
                                                    variant="destructive"
                                                >
                                                    <AlertTitle>Timeline load issue</AlertTitle>
                                                    <AlertDescription>
                                                        {{ detailsAdtTimelineError }}
                                                    </AlertDescription>
                                                </Alert>
                                                <div
                                                    v-if="detailsAdtTimelineEvents.length === 0"
                                                    class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                                                >
                                                    No ADT events are available for this admission yet.
                                                </div>
                                                <div
                                                    v-else
                                                    class="space-y-0"
                                                >
                                                    <div
                                                        v-for="(event, index) in detailsAdtTimelineEvents"
                                                        :key="event.key"
                                                        class="flex gap-3"
                                                    >
                                                        <div class="flex w-8 flex-col items-center">
                                                            <div
                                                                class="flex h-8 w-8 items-center justify-center rounded-full border bg-muted/30"
                                                            >
                                                                <AppIcon :name="event.icon" class="size-4 text-muted-foreground" />
                                                            </div>
                                                            <div
                                                                v-if="index < detailsAdtTimelineEvents.length - 1"
                                                                class="mt-2 h-full w-px bg-border"
                                                            />
                                                        </div>
                                                        <div class="min-w-0 flex-1 rounded-lg border p-3">
                                                            <div class="flex flex-wrap items-start justify-between gap-2">
                                                                <div class="space-y-1">
                                                                    <div class="flex flex-wrap items-center gap-2">
                                                                        <p class="text-sm font-medium">
                                                                            {{ event.title }}
                                                                        </p>
                                                                        <Badge :variant="event.variant">
                                                                            {{ event.title }}
                                                                        </Badge>
                                                                        <Badge
                                                                            v-if="event.source === 'current-state'"
                                                                            variant="outline"
                                                                            class="text-[10px]"
                                                                        >
                                                                            Fallback
                                                                        </Badge>
                                                                    </div>
                                                                    <p class="text-xs text-muted-foreground">
                                                                        {{ event.description }}
                                                                    </p>
                                                                </div>
                                                                <p class="text-xs text-muted-foreground">
                                                                    {{ formatDateTime(event.timestamp) }}
                                                                </p>
                                                            </div>
                                                            <p
                                                                v-if="event.placementSummary"
                                                                class="mt-2 text-xs text-muted-foreground"
                                                            >
                                                                Placement: {{ event.placementSummary }}
                                                            </p>
                                                            <p
                                                                v-if="event.placementOrigin"
                                                                class="mt-1 text-xs text-muted-foreground"
                                                            >
                                                                From: {{ event.placementOrigin }}
                                                            </p>
                                                            <p
                                                                v-if="event.handoffSummary"
                                                                class="mt-2 text-xs text-muted-foreground"
                                                            >
                                                                Handoff: {{ event.handoffSummary }}
                                                            </p>
                                                            <p
                                                                v-if="event.reason"
                                                                class="mt-2 text-xs text-muted-foreground"
                                                            >
                                                                Reason: {{ event.reason }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Collapsible
                                        v-if="hasActivePlacementStatus(detailsSheetAdmission.status)"
                                        v-model:open="detailsDischargeReadinessOpen"
                                    >
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <div class="flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="clipboard-check" class="size-4 text-muted-foreground" />
                                                            Discharge readiness
                                                        </CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            {{ detailsDischargeReadinessHeaderSummary }}
                                                        </CardDescription>
                                                    </div>
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            class="gap-1.5"
                                                            :disabled="detailsDischargeReadinessEntry.loading"
                                                            @click="loadDischargeReadiness(detailsSheetAdmission, { force: true })"
                                                        >
                                                            <AppIcon name="refresh-cw" class="size-3.5" />
                                                            {{ detailsDischargeReadinessEntry.loading ? 'Checking...' : 'Refresh' }}
                                                        </Button>
                                                        <CollapsibleTrigger as-child>
                                                            <Button size="sm" variant="secondary" class="gap-1.5">
                                                                <AppIcon :name="detailsDischargeReadinessOpen ? 'chevron-up' : 'chevron-down'" class="size-3.5" />
                                                                {{ detailsDischargeReadinessOpen ? 'Hide' : 'Show' }}
                                                            </Button>
                                                        </CollapsibleTrigger>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CollapsibleContent>
                                                <CardContent class="space-y-3 px-4 pt-0">
                                                    <div
                                                        v-if="detailsDischargeReadinessEntry.error"
                                                        class="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground"
                                                    >
                                                        <p class="font-medium text-foreground">Discharge readiness unavailable</p>
                                                        <p class="mt-1 text-xs">{{ detailsDischargeReadinessEntry.error }}</p>
                                                    </div>
                                                    <div v-else-if="detailsDischargeReadinessEntry.loading" class="space-y-2">
                                                        <Skeleton class="h-16 w-full" />
                                                        <Skeleton class="h-16 w-full" />
                                                    </div>
                                                    <div
                                                        v-for="section in detailsDischargeReadinessSections"
                                                        :key="section.key"
                                                        class="rounded-lg border bg-muted/20 p-3 dark:bg-muted/10"
                                                    >
                                                        <div class="flex flex-wrap items-start justify-between gap-2">
                                                            <div>
                                                                <p class="text-sm font-medium">{{ section.label }}</p>
                                                                <p class="text-xs text-muted-foreground">{{ section.description }}</p>
                                                            </div>
                                                            <Badge variant="outline">
                                                                {{ section.items.filter((item) => item.complete).length }}/{{ section.items.length }}
                                                            </Badge>
                                                        </div>
                                                        <div class="mt-3 space-y-2">
                                                            <div
                                                                v-for="item in section.items"
                                                                :key="item.key"
                                                                :class="['rounded-lg border p-3', dischargeReadinessRowClass(item)]"
                                                            >
                                                                <div class="flex items-start gap-3">
                                                                    <div :class="['mt-0.5 rounded-full border p-1', dischargeReadinessIconContainerClass(item)]">
                                                                        <AppIcon :name="dischargeReadinessIcon(item)" :class="['size-4', dischargeReadinessIconClass(item)]" />
                                                                    </div>
                                                                    <div class="min-w-0 flex-1 space-y-2">
                                                                        <div class="flex flex-wrap items-start justify-between gap-2">
                                                                            <div>
                                                                                <div class="flex flex-wrap items-center gap-2">
                                                                                    <p class="text-sm font-medium">{{ item.label }}</p>
                                                                                    <Badge :variant="dischargeReadinessBadgeVariant(item)" :class="dischargeReadinessBadgeClass(item)">
                                                                                        {{ dischargeReadinessBadgeLabel(item) }}
                                                                                    </Badge>
                                                                                </div>
                                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                                    {{ item.description }}
                                                                                </p>
                                                                            </div>
                                                                            <Button
                                                                                v-if="item.actionHref && item.actionLabel"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                as-child
                                                                                class="gap-1.5"
                                                                            >
                                                                                <Link :href="item.actionHref">
                                                                                    <AppIcon name="arrow-up-right" class="size-3.5" />
                                                                                    {{ item.actionLabel }}
                                                                                </Link>
                                                                            </Button>
                                                                        </div>
                                                                        <p class="text-sm text-foreground">{{ item.statusText }}</p>
                                                                        <div
                                                                            v-if="item.manualKey"
                                                                            class="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 dark:bg-muted/15"
                                                                        >
                                                                            <Label :for="`details-discharge-${detailsSheetAdmission.id}-${item.manualKey}`" class="flex flex-1 items-center gap-3 text-sm">
                                                                                <Checkbox
                                                                                    :id="`details-discharge-${detailsSheetAdmission.id}-${item.manualKey}`"
                                                                                    :model-value="detailsDischargeManualState[item.manualKey]"
                                                                                    @update:model-value="updateDischargeManualChecklist(detailsSheetAdmission.id, item.manualKey, $event)"
                                                                                />
                                                                                <span>Mark as complete</span>
                                                                            </Label>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </CollapsibleContent>
                                        </Card>
                                    </Collapsible>

                                    <Card v-if="detailsSheetAdmission.admissionReason" class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                <AppIcon name="clipboard-list" class="size-4 text-muted-foreground" />
                                                Admission reason
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent class="px-4 pt-0 text-sm leading-6 text-foreground">
                                            {{ detailsSheetAdmission.admissionReason }}
                                        </CardContent>
                                    </Card>

                                    <Card
                                        v-if="detailsSheetAdmission.status === 'discharged' || detailsSheetAdmission.dischargeDestination || detailsSheetAdmission.followUpPlan"
                                        class="rounded-lg !gap-4 !py-4"
                                    >
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                <AppIcon name="arrow-up-right" class="size-4 text-muted-foreground" />
                                                Discharge handoff
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent class="grid gap-3 px-4 pt-0 text-sm md:grid-cols-2">
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Discharge destination</p>
                                                <p class="leading-6 text-foreground">{{ detailsSheetAdmission.dischargeDestination || 'Not recorded' }}</p>
                                            </div>
                                            <div class="space-y-1 md:col-span-2">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Follow-up plan</p>
                                                <p class="leading-6 text-foreground">{{ detailsSheetAdmission.followUpPlan || 'No follow-up plan recorded.' }}</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card
                                        v-if="detailsSheetAdmission.notes || detailsSheetAdmission.statusReason"
                                        class="rounded-lg !gap-4 !py-4"
                                    >
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                <AppIcon name="file-text" class="size-4 text-muted-foreground" />
                                                {{ admissionNotesSectionTitle(detailsSheetAdmission.status) }}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent class="space-y-3 px-4 pt-0 text-sm">
                                            <div v-if="detailsSheetAdmission.notes" class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Admission notes</p>
                                                <p class="leading-6 text-foreground">
                                                    {{ detailsSheetAdmission.notes }}
                                                </p>
                                            </div>
                                            <div v-if="detailsSheetAdmission.statusReason" class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{{ admissionDispositionNoteLabel(detailsSheetAdmission.status) }}</p>
                                                <p class="leading-6 text-foreground">
                                                    {{ detailsSheetAdmission.statusReason }}
                                                </p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="workflows" class="mt-3 space-y-3">
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="activity" class="size-4 text-muted-foreground" />
                                                    {{ detailsWorkflowActionTitle }}
                                                </CardTitle>
                                                <CardDescription class="text-xs">
                                                    {{ detailsWorkflowActionDescription }}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent class="flex flex-wrap gap-2 px-4 pt-0">
                                                <template v-if="isDischargedAdmissionStatus(detailsSheetAdmission.status)">
                                                    <Button
                                                        v-if="canReadAppointments"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="admissionFollowUpWorkflowHref(detailsSheetAdmission)">
                                                            <AppIcon name="calendar-clock" class="size-3.5" />
                                                            Schedule post-discharge review
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        v-if="canReadMedicalRecords"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="admissionMedicalRecordBrowseHref(detailsSheetAdmission)">
                                                            <AppIcon name="file-text" class="size-3.5" />
                                                            Open clinical records
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        v-if="canReadBillingInvoices"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="modulePatientHref('/billing-invoices', detailsSheetAdmission)">
                                                            <AppIcon name="credit-card" class="size-3.5" />
                                                            Open billing follow-up
                                                        </Link>
                                                    </Button>
                                                </template>
                                                <template v-else-if="hasActivePlacementStatus(detailsSheetAdmission.status) && canUpdateAdmissionStatus">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        class="gap-1.5"
                                                        :disabled="actionLoadingId === detailsSheetAdmission.id"
                                                        @click="openAdmissionStatusDialog(detailsSheetAdmission, 'transferred')"
                                                    >
                                                        <AppIcon name="layout-list" class="size-3.5" />
                                                        Transfer ward/bed
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        class="gap-1.5"
                                                        :disabled="actionLoadingId === detailsSheetAdmission.id"
                                                        @click="openAdmissionStatusDialog(detailsSheetAdmission, 'discharged')"
                                                    >
                                                        <AppIcon name="user-x" class="size-3.5" />
                                                        Discharge patient
                                                    </Button>
                                                    <Button
                                                        v-if="detailsSheetAdmission.appointmentId && canReadAppointments"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="appointmentReturnHref(detailsSheetAdmission.appointmentId)">
                                                            <AppIcon name="calendar-clock" class="size-3.5" />
                                                            Open appointment
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        v-if="detailsAdmissionOpeningNoteSummary?.primaryActionLabel && detailsAdmissionOpeningNoteSummary?.primaryActionHref"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="detailsAdmissionOpeningNoteSummary.primaryActionHref">
                                                            <AppIcon name="file-text" class="size-3.5" />
                                                            {{ detailsAdmissionOpeningNoteSummary.primaryActionLabel }}
                                                        </Link>
                                                    </Button>
                                                </template>
                                                <template v-else>
                                                    <Button
                                                        v-if="canReadMedicalRecords"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="admissionMedicalRecordBrowseHref(detailsSheetAdmission)">
                                                            <AppIcon name="file-text" class="size-3.5" />
                                                            Open medical records
                                                        </Link>
                                                    </Button>
                                                </template>
                                                <Button size="sm" variant="outline" as-child class="gap-1.5">
                                                    <Link href="/admissions">
                                                        <AppIcon name="layout-list" class="size-3.5" />
                                                        Back to queue
                                                    </Link>
                                                </Button>
                                            </CardContent>
                                        </Card>

                                        <Card
                                            v-if="detailsAdmissionOpeningNoteSummary"
                                            class="rounded-lg !gap-4 !py-4"
                                        >
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <div class="flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="file-text" class="size-4 text-muted-foreground" />
                                                            Admission note continuity
                                                        </CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            Keep one opening admission note for the stay, then use progress notes for later inpatient reviews.
                                                        </CardDescription>
                                                    </div>
                                                    <Badge :variant="detailsAdmissionOpeningNoteSummary.badgeVariant">
                                                        {{ detailsAdmissionOpeningNoteSummary.badgeLabel }}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3 px-4 pt-0 text-sm">
                                                <div class="space-y-1">
                                                    <p class="font-medium text-foreground">
                                                        {{ detailsAdmissionOpeningNoteSummary.title }}
                                                    </p>
                                                    <p class="leading-6 text-muted-foreground">
                                                        {{ detailsAdmissionOpeningNoteSummary.description }}
                                                    </p>
                                                </div>
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="space-y-1">
                                                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Latest note</p>
                                                        <p class="text-foreground">
                                                            {{
                                                                detailsAdmissionOpeningNoteSummary.latestRecord
                                                                    ? (detailsAdmissionOpeningNoteSummary.latestRecord.recordNumber || 'Admission note')
                                                                    : 'No admission note linked yet'
                                                            }}
                                                        </p>
                                                        <p
                                                            v-if="detailsAdmissionOpeningNoteSummary.latestRecord"
                                                            class="text-xs text-muted-foreground"
                                                        >
                                                            {{
                                                                formatEnumLabel(
                                                                    detailsAdmissionOpeningNoteSummary.latestRecord.status || 'draft',
                                                                )
                                                            }}
                                                            <template v-if="detailsAdmissionOpeningNoteSummary.latestRecordedAtLabel">
                                                                | {{ detailsAdmissionOpeningNoteSummary.latestRecordedAtLabel }}
                                                            </template>
                                                        </p>
                                                    </div>
                                                    <div class="space-y-1">
                                                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Continuity guidance</p>
                                                        <p class="leading-6 text-foreground">
                                                            {{ detailsAdmissionOpeningNoteSummary.guidance }}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p
                                                    v-if="detailsAdmissionOpeningNoteSummary.noteCount > 1"
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    {{ detailsAdmissionOpeningNoteSummary.noteCount }} admission notes are currently linked to this stay. Keep later follow-up in progress notes unless a corrected opening note is clinically necessary.
                                                </p>
                                                <div class="flex flex-wrap gap-2">
                                                    <Button
                                                        v-if="detailsAdmissionOpeningNoteSummary.primaryActionLabel && detailsAdmissionOpeningNoteSummary.primaryActionHref"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="detailsAdmissionOpeningNoteSummary.primaryActionHref">
                                                            <AppIcon name="file-text" class="size-3.5" />
                                                            {{ detailsAdmissionOpeningNoteSummary.primaryActionLabel }}
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        v-if="detailsAdmissionOpeningNoteSummary.secondaryActionLabel && detailsAdmissionOpeningNoteSummary.secondaryActionHref"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="detailsAdmissionOpeningNoteSummary.secondaryActionHref">
                                                            <AppIcon name="arrow-up-right" class="size-3.5" />
                                                            {{ detailsAdmissionOpeningNoteSummary.secondaryActionLabel }}
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card
                                            v-if="detailsAdmissionProgressNoteSummary"
                                            class="rounded-lg !gap-4 !py-4"
                                        >
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <div class="flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="file-text" class="size-4 text-muted-foreground" />
                                                            Progress note continuity
                                                        </CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            Use progress notes for daily inpatient follow-up after the opening admission note is documented.
                                                        </CardDescription>
                                                    </div>
                                                    <Badge :variant="detailsAdmissionProgressNoteSummary.badgeVariant">
                                                        {{ detailsAdmissionProgressNoteSummary.badgeLabel }}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3 px-4 pt-0 text-sm">
                                                <div class="space-y-1">
                                                    <p class="font-medium text-foreground">
                                                        {{ detailsAdmissionProgressNoteSummary.title }}
                                                    </p>
                                                    <p class="leading-6 text-muted-foreground">
                                                        {{ detailsAdmissionProgressNoteSummary.description }}
                                                    </p>
                                                </div>
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="space-y-1">
                                                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Latest note</p>
                                                        <p class="text-foreground">
                                                            {{
                                                                detailsAdmissionProgressNoteSummary.latestRecord
                                                                    ? (detailsAdmissionProgressNoteSummary.latestRecord.recordNumber || 'Progress note')
                                                                    : 'No progress note linked yet'
                                                            }}
                                                        </p>
                                                        <p
                                                            v-if="detailsAdmissionProgressNoteSummary.latestRecord"
                                                            class="text-xs text-muted-foreground"
                                                        >
                                                            {{
                                                                formatEnumLabel(
                                                                    detailsAdmissionProgressNoteSummary.latestRecord.status || 'draft',
                                                                )
                                                            }}
                                                            <template v-if="detailsAdmissionProgressNoteSummary.latestRecordedAtLabel">
                                                                | {{ detailsAdmissionProgressNoteSummary.latestRecordedAtLabel }}
                                                            </template>
                                                        </p>
                                                    </div>
                                                    <div class="space-y-1">
                                                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Continuity guidance</p>
                                                        <p class="leading-6 text-foreground">
                                                            {{ detailsAdmissionProgressNoteSummary.guidance }}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p
                                                    v-if="detailsAdmissionProgressNoteSummary.noteCount > 1"
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    {{ detailsAdmissionProgressNoteSummary.noteCount }} progress notes are currently linked to this stay. Keep documenting ongoing ward reviews here while the admission remains active.
                                                </p>
                                                <div class="flex flex-wrap gap-2">
                                                    <Button
                                                        v-if="detailsAdmissionProgressNoteSummary.primaryActionLabel && detailsAdmissionProgressNoteSummary.primaryActionHref"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="detailsAdmissionProgressNoteSummary.primaryActionHref">
                                                            <AppIcon name="file-text" class="size-3.5" />
                                                            {{ detailsAdmissionProgressNoteSummary.primaryActionLabel }}
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        v-if="detailsAdmissionProgressNoteSummary.secondaryActionLabel && detailsAdmissionProgressNoteSummary.secondaryActionHref"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="detailsAdmissionProgressNoteSummary.secondaryActionHref">
                                                            <AppIcon name="arrow-up-right" class="size-3.5" />
                                                            {{ detailsAdmissionProgressNoteSummary.secondaryActionLabel }}
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card
                                            v-if="detailsAdmissionDischargeNoteSummary"
                                            class="rounded-lg !gap-4 !py-4"
                                        >
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <div class="flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                            <AppIcon name="file-text" class="size-4 text-muted-foreground" />
                                                            Discharge note continuity
                                                        </CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            Use one discharge note to summarize the completed stay before confirming discharge.
                                                        </CardDescription>
                                                    </div>
                                                    <Badge :variant="detailsAdmissionDischargeNoteSummary.badgeVariant">
                                                        {{ detailsAdmissionDischargeNoteSummary.badgeLabel }}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-3 px-4 pt-0 text-sm">
                                                <div class="space-y-1">
                                                    <p class="font-medium text-foreground">
                                                        {{ detailsAdmissionDischargeNoteSummary.title }}
                                                    </p>
                                                    <p class="leading-6 text-muted-foreground">
                                                        {{ detailsAdmissionDischargeNoteSummary.description }}
                                                    </p>
                                                </div>
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="space-y-1">
                                                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Latest note</p>
                                                        <p class="text-foreground">
                                                            {{
                                                                detailsAdmissionDischargeNoteSummary.latestRecord
                                                                    ? (detailsAdmissionDischargeNoteSummary.latestRecord.recordNumber || 'Discharge note')
                                                                    : 'No discharge note linked yet'
                                                            }}
                                                        </p>
                                                        <p
                                                            v-if="detailsAdmissionDischargeNoteSummary.latestRecord"
                                                            class="text-xs text-muted-foreground"
                                                        >
                                                            {{
                                                                formatEnumLabel(
                                                                    detailsAdmissionDischargeNoteSummary.latestRecord.status || 'draft',
                                                                )
                                                            }}
                                                            <template v-if="detailsAdmissionDischargeNoteSummary.latestRecordedAtLabel">
                                                                | {{ detailsAdmissionDischargeNoteSummary.latestRecordedAtLabel }}
                                                            </template>
                                                        </p>
                                                    </div>
                                                    <div class="space-y-1">
                                                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Closeout guidance</p>
                                                        <p class="leading-6 text-foreground">
                                                            {{ detailsAdmissionDischargeNoteSummary.guidance }}
                                                        </p>
                                                    </div>
                                                </div>
                                                <p
                                                    v-if="detailsAdmissionDischargeNoteSummary.noteCount > 1"
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    {{ detailsAdmissionDischargeNoteSummary.noteCount }} discharge notes are currently linked to this stay. Keep one authoritative discharge summary for the final closeout whenever possible.
                                                </p>
                                                <div class="flex flex-wrap gap-2">
                                                    <Button
                                                        v-if="detailsAdmissionDischargeNoteSummary.primaryActionLabel && detailsAdmissionDischargeNoteSummary.primaryActionHref"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="detailsAdmissionDischargeNoteSummary.primaryActionHref">
                                                            <AppIcon name="file-text" class="size-3.5" />
                                                            {{ detailsAdmissionDischargeNoteSummary.primaryActionLabel }}
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        v-if="detailsAdmissionDischargeNoteSummary.secondaryActionLabel && detailsAdmissionDischargeNoteSummary.secondaryActionHref"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="detailsAdmissionDischargeNoteSummary.secondaryActionHref">
                                                            <AppIcon name="arrow-up-right" class="size-3.5" />
                                                            {{ detailsAdmissionDischargeNoteSummary.secondaryActionLabel }}
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card
                                            v-if="hasActivePlacementStatus(detailsSheetAdmission.status) && canUpdateAdmissionStatus"
                                            class="rounded-lg !gap-4 !py-4"
                                        >
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="shield-alert" class="size-4 text-muted-foreground" />
                                                    Administrative correction
                                                </CardTitle>
                                                <CardDescription class="text-xs">
                                                    Use this only when the admission was entered in error and should be removed from the active census.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent class="flex flex-wrap gap-2 px-4 pt-0">
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    class="gap-1.5"
                                                    :disabled="actionLoadingId === detailsSheetAdmission.id"
                                                    @click="openAdmissionStatusDialog(detailsSheetAdmission, 'cancelled')"
                                                >
                                                    <AppIcon name="circle-x" class="size-3.5" />
                                                    Void admission record
                                                </Button>
                                            </CardContent>
                                        </Card>

                                        <Card
                                            v-if="isDischargedAdmissionStatus(detailsSheetAdmission.status)"
                                            class="rounded-lg !gap-4 !py-4"
                                        >
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <CardTitle class="flex items-center gap-2 text-sm font-medium">
                                                    <AppIcon name="arrow-up-right" class="size-4 text-muted-foreground" />
                                                    Discharge follow-up
                                                </CardTitle>
                                                <CardDescription class="text-xs">
                                                    Carry the discharge plan into the next patient-facing workflow.
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent class="space-y-3 px-4 pt-0 text-sm">
                                                <div class="space-y-1">
                                                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Destination</p>
                                                    <p class="text-foreground">{{ detailsSheetAdmission.dischargeDestination || 'Not recorded' }}</p>
                                                </div>
                                                <div class="space-y-1">
                                                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Follow-up plan</p>
                                                    <p class="leading-6 text-foreground">{{ detailsDischargeFollowUpSummary }}</p>
                                                </div>
                                                <div v-if="detailsDischargeFollowUpActions.length" class="flex flex-wrap gap-2">
                                                    <Button
                                                        v-for="action in detailsDischargeFollowUpActions"
                                                        :key="action.key"
                                                        size="sm"
                                                        variant="outline"
                                                        as-child
                                                        class="gap-1.5"
                                                    >
                                                        <Link :href="action.href">
                                                            <AppIcon :name="action.icon" class="size-3.5" />
                                                            {{ action.label }}
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>

                                    </div>
                                </TabsContent>

                                <TabsContent value="audit" class="mt-3 space-y-3">
                                    <div
                                        v-if="!canViewAdmissionAudit"
                                        class="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground dark:bg-muted/10"
                                    >
                                        <p class="font-medium text-foreground">Audit history is not available for this role.</p>
                                        <p class="mt-1 text-xs">
                                            You can still review admission details and workflows here, but audit events are limited to authorized users.
                                        </p>
                                    </div>

                                    <template v-else>
                                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            <Card class="rounded-lg !gap-3 !py-3">
                                                <CardContent class="px-4 pt-0">
                                                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                        Total entries
                                                    </p>
                                                    <p class="mt-2 text-2xl font-semibold">
                                                        {{ detailsAuditSummary.total }}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                            <Card class="rounded-lg !gap-3 !py-3">
                                                <CardContent class="px-4 pt-0">
                                                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                        Changed events
                                                    </p>
                                                    <p class="mt-2 text-2xl font-semibold">
                                                        {{ detailsAuditSummary.changedEntries }}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                            <Card class="rounded-lg !gap-3 !py-3">
                                                <CardContent class="px-4 pt-0">
                                                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                        User actions
                                                    </p>
                                                    <p class="mt-2 text-2xl font-semibold">
                                                        {{ detailsAuditSummary.userEntries }}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                            <Card class="rounded-lg !gap-3 !py-3">
                                                <CardContent class="px-4 pt-0">
                                                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                        Current view
                                                    </p>
                                                    <p class="mt-2 text-sm font-medium">
                                                        {{ detailsAuditHasActiveFilters ? 'Filtered' : 'All audit events' }}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <Collapsible v-model:open="detailsAuditFiltersOpen">
                                            <Card class="rounded-lg !gap-4 !py-4">
                                                <CardHeader class="px-4 pb-2 pt-0">
                                                    <div class="flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                            <CardTitle class="text-sm font-medium">Audit filters</CardTitle>
                                                            <CardDescription class="mt-0.5 text-xs">
                                                                {{ detailsAuditMeta?.total ?? 0 }} entries | Search by action, user, or date range
                                                            </CardDescription>
                                                        </div>
                                                        <div class="flex items-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                :disabled="detailsAuditLoading || detailsAuditExporting"
                                                                @click="exportDetailsAuditLogsCsv"
                                                            >
                                                                {{ detailsAuditExporting ? 'Preparing...' : 'Export CSV' }}
                                                            </Button>
                                                            <CollapsibleTrigger as-child>
                                                                <Button variant="secondary" size="sm" class="gap-1.5">
                                                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                                    {{ detailsAuditFiltersOpen ? 'Hide filters' : 'Show filters' }}
                                                                </Button>
                                                            </CollapsibleTrigger>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CollapsibleContent>
                                                    <CardContent class="space-y-3 px-4 pt-0">
                                                        <div class="grid gap-3 sm:grid-cols-2">
                                                            <div class="grid gap-2">
                                                                <Label for="admission-audit-q" class="text-xs">Search</Label>
                                                                <Input id="admission-audit-q" v-model="detailsAuditFilters.q" placeholder="e.g. status.updated, created..." />
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="admission-audit-action" class="text-xs">Exact action key</Label>
                                                                <Input id="admission-audit-action" v-model="detailsAuditFilters.action" placeholder="Optional system action key" />
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="admission-audit-actor-type" class="text-xs">Actor type</Label>
                                                                <Select v-model="detailsAuditFilters.actorType">
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                    <SelectItem v-for="option in auditActorTypeOptions" :key="`admission-audit-actor-type-${option.value || 'all'}`" :value="option.value">{{ option.label }}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="admission-audit-actor-id" class="text-xs">Actor user ID</Label>
                                                                <Input id="admission-audit-actor-id" v-model="detailsAuditFilters.actorId" inputmode="numeric" placeholder="Optional user ID" />
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="admission-audit-from" class="text-xs">From</Label>
                                                                <Input id="admission-audit-from" v-model="detailsAuditFilters.from" type="datetime-local" />
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="admission-audit-to" class="text-xs">To</Label>
                                                                <Input id="admission-audit-to" v-model="detailsAuditFilters.to" type="datetime-local" />
                                                            </div>
                                                            <div class="grid gap-2">
                                                                <Label for="admission-audit-per-page" class="text-xs">Rows per page</Label>
                                                                <Select :model-value="String(detailsAuditFilters.perPage)" @update:model-value="detailsAuditFilters.perPage = Number($event)">
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                    <SelectItem value="10">10</SelectItem>
                                                                    <SelectItem value="20">20</SelectItem>
                                                                    <SelectItem value="50">50</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                        <div class="flex flex-wrap gap-2 border-t pt-3">
                                                            <Button size="sm" class="gap-1.5" :disabled="detailsAuditLoading" @click="applyDetailsAuditFilters">
                                                                <AppIcon name="eye" class="size-3.5" />
                                                                {{ detailsAuditLoading ? 'Applying...' : 'Apply filters' }}
                                                            </Button>
                                                            <Button size="sm" variant="outline" class="gap-1.5" :disabled="detailsAuditLoading" @click="resetDetailsAuditFilters">
                                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                                Reset
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </CollapsibleContent>
                                            </Card>
                                        </Collapsible>

                                        <Alert v-if="detailsAuditError" variant="destructive">
                                            <AlertTitle>Audit load issue</AlertTitle>
                                            <AlertDescription>{{ detailsAuditError }}</AlertDescription>
                                        </Alert>
                                        <div v-else-if="detailsAuditLoading" class="space-y-2">
                                            <Skeleton class="h-12 w-full" />
                                            <Skeleton class="h-12 w-full" />
                                        </div>
                                        <div v-else-if="detailsAuditLogs.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                            No audit logs found for current filters.
                                        </div>
                                        <div v-else class="space-y-2">
                                            <div
                                                v-for="log in detailsAuditLogs"
                                                :key="log.id"
                                                class="rounded-lg border p-3 text-sm"
                                            >
                                                <div class="flex flex-wrap items-start justify-between gap-2">
                                                    <div class="space-y-1">
                                                        <p class="font-medium">
                                                            {{ formatEnumLabel(log.action || 'event') }}
                                                        </p>
                                                        <p class="text-xs text-muted-foreground">
                                                            {{ formatDateTime(log.createdAt) }} | {{ auditActorLabel(log) }}
                                                        </p>
                                                    </div>
                                                    <div class="flex flex-wrap gap-1.5">
                                                        <Badge variant="outline">
                                                            {{ auditLogActorTypeLabel(log) }}
                                                        </Badge>
                                                        <Badge
                                                            v-if="auditLogChangeKeys(log).length > 0"
                                                            variant="secondary"
                                                        >
                                                            {{ auditLogChangeKeys(log).length }} fields changed
                                                        </Badge>
                                                        <Badge
                                                            v-if="auditLogMetadataPreview(log).length > 0"
                                                            variant="secondary"
                                                        >
                                                            {{ auditLogMetadataPreview(log).length }} metadata items
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div
                                                    v-if="auditLogChangeKeys(log).length > 0"
                                                    class="mt-3 flex flex-wrap gap-1.5"
                                                >
                                                    <Badge
                                                        v-for="field in auditLogChangeKeys(log)"
                                                        :key="`${log.id}-field-${field}`"
                                                        variant="outline"
                                                    >
                                                        {{ field }}
                                                    </Badge>
                                                </div>

                                                <div
                                                    v-if="auditLogMetadataPreview(log).length > 0"
                                                    class="mt-3 grid gap-1 text-xs text-muted-foreground"
                                                >
                                                    <p
                                                        v-for="item in auditLogMetadataPreview(log)"
                                                        :key="`${log.id}-meta-${item.key}`"
                                                    >
                                                        <span class="font-medium text-foreground">{{ item.key }}:</span>
                                                        {{ item.value }}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex items-center justify-between border-t pt-2">
                                            <Button variant="outline" size="sm" class="gap-1.5" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage <= 1" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 2) - 1)">
                                                <AppIcon name="chevron-left" class="size-3.5" />
                                                Previous
                                            </Button>
                                            <p class="text-xs text-muted-foreground">Page {{ detailsAuditMeta?.currentPage ?? 1 }} of {{ detailsAuditMeta?.lastPage ?? 1 }} | {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} logs</p>
                                            <Button variant="outline" size="sm" class="gap-1.5" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage >= detailsAuditMeta.lastPage" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 0) + 1)">
                                                <AppIcon name="chevron-right" class="size-3.5" />
                                                Next
                                            </Button>
                                        </div>
                                    </template>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                    <div v-else class="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                        No admission selected.
                    </div>

                    <SheetFooter class="shrink-0 flex-row border-t bg-muted/20 px-4 py-3 sm:justify-end">
                        <Button variant="outline" class="gap-1.5" @click="closeAdmissionDetailsSheet">
                            <AppIcon name="circle-x" class="size-3.5" />
                            Close
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog :open="statusDialogOpen" @update:open="(open) => (open ? (statusDialogOpen = true) : closeAdmissionStatusDialog())">
                <DialogContent :size="statusDialogAction === 'transferred' ? '4xl' : '2xl'" class="rounded-lg">
                    <DialogHeader>
                        <DialogTitle class="flex items-center gap-2">
                            <AppIcon name="bed-double" class="size-4 text-muted-foreground" />
                            {{ statusDialogTitle }}
                        </DialogTitle>
                        <DialogDescription>{{ statusDialogDescription }}</DialogDescription>
                    </DialogHeader>

                    <div class="space-y-4">
                        <div v-if="statusDialogAdmission" class="rounded-lg border p-3 text-xs text-muted-foreground">
                            <p>
                                Admission:
                                <span class="font-medium text-foreground">
                                    {{ statusDialogAdmission.admissionNumber || 'Admission' }}
                                </span>
                            </p>
                            <p>
                                Current status:
                                <span class="font-medium text-foreground">
                                    {{ formatEnumLabel(statusDialogAdmission.status) }}
                                </span>
                            </p>
                            <p>
                                Current placement:
                                <span class="font-medium text-foreground">
                                    {{ statusDialogAdmission.ward || 'N/A' }} / {{ statusDialogAdmission.bed || 'N/A' }}
                                </span>
                            </p>
                        </div>

                        <div
                            v-if="statusDialogAction === 'transferred'"
                            class="space-y-3 rounded-lg border bg-muted/20 p-4"
                        >
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <p class="text-sm font-medium">Receiving placement</p>
                                <Badge
                                    :variant="statusDialogTransferPlacementBlockedReason ? 'destructive' : 'secondary'"
                                    class="text-[11px]"
                                >
                                    Backend registry
                                </Badge>
                            </div>
                            <div class="grid gap-3 md:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="admission-status-receiving-ward">Receiving ward</Label>
                                    <Select
                                        v-model="statusDialogReceivingWard"
                                        :disabled="wardBedRegistryLoading || !canReadWardBedRegistry || !!wardBedRegistryError || !wardBedRegistryAvailable"
                                    >
                                        <SelectTrigger id="admission-status-receiving-ward" class="w-full">
                                            <SelectValue placeholder="Select receiving ward" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                v-for="ward in wardRegistryOptions"
                                                :key="`admission-status-receiving-ward-${ward}`"
                                                :value="ward"
                                            >
                                                {{ ward }}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p class="text-xs text-muted-foreground">{{ wardBedRegistryHelperText }}</p>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="admission-status-receiving-bed">Receiving bed</Label>
                                    <Select
                                        v-model="statusDialogReceivingBed"
                                        :disabled="
                                            wardBedRegistryLoading ||
                                            !canReadWardBedRegistry ||
                                            !!wardBedRegistryError ||
                                            !wardBedRegistryAvailable ||
                                            !statusDialogReceivingWard.trim() ||
                                            statusDialogReceivingBedOptions.length === 0
                                        "
                                    >
                                        <SelectTrigger id="admission-status-receiving-bed" class="w-full">
                                            <SelectValue :placeholder="statusDialogReceivingWard.trim() ? 'Select receiving bed' : 'Select ward first'" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                v-for="option in statusDialogReceivingBedOptions"
                                                :key="`admission-status-receiving-bed-${option.key}`"
                                                :value="option.value"
                                                :disabled="!option.isSelectable"
                                            >
                                                <span class="flex w-full items-center justify-between gap-2">
                                                    <span class="truncate">{{ option.label }}</span>
                                                    <span
                                                        v-if="option.isOccupied"
                                                        class="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-700 dark:text-amber-200"
                                                    >
                                                        Occupied
                                                    </span>
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p
                                        v-if="!canReadWardBedRegistry"
                                        class="text-xs text-muted-foreground"
                                    >
                                        Registry permission is required before a transfer placement can be assigned.
                                    </p>
                                    <p
                                        v-else-if="wardBedRegistryError"
                                        class="text-xs text-muted-foreground"
                                    >
                                        Refresh the page after ward/bed registry access is restored.
                                    </p>
                                    <p
                                        v-else-if="!statusDialogReceivingWard.trim()"
                                        class="text-xs text-muted-foreground"
                                    >
                                        Choose a receiving ward first to load matching backend bed options.
                                    </p>
                                    <p
                                        v-else-if="statusDialogSelectedReceivingBedResourceMeta"
                                        class="text-xs text-muted-foreground"
                                    >
                                        {{ statusDialogSelectedReceivingBedResourceMeta }}
                                    </p>
                                    <p
                                        v-else-if="!wardBedRegistryLoading && statusDialogReceivingWard.trim() && statusDialogReceivingBedOptions.length === 0"
                                        class="text-xs text-muted-foreground"
                                    >
                                        No active beds are configured for the selected receiving ward.
                                    </p>
                                    <p
                                        v-else-if="!wardBedRegistryLoading && statusDialogReceivingWard.trim() && selectableStatusDialogReceivingBedOptions.length === 0"
                                        class="text-xs text-muted-foreground"
                                    >
                                        All active beds in the selected receiving ward are currently occupied.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div v-if="statusDialogAction === 'discharged'" class="space-y-3">
                            <SearchableSelectField
                                input-id="admission-status-discharge-destination"
                                v-model="statusDialogDischargeDestination"
                                label="Discharge destination"
                                :options="statusDialogDischargeDestinationOptions"
                                placeholder="Select discharge destination"
                                search-placeholder="Search common discharge destinations"
                                :helper-text="statusDialogDischargeDestinationHelperText"
                                :error-message="statusDialogError && !statusDialogDischargeDestination.trim() ? statusDialogError : null"
                                empty-text="No common discharge destination matched that search."
                                :disabled="dischargeDestinationOptionsLoading || Boolean(actionLoadingId)"
                                :allow-custom-value="true"
                            />
                            <div class="grid gap-2">
                                <Label for="admission-status-follow-up-plan">Follow-up plan</Label>
                                <Textarea
                                    id="admission-status-follow-up-plan"
                                    v-model="statusDialogFollowUpPlan"
                                    class="min-h-20"
                                    placeholder="Clinic review date, referral step, medication follow-up, or home-care advice"
                                />
                            </div>
                        </div>

                        <div class="grid gap-2">
                            <Label for="admission-status-reason">{{ statusDialogReasonLabel }}</Label>
                            <Textarea
                                id="admission-status-reason"
                                v-model="statusDialogReason"
                                class="min-h-24"
                                :placeholder="statusDialogReasonPlaceholder"
                            />
                        </div>

                        <div
                            v-if="statusDialogAction === 'discharged' && statusDialogAdmission"
                            class="space-y-3 rounded-lg border bg-muted/20 p-4"
                        >
                            <div class="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <p class="text-sm font-medium">Discharge readiness</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ statusDialogDischargeReadinessHeaderSummary }}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    class="gap-1.5"
                                    :disabled="statusDialogDischargeReadinessEntry.loading"
                                    @click="loadDischargeReadiness(statusDialogAdmission, { force: true })"
                                >
                                    <AppIcon name="refresh-cw" class="size-3.5" />
                                    {{ statusDialogDischargeReadinessEntry.loading ? 'Checking...' : 'Refresh' }}
                                </Button>
                            </div>

                            <div
                                v-if="statusDialogDischargeReadinessEntry.error"
                                class="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground dark:bg-muted/10"
                            >
                                <p class="font-medium text-foreground">Discharge readiness unavailable</p>
                                <p class="mt-1 text-xs">{{ statusDialogDischargeReadinessEntry.error }}</p>
                                <p class="mt-2 text-xs text-muted-foreground">
                                    You can still discharge manually if the clinical team has completed the required checks outside these linked modules.
                                </p>
                            </div>
                            <div v-else-if="statusDialogDischargeReadinessEntry.loading" class="space-y-2">
                                <Skeleton class="h-16 w-full" />
                                <Skeleton class="h-16 w-full" />
                            </div>
                            <div v-else class="space-y-3">
                                <div
                                    v-for="section in statusDialogDischargeReadinessSections"
                                    :key="`status-dialog-${section.key}`"
                                    class="rounded-lg border bg-muted/20 p-3 dark:bg-muted/10"
                                >
                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p class="text-sm font-medium">{{ section.label }}</p>
                                            <p class="text-xs text-muted-foreground">{{ section.description }}</p>
                                        </div>
                                        <Badge variant="outline">
                                            {{ section.items.filter((item) => item.complete).length }}/{{ section.items.length }}
                                        </Badge>
                                    </div>
                                    <div class="mt-3 space-y-2">
                                        <div
                                            v-for="item in section.items"
                                            :key="`status-dialog-${item.key}`"
                                            :class="['rounded-lg border p-3', dischargeReadinessRowClass(item)]"
                                        >
                                            <div class="flex items-start gap-3">
                                                <div :class="['mt-0.5 rounded-full border p-1', dischargeReadinessIconContainerClass(item)]">
                                                    <AppIcon :name="dischargeReadinessIcon(item)" :class="['size-4', dischargeReadinessIconClass(item)]" />
                                                </div>
                                                <div class="min-w-0 flex-1 space-y-2">
                                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                                        <div>
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <p class="text-sm font-medium">{{ item.label }}</p>
                                                                <Badge :variant="dischargeReadinessBadgeVariant(item)" :class="dischargeReadinessBadgeClass(item)">
                                                                    {{ dischargeReadinessBadgeLabel(item) }}
                                                                </Badge>
                                                            </div>
                                                            <p class="mt-1 text-xs text-muted-foreground">
                                                                {{ item.description }}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            v-if="item.actionHref && item.actionLabel"
                                                            size="sm"
                                                            variant="outline"
                                                            as-child
                                                            class="gap-1.5"
                                                        >
                                                            <Link :href="item.actionHref">
                                                                <AppIcon name="arrow-up-right" class="size-3.5" />
                                                                {{ item.actionLabel }}
                                                            </Link>
                                                        </Button>
                                                    </div>
                                                    <p class="text-sm text-foreground">{{ item.statusText }}</p>
                                                    <div
                                                        v-if="item.manualKey"
                                                        class="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2 dark:bg-muted/15"
                                                    >
                                                        <Label :for="`status-dialog-discharge-${statusDialogAdmission.id}-${item.manualKey}`" class="flex flex-1 items-center gap-3 text-sm">
                                                            <Checkbox
                                                                :id="`status-dialog-discharge-${statusDialogAdmission.id}-${item.manualKey}`"
                                                                :model-value="dischargeManualChecklistStateFor(statusDialogAdmission.id)[item.manualKey]"
                                                                @update:model-value="updateDischargeManualChecklist(statusDialogAdmission.id, item.manualKey, $event)"
                                                            />
                                                            <span>Mark as complete</span>
                                                        </Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Alert v-if="statusDialogError" variant="destructive">
                            <AlertTitle class="flex items-center gap-2"><AppIcon name="alert-triangle" class="size-4" />Action validation</AlertTitle>
                            <AlertDescription>{{ statusDialogError }}</AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter class="gap-2">
                        <Button variant="outline" class="gap-1.5" :disabled="Boolean(actionLoadingId)" @click="closeAdmissionStatusDialog">
                            <AppIcon name="circle-x" class="size-3.5" />
                            Cancel
                        </Button>
                        <Button
                            class="gap-1.5"
                            :disabled="Boolean(actionLoadingId) || Boolean(statusDialogActionBlockedReason)"
                            :title="statusDialogActionBlockedReason || undefined"
                            @click="submitAdmissionStatusDialog"
                        >
                            <AppIcon name="check-circle" class="size-3.5" />
                            {{ actionLoadingId ? 'Updating...' : statusActionButtonLabel }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>































































