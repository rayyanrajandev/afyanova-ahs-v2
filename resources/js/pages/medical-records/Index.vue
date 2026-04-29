<script setup lang="ts">
import { Head, Link, router, usePage } from '@inertiajs/vue3';
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
import AuditTimelineList from '@/components/audit/AuditTimelineList.vue';
import LinkedContextLookupField from '@/components/context/LinkedContextLookupField.vue';
import RichTextEditorField from '@/components/editor/RichTextEditorField.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    auditActionDisplayLabel,
    type AuditActorSummary,
} from '@/lib/audit';
import { formatEnumLabel } from '@/lib/labels';
import { createLocaleTranslator } from '@/lib/locale';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { patientChartHref } from '@/lib/patientChart';
import { type BreadcrumbItem } from '@/types';
import {
    MEDICAL_RECORD_NOTE_TYPE_OPTIONS,
    medicalRecordNoteTypeHelperText,
    medicalRecordNoteTypeLabel,
    medicalRecordNoteTypeNarrativeHeading,
    medicalRecordNoteTypeSectionLabel,
    medicalRecordNoteTypeSectionUi,
    sanitizeMedicalRecordNoteType,
} from './noteTypes';

type ScopeData = {
    resolvedFrom: string;
    tenant: { code: string; name: string } | null;
    facility: { code: string; name: string } | null;
};

type MedicalRecord = {
    id: string;
    recordNumber: string | null;
    patientId: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    appointmentReferralId?: string | null;
    theatreProcedureId?: string | null;
    authorUserId: number | null;
    encounterAt: string | null;
    recordType: string | null;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    diagnosisCode: string | null;
    status: 'draft' | 'finalized' | 'amended' | 'archived' | string | null;
    statusReason: string | null;
    signedByUserId: number | null;
    signedByUserName: string | null;
    authorUserName: string | null;
    signedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type MedicalRecordListResponse = {
    data: MedicalRecord[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type MedicalRecordStatusCounts = {
    draft: number;
    finalized: number;
    amended: number;
    archived: number;
    other: number;
    total: number;
};

type MedicalRecordStatusCountsResponse = {
    data: MedicalRecordStatusCounts;
};

type MedicalRecordAuditLog = {
    id: string;
    medicalRecordId: string | null;
    actorId: number | null;
    actorType: 'system' | 'user' | string | null;
    actor?: AuditActorSummary | null;
    action: string | null;
    actionLabel?: string | null;
    changes: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string | null;
};

type MedicalRecordAuditLogListResponse = {
    data: MedicalRecordAuditLog[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type MedicalRecordVersion = {
    id: string;
    medicalRecordId: string | null;
    versionNumber: number | null;
    snapshot: Record<string, unknown>;
    changedFields: string[];
    createdByUserId: number | null;
    createdAt: string | null;
};

type MedicalRecordVersionListResponse = {
    data: MedicalRecordVersion[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type MedicalRecordVersionDiffRow = {
    field: string | null;
    before: unknown;
    after: unknown;
};

type MedicalRecordVersionDiffMeta = {
    id: string | null;
    medicalRecordId: string | null;
    versionNumber: number | null;
    changedFields: string[];
    createdByUserId: number | null;
    createdAt: string | null;
};

type MedicalRecordVersionDiff = {
    targetVersion: MedicalRecordVersionDiffMeta | null;
    baseVersion: MedicalRecordVersionDiffMeta | null;
    diff: MedicalRecordVersionDiffRow[];
    summary: {
        changedFieldCount: number;
    };
};

type MedicalRecordVersionDiffResponse = {
    data: MedicalRecordVersionDiff;
};

type MedicalRecordSignerAttestation = {
    id: string;
    medicalRecordId: string | null;
    attestedByUserId: number | null;
    attestedByUserName: string | null;
    attestationNote: string | null;
    attestedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type MedicalRecordSignerAttestationListResponse = {
    data: MedicalRecordSignerAttestation[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
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
    department: string | null;
    scheduledAt: string | null;
    durationMinutes: number | null;
    reason: string | null;
    status:
        | 'scheduled'
        | 'checked_in'
        | 'waiting_triage'
        | 'waiting_provider'
        | 'in_consultation'
        | 'completed'
        | 'cancelled'
        | 'no_show'
        | string
        | null;
    statusReason: string | null;
    consultationOwnerUserId: number | null;
};

type AdmissionSummary = {
    id: string;
    admissionNumber: string | null;
    patientId: string | null;
    ward: string | null;
    bed: string | null;
    admittedAt: string | null;
    status:
        | 'admitted'
        | 'discharged'
        | 'transferred'
        | 'cancelled'
        | string
        | null;
    statusReason: string | null;
};

type AppointmentResponse = {
    data: AppointmentSummary;
};

type AdmissionResponse = {
    data: AdmissionSummary;
};

type AppointmentReferral = {
    id: string;
    referralNumber: string | null;
    referralType: string | null;
    priority: string | null;
    targetDepartment: string | null;
    targetFacilityName: string | null;
    referralReason: string | null;
    clinicalNotes: string | null;
    handoffNotes: string | null;
    requestedAt: string | null;
    acceptedAt: string | null;
    handedOffAt: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
};

type AppointmentReferralListResponse = {
    data: AppointmentReferral[];
};

type LaboratoryOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedAt: string | null;
    testName: string | null;
    priority: string | null;
    resultSummary: string | null;
    resultedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
};

type PharmacyOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedAt: string | null;
    medicationName: string | null;
    dosageInstruction: string | null;
    quantityPrescribed: string | number | null;
    quantityDispensed: string | number | null;
    dispensedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
};

type RadiologyOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedAt: string | null;
    modality: string | null;
    studyDescription: string | null;
    reportSummary: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
};

type TheatreProcedure = {
    id: string;
    procedureNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    procedureType: string | null;
    procedureName: string | null;
    theatreRoomName: string | null;
    scheduledAt: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    notes: string | null;
};

type EncounterLifecycleTargetKind = 'laboratory' | 'pharmacy' | 'radiology' | 'theatre';
type EncounterLifecycleAction = 'cancel' | 'discontinue' | 'entered_in_error';

type CreateEncounterCareSectionId =
    | 'laboratory-orders'
    | 'pharmacy-orders'
    | 'radiology-orders'
    | 'theatre-procedures';

type EncounterCareState = 'loading' | 'active' | 'issue' | 'empty';

type CreateEncounterCareSummary = {
    id: CreateEncounterCareSectionId;
    label: string;
    singularLabel: string;
    pluralLabel: string;
    description: string;
    icon: string;
    count: number;
    state: EncounterCareState;
};

type LinkedContextListResponse<T> = {
    data: T[];
    meta?: {
        currentPage?: number;
        perPage?: number;
        total?: number;
        lastPage?: number;
    };
};

type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
    code?: string;
    context?: Record<string, unknown> | null;
};

type AuthPermissionsResponse = {
    data?: Array<{ name?: string | null }>;
    meta?: { total?: number | null };
};

type SearchForm = {
    q: string;
    patientId: string;
    appointmentReferralId: string;
    admissionId: string;
    status: string;
    recordType: string;
    from: string;
    to: string;
    perPage: number;
    page: number;
};

type CreateForm = {
    patientId: string;
    appointmentId: string;
    admissionId: string;
    appointmentReferralId: string;
    theatreProcedureId: string;
    encounterAt: string;
    recordType: string;
    diagnosisCode: string;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
};


type MedicalRecordCreateDraftPayload = {
    version: 1;
    savedAt: string;
    form: CreateForm;
};
type MedicalRecordStatusAction = 'finalized' | 'amended' | 'archived';
type DetailsSheetTab = 'overview' | 'timeline' | 'audit';
type DetailsAuditPreset = 'all' | 'status' | 'attestation';
type CreateContextLinkSource = 'none' | 'route' | 'auto' | 'manual';
type TimelineJumpTarget = {
    key: string;
    label: string;
    count: number;
    isCurrent: boolean;
};

const medicalRecordsW2En = {
    'return.backToAppointments': 'Back to Appointments',
} as const;

type MedicalRecordsW2Key = keyof typeof medicalRecordsW2En;

const tW2 = createLocaleTranslator<MedicalRecordsW2Key>({
    en: medicalRecordsW2En,
    sw: {
        'return.backToAppointments': 'Rudi kwenye miadi',
    },
});

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Medical Records', href: '/medical-records' },
];

const page = usePage<{
    auth?: {
        user?: {
            id?: number | string | null;
        } | null;
    } | null;
}>();

const pageLoading = ref(true);
const listLoading = ref(false);
const createLoading = ref(false);
const createSubmitIntent = ref<'save' | 'return' | 'complete'>('save');
const createProviderSessionSubmitting = ref(false);
const createConsultationTakeoverDialogOpen = ref(false);
const createConsultationTakeoverReason = ref('');
const createConsultationTakeoverError = ref<string | null>(null);
const createConsultationTakeoverSubmitting = ref(false);
const createConsultationTakeoverOwnerUserId = ref<number | null>(null);
const actionLoadingId = ref<string | null>(null);
const scope = ref<ScopeData | null>(null);
const records = ref<MedicalRecord[]>([]);
const pagination = ref<MedicalRecordListResponse['meta'] | null>(null);
const medicalRecordStatusCounts = ref<MedicalRecordStatusCounts | null>(null);
const listErrors = ref<string[]>([]);
const actionMessage = ref<string | null>(null);
const createMessage = ref<string | null>(null);
const createErrors = ref<Record<string, string[]>>({});

const createDraftRecoveryAvailable = ref(false);
const createDraftRecovered = ref(false);
const createDraftRecoverySavedAt = ref<string | null>(null);
const createDraftLastSavedAt = ref<string | null>(null);
const createDraftAutosaving = ref(false);
const MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY =
    'afya.medical-records.create-draft.v1';
let createDraftAutosaveTimer: number | null = null;
let removeMedicalRecordsNavigationGuard: VoidFunction | null = null;
const createLeaveConfirmOpen = ref(false);
const pendingMedicalRecordsVisit = ref<any | null>(null);
const pendingMedicalRecordsWorkspaceClose = ref<{ focusSearch?: boolean } | null>(null);
let bypassMedicalRecordsNavigationGuard = false;
const patientDirectory = ref<Record<string, PatientSummary>>({});
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
const createAppointmentReferrals = ref<AppointmentReferral[]>([]);
const createAppointmentReferralsLoading = ref(false);
const createAppointmentReferralsError = ref<string | null>(null);
const createEncounterLaboratoryOrders = ref<LaboratoryOrder[]>([]);
const createEncounterLaboratoryOrdersLoading = ref(false);
const createEncounterLaboratoryOrdersError = ref<string | null>(null);
const createEncounterPharmacyOrders = ref<PharmacyOrder[]>([]);
const createEncounterPharmacyOrdersLoading = ref(false);
const createEncounterPharmacyOrdersError = ref<string | null>(null);
const createEncounterRadiologyOrders = ref<RadiologyOrder[]>([]);
const createEncounterRadiologyOrdersLoading = ref(false);
const createEncounterRadiologyOrdersError = ref<string | null>(null);
const createEncounterTheatreProcedures = ref<TheatreProcedure[]>([]);
const createEncounterTheatreProceduresLoading = ref(false);
const createEncounterTheatreProceduresError = ref<string | null>(null);
const createComposerWorkspaceTab = ref<'note' | 'workflow'>('note');
const createEncounterCareTab = ref<CreateEncounterCareSectionId | ''>('');
const createAppointmentLinkSource = ref<CreateContextLinkSource>(
    queryParam('appointmentId') ? 'route' : 'none',
);
const createAdmissionLinkSource = ref<CreateContextLinkSource>(
    queryParam('admissionId') ? 'route' : 'none',
);
const createContextAutoLinkSuppressed = reactive({
    appointment: false,
    admission: false,
});
const canReadMedicalRecords = ref(false);
const canCreateMedicalRecords = ref(false);
const canFinalizeMedicalRecords = ref(false);
const canAmendMedicalRecords = ref(false);
const canArchiveMedicalRecords = ref(false);
const canAttestMedicalRecords = ref(false);
const canReadAppointments = ref(false);
const canManageAppointmentProviderSession = ref(false);
const canViewMedicalRecordAudit = ref(false);
const canReadLaboratoryOrders = ref(false);
const canCreateLaboratoryOrders = ref(false);
const canReadPharmacyOrders = ref(false);
const canCreatePharmacyOrders = ref(false);
const canReadRadiologyOrders = ref(false);
const canCreateRadiologyOrders = ref(false);
const canReadTheatreProcedures = ref(false);
const canCreateTheatreProcedures = ref(false);
const canReadBillingInvoices = ref(false);
const canCreateBillingInvoices = ref(false);
const { multiTenantIsolationEnabled } = usePlatformAccess();
const tenantIsolationEnabled = ref(multiTenantIsolationEnabled.value);
const currentUserId = computed<number | null>(() => {
    const normalized = Number(page.props.auth?.user?.id ?? 0);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
});
const auditActorTypeOptions = [
    { value: '', label: 'All actors' },
    { value: 'user', label: 'User only' },
    { value: 'system', label: 'System only' },
];
const medicalRecordAuditActionOptions = [
    { value: 'medical-record.created', label: 'Record Created' },
    { value: 'medical-record.updated', label: 'Record Updated' },
    { value: 'medical-record.status.updated', label: 'Status Updated' },
    { value: 'medical-record.signer-attested', label: 'Signer Attested' },
    { value: 'medical-record.document.pdf.downloaded', label: 'PDF Downloaded' },
] as const;
const showAdvancedRecordFilters = useLocalStorageBoolean(
    'opd.medicalRecords.filters.advanced',
    false,
);
const statusDialogOpen = ref(false);
const statusDialogRecord = ref<MedicalRecord | null>(null);
const statusDialogAction = ref<MedicalRecordStatusAction | null>(null);
const statusDialogReason = ref('');
const statusDialogError = ref<string | null>(null);
const filterSheetOpen = ref(false);
const mobileFiltersDrawerOpen = ref(false);
const expandedListRowIds = ref<Record<string, boolean>>({});
const detailsSheetOpen = ref(false);
const detailsSheetRecord = ref<MedicalRecord | null>(null);
const detailsSheetTab = ref<DetailsSheetTab>('overview');
const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditLogs = ref<MedicalRecordAuditLog[]>([]);
const detailsEncounterLaboratoryOrders = ref<LaboratoryOrder[]>([]);
const detailsEncounterLaboratoryOrdersLoading = ref(false);
const detailsEncounterLaboratoryOrdersError = ref<string | null>(null);
const detailsAppointmentReferrals = ref<AppointmentReferral[]>([]);
const detailsAppointmentReferralsLoading = ref(false);
const detailsAppointmentReferralsError = ref<string | null>(null);
const detailsEncounterPharmacyOrders = ref<PharmacyOrder[]>([]);
const detailsEncounterPharmacyOrdersLoading = ref(false);
const detailsEncounterPharmacyOrdersError = ref<string | null>(null);
const detailsEncounterRadiologyOrders = ref<RadiologyOrder[]>([]);
const detailsEncounterRadiologyOrdersLoading = ref(false);
const detailsEncounterRadiologyOrdersError = ref<string | null>(null);
const detailsEncounterTheatreProcedures = ref<TheatreProcedure[]>([]);
const detailsEncounterTheatreProceduresLoading = ref(false);
const detailsEncounterTheatreProceduresError = ref<string | null>(null);
const encounterLifecycleDialogOpen = ref(false);
const encounterLifecycleSubmitting = ref(false);
const encounterLifecycleError = ref<string | null>(null);
const encounterLifecycleTargetKind = ref<EncounterLifecycleTargetKind | null>(null);
const encounterLifecycleTargetId = ref('');
const encounterLifecycleAction = ref<EncounterLifecycleAction | null>(null);
const encounterLifecycleReason = ref('');
const detailsAuditMeta = ref<MedicalRecordAuditLogListResponse['meta'] | null>(
    null,
);
const detailsAuditExporting = ref(false);
const detailsVersionsLoading = ref(false);
const detailsVersionsError = ref<string | null>(null);
const detailsVersions = ref<MedicalRecordVersion[]>([]);
const detailsVersionsMeta = ref<
    MedicalRecordVersionListResponse['meta'] | null
>(null);
const detailsSelectedVersionId = ref('');
const detailsAgainstVersionId = ref('');
const detailsVersionDiffLoading = ref(false);
const detailsVersionDiffError = ref<string | null>(null);
const detailsVersionDiff = ref<MedicalRecordVersionDiff | null>(null);
const detailsAttestationsLoading = ref(false);
const detailsAttestationsError = ref<string | null>(null);
const detailsAttestations = ref<MedicalRecordSignerAttestation[]>([]);
const detailsAttestationsMeta = ref<
    MedicalRecordSignerAttestationListResponse['meta'] | null
>(null);
const detailsAttestationNote = ref('');
const detailsAttestationSubmitting = ref(false);
const detailsTimelineLoading = ref(false);
const detailsTimelineLoadingMore = ref(false);
const detailsTimelineError = ref<string | null>(null);
const detailsTimelineRecords = ref<MedicalRecord[]>([]);
const detailsTimelineMeta = ref<MedicalRecordListResponse['meta'] | null>(null);
const detailsTimelineExpandedRecordIds = ref<Record<string, boolean>>({});
const detailsTimelineAnchorRecordId = ref('');
const detailsTimelineEnsuringRecordId = ref('');
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

const today = new Date().toISOString().slice(0, 10);

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function queryDateParam(name: string, fallback = ''): string {
    const value = queryParam(name);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

const initialCreateRouteContext = {
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
    appointmentReferralId:
        queryParam('appointmentReferralId') || queryParam('referralId'),
    theatreProcedureId: queryParam('theatreProcedureId'),
    recordType: sanitizeMedicalRecordNoteType(
        queryParam('createRecordType')
        || (queryParam('tab') === 'new' ? queryParam('recordType') : ''),
    ),
    from: queryParam('from'),
};

const searchForm = reactive<SearchForm>({
    q: queryParam('q'),
    patientId: queryParam('patientId'),
    appointmentReferralId:
        queryParam('appointmentReferralId') || queryParam('referralId'),
    admissionId: queryParam('admissionId'),
    status: queryParam('status'),
    recordType: queryParam('recordType'),
    from: queryDateParam('from', today),
    to: queryDateParam('to'),
    perPage: 10,
    page: 1,
});

let searchDebounceTimer: number | null = null;
const pendingPatientLookupIds = new Set<string>();
let createAppointmentSummaryRequestId = 0;
let createAdmissionSummaryRequestId = 0;
let createContextSuggestionsRequestId = 0;
let createAppointmentReferralsRequestId = 0;
let detailsTimelineRequestId = 0;
let pendingCreateAppointmentLinkSource: CreateContextLinkSource | null = null;
let pendingCreateAdmissionLinkSource: CreateContextLinkSource | null = null;

function defaultEncounterAtLocal(): string {
    const local = new Date(
        Date.now() - new Date().getTimezoneOffset() * 60_000,
    );
    return local.toISOString().slice(0, 16);
}

const createForm = reactive<CreateForm>({
    patientId: initialCreateRouteContext.patientId,
    appointmentId: initialCreateRouteContext.appointmentId,
    admissionId: initialCreateRouteContext.admissionId,
    appointmentReferralId: initialCreateRouteContext.appointmentReferralId,
    theatreProcedureId: initialCreateRouteContext.theatreProcedureId,
    encounterAt: defaultEncounterAtLocal(),
    recordType: initialCreateRouteContext.recordType,
    diagnosisCode: '',
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
});

type CreateContextEditorTab = 'manual' | 'appointment' | 'admission';

function defaultCreateContextEditorTab(): CreateContextEditorTab {
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (appointmentId) return 'appointment';
    if (admissionId) return 'admission';
    return 'manual';
}

function syncCreatePatientContextLock() {
    createPatientContextLocked.value =
        (createContextEditorTab.value === 'appointment' &&
            createForm.appointmentId.trim() !== '') ||
        (createContextEditorTab.value === 'admission' &&
            createForm.admissionId.trim() !== '');
}

function setCreateContextEditorSource(
    source: CreateContextEditorTab,
    options?: { clearConflicting?: boolean },
) {
    createContextEditorTab.value = source;

    if (options?.clearConflicting) {
        if (source === 'manual') {
            clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
            clearCreateAdmissionLink({ suppressAuto: false, focusEditor: false });
        } else if (source === 'appointment') {
            clearCreateAdmissionLink({ suppressAuto: false, focusEditor: false });
        } else {
            clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
        }
    }

    syncCreatePatientContextLock();
}

const openedFromAppointments = queryParam('from') === 'appointments';
const consultationEntryAppointmentStatuses = new Set([
    'checked_in',
    'waiting_provider',
    'in_consultation',
]);
function normalizeAppointmentWorkflowStatus(status?: string | null): string {
    return status?.trim().toLowerCase() ?? '';
}
function isConsultationEntryAppointmentStatus(status?: string | null): boolean {
    return consultationEntryAppointmentStatuses.has(
        normalizeAppointmentWorkflowStatus(status),
    );
}
const medicalRecordStatusAuditAction = 'medical-record.status.updated';
const medicalRecordAttestationAuditAction = 'medical-record.signer-attested';

function appointmentReturnHref(
    appointmentId?: string | null,
    workflowStatus?: string | null,
): string {
    const selectedAppointmentId =
        (appointmentId ?? '').trim() || createForm.appointmentId.trim();
    if (!selectedAppointmentId) return '/appointments';

    const params = new URLSearchParams({
        focusAppointmentId: selectedAppointmentId,
    });
    const normalizedStatus = normalizeAppointmentWorkflowStatus(
        workflowStatus ?? createAppointmentSummary.value?.status ?? null,
    );
    if (
        normalizedStatus === 'scheduled' ||
        normalizedStatus === 'waiting_triage' ||
        normalizedStatus === 'waiting_provider' ||
        normalizedStatus === 'in_consultation' ||
        normalizedStatus === 'completed'
    ) {
        params.set('status', normalizedStatus);
    }

    return `/appointments?${params.toString()}`;
}

function shouldKeepAppointmentReturnContext(appointmentId?: string | null): boolean {
    return openedFromAppointments && (appointmentId ?? '').trim() !== '';
}

const createWorkflowLeaveBypassPaths = new Set([
    '/laboratory-orders',
    '/pharmacy-orders',
    '/radiology-orders',
    '/theatre-procedures',
    '/billing-invoices',
]);

function shouldBypassMedicalRecordsLeaveGuardForVisit(visit?: {
    url?: string | null;
} | null): boolean {
    if (!createPatientContextLocked.value) return false;

    const patientId = createForm.patientId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();
    if (!patientId || (!appointmentId && !admissionId) || !visit?.url) {
        return false;
    }

    let targetUrl: URL;
    try {
        targetUrl = new URL(visit.url, window.location.origin);
    } catch {
        return false;
    }

    if (!createWorkflowLeaveBypassPaths.has(targetUrl.pathname)) {
        return false;
    }

    if ((targetUrl.searchParams.get('patientId') ?? '').trim() !== patientId) {
        return false;
    }

    if (appointmentId) {
        if (
            (targetUrl.searchParams.get('appointmentId') ?? '').trim() !==
            appointmentId
        ) {
            return false;
        }
    } else if (
        (targetUrl.searchParams.get('admissionId') ?? '').trim() !== admissionId
    ) {
        return false;
    }

    const activeRecordId = queryParam('recordId').trim();
    if (
        activeRecordId &&
        (targetUrl.searchParams.get('recordId') ?? '').trim() !== activeRecordId
    ) {
        return false;
    }

    if ((targetUrl.searchParams.get('tab') ?? '').trim() === 'queue') {
        return false;
    }

    return true;
}

function contextCreateHref(
    path: string,
    options?: {
        includeTabNew?: boolean;
        reorderOfId?: string | null;
        addOnToOrderId?: string | null;
    },
) {
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
    if (options?.reorderOfId?.trim()) params.set('reorderOfId', options.reorderOfId.trim());
    if (options?.addOnToOrderId?.trim()) params.set('addOnToOrderId', options.addOnToOrderId.trim());
    if (shouldKeepAppointmentReturnContext(appointmentId)) {
        params.set('from', 'appointments');
    }

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

const openedFromAppointmentContext = computed(
    () =>
        createForm.patientId.trim() !== '' &&
        createForm.appointmentId.trim() !== '',
);
const createPatientContextLocked = ref(false);
const chartFocusSelectorOpen = ref(false);
const chartFocusDraftPatientId = ref(searchForm.patientId.trim());
const createContextEditorOpen = ref(createForm.patientId.trim() === '');
const createContextEditorInitialSelection = reactive({
    patientId: createForm.patientId.trim(),
    appointmentId: createForm.appointmentId.trim(),
    admissionId: createForm.admissionId.trim(),
    appointmentReferralId: createForm.appointmentReferralId.trim(),
    theatreProcedureId: createForm.theatreProcedureId.trim(),
    recordType: sanitizeMedicalRecordNoteType(createForm.recordType),
});
const createContextEditorTab = ref<CreateContextEditorTab>(
    defaultCreateContextEditorTab(),
);
syncCreatePatientContextLock();
const initialMedicalRecordTab = queryParam('tab');
const initialTimelineRecordId = queryParam('recordId');
const _initialConsultationEntryContext =
    initialCreateRouteContext.appointmentId.trim() !== '' ||
    initialCreateRouteContext.admissionId.trim() !== '' ||
    initialCreateRouteContext.appointmentReferralId.trim() !== '' ||
    initialCreateRouteContext.theatreProcedureId.trim() !== '' ||
    initialCreateRouteContext.recordType !== 'consultation_note' ||
    openedFromAppointments;
const hasInitialConsultationEntryContext = computed(() => {
    if (!_initialConsultationEntryContext) return false;
    const appointmentStatus = createAppointmentSummary.value?.status;
    if (appointmentStatus && !isConsultationEntryAppointmentStatus(appointmentStatus)) return false;
    return true;
});
const medicalRecordTab = ref<'new' | 'list'>(
    initialMedicalRecordTab === 'new'
        ? _initialConsultationEntryContext
            ? 'new'
            : 'list'
        : initialMedicalRecordTab === 'list'
          ? 'list'
          : openedFromAppointmentContext.value
            ? 'new'
            : 'list',
);

if (createForm.patientId) {
    searchForm.patientId = createForm.patientId;
}


function cloneCreateForm(): CreateForm {
    return {
        patientId: createForm.patientId,
        appointmentId: createForm.appointmentId,
        admissionId: createForm.admissionId,
        appointmentReferralId: createForm.appointmentReferralId,
        theatreProcedureId: createForm.theatreProcedureId,
        encounterAt: createForm.encounterAt,
        recordType: createForm.recordType,
        diagnosisCode: createForm.diagnosisCode,
        subjective: createForm.subjective,
        objective: createForm.objective,
        assessment: createForm.assessment,
        plan: createForm.plan,
    };
}

function buildMedicalRecordCreateDraftPayload(): MedicalRecordCreateDraftPayload {
    return {
        version: 1,
        savedAt: new Date().toISOString(),
        form: cloneCreateForm(),
    };
}

function hasPersistableCreateDraftPayload(
    payload: MedicalRecordCreateDraftPayload | null,
): boolean {
    if (!payload) return false;

    const form = payload.form;
    return Boolean(
        form.patientId.trim() ||
            form.appointmentId.trim() ||
            form.admissionId.trim() ||
            form.appointmentReferralId.trim() ||
            form.theatreProcedureId.trim() ||
            form.recordType.trim() !== 'consultation_note' ||
            form.diagnosisCode.trim() ||
            form.subjective.trim() ||
            form.objective.trim() ||
            form.assessment.trim() ||
            form.plan.trim(),
    );
}

function hasClinicalCreateDraftPayload(
    payload: MedicalRecordCreateDraftPayload | null,
): boolean {
    if (!payload) return false;

    const form = payload.form;
    return Boolean(
        form.recordType.trim() !== 'consultation_note' ||
            form.diagnosisCode.trim() ||
            form.subjective.trim() ||
            form.objective.trim() ||
            form.assessment.trim() ||
            form.plan.trim(),
    );
}

function clearMedicalRecordCreateDraftAutosaveTimer() {
    if (createDraftAutosaveTimer !== null) {
        window.clearTimeout(createDraftAutosaveTimer);
        createDraftAutosaveTimer = null;
    }
}

function persistMedicalRecordCreateDraftNow() {
    if (typeof window === 'undefined') return;

    createDraftAutosaving.value = false;
    const payload = buildMedicalRecordCreateDraftPayload();

    if (!hasPersistableCreateDraftPayload(payload)) {
        window.localStorage.removeItem(MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY);
        createDraftLastSavedAt.value = null;
        createDraftAutosaving.value = false;
        return;
    }

    window.localStorage.setItem(
        MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY,
        JSON.stringify(payload),
    );
    createDraftLastSavedAt.value = payload.savedAt;
    createDraftRecoveryAvailable.value = false;
}

function scheduleMedicalRecordCreateDraftAutosave() {
    if (typeof window === 'undefined') return;

    clearMedicalRecordCreateDraftAutosaveTimer();
    createDraftAutosaving.value = true;
    createDraftAutosaveTimer = window.setTimeout(() => {
        persistMedicalRecordCreateDraftNow();
        createDraftAutosaveTimer = null;
    }, 500);
}

function readStoredMedicalRecordCreateDraft(): MedicalRecordCreateDraftPayload | null {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(
        MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY,
    );
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as MedicalRecordCreateDraftPayload;
        if (!hasPersistableCreateDraftPayload(parsed)) {
            window.localStorage.removeItem(
                MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY,
            );
            return null;
        }

        return parsed;
    } catch {
        window.localStorage.removeItem(MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY);
        return null;
    }
}

function applyMedicalRecordCreateDraft(
    payload: MedicalRecordCreateDraftPayload,
    options?: { markRecovered?: boolean },
) {
    createForm.patientId = payload.form.patientId;
    createForm.appointmentId = payload.form.appointmentId;
    createForm.admissionId = payload.form.admissionId;
    createForm.appointmentReferralId =
        payload.form.appointmentReferralId ?? '';
    createForm.theatreProcedureId = payload.form.theatreProcedureId ?? '';
    createForm.encounterAt = payload.form.encounterAt || defaultEncounterAtLocal();
    createForm.recordType = sanitizeMedicalRecordNoteType(
        payload.form.recordType,
    );
    createForm.diagnosisCode = payload.form.diagnosisCode;
    createForm.subjective = payload.form.subjective;
    createForm.objective = payload.form.objective;
    createForm.assessment = payload.form.assessment;
    createForm.plan = payload.form.plan;
    createDraftLastSavedAt.value = payload.savedAt;
    createDraftRecoverySavedAt.value = payload.savedAt;
    createDraftRecoveryAvailable.value = false;
    createDraftRecovered.value = Boolean(options?.markRecovered);
    createComposerWorkspaceTab.value = 'note';
    createEncounterCareTab.value = '';
    createContextEditorOpen.value = createForm.patientId.trim() === '';
    createContextEditorTab.value = defaultCreateContextEditorTab();
    syncCreatePatientContextLock();
    resetCreateMessages();
}

function resetMedicalRecordCreateComposerToInitialState() {
    createContextAutoLinkSuppressed.appointment = false;
    createContextAutoLinkSuppressed.admission = false;

    createForm.patientId = createContextEditorInitialSelection.patientId;
    pendingCreateAppointmentLinkSource = createContextEditorInitialSelection.appointmentId
        ? 'route'
        : 'none';
    createForm.appointmentId = createContextEditorInitialSelection.appointmentId;
    pendingCreateAdmissionLinkSource = createContextEditorInitialSelection.admissionId
        ? 'route'
        : 'none';
    createForm.admissionId = createContextEditorInitialSelection.admissionId;
    createForm.appointmentReferralId =
        createContextEditorInitialSelection.appointmentReferralId;
    createForm.theatreProcedureId =
        createContextEditorInitialSelection.theatreProcedureId;
    createForm.encounterAt = defaultEncounterAtLocal();
    createForm.recordType = createContextEditorInitialSelection.recordType;
    createForm.diagnosisCode = '';
    createForm.subjective = '';
    createForm.objective = '';
    createForm.assessment = '';
    createForm.plan = '';
    createComposerWorkspaceTab.value = 'note';
    createEncounterCareTab.value = '';
    createContextEditorOpen.value = createForm.patientId.trim() === '';
    createContextEditorTab.value = defaultCreateContextEditorTab();
    syncCreatePatientContextLock();
    createDraftRecovered.value = false;
    resetCreateMessages();
}

function setCreateComposerBaseline(selection?: {
    patientId?: string;
    appointmentId?: string;
    admissionId?: string;
    appointmentReferralId?: string;
    theatreProcedureId?: string;
    recordType?: string;
}) {
    createContextEditorInitialSelection.patientId =
        selection?.patientId?.trim() ?? '';
    createContextEditorInitialSelection.appointmentId =
        selection?.appointmentId?.trim() ?? '';
    createContextEditorInitialSelection.admissionId =
        selection?.admissionId?.trim() ?? '';
    createContextEditorInitialSelection.appointmentReferralId =
        selection?.appointmentReferralId?.trim() ?? '';
    createContextEditorInitialSelection.theatreProcedureId =
        selection?.theatreProcedureId?.trim() ?? '';
    createContextEditorInitialSelection.recordType = sanitizeMedicalRecordNoteType(
        selection?.recordType,
    );
}

function discardStoredMedicalRecordCreateDraft(options?: {
    resetComposer?: boolean;
}) {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY);
    }
    clearMedicalRecordCreateDraftAutosaveTimer();
    createDraftRecoveryAvailable.value = false;
    createDraftRecovered.value = false;
    createDraftRecoverySavedAt.value = null;
    createDraftLastSavedAt.value = null;
    createDraftAutosaving.value = false;

    if (options?.resetComposer) {
        resetMedicalRecordCreateComposerToInitialState();
    }
}

function restoreStoredMedicalRecordCreateDraft() {
    const payload = readStoredMedicalRecordCreateDraft();
    if (!payload) return;

    applyMedicalRecordCreateDraft(payload, { markRecovered: true });
    if (medicalRecordTab.value !== 'new') {
        setMedicalRecordView('new');
    }
}

function initializeMedicalRecordCreateDraftRecovery() {
    const payload = readStoredMedicalRecordCreateDraft();
    if (!payload || !hasClinicalCreateDraftPayload(payload)) return;

    createDraftRecoverySavedAt.value = payload.savedAt;
    createDraftLastSavedAt.value = payload.savedAt;

    const hasRouteLinkedContext = Boolean(
        createContextEditorInitialSelection.patientId ||
            createContextEditorInitialSelection.appointmentId ||
            createContextEditorInitialSelection.admissionId ||
            createContextEditorInitialSelection.appointmentReferralId ||
            createContextEditorInitialSelection.theatreProcedureId ||
            createContextEditorInitialSelection.recordType !== 'consultation_note',
    );

    createDraftRecoveryAvailable.value = !hasRouteLinkedContext;
}

function finishMedicalRecordWorkspaceView(
    view: 'list' | 'new',
    options?: { focusSearch?: boolean },
) {
    setMedicalRecordView(view);

    void nextTick(() => {
        if (view === 'new') return;

        scrollToConsultationRecords({ focusSearch: options?.focusSearch });
    });
}

type RouterVisitOptions = Parameters<typeof router.visit>[1];

function visitWithoutMedicalRecordsLeaveGuard(
    url: string,
    options?: RouterVisitOptions,
) {
    const onFinish = options?.onFinish;
    bypassMedicalRecordsNavigationGuard = true;

    router.visit(url, {
        ...options,
        onFinish: (visit) => {
            bypassMedicalRecordsNavigationGuard = false;
            onFinish?.(visit);
        },
    });
}

function confirmMedicalRecordsNavigationLeave() {
    const visit = pendingMedicalRecordsVisit.value;
    const workspaceClose = pendingMedicalRecordsWorkspaceClose.value;
    createLeaveConfirmOpen.value = false;
    pendingMedicalRecordsVisit.value = null;
    pendingMedicalRecordsWorkspaceClose.value = null;

    if (visit) {
        visitWithoutMedicalRecordsLeaveGuard(visit.url, visit);
        return;
    }

    if (workspaceClose) {
        finishMedicalRecordWorkspaceView('list', workspaceClose);
    }
}

function cancelMedicalRecordsNavigationLeave() {
    createLeaveConfirmOpen.value = false;
    pendingMedicalRecordsVisit.value = null;
    pendingMedicalRecordsWorkspaceClose.value = null;
}

function detailsSheetTabFromUrl(recordId?: string | null): DetailsSheetTab {
    const normalizedRecordId = (recordId ?? '').trim();
    if (!normalizedRecordId) return 'overview';
    if (queryParam('recordId').trim() !== normalizedRecordId) {
        return 'overview';
    }

    const requestedTab = queryParam('detailsTab').trim();
    if (requestedTab === 'audit' && canViewMedicalRecordAudit.value) {
        return 'audit';
    }
    if (requestedTab === 'timeline') {
        return 'timeline';
    }

    return 'overview';
}

function syncMedicalRecordUrlState() {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', medicalRecordTab.value);

    if (detailsSheetOpen.value && detailsSheetRecord.value?.id) {
        url.searchParams.set('recordId', detailsSheetRecord.value.id);
        if (detailsSheetTab.value !== 'overview') {
            url.searchParams.set('detailsTab', detailsSheetTab.value);
        } else {
            url.searchParams.delete('detailsTab');
        }
    } else {
        url.searchParams.delete('recordId');
        url.searchParams.delete('detailsTab');
    }

    window.history.replaceState({}, '', url.toString());
}

function setMedicalRecordView(view: 'list' | 'new') {
    medicalRecordTab.value = view;
    syncMedicalRecordUrlState();
}

function openMedicalRecordWorkspace(
    view: 'list' | 'new',
    options?: { focusSearch?: boolean },
) {
    finishMedicalRecordWorkspaceView(view, options);
}

function openChartFocusSelector() {
    chartFocusDraftPatientId.value = searchForm.patientId.trim();
    chartFocusSelectorOpen.value = true;
}

function applyChartFocus(patientId?: string) {
    const normalizedId = (patientId ?? chartFocusDraftPatientId.value).trim();
    if (!normalizedId) return;

    chartFocusDraftPatientId.value = normalizedId;
    chartFocusSelectorOpen.value = false;
    router.visit(
        patientChartHref(normalizedId, {
            tab: 'records',
            from: 'medical-records',
        }),
    );
}

function clearChartFocus() {
    chartFocusDraftPatientId.value = '';
    if (!searchForm.patientId.trim()) {
        chartFocusSelectorOpen.value = false;
        return;
    }

    searchForm.patientId = '';
    searchForm.page = 1;
    chartFocusSelectorOpen.value = false;
    void Promise.all([loadRecords(), loadRecordStatusCounts()]);
}

function consultationEntryAppointmentsHref(patientId?: string | null): string {
    const params = new URLSearchParams();
    const normalizedPatientId = (patientId ?? '').trim();

    if (normalizedPatientId) {
        params.set('patientId', normalizedPatientId);
    }

    params.set('from', 'medical-records');
    const queryString = params.toString();
    return queryString ? `/appointments?${queryString}` : '/appointments';
}

function beginNewConsultationWorkspace(options?: {
    preferFocusedPatient?: boolean;
}) {
    if (!canCreateMedicalRecords.value) {
        notifyError(
            'Consultation authoring requires medical record create access.',
        );
        return;
    }

    const routeAppointmentId = initialCreateRouteContext.appointmentId.trim();
    const routeAdmissionId = initialCreateRouteContext.admissionId.trim();

    if (routeAppointmentId || routeAdmissionId || openedFromAppointments) {
        setCreateComposerBaseline(initialCreateRouteContext);
        resetMedicalRecordCreateComposerToInitialState();
        openMedicalRecordWorkspace('new');
        return;
    }

    const focusedPatientId = options?.preferFocusedPatient
        ? searchForm.patientId.trim()
        : searchForm.patientId.trim() || initialCreateRouteContext.patientId.trim();

    if (!canReadAppointments.value) {
        notifyError(
            'Appointments access is required to launch consultation entry from the schedule.',
        );
        return;
    }

    router.visit(consultationEntryAppointmentsHref(focusedPatientId));
}
function scrollToConsultationRecords(options?: { focusSearch?: boolean }) {
    document
        .getElementById('consultation-records-list')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (!options?.focusSearch) return;

    window.setTimeout(() => {
        document.getElementById('mr-q')?.focus({ preventScroll: true });
    }, 120);
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
        query?: Record<string, string | number | null | undefined>;
        body?: Record<string, unknown>;
    },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);

    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
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

function isForbiddenError(error: unknown): boolean {
    return Boolean((error as { status?: number } | null)?.status === 403);
}

type ApiRequestError = Error & {
    status?: number;
    payload?: ValidationErrorResponse;
};

function consultationOwnerUserIdFromPayload(
    payload?: ValidationErrorResponse,
): number | null {
    const normalized = Number(payload?.context?.consultationOwnerUserId ?? 0);
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

function normalizeLocalDateTimeForApi(value: string): string {
    if (!value) return value;
    const normalized = value.replace('T', ' ');
    return normalized.length === 16 ? `${normalized}:00` : normalized;
}

function createFieldError(key: string): string | null {
    return createErrors.value[key]?.[0] ?? null;
}

function laboratoryOrderStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'ordered':
        case 'collected':
        case 'in_progress':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function pharmacyOrderStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'pending':
        case 'in_preparation':
        case 'partially_dispensed':
            return 'default';
        case 'dispensed':
        case 'reconciliation_completed':
            return 'secondary';
        case 'cancelled':
        case 'reconciliation_exception':
            return 'destructive';
        default:
            return 'outline';
    }
}

function pharmacyOrderSummaryText(order: PharmacyOrder): string {
    if ((order.dosageInstruction ?? '').trim() !== '') {
        return order.dosageInstruction as string;
    }

    if ((order.dispensedAt ?? '').trim() !== '') {
        return `Dispensed ${formatDateTime(order.dispensedAt)}`;
    }

    return 'Awaiting pharmacy preparation.';
}

function pharmacyOrderQuantityLabel(
    quantity: string | number | null | undefined,
): string | null {
    if (quantity === null || quantity === undefined) return null;

    const normalized = String(quantity).trim();
    if (normalized === '') return null;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return `Qty ${normalized}`;

    return `Qty ${Number.isInteger(parsed) ? parsed.toString() : parsed.toString()}`;
}

function radiologyOrderStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'ordered':
        case 'scheduled':
        case 'in_progress':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function radiologyOrderSummaryText(order: RadiologyOrder): string {
    if ((order.reportSummary ?? '').trim() !== '') {
        return order.reportSummary as string;
    }

    if ((order.modality ?? '').trim() !== '') {
        return `Modality: ${formatEnumLabel(order.modality)}`;
    }

    if ((order.completedAt ?? '').trim() !== '') {
        return `Reported ${formatDateTime(order.completedAt)}`;
    }

    return 'Awaiting imaging scheduling or execution.';
}

function theatreProcedureStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'planned':
        case 'in_preop':
        case 'in_progress':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function theatreProcedureSummaryText(procedure: TheatreProcedure): string {
    if ((procedure.statusReason ?? '').trim() !== '') {
        return procedure.statusReason as string;
    }

    if ((procedure.notes ?? '').trim() !== '') {
        return procedure.notes as string;
    }

    if ((procedure.theatreRoomName ?? '').trim() !== '') {
        return `Room: ${procedure.theatreRoomName}`;
    }

    if ((procedure.completedAt ?? '').trim() !== '') {
        return `Completed ${formatDateTime(procedure.completedAt)}`;
    }

    return 'Awaiting theatre scheduling and procedure progression.';
}

function appointmentReferralStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'requested':
        case 'accepted':
        case 'in_progress':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'rejected':
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function appointmentReferralPriorityVariant(priority: string | null | undefined) {
    switch ((priority ?? '').toLowerCase()) {
        case 'urgent':
        case 'emergency':
        case 'stat':
            return 'destructive';
        case 'high':
            return 'default';
        case 'routine':
            return 'secondary';
        default:
            return 'outline';
    }
}

function appointmentReferralDestinationText(referral: AppointmentReferral): string {
    const department = (referral.targetDepartment ?? '').trim();
    const facility = (referral.targetFacilityName ?? '').trim();

    if (department && facility) {
        return `${department} | ${facility}`;
    }

    return department || facility || 'Receiving team pending';
}

function appointmentReferralSummaryText(referral: AppointmentReferral): string {
    if ((referral.referralReason ?? '').trim() !== '') {
        return referral.referralReason as string;
    }

    if ((referral.clinicalNotes ?? '').trim() !== '') {
        return referral.clinicalNotes as string;
    }

    if ((referral.handoffNotes ?? '').trim() !== '') {
        return referral.handoffNotes as string;
    }

    if ((referral.statusReason ?? '').trim() !== '') {
        return referral.statusReason as string;
    }

    if ((referral.handedOffAt ?? '').trim() !== '') {
        return `Handed off ${formatDateTime(referral.handedOffAt)}`;
    }

    if ((referral.completedAt ?? '').trim() !== '') {
        return `Completed ${formatDateTime(referral.completedAt)}`;
    }

    if ((referral.acceptedAt ?? '').trim() !== '') {
        return `Accepted ${formatDateTime(referral.acceptedAt)}`;
    }

    if ((referral.requestedAt ?? '').trim() !== '') {
        return `Requested ${formatDateTime(referral.requestedAt)}`;
    }

    return 'Referral handoff remains linked to this encounter.';
}

function appointmentReferralTimingText(referral: AppointmentReferral): string {
    const parts = [
        (referral.requestedAt ?? '').trim() !== ''
            ? `Requested ${formatDateTime(referral.requestedAt)}`
            : null,
        (referral.acceptedAt ?? '').trim() !== ''
            ? `Accepted ${formatDateTime(referral.acceptedAt)}`
            : null,
        (referral.handedOffAt ?? '').trim() !== ''
            ? `Handed off ${formatDateTime(referral.handedOffAt)}`
            : null,
        (referral.completedAt ?? '').trim() !== ''
            ? `Completed ${formatDateTime(referral.completedAt)}`
            : null,
    ].filter(Boolean);

    return parts.join(' | ') || 'Awaiting referral progression.';
}

function appointmentReferralFocusHref(
    appointmentId?: string | null,
    options?: {
        patientId?: string | null;
        referralId?: string | null;
    },
): string {
    const normalizedAppointmentId = (appointmentId ?? '').trim();
    if (!normalizedAppointmentId) return '/appointments';

    const params = new URLSearchParams();
    const patientId = (options?.patientId ?? '').trim();
    const referralId = (options?.referralId ?? '').trim();

    if (patientId) params.set('patientId', patientId);
    params.set('focusAppointmentId', normalizedAppointmentId);
    params.set('detailsTab', 'referrals');
    if (referralId) params.set('openReferralId', referralId);

    return `/appointments?${params.toString()}`;
}

async function requestAppointmentReferrals(
    appointmentId?: string | null,
): Promise<AppointmentReferral[]> {
    const normalizedAppointmentId = (appointmentId ?? '').trim();
    if (!normalizedAppointmentId) return [];

    const response = await apiRequest<AppointmentReferralListResponse>(
        'GET',
        `/appointments/${normalizedAppointmentId}/referrals`,
        {
            query: { perPage: 50, page: 1 },
        },
    );

    return response.data ?? [];
}

function theatreProcedureFocusHref(
    procedureId?: string | null,
    options?: {
        patientId?: string | null;
        appointmentId?: string | null;
        admissionId?: string | null;
        recordId?: string | null;
        focusWorkflowActionKey?: string | null;
    },
): string {
    const normalizedProcedureId = (procedureId ?? '').trim();
    if (!normalizedProcedureId) return '/theatre-procedures';

    const params = new URLSearchParams();
    const patientId = (options?.patientId ?? '').trim();
    const appointmentId = (options?.appointmentId ?? '').trim();
    const admissionId = (options?.admissionId ?? '').trim();
    const recordId =
        (options?.recordId ?? '').trim() || queryParam('recordId').trim();
    const focusWorkflowActionKey =
        (options?.focusWorkflowActionKey ?? '').trim();

    if (patientId) params.set('patientId', patientId);
    if (appointmentId) params.set('appointmentId', appointmentId);
    if (admissionId) params.set('admissionId', admissionId);
    if (recordId) params.set('recordId', recordId);
    params.set('focusProcedureId', normalizedProcedureId);
    if (focusWorkflowActionKey) {
        params.set('focusWorkflowActionKey', focusWorkflowActionKey);
    }

    return `/theatre-procedures?${params.toString()}`;
}

async function requestEncounterLaboratoryOrders(filters: {
    patientId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
}): Promise<LaboratoryOrder[]> {
    const patientId = filters.patientId?.trim() ?? '';
    const appointmentId = filters.appointmentId?.trim() ?? '';
    const admissionId = filters.admissionId?.trim() ?? '';

    if (!patientId || (!appointmentId && !admissionId)) {
        return [];
    }

    const response = await apiRequest<LinkedContextListResponse<LaboratoryOrder>>(
        'GET',
        '/laboratory-orders',
        {
            query: {
                patientId,
                appointmentId: appointmentId || null,
                admissionId: admissionId || null,
                sortBy: 'orderedAt',
                sortDir: 'desc',
                perPage: 6,
            },
        },
    );

    return response.data ?? [];
}

async function requestEncounterPharmacyOrders(filters: {
    patientId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
}): Promise<PharmacyOrder[]> {
    const patientId = filters.patientId?.trim() ?? '';
    const appointmentId = filters.appointmentId?.trim() ?? '';
    const admissionId = filters.admissionId?.trim() ?? '';

    if (!patientId || (!appointmentId && !admissionId)) {
        return [];
    }

    const response = await apiRequest<LinkedContextListResponse<PharmacyOrder>>(
        'GET',
        '/pharmacy-orders',
        {
            query: {
                patientId,
                appointmentId: appointmentId || null,
                admissionId: admissionId || null,
                sortBy: 'orderedAt',
                sortDir: 'desc',
                perPage: 6,
            },
        },
    );

    return response.data ?? [];
}

async function requestEncounterRadiologyOrders(filters: {
    patientId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
}): Promise<RadiologyOrder[]> {
    const patientId = filters.patientId?.trim() ?? '';
    const appointmentId = filters.appointmentId?.trim() ?? '';
    const admissionId = filters.admissionId?.trim() ?? '';

    if (!patientId || (!appointmentId && !admissionId)) {
        return [];
    }

    const response = await apiRequest<LinkedContextListResponse<RadiologyOrder>>(
        'GET',
        '/radiology-orders',
        {
            query: {
                patientId,
                appointmentId: appointmentId || null,
                admissionId: admissionId || null,
                sortBy: 'orderedAt',
                sortDir: 'desc',
                perPage: 6,
            },
        },
    );

    return response.data ?? [];
}

async function requestEncounterTheatreProcedures(filters: {
    patientId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
}): Promise<TheatreProcedure[]> {
    const patientId = filters.patientId?.trim() ?? '';
    const appointmentId = filters.appointmentId?.trim() ?? '';
    const admissionId = filters.admissionId?.trim() ?? '';

    if (!patientId || (!appointmentId && !admissionId)) {
        return [];
    }

    const response = await apiRequest<LinkedContextListResponse<TheatreProcedure>>(
        'GET',
        '/theatre-procedures',
        {
            query: {
                patientId,
                appointmentId: appointmentId || null,
                admissionId: admissionId || null,
                sortBy: 'scheduledAt',
                sortDir: 'desc',
                perPage: 6,
            },
        },
    );

    return response.data ?? [];
}

function resetCreateMessages() {
    createMessage.value = null;
    createErrors.value = {};
}

function setCreateAppointmentLink(
    value: string,
    source: CreateContextLinkSource,
) {
    pendingCreateAppointmentLinkSource = source;
    createForm.appointmentId = value;
}

function setCreateAdmissionLink(
    value: string,
    source: CreateContextLinkSource,
) {
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

async function hydratePatientSummary(patientId: string) {
    const normalizedId = patientId.trim();
    if (!normalizedId) return;
    if (
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
    } catch {
        // Non-blocking. The consultation form can still be used without the summary card.
    } finally {
        pendingPatientLookupIds.delete(normalizedId);
    }
}

function unlockCreatePatientContext() {
    clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
    clearCreateAdmissionLink({ suppressAuto: false, focusEditor: false });
    setCreateContextEditorSource('manual');
    createContextEditorOpen.value = true;
}

function openCreateContextEditor(tab: CreateContextEditorTab) {
    setCreateContextEditorSource(tab);
    createContextEditorOpen.value = true;
}

function closeCreateContextEditorAfterSelection(
    kind: 'patientId' | 'appointmentId' | 'admissionId',
    selected: { id: string } | null,
) {
    if (!createContextEditorOpen.value || !selected) return;

    const nextId = selected.id?.trim?.() ?? '';
    if (!nextId) return;

    createContextEditorOpen.value = false;
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
        openCreateContextEditor('appointment');
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
        openCreateContextEditor('admission');
    }
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
    if (options?.focusEditor) {
        openCreateContextEditor('appointment');
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
    if (options?.focusEditor) {
        openCreateContextEditor('admission');
    }
}

function maybeAutoLinkCreateContextSuggestions() {
    if (createContextEditorTab.value === 'manual') {
        return;
    }

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
                    perPage: 6,
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
                isConsultationEntryAppointmentStatus(appointment.status),
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

let createEncounterLaboratoryOrdersRequestId = 0;
let createEncounterPharmacyOrdersRequestId = 0;
let createEncounterRadiologyOrdersRequestId = 0;
let createEncounterTheatreProceduresRequestId = 0;

async function loadCreateEncounterLaboratoryOrders() {
    const patientId = createForm.patientId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (
        !canReadLaboratoryOrders.value
        || !patientId
        || (!appointmentId && !admissionId)
    ) {
        createEncounterLaboratoryOrders.value = [];
        createEncounterLaboratoryOrdersError.value = null;
        createEncounterLaboratoryOrdersLoading.value = false;
        return;
    }

    const requestId = ++createEncounterLaboratoryOrdersRequestId;
    createEncounterLaboratoryOrdersLoading.value = true;
    createEncounterLaboratoryOrdersError.value = null;

    try {
        const orders = await requestEncounterLaboratoryOrders({
            patientId,
            appointmentId,
            admissionId,
        });

        if (requestId !== createEncounterLaboratoryOrdersRequestId) return;
        createEncounterLaboratoryOrders.value = orders;
    } catch (error) {
        if (requestId !== createEncounterLaboratoryOrdersRequestId) return;
        createEncounterLaboratoryOrders.value = [];
        createEncounterLaboratoryOrdersError.value = messageFromUnknown(
            error,
            'Unable to load linked laboratory orders.',
        );
    } finally {
        if (requestId === createEncounterLaboratoryOrdersRequestId) {
            createEncounterLaboratoryOrdersLoading.value = false;
        }
    }
}

async function loadCreateEncounterPharmacyOrders() {
    const patientId = createForm.patientId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (
        !canReadPharmacyOrders.value
        || !patientId
        || (!appointmentId && !admissionId)
    ) {
        createEncounterPharmacyOrders.value = [];
        createEncounterPharmacyOrdersError.value = null;
        createEncounterPharmacyOrdersLoading.value = false;
        return;
    }

    const requestId = ++createEncounterPharmacyOrdersRequestId;
    createEncounterPharmacyOrdersLoading.value = true;
    createEncounterPharmacyOrdersError.value = null;

    try {
        const orders = await requestEncounterPharmacyOrders({
            patientId,
            appointmentId,
            admissionId,
        });

        if (requestId !== createEncounterPharmacyOrdersRequestId) return;
        createEncounterPharmacyOrders.value = orders;
    } catch (error) {
        if (requestId !== createEncounterPharmacyOrdersRequestId) return;
        createEncounterPharmacyOrders.value = [];
        createEncounterPharmacyOrdersError.value = messageFromUnknown(
            error,
            'Unable to load linked pharmacy orders.',
        );
    } finally {
        if (requestId === createEncounterPharmacyOrdersRequestId) {
            createEncounterPharmacyOrdersLoading.value = false;
        }
    }
}

async function loadCreateEncounterRadiologyOrders() {
    const patientId = createForm.patientId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (
        !canReadRadiologyOrders.value
        || !patientId
        || (!appointmentId && !admissionId)
    ) {
        createEncounterRadiologyOrders.value = [];
        createEncounterRadiologyOrdersError.value = null;
        createEncounterRadiologyOrdersLoading.value = false;
        return;
    }

    const requestId = ++createEncounterRadiologyOrdersRequestId;
    createEncounterRadiologyOrdersLoading.value = true;
    createEncounterRadiologyOrdersError.value = null;

    try {
        const orders = await requestEncounterRadiologyOrders({
            patientId,
            appointmentId,
            admissionId,
        });

        if (requestId !== createEncounterRadiologyOrdersRequestId) return;
        createEncounterRadiologyOrders.value = orders;
    } catch (error) {
        if (requestId !== createEncounterRadiologyOrdersRequestId) return;
        createEncounterRadiologyOrders.value = [];
        createEncounterRadiologyOrdersError.value = messageFromUnknown(
            error,
            'Unable to load linked imaging orders.',
        );
    } finally {
        if (requestId === createEncounterRadiologyOrdersRequestId) {
            createEncounterRadiologyOrdersLoading.value = false;
        }
    }
}

async function loadCreateEncounterTheatreProcedures() {
    const patientId = createForm.patientId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (
        !canReadTheatreProcedures.value
        || !patientId
        || (!appointmentId && !admissionId)
    ) {
        createEncounterTheatreProcedures.value = [];
        createEncounterTheatreProceduresError.value = null;
        createEncounterTheatreProceduresLoading.value = false;
        return;
    }

    const requestId = ++createEncounterTheatreProceduresRequestId;
    createEncounterTheatreProceduresLoading.value = true;
    createEncounterTheatreProceduresError.value = null;

    try {
        const procedures = await requestEncounterTheatreProcedures({
            patientId,
            appointmentId,
            admissionId,
        });

        if (requestId !== createEncounterTheatreProceduresRequestId) return;
        createEncounterTheatreProcedures.value = procedures;
    } catch (error) {
        if (requestId !== createEncounterTheatreProceduresRequestId) return;
        createEncounterTheatreProcedures.value = [];
        createEncounterTheatreProceduresError.value = messageFromUnknown(
            error,
            'Unable to load linked theatre procedures.',
        );
    } finally {
        if (requestId === createEncounterTheatreProceduresRequestId) {
            createEncounterTheatreProceduresLoading.value = false;
        }
    }
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

async function loadMedicalRecordPermissions() {
    try {
        const response = await apiRequest<AuthPermissionsResponse>(
            'GET',
            '/auth/me/permissions',
        );
        const names = new Set(
            (response.data ?? [])
                .map((permission) => permission.name?.trim())
                .filter((name): name is string => Boolean(name)),
        );
        canReadMedicalRecords.value = names.has('medical.records.read');
        canCreateMedicalRecords.value = names.has('medical.records.create');
        canFinalizeMedicalRecords.value = names.has('medical.records.finalize');
        canAmendMedicalRecords.value = names.has('medical.records.amend');
        canArchiveMedicalRecords.value = names.has('medical.records.archive');
        canAttestMedicalRecords.value = names.has('medical.records.attest');
        canReadAppointments.value = names.has('appointments.read');
        canManageAppointmentProviderSession.value = names.has(
            'appointments.manage-provider-session',
        );
        canViewMedicalRecordAudit.value = names.has(
            'medical-records.view-audit-logs',
        );
        canReadLaboratoryOrders.value = names.has('laboratory.orders.read');
        canCreateLaboratoryOrders.value = names.has('laboratory.orders.create');
        canReadPharmacyOrders.value = names.has('pharmacy.orders.read');
        canCreatePharmacyOrders.value = names.has('pharmacy.orders.create');
        canReadRadiologyOrders.value = names.has('radiology.orders.read');
        canCreateRadiologyOrders.value = names.has('radiology.orders.create');
        canReadTheatreProcedures.value = names.has('theatre.procedures.read');
        canCreateTheatreProcedures.value = names.has('theatre.procedures.create');
        canReadBillingInvoices.value = names.has('billing.invoices.read');
        canCreateBillingInvoices.value = names.has('billing.invoices.create');

        if (!canCreateMedicalRecords.value && medicalRecordTab.value === 'new') {
            finishMedicalRecordWorkspaceView('list', { focusSearch: true });
        }
    } catch {
        canReadMedicalRecords.value = false;
        canCreateMedicalRecords.value = false;
        canFinalizeMedicalRecords.value = false;
        canAmendMedicalRecords.value = false;
        canArchiveMedicalRecords.value = false;
        canAttestMedicalRecords.value = false;
        canReadAppointments.value = false;
        canManageAppointmentProviderSession.value = false;
        canViewMedicalRecordAudit.value = false;
        canReadLaboratoryOrders.value = false;
        canCreateLaboratoryOrders.value = false;
        canReadPharmacyOrders.value = false;
        canCreatePharmacyOrders.value = false;
        canReadRadiologyOrders.value = false;
        canCreateRadiologyOrders.value = false;
        canReadTheatreProcedures.value = false;
        canCreateTheatreProcedures.value = false;
        canReadBillingInvoices.value = false;
        canCreateBillingInvoices.value = false;
    }
}

function normalizeRecordType(value: string): string {
    return value.trim().toLowerCase();
}

const createRecordTypeHelperText = computed(() => {
    return medicalRecordNoteTypeHelperText(createForm.recordType);
});

const createDiagnosisCodeHelperText = computed(
    () =>
        'Optional. Use an ICD-10 code when a confirmed or working diagnosis code is known. Keep the diagnosis narrative in Assessment.',
);
const createRecordTypeLabel = computed(() =>
    medicalRecordNoteTypeLabel(createForm.recordType),
);
const createNarrativeHeading = computed(() =>
    medicalRecordNoteTypeNarrativeHeading(createForm.recordType),
);
const createSubjectiveUi = computed(() =>
    medicalRecordNoteTypeSectionUi(createForm.recordType, 'subjective'),
);
const createObjectiveUi = computed(() =>
    medicalRecordNoteTypeSectionUi(createForm.recordType, 'objective'),
);
const createAssessmentUi = computed(() =>
    medicalRecordNoteTypeSectionUi(createForm.recordType, 'assessment'),
);
const createPlanUi = computed(() =>
    medicalRecordNoteTypeSectionUi(createForm.recordType, 'plan'),
);
const createSubjectiveLabel = computed(() =>
    medicalRecordNoteTypeSectionLabel(createForm.recordType, 'subjective'),
);
const createObjectiveLabel = computed(() =>
    medicalRecordNoteTypeSectionLabel(createForm.recordType, 'objective'),
);
const createAssessmentLabel = computed(() =>
    medicalRecordNoteTypeSectionLabel(createForm.recordType, 'assessment'),
);
const createPlanLabel = computed(() =>
    medicalRecordNoteTypeSectionLabel(createForm.recordType, 'plan'),
);

async function hydrateVisiblePatients(rows: MedicalRecord[]) {
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

async function loadRecords() {
    if (!canReadMedicalRecords.value) {
        records.value = [];
        pagination.value = null;
        listLoading.value = false;
        pageLoading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];

    try {
        const response = await apiRequest<MedicalRecordListResponse>(
            'GET',
            '/medical-records',
            {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    appointmentReferralId:
                        searchForm.appointmentReferralId.trim() || null,
                    admissionId: searchForm.admissionId.trim() || null,
                    status: searchForm.status || null,
                    recordType: searchForm.recordType.trim() || null,
                    from: searchForm.from
                        ? `${searchForm.from} 00:00:00`
                        : null,
                    to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                    page: searchForm.page,
                    perPage: searchForm.perPage,
                    sortBy: 'encounterAt',
                    sortDir: 'desc',
                },
            },
        );

        records.value = response.data;
        pagination.value = response.meta;
        void hydrateVisiblePatients(response.data);
    } catch (error) {
        records.value = [];
        pagination.value = null;
        listErrors.value.push(
            error instanceof Error
                ? error.message
                : 'Unable to load medical records.',
        );
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}

async function loadRecordStatusCounts() {
    if (!canReadMedicalRecords.value) {
        medicalRecordStatusCounts.value = null;
        return;
    }

    try {
        const response = await apiRequest<MedicalRecordStatusCountsResponse>(
            'GET',
            '/medical-records/status-counts',
            {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    appointmentReferralId:
                        searchForm.appointmentReferralId.trim() || null,
                    admissionId: searchForm.admissionId.trim() || null,
                    recordType: searchForm.recordType.trim() || null,
                    from: searchForm.from
                        ? `${searchForm.from} 00:00:00`
                        : null,
                    to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                },
            },
        );
        medicalRecordStatusCounts.value = response.data;
    } catch {
        medicalRecordStatusCounts.value = null;
    }
}

function upsertRecordIntoList(record: MedicalRecord) {
    const alreadyPresent = records.value.some((row) => row.id === record.id);

    // Keep a just-created note visible while the list refreshes in the background.
    records.value = sortRecordsByOccurredAtDesc([
        record,
        ...records.value.filter((row) => row.id !== record.id),
    ]);

    if (pagination.value) {
        pagination.value = {
            ...pagination.value,
            total: alreadyPresent
                ? pagination.value.total
                : pagination.value.total + 1,
        };
        return;
    }

    pagination.value = {
        currentPage: 1,
        perPage: searchForm.perPage,
        total: 1,
        lastPage: 1,
    };
}

async function refreshPage() {
    clearSearchDebounce();
    await Promise.all([loadScope(), loadMedicalRecordPermissions()]);
    await Promise.all([loadRecords(), loadRecordStatusCounts()]);
}

async function startCreateAppointmentConsultationSession() {
    const appointmentId = createForm.appointmentId.trim();
    if (
        createProviderSessionSubmitting.value ||
        !appointmentId ||
        !canStartCreateConsultationSession.value
    ) {
        return;
    }

    createProviderSessionSubmitting.value = true;

    try {
        const response = await apiRequest<{ data: AppointmentSummary }>(
            'PATCH',
            '/appointments/' + appointmentId + '/start-consultation',
        );
        createAppointmentSummary.value = response.data;
        notifySuccess('Consultation session started.');
    } catch (error) {
        const apiError = error as ApiRequestError;
        if (
            apiError.status === 409 &&
            apiError.payload?.code === 'CONSULTATION_OWNER_CONFLICT'
        ) {
            openCreateConsultationTakeoverDialog(
                consultationOwnerUserIdFromPayload(apiError.payload),
            );
            return;
        }

        notifyError(
            messageFromUnknown(
                error,
                'Unable to start the consultation session from Medical Records.',
            ),
        );
    } finally {
        createProviderSessionSubmitting.value = false;
    }
}

function openCreateConsultationTakeoverDialog(
    ownerUserIdOverride: number | null = null,
): void {
    createConsultationTakeoverOwnerUserId.value =
        ownerUserIdOverride ?? createAppointmentConsultationOwnerUserId.value;
    createConsultationTakeoverReason.value = '';
    createConsultationTakeoverError.value = null;
    createConsultationTakeoverDialogOpen.value = true;
}

function closeCreateConsultationTakeoverDialog(): void {
    createConsultationTakeoverDialogOpen.value = false;
    createConsultationTakeoverReason.value = '';
    createConsultationTakeoverError.value = null;
    createConsultationTakeoverSubmitting.value = false;
    createConsultationTakeoverOwnerUserId.value = null;
}

async function submitCreateConsultationTakeover(): Promise<void> {
    const appointmentId = createForm.appointmentId.trim();
    if (!appointmentId || createConsultationTakeoverSubmitting.value) {
        return;
    }

    createConsultationTakeoverSubmitting.value = true;
    createConsultationTakeoverError.value = null;

    try {
        const response = await apiRequest<AppointmentResponse>(
            'PATCH',
            '/appointments/' + appointmentId + '/start-consultation',
            {
                body: {
                    forceTakeover: true,
                    takeoverReason:
                        createConsultationTakeoverReason.value.trim() || null,
                },
            },
        );

        createAppointmentSummary.value = response.data;
        closeCreateConsultationTakeoverDialog();
        notifySuccess(
            'Consultation takeover confirmed. Continue documenting this visit.',
        );
    } catch (error) {
        const apiError = error as ApiRequestError;
        createConsultationTakeoverError.value =
            apiError.payload?.errors?.takeoverReason?.[0] ??
            apiError.payload?.message ??
            messageFromUnknown(
                error,
                'Unable to confirm consultation takeover.',
            );
    } finally {
        createConsultationTakeoverSubmitting.value = false;
    }
}

async function completeAppointmentVisitFromMedicalRecord(
    appointmentId: string,
) {
    const response = await apiRequest<{ data: AppointmentSummary }>(
        'PATCH',
        '/appointments/' + appointmentId + '/provider-workflow',
        {
            body: {
                status: 'completed',
                reason: null,
            },
        },
    );
    createAppointmentSummary.value = response.data;
}

async function createRecord(intent: 'save' | 'return' | 'complete' = 'save') {
    if (createLoading.value) return;
    if (!canCreateMedicalRecords.value) {
        notifyError(
            'Consultation authoring requires medical record create access.',
        );
        return;
    }

    createSubmitIntent.value = intent;
    createLoading.value = true;
    resetCreateMessages();
    listErrors.value = [];

    try {
        const response = await apiRequest<{ data: MedicalRecord }>(
            'POST',
            '/medical-records',
            {
                body: {
                    patientId: createForm.patientId.trim(),
                    appointmentId: createForm.appointmentId.trim() || null,
                    admissionId: createForm.admissionId.trim() || null,
                    appointmentReferralId:
                        createForm.appointmentReferralId.trim() || null,
                    theatreProcedureId:
                        createForm.theatreProcedureId.trim() || null,
                    encounterAt: normalizeLocalDateTimeForApi(
                        createForm.encounterAt,
                    ),
                    recordType: createForm.recordType.trim(),
                    diagnosisCode: createForm.diagnosisCode.trim() || null,
                    subjective: createForm.subjective.trim() || null,
                    objective: createForm.objective.trim() || null,
                    assessment: createForm.assessment.trim() || null,
                    plan: createForm.plan.trim() || null,
                },
            },
        );

        const createdFromAppointmentHandoff =
            shouldKeepAppointmentReturnContext(response.data.appointmentId) ||
            createConsultationFromAppointments.value;
        let visitCompleted = false;

        if (
            intent === 'complete' &&
            response.data.appointmentId &&
            canManageAppointmentProviderSession.value
        ) {
            try {
                await completeAppointmentVisitFromMedicalRecord(
                    response.data.appointmentId,
                );
                visitCompleted = true;
            } catch (error) {
                notifyError(
                    messageFromUnknown(
                        error,
                        'Consultation note was saved, but the visit could not be completed. Return to Appointments to finish close-out.',
                    ),
                );
            }
        }

        const successMessage = visitCompleted
            ? `Created ${response.data.recordNumber ?? 'medical record'} and completed the visit.`
            : `Created ${response.data.recordNumber ?? 'medical record'} successfully.`;
        createMessage.value = successMessage;
        actionMessage.value = successMessage;
        notifySuccess(successMessage);
        const savedPatientId = response.data.patientId ?? createForm.patientId.trim();

        discardStoredMedicalRecordCreateDraft();
        resetMedicalRecordCreateComposerToInitialState();

        clearSearchDebounce();
        searchForm.q = '';
        searchForm.patientId = createdFromAppointmentHandoff
            ? savedPatientId
            : '';
        searchForm.appointmentReferralId = '';
        searchForm.status = '';
        searchForm.recordType = '';
        searchForm.from = today;
        searchForm.to = '';
        searchForm.page = 1;
        showAdvancedRecordFilters.value = false;

        const shouldReturnToAppointmentsAfterSave =
            (intent === 'return' || intent === 'complete') &&
            canReturnToAppointments.value &&
            Boolean(response.data.appointmentId);

        if (shouldReturnToAppointmentsAfterSave && response.data.appointmentId) {
            createLeaveConfirmOpen.value = false;
            pendingMedicalRecordsVisit.value = null;
            pendingMedicalRecordsWorkspaceClose.value = null;
            visitWithoutMedicalRecordsLeaveGuard(
                appointmentReturnHref(
                    response.data.appointmentId,
                    visitCompleted
                        ? 'completed'
                        : createAppointmentSummary.value?.status ?? null,
                ),
            );
            return;
        }

        finishMedicalRecordWorkspaceView('list');

        if (canReadMedicalRecords.value) {
            upsertRecordIntoList(response.data);
            await Promise.all([loadRecords(), loadRecordStatusCounts()]);
            upsertRecordIntoList(response.data);
            await nextTick();

            openRecordDetailsSheet(response.data, {
                initialTab: createdFromAppointmentHandoff ? 'timeline' : 'overview',
                timelineRecordId: createdFromAppointmentHandoff
                    ? response.data.id
                    : null,
            });
        }
    } catch (error) {
        const apiError = error as ApiRequestError;
        if (
            apiError.status === 409 &&
            apiError.payload?.code === 'CONSULTATION_OWNER_CONFLICT'
        ) {
            const conflictMessage =
                apiError.payload?.message ??
                'Another clinician currently owns this consultation. Confirm takeover before saving the note.';
            createErrors.value = {
                general: [conflictMessage],
            };
            notifyError(conflictMessage);
            openCreateConsultationTakeoverDialog(
                consultationOwnerUserIdFromPayload(apiError.payload),
            );
            return;
        }

        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            notifyError(
                'Consultation entry needs attention. Review the highlighted fields and try again.',
            );
            revealCreateErrors();
        } else {
            const fallbackMessage = messageFromUnknown(
                apiError,
                'Unable to create medical record.',
            );
            createErrors.value = {
                general: [fallbackMessage],
            };
            notifyError(fallbackMessage);
            nextTick(() => {
                scrollCreateComposerToSection('mr-create-composer-top');
            });
        }
    } finally {
        createLoading.value = false;
        createSubmitIntent.value = 'save';
    }
}

async function updateRecordStatus(
    record: MedicalRecord,
    status: MedicalRecordStatusAction,
    reason: string | null = null,
) {
    if (actionLoadingId.value) return null;
    if (!canApplyMedicalRecordStatusAction(status, record)) {
        notifyError('This lifecycle action is not available for this user.');
        return null;
    }

    actionLoadingId.value = record.id;
    listErrors.value = [];
    actionMessage.value = null;

    try {
        const response = await apiRequest<{ data: MedicalRecord }>(
            'PATCH',
            `/medical-records/${record.id}/status`,
            {
                body: { status, reason },
            },
        );

        actionMessage.value = `Updated ${response.data.recordNumber ?? 'medical record'} to ${status}.`;
        if (actionMessage.value) notifySuccess(actionMessage.value);

        const detailsRefreshTasks: Array<Promise<unknown>> = [];
        if (detailsSheetRecord.value?.id === response.data.id) {
            detailsSheetRecord.value = response.data;
            detailsRefreshTasks.push(loadDetailsVersions(response.data.id));
            detailsRefreshTasks.push(
                loadDetailsSignerAttestations(response.data.id),
            );

            if (canViewMedicalRecordAudit.value) {
                detailsRefreshTasks.push(
                    loadDetailsAuditLogs(response.data.id),
                );
            }
        }

        await Promise.all([
            loadRecords(),
            loadRecordStatusCounts(),
            ...detailsRefreshTasks,
        ]);

        let latestRecord = response.data;

        try {
            const latestRecordResponse = await apiRequest<{ data: MedicalRecord }>(
                'GET',
                `/medical-records/${record.id}`,
            );
            latestRecord = latestRecordResponse.data;

            if (detailsSheetRecord.value?.id === latestRecord.id) {
                detailsSheetRecord.value = latestRecord;
            }

            upsertRecordIntoList(latestRecord);
        } catch {
            // Keep the optimistic response if the follow-up refresh cannot load.
        }

        return latestRecord;
    } catch (error) {
        notifyError(
            messageFromUnknown(
                error,
                'Unable to update medical record status.',
            ),
        );
        return null;
    } finally {
        actionLoadingId.value = null;
    }
}

async function finalizeRecord(record: MedicalRecord) {
    if (!canApplyMedicalRecordStatusAction('finalized', record)) {
        notifyError('Finalization is not available for this user.');
        return;
    }

    const updatedRecord = await updateRecordStatus(record, 'finalized');
    if (updatedRecord) {
        openFinalizeFollowUp(updatedRecord);
    }
}

function openRecordStatusDialog(
    record: MedicalRecord,
    action: MedicalRecordStatusAction,
) {
    if (!canApplyMedicalRecordStatusAction(action, record)) {
        notifyError('This lifecycle action is not available for this user.');
        return;
    }

    statusDialogRecord.value = record;
    statusDialogAction.value = action;
    statusDialogError.value = null;
    statusDialogReason.value =
        action === 'amended' || action === 'archived'
            ? (record.statusReason ?? '')
            : '';
    statusDialogOpen.value = true;
}

function closeRecordStatusDialog() {
    statusDialogOpen.value = false;
    statusDialogError.value = null;
    statusDialogReason.value = '';
}

const statusDialogTitle = computed(() => {
    switch (statusDialogAction.value) {
        case 'finalized':
            return 'Finalize Medical Record';
        case 'amended':
            return 'Amend Medical Record';
        case 'archived':
            return 'Archive Medical Record';
        default:
            return 'Update Medical Record Status';
    }
});

const statusDialogDescription = computed(() => {
    const action = statusDialogAction.value;
    const record = statusDialogRecord.value;
    const label = record?.recordNumber ?? 'this medical record';

    if (action === 'finalized') {
        return `Confirm finalization for ${label}. Attestation and status audit remain available after finalization.`;
    }
    if (action === 'amended')
        return `Provide an amendment reason for ${label}.`;
    if (action === 'archived') return `Provide an archive reason for ${label}.`;

    return 'Confirm medical record status update.';
});

const statusDialogNeedsReason = computed(
    () =>
        statusDialogAction.value === 'amended' ||
        statusDialogAction.value === 'archived',
);

async function submitRecordStatusDialog() {
    if (!statusDialogRecord.value || !statusDialogAction.value) return;

    const action = statusDialogAction.value;
    let reason: string | null = null;
    if (statusDialogNeedsReason.value) {
        reason = statusDialogReason.value.trim();
        if (!reason) {
            statusDialogError.value =
                action === 'amended'
                    ? 'Amendment reason is required.'
                    : 'Archive reason is required.';
            return;
        }
    }

    statusDialogError.value = null;
    const updatedRecord = await updateRecordStatus(
        statusDialogRecord.value,
        action,
        reason,
    );

    if (updatedRecord) {
        closeRecordStatusDialog();

        if (action === 'finalized') {
            openFinalizeFollowUp(updatedRecord);
        }
    }
}

function submitSearch() {
    clearSearchDebounce();
    searchForm.page = 1;
    void Promise.all([loadRecords(), loadRecordStatusCounts()]);
}

function submitSearchFromMobileDrawer() {
    submitSearch();
    filterSheetOpen.value = false;
}

function resetRecordFilters() {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.patientId = '';
    searchForm.appointmentReferralId = '';
    searchForm.admissionId = '';
    searchForm.status = '';
    searchForm.recordType = '';
    searchForm.from = today;
    searchForm.to = '';
    searchForm.page = 1;
    showAdvancedRecordFilters.value = false;
    void Promise.all([loadRecords(), loadRecordStatusCounts()]);
}

function resetRecordFiltersFromMobileDrawer() {
    resetRecordFilters();
    filterSheetOpen.value = false;
}

function prevPage() {
    if ((pagination.value?.currentPage ?? 1) <= 1) return;
    clearSearchDebounce();
    searchForm.page -= 1;
    void Promise.all([loadRecords(), loadRecordStatusCounts()]);
}

function nextPage() {
    if (
        !pagination.value ||
        pagination.value.currentPage >= pagination.value.lastPage
    )
        return;
    clearSearchDebounce();
    searchForm.page += 1;
    void Promise.all([loadRecords(), loadRecordStatusCounts()]);
}

function goToPage(page: number) {
    const last = pagination.value?.lastPage ?? 1;
    const clamped = Math.max(1, Math.min(page, last));
    if (clamped === searchForm.page) return;
    clearSearchDebounce();
    searchForm.page = clamped;
    void Promise.all([loadRecords(), loadRecordStatusCounts()]);
}

function changePerPage(value: number) {
    clearSearchDebounce();
    searchForm.perPage = value;
    searchForm.page = 1;
    void Promise.all([loadRecords(), loadRecordStatusCounts()]);
}

function toggleListRow(id: string) {
    expandedListRowIds.value = {
        ...expandedListRowIds.value,
        [id]: !expandedListRowIds.value[id],
    };
}

function shortId(value: string | null): string {
    if (!value) return 'N/A';
    return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

function lifecycleLinkageText(
    entry: { replacesOrderId?: string | null; addOnToOrderId?: string | null },
    label: string,
): string | null {
    const replacesOrderId = String(entry.replacesOrderId ?? '').trim();
    if (replacesOrderId !== '') {
        return `Replacement for ${label} ${shortId(replacesOrderId)}.`;
    }

    const addOnToOrderId = String(entry.addOnToOrderId ?? '').trim();
    if (addOnToOrderId !== '') {
        return `Linked follow-up to ${label} ${shortId(addOnToOrderId)}.`;
    }

    return null;
}

function isEncounterOrderEnteredInError(
    entry: { enteredInErrorAt?: string | null; lifecycleReasonCode?: string | null } | null,
): boolean {
    if (!entry) return false;

    return Boolean(
        String(entry.enteredInErrorAt ?? '').trim()
        || String(entry.lifecycleReasonCode ?? '').trim().toLowerCase() === 'entered_in_error',
    );
}

function canApplyLaboratoryEncounterLifecycleAction(
    order: LaboratoryOrder | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!order || !canCreateLaboratoryOrders.value || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'completed';
    }

    return true;
}

function canApplyPharmacyEncounterLifecycleAction(
    order: PharmacyOrder | null,
    action: 'cancel' | 'discontinue' | 'entered_in_error',
): boolean {
    if (!order || !canCreatePharmacyOrders.value || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    const quantityDispensed = Number(order.quantityDispensed ?? 0);
    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'dispensed' && quantityDispensed <= 0;
    }

    if (action === 'discontinue') {
        return order.status !== 'cancelled' && order.status !== 'dispensed';
    }

    return true;
}

function canApplyRadiologyEncounterLifecycleAction(
    order: RadiologyOrder | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!order || !canCreateRadiologyOrders.value || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'completed';
    }

    return true;
}

function canApplyTheatreEncounterLifecycleAction(
    procedure: TheatreProcedure | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!procedure || !canCreateTheatreProcedures.value || isEncounterOrderEnteredInError(procedure)) {
        return false;
    }

    if (action === 'cancel') {
        return procedure.status !== 'cancelled' && procedure.status !== 'completed';
    }

    return true;
}

function encounterLifecycleActionLabel(action: EncounterLifecycleAction | null): string {
    if (action === 'cancel') return 'Cancel';
    if (action === 'discontinue') return 'Discontinue';
    if (action === 'entered_in_error') return 'Mark Entered In Error';
    return 'Apply';
}

function encounterLifecycleActionSuccessMessage(action: EncounterLifecycleAction | null): string {
    if (action === 'cancel') return 'Order cancelled.';
    if (action === 'discontinue') return 'Order discontinued.';
    if (action === 'entered_in_error') return 'Order marked entered in error.';
    return 'Lifecycle action applied.';
}

function encounterLifecycleActionPath(
    kind: EncounterLifecycleTargetKind,
    id: string,
): string {
    if (kind === 'laboratory') return `/laboratory-orders/${id}/lifecycle`;
    if (kind === 'pharmacy') return `/pharmacy-orders/${id}/lifecycle`;
    if (kind === 'radiology') return `/radiology-orders/${id}/lifecycle`;
    return `/theatre-procedures/${id}/lifecycle`;
}

function openEncounterLifecycleDialog(
    kind: EncounterLifecycleTargetKind,
    id: string,
    action: EncounterLifecycleAction,
    defaultReason?: string | null,
): void {
    encounterLifecycleTargetKind.value = kind;
    encounterLifecycleTargetId.value = id;
    encounterLifecycleAction.value = action;
    encounterLifecycleReason.value = String(defaultReason ?? '').trim();
    encounterLifecycleError.value = null;
    encounterLifecycleDialogOpen.value = true;
}

function closeEncounterLifecycleDialog(): void {
    encounterLifecycleDialogOpen.value = false;
    encounterLifecycleTargetKind.value = null;
    encounterLifecycleTargetId.value = '';
    encounterLifecycleAction.value = null;
    encounterLifecycleReason.value = '';
    encounterLifecycleError.value = null;
}

function replaceEncounterOrderInCollections(
    kind: EncounterLifecycleTargetKind,
    updated: LaboratoryOrder | PharmacyOrder | RadiologyOrder | TheatreProcedure,
): void {
    if (kind === 'laboratory') {
        createEncounterLaboratoryOrders.value = createEncounterLaboratoryOrders.value.map((order) =>
            order.id === updated.id ? (updated as LaboratoryOrder) : order,
        );
        detailsEncounterLaboratoryOrders.value = detailsEncounterLaboratoryOrders.value.map((order) =>
            order.id === updated.id ? (updated as LaboratoryOrder) : order,
        );
        return;
    }

    if (kind === 'pharmacy') {
        createEncounterPharmacyOrders.value = createEncounterPharmacyOrders.value.map((order) =>
            order.id === updated.id ? (updated as PharmacyOrder) : order,
        );
        detailsEncounterPharmacyOrders.value = detailsEncounterPharmacyOrders.value.map((order) =>
            order.id === updated.id ? (updated as PharmacyOrder) : order,
        );
        return;
    }

    if (kind === 'radiology') {
        createEncounterRadiologyOrders.value = createEncounterRadiologyOrders.value.map((order) =>
            order.id === updated.id ? (updated as RadiologyOrder) : order,
        );
        detailsEncounterRadiologyOrders.value = detailsEncounterRadiologyOrders.value.map((order) =>
            order.id === updated.id ? (updated as RadiologyOrder) : order,
        );
        return;
    }

    createEncounterTheatreProcedures.value = createEncounterTheatreProcedures.value.map((procedure) =>
        procedure.id === updated.id ? (updated as TheatreProcedure) : procedure,
    );
    detailsEncounterTheatreProcedures.value = detailsEncounterTheatreProcedures.value.map((procedure) =>
        procedure.id === updated.id ? (updated as TheatreProcedure) : procedure,
    );
}

function encounterLifecycleTargetName(): string {
    if (!encounterLifecycleTargetKind.value || !encounterLifecycleTargetId.value) {
        return 'this order';
    }

    if (encounterLifecycleTargetKind.value === 'laboratory') {
        const target = createEncounterLaboratoryOrders.value.find((order) => order.id === encounterLifecycleTargetId.value)
            || detailsEncounterLaboratoryOrders.value.find((order) => order.id === encounterLifecycleTargetId.value);
        return target?.testName?.trim() || target?.orderNumber?.trim() || 'this laboratory order';
    }

    if (encounterLifecycleTargetKind.value === 'pharmacy') {
        const target = createEncounterPharmacyOrders.value.find((order) => order.id === encounterLifecycleTargetId.value)
            || detailsEncounterPharmacyOrders.value.find((order) => order.id === encounterLifecycleTargetId.value);
        return target?.medicationName?.trim() || target?.orderNumber?.trim() || 'this medication order';
    }

    if (encounterLifecycleTargetKind.value === 'radiology') {
        const target = createEncounterRadiologyOrders.value.find((order) => order.id === encounterLifecycleTargetId.value)
            || detailsEncounterRadiologyOrders.value.find((order) => order.id === encounterLifecycleTargetId.value);
        return target?.studyDescription?.trim() || target?.orderNumber?.trim() || 'this imaging order';
    }

    const target = createEncounterTheatreProcedures.value.find((procedure) => procedure.id === encounterLifecycleTargetId.value)
        || detailsEncounterTheatreProcedures.value.find((procedure) => procedure.id === encounterLifecycleTargetId.value);
    return (
        target?.procedureName?.trim()
        || target?.procedureType?.trim()
        || target?.procedureNumber?.trim()
        || 'this procedure booking'
    );
}

async function submitEncounterLifecycleDialog(): Promise<void> {
    if (
        !encounterLifecycleTargetKind.value
        || !encounterLifecycleTargetId.value
        || !encounterLifecycleAction.value
    ) {
        return;
    }

    const reason = encounterLifecycleReason.value.trim();
    if (!reason) {
        encounterLifecycleError.value = 'Clinical reason is required.';
        return;
    }

    encounterLifecycleSubmitting.value = true;
    encounterLifecycleError.value = null;

    try {
        const response = await apiRequest<{
            data: LaboratoryOrder | PharmacyOrder | RadiologyOrder | TheatreProcedure;
        }>(
            'POST',
            encounterLifecycleActionPath(
                encounterLifecycleTargetKind.value,
                encounterLifecycleTargetId.value,
            ),
            {
                body: {
                    action: encounterLifecycleAction.value,
                    reason,
                },
            },
        );

        replaceEncounterOrderInCollections(
            encounterLifecycleTargetKind.value,
            response.data,
        );
        notifySuccess(encounterLifecycleActionSuccessMessage(encounterLifecycleAction.value));
        closeEncounterLifecycleDialog();
    } catch (error) {
        encounterLifecycleError.value = messageFromUnknown(
            error,
            'Unable to apply lifecycle action.',
        );
        notifyError(encounterLifecycleError.value);
    } finally {
        encounterLifecycleSubmitting.value = false;
    }
}

function recordTimelineEntryDomId(recordId: string): string {
    return `medical-record-timeline-entry-${recordId}`;
}

function timelineGroupDomId(groupKey: string): string {
    return `medical-record-timeline-group-${groupKey}`;
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



function recordOccurredAt(record: MedicalRecord): string | null {
    return record.encounterAt ?? record.createdAt ?? record.updatedAt;
}

function recordOccurredTimestamp(record: MedicalRecord): number {
    const value = recordOccurredAt(record);
    if (!value) return 0;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortRecordsByOccurredAtDesc(
    recordsToSort: MedicalRecord[],
): MedicalRecord[] {
    return [...recordsToSort].sort(
        (left, right) =>
            recordOccurredTimestamp(right) - recordOccurredTimestamp(left),
    );
}

function statusVariant(status: string | null) {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'draft') return 'outline';
    if (normalized === 'finalized') return 'default';
    if (normalized === 'amended') return 'secondary';
    if (normalized === 'archived') return 'destructive';
    return 'outline';
}

function recordAccentClass(status: string | null): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'draft')
        return 'border-l-4 border-l-slate-400/80 bg-slate-50/60 dark:bg-transparent dark:border-l-slate-400';
    if (normalized === 'finalized')
        return 'border-l-4 border-l-emerald-500/80 bg-emerald-50/60 dark:bg-transparent dark:border-l-emerald-400';
    if (normalized === 'amended')
        return 'border-l-4 border-l-amber-500/80 bg-amber-50/60 dark:bg-transparent dark:border-l-amber-400';
    if (normalized === 'archived')
        return 'border-l-4 border-l-rose-500/80 bg-rose-50/60 dark:bg-transparent dark:border-l-rose-400';
    return '';
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

function recordPatientSummary(record: MedicalRecord): PatientSummary | null {
    if (!record.patientId) return null;
    return patientDirectory.value[record.patientId] ?? null;
}

function recordPatientLabel(record: MedicalRecord): string {
    const summary = recordPatientSummary(record);
    if (!summary) return shortId(record.patientId);
    return patientName(summary);
}

function recordPatientNumber(record: MedicalRecord): string | null {
    return recordPatientSummary(record)?.patientNumber ?? null;
}

function recordTypeLabel(value: string | null): string {
    return medicalRecordNoteTypeLabel(value);
}

function recordTimelineTitle(record: MedicalRecord): string {
    const recordType = record.recordType?.trim();
    if (recordType) return medicalRecordNoteTypeLabel(recordType);

    return 'General Note';
}

function recordTimelineClinicianLabel(record: MedicalRecord): string {
    if (record.authorUserName) return record.authorUserName;
    return record.authorUserId === null || record.authorUserId === undefined
        ? 'Unknown clinician'
        : `Clinician #${record.authorUserId}`;
}

function recordTimelineExcerpt(record: MedicalRecord): string {
    const excerpt = [
        plainTextFromHtml(record.subjective),
        plainTextFromHtml(record.objective),
        plainTextFromHtml(record.assessment),
        plainTextFromHtml(record.plan),
    ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .trim();

    if (!excerpt) return 'No note content recorded.';
    if (excerpt.length <= 100) return excerpt;
    return `${excerpt.slice(0, 97).trimEnd()}...`;
}

function truncatePlainText(value: string | null, max = 160): string | null {
    const plain = plainTextFromHtml(value);
    if (!plain) return null;
    if (plain.length <= max) return plain;
    return `${plain.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

function recordProblemFocus(record: MedicalRecord): string {
    return (
        record.diagnosisCode?.trim() ||
        truncatePlainText(record.assessment, 160) ||
        truncatePlainText(record.subjective, 160) ||
        'No working problem recorded.'
    );
}

function recordNextStepFocus(record: MedicalRecord): string {
    return (
        truncatePlainText(record.plan, 160) ||
        truncatePlainText(record.objective, 160) ||
        'No immediate plan recorded.'
    );
}

function recordContextHref(
    path: string,
    record: MedicalRecord,
    options?: {
        includeTabNew?: boolean;
        reorderOfId?: string | null;
        addOnToOrderId?: string | null;
    },
) {
    const params = new URLSearchParams();
    if (path === '/medical-records' && record.id) {
        params.set('recordId', record.id);
    } else if (options?.includeTabNew) {
        params.set('tab', 'new');
    }

    if (record.patientId) params.set('patientId', record.patientId);
    if (record.appointmentId) params.set('appointmentId', record.appointmentId);
    if (record.admissionId) params.set('admissionId', record.admissionId);
    if (record.id && path !== '/medical-records') params.set('recordId', record.id);
    if (options?.reorderOfId?.trim()) params.set('reorderOfId', options.reorderOfId.trim());
    if (options?.addOnToOrderId?.trim()) params.set('addOnToOrderId', options.addOnToOrderId.trim());
    if (shouldKeepAppointmentReturnContext(record.appointmentId)) {
        params.set('from', 'appointments');
    }

    const query = params.toString();
    return query ? `${path}?${query}` : path;
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

function auditFieldLabel(value: string): string {
    return formatEnumLabel(value.replace(/\./g, '_'));
}

function auditObjectEntries(
    value: Record<string, unknown> | null,
): Array<[string, unknown]> {
    if (!value) return [];

    return Object.entries(value).filter(([, entryValue]) => {
        if (entryValue === null || entryValue === undefined) return false;
        if (typeof entryValue === 'string' && entryValue.trim() === '')
            return false;
        if (Array.isArray(entryValue) && entryValue.length === 0) return false;
        return true;
    });
}

function isDraftRecord(record: MedicalRecord | null): boolean {
    return (record?.status ?? '').toLowerCase() === 'draft';
}

function canApplyMedicalRecordStatusAction(
    action: MedicalRecordStatusAction,
    record: MedicalRecord | null,
): boolean {
    if (!record) return false;

    const status = (record?.status ?? '').toLowerCase();

    switch (action) {
        case 'finalized':
            return canFinalizeMedicalRecords.value && status === 'draft';
        case 'amended':
            return canAmendMedicalRecords.value && status === 'finalized';
        case 'archived':
            return canArchiveMedicalRecords.value && status !== 'archived';
    }
}

function isSignerAttestationEligible(record: MedicalRecord | null): boolean {
    const normalizedStatus = (record?.status ?? '').toLowerCase();
    return normalizedStatus === 'finalized' || normalizedStatus === 'amended';
}

function canCreateSignerAttestation(record: MedicalRecord | null): boolean {
    return canAttestMedicalRecords.value && isSignerAttestationEligible(record);
}

function attestationActorLabel(attestation: MedicalRecordSignerAttestation): string {
    if (attestation.attestedByUserName) {
        return attestation.attestedByUserName;
    }
    return attestation.attestedByUserId === null ||
        attestation.attestedByUserId === undefined
        ? 'System'
        : `Clinician #${attestation.attestedByUserId}`;
}

const activeDetailsAuditPreset = computed<DetailsAuditPreset | null>(() => {
    const hasOtherFilters =
        detailsAuditFilters.q.trim() !== '' ||
        detailsAuditFilters.actorType.trim() !== '' ||
        detailsAuditFilters.actorId.trim() !== '' ||
        detailsAuditFilters.from.trim() !== '' ||
        detailsAuditFilters.to.trim() !== '' ||
        detailsAuditFilters.page !== 1 ||
        detailsAuditFilters.perPage !== 20;

    if (hasOtherFilters) return null;

    if (detailsAuditFilters.action === medicalRecordStatusAuditAction) {
        return 'status';
    }

    if (detailsAuditFilters.action === medicalRecordAttestationAuditAction) {
        return 'attestation';
    }

    return detailsAuditFilters.action.trim() === '' ? 'all' : null;
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

const canOpenLaboratoryWorkflow = computed(
    () => canReadLaboratoryOrders.value && canCreateLaboratoryOrders.value,
);
const canOpenPharmacyWorkflow = computed(
    () => canReadPharmacyOrders.value && canCreatePharmacyOrders.value,
);
const canOpenRadiologyWorkflow = computed(
    () => canReadRadiologyOrders.value && canCreateRadiologyOrders.value,
);
const canOpenTheatreWorkflow = computed(
    () => canReadTheatreProcedures.value && canCreateTheatreProcedures.value,
);
const canOpenBillingWorkflow = computed(() => canReadBillingInvoices.value);
const canCreateBillingWorkflow = computed(
    () => canReadBillingInvoices.value && canCreateBillingInvoices.value,
);
const hasCreateContextWorkflowActions = computed(
    () =>
        canOpenLaboratoryWorkflow.value ||
        canOpenPharmacyWorkflow.value ||
        canOpenRadiologyWorkflow.value ||
        canOpenTheatreWorkflow.value ||
        canOpenBillingWorkflow.value,
);
const hasCareWorkflowFooterActions = computed(
    () =>
        canOpenLaboratoryWorkflow.value ||
        canOpenPharmacyWorkflow.value ||
        canOpenRadiologyWorkflow.value ||
        canOpenTheatreWorkflow.value ||
        canCreateBillingWorkflow.value,
);
const hasDetailsWorkflowActions = computed(
    () =>
        canOpenLaboratoryWorkflow.value ||
        canOpenPharmacyWorkflow.value ||
        canOpenRadiologyWorkflow.value ||
        canOpenTheatreWorkflow.value ||
        canCreateBillingWorkflow.value,
);

const detailsAuditSummary = computed(() => {
    const total =
        detailsAuditMeta.value?.total ?? detailsAuditLogs.value.length;
    let changedEntries = 0;
    let userEntries = 0;

    for (const log of detailsAuditLogs.value) {
        if (auditObjectEntries(log.changes).length > 0) changedEntries += 1;
        if (log.actorId !== null && log.actorId !== undefined) userEntries += 1;
    }

    return {
        total,
        changedEntries,
        userEntries,
    };
});

const detailsAttestationCount = computed(() =>
    detailsAttestationsMeta.value?.total ?? detailsAttestations.value.length,
);

const detailsAuditEventCount = computed(() =>
    detailsAuditMeta.value?.total ?? detailsAuditLogs.value.length,
);

const detailsLatestAttestation = computed<MedicalRecordSignerAttestation | null>(
    () => detailsAttestations.value[0] ?? null,
);

const detailsFinalizeSummaryTitle = computed(() => {
    if (isDraftRecord(detailsSheetRecord.value)) {
        return 'Finalize this note when documentation is complete. This signs off the document only; visit close-out stays separate.';
    }

    if (isSignerAttestationEligible(detailsSheetRecord.value)) {
        return detailsAttestationCount.value > 0
            ? 'Signer attestation is visible here, and the audit trail is ready for review.'
            : 'This note is ready for signer attestation. Record signoff here or jump straight into audit review.';
    }

    return 'This note is no longer in draft. Review lifecycle history and audit evidence from the shortcuts below.';
});

const detailsFinalizeSummaryMeta = computed(() => {
    const updatedAt = detailsSheetRecord.value?.updatedAt
        ? formatDateTime(detailsSheetRecord.value.updatedAt)
        : 'recently';
    const parts = [
        `Updated ${updatedAt}`,
        `${detailsAttestationCount.value} attestation${detailsAttestationCount.value === 1 ? '' : 's'}`,
    ];

    if (canViewMedicalRecordAudit.value) {
        parts.push(
            `${detailsAuditEventCount.value} audit event${detailsAuditEventCount.value === 1 ? '' : 's'}`,
        );
    }

    return parts.join(' | ');
});

function focusDetailsAttestationComposer() {
    if (!canAttestMedicalRecords.value) {
        notifyError('Signer attestation access is not available for this user.');
        return;
    }

    detailsSheetTab.value = 'overview';
    void nextTick(() => {
        window.setTimeout(() => {
            const input = document.getElementById(
                'medical-record-attestation-note',
            ) as HTMLInputElement | null;

            if (!input) return;

            input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            input.focus({ preventScroll: true });
        }, 140);
    });
}

function applyDetailsAuditPreset(preset: DetailsAuditPreset) {
    if (!detailsSheetRecord.value || !canViewMedicalRecordAudit.value) return;

    detailsSheetTab.value = 'audit';
    detailsAuditFilters.q = '';
    detailsAuditFilters.action =
        preset === 'status'
            ? medicalRecordStatusAuditAction
            : preset === 'attestation'
              ? medicalRecordAttestationAuditAction
              : '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;

    if (canViewMedicalRecordAudit.value) {
        void loadDetailsAuditLogs(detailsSheetRecord.value.id);
    }
}

function openFinalizeFollowUp(record: MedicalRecord) {
    if (detailsSheetOpen.value && detailsSheetRecord.value?.id === record.id) {
        detailsSheetRecord.value = record;
        detailsSheetTab.value = 'overview';
    } else {
        openRecordDetailsSheet(record, { initialTab: 'overview' });
    }

    focusDetailsAttestationComposer();
}

function versionLabel(version: MedicalRecordVersion): string {
    const number = version.versionNumber ?? '?';
    const dateLabel = formatDateTime(version.createdAt);
    return `v${number} (${dateLabel})`;
}

function formatDiffValue(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return value === '' ? "''" : value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

async function loadDetailsVersions(recordId: string) {
    detailsVersionsLoading.value = true;
    detailsVersionsError.value = null;
    try {
        const response = await apiRequest<MedicalRecordVersionListResponse>(
            'GET',
            `/medical-records/${recordId}/versions`,
            {
                query: {
                    page: 1,
                    perPage: 20,
                },
            },
        );

        detailsVersions.value = response.data ?? [];
        detailsVersionsMeta.value = response.meta ?? null;

        if (detailsVersions.value.length === 0) {
            detailsSelectedVersionId.value = '';
            detailsAgainstVersionId.value = '';
            detailsVersionDiff.value = null;
            detailsVersionDiffError.value = null;
            return;
        }

        detailsSelectedVersionId.value = detailsVersions.value[0].id;
        detailsAgainstVersionId.value = '';
        await loadDetailsVersionDiff(
            recordId,
            detailsSelectedVersionId.value,
            null,
        );
    } catch (error) {
        detailsVersions.value = [];
        detailsVersionsMeta.value = null;
        detailsSelectedVersionId.value = '';
        detailsAgainstVersionId.value = '';
        detailsVersionDiff.value = null;
        detailsVersionsError.value = messageFromUnknown(
            error,
            'Unable to load version history.',
        );
    } finally {
        detailsVersionsLoading.value = false;
    }
}

async function loadDetailsVersionDiff(
    recordId: string,
    versionId: string,
    againstVersionId: string | null,
) {
    if (!versionId) {
        detailsVersionDiff.value = null;
        detailsVersionDiffError.value = null;
        return;
    }

    detailsVersionDiffLoading.value = true;
    detailsVersionDiffError.value = null;
    try {
        const response = await apiRequest<MedicalRecordVersionDiffResponse>(
            'GET',
            `/medical-records/${recordId}/versions/${versionId}/diff`,
            {
                query: {
                    againstVersionId: againstVersionId?.trim() || null,
                },
            },
        );
        detailsVersionDiff.value = response.data;
    } catch (error) {
        detailsVersionDiff.value = null;
        detailsVersionDiffError.value = messageFromUnknown(
            error,
            'Unable to load version diff.',
        );
    } finally {
        detailsVersionDiffLoading.value = false;
    }
}

function applyDetailsVersionDiff() {
    if (!detailsSheetRecord.value || !detailsSelectedVersionId.value) return;

    void loadDetailsVersionDiff(
        detailsSheetRecord.value.id,
        detailsSelectedVersionId.value,
        detailsAgainstVersionId.value || null,
    );
}

async function loadDetailsSignerAttestations(recordId: string) {
    detailsAttestationsLoading.value = true;
    detailsAttestationsError.value = null;
    try {
        const response =
            await apiRequest<MedicalRecordSignerAttestationListResponse>(
                'GET',
                `/medical-records/${recordId}/signer-attestations`,
                {
                    query: {
                        page: 1,
                        perPage: 20,
                    },
                },
            );
        detailsAttestations.value = response.data ?? [];
        detailsAttestationsMeta.value = response.meta ?? null;
    } catch (error) {
        detailsAttestations.value = [];
        detailsAttestationsMeta.value = null;
        detailsAttestationsError.value = messageFromUnknown(
            error,
            'Unable to load signer attestations.',
        );
    } finally {
        detailsAttestationsLoading.value = false;
    }
}

async function submitDetailsSignerAttestation() {
    if (!detailsSheetRecord.value || detailsAttestationSubmitting.value) return;
    if (!canAttestMedicalRecords.value) {
        detailsAttestationsError.value =
            'Signer attestation access is not available for this user.';
        return;
    }

    if (!isSignerAttestationEligible(detailsSheetRecord.value)) {
        detailsAttestationsError.value =
            'Signer attestation is only allowed for finalized or amended records.';
        return;
    }

    const note = detailsAttestationNote.value.trim();
    if (!note) {
        detailsAttestationsError.value = 'Attestation note is required.';
        return;
    }

    detailsAttestationSubmitting.value = true;
    detailsAttestationsError.value = null;

    try {
        await apiRequest<{ data: MedicalRecordSignerAttestation }>(
            'POST',
            `/medical-records/${detailsSheetRecord.value.id}/signer-attestations`,
            {
                body: {
                    attestationNote: note,
                },
            },
        );

        detailsAttestationNote.value = '';
        notifySuccess('Signer attestation recorded.');
        const refreshTasks: Array<Promise<unknown>> = [
            loadDetailsSignerAttestations(detailsSheetRecord.value.id),
        ];

        if (canViewMedicalRecordAudit.value) {
            refreshTasks.push(loadDetailsAuditLogs(detailsSheetRecord.value.id));
        }

        await Promise.all(refreshTasks);
    } catch (error) {
        detailsAttestationsError.value = messageFromUnknown(
            error,
            'Unable to create signer attestation.',
        );
    } finally {
        detailsAttestationSubmitting.value = false;
    }
}

async function loadDetailsAuditLogs(recordId: string) {
    if (!canViewMedicalRecordAudit.value) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditLoading.value = false;
        detailsAuditError.value = null;
        return;
    }

    detailsAuditLoading.value = true;
    detailsAuditError.value = null;
    try {
        const response = await apiRequest<MedicalRecordAuditLogListResponse>(
            'GET',
            `/medical-records/${recordId}/audit-logs`,
            { query: detailsAuditQuery() },
        );
        detailsAuditLogs.value = response.data ?? [];
        detailsAuditMeta.value = response.meta;
    } catch (error) {
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
        detailsAuditError.value = messageFromUnknown(
            error,
            'Unable to load medical record audit logs.',
        );
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    if (!detailsSheetRecord.value) return;
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs(detailsSheetRecord.value.id);
}

function resetDetailsAuditFilters() {
    applyDetailsAuditPreset('all');
}

function goToDetailsAuditPage(page: number) {
    if (!detailsSheetRecord.value) return;
    detailsAuditFilters.page = Math.max(page, 1);
    void loadDetailsAuditLogs(detailsSheetRecord.value.id);
}

async function exportDetailsAuditLogsCsv() {
    if (
        !detailsSheetRecord.value ||
        !canViewMedicalRecordAudit.value ||
        detailsAuditExporting.value
    ) {
        return;
    }

    detailsAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/medical-records/${detailsSheetRecord.value.id}/audit-logs/export`,
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

function openMedicalRecordPrintPreview(record: MedicalRecord | null) {
    if (!record?.id) return;

    window.open(`/medical-records/${record.id}/print`, '_blank', 'noopener');
}

function resetDetailsTimelineState() {
    detailsTimelineRequestId += 1;
    detailsTimelineLoading.value = false;
    detailsTimelineLoadingMore.value = false;
    detailsTimelineError.value = null;
    detailsTimelineRecords.value = [];
    detailsTimelineMeta.value = null;
    detailsTimelineExpandedRecordIds.value = {};
    detailsTimelineAnchorRecordId.value = '';
    detailsTimelineEnsuringRecordId.value = '';
}

function setDetailsTimelineRecordExpanded(recordId: string, expanded = true) {
    const normalizedId = recordId.trim();
    if (!normalizedId) return;

    detailsTimelineExpandedRecordIds.value = {
        ...detailsTimelineExpandedRecordIds.value,
        [normalizedId]: expanded,
    };
}

function isDetailsTimelineRecordExpanded(recordId: string): boolean {
    return Boolean(detailsTimelineExpandedRecordIds.value[recordId]);
}

function isDetailsTimelineRecordHighlighted(recordId: string): boolean {
    const highlightedId =
        detailsTimelineAnchorRecordId.value.trim() ||
        detailsSheetRecord.value?.id ||
        '';
    return highlightedId !== '' && highlightedId === recordId;
}

async function scrollDetailsTimelineRecordIntoView(recordId: string) {
    await nextTick();
    document
        .getElementById(recordTimelineEntryDomId(recordId))
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function scrollDetailsTimelineGroupIntoView(groupKey: string) {
    await nextTick();
    document
        .getElementById(timelineGroupDomId(groupKey))
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function jumpToDetailsTimelineCurrentRecord() {
    const currentRecordId = detailsSheetRecord.value?.id?.trim() ?? '';
    if (!currentRecordId) return;

    detailsTimelineAnchorRecordId.value = currentRecordId;
    setDetailsTimelineRecordExpanded(currentRecordId, true);
    void scrollDetailsTimelineRecordIntoView(currentRecordId);
}

function jumpToDetailsTimelineGroup(groupKey: string) {
    detailsTimelineAnchorRecordId.value = '';
    void scrollDetailsTimelineGroupIntoView(groupKey);
}

async function loadDetailsTimeline(options?: { append?: boolean }) {
    const patientId = detailsSheetRecord.value?.patientId?.trim() ?? '';

    if (!patientId) {
        resetDetailsTimelineState();
        detailsTimelineError.value =
            'Patient context is required to load the encounter timeline.';
        return;
    }

    const append = options?.append === true;
    const requestId = ++detailsTimelineRequestId;
    const page = append ? (detailsTimelineMeta.value?.currentPage ?? 1) + 1 : 1;

    if (append) {
        detailsTimelineLoadingMore.value = true;
    } else {
        detailsTimelineLoading.value = true;
        detailsTimelineError.value = null;
        detailsTimelineRecords.value = [];
        detailsTimelineMeta.value = null;
    }

    try {
        const response = await apiRequest<MedicalRecordListResponse>(
            'GET',
            '/medical-records',
            {
                query: {
                    patientId,
                    page,
                    perPage: 20,
                },
            },
        );

        if (requestId !== detailsTimelineRequestId) return;

        if (append) {
            const seen = new Set(
                detailsTimelineRecords.value.map((record) => record.id),
            );
            detailsTimelineRecords.value = [
                ...detailsTimelineRecords.value,
                ...response.data.filter((record) => !seen.has(record.id)),
            ];
        } else {
            detailsTimelineRecords.value = response.data;
        }

        detailsTimelineMeta.value = response.meta ?? null;
        detailsTimelineError.value = null;

        const anchorId =
            detailsTimelineAnchorRecordId.value.trim() ||
            detailsSheetRecord.value?.id;
        if (
            anchorId &&
            detailsTimelineRecords.value.some(
                (record) => record.id === anchorId,
            )
        ) {
            setDetailsTimelineRecordExpanded(anchorId, true);
            if (detailsSheetTab.value === 'timeline') {
                void scrollDetailsTimelineRecordIntoView(anchorId);
            }
        }
    } catch (error) {
        if (requestId !== detailsTimelineRequestId) return;

        detailsTimelineError.value = messageFromUnknown(
            error,
            'Unable to load the encounter timeline.',
        );

        if (!append) {
            detailsTimelineRecords.value = [];
            detailsTimelineMeta.value = null;
        }
    } finally {
        if (requestId === detailsTimelineRequestId) {
            if (append) {
                detailsTimelineLoadingMore.value = false;
            } else {
                detailsTimelineLoading.value = false;
            }
        }
    }
}

async function ensureDetailsTimelineContainsRecord(recordId: string) {
    const normalizedId = recordId.trim();
    if (!normalizedId) return;
    if (detailsTimelineEnsuringRecordId.value === normalizedId) return;

    detailsTimelineEnsuringRecordId.value = normalizedId;

    try {
        while (
            !detailsTimelineRecords.value.some(
                (record) => record.id === normalizedId,
            ) &&
            detailsTimelineHasMore.value
        ) {
            await loadDetailsTimeline({ append: true });
        }

        if (
            !detailsTimelineRecords.value.some(
                (record) => record.id === normalizedId,
            )
        ) {
            notifyError('Record not found.');
            return;
        }

        detailsTimelineAnchorRecordId.value = normalizedId;
        setDetailsTimelineRecordExpanded(normalizedId, true);

        if (detailsSheetTab.value === 'timeline') {
            await scrollDetailsTimelineRecordIntoView(normalizedId);
        }
    } finally {
        if (detailsTimelineEnsuringRecordId.value === normalizedId) {
            detailsTimelineEnsuringRecordId.value = '';
        }
    }
}

function toggleDetailsTimelineRecord(recordId: string) {
    const nextExpanded = !isDetailsTimelineRecordExpanded(recordId);
    detailsTimelineAnchorRecordId.value = recordId;
    setDetailsTimelineRecordExpanded(recordId, nextExpanded);

    if (nextExpanded && detailsSheetTab.value === 'timeline') {
        void scrollDetailsTimelineRecordIntoView(recordId);
    }
}

function loadMoreDetailsTimeline() {
    if (!detailsTimelineHasMore.value || detailsTimelineLoadingMore.value)
        return;
    void loadDetailsTimeline({ append: true });
}

async function openRecordDetailsSheetFromQuery(recordId: string) {
    const normalizedId = recordId.trim();
    if (!normalizedId) return;

    try {
        const response = await apiRequest<{ data: MedicalRecord }>(
            'GET',
            `/medical-records/${normalizedId}`,
        );

        if (response.data.patientId) {
            searchForm.patientId = response.data.patientId;
            searchForm.page = 1;
            void hydratePatientSummary(response.data.patientId);
            void Promise.all([loadRecords(), loadRecordStatusCounts()]);
        }
        const requestedDetailsTab = detailsSheetTabFromUrl(normalizedId);
        openRecordDetailsSheet(response.data, {
            initialTab:
                requestedDetailsTab === 'overview'
                    ? 'timeline'
                    : requestedDetailsTab,
            timelineRecordId: normalizedId,
        });
    } catch (error) {
        const apiError = error as Error & { status?: number };
        notifyError(
            apiError.status === 404
                ? 'Record not found.'
                : messageFromUnknown(
                      error,
                      'Unable to open the requested medical record.',
                  ),
        );
    }
}

let detailsEncounterLaboratoryOrdersRequestId = 0;
let detailsEncounterPharmacyOrdersRequestId = 0;
let detailsEncounterRadiologyOrdersRequestId = 0;
let detailsEncounterTheatreProceduresRequestId = 0;
let detailsAppointmentReferralsRequestId = 0;

async function loadDetailsEncounterLaboratoryOrders(record: MedicalRecord | null) {
    const patientId = record?.patientId?.trim() ?? '';
    const appointmentId = record?.appointmentId?.trim() ?? '';
    const admissionId = record?.admissionId?.trim() ?? '';

    if (
        !canReadLaboratoryOrders.value
        || !patientId
        || (!appointmentId && !admissionId)
    ) {
        detailsEncounterLaboratoryOrders.value = [];
        detailsEncounterLaboratoryOrdersError.value = null;
        detailsEncounterLaboratoryOrdersLoading.value = false;
        return;
    }

    const requestId = ++detailsEncounterLaboratoryOrdersRequestId;
    detailsEncounterLaboratoryOrdersLoading.value = true;
    detailsEncounterLaboratoryOrdersError.value = null;

    try {
        const orders = await requestEncounterLaboratoryOrders({
            patientId,
            appointmentId,
            admissionId,
        });

        if (requestId !== detailsEncounterLaboratoryOrdersRequestId) return;
        detailsEncounterLaboratoryOrders.value = orders;
    } catch (error) {
        if (requestId !== detailsEncounterLaboratoryOrdersRequestId) return;
        detailsEncounterLaboratoryOrders.value = [];
        detailsEncounterLaboratoryOrdersError.value = messageFromUnknown(
            error,
            'Unable to load linked laboratory orders.',
        );
    } finally {
        if (requestId === detailsEncounterLaboratoryOrdersRequestId) {
            detailsEncounterLaboratoryOrdersLoading.value = false;
        }
    }
}

async function loadCreateAppointmentReferrals() {
    const appointmentId = createForm.appointmentId.trim();

    if (
        !canReadAppointments.value ||
        !appointmentId ||
        !createForm.appointmentReferralId.trim()
    ) {
        createAppointmentReferrals.value = [];
        createAppointmentReferralsError.value = null;
        createAppointmentReferralsLoading.value = false;
        return;
    }

    const requestId = ++createAppointmentReferralsRequestId;
    createAppointmentReferralsLoading.value = true;
    createAppointmentReferralsError.value = null;

    try {
        const referrals = await requestAppointmentReferrals(appointmentId);
        if (requestId !== createAppointmentReferralsRequestId) return;
        createAppointmentReferrals.value = referrals;
    } catch (error) {
        if (requestId !== createAppointmentReferralsRequestId) return;
        createAppointmentReferrals.value = [];
        createAppointmentReferralsError.value = messageFromUnknown(
            error,
            'Unable to load linked referral handoff.',
        );
    } finally {
        if (requestId === createAppointmentReferralsRequestId) {
            createAppointmentReferralsLoading.value = false;
        }
    }
}

async function loadDetailsAppointmentReferrals(record: MedicalRecord | null) {
    const appointmentId = record?.appointmentId?.trim() ?? '';
    const appointmentReferralId = record?.appointmentReferralId?.trim() ?? '';

    if (!canReadAppointments.value || !appointmentId || !appointmentReferralId) {
        detailsAppointmentReferrals.value = [];
        detailsAppointmentReferralsError.value = null;
        detailsAppointmentReferralsLoading.value = false;
        return;
    }

    const requestId = ++detailsAppointmentReferralsRequestId;
    detailsAppointmentReferralsLoading.value = true;
    detailsAppointmentReferralsError.value = null;

    try {
        const referrals = await requestAppointmentReferrals(appointmentId);
        if (requestId !== detailsAppointmentReferralsRequestId) return;
        detailsAppointmentReferrals.value = referrals;
    } catch (error) {
        if (requestId !== detailsAppointmentReferralsRequestId) return;
        detailsAppointmentReferrals.value = [];
        detailsAppointmentReferralsError.value = messageFromUnknown(
            error,
            'Unable to load linked referral handoff.',
        );
    } finally {
        if (requestId === detailsAppointmentReferralsRequestId) {
            detailsAppointmentReferralsLoading.value = false;
        }
    }
}

async function loadDetailsEncounterPharmacyOrders(record: MedicalRecord | null) {
    const patientId = record?.patientId?.trim() ?? '';
    const appointmentId = record?.appointmentId?.trim() ?? '';
    const admissionId = record?.admissionId?.trim() ?? '';

    if (
        !canReadPharmacyOrders.value
        || !patientId
        || (!appointmentId && !admissionId)
    ) {
        detailsEncounterPharmacyOrders.value = [];
        detailsEncounterPharmacyOrdersError.value = null;
        detailsEncounterPharmacyOrdersLoading.value = false;
        return;
    }

    const requestId = ++detailsEncounterPharmacyOrdersRequestId;
    detailsEncounterPharmacyOrdersLoading.value = true;
    detailsEncounterPharmacyOrdersError.value = null;

    try {
        const orders = await requestEncounterPharmacyOrders({
            patientId,
            appointmentId,
            admissionId,
        });

        if (requestId !== detailsEncounterPharmacyOrdersRequestId) return;
        detailsEncounterPharmacyOrders.value = orders;
    } catch (error) {
        if (requestId !== detailsEncounterPharmacyOrdersRequestId) return;
        detailsEncounterPharmacyOrders.value = [];
        detailsEncounterPharmacyOrdersError.value = messageFromUnknown(
            error,
            'Unable to load linked pharmacy orders.',
        );
    } finally {
        if (requestId === detailsEncounterPharmacyOrdersRequestId) {
            detailsEncounterPharmacyOrdersLoading.value = false;
        }
    }
}

async function loadDetailsEncounterRadiologyOrders(record: MedicalRecord | null) {
    const patientId = record?.patientId?.trim() ?? '';
    const appointmentId = record?.appointmentId?.trim() ?? '';
    const admissionId = record?.admissionId?.trim() ?? '';

    if (
        !canReadRadiologyOrders.value
        || !patientId
        || (!appointmentId && !admissionId)
    ) {
        detailsEncounterRadiologyOrders.value = [];
        detailsEncounterRadiologyOrdersError.value = null;
        detailsEncounterRadiologyOrdersLoading.value = false;
        return;
    }

    const requestId = ++detailsEncounterRadiologyOrdersRequestId;
    detailsEncounterRadiologyOrdersLoading.value = true;
    detailsEncounterRadiologyOrdersError.value = null;

    try {
        const orders = await requestEncounterRadiologyOrders({
            patientId,
            appointmentId,
            admissionId,
        });

        if (requestId !== detailsEncounterRadiologyOrdersRequestId) return;
        detailsEncounterRadiologyOrders.value = orders;
    } catch (error) {
        if (requestId !== detailsEncounterRadiologyOrdersRequestId) return;
        detailsEncounterRadiologyOrders.value = [];
        detailsEncounterRadiologyOrdersError.value = messageFromUnknown(
            error,
            'Unable to load linked imaging orders.',
        );
    } finally {
        if (requestId === detailsEncounterRadiologyOrdersRequestId) {
            detailsEncounterRadiologyOrdersLoading.value = false;
        }
    }
}

async function loadDetailsEncounterTheatreProcedures(record: MedicalRecord | null) {
    const patientId = record?.patientId?.trim() ?? '';
    const appointmentId = record?.appointmentId?.trim() ?? '';
    const admissionId = record?.admissionId?.trim() ?? '';

    if (
        !canReadTheatreProcedures.value
        || !patientId
        || (!appointmentId && !admissionId)
    ) {
        detailsEncounterTheatreProcedures.value = [];
        detailsEncounterTheatreProceduresError.value = null;
        detailsEncounterTheatreProceduresLoading.value = false;
        return;
    }

    const requestId = ++detailsEncounterTheatreProceduresRequestId;
    detailsEncounterTheatreProceduresLoading.value = true;
    detailsEncounterTheatreProceduresError.value = null;

    try {
        const procedures = await requestEncounterTheatreProcedures({
            patientId,
            appointmentId,
            admissionId,
        });

        if (requestId !== detailsEncounterTheatreProceduresRequestId) return;
        detailsEncounterTheatreProcedures.value = procedures;
    } catch (error) {
        if (requestId !== detailsEncounterTheatreProceduresRequestId) return;
        detailsEncounterTheatreProcedures.value = [];
        detailsEncounterTheatreProceduresError.value = messageFromUnknown(
            error,
            'Unable to load linked theatre procedures.',
        );
    } finally {
        if (requestId === detailsEncounterTheatreProceduresRequestId) {
            detailsEncounterTheatreProceduresLoading.value = false;
        }
    }
}

function openRecordDetailsSheet(
    record: MedicalRecord,
    options?: {
        initialTab?: DetailsSheetTab;
        timelineRecordId?: string | null;
    },
) {
    detailsSheetRecord.value = record;
    detailsSheetTab.value = options?.initialTab === 'audit' && !canViewMedicalRecordAudit.value
        ? 'overview'
        : options?.initialTab ?? 'overview';
    resetDetailsTimelineState();
    detailsVersionsLoading.value = false;
    detailsVersionsError.value = null;
    detailsVersions.value = [];
    detailsVersionsMeta.value = null;
    detailsSelectedVersionId.value = '';
    detailsAgainstVersionId.value = '';
    detailsVersionDiffLoading.value = false;
    detailsVersionDiffError.value = null;
    detailsVersionDiff.value = null;
    detailsAttestationsLoading.value = false;
    detailsAttestationsError.value = null;
    detailsAttestations.value = [];
    detailsAttestationsMeta.value = null;
    detailsAttestationNote.value = '';
    detailsAttestationSubmitting.value = false;
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
    detailsEncounterLaboratoryOrders.value = [];
    detailsEncounterLaboratoryOrdersLoading.value = false;
    detailsEncounterLaboratoryOrdersError.value = null;
    detailsEncounterPharmacyOrders.value = [];
    detailsEncounterPharmacyOrdersLoading.value = false;
    detailsEncounterPharmacyOrdersError.value = null;
    detailsEncounterRadiologyOrders.value = [];
    detailsEncounterRadiologyOrdersLoading.value = false;
    detailsEncounterRadiologyOrdersError.value = null;
    detailsEncounterTheatreProcedures.value = [];
    detailsEncounterTheatreProceduresLoading.value = false;
    detailsEncounterTheatreProceduresError.value = null;
    if (record.patientId) {
        void hydratePatientSummary(record.patientId);
    }
    void loadDetailsEncounterLaboratoryOrders(record);
    void loadDetailsEncounterPharmacyOrders(record);
    void loadDetailsEncounterRadiologyOrders(record);
    void loadDetailsEncounterTheatreProcedures(record);
    const timelineRecordId = (options?.timelineRecordId ?? record.id).trim();
    if (timelineRecordId) {
        detailsTimelineAnchorRecordId.value = timelineRecordId;
        setDetailsTimelineRecordExpanded(timelineRecordId, true);
    }
    void loadDetailsVersions(record.id);
    void loadDetailsSignerAttestations(record.id);
    if (canViewMedicalRecordAudit.value) {
        void loadDetailsAuditLogs(record.id);
    }
    if (detailsSheetTab.value === 'timeline' && record.patientId) {
        void loadDetailsTimeline().then(() =>
            ensureDetailsTimelineContainsRecord(timelineRecordId),
        );
    }
    detailsSheetOpen.value = true;
}

function closeRecordDetailsSheet() {
    detailsSheetOpen.value = false;
    detailsSheetRecord.value = null;
    detailsSheetTab.value = 'overview';
    detailsVersionsLoading.value = false;
    detailsVersionsError.value = null;
    detailsVersions.value = [];
    detailsVersionsMeta.value = null;
    detailsSelectedVersionId.value = '';
    detailsAgainstVersionId.value = '';
    detailsVersionDiffLoading.value = false;
    detailsVersionDiffError.value = null;
    detailsVersionDiff.value = null;
    detailsAttestationsLoading.value = false;
    detailsAttestationsError.value = null;
    detailsAttestations.value = [];
    detailsAttestationsMeta.value = null;
    detailsAttestationNote.value = '';
    detailsAttestationSubmitting.value = false;
    detailsAuditLogs.value = [];
    detailsAuditMeta.value = null;
    detailsAuditError.value = null;
    detailsEncounterLaboratoryOrders.value = [];
    detailsEncounterLaboratoryOrdersLoading.value = false;
    detailsEncounterLaboratoryOrdersError.value = null;
    detailsEncounterPharmacyOrders.value = [];
    detailsEncounterPharmacyOrdersLoading.value = false;
    detailsEncounterPharmacyOrdersError.value = null;
    detailsEncounterRadiologyOrders.value = [];
    detailsEncounterRadiologyOrdersLoading.value = false;
    detailsEncounterRadiologyOrdersError.value = null;
    detailsEncounterTheatreProcedures.value = [];
    detailsEncounterTheatreProceduresLoading.value = false;
    detailsEncounterTheatreProceduresError.value = null;
    resetDetailsTimelineState();
}

function plainTextFromHtml(value: string | null): string | null {
    if (!value) return null;

    const raw = value.trim();
    if (!raw) return null;

    if (typeof window !== 'undefined') {
        const container = document.createElement('div');
        container.innerHTML = raw;
        const text = container.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        return text || null;
    }

    const text = raw
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text || null;
}

const scopeWarning = computed(() => {
    if (pageLoading.value) return null;
    if (!tenantIsolationEnabled.value) return null;
    if (!scope.value) return 'Platform access scope could not be loaded.';
    if (scope.value.resolvedFrom === 'none') {
        return 'No tenant/facility scope is resolved. Clinical documentation actions may be blocked by tenant isolation controls.';
    }
    return null;
});

const scopeStatusLabel = computed(() => {
    if (!scope.value) return 'Scope Unavailable';
    if (scope.value.resolvedFrom === 'none') return 'Scope Unresolved';
    return 'Scope Ready';
});

const visibleQueueCounts = computed(() => ({
    draft: records.value.filter((record) => record.status === 'draft').length,
    finalized: records.value.filter((record) => record.status === 'finalized')
        .length,
    amended: records.value.filter((record) => record.status === 'amended')
        .length,
    archived: records.value.filter((record) => record.status === 'archived')
        .length,
    other: records.value.filter(
        (record) =>
            record.status !== 'draft' &&
            record.status !== 'finalized' &&
            record.status !== 'amended' &&
            record.status !== 'archived',
    ).length,
}));

const summaryQueueCounts = computed(() => {
    const fallbackTotal = Math.max(
        visibleQueueCounts.value.draft +
            visibleQueueCounts.value.finalized +
            visibleQueueCounts.value.amended +
            visibleQueueCounts.value.archived +
            visibleQueueCounts.value.other,
        pagination.value?.total ?? 0,
    );

    if (!medicalRecordStatusCounts.value) {
        return {
            draft: visibleQueueCounts.value.draft,
            finalized: visibleQueueCounts.value.finalized,
            amended: visibleQueueCounts.value.amended,
            archived: visibleQueueCounts.value.archived,
            total: fallbackTotal,
        };
    }

    return {
        draft: medicalRecordStatusCounts.value.draft,
        finalized: medicalRecordStatusCounts.value.finalized,
        amended: medicalRecordStatusCounts.value.amended,
        archived: medicalRecordStatusCounts.value.archived,
        total: medicalRecordStatusCounts.value.total,
    };
});

const hasActiveRecordFilters = computed(() => {
    return Boolean(
        searchForm.q.trim() ||
        searchForm.patientId.trim() ||
        searchForm.appointmentReferralId.trim() ||
        searchForm.admissionId.trim() ||
        searchForm.status ||
        searchForm.recordType ||
        searchForm.to ||
        searchForm.from !== today,
    );
});

const hasAdvancedRecordFilters = computed(() => {
    return Boolean(
        searchForm.recordType || searchForm.to || searchForm.from !== today,
    );
});

function isRecordSummaryFilterActive(
    statusKey: 'draft' | 'finalized' | 'amended' | 'archived',
): boolean {
    return searchForm.status === statusKey;
}

function applyRecordSummaryFilter(
    statusKey: 'draft' | 'finalized' | 'amended' | 'archived',
) {
    clearSearchDebounce();
    searchForm.page = 1;
    searchForm.status = searchForm.status === statusKey ? '' : statusKey;
    void Promise.all([loadRecords(), loadRecordStatusCounts()]);
}

function queueCountLabel(count: number): string {
    return count > 99 ? '99+' : String(count);
}

function matchesMedicalRecordPreset(options: {
    tab?: 'new' | 'list';
    status?: string;
}): boolean {
    const expectedTab = options.tab ?? 'list';
    if (medicalRecordTab.value !== expectedTab) return false;

    if (expectedTab === 'new') {
        return true;
    }

    if (searchForm.q.trim()) return false;
    if (searchForm.patientId.trim()) return false;
    if (searchForm.recordType) return false;
    if (searchForm.to) return false;
    if (searchForm.from !== today) return false;

    return (options.status ?? '') === searchForm.status;
}

const medicalRecordQueuePresetState = computed(() => ({
    recordsToday: matchesMedicalRecordPreset({ tab: 'list', status: '' }),
    draftRecords: matchesMedicalRecordPreset({ tab: 'list', status: 'draft' }),
}));

const activeMedicalRecordListPresetLabel = computed(() => {
    if (medicalRecordQueuePresetState.value.draftRecords)
        return 'Draft Records';
    if (medicalRecordQueuePresetState.value.recordsToday)
        return 'Records Today';
    return null;
});

const activeEncounterDateFilterBadgeLabel = computed(() => {
    if (!searchForm.to && searchForm.from === today) return null;
    if (activeMedicalRecordListPresetLabel.value) return null;

    const from = searchForm.from.trim();
    const to = searchForm.to.trim();

    if (from && to && from === to) {
        return `Encounter Date: ${from}`;
    }

    return 'Encounter Date Active';
});

const medicalRecordListBadgeLabel = computed(() => {
    return (
        activeMedicalRecordListPresetLabel.value ||
        activeEncounterDateFilterBadgeLabel.value ||
        'Records Today'
    );
});

const recordToolbarStateLabel = computed(() => {
    const parts: string[] = [];

    if (hasActiveRecordFilters.value || hasAdvancedRecordFilters.value) {
        parts.push('Filtered');
    }

    return parts.length > 0 ? parts.join(' | ') : null;
});

type RecordDayGroup = {
    key: string;
    label: string;
    items: MedicalRecord[];
};

function dayKeyFromDateTime(value: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
}

function dayLabelFromDateTime(value: string | null): string {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown date';

    const todayDate = new Date();
    const todayKey = todayDate.toISOString().slice(0, 10);
    const yesterday = new Date(todayDate);
    yesterday.setDate(todayDate.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    const key = date.toISOString().slice(0, 10);
    if (key === todayKey) return 'Today';
    if (key === yesterdayKey) return 'Yesterday';

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

const groupedRecords = computed<RecordDayGroup[]>(() => {
    if (!records.value.length) return [];

    const groupsMap = new Map<string, RecordDayGroup>();

    for (const record of records.value) {
        const key = dayKeyFromDateTime(record.encounterAt) ?? 'unknown';
        const label =
            key === 'unknown'
                ? 'Unknown date'
                : dayLabelFromDateTime(record.encounterAt);

        if (!groupsMap.has(key)) {
            groupsMap.set(key, {
                key,
                label,
                items: [],
            });
        }

        groupsMap.get(key)!.items.push(record);
    }

    return Array.from(groupsMap.values());
});

const detailsTimelineGroups = computed<RecordDayGroup[]>(() => {
    if (!detailsTimelineRecords.value.length) return [];

    const groupsMap = new Map<string, RecordDayGroup>();

    for (const record of sortRecordsByOccurredAtDesc(
        detailsTimelineRecords.value,
    )) {
        const occurredAt = recordOccurredAt(record);
        const key = dayKeyFromDateTime(occurredAt) ?? 'unknown';
        const label =
            key === 'unknown'
                ? 'Unknown date'
                : dayLabelFromDateTime(occurredAt);

        if (!groupsMap.has(key)) {
            groupsMap.set(key, {
                key,
                label,
                items: [],
            });
        }

        groupsMap.get(key)!.items.push(record);
    }

    return Array.from(groupsMap.values());
});

const detailsTimelineHasMore = computed(() => {
    const meta = detailsTimelineMeta.value;
    if (!meta) return false;
    return meta.currentPage < meta.lastPage;
});

const activePatientSummary = computed<PatientSummary | null>(() => {
    const id = searchForm.patientId.trim();
    if (!id) return null;
    return patientDirectory.value[id] ?? null;
});

const activePatientChartHref = computed(() => {
    const id = searchForm.patientId.trim();
    if (!id) return '';
    return patientChartHref(id, {
        tab: 'records',
        from: 'medical-records',
    });
});

const focusedPatientRecords = computed(() => {
    const id = searchForm.patientId.trim();
    if (!id) return [] as MedicalRecord[];
    return records.value.filter((record) => record.patientId === id);
});

const focusedPatientLatestRecord = computed<MedicalRecord | null>(() => {
    if (!focusedPatientRecords.value.length) return null;
    return sortRecordsByOccurredAtDesc(focusedPatientRecords.value)[0] ?? null;
});

const focusedPatientChartSummary = computed(() => {
    const latestRecord = focusedPatientLatestRecord.value;
    const totalRecordsInView =
        pagination.value?.total ?? focusedPatientRecords.value.length;

    if (!latestRecord) {
        return {
            totalRecordsInView,
            latestStatusLabel: 'No chart note yet',
            latestStatusVariant: 'outline' as const,
            latestEncounterLabel: 'No prior encounter is visible in this chart view yet.',
            latestProblem:
                'No earlier medical record is loaded for this patient in the current view.',
            latestNextStep:
                'Start a consultation note to capture the first clinical assessment or expand the encounter date range to review older notes.',
        };
    }

    return {
        totalRecordsInView,
        latestStatusLabel: formatEnumLabel(latestRecord.status),
        latestStatusVariant: statusVariant(latestRecord.status),
        latestEncounterLabel:
            formatDateTime(recordOccurredAt(latestRecord)) ||
            'Encounter time unavailable',
        latestProblem: recordProblemFocus(latestRecord),
        latestNextStep: recordNextStepFocus(latestRecord),
    };
});

const createPatientSummary = computed<PatientSummary | null>(() => {
    const id = createForm.patientId.trim();
    if (!id) return null;
    return patientDirectory.value[id] ?? null;
});

const hasCreateAppointmentContext = computed(
    () => createForm.appointmentId.trim() !== '',
);

const hasCreateAdmissionContext = computed(
    () => createForm.admissionId.trim() !== '',
);

const createConsultationFromAppointments = computed(
    () => openedFromAppointments && hasCreateAppointmentContext.value,
);
const createLinkedTheatreProcedure = computed<TheatreProcedure | null>(() => {
    const procedureId = createForm.theatreProcedureId.trim();
    if (!procedureId) return null;

    return (
        createEncounterTheatreProcedures.value.find(
            (procedure) => procedure.id === procedureId,
        ) ?? null
    );
});
const createLinkedAppointmentReferral = computed<AppointmentReferral | null>(() => {
    const referralId = createForm.appointmentReferralId.trim();
    if (!referralId) return null;

    return (
        createAppointmentReferrals.value.find(
            (referral) => referral.id === referralId,
        ) ?? null
    );
});
const detailsLinkedTheatreProcedure = computed<TheatreProcedure | null>(() => {
    const procedureId = detailsSheetRecord.value?.theatreProcedureId?.trim() ?? '';
    if (!procedureId) return null;

    return (
        detailsEncounterTheatreProcedures.value.find(
            (procedure) => procedure.id === procedureId,
        ) ?? null
    );
});
const detailsLinkedAppointmentReferral = computed<AppointmentReferral | null>(() => {
    const referralId =
        detailsSheetRecord.value?.appointmentReferralId?.trim() ?? '';
    if (!referralId) return null;

    return (
        detailsAppointmentReferrals.value.find(
            (referral) => referral.id === referralId,
        ) ?? null
    );
});

const createEncounterSourceLabel = computed(() => {
    if (createForm.appointmentReferralId.trim()) {
        return 'Referral handoff';
    }

    if (createForm.theatreProcedureId.trim()) {
        return 'Theatre-linked encounter';
    }

    if (createConsultationFromAppointments.value) {
        return 'Appointment handoff';
    }

    if (hasCreateAppointmentContext.value) {
        return 'Appointment-linked encounter';
    }

    if (hasCreateAdmissionContext.value) {
        return 'Admission-linked encounter';
    }

    return 'Manual encounter';
});

const createEncounterSourceSummary = computed(() => {
    if (createForm.appointmentReferralId.trim()) {
        return 'This referral note stays attached to the linked referral handoff so the sending and receiving workflow remain traceable together.';
    }

    if (createForm.theatreProcedureId.trim()) {
        return 'This procedure note stays attached to the linked theatre case so operative documentation and theatre workflow remain traceable together.';
    }

    if (createIsDischargeNote.value && hasCreateAdmissionContext.value) {
        return 'This discharge note stays attached to the inpatient stay so the final clinical summary remains traceable alongside discharge readiness and disposition steps.';
    }

    if (createIsProgressNote.value && hasCreateAdmissionContext.value) {
        return 'This progress note stays attached to the inpatient stay so daily ward follow-up, treatment response, and discharge planning remain traceable together.';
    }

    if (createConsultationFromAppointments.value) {
        return 'This consultation started from the outpatient appointment workflow. Patient and visit context stay aligned while you chart.';
    }

    if (hasCreateAppointmentContext.value) {
        return 'This note stays attached to the linked outpatient visit for return-to-queue continuity.';
    }

    if (hasCreateAdmissionContext.value) {
        return 'This note stays attached to the inpatient stay for admission-level continuity.';
    }

    return 'Consultation notes should start from the appointment workflow so the patient, visit, and queue state stay aligned.';
});

const createConsultationTitle = computed(() => {
    if (normalizeRecordType(createForm.recordType) === 'procedure_note') {
        return 'Document procedure note';
    }

    if (normalizeRecordType(createForm.recordType) === 'referral_note') {
        return 'Document referral note';
    }

    if (createIsDischargeNote.value) {
        return 'Document discharge note';
    }

    if (createIsProgressNote.value) {
        return 'Document progress note';
    }

    if (normalizeRecordType(createForm.recordType) === 'nursing_note') {
        return 'Document nursing note';
    }

    if (normalizeRecordType(createForm.recordType) === 'admission_note') {
        return 'Document admission note';
    }

    if (createConsultationFromAppointments.value) {
        return 'Chart outpatient consultation';
    }

    if (hasCreateAdmissionContext.value) {
        return 'Chart inpatient encounter';
    }

    return 'Create consultation note';
});

const createConsultationDescription = computed(() => {
    if (normalizeRecordType(createForm.recordType) === 'procedure_note') {
        return 'Document the operative narrative against the linked theatre case and keep the procedure workflow traceable from charting.';
    }

    if (normalizeRecordType(createForm.recordType) === 'referral_note') {
        return 'Document the referral handoff against the linked visit so the transfer reason and receiving context remain clear.';
    }

    if (createIsDischargeNote.value) {
        return 'Document the final inpatient clinical summary against the linked admission and keep discharge closeout aligned.';
    }

    if (createIsProgressNote.value) {
        return 'Document interval inpatient follow-up against the linked admission and keep ward review continuity aligned.';
    }

    if (normalizeRecordType(createForm.recordType) === 'nursing_note') {
        return 'Document bedside nursing observations, interventions, and continuity notes against the linked inpatient context.';
    }

    if (normalizeRecordType(createForm.recordType) === 'admission_note') {
        return 'Document the opening inpatient clerking against the linked admission and keep the admission context aligned.';
    }

    if (createConsultationFromAppointments.value) {
        return 'This visit is already in the clinical handoff flow. Document the consultation and keep the appointment context intact.';
    }

    if (hasCreateAppointmentContext.value) {
        return 'Document this encounter with the linked appointment carried forward for traceability.';
    }

    if (hasCreateAdmissionContext.value) {
        return 'Document this encounter against the linked admission and keep inpatient context aligned.';
    }

    return 'This composer is meant for encounter-linked charting. Start the note from Appointments for outpatient visits, or from the linked admission flow for inpatient charting.';
});

const createWorkflowNextStepDescription = computed(() => {
    if (createConsultationFromAppointments.value) {
        return 'After charting, return to the appointment workflow or continue with orders and billing while keeping the same visit context.';
    }

    if (createIsDischargeNote.value && hasCreateAdmissionContext.value) {
        return 'After charting, return to the admissions workflow to review discharge readiness, destination, follow-up instructions, and final disposition.';
    }

    if (createIsProgressNote.value && hasCreateAdmissionContext.value) {
        return 'After charting, return to the ward or admissions workflow with the same stay context for bedside follow-up, care plans, orders, and discharge readiness.';
    }

    if (hasCreateAppointmentContext.value || hasCreateAdmissionContext.value) {
        return 'Open the next clinical or financial step with the same encounter context.';
    }

    return 'Open the next clinical or financial step with the same patient context.';
});

const createEncounterTimeLocked = computed(() =>
    hasCreateAppointmentContext.value,
);
const createPatientContextLabel = computed(() => {
    if (!createPatientSummary.value) {
        return createForm.patientId.trim()
            ? 'Selected patient'
            : 'Patient not selected';
    }

    return patientName(createPatientSummary.value);
});

const createPatientContextMeta = computed(() => {
    const summary = createPatientSummary.value;
    if (!summary) return 'Search and select the patient for this clinical note.';

    const patientNumber = summary.patientNumber?.trim();
    return patientNumber
        ? `Patient No. ${patientNumber}`
        : 'Patient record selected';
});

const createAppointmentContextLabel = computed(() => {
    const appointmentNumber =
        createAppointmentSummary.value?.appointmentNumber?.trim();
    if (appointmentNumber) return appointmentNumber;
    if (hasCreateAppointmentContext.value) return 'Linked appointment';
    return 'No linked appointment';
});

const createAppointmentContextMeta = computed(() => {
    if (createAppointmentSummaryLoading.value)
        return 'Loading appointment context...';
    if (createAppointmentSummaryError.value)
        return createAppointmentSummaryError.value;

    if (!createAppointmentSummary.value) {
        return hasCreateAppointmentContext.value
            ? 'Appointment summary will appear once the link is resolved.'
            : 'Link a provider-ready or active appointment when this note starts from the outpatient workflow.';
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
        parts.push('Linked from appointment handoff');
    }

    return parts.length > 0
        ? parts.join(' | ')
        : 'Linked appointment context ready';
});

const createAppointmentContextReason = computed(() => {
    const value = createAppointmentSummary.value?.reason?.trim();
    return value ? `Reason: ${value}` : null;
});

const createAdmissionContextLabel = computed(() => {
    const admissionNumber =
        createAdmissionSummary.value?.admissionNumber?.trim();
    if (admissionNumber) return admissionNumber;
    if (hasCreateAdmissionContext.value) return 'Linked admission';
    return 'No linked admission';
});

const createAdmissionContextMeta = computed(() => {
    if (createAdmissionSummaryLoading.value)
        return 'Loading admission context...';
    if (createAdmissionSummaryError.value)
        return createAdmissionSummaryError.value;

    if (!createAdmissionSummary.value) {
        return hasCreateAdmissionContext.value
            ? 'Admission summary will appear once the link is resolved.'
            : createForm.patientId.trim()
              ? 'Link an admission when this note belongs to an inpatient stay.'
              : 'Select a patient first, then optionally link an admission.';
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
    }

    return parts.length > 0
        ? parts.join(' | ')
        : 'Linked inpatient context ready';
});

const createAdmissionContextReason = computed(() => {
    const value = createAdmissionSummary.value?.statusReason?.trim();
    return value ? `Status note: ${value}` : null;
});
const createIsProgressNote = computed(
    () => normalizeRecordType(createForm.recordType) === 'progress_note',
);
const createIsDischargeNote = computed(
    () => normalizeRecordType(createForm.recordType) === 'discharge_note',
);
const createProgressNoteHistoryHref = computed(() => {
    const patientId = createForm.patientId.trim();
    const admissionId = createForm.admissionId.trim();

    if (!patientId || !admissionId) return null;

    const params = new URLSearchParams({
        tab: 'list',
        patientId,
        admissionId,
        recordType: 'progress_note',
    });

    return `/medical-records?${params.toString()}`;
});
const createDischargeNoteHistoryHref = computed(() => {
    const patientId = createForm.patientId.trim();
    const admissionId = createForm.admissionId.trim();

    if (!patientId || !admissionId) return null;

    const params = new URLSearchParams({
        tab: 'list',
        patientId,
        admissionId,
        recordType: 'discharge_note',
    });

    return `/medical-records?${params.toString()}`;
});
const createProgressNoteContinuitySummary = computed(() => {
    if (!createIsProgressNote.value) return null;

    if (!hasCreateAdmissionContext.value) {
        return 'Link this note to an active admission so daily inpatient follow-up stays attached to the correct ward stay.';
    }

    if (createAdmissionSummaryLoading.value) {
        return 'Loading inpatient stay continuity...';
    }

    if (createAdmissionSummaryError.value) {
        return createAdmissionSummaryError.value;
    }

    return 'Use progress notes for interval change, treatment response, and updated ward plans while keeping the admission note as the opening clerking summary for this stay.';
});
const createDischargeNoteContinuitySummary = computed(() => {
    if (!createIsDischargeNote.value) return null;

    if (!hasCreateAdmissionContext.value) {
        return 'Link this note to the admission being closed so the discharge summary stays attached to the correct inpatient stay.';
    }

    if (createAdmissionSummaryLoading.value) {
        return 'Loading discharge closeout context...';
    }

    if (createAdmissionSummaryError.value) {
        return createAdmissionSummaryError.value;
    }

    return 'Use the discharge note for the final clinical summary of the stay. Destination, follow-up routing, and readiness checks stay in the admission discharge workflow.';
});
const createLinkedTheatreProcedureHref = computed(() =>
    createForm.theatreProcedureId.trim()
        ? theatreProcedureFocusHref(createForm.theatreProcedureId, {
            patientId: createForm.patientId,
            appointmentId: createForm.appointmentId,
            admissionId: createForm.admissionId,
            focusWorkflowActionKey: 'procedure-note-continuity',
        })
        : null,
);
const createLinkedAppointmentReferralHref = computed(() =>
    createForm.appointmentId.trim() && createForm.appointmentReferralId.trim()
        ? appointmentReferralFocusHref(createForm.appointmentId, {
            patientId: createForm.patientId,
            referralId: createForm.appointmentReferralId,
        })
        : null,
);
const detailsLinkedTheatreProcedureHref = computed(() =>
    detailsSheetRecord.value?.theatreProcedureId?.trim()
        ? theatreProcedureFocusHref(detailsSheetRecord.value.theatreProcedureId, {
            patientId: detailsSheetRecord.value?.patientId,
            appointmentId: detailsSheetRecord.value?.appointmentId,
            admissionId: detailsSheetRecord.value?.admissionId,
            recordId: detailsSheetRecord.value?.id,
            focusWorkflowActionKey: 'procedure-note-continuity',
        })
        : null,
);
const detailsLinkedAppointmentReferralHref = computed(() =>
    detailsSheetRecord.value?.appointmentId?.trim() &&
        detailsSheetRecord.value?.appointmentReferralId?.trim()
        ? appointmentReferralFocusHref(detailsSheetRecord.value.appointmentId, {
            patientId: detailsSheetRecord.value.patientId,
            referralId: detailsSheetRecord.value.appointmentReferralId,
        })
        : null,
);

const createAppointmentContextStatusLabel = computed(() => {
    if (createAppointmentSummaryLoading.value) return 'Loading';
    const status = createAppointmentSummary.value?.status?.trim();
    if (!status) {
        return createConsultationFromAppointments.value
            ? 'Queue handoff'
            : hasCreateAppointmentContext.value
              ? 'Linked'
              : null;
    }

    switch (status.toLowerCase()) {
        case 'checked_in':
            return 'Arrived';
        case 'waiting_triage':
            return 'Waiting triage';
        case 'waiting_provider':
            return 'Ready for provider';
        case 'in_consultation':
            return 'In consultation';
        default:
            return formatEnumLabel(status);
    }
});

const createAppointmentContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    const normalizedStatus =
        createAppointmentSummary.value?.status?.trim().toLowerCase() ?? '';

    if (normalizedStatus === 'in_consultation') return 'default';
    if (normalizedStatus === 'waiting_provider') return 'default';
    if (normalizedStatus === 'waiting_triage') return 'outline';
    if (normalizedStatus === 'checked_in') return 'secondary';
    if (normalizedStatus === 'scheduled') return 'secondary';
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'no_show') {
        return 'destructive';
    }

    return 'outline';
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
    const normalizedStatus =
        createAdmissionSummary.value?.status?.trim().toLowerCase() ?? '';

    if (normalizedStatus === 'admitted') return 'default';
    if (normalizedStatus === 'discharged') return 'secondary';
    if (normalizedStatus === 'cancelled') return 'destructive';

    return 'outline';
});

const createAppointmentContextSourceLabel = computed(() => {
    if (!hasCreateAppointmentContext.value) return null;
    if (createAppointmentLinkSource.value === 'auto') return 'Auto-linked';
    if (createAppointmentLinkSource.value === 'route') return 'Route context';
    if (createAppointmentLinkSource.value === 'manual') return 'Chosen';
    return null;
});

const createAppointmentWorkflowStatus = computed(() =>
    normalizeAppointmentWorkflowStatus(createAppointmentSummary.value?.status),
);
const createAppointmentConsultationOwnerUserId = computed<number | null>(() => {
    const normalized = Number(
        createAppointmentSummary.value?.consultationOwnerUserId ?? 0,
    );
    return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
});
const createAppointmentConsultationOwnedByAnotherClinician = computed(
    () =>
        createAppointmentIsInConsultation.value &&
        currentUserId.value !== null &&
        createAppointmentConsultationOwnerUserId.value !== null &&
        createAppointmentConsultationOwnerUserId.value !== currentUserId.value,
);
const createAppointmentIsProviderReady = computed(
    () => createAppointmentWorkflowStatus.value === 'waiting_provider',
);
const createAppointmentIsInConsultation = computed(
    () => createAppointmentWorkflowStatus.value === 'in_consultation',
);
const canStartCreateConsultationSession = computed(
    () =>
        canCreateMedicalRecords.value &&
        canManageAppointmentProviderSession.value &&
        hasCreateAppointmentContext.value &&
        createAppointmentIsProviderReady.value,
);
const canTakeOverCreateConsultationSession = computed(
    () =>
        canCreateMedicalRecords.value &&
        canManageAppointmentProviderSession.value &&
        hasCreateAppointmentContext.value &&
        createAppointmentConsultationOwnedByAnotherClinician.value,
);
const canUseMedicalRecordComposer = computed(
    () => canCreateMedicalRecords.value,
);
const canLaunchConsultationFromAppointments = computed(
    () => canUseMedicalRecordComposer.value && canReadAppointments.value,
);
const canReturnToAppointments = computed(
    () => canReadAppointments.value && hasCreateAppointmentContext.value,
);
const canSaveAndReturnToAppointments = computed(
    () =>
        openedFromAppointments &&
        canReturnToAppointments.value &&
        hasCreateAppointmentContext.value,
);
const canSaveAndCompleteVisit = computed(
    () =>
        canCreateMedicalRecords.value &&
        canManageAppointmentProviderSession.value &&
        hasCreateAppointmentContext.value &&
        createAppointmentIsInConsultation.value,
);
const showCreateProviderSessionCard = computed(
    () =>
        canUseMedicalRecordComposer.value &&
        hasCreateAppointmentContext.value &&
        (canReturnToAppointments.value ||
            canStartCreateConsultationSession.value ||
            canTakeOverCreateConsultationSession.value ||
            canSaveAndCompleteVisit.value),
);
const createProviderSessionSummary = computed(() => {
    if (createAppointmentIsProviderReady.value) {
        return 'Nursing handoff is complete. Start the consultation session when the provider begins the encounter so charting and visit state stay aligned.';
    }

    if (createAppointmentConsultationOwnedByAnotherClinician.value) {
        return `This visit is currently owned by ${createConsultationOwnerDisplay()}. Confirm takeover before continuing documentation.`;
    }

    if (createAppointmentIsInConsultation.value) {
        return 'This visit is already in an active provider session. Save the note while documentation is still in progress, then close the visit when the encounter is operationally finished.';
    }

    return 'Return to the appointment workflow whenever you need queue visibility or operational controls for this visit.';
});
const createFooterWorkflowHint = computed(() => {
    if (canSaveAndCompleteVisit.value) {
        return 'Save note keeps the document in progress. Save note and close visit saves the note and closes the outpatient encounter.';
    }

    if (canSaveAndReturnToAppointments.value) {
        return 'Save note and return moves you back to Appointments after documentation is saved.';
    }

    return null;
});

function createConsultationOwnerDisplay(): string {
    const ownerUserId = createAppointmentConsultationOwnerUserId.value;
    if (ownerUserId === null) {
        return 'another clinician';
    }

    return `clinician #${ownerUserId}`;
}

function encounterCareState(
    count: number,
    loading: boolean,
    error?: string | null,
): EncounterCareState {
    if (loading) return 'loading';
    if (error) return 'issue';
    if (count > 0) return 'active';
    return 'empty';
}

function encounterCareStateLabel(state: EncounterCareState): string {
    switch (state) {
        case 'loading':
            return 'Loading';
        case 'active':
            return 'Has records';
        case 'issue':
            return 'Issue';
        default:
            return 'Empty';
    }
}

function encounterCareStateVariant(
    state: EncounterCareState,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (state) {
        case 'active':
            return 'secondary';
        case 'issue':
            return 'destructive';
        case 'loading':
            return 'outline';
        default:
            return 'outline';
    }
}

const createEncounterCareSummaries = computed<CreateEncounterCareSummary[]>(() => {
    const summaries: CreateEncounterCareSummary[] = [];

    if (canReadLaboratoryOrders.value) {
        summaries.push({
            id: 'laboratory-orders',
            label: 'Laboratory orders',
            singularLabel: 'order',
            pluralLabel: 'orders',
            description: 'Tests, specimen workflow, and result progression.',
            icon: 'flask-conical',
            count: createEncounterLaboratoryOrders.value.length,
            state: encounterCareState(
                createEncounterLaboratoryOrders.value.length,
                createEncounterLaboratoryOrdersLoading.value,
                createEncounterLaboratoryOrdersError.value,
            ),
        });
    }

    if (canReadPharmacyOrders.value) {
        summaries.push({
            id: 'pharmacy-orders',
            label: 'Pharmacy orders',
            singularLabel: 'order',
            pluralLabel: 'orders',
            description: 'Medication requests, dispensing status, and supply follow-up.',
            icon: 'pill',
            count: createEncounterPharmacyOrders.value.length,
            state: encounterCareState(
                createEncounterPharmacyOrders.value.length,
                createEncounterPharmacyOrdersLoading.value,
                createEncounterPharmacyOrdersError.value,
            ),
        });
    }

    if (canReadRadiologyOrders.value) {
        summaries.push({
            id: 'radiology-orders',
            label: 'Imaging orders',
            singularLabel: 'order',
            pluralLabel: 'orders',
            description: 'Scheduling, study execution, and reporting status.',
            icon: 'activity',
            count: createEncounterRadiologyOrders.value.length,
            state: encounterCareState(
                createEncounterRadiologyOrders.value.length,
                createEncounterRadiologyOrdersLoading.value,
                createEncounterRadiologyOrdersError.value,
            ),
        });
    }

    if (canReadTheatreProcedures.value) {
        summaries.push({
            id: 'theatre-procedures',
            label: 'Theatre procedures',
            singularLabel: 'procedure',
            pluralLabel: 'procedures',
            description: 'Bookings, pre-op readiness, and theatre progression.',
            icon: 'scissors',
            count: createEncounterTheatreProcedures.value.length,
            state: encounterCareState(
                createEncounterTheatreProcedures.value.length,
                createEncounterTheatreProceduresLoading.value,
                createEncounterTheatreProceduresError.value,
            ),
        });
    }

    return summaries;
});

const createEncounterCareVisibleSummaries = computed(() =>
    createEncounterCareSummaries.value.filter(
        (summary) => summary.state !== 'empty',
    ),
);

const hasCreateEncounterCareContext = computed(
    () =>
        Boolean(createForm.appointmentId.trim()) ||
        Boolean(createForm.admissionId.trim()),
);

const canShowCreateEncounterCare = computed(
    () =>
        Boolean(createForm.patientId.trim()) &&
        createEncounterCareSummaries.value.length > 0,
);

const hasVisibleCreateEncounterCare = computed(
    () => createEncounterCareVisibleSummaries.value.length > 0,
);

const canShowCreateWorkflowWorkspace = computed(
    () =>
        Boolean(createForm.patientId.trim()) &&
        (hasCreateContextWorkflowActions.value || canShowCreateEncounterCare.value),
);

const createEncounterCareTotalCount = computed(() =>
    createEncounterCareSummaries.value.reduce(
        (total, summary) => total + summary.count,
        0,
    ),
);

const createEncounterCareActiveCount = computed(
    () =>
        createEncounterCareSummaries.value.filter(
            (summary) => summary.state === 'active',
        ).length,
);

function syncCreateEncounterCareTab(): void {
    const available = createEncounterCareVisibleSummaries.value.map(
        (summary) => summary.id,
    );

    if (available.length === 0) {
        createEncounterCareTab.value = '';
        return;
    }

    if (!available.includes(createEncounterCareTab.value as CreateEncounterCareSectionId)) {
        createEncounterCareTab.value = available[0];
    }
}

watch(
    () => createEncounterCareVisibleSummaries.value.map((summary) => summary.id),
    () => {
        syncCreateEncounterCareTab();
    },
    { immediate: true },
);

watch(
    canShowCreateWorkflowWorkspace,
    (canShowWorkflow) => {
        if (!canShowWorkflow && createComposerWorkspaceTab.value === 'workflow') {
            createComposerWorkspaceTab.value = 'note';
        }
    },
    { immediate: true },
);


const createAdmissionContextSourceLabel = computed(() => {
    if (!hasCreateAdmissionContext.value) return null;
    if (createAdmissionLinkSource.value === 'auto') return 'Auto-linked';
    if (createAdmissionLinkSource.value === 'route') return 'Route context';
    if (createAdmissionLinkSource.value === 'manual') return 'Chosen';
    return null;
});


const hasCreateEncounterLinks = computed(
    () =>
        hasCreateAppointmentContext.value ||
        hasCreateAdmissionContext.value ||
        createAppointmentSummaryLoading.value ||
        createAdmissionSummaryLoading.value ||
        Boolean(createAppointmentSummaryError.value) ||
        Boolean(createAdmissionSummaryError.value),
);

const createComposerSectionItems = computed(() => [
    {
        id: 'mr-create-subjective-section',
        label: createSubjectiveLabel.value,
        complete: Boolean(createForm.subjective.trim()),
    },
    {
        id: 'mr-create-objective-section',
        label: createObjectiveLabel.value,
        complete: Boolean(createForm.objective.trim()),
    },
    {
        id: 'mr-create-assessment-section',
        label: createAssessmentLabel.value,
        complete: Boolean(createForm.assessment.trim()),
    },
    {
        id: 'mr-create-plan-section',
        label: createPlanLabel.value,
        complete: Boolean(createForm.plan.trim()),
    },
]);

function scrollCreateComposerToSection(sectionId: string) {
    document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function firstCreateErrorSectionId(): string {
    if (
        createErrors.value.patientId ||
        createErrors.value.appointmentId ||
        createErrors.value.admissionId
    ) {
        return 'mr-create-composer-top';
    }

    if (
        createErrors.value.encounterAt ||
        createErrors.value.recordType ||
        createErrors.value.diagnosisCode
    ) {
        return 'mr-create-composer-top';
    }

    if (createErrors.value.subjective) return 'mr-create-subjective-section';
    if (createErrors.value.objective) return 'mr-create-objective-section';
    if (createErrors.value.assessment) return 'mr-create-assessment-section';
    if (createErrors.value.plan) return 'mr-create-plan-section';

    return 'mr-create-composer-top';
}

function revealCreateErrors() {
    const targetId = firstCreateErrorSectionId();
    nextTick(() => {
        scrollCreateComposerToSection(targetId);
    });
}

const detailsTimelineJumpTargets = computed<TimelineJumpTarget[]>(() => {
    const currentRecordId = detailsSheetRecord.value?.id ?? '';

    return detailsTimelineGroups.value.map((group) => ({
        key: group.key,
        label: group.label,
        count: group.items.length,
        isCurrent: group.items.some((record) => record.id === currentRecordId),
    }));
});

const createErrorSummary = computed(() =>
    Object.entries(createErrors.value).flatMap(([field, messages]) =>
        messages.map((message, index) => ({
            key: `${field}-${index}-${message}`,
            message,
        })),
    ),
);

const hasCreateFeedback = computed(
    () => Boolean(createMessage.value) || createErrorSummary.value.length > 0,
);


const hasUnsavedCreateClinicalContent = computed(() =>
    hasClinicalCreateDraftPayload(buildMedicalRecordCreateDraftPayload()),
);

const hasPersistableCreateDraft = computed(() =>
    hasPersistableCreateDraftPayload(buildMedicalRecordCreateDraftPayload()),
);
const createDraftNoteTypeLabel = computed(() =>
    createRecordTypeLabel.value.toLowerCase(),
);

const createDraftStatusDescription = computed(() => {
    const savedAtLabel = createDraftLastSavedAt.value
        ? formatDateTime(createDraftLastSavedAt.value)
        : null;

    if (createDraftRecoveryAvailable.value) {
        return savedAtLabel
            ? `A locally saved ${createDraftNoteTypeLabel.value} draft from ${savedAtLabel} is available on this device.`
            : `A locally saved ${createDraftNoteTypeLabel.value} draft is available on this device.`;
    }

    if (createDraftRecovered.value) {
        return savedAtLabel
            ? `This ${createDraftNoteTypeLabel.value} draft was recovered and last autosaved at ${savedAtLabel}.`
            : `This ${createDraftNoteTypeLabel.value} draft was recovered from local autosave.`;
    }

    return savedAtLabel
        ? `This ${createDraftNoteTypeLabel.value} is autosaving locally on this device. Last saved at ${savedAtLabel}.`
        : `This ${createDraftNoteTypeLabel.value} is autosaving locally on this device.`;
});
const createDraftIndicatorLabel = computed(() => {
    if (!hasPersistableCreateDraft.value && !createDraftRecoveryAvailable.value) {
        return null;
    }

    if (createDraftAutosaving.value) {
        return 'Saving local draft...';
    }

    if (createDraftLastSavedAt.value) {
        return 'Saved locally ' + formatDateTime(createDraftLastSavedAt.value);
    }

    return 'Local draft protection active';
});
const detailsAgainstVersionOptions = computed(() =>
    detailsVersions.value.filter(
        (version) => version.id !== detailsSelectedVersionId.value,
    ),
);

watch(
    () => createForm.patientId,
    (value, previousValue) => {
        const patientId = value.trim();
        const previousPatientId = (previousValue ?? '').trim();
        if (patientId === previousPatientId) return;

        createContextAutoLinkSuppressed.appointment = false;
        createContextAutoLinkSuppressed.admission = false;

        if (!patientId) {
            createForm.appointmentReferralId = '';
            createForm.theatreProcedureId = '';
            if (createContextEditorTab.value === 'manual') {
                clearCreateAppointmentLink({
                    suppressAuto: false,
                    focusEditor: false,
                });
                clearCreateAdmissionLink({
                    suppressAuto: false,
                    focusEditor: false,
                });
                resetCreateContextSuggestions();
            }
            syncCreatePatientContextLock();
            return;
        }

        if (
            createContextEditorTab.value === 'manual' &&
            previousPatientId &&
            previousPatientId !== patientId
        ) {
            createForm.appointmentReferralId = '';
            createForm.theatreProcedureId = '';
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

        if (createContextEditorTab.value === 'manual') {
            void loadCreateContextSuggestions(patientId);
        } else {
            resetCreateContextSuggestions();
        }

        syncCreatePatientContextLock();
    },
    { immediate: true },
);

watch(
    () => createForm.appointmentId,
    (value, previousValue) => {
        const appointmentId = value.trim();
        if (appointmentId === (previousValue ?? '').trim()) return;

        if (!appointmentId) {
            createForm.appointmentReferralId = '';
        }

        if (pendingCreateAppointmentLinkSource !== null) {
            createAppointmentLinkSource.value =
                pendingCreateAppointmentLinkSource;
            pendingCreateAppointmentLinkSource = null;
        } else if (!appointmentId) {
            createAppointmentLinkSource.value = 'none';
        } else if (createAppointmentLinkSource.value !== 'route') {
            createAppointmentLinkSource.value = 'manual';
        }

        syncCreatePatientContextLock();
        void loadCreateAppointmentSummary(appointmentId);
    },
    { immediate: true },
);

watch(
    () => [
        createForm.appointmentId,
        createForm.appointmentReferralId,
        canReadAppointments.value,
    ],
    () => {
        void loadCreateAppointmentReferrals();
    },
    { immediate: true },
);

watch(
    () => createForm.admissionId,
    (value, previousValue) => {
        const admissionId = value.trim();
        if (admissionId === (previousValue ?? '').trim()) return;

        if (pendingCreateAdmissionLinkSource !== null) {
            createAdmissionLinkSource.value = pendingCreateAdmissionLinkSource;
            pendingCreateAdmissionLinkSource = null;
        } else if (!admissionId) {
            createAdmissionLinkSource.value = 'none';
        } else if (createAdmissionLinkSource.value !== 'route') {
            createAdmissionLinkSource.value = 'manual';
        }

        syncCreatePatientContextLock();
        void loadCreateAdmissionSummary(admissionId);
    },
    { immediate: true },
);

watch(
    () => [
        createForm.patientId,
        createForm.appointmentId,
        createForm.admissionId,
        canReadLaboratoryOrders.value,
        canReadPharmacyOrders.value,
        canReadRadiologyOrders.value,
        canReadTheatreProcedures.value,
    ],
    () => {
        void loadCreateEncounterLaboratoryOrders();
        void loadCreateEncounterPharmacyOrders();
        void loadCreateEncounterRadiologyOrders();
        void loadCreateEncounterTheatreProcedures();
    },
    { immediate: true },
);

watch(
    () => detailsSheetTab.value,
    (value) => {
        if (value !== 'timeline' || !detailsSheetRecord.value?.patientId)
            return;

        const highlightedRecordId =
            detailsTimelineAnchorRecordId.value.trim() ||
            detailsSheetRecord.value.id;

        if (
            detailsTimelineRecords.value.length === 0 &&
            !detailsTimelineLoading.value
        ) {
            void loadDetailsTimeline().then(() =>
                ensureDetailsTimelineContainsRecord(highlightedRecordId),
            );
            return;
        }

        void ensureDetailsTimelineContainsRecord(highlightedRecordId);
    },
);

watch(
    () => [
        detailsSheetRecord.value?.id ?? '',
        detailsSheetRecord.value?.patientId ?? '',
        detailsSheetRecord.value?.appointmentId ?? '',
        detailsSheetRecord.value?.appointmentReferralId ?? '',
        detailsSheetRecord.value?.admissionId ?? '',
        canReadAppointments.value,
        canReadLaboratoryOrders.value,
        canReadPharmacyOrders.value,
        canReadRadiologyOrders.value,
        canReadTheatreProcedures.value,
    ],
    () => {
        void loadDetailsAppointmentReferrals(detailsSheetRecord.value);
        void loadDetailsEncounterLaboratoryOrders(detailsSheetRecord.value);
        void loadDetailsEncounterPharmacyOrders(detailsSheetRecord.value);
        void loadDetailsEncounterRadiologyOrders(detailsSheetRecord.value);
        void loadDetailsEncounterTheatreProcedures(detailsSheetRecord.value);
    },
);

watch(
    () => canViewMedicalRecordAudit.value,
    (allowed) => {
        if (!allowed && detailsSheetTab.value === 'audit') {
            detailsSheetTab.value = 'overview';
        }
    },
);

watch(
    () => [
        detailsSheetOpen.value,
        detailsSheetRecord.value?.id ?? '',
        detailsSheetTab.value,
    ],
    () => {
        syncMedicalRecordUrlState();
    },
);

watch(
    () => [
        searchForm.q.trim(),
        searchForm.patientId.trim(),
        searchForm.appointmentReferralId.trim(),
        searchForm.admissionId.trim(),
        searchForm.status,
        searchForm.recordType.trim(),
        searchForm.from,
        searchForm.to,
    ],
    (value, previousValue) => {
        const currentState = JSON.stringify(value);
        const previousState = JSON.stringify(previousValue ?? []);
        if (currentState === previousState) return;

        clearSearchDebounce();
        searchDebounceTimer = window.setTimeout(() => {
            searchForm.page = 1;
            void Promise.all([loadRecords(), loadRecordStatusCounts()]);
            searchDebounceTimer = null;
        }, 350);
    },
);


watch(
    () => [
        createForm.patientId,
        createForm.appointmentId,
        createForm.admissionId,
        createForm.appointmentReferralId,
        createForm.theatreProcedureId,
        createForm.encounterAt,
        createForm.recordType,
        createForm.diagnosisCode,
        createForm.subjective,
        createForm.objective,
        createForm.assessment,
        createForm.plan,
    ],
    () => {
        scheduleMedicalRecordCreateDraftAutosave();
    },
);

onBeforeUnmount(() => {
    clearSearchDebounce();
    clearMedicalRecordCreateDraftAutosaveTimer();
    removeMedicalRecordsNavigationGuard?.();
    removeMedicalRecordsNavigationGuard = null;
});
onMounted(() => {
    initializeMedicalRecordCreateDraftRecovery();
    removeMedicalRecordsNavigationGuard = router.on('before', (event) => {
        if (shouldBypassMedicalRecordsLeaveGuardForVisit(event.detail.visit)) {
            return;
        }

        if (
            bypassMedicalRecordsNavigationGuard ||
            medicalRecordTab.value !== 'new' ||
            !hasUnsavedCreateClinicalContent.value
        ) {
            return;
        }

        pendingMedicalRecordsWorkspaceClose.value = null;
        pendingMedicalRecordsVisit.value = event.detail.visit;
        createLeaveConfirmOpen.value = true;
        event.preventDefault();
        return false;
    });

    void refreshPage().then(() => {
        if (initialTimelineRecordId) {
            void openRecordDetailsSheetFromQuery(initialTimelineRecordId);
        }
    });
});
</script>

<template>
    <Head title="Medical Records" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            class="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4 md:p-6"
        >
            <!-- PAGE HEADER -->
            <div
                class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
                <div class="min-w-0">
                    <h1
                        class="flex items-center gap-2 text-2xl font-semibold tracking-tight"
                    >
                        <AppIcon
                            name="stethoscope"
                            class="size-7 text-primary"
                        />
                        Medical Records
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Create and manage clinical notes with patient-safe
                        filters and clear status controls.
                    </p>
                    <Link
                        v-if="openedFromAppointments"
                        :href="appointmentReturnHref()"
                        class="mt-1 inline-flex text-xs text-muted-foreground underline underline-offset-2"
                    >
                        {{ tW2('return.backToAppointments') }}
                    </Link>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Popover v-if="canReadMedicalRecords">
                        <PopoverTrigger as-child>
                            <Button
                                variant="outline"
                                size="sm"
                                class="h-8 px-2.5"
                            >
                                <Badge
                                    :variant="
                                        scopeWarning
                                            ? 'destructive'
                                            : 'secondary'
                                    "
                                >
                                    {{ scopeStatusLabel }}
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="end"
                            class="w-72 space-y-1 text-xs"
                        >
                            <p v-if="scope?.tenant">
                                Tenant: {{ scope.tenant.name }} ({{
                                    scope.tenant.code
                                }})
                            </p>
                            <p v-if="scope?.facility">
                                Facility: {{ scope.facility.name }} ({{
                                    scope.facility.code
                                }})
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
                        v-if="canUseMedicalRecordComposer && (canReadAppointments || hasInitialConsultationEntryContext)"
                        :variant="medicalRecordTab === 'new' ? 'secondary' : 'default'"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="
                            medicalRecordTab === 'new'
                                ? openMedicalRecordWorkspace('list', {
                                      focusSearch: true,
                                  })
                                : beginNewConsultationWorkspace()
                        "
                    >
                        <AppIcon
                            :name="medicalRecordTab === 'new' ? 'circle-x' : 'stethoscope'"
                            class="size-3.5"
                        />
                        {{
                            medicalRecordTab === 'new'
                                ? 'Close Composer'
                                : hasInitialConsultationEntryContext ? 'Continue note' : 'Start note'
                        }}
                    </Button>
                </div>
            </div>

            <!-- SCOPE & ERROR ALERTS -->
            <Alert v-if="scopeWarning" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="alert-triangle" class="size-4" />
                    Scope warning
                </AlertTitle>
                <AlertDescription>{{ scopeWarning }}</AlertDescription>
            </Alert>
            <Alert v-if="actionMessage" class="border-primary/30 bg-primary/5 text-foreground">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div class="space-y-1">
                        <AlertTitle class="flex items-center gap-2">
                            <AppIcon name="check-circle" class="size-4" />
                            Note saved
                        </AlertTitle>
                        <AlertDescription>{{ actionMessage }}</AlertDescription>
                    </div>
                    <Button variant="ghost" size="sm" class="self-start" @click="actionMessage = null">
                        Dismiss
                    </Button>
                </div>
            </Alert>
            <Alert v-if="listErrors.length" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="circle-x" class="size-4" />
                    Request error
                </AlertTitle>
                <AlertDescription>
                    <div class="space-y-1">
                        <p
                            v-for="errorMessage in listErrors"
                            :key="errorMessage"
                            class="text-xs"
                        >
                            {{ errorMessage }}
                        </p>
                    </div>
                </AlertDescription>
            </Alert>

            <!-- Single column: chart workspace first, then encounter stream -->
            <div class="flex min-w-0 flex-col gap-4">
                <!-- Records list -->
                <div class="min-w-0">
                    <Card
                        v-if="
                            canReadMedicalRecords
                        "
                        id="consultation-records-list"
                        class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-sidebar-border/70 shadow-sm"
                    >
                        <CardHeader class="shrink-0 gap-5 border-b bg-muted/10 pb-5">
                            <div
                                class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"
                            >
                                <div class="min-w-0 space-y-3">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">
                                            Clinical records registry
                                        </Badge>
                                        <Badge
                                            v-if="openedFromAppointments && createForm.appointmentId.trim()"
                                            variant="outline"
                                        >
                                            Appointment handoff
                                        </Badge>
                                        <Badge v-if="recordToolbarStateLabel" variant="outline">
                                            {{ recordToolbarStateLabel }}
                                        </Badge>
                                    </div>
                                    <div class="space-y-1.5">
                                        <CardTitle class="flex items-center gap-2 text-xl">
                                            <AppIcon
                                                name="file-text"
                                                class="size-5 text-muted-foreground"
                                            />
                                            Clinical records
                                        </CardTitle>
                                        <CardDescription class="max-w-3xl text-sm leading-6">
                                            Review clinical notes across patients, narrow the registry when you need a specific chart, and use the patient chart page for full history review or chart-led note launch.
                                        </CardDescription>
                                    </div>
                                </div>
                                <div class="flex shrink-0 items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        @click="openChartFocusSelector"
                                    >
                                        <AppIcon name="user-round-search" class="size-3.5" />
                                        Open chart
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        @click="filterSheetOpen = true"
                                    >
                                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                                        Search & filter
                                        <Badge
                                            v-if="hasActiveRecordFilters"
                                            variant="secondary"
                                            class="ml-1 h-4 min-w-4 px-1 text-[10px]"
                                        >
                                            Active
                                        </Badge>
                                    </Button>
                                    <Button
                                        v-if="hasActiveRecordFilters"
                                        variant="ghost"
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="listLoading"
                                        @click="resetRecordFilters"
                                    >
                                        <AppIcon name="circle-x" class="size-3.5" />
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            <div class="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.85fr)]">
                                <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                    <button
                                        type="button"
                                        class="rounded-lg border bg-background/85 px-3 py-3 text-left transition-colors hover:bg-accent/40"
                                        :class="
                                            isRecordSummaryFilterActive('draft')
                                                ? 'border-primary bg-primary/10'
                                                : ''
                                        "
                                        @click="applyRecordSummaryFilter('draft')"
                                    >
                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                            Draft notes
                                        </p>
                                        <div class="mt-2 flex items-end justify-between gap-2">
                                            <span class="text-2xl font-semibold text-foreground">
                                                {{ queueCountLabel(summaryQueueCounts.draft) }}
                                            </span>
                                            <span class="text-xs text-muted-foreground">
                                                Needs review
                                            </span>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-lg border bg-background/85 px-3 py-3 text-left transition-colors hover:bg-accent/40"
                                        :class="
                                            isRecordSummaryFilterActive('finalized')
                                                ? 'border-primary bg-primary/10'
                                                : ''
                                        "
                                        @click="applyRecordSummaryFilter('finalized')"
                                    >
                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                            Finalized
                                        </p>
                                        <div class="mt-2 flex items-end justify-between gap-2">
                                            <span class="text-2xl font-semibold text-foreground">
                                                {{ queueCountLabel(summaryQueueCounts.finalized) }}
                                            </span>
                                            <span class="text-xs text-muted-foreground">
                                                Closed notes
                                            </span>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-lg border bg-background/85 px-3 py-3 text-left transition-colors hover:bg-accent/40"
                                        :class="
                                            isRecordSummaryFilterActive('amended')
                                                ? 'border-primary bg-primary/10'
                                                : ''
                                        "
                                        @click="applyRecordSummaryFilter('amended')"
                                    >
                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                            Amended
                                        </p>
                                        <div class="mt-2 flex items-end justify-between gap-2">
                                            <span class="text-2xl font-semibold text-foreground">
                                                {{ queueCountLabel(summaryQueueCounts.amended) }}
                                            </span>
                                            <span class="text-xs text-muted-foreground">
                                                Updated charting
                                            </span>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-lg border bg-background/85 px-3 py-3 text-left transition-colors hover:bg-accent/40"
                                        :class="
                                            isRecordSummaryFilterActive('archived')
                                                ? 'border-primary bg-primary/10'
                                                : ''
                                        "
                                        @click="applyRecordSummaryFilter('archived')"
                                    >
                                        <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                            Archived
                                        </p>
                                        <div class="mt-2 flex items-end justify-between gap-2">
                                            <span class="text-2xl font-semibold text-foreground">
                                                {{ queueCountLabel(summaryQueueCounts.archived) }}
                                            </span>
                                            <span class="text-xs text-muted-foreground">
                                                Historical view
                                            </span>
                                        </div>
                                    </button>
                                </div>

                                <div class="rounded-lg border bg-background/80 px-4 py-3">
                                    <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                        Quick views
                                    </p>
                                    <div class="mt-2 flex flex-wrap items-center gap-2">
                                        <Button
                                            size="sm"
                                            class="gap-1.5"
                                            :variant="
                                                medicalRecordQueuePresetState.recordsToday
                                                    ? 'default'
                                                    : 'outline'
                                            "
                                            as-child
                                        >
                                            <Link :href="`/medical-records?tab=list&from=${today}`">
                                                <AppIcon name="layout-list" class="size-3.5" />
                                                Today's stream
                                            </Link>
                                        </Button>
                                        <Button
                                            size="sm"
                                            class="gap-1.5"
                                            :variant="
                                                medicalRecordQueuePresetState.draftRecords
                                                    ? 'default'
                                                    : 'outline'
                                            "
                                            as-child
                                        >
                                            <Link :href="`/medical-records?tab=list&status=draft&from=${today}`">
                                                <AppIcon name="file-text" class="size-3.5" />
                                                Draft review
                                            </Link>
                                        </Button>
                                    </div>
                                    <div class="mt-3 flex flex-wrap items-center gap-1.5">
                                        <Badge variant="secondary">
                                            {{ medicalRecordListBadgeLabel }}
                                        </Badge>
                                        <Badge
                                            v-if="searchForm.q.trim()"
                                            variant="outline"
                                        >
                                            Search: {{ searchForm.q.trim() }}
                                        </Badge>
                                        <Badge
                                            v-if="searchForm.patientId.trim()"
                                            variant="outline"
                                        >
                                            Patient filter active
                                        </Badge>
                                        <Badge
                                            v-if="searchForm.appointmentReferralId.trim()"
                                            variant="outline"
                                        >
                                            Referral scope active
                                        </Badge>
                                        <Badge
                                            v-if="searchForm.admissionId.trim()"
                                            variant="outline"
                                        >
                                            Admission scope active
                                        </Badge>
                                        <Badge
                                            v-if="searchForm.status"
                                            variant="outline"
                                        >
                                            {{ formatEnumLabel(searchForm.status) }}
                                        </Badge>
                                        <Badge
                                            v-if="searchForm.recordType"
                                            variant="outline"
                                        >
                                            {{ recordTypeLabel(searchForm.recordType) }}
                                        </Badge>
                                        <Badge
                                            v-if="searchForm.to || searchForm.from !== today"
                                            variant="outline"
                                        >
                                            Encounter date
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div
                                v-if="activePatientSummary"
                                class="rounded-lg border bg-background/80 p-5"
                            >
                                <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div class="min-w-0 space-y-2">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Badge variant="secondary">
                                                Patient filter
                                            </Badge>
                                            <Badge variant="outline">
                                                {{ focusedPatientChartSummary.totalRecordsInView }}
                                                records in stream
                                            </Badge>
                                        </div>
                                        <div class="space-y-1">
                                            <p class="text-base font-semibold text-foreground">
                                                {{ patientName(activePatientSummary) }}
                                            </p>
                                            <p class="text-sm text-muted-foreground">
                                                Patient No. {{
                                                    activePatientSummary.patientNumber ||
                                                    shortId(activePatientSummary.id)
                                                }}
                                            </p>
                                            <p class="text-sm text-muted-foreground">
                                                The registry is currently narrowed to one patient. Open the patient chart for full history review, chart navigation, and patient-led note launch.
                                            </p>
                                        </div>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            class="gap-1.5"
                                            as-child
                                        >
                                            <Link :href="activePatientChartHref">
                                                <AppIcon name="book-open" class="size-3.5" />
                                                Open patient chart
                                            </Link>
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            class="gap-1.5"
                                            @click="openChartFocusSelector"
                                        >
                                            <AppIcon name="user-round-search" class="size-3.5" />
                                            Open another chart
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            class="gap-1.5"
                                            @click="clearChartFocus"
                                        >
                                            <AppIcon name="circle-x" class="size-3.5" />
                                            Clear patient filter
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div
                                v-else
                                class="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-background/70 px-4 py-2.5"
                            >
                                <p class="text-sm text-muted-foreground">Showing all patients &middot; <button type="button" class="text-primary hover:underline" @click="openChartFocusSelector">Open a patient chart to focus</button></p>
                                <Button
                                    v-if="canLaunchConsultationFromAppointments"
                                    size="sm"
                                    class="shrink-0 gap-1.5"
                                    @click="beginNewConsultationWorkspace()"
                                >
                                    <AppIcon name="stethoscope" class="size-3.5" />
                                    Start from Appointments
                                </Button>
                            </div>

                            <div class="border-t pt-4">
                                <div class="space-y-1">
                                    <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                        Encounter stream
                                    </p>
                                    <p class="text-sm text-muted-foreground">
                                        {{ pagination?.total ?? 0 }} records ordered as a clinical stream for review, handoff, and follow-up.
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent
                            class="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0"
                        >
                            <ScrollArea class="min-h-0 flex-1">
                                <div
                                    class="space-y-3 p-4"
                                >
                                    <div
                                        v-if="
                                            (pageLoading || listLoading) &&
                                            records.length === 0
                                        "
                                        class="space-y-2"
                                    >
                                        <Skeleton class="h-24 w-full" />
                                        <Skeleton class="h-24 w-full" />
                                        <Skeleton class="h-24 w-full" />
                                    </div>
                                    <div
                                        v-else-if="records.length === 0"
                                        class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                                    >
                                        No medical records found for the current
                                        filters.
                                    </div>
                                    <div
                                        v-else
                                        class="space-y-4"
                                    >
                                        <div
                                            v-for="group in groupedRecords"
                                            :key="group.key"
                                            class="space-y-2"
                                        >
                                            <div
                                                class="flex items-center gap-2 text-xs text-muted-foreground"
                                            >
                                                <div
                                                    class="h-px flex-1 bg-border"
                                                />
                                                <span
                                                    class="font-medium whitespace-nowrap"
                                                >
                                                    {{ group.label }}
                                                </span>
                                                <div
                                                    class="h-px flex-1 bg-border"
                                                />
                                            </div>
                                            <div class="space-y-2">
                                                <div
                                                    v-for="record in group.items"
                                                    :key="record.id"
                                                    :class="['rounded-lg border transition-colors', recordAccentClass(record.status)]"
                                                >
                                                    <!-- Collapsed summary row — always visible -->
                                                    <button
                                                        type="button"
                                                        class="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                                                        @click="toggleListRow(record.id)"
                                                    >
                                                        <AppIcon
                                                            :name="expandedListRowIds[record.id] ? 'chevron-down' : 'chevron-right'"
                                                            class="size-3.5 shrink-0 text-muted-foreground"
                                                        />
                                                        <span class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                                                            {{ record.recordNumber || 'Medical Record' }}
                                                        </span>
                                                        <span class="hidden shrink-0 truncate text-xs text-muted-foreground sm:block">
                                                            {{ recordPatientLabel(record) }}
                                                        </span>
                                                        <span class="hidden shrink-0 text-xs text-muted-foreground lg:block">
                                                            {{ formatDateTime(record.encounterAt) }}
                                                        </span>
                                                        <Badge :variant="statusVariant(record.status)" class="shrink-0">
                                                            {{ (record.status || 'unknown').replace('_', ' ') }}
                                                        </Badge>
                                                        <Badge variant="outline" class="hidden shrink-0 sm:inline-flex">
                                                            {{ recordTypeLabel(record.recordType) }}
                                                        </Badge>
                                                    </button>

                                                    <!-- Expanded body — hidden by default -->
                                                    <div v-if="expandedListRowIds[record.id]" class="border-t px-3 pb-3 pt-2.5">
                                                        <div class="space-y-2.5">
                                                            <!-- Meta grid -->
                                                            <div class="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 md:gap-x-6">
                                                                <p>Patient: {{ recordPatientLabel(record) }}<span v-if="recordPatientNumber(record)" class="ml-1">({{ recordPatientNumber(record) }})</span></p>
                                                                <p>Encounter: {{ formatDateTime(record.encounterAt) }}</p>
                                                                <p>Appointment: {{ shortId(record.appointmentId) }}</p>
                                                                <p>Diagnosis: {{ record.diagnosisCode || 'N/A' }}</p>
                                                            </div>

                                                            <!-- SOAP summary -->
                                                            <div class="grid gap-2 lg:grid-cols-2">
                                                                <div class="rounded-md bg-muted/30 px-2.5 py-2">
                                                                    <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Problem focus</p>
                                                                    <p class="mt-1 text-sm leading-5 text-foreground">{{ recordProblemFocus(record) }}</p>
                                                                </div>
                                                                <div class="rounded-md bg-muted/30 px-2.5 py-2">
                                                                    <p class="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Next step</p>
                                                                    <p class="mt-1 text-sm leading-5 text-muted-foreground">{{ recordNextStepFocus(record) }}</p>
                                                                </div>
                                                            </div>
                                                            <p v-if="record.statusReason" class="text-xs text-muted-foreground">Status note: {{ record.statusReason }}</p>

                                                            <!-- Actions -->
                                                            <div class="flex flex-wrap items-center gap-1.5 border-t pt-2.5">
                                                                <Button size="sm" variant="outline" @click="openRecordDetailsSheet(record)">Details</Button>

                                                                <!-- Primary status action -->
                                                                <Button
                                                                    v-if="canApplyMedicalRecordStatusAction('finalized', record)"
                                                                    size="sm"
                                                                    :disabled="actionLoadingId === record.id"
                                                                    @click="finalizeRecord(record)"
                                                                >{{ actionLoadingId === record.id ? 'Updating...' : 'Finalize note' }}</Button>
                                                                <Button
                                                                    v-if="canApplyMedicalRecordStatusAction('amended', record)"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    :disabled="actionLoadingId === record.id"
                                                                    @click="openRecordStatusDialog(record, 'amended')"
                                                                >{{ actionLoadingId === record.id ? 'Updating...' : 'Amend' }}</Button>

                                                                <!-- Order care dropdown -->
                                                                <DropdownMenu v-if="record.patientId && (canOpenLaboratoryWorkflow || canOpenPharmacyWorkflow || canOpenRadiologyWorkflow || canOpenTheatreWorkflow || canOpenBillingWorkflow)">
                                                                    <DropdownMenuTrigger as-child>
                                                                        <Button size="sm" variant="outline" class="gap-1.5">
                                                                            <AppIcon name="plus" class="size-3.5" />Order care
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="start" class="w-48">
                                                                        <DropdownMenuItem v-if="canOpenLaboratoryWorkflow" as-child>
                                                                            <Link :href="recordContextHref('/laboratory-orders', record)" class="flex items-center gap-2">
                                                                                <AppIcon name="flask-conical" class="size-3.5" />Order Lab
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem v-if="canOpenPharmacyWorkflow" as-child>
                                                                            <Link :href="recordContextHref('/pharmacy-orders', record, { includeTabNew: true })" class="flex items-center gap-2">
                                                                                <AppIcon name="pill" class="size-3.5" />Order Pharmacy
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem v-if="canOpenRadiologyWorkflow" as-child>
                                                                            <Link :href="recordContextHref('/radiology-orders', record)" class="flex items-center gap-2">
                                                                                <AppIcon name="activity" class="size-3.5" />Order Imaging
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem v-if="canOpenTheatreWorkflow" as-child>
                                                                            <Link :href="recordContextHref('/theatre-procedures', record, { includeTabNew: true })" class="flex items-center gap-2">
                                                                                <AppIcon name="scissors" class="size-3.5" />Schedule Procedure
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator v-if="canOpenBillingWorkflow" />
                                                                        <DropdownMenuItem v-if="canOpenBillingWorkflow" as-child>
                                                                            <Link :href="recordContextHref('/billing-invoices', record)" class="flex items-center gap-2">
                                                                                <AppIcon name="receipt" class="size-3.5" />Open Billing
                                                                            </Link>
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>

                                                                <!-- Return to appointments -->
                                                                <Button
                                                                    v-if="openedFromAppointments || record.appointmentId"
                                                                    size="sm"
                                                                    variant="outline"
                                                                    as-child
                                                                >
                                                                    <Link :href="appointmentReturnHref(record.appointmentId)">
                                                                        {{ tW2('return.backToAppointments') }}
                                                                    </Link>
                                                                </Button>

                                                                <!-- Exceptions dropdown (archive) -->
                                                                <DropdownMenu v-if="canApplyMedicalRecordStatusAction('archived', record)">
                                                                    <DropdownMenuTrigger as-child>
                                                                        <Button size="sm" variant="outline" :disabled="actionLoadingId === record.id">Exceptions</Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" class="w-44">
                                                                        <DropdownMenuItem
                                                                            class="text-destructive focus:text-destructive"
                                                                            :disabled="actionLoadingId === record.id"
                                                                            @select.prevent="openRecordStatusDialog(record, 'archived')"
                                                                        >Archive Record</DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                            <div class="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2.5">
                                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                                    <template v-if="pagination">{{ pagination.total }} records</template>
                                    <template v-else>—</template>
                                    <select
                                        :value="searchForm.perPage"
                                        class="h-6 rounded border border-input bg-transparent px-1 text-xs text-foreground outline-none focus:border-ring"
                                        @change="changePerPage(Number(($event.target as HTMLSelectElement).value))"
                                    >
                                        <SelectItem value="10">10 / page</SelectItem>
                                        <SelectItem value="25">25 / page</SelectItem>
                                        <SelectItem value="50">50 / page</SelectItem>
                                    </select>
                                </div>
                                <div class="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="h-7 w-7 p-0"
                                        :disabled="!pagination || pagination.currentPage <= 1 || listLoading"
                                        @click="prevPage"
                                    >
                                        <AppIcon name="chevron-left" class="size-3.5" />
                                    </Button>
                                    <span v-if="pagination" class="min-w-[4.5rem] text-center text-xs text-muted-foreground">
                                        {{ pagination.currentPage }} / {{ pagination.lastPage }}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="h-7 w-7 p-0"
                                        :disabled="!pagination || pagination.currentPage >= pagination.lastPage || listLoading"
                                        @click="nextPage"
                                    >
                                        <AppIcon name="chevron-right" class="size-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card
                        v-else-if="!pageLoading"
                        class="rounded-lg border-sidebar-border/70"
                    >
                        <CardHeader>
                            <CardTitle>Consultation Records</CardTitle>
                            <CardDescription>
                                You do not have permission to view consultation
                                records.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Alert variant="destructive">
                                <AlertTitle>Read access restricted</AlertTitle>
                                <AlertDescription>
                                    Request
                                    <code>medical.records.read</code> permission
                                    to open records list and filters.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </div>
                <Dialog v-model:open="chartFocusSelectorOpen">
                    <DialogContent variant="form" size="xl">
                        <DialogHeader class="space-y-2">
                            <DialogTitle class="flex items-center gap-2">
                                <AppIcon name="user-round-search" class="size-4 text-muted-foreground" />
                                Open patient chart
                            </DialogTitle>
                            <DialogDescription>
                                Select a patient to leave the records registry and open the dedicated patient chart workspace.
                            </DialogDescription>
                        </DialogHeader>
                        <div class="space-y-4 py-1">
                            <PatientLookupField
                                input-id="mr-chart-focus-patient-id"
                                v-model="chartFocusDraftPatientId"
                                label="Patient"
                                placeholder="Search patient by name, number, phone, email, or national ID"
                                helper-text="Selecting a patient opens the chart page instead of filtering this registry."
                                mode="filter"
                                :open-on-focus="true"
                                @selected="($event?.id ?? '') && applyChartFocus($event.id)"
                            />
                            <div class="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                Use the registry when you are reviewing records across patients. Use the patient chart when one patient becomes the center of the work.
                            </div>
                        </div>
                        <DialogFooter class="gap-2 sm:justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                @click="chartFocusSelectorOpen = false"
                            >
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <!-- Consultation composer -->
                <Sheet
                    :open="canUseMedicalRecordComposer && medicalRecordTab === 'new'"
                    @update:open="(open) => openMedicalRecordWorkspace(open ? 'new' : 'list', { focusSearch: !open })"
                >
                    <SheetContent
                        side="right"
                        variant="workspace"
                    >
                        <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0 space-y-1">
                                    <div class="flex flex-wrap items-center gap-1.5">
                                        <Badge
                                            v-if="createForm.theatreProcedureId.trim()"
                                            variant="default"
                                        >
                                            Theatre case
                                        </Badge>
                                        <Badge
                                            v-else-if="createConsultationFromAppointments"
                                            variant="default"
                                        >
                                            Appointment handoff
                                        </Badge>
                                        <Badge
                                            v-else-if="hasCreateAppointmentContext"
                                            variant="secondary"
                                        >
                                            Linked appointment
                                        </Badge>
                                        <Badge
                                            v-else-if="hasCreateAdmissionContext"
                                            variant="secondary"
                                        >
                                            Admission context
                                        </Badge>
                                        <Badge v-else variant="outline">
                                            Manual encounter
                                        </Badge>
                                        <Badge
                                            v-if="createPatientContextLocked"
                                            variant="outline"
                                            class="text-[10px]"
                                        >
                                            Locked
                                        </Badge>
                                    </div>
                                    <SheetTitle class="flex items-center gap-2 text-base">
                                        <AppIcon name="stethoscope" class="size-4 text-primary" />
                                        {{
                                            createForm.patientId.trim()
                                                ? createPatientContextLabel
                                                : createConsultationTitle
                                        }}
                                    </SheetTitle>
                                    <SheetDescription v-if="createForm.patientId.trim()" class="text-xs">
                                        {{ createPatientContextMeta }}
                                        <span v-if="createEncounterSourceSummary" class="ml-1 text-muted-foreground/70">· {{ createEncounterSourceSummary }}</span>
                                    </SheetDescription>
                                    <SheetDescription v-else class="text-xs">
                                        {{ createConsultationDescription }}
                                    </SheetDescription>
                                </div>
                            </div>
                            <!-- Session action strip — only visible when provider action needed -->
                            <div
                                v-if="canTakeOverCreateConsultationSession || canStartCreateConsultationSession || canReturnToAppointments"
                                class="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30"
                            >
                                <AppIcon name="shield-alert" class="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                <p class="mr-auto text-xs text-amber-800 dark:text-amber-300">
                                    {{ canTakeOverCreateConsultationSession ? 'Another provider owns this session.' : canStartCreateConsultationSession ? 'Session not started yet.' : 'Return to appointment when done.' }}
                                </p>
                                <Button
                                    v-if="canTakeOverCreateConsultationSession"
                                    size="sm"
                                    class="h-7 gap-1 px-2.5 text-xs"
                                    :disabled="createConsultationTakeoverSubmitting"
                                    @click="openCreateConsultationTakeoverDialog()"
                                >
                                    Take over
                                </Button>
                                <Button
                                    v-if="canStartCreateConsultationSession"
                                    size="sm"
                                    class="h-7 gap-1 px-2.5 text-xs"
                                    :disabled="createProviderSessionSubmitting"
                                    @click="void startCreateAppointmentConsultationSession()"
                                >
                                    {{ createProviderSessionSubmitting ? 'Starting...' : 'Start session' }}
                                </Button>
                                <Button
                                    v-if="canReturnToAppointments"
                                    variant="outline"
                                    size="sm"
                                    as-child
                                    class="h-7 gap-1 px-2.5 text-xs"
                                >
                                    <Link :href="appointmentReturnHref(createForm.appointmentId)">
                                        {{ tW2('return.backToAppointments') }}
                                    </Link>
                                </Button>
                            </div>
                        </SheetHeader>
                        <ScrollArea class="min-h-0 flex-1">
                            <Tabs v-model="createComposerWorkspaceTab" class="min-h-full">
                                <div class="sticky top-0 z-20 border-b bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                    <div class="flex items-center justify-between gap-3">
                                        <TabsList class="!inline-flex !h-auto min-h-8 shrink-0 gap-1 rounded-lg bg-muted/30 p-1">
                                            <TabsTrigger value="note" class="gap-1.5 px-3 text-xs">
                                                Note
                                            </TabsTrigger>
                                            <TabsTrigger
                                                v-if="canShowCreateWorkflowWorkspace"
                                                value="workflow"
                                                class="gap-1.5 px-3 text-xs"
                                            >
                                                Orders & care
                                            </TabsTrigger>
                                        </TabsList>
                                        <div
                                            v-if="createComposerWorkspaceTab === 'note'"
                                            class="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
                                        >
                                            <div class="flex shrink-0 items-center gap-1.5 pl-1">
                                                <Button
                                                    v-for="section in createComposerSectionItems"
                                                    :key="section.id"
                                                    size="sm"
                                                    :variant="section.complete ? 'secondary' : 'ghost'"
                                                    class="h-7 shrink-0 gap-1 px-2 text-xs"
                                                    @click="scrollCreateComposerToSection(section.id)"
                                                >
                                                    <AppIcon
                                                        :name="section.complete ? 'circle-check-big' : 'chevron-right'"
                                                        class="size-3"
                                                    />
                                                    {{ section.label }}
                                                </Button>
                                            </div>
                                            <span
                                                v-if="createDraftIndicatorLabel"
                                                class="ml-auto shrink-0 text-[11px] text-muted-foreground/70"
                                            >
                                                <Spinner v-if="createDraftAutosaving" class="mr-1 inline size-2.5" />
                                                {{ createDraftIndicatorLabel }}
                                            </span>
                                        </div>
                                        <p
                                            v-else
                                            class="text-xs text-muted-foreground"
                                        >
                                            Orders & care linked to this encounter.
                                        </p>
                                    </div>
                                </div>
                                <div id="mr-create-composer-top">
                                <div v-if="createMessage || createErrorSummary.length" class="border-b px-6 py-4 space-y-3">
                                <Alert
                                    v-if="createMessage"
                                    class="flex items-center gap-2"
                                >
                                    <AlertTitle
                                        ><AppIcon
                                            name="check-circle"
                                            class="size-4"
                                        />Clinical record saved</AlertTitle
                                    >
                                    <AlertDescription>{{
                                        createMessage
                                    }}</AlertDescription>
                                </Alert>

                                <Alert
                                    v-if="createErrorSummary.length"
                                    variant="destructive"
                                >
                                    <AlertTitle class="flex items-center gap-2">
                                        <AppIcon name="circle-x" class="size-4" />
                                        Clinical record entry needs attention
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
                                </div>

                                <TabsContent
                                    v-if="canShowCreateWorkflowWorkspace"
                                    value="workflow"
                                    class="mt-0"
                                >
                                    <section class="border-b px-6 py-5 space-y-4">
                                        <div class="space-y-3">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <Badge :variant="createConsultationFromAppointments ? 'default' : hasCreateAppointmentContext ? 'secondary' : hasCreateAdmissionContext ? 'secondary' : 'outline'">
                                                    {{ createEncounterSourceLabel }}
                                                </Badge>
                                                <Badge
                                                    v-if="createAppointmentContextStatusLabel"
                                                    :variant="createAppointmentContextStatusVariant"
                                                    class="text-[10px]"
                                                >
                                                    {{ createAppointmentContextStatusLabel }}
                                                </Badge>
                                                <Badge
                                                    v-if="createAdmissionContextStatusLabel"
                                                    :variant="createAdmissionContextStatusVariant"
                                                    class="text-[10px]"
                                                >
                                                    {{ createAdmissionContextStatusLabel }}
                                                </Badge>
                                            </div>

                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                    Orders and care
                                                </p>
                                                <p class="text-sm text-muted-foreground">
                                                    {{ createWorkflowNextStepDescription }}
                                                </p>
                                                <p
                                                    v-if="showCreateProviderSessionCard"
                                                    class="text-xs leading-5 text-muted-foreground"
                                                >
                                                    {{ createProviderSessionSummary }}
                                                </p>
                                            </div>
                                        </div>

                                        <div
                                            v-if="createForm.patientId && hasCreateContextWorkflowActions"
                                            class="pt-1"
                                        >
                                            <DropdownMenu>
                                                <DropdownMenuTrigger as-child>
                                                    <Button variant="outline" size="sm" class="gap-1.5">
                                                        <AppIcon name="plus" class="size-3.5" />
                                                        New order
                                                        <AppIcon name="chevron-down" class="size-3 text-muted-foreground" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start">
                                                    <DropdownMenuItem v-if="canOpenLaboratoryWorkflow" as-child>
                                                        <Link :href="contextCreateHref('/laboratory-orders', { includeTabNew: true })" class="flex items-center gap-2">
                                                            <AppIcon name="flask-conical" class="size-3.5 text-muted-foreground" />
                                                            Lab order
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem v-if="canOpenPharmacyWorkflow" as-child>
                                                        <Link :href="contextCreateHref('/pharmacy-orders', { includeTabNew: true })" class="flex items-center gap-2">
                                                            <AppIcon name="pill" class="size-3.5 text-muted-foreground" />
                                                            Pharmacy order
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem v-if="canOpenRadiologyWorkflow" as-child>
                                                        <Link :href="contextCreateHref('/radiology-orders', { includeTabNew: true })" class="flex items-center gap-2">
                                                            <AppIcon name="activity" class="size-3.5 text-muted-foreground" />
                                                            Imaging order
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem v-if="canOpenTheatreWorkflow" as-child>
                                                        <Link :href="contextCreateHref('/theatre-procedures', { includeTabNew: true })" class="flex items-center gap-2">
                                                            <AppIcon name="scissors" class="size-3.5 text-muted-foreground" />
                                                            Theatre procedure
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator v-if="canOpenBillingWorkflow" />
                                                    <DropdownMenuItem v-if="canOpenBillingWorkflow" as-child>
                                                        <Link :href="contextCreateHref('/billing-invoices', { includeTabNew: true })" class="flex items-center gap-2">
                                                            <AppIcon name="receipt" class="size-3.5 text-muted-foreground" />
                                                            Billing invoice
                                                        </Link>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </section>

                                    <section
                                        v-if="canShowCreateEncounterCare"
                                        class="space-y-4 rounded-lg border bg-background p-5"
                                    >
                                        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                    Encounter-linked care
                                                </p>
                                                <p class="text-sm text-muted-foreground">
                                                    {{
                                                        hasCreateEncounterCareContext
                                                            ? 'Review encounter-linked orders and procedures here without losing your place in the current note.'
                                                            : 'Link this note to an appointment or admission to review encounter-linked orders and procedures here.'
                                                    }}
                                                </p>
                                            </div>
                                            <Badge
                                                :variant="hasCreateEncounterCareContext ? 'secondary' : 'outline'"
                                                class="w-fit shrink-0 text-[10px]"
                                            >
                                                {{
                                                    hasCreateEncounterCareContext
                                                        ? `${createEncounterCareVisibleSummaries.length} visible stream${createEncounterCareVisibleSummaries.length === 1 ? '' : 's'}`
                                                        : 'No encounter linked'
                                                }}
                                            </Badge>
                                        </div>

                                        <section class="pt-4">
                                            <div
                                                v-if="!hasCreateEncounterCareContext"
                                                class="rounded-md border border-dashed border-border/60 bg-muted/20 px-4 py-4"
                                            >
                                                <p class="text-sm font-medium text-foreground">
                                                    Encounter context is not linked yet
                                                </p>
                                                <p class="mt-1 text-sm text-muted-foreground">
                                                    Keep or choose the linked appointment or admission in the setup area. When encounter context exists, only the order streams with activity will appear here as tabs.
                                                </p>
                                            </div>
                                            <div
                                                v-else-if="!hasVisibleCreateEncounterCare"
                                                class="rounded-md border border-dashed border-border/60 bg-muted/20 px-4 py-4"
                                            >
                                                <p class="text-sm font-medium text-foreground">
                                                    No linked orders or procedures yet
                                                </p>
                                                <p class="mt-1 text-sm text-muted-foreground">
                                                    Use the workflow actions above when this note needs lab, pharmacy, imaging, or procedure follow-up.
                                                </p>
                                            </div>
                                            <Tabs
                                                v-else
                                                v-model="createEncounterCareTab"
                                                class="space-y-4"
                                            >
                                                <TabsList class="!inline-flex !h-auto min-h-9 w-full flex-wrap justify-start gap-1 rounded-lg bg-muted/20 p-1">
                                                    <TabsTrigger
                                                        v-for="summary in createEncounterCareVisibleSummaries"
                                                        :key="`mr-create-encounter-tab-${summary.id}`"
                                                        :value="summary.id"
                                                        class="!h-8 shrink-0 gap-2 px-3"
                                                    >
                                                        <span>{{ summary.label }}</span>
                                                        <Badge variant="secondary" class="text-[10px]">
                                                            {{ summary.count }}
                                                        </Badge>
                                                    </TabsTrigger>
                                                </TabsList>
                                                <TabsContent
                                                    v-if="createEncounterCareVisibleSummaries.some((summary) => summary.id === 'laboratory-orders')"
                                                    value="laboratory-orders"
                                                    class="mt-0"
                                                >
                                                    <div class="space-y-3">
                                                        <div class="mb-3 flex items-start justify-between gap-3">
                                                            <p class="text-sm text-muted-foreground">
                                                                Tests, specimen workflow, and result progression for this encounter.
                                                            </p>
                                                            <Badge
                                                                :variant="encounterCareStateVariant(encounterCareState(createEncounterLaboratoryOrders.length, createEncounterLaboratoryOrdersLoading, createEncounterLaboratoryOrdersError))"
                                                                class="shrink-0 text-[10px]"
                                                            >
                                                                {{
                                                                    encounterCareStateLabel(
                                                                        encounterCareState(
                                                                            createEncounterLaboratoryOrders.length,
                                                                            createEncounterLaboratoryOrdersLoading,
                                                                            createEncounterLaboratoryOrdersError,
                                                                        ),
                                                                    )
                                                                }}
                                                            </Badge>
                                                        </div>
                                                        <div
                                                            v-if="createEncounterLaboratoryOrdersLoading"
                                                            class="space-y-2"
                                                        >
                                                            <Skeleton class="h-14 w-full rounded-lg" />
                                                            <Skeleton class="h-14 w-full rounded-lg" />
                                                        </div>
                                                        <p
                                                            v-else-if="createEncounterLaboratoryOrdersError"
                                                            class="text-sm text-destructive"
                                                        >
                                                            {{ createEncounterLaboratoryOrdersError }}
                                                        </p>
                                                        <p
                                                            v-else-if="createEncounterLaboratoryOrders.length === 0"
                                                            class="text-sm text-muted-foreground"
                                                        >
                                                            No laboratory orders have been linked to this encounter yet.
                                                        </p>
                                                        <div
                                                            v-else
                                                            :class="[
                                                                'rounded-md border border-border/50 bg-background',
                                                                createEncounterLaboratoryOrders.length > 5
                                                                    ? 'max-h-[30rem] overflow-y-auto'
                                                                    : 'overflow-visible',
                                                            ]"
                                                        >
                                                            <div
                                                                v-for="order in createEncounterLaboratoryOrders"
                                                                :key="`mr-create-lab-order-${order.id}`"
                                                                class="space-y-1 border-b border-border/50 px-3 py-2.5 last:border-b-0"
                                                            >
                                                                <div class="flex items-start justify-between gap-3">
                                                                    <div class="min-w-0">
                                                                        <p class="truncate text-sm font-medium text-foreground">
                                                                            {{ order.testName || 'Laboratory order' }}
                                                                        </p>
                                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                                            {{ order.orderNumber || 'Order number pending' }}
                                                                            |
                                                                            Ordered {{ formatDateTime(order.orderedAt) }}
                                                                        </p>
                                                                    </div>
                                                                    <Badge :variant="laboratoryOrderStatusVariant(order.status)">
                                                                        {{ formatEnumLabel(order.status || 'ordered') }}
                                                                    </Badge>
                                                                </div>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    {{
                                                                        order.resultSummary
                                                                            ? order.resultSummary
                                                                            : order.priority
                                                                              ? `Priority: ${formatEnumLabel(order.priority)}`
                                                                              : 'Awaiting laboratory processing.'
                                                                    }}
                                                                </p>
                                                                <p
                                                                    v-if="lifecycleLinkageText(order, 'laboratory order')"
                                                                    class="mt-1 text-[11px] text-muted-foreground"
                                                                >
                                                                    {{ lifecycleLinkageText(order, 'laboratory order') }}
                                                                </p>
                                                                <div
                                                                    v-if="canOpenLaboratoryWorkflow"
                                                                    class="mt-2 flex flex-wrap gap-1.5"
                                                                >
                                                                    <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                                                        <Link
                                                                            :href="contextCreateHref('/laboratory-orders', {
                                                                                includeTabNew: true,
                                                                                reorderOfId: order.id,
                                                                            })"
                                                                        >
                                                                            Reorder
                                                                        </Link>
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                                                        <Link
                                                                            :href="contextCreateHref('/laboratory-orders', {
                                                                                includeTabNew: true,
                                                                                addOnToOrderId: order.id,
                                                                            })"
                                                                        >
                                                                            Add Linked Test
                                                                        </Link>
                                                                    </Button>
                                                                    <Button
                                                                        v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'cancel')"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-6 gap-1 px-2 text-[10px]"
                                                                        @click="openEncounterLifecycleDialog('laboratory', order.id, 'cancel', order.statusReason)"
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                    <Button
                                                                        v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error')"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-6 gap-1 px-2 text-[10px]"
                                                                        @click="openEncounterLifecycleDialog('laboratory', order.id, 'entered_in_error')"
                                                                    >
                                                                        Entered in error
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TabsContent>

                                                <TabsContent
                                                    v-if="createEncounterCareVisibleSummaries.some((summary) => summary.id === 'pharmacy-orders')"
                                                    value="pharmacy-orders"
                                                    class="mt-0"
                                                >
                                                    <div class="space-y-3">
                                                        <div class="mb-3 flex items-start justify-between gap-3">
                                                            <p class="text-sm text-muted-foreground">
                                                                Medication requests, dispensing status, and supply follow-up.
                                                            </p>
                                                            <Badge
                                                                :variant="encounterCareStateVariant(encounterCareState(createEncounterPharmacyOrders.length, createEncounterPharmacyOrdersLoading, createEncounterPharmacyOrdersError))"
                                                                class="shrink-0 text-[10px]"
                                                            >
                                                                {{
                                                                    encounterCareStateLabel(
                                                                        encounterCareState(
                                                                            createEncounterPharmacyOrders.length,
                                                                            createEncounterPharmacyOrdersLoading,
                                                                            createEncounterPharmacyOrdersError,
                                                                        ),
                                                                    )
                                                                }}
                                                            </Badge>
                                                        </div>
                                                        <div
                                                            v-if="createEncounterPharmacyOrdersLoading"
                                                            class="space-y-2"
                                                        >
                                                            <Skeleton class="h-14 w-full rounded-lg" />
                                                            <Skeleton class="h-14 w-full rounded-lg" />
                                                        </div>
                                                        <p
                                                            v-else-if="createEncounterPharmacyOrdersError"
                                                            class="text-sm text-destructive"
                                                        >
                                                            {{ createEncounterPharmacyOrdersError }}
                                                        </p>
                                                        <p
                                                            v-else-if="createEncounterPharmacyOrders.length === 0"
                                                            class="text-sm text-muted-foreground"
                                                        >
                                                            No pharmacy orders have been linked to this encounter yet.
                                                        </p>
                                                        <div
                                                            v-else
                                                            :class="[
                                                                'rounded-md border border-border/50 bg-background',
                                                                createEncounterPharmacyOrders.length > 5
                                                                    ? 'max-h-[30rem] overflow-y-auto'
                                                                    : 'overflow-visible',
                                                            ]"
                                                        >
                                                            <div
                                                                v-for="order in createEncounterPharmacyOrders"
                                                                :key="`mr-create-pharmacy-order-${order.id}`"
                                                                class="space-y-1 border-b border-border/50 px-3 py-2.5 last:border-b-0"
                                                            >
                                                                <div class="flex items-start justify-between gap-3">
                                                                    <div class="min-w-0">
                                                                        <p class="truncate text-sm font-medium text-foreground">
                                                                            {{ order.medicationName || 'Pharmacy order' }}
                                                                        </p>
                                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                                            {{ order.orderNumber || 'Order number pending' }}
                                                                            <span
                                                                                v-if="pharmacyOrderQuantityLabel(order.quantityPrescribed)"
                                                                            >
                                                                                |
                                                                                {{ pharmacyOrderQuantityLabel(order.quantityPrescribed) }}
                                                                            </span>
                                                                            |
                                                                            Ordered {{ formatDateTime(order.orderedAt) }}
                                                                        </p>
                                                                    </div>
                                                                    <Badge :variant="pharmacyOrderStatusVariant(order.status)">
                                                                        {{ formatEnumLabel(order.status || 'pending') }}
                                                                    </Badge>
                                                                </div>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    {{ pharmacyOrderSummaryText(order) }}
                                                                </p>
                                                                <p
                                                                    v-if="lifecycleLinkageText(order, 'medication order')"
                                                                    class="mt-1 text-[11px] text-muted-foreground"
                                                                >
                                                                    {{ lifecycleLinkageText(order, 'medication order') }}
                                                                </p>
                                                                <div
                                                                    v-if="canOpenPharmacyWorkflow"
                                                                    class="mt-2 flex flex-wrap gap-1.5"
                                                                >
                                                                    <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                                                        <Link
                                                                            :href="contextCreateHref('/pharmacy-orders', {
                                                                                includeTabNew: true,
                                                                                reorderOfId: order.id,
                                                                            })"
                                                                        >
                                                                            Reorder
                                                                        </Link>
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                                                        <Link
                                                                            :href="contextCreateHref('/pharmacy-orders', {
                                                                                includeTabNew: true,
                                                                                addOnToOrderId: order.id,
                                                                            })"
                                                                        >
                                                                            Add Linked Medication
                                                                        </Link>
                                                                    </Button>
                                                                    <Button
                                                                        v-if="canApplyPharmacyEncounterLifecycleAction(order, 'cancel')"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-6 gap-1 px-2 text-[10px]"
                                                                        @click="openEncounterLifecycleDialog('pharmacy', order.id, 'cancel', order.statusReason)"
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                    <Button
                                                                        v-if="canApplyPharmacyEncounterLifecycleAction(order, 'discontinue')"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-6 gap-1 px-2 text-[10px]"
                                                                        @click="openEncounterLifecycleDialog('pharmacy', order.id, 'discontinue')"
                                                                    >
                                                                        Discontinue
                                                                    </Button>
                                                                    <Button
                                                                        v-if="canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error')"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-6 gap-1 px-2 text-[10px]"
                                                                        @click="openEncounterLifecycleDialog('pharmacy', order.id, 'entered_in_error')"
                                                                    >
                                                                        Entered in error
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TabsContent>

                                                <TabsContent
                                                    v-if="createEncounterCareVisibleSummaries.some((summary) => summary.id === 'radiology-orders')"
                                                    value="radiology-orders"
                                                    class="mt-0"
                                                >
                                                    <div class="space-y-3">
                                                        <div class="mb-3 flex items-start justify-between gap-3">
                                                            <p class="text-sm text-muted-foreground">
                                                                Scheduling, study execution, and reporting status for this encounter.
                                                            </p>
                                                            <Badge
                                                                :variant="encounterCareStateVariant(encounterCareState(createEncounterRadiologyOrders.length, createEncounterRadiologyOrdersLoading, createEncounterRadiologyOrdersError))"
                                                                class="shrink-0 text-[10px]"
                                                            >
                                                                {{
                                                                    encounterCareStateLabel(
                                                                        encounterCareState(
                                                                            createEncounterRadiologyOrders.length,
                                                                            createEncounterRadiologyOrdersLoading,
                                                                            createEncounterRadiologyOrdersError,
                                                                        ),
                                                                    )
                                                                }}
                                                            </Badge>
                                                        </div>
                                                        <div
                                                            v-if="createEncounterRadiologyOrdersLoading"
                                                            class="space-y-2"
                                                        >
                                                            <Skeleton class="h-14 w-full rounded-lg" />
                                                            <Skeleton class="h-14 w-full rounded-lg" />
                                                        </div>
                                                        <p
                                                            v-else-if="createEncounterRadiologyOrdersError"
                                                            class="text-sm text-destructive"
                                                        >
                                                            {{ createEncounterRadiologyOrdersError }}
                                                        </p>
                                                        <p
                                                            v-else-if="createEncounterRadiologyOrders.length === 0"
                                                            class="text-sm text-muted-foreground"
                                                        >
                                                            No imaging orders have been linked to this encounter yet.
                                                        </p>
                                                        <div
                                                            v-else
                                                            :class="[
                                                                'rounded-md border border-border/50 bg-background',
                                                                createEncounterRadiologyOrders.length > 5
                                                                    ? 'max-h-[30rem] overflow-y-auto'
                                                                    : 'overflow-visible',
                                                            ]"
                                                        >
                                                            <div
                                                                v-for="order in createEncounterRadiologyOrders"
                                                                :key="`mr-create-radiology-order-${order.id}`"
                                                                class="space-y-1 border-b border-border/50 px-3 py-2.5 last:border-b-0"
                                                            >
                                                                <div class="flex items-start justify-between gap-3">
                                                                    <div class="min-w-0">
                                                                        <p class="truncate text-sm font-medium text-foreground">
                                                                            {{ order.studyDescription || 'Imaging order' }}
                                                                        </p>
                                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                                            {{ order.orderNumber || 'Order number pending' }}
                                                                            |
                                                                            Ordered {{ formatDateTime(order.orderedAt) }}
                                                                        </p>
                                                                    </div>
                                                                    <Badge :variant="radiologyOrderStatusVariant(order.status)">
                                                                        {{ formatEnumLabel(order.status || 'ordered') }}
                                                                    </Badge>
                                                                </div>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    {{ radiologyOrderSummaryText(order) }}
                                                                </p>
                                                                <p
                                                                    v-if="lifecycleLinkageText(order, 'imaging order')"
                                                                    class="mt-1 text-[11px] text-muted-foreground"
                                                                >
                                                                    {{ lifecycleLinkageText(order, 'imaging order') }}
                                                                </p>
                                                                <div
                                                                    v-if="canOpenRadiologyWorkflow"
                                                                    class="mt-2 flex flex-wrap gap-1.5"
                                                                >
                                                                    <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                                                        <Link
                                                                            :href="contextCreateHref('/radiology-orders', {
                                                                                includeTabNew: true,
                                                                                reorderOfId: order.id,
                                                                            })"
                                                                        >
                                                                            Reorder
                                                                        </Link>
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                                                        <Link
                                                                            :href="contextCreateHref('/radiology-orders', {
                                                                                includeTabNew: true,
                                                                                addOnToOrderId: order.id,
                                                                            })"
                                                                        >
                                                                            Add Linked Study
                                                                        </Link>
                                                                    </Button>
                                                                    <Button
                                                                        v-if="canApplyRadiologyEncounterLifecycleAction(order, 'cancel')"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-6 gap-1 px-2 text-[10px]"
                                                                        @click="openEncounterLifecycleDialog('radiology', order.id, 'cancel', order.statusReason)"
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                    <Button
                                                                        v-if="canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error')"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-6 gap-1 px-2 text-[10px]"
                                                                        @click="openEncounterLifecycleDialog('radiology', order.id, 'entered_in_error')"
                                                                    >
                                                                        Entered in error
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TabsContent>

                                                <TabsContent
                                                    v-if="createEncounterCareVisibleSummaries.some((summary) => summary.id === 'theatre-procedures')"
                                                    value="theatre-procedures"
                                                    class="mt-0"
                                                >
                                                    <div class="space-y-3">
                                                        <div class="mb-3 flex items-start justify-between gap-3">
                                                            <p class="text-sm text-muted-foreground">
                                                                Bookings, pre-op readiness, and theatre progression for this encounter.
                                                            </p>
                                                            <Badge
                                                                :variant="encounterCareStateVariant(encounterCareState(createEncounterTheatreProcedures.length, createEncounterTheatreProceduresLoading, createEncounterTheatreProceduresError))"
                                                                class="shrink-0 text-[10px]"
                                                            >
                                                                {{
                                                                    encounterCareStateLabel(
                                                                        encounterCareState(
                                                                            createEncounterTheatreProcedures.length,
                                                                            createEncounterTheatreProceduresLoading,
                                                                            createEncounterTheatreProceduresError,
                                                                        ),
                                                                    )
                                                                }}
                                                            </Badge>
                                                        </div>
                                                        <div
                                                            v-if="createEncounterTheatreProceduresLoading"
                                                            class="space-y-2"
                                                        >
                                                            <Skeleton class="h-14 w-full rounded-lg" />
                                                            <Skeleton class="h-14 w-full rounded-lg" />
                                                        </div>
                                                        <p
                                                            v-else-if="createEncounterTheatreProceduresError"
                                                            class="text-sm text-destructive"
                                                        >
                                                            {{ createEncounterTheatreProceduresError }}
                                                        </p>
                                                        <p
                                                            v-else-if="createEncounterTheatreProcedures.length === 0"
                                                            class="text-sm text-muted-foreground"
                                                        >
                                                            No theatre procedures have been linked to this encounter yet.
                                                        </p>
                                                        <div
                                                            v-else
                                                            :class="[
                                                                'rounded-md border border-border/50 bg-background',
                                                                createEncounterTheatreProcedures.length > 5
                                                                    ? 'max-h-[30rem] overflow-y-auto'
                                                                    : 'overflow-visible',
                                                            ]"
                                                        >
                                                            <div
                                                                v-for="procedure in createEncounterTheatreProcedures"
                                                                :key="`mr-create-theatre-procedure-${procedure.id}`"
                                                                class="space-y-1 border-b border-border/50 px-3 py-2.5 last:border-b-0"
                                                            >
                                                                <div class="flex items-start justify-between gap-3">
                                                                    <div class="min-w-0">
                                                                        <p class="truncate text-sm font-medium text-foreground">
                                                                            {{ procedure.procedureName || procedure.procedureType || 'Theatre procedure' }}
                                                                        </p>
                                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                                            {{ procedure.procedureNumber || 'Procedure number pending' }}
                                                                            |
                                                                            Scheduled {{ formatDateTime(procedure.scheduledAt) }}
                                                                        </p>
                                                                    </div>
                                                                    <Badge :variant="theatreProcedureStatusVariant(procedure.status)">
                                                                        {{ formatEnumLabel(procedure.status || 'planned') }}
                                                                    </Badge>
                                                                </div>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    {{ theatreProcedureSummaryText(procedure) }}
                                                                </p>
                                                                <p
                                                                    v-if="lifecycleLinkageText(procedure, 'procedure booking')"
                                                                    class="mt-1 text-[11px] text-muted-foreground"
                                                                >
                                                                    {{ lifecycleLinkageText(procedure, 'procedure booking') }}
                                                                </p>
                                                                <div
                                                                    v-if="canOpenTheatreWorkflow"
                                                                    class="mt-2 flex flex-wrap gap-1.5"
                                                                >
                                                                    <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                                                        <Link
                                                                            :href="contextCreateHref('/theatre-procedures', {
                                                                                includeTabNew: true,
                                                                                reorderOfId: procedure.id,
                                                                            })"
                                                                        >
                                                                            Reorder
                                                                        </Link>
                                                                    </Button>
                                                                    <Button size="sm" variant="outline" as-child class="h-6 gap-1 px-2 text-[10px]">
                                                                        <Link
                                                                            :href="contextCreateHref('/theatre-procedures', {
                                                                                includeTabNew: true,
                                                                                addOnToOrderId: procedure.id,
                                                                            })"
                                                                        >
                                                                            Add Linked Procedure
                                                                        </Link>
                                                                    </Button>
                                                                    <Button
                                                                        v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'cancel')"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-6 gap-1 px-2 text-[10px]"
                                                                        @click="openEncounterLifecycleDialog('theatre', procedure.id, 'cancel', procedure.statusReason)"
                                                                    >
                                                                        Cancel
                                                                    </Button>
                                                                    <Button
                                                                        v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error')"
                                                                        size="sm"
                                                                        variant="outline"
                                                                        class="h-6 gap-1 px-2 text-[10px]"
                                                                        @click="openEncounterLifecycleDialog('theatre', procedure.id, 'entered_in_error')"
                                                                    >
                                                                        Entered in error
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                        </section>
                                    </section>

                                </TabsContent>

                                <TabsContent value="note" class="mt-0">
                                    <div
                                        v-if="createDraftRecoveryAvailable || hasUnsavedCreateClinicalContent || createDraftRecovered"
                                        class="border-b px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
                                    >
                                        <span>{{ createDraftStatusDescription }}</span>
                                        <button
                                            v-if="createDraftRecoveryAvailable"
                                            type="button"
                                            class="underline underline-offset-2 hover:text-foreground"
                                            @click="restoreStoredMedicalRecordCreateDraft"
                                        >
                                            Restore
                                        </button>
                                        <button
                                            v-if="createDraftRecoveryAvailable"
                                            type="button"
                                            class="underline underline-offset-2 hover:text-foreground"
                                            @click="discardStoredMedicalRecordCreateDraft()"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            v-if="!createDraftRecoveryAvailable && (hasUnsavedCreateClinicalContent || createDraftRecovered)"
                                            type="button"
                                            class="underline underline-offset-2 hover:text-foreground"
                                            :disabled="createLoading"
                                            @click="discardStoredMedicalRecordCreateDraft({ resetComposer: true })"
                                        >
                                            Start fresh
                                        </button>
                                    </div>
                                    <section
                                        id="mr-create-note-setup"
                                        class="border-b px-6 py-5 space-y-4 scroll-mt-24"
                                    >
                                        <div>
                                            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Encounter details
                                            </p>
                                            <p class="mt-1 text-sm text-muted-foreground">
                                                Confirm the note type, diagnosis code, and linked workflow context before finalizing this clinical document.
                                            </p>
                                        </div>
                                        <div class="grid gap-4 lg:grid-cols-2">
                                            <div class="grid min-w-0 gap-2">
                                                <Label for="mr-create-record-type-trigger">Record type</Label>
                                                <Select v-model="createForm.recordType">
                                                    <SelectTrigger
                                                        id="mr-create-record-type-trigger"
                                                        class="h-9 w-full bg-background"
                                                        aria-label="Select medical record type"
                                                    >
                                                        <SelectValue placeholder="Choose record type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem
                                                            v-for="option in MEDICAL_RECORD_NOTE_TYPE_OPTIONS"
                                                            :key="`mr-create-record-type-${option.value}`"
                                                            :value="option.value"
                                                        >
                                                            {{ option.label }}
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ createRecordTypeHelperText }}
                                                </p>
                                                <p
                                                    v-if="createFieldError('recordType')"
                                                    class="text-xs text-destructive"
                                                >
                                                    {{ createFieldError('recordType') }}
                                                </p>
                                            </div>
                                            <div class="grid min-w-0 gap-2">
                                                <Label for="mr-create-diagnosis-code">Diagnosis code (ICD-10)</Label>
                                                <Input
                                                    id="mr-create-diagnosis-code"
                                                    v-model="createForm.diagnosisCode"
                                                    placeholder="Optional, for example R52 or J11.1"
                                                    class="w-full min-w-0 bg-background"
                                                />
                                                <p class="text-xs text-muted-foreground">
                                                    {{ createDiagnosisCodeHelperText }}
                                                </p>
                                                <p
                                                    v-if="createFieldError('diagnosisCode')"
                                                    class="text-xs text-destructive"
                                                >
                                                    {{ createFieldError('diagnosisCode') }}
                                                </p>
                                            </div>
                                        </div>
                                        <div
                                            v-if="createIsProgressNote && hasCreateAdmissionContext"
                                            class="rounded-lg border bg-muted/20 p-4"
                                        >
                                            <div class="flex flex-wrap items-start justify-between gap-3">
                                                <div class="min-w-0 space-y-1">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="text-sm font-medium text-foreground">
                                                            Inpatient follow-up continuity
                                                        </p>
                                                        <Badge
                                                            v-if="createAdmissionContextStatusLabel"
                                                            :variant="createAdmissionContextStatusVariant"
                                                            class="text-[11px]"
                                                        >
                                                            {{ createAdmissionContextStatusLabel }}
                                                        </Badge>
                                                        <Badge
                                                            v-if="createAdmissionContextSourceLabel"
                                                            variant="outline"
                                                            class="text-[11px]"
                                                        >
                                                            {{ createAdmissionContextSourceLabel }}
                                                        </Badge>
                                                    </div>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{ createAdmissionContextLabel }}
                                                    </p>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{ createAdmissionContextMeta }}
                                                    </p>
                                                    <p
                                                        v-if="createProgressNoteContinuitySummary"
                                                        class="text-xs text-muted-foreground"
                                                    >
                                                        {{ createProgressNoteContinuitySummary }}
                                                    </p>
                                                    <p
                                                        v-if="createAdmissionContextReason"
                                                        class="text-xs text-muted-foreground"
                                                    >
                                                        {{ createAdmissionContextReason }}
                                                    </p>
                                                </div>
                                                <Button
                                                    v-if="createProgressNoteHistoryHref && canReadMedicalRecords"
                                                    size="sm"
                                                    variant="outline"
                                                    as-child
                                                    class="gap-1.5"
                                                >
                                                    <Link :href="createProgressNoteHistoryHref">
                                                        Open progress notes
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                        <div
                                            v-if="createIsDischargeNote && hasCreateAdmissionContext"
                                            class="rounded-lg border bg-muted/20 p-4"
                                        >
                                            <div class="flex flex-wrap items-start justify-between gap-3">
                                                <div class="min-w-0 space-y-1">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="text-sm font-medium text-foreground">
                                                            Discharge closeout continuity
                                                        </p>
                                                        <Badge
                                                            v-if="createAdmissionContextStatusLabel"
                                                            :variant="createAdmissionContextStatusVariant"
                                                            class="text-[11px]"
                                                        >
                                                            {{ createAdmissionContextStatusLabel }}
                                                        </Badge>
                                                        <Badge
                                                            v-if="createAdmissionContextSourceLabel"
                                                            variant="outline"
                                                            class="text-[11px]"
                                                        >
                                                            {{ createAdmissionContextSourceLabel }}
                                                        </Badge>
                                                    </div>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{ createAdmissionContextLabel }}
                                                    </p>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{ createAdmissionContextMeta }}
                                                    </p>
                                                    <p
                                                        v-if="createDischargeNoteContinuitySummary"
                                                        class="text-xs text-muted-foreground"
                                                    >
                                                        {{ createDischargeNoteContinuitySummary }}
                                                    </p>
                                                    <p
                                                        v-if="createAdmissionContextReason"
                                                        class="text-xs text-muted-foreground"
                                                    >
                                                        {{ createAdmissionContextReason }}
                                                    </p>
                                                </div>
                                                <Button
                                                    v-if="createDischargeNoteHistoryHref && canReadMedicalRecords"
                                                    size="sm"
                                                    variant="outline"
                                                    as-child
                                                    class="gap-1.5"
                                                >
                                                    <Link :href="createDischargeNoteHistoryHref">
                                                        Open discharge notes
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                        <div
                                            v-if="createForm.appointmentReferralId.trim()"
                                            class="rounded-lg border bg-muted/20 p-4"
                                        >
                                            <div class="flex flex-wrap items-start justify-between gap-3">
                                                <div class="min-w-0 space-y-1">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="text-sm font-medium text-foreground">
                                                            Linked referral handoff
                                                        </p>
                                                        <Badge
                                                            v-if="createLinkedAppointmentReferral"
                                                            :variant="appointmentReferralStatusVariant(createLinkedAppointmentReferral.status)"
                                                            class="text-[11px]"
                                                        >
                                                            {{ formatEnumLabel(createLinkedAppointmentReferral.status || 'requested') }}
                                                        </Badge>
                                                        <Badge
                                                            v-if="createLinkedAppointmentReferral?.priority"
                                                            :variant="appointmentReferralPriorityVariant(createLinkedAppointmentReferral.priority)"
                                                            class="text-[11px]"
                                                        >
                                                            {{ formatEnumLabel(createLinkedAppointmentReferral.priority) }}
                                                        </Badge>
                                                    </div>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{
                                                            createLinkedAppointmentReferral
                                                                ? (createLinkedAppointmentReferral.referralNumber
                                                                    || 'Linked referral handoff')
                                                                : `Referral ref. ${shortId(createForm.appointmentReferralId)}`
                                                        }}
                                                    </p>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{
                                                            createLinkedAppointmentReferral
                                                                ? appointmentReferralDestinationText(createLinkedAppointmentReferral)
                                                                : createAppointmentReferralsLoading
                                                                    ? 'Loading referral handoff context...'
                                                                    : (createAppointmentReferralsError || 'This note remains linked to the selected referral workflow.')
                                                        }}
                                                    </p>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{
                                                            createLinkedAppointmentReferral
                                                                ? appointmentReferralSummaryText(createLinkedAppointmentReferral)
                                                                : createAppointmentReferralsLoading
                                                                    ? 'Loading referral handoff context...'
                                                                    : (createAppointmentReferralsError || 'Referral transfer details stay attached to this encounter.')
                                                        }}
                                                    </p>
                                                    <p
                                                        v-if="createLinkedAppointmentReferral"
                                                        class="text-xs text-muted-foreground"
                                                    >
                                                        {{ appointmentReferralTimingText(createLinkedAppointmentReferral) }}
                                                    </p>
                                                </div>
                                                <Button
                                                    v-if="createLinkedAppointmentReferralHref && canReadAppointments"
                                                    size="sm"
                                                    variant="outline"
                                                    as-child
                                                    class="gap-1.5"
                                                >
                                                    <Link :href="createLinkedAppointmentReferralHref">
                                                        Open referral workflow
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                        <div
                                            v-if="createForm.theatreProcedureId.trim()"
                                            class="rounded-lg border bg-muted/20 p-4"
                                        >
                                            <div class="flex flex-wrap items-start justify-between gap-3">
                                                <div class="min-w-0 space-y-1">
                                                    <div class="flex flex-wrap items-center gap-2">
                                                        <p class="text-sm font-medium text-foreground">
                                                            Linked theatre case
                                                        </p>
                                                        <Badge
                                                            v-if="createLinkedTheatreProcedure"
                                                            :variant="theatreProcedureStatusVariant(createLinkedTheatreProcedure.status)"
                                                            class="text-[11px]"
                                                        >
                                                            {{ formatEnumLabel(createLinkedTheatreProcedure.status || 'planned') }}
                                                        </Badge>
                                                    </div>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{
                                                            createLinkedTheatreProcedure
                                                                ? (createLinkedTheatreProcedure.procedureNumber
                                                                    || createLinkedTheatreProcedure.procedureName
                                                                    || createLinkedTheatreProcedure.procedureType
                                                                    || 'Theatre procedure')
                                                                : `Procedure ref. ${shortId(createForm.theatreProcedureId)}`
                                                        }}
                                                    </p>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{
                                                            createLinkedTheatreProcedure
                                                                ? theatreProcedureSummaryText(createLinkedTheatreProcedure)
                                                                : createEncounterTheatreProceduresLoading
                                                                    ? 'Loading theatre workflow context...'
                                                                    : (createEncounterTheatreProceduresError || 'This note remains linked to the selected theatre case.')
                                                        }}
                                                    </p>
                                                </div>
                                                <Button
                                                    v-if="createLinkedTheatreProcedureHref && canReadTheatreProcedures"
                                                    size="sm"
                                                    variant="outline"
                                                    as-child
                                                    class="gap-1.5"
                                                >
                                                    <Link :href="createLinkedTheatreProcedureHref">
                                                        <AppIcon name="scissors" class="size-3.5" />
                                                        Open theatre case
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                        <div class="rounded-lg border border-dashed px-4 py-3">
                                            <p class="text-sm font-medium text-foreground">
                                                {{ createNarrativeHeading.title }}
                                            </p>
                                            <p class="mt-1 text-xs leading-5 text-muted-foreground">
                                                {{ createNarrativeHeading.subtitle }}
                                            </p>
                                        </div>
                                    </section>
                                    <section id="mr-create-subjective-section" class="border-b px-6 py-5 space-y-3 scroll-mt-24">
                                        <div>
                                            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ createSubjectiveLabel }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ createSubjectiveUi.description }}</p>
                                        </div>
                                        <RichTextEditorField
                                            input-id="mr-create-subjective"
                                            v-model="createForm.subjective"
                                            :label="createSubjectiveLabel"
                                            :placeholder="createSubjectiveUi.placeholder"
                                            :helper-text="createSubjectiveUi.helperText"
                                            :error-message="createFieldError('subjective')"
                                            min-height-class="min-h-[160px]"
                                        />
                                    </section>
                                    <section id="mr-create-objective-section" class="border-b px-6 py-5 space-y-3 scroll-mt-24">
                                        <div>
                                            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ createObjectiveLabel }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ createObjectiveUi.description }}</p>
                                        </div>
                                        <RichTextEditorField
                                            input-id="mr-create-objective"
                                            v-model="createForm.objective"
                                            :label="createObjectiveLabel"
                                            :placeholder="createObjectiveUi.placeholder"
                                            :helper-text="createObjectiveUi.helperText"
                                            :error-message="createFieldError('objective')"
                                            min-height-class="min-h-[160px]"
                                        />
                                    </section>
                                    <section id="mr-create-assessment-section" class="border-b px-6 py-5 space-y-3 scroll-mt-24">
                                        <div>
                                            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ createAssessmentLabel }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ createAssessmentUi.description }}</p>
                                        </div>
                                        <RichTextEditorField
                                            input-id="mr-create-assessment"
                                            v-model="createForm.assessment"
                                            :label="createAssessmentLabel"
                                            :placeholder="createAssessmentUi.placeholder"
                                            :helper-text="createAssessmentUi.helperText"
                                            :error-message="createFieldError('assessment')"
                                            min-height-class="min-h-[160px]"
                                        />
                                    </section>
                                    <section id="mr-create-plan-section" class="px-6 py-5 space-y-3 scroll-mt-24">
                                        <div>
                                            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{{ createPlanLabel }}</p>
                                            <p class="mt-1 text-xs text-muted-foreground">{{ createPlanUi.description }}</p>
                                        </div>
                                        <RichTextEditorField
                                            input-id="mr-create-plan"
                                            v-model="createForm.plan"
                                            :label="createPlanLabel"
                                            :placeholder="createPlanUi.placeholder"
                                            :helper-text="createPlanUi.helperText"
                                            :error-message="createFieldError('plan')"
                                            min-height-class="min-h-[160px]"
                                        />
                                    </section>
                                </TabsContent>
                            </div>
                            </Tabs>
                        </ScrollArea>
                        <SheetFooter class="shrink-0 border-t bg-background px-6 py-4">
                            <div class="flex w-full items-center justify-between gap-3">
                                <p
                                    v-if="createFooterWorkflowHint"
                                    class="min-w-0 flex-1 text-[11px] leading-5 text-muted-foreground"
                                >
                                    {{ createFooterWorkflowHint }}
                                </p>
                                <div class="flex shrink-0 items-center gap-2 ml-auto">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        class="gap-1.5 text-muted-foreground"
                                        @click="openMedicalRecordWorkspace('list', { focusSearch: true })"
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="createLoading || !createForm.patientId.trim()"
                                        @click="createRecord(canSaveAndCompleteVisit ? 'complete' : canSaveAndReturnToAppointments ? 'return' : 'save')"
                                    >
                                        <AppIcon :name="canSaveAndCompleteVisit ? 'circle-check-big' : 'save'" class="size-3.5" />
                                        {{
                                            createLoading
                                                ? 'Saving...'
                                                : canSaveAndCompleteVisit
                                                  ? 'Save & close visit'
                                                  : canSaveAndReturnToAppointments
                                                    ? 'Save & return'
                                                    : 'Save note'
                                        }}
                                    </Button>
                                </div>
                            </div>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            </div>

            <!-- Care workflow (footer bar) -->
            <div
                v-if="canReadMedicalRecords"
                class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-2.5"
            >
                <span
                    class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                >
                    <AppIcon name="activity" class="size-3.5" />
                    Care workflow:
                </span>
                <Button size="sm" variant="outline" as-child class="gap-1.5">
                    <Link href="/patients">
                        <AppIcon name="users" class="size-3.5" />
                        Register Patient
                    </Link>
                </Button>
                <Button v-if="canLaunchConsultationFromAppointments" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link
                        :href="
                            consultationEntryAppointmentsHref(searchForm.patientId)
                        "
                    >
                        <AppIcon name="stethoscope" class="size-3.5" />
                        Start from Appointments
                    </Link>
                </Button>
                <Button v-if="canOpenLaboratoryWorkflow" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="contextCreateHref('/laboratory-orders')">
                        <AppIcon name="flask-conical" class="size-3.5" />
                        New Lab Order
                    </Link>
                </Button>
                <Button v-if="canOpenPharmacyWorkflow" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="contextCreateHref('/pharmacy-orders', { includeTabNew: true })">
                        <AppIcon name="pill" class="size-3.5" />
                        New Pharmacy Order
                    </Link>
                </Button>
                <Button v-if="canOpenRadiologyWorkflow" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="contextCreateHref('/radiology-orders')">
                        <AppIcon name="eye" class="size-3.5" />
                        New Imaging Order
                    </Link>
                </Button>
                <Button v-if="canOpenTheatreWorkflow" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="contextCreateHref('/theatre-procedures', { includeTabNew: true })">
                        <AppIcon name="scissors" class="size-3.5" />
                        Schedule Procedure
                    </Link>
                </Button>
                <Button v-if="canCreateBillingWorkflow" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="contextCreateHref('/billing-invoices')">
                        <AppIcon name="receipt" class="size-3.5" />
                        Create Invoice
                    </Link>
                </Button>
            </div>

            <!-- Filter Sheet (replaces Popover + mobile Drawer) -->
            <Sheet
                v-if="canReadMedicalRecords"
                :open="filterSheetOpen"
                @update:open="filterSheetOpen = $event"
            >
                <SheetContent side="right" variant="action" size="lg">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            Search & filter
                        </SheetTitle>
                        <SheetDescription>
                            Narrow records by patient, status, type, or encounter date.
                        </SheetDescription>
                    </SheetHeader>
                    <div class="grid gap-4 px-4 py-4">
                            <div class="grid gap-2">
                                <Label for="mr-q-sheet">Search records</Label>
                                <div class="relative">
                                    <AppIcon
                                        name="search"
                                        class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="mr-q-sheet"
                                        v-model="searchForm.q"
                                        placeholder="Record number, diagnosis, or plan"
                                        class="pl-9"
                                        @keyup.enter="submitSearchFromMobileDrawer"
                                    />
                                </div>
                            </div>
                            <PatientLookupField
                                input-id="mr-patient-id-sheet"
                                v-model="searchForm.patientId"
                                label="Patient"
                                placeholder="Patient name or number"
                                helper-text="Limit the registry to one patient."
                                mode="filter"
                                :open-on-focus="true"
                            />
                            <Separator />
                            <div class="grid gap-3">
                                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Advanced</p>
                                <div class="grid gap-2">
                                    <Label for="mr-status-sheet">Status</Label>
                                    <Select v-model="searchForm.status">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All statuses</SelectItem>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="finalized">Finalized</SelectItem>
                                        <SelectItem value="amended">Amended</SelectItem>
                                        <SelectItem value="archived">Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="mr-record-type-sheet">Record type</Label>
                                    <Select v-model="searchForm.recordType">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">All types</SelectItem>
                                        <SelectItem
                                            v-for="option in MEDICAL_RECORD_NOTE_TYPE_OPTIONS"
                                            :key="`mr-record-type-sheet-${option.value}`"
                                            :value="option.value"
                                        >
                                            {{ option.label }}
                                        </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DateRangeFilterPopover
                                    input-base-id="mr-encounter-date-range-sheet"
                                    title="Encounter date range"
                                    helper-text="Filter to a specific clinical window."
                                    from-label="From"
                                    to-label="To"
                                    inline
                                    :number-of-months="1"
                                    v-model:from="searchForm.from"
                                    v-model:to="searchForm.to"
                                />
                            </div>
                    </div>
                    <SheetFooter class="gap-2">
                        <Button
                            class="flex-1 gap-1.5"
                            :disabled="listLoading"
                            @click="submitSearchFromMobileDrawer"
                        >
                            <AppIcon name="search" class="size-3.5" />
                            Apply
                        </Button>
                        <Button
                            variant="outline"
                            class="gap-1.5"
                            :disabled="listLoading && !hasActiveRecordFilters"
                            @click="resetRecordFiltersFromMobileDrawer"
                        >
                            Reset
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Sheet
                :open="detailsSheetOpen"
                @update:open="
                    (open) =>
                        open
                            ? (detailsSheetOpen = true)
                            : closeRecordDetailsSheet()
                "
            >
                <SheetContent
                    side="right"
                    variant="workspace"
                    size="4xl"
                >
                    <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                        <p class="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            {{ detailsSheetRecord?.recordNumber || 'Medical record' }}
                        </p>
                        <SheetTitle class="mt-0.5 text-base leading-tight">
                            {{ detailsSheetRecord ? recordPatientLabel(detailsSheetRecord) : 'Record details' }}
                        </SheetTitle>
                        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge v-if="detailsSheetRecord" :variant="statusVariant(detailsSheetRecord.status)" class="h-5 text-[11px]">
                                {{ formatEnumLabel(detailsSheetRecord.status) }}
                            </Badge>
                            <Badge v-if="detailsSheetRecord" variant="outline" class="h-5 text-[11px]">
                                {{ recordTypeLabel(detailsSheetRecord.recordType) }}
                            </Badge>
                            <span v-if="detailsSheetRecord?.encounterAt" class="text-xs text-muted-foreground">· {{ formatDateTime(detailsSheetRecord.encounterAt) }}</span>
                        </div>
                    </SheetHeader>

                    <ScrollArea
                        v-if="detailsSheetRecord"
                        class="min-h-0 flex-1"
                    >
                        <div class="space-y-4 p-4">
                        <Tabs v-model="detailsSheetTab" class="w-full">
                                <TabsList class="!inline-flex w-full flex-nowrap overflow-x-auto">
                                    <TabsTrigger
                                        value="overview"
                                        class="inline-flex items-center gap-1.5 text-xs sm:text-sm"
                                    >
                                        <AppIcon
                                            name="layout-grid"
                                            class="size-3.5"
                                        />
                                        Overview
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="timeline"
                                        class="inline-flex items-center gap-1.5 text-xs sm:text-sm"
                                    >
                                        <AppIcon
                                            name="activity"
                                            class="size-3.5"
                                        />
                                        Timeline
                                        <Badge
                                            v-if="
                                                detailsTimelineMeta ||
                                                detailsTimelineRecords.length
                                            "
                                            variant="secondary"
                                            class="h-4 min-w-4 px-1 text-[10px]"
                                        >
                                            {{
                                                detailsTimelineMeta?.total ??
                                                detailsTimelineRecords.length
                                            }}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        v-if="canViewMedicalRecordAudit"
                                        value="audit"
                                        class="inline-flex items-center gap-1.5 text-xs sm:text-sm"
                                    >
                                        <AppIcon
                                            name="shield-check"
                                            class="size-3.5"
                                        />
                                        Audit
                                        <Badge
                                            v-if="
                                                canViewMedicalRecordAudit &&
                                                detailsAuditMeta
                                            "
                                            variant="secondary"
                                            class="h-4 min-w-4 px-1 text-[10px]"
                                        >
                                            {{ detailsAuditMeta.total }}
                                        </Badge>
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent
                                    value="overview"
                                    class="mt-3 space-y-4"
                                >
                                    <!-- Record details -->
                                    <dl class="divide-y rounded-lg border">
                                        <div class="grid grid-cols-[8rem_1fr] items-start gap-2 px-4 py-2.5">
                                            <dt class="pt-px text-xs font-medium text-muted-foreground">Working problem</dt>
                                            <dd class="text-sm">{{ recordProblemFocus(detailsSheetRecord) }}</dd>
                                        </div>
                                        <div class="grid grid-cols-[8rem_1fr] items-start gap-2 px-4 py-2.5">
                                            <dt class="pt-px text-xs font-medium text-muted-foreground">Next step</dt>
                                            <dd class="text-sm text-muted-foreground">{{ recordNextStepFocus(detailsSheetRecord) }}</dd>
                                        </div>
                                        <div class="grid grid-cols-[8rem_1fr] items-start gap-2 px-4 py-2.5">
                                            <dt class="pt-px text-xs font-medium text-muted-foreground">Patient</dt>
                                            <dd class="text-sm">{{ recordPatientLabel(detailsSheetRecord) }}</dd>
                                        </div>
                                        <div class="grid grid-cols-[8rem_1fr] items-start gap-2 px-4 py-2.5">
                                            <dt class="pt-px text-xs font-medium text-muted-foreground">Encounter</dt>
                                            <dd class="text-sm">{{ formatDateTime(detailsSheetRecord.encounterAt) }}</dd>
                                        </div>
                                        <div v-if="detailsSheetRecord.appointmentId" class="grid grid-cols-[8rem_1fr] items-start gap-2 px-4 py-2.5">
                                            <dt class="pt-px text-xs font-medium text-muted-foreground">Appt. ref.</dt>
                                            <dd class="text-sm"><code class="rounded bg-muted px-1 py-0.5 font-mono text-xs text-muted-foreground">{{ shortId(detailsSheetRecord.appointmentId) }}</code></dd>
                                        </div>
                                        <div
                                            v-if="detailsSheetRecord.appointmentReferralId"
                                            class="grid grid-cols-[8rem_1fr] items-start gap-2 px-4 py-2.5"
                                        >
                                            <dt class="pt-px text-xs font-medium text-muted-foreground">Referral</dt>
                                            <dd class="space-y-1 text-sm">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <span>
                                                        {{
                                                            detailsLinkedAppointmentReferral
                                                                ? (detailsLinkedAppointmentReferral.referralNumber
                                                                    || 'Linked referral handoff')
                                                                : `Referral ref. ${shortId(detailsSheetRecord.appointmentReferralId)}`
                                                        }}
                                                    </span>
                                                    <Badge
                                                        v-if="detailsLinkedAppointmentReferral"
                                                        :variant="appointmentReferralStatusVariant(detailsLinkedAppointmentReferral.status)"
                                                        class="h-5 text-[11px]"
                                                    >
                                                        {{ formatEnumLabel(detailsLinkedAppointmentReferral.status || 'requested') }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="detailsLinkedAppointmentReferral?.priority"
                                                        :variant="appointmentReferralPriorityVariant(detailsLinkedAppointmentReferral.priority)"
                                                        class="h-5 text-[11px]"
                                                    >
                                                        {{ formatEnumLabel(detailsLinkedAppointmentReferral.priority) }}
                                                    </Badge>
                                                </div>
                                                <p class="text-xs text-muted-foreground">
                                                    {{
                                                        detailsLinkedAppointmentReferral
                                                            ? appointmentReferralDestinationText(detailsLinkedAppointmentReferral)
                                                            : detailsAppointmentReferralsLoading
                                                                ? 'Loading linked referral handoff...'
                                                                : (detailsAppointmentReferralsError || 'This medical record remains linked to the selected referral workflow.')
                                                    }}
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{
                                                        detailsLinkedAppointmentReferral
                                                            ? appointmentReferralSummaryText(detailsLinkedAppointmentReferral)
                                                            : detailsAppointmentReferralsLoading
                                                                ? 'Loading linked referral handoff...'
                                                                : (detailsAppointmentReferralsError || 'Referral transfer details stay attached to this medical record.')
                                                    }}
                                                </p>
                                                <p
                                                    v-if="detailsLinkedAppointmentReferral"
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    {{ appointmentReferralTimingText(detailsLinkedAppointmentReferral) }}
                                                </p>
                                                <Button
                                                    v-if="detailsLinkedAppointmentReferralHref && canReadAppointments"
                                                    size="sm"
                                                    variant="outline"
                                                    as-child
                                                    class="mt-1 h-7 gap-1.5 px-2 text-xs"
                                                >
                                                    <Link :href="detailsLinkedAppointmentReferralHref">
                                                        Open referral workflow
                                                    </Link>
                                                </Button>
                                            </dd>
                                        </div>
                                        <div v-if="detailsSheetRecord.admissionId" class="grid grid-cols-[8rem_1fr] items-start gap-2 px-4 py-2.5">
                                            <dt class="pt-px text-xs font-medium text-muted-foreground">Admission ref.</dt>
                                            <dd class="text-sm"><code class="rounded bg-muted px-1 py-0.5 font-mono text-xs text-muted-foreground">{{ shortId(detailsSheetRecord.admissionId) }}</code></dd>
                                        </div>
                                        <div
                                            v-if="detailsSheetRecord.theatreProcedureId"
                                            class="grid grid-cols-[8rem_1fr] items-start gap-2 px-4 py-2.5"
                                        >
                                            <dt class="pt-px text-xs font-medium text-muted-foreground">Procedure</dt>
                                            <dd class="space-y-1 text-sm">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <span>
                                                        {{
                                                            detailsLinkedTheatreProcedure
                                                                ? (detailsLinkedTheatreProcedure.procedureNumber
                                                                    || detailsLinkedTheatreProcedure.procedureName
                                                                    || detailsLinkedTheatreProcedure.procedureType
                                                                    || 'Linked theatre procedure')
                                                                : `Procedure ref. ${shortId(detailsSheetRecord.theatreProcedureId)}`
                                                        }}
                                                    </span>
                                                    <Badge
                                                        v-if="detailsLinkedTheatreProcedure"
                                                        :variant="theatreProcedureStatusVariant(detailsLinkedTheatreProcedure.status)"
                                                        class="h-5 text-[11px]"
                                                    >
                                                        {{ formatEnumLabel(detailsLinkedTheatreProcedure.status || 'planned') }}
                                                    </Badge>
                                                </div>
                                                <p class="text-xs text-muted-foreground">
                                                    {{
                                                        detailsLinkedTheatreProcedure
                                                            ? theatreProcedureSummaryText(detailsLinkedTheatreProcedure)
                                                            : detailsEncounterTheatreProceduresLoading
                                                                ? 'Loading linked theatre case...'
                                                                : (detailsEncounterTheatreProceduresError || 'This medical record remains linked to the selected theatre case.')
                                                    }}
                                                </p>
                                                <Button
                                                    v-if="detailsLinkedTheatreProcedureHref && canReadTheatreProcedures"
                                                    size="sm"
                                                    variant="outline"
                                                    as-child
                                                    class="mt-1 h-7 gap-1.5 px-2 text-xs"
                                                >
                                                    <Link :href="detailsLinkedTheatreProcedureHref">
                                                        <AppIcon name="scissors" class="size-3.5" />
                                                        Open theatre case
                                                    </Link>
                                                </Button>
                                            </dd>
                                        </div>
                                        <div class="grid grid-cols-[8rem_1fr] items-start gap-2 px-4 py-2.5">
                                            <dt class="pt-px text-xs font-medium text-muted-foreground">Signed by</dt>
                                            <dd class="text-sm text-muted-foreground">{{ detailsSheetRecord.signedByUserName || (detailsSheetRecord.signedByUserId === null || detailsSheetRecord.signedByUserId === undefined ? 'Not signed' : 'Clinician #' + detailsSheetRecord.signedByUserId) }}<template v-if="detailsSheetRecord.signedAt"> · {{ formatDateTime(detailsSheetRecord.signedAt) }}</template></dd>
                                        </div>
                                        <div class="grid grid-cols-[8rem_1fr] items-start gap-2 px-4 py-2.5">
                                            <dt class="pt-px text-xs font-medium text-muted-foreground">Updated</dt>
                                            <dd class="text-sm text-muted-foreground">{{ formatDateTime(detailsSheetRecord.updatedAt) }}</dd>
                                        </div>
                                    </dl>

                                    <!-- SOAP note content -->
                                    <div>
                                        <p class="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Clinical note</p>
                                        <div
                                            v-if="
                                                plainTextFromHtml(detailsSheetRecord.subjective) ||
                                                plainTextFromHtml(detailsSheetRecord.objective) ||
                                                plainTextFromHtml(detailsSheetRecord.assessment) ||
                                                plainTextFromHtml(detailsSheetRecord.plan)
                                            "
                                            class="grid gap-3 md:grid-cols-2"
                                        >
                                            <div v-if="plainTextFromHtml(detailsSheetRecord.subjective)" class="rounded-md border bg-muted/20 p-3">
                                                <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ medicalRecordNoteTypeSectionLabel(detailsSheetRecord.recordType, 'subjective') }}</p>
                                                <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ plainTextFromHtml(detailsSheetRecord.subjective) }}</p>
                                            </div>
                                            <div v-if="plainTextFromHtml(detailsSheetRecord.objective)" class="rounded-md border bg-muted/20 p-3">
                                                <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ medicalRecordNoteTypeSectionLabel(detailsSheetRecord.recordType, 'objective') }}</p>
                                                <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ plainTextFromHtml(detailsSheetRecord.objective) }}</p>
                                            </div>
                                            <div v-if="plainTextFromHtml(detailsSheetRecord.assessment)" class="rounded-md border bg-muted/20 p-3">
                                                <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ medicalRecordNoteTypeSectionLabel(detailsSheetRecord.recordType, 'assessment') }}</p>
                                                <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ plainTextFromHtml(detailsSheetRecord.assessment) }}</p>
                                            </div>
                                            <div v-if="plainTextFromHtml(detailsSheetRecord.plan)" class="rounded-md border bg-muted/20 p-3">
                                                <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ medicalRecordNoteTypeSectionLabel(detailsSheetRecord.recordType, 'plan') }}</p>
                                                <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ plainTextFromHtml(detailsSheetRecord.plan) }}</p>
                                            </div>
                                        </div>
                                        <p v-else class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No clinical narrative has been recorded for this entry yet.</p>
                                    </div>

                                    <!-- Encounter orders -->
                                    <div
                                        v-if="
                                            detailsSheetRecord.patientId &&
                                            (detailsSheetRecord.appointmentId || detailsSheetRecord.admissionId) &&
                                            (canReadLaboratoryOrders || canReadPharmacyOrders || canReadRadiologyOrders || canReadTheatreProcedures)
                                        "
                                        class="rounded-lg border"
                                    >
                                        <div class="flex items-center gap-2 border-b px-4 py-2.5">
                                            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Encounter orders</p>
                                        </div>

                                        <!-- Lab orders -->
                                        <template v-if="canReadLaboratoryOrders">
                                            <div class="flex items-center gap-2 border-b bg-muted/30 px-4 py-1.5">
                                                <AppIcon name="flask-conical" class="size-3.5 text-muted-foreground" />
                                                <p class="text-xs font-medium text-muted-foreground">Laboratory</p>
                                                <div v-if="detailsEncounterLaboratoryOrdersLoading" class="ml-auto"><Skeleton class="h-3 w-12" /></div>
                                                <p v-else-if="detailsEncounterLaboratoryOrders.length" class="ml-auto text-xs text-muted-foreground">{{ detailsEncounterLaboratoryOrders.length }}</p>
                                            </div>
                                            <div v-if="detailsEncounterLaboratoryOrdersLoading" class="px-4 py-2"><Skeleton class="h-8 w-full" /></div>
                                            <p v-else-if="detailsEncounterLaboratoryOrdersError" class="px-4 py-2.5 text-sm text-destructive">{{ detailsEncounterLaboratoryOrdersError }}</p>
                                            <p v-else-if="detailsEncounterLaboratoryOrders.length === 0" class="px-4 py-2.5 text-xs text-muted-foreground">None linked yet.</p>
                                            <div v-else class="divide-y">
                                                <div v-for="order in detailsEncounterLaboratoryOrders" :key="`mr-details-lab-order-${order.id}`" class="px-4 py-2.5">
                                                    <div class="flex items-center gap-3">
                                                        <div class="min-w-0 flex-1">
                                                            <p class="truncate text-sm font-medium">{{ order.testName || 'Laboratory order' }}</p>
                                                            <p class="text-xs text-muted-foreground">{{ order.orderNumber || '—' }} · {{ formatDateTime(order.orderedAt) }}</p>
                                                        </div>
                                                        <Badge :variant="laboratoryOrderStatusVariant(order.status)" class="shrink-0 text-[11px]">{{ formatEnumLabel(order.status || 'ordered') }}</Badge>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger as-child>
                                                                <Button variant="ghost" size="icon" class="size-7 shrink-0"><AppIcon name="ellipsis" class="size-3.5" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem v-if="canOpenLaboratoryWorkflow" as-child><Link :href="recordContextHref('/laboratory-orders', detailsSheetRecord, { includeTabNew: true, reorderOfId: order.id })">Reorder</Link></DropdownMenuItem>
                                                                <DropdownMenuItem v-if="canOpenLaboratoryWorkflow" as-child><Link :href="recordContextHref('/laboratory-orders', detailsSheetRecord, { includeTabNew: true, addOnToOrderId: order.id })">Add linked test</Link></DropdownMenuItem>
                                                                <DropdownMenuSeparator v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'cancel') || canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error')" />
                                                                <DropdownMenuItem v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'cancel')" @click="openEncounterLifecycleDialog('laboratory', order.id, 'cancel', order.statusReason)">Cancel</DropdownMenuItem>
                                                                <DropdownMenuItem v-if="canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error')" @click="openEncounterLifecycleDialog('laboratory', order.id, 'entered_in_error')">Entered in error</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    <p v-if="order.resultSummary || order.priority" class="mt-1 text-xs text-muted-foreground">{{ order.resultSummary ? order.resultSummary : `Priority: ${formatEnumLabel(order.priority)}` }}</p>
                                                    <p v-if="lifecycleLinkageText(order, 'laboratory order')" class="mt-0.5 text-[11px] text-muted-foreground">{{ lifecycleLinkageText(order, 'laboratory order') }}</p>
                                                </div>
                                            </div>
                                        </template>

                                        <!-- Pharmacy orders -->
                                        <template v-if="canReadPharmacyOrders">
                                            <div class="flex items-center gap-2 border-b border-t bg-muted/30 px-4 py-1.5">
                                                <AppIcon name="pill" class="size-3.5 text-muted-foreground" />
                                                <p class="text-xs font-medium text-muted-foreground">Pharmacy</p>
                                                <div v-if="detailsEncounterPharmacyOrdersLoading" class="ml-auto"><Skeleton class="h-3 w-12" /></div>
                                                <p v-else-if="detailsEncounterPharmacyOrders.length" class="ml-auto text-xs text-muted-foreground">{{ detailsEncounterPharmacyOrders.length }}</p>
                                            </div>
                                            <div v-if="detailsEncounterPharmacyOrdersLoading" class="px-4 py-2"><Skeleton class="h-8 w-full" /></div>
                                            <p v-else-if="detailsEncounterPharmacyOrdersError" class="px-4 py-2.5 text-sm text-destructive">{{ detailsEncounterPharmacyOrdersError }}</p>
                                            <p v-else-if="detailsEncounterPharmacyOrders.length === 0" class="px-4 py-2.5 text-xs text-muted-foreground">None linked yet.</p>
                                            <div v-else class="divide-y">
                                                <div v-for="order in detailsEncounterPharmacyOrders" :key="`mr-details-pharmacy-order-${order.id}`" class="px-4 py-2.5">
                                                    <div class="flex items-center gap-3">
                                                        <div class="min-w-0 flex-1">
                                                            <p class="truncate text-sm font-medium">{{ order.medicationName || 'Pharmacy order' }}</p>
                                                            <p class="text-xs text-muted-foreground">{{ order.orderNumber || '—' }}<span v-if="pharmacyOrderQuantityLabel(order.quantityPrescribed)"> · {{ pharmacyOrderQuantityLabel(order.quantityPrescribed) }}</span> · {{ formatDateTime(order.orderedAt) }}</p>
                                                        </div>
                                                        <Badge :variant="pharmacyOrderStatusVariant(order.status)" class="shrink-0 text-[11px]">{{ formatEnumLabel(order.status || 'pending') }}</Badge>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger as-child>
                                                                <Button variant="ghost" size="icon" class="size-7 shrink-0"><AppIcon name="ellipsis" class="size-3.5" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem v-if="canOpenPharmacyWorkflow" as-child><Link :href="recordContextHref('/pharmacy-orders', detailsSheetRecord, { includeTabNew: true, reorderOfId: order.id })">Reorder</Link></DropdownMenuItem>
                                                                <DropdownMenuItem v-if="canOpenPharmacyWorkflow" as-child><Link :href="recordContextHref('/pharmacy-orders', detailsSheetRecord, { includeTabNew: true, addOnToOrderId: order.id })">Add linked medication</Link></DropdownMenuItem>
                                                                <DropdownMenuSeparator v-if="canApplyPharmacyEncounterLifecycleAction(order, 'cancel') || canApplyPharmacyEncounterLifecycleAction(order, 'discontinue') || canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error')" />
                                                                <DropdownMenuItem v-if="canApplyPharmacyEncounterLifecycleAction(order, 'cancel')" @click="openEncounterLifecycleDialog('pharmacy', order.id, 'cancel', order.statusReason)">Cancel</DropdownMenuItem>
                                                                <DropdownMenuItem v-if="canApplyPharmacyEncounterLifecycleAction(order, 'discontinue')" @click="openEncounterLifecycleDialog('pharmacy', order.id, 'discontinue')">Discontinue</DropdownMenuItem>
                                                                <DropdownMenuItem v-if="canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error')" @click="openEncounterLifecycleDialog('pharmacy', order.id, 'entered_in_error')">Entered in error</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    <p class="mt-1 text-xs text-muted-foreground">{{ pharmacyOrderSummaryText(order) }}</p>
                                                    <p v-if="lifecycleLinkageText(order, 'medication order')" class="mt-0.5 text-[11px] text-muted-foreground">{{ lifecycleLinkageText(order, 'medication order') }}</p>
                                                </div>
                                            </div>
                                        </template>

                                        <!-- Radiology / imaging orders -->
                                        <template v-if="canReadRadiologyOrders">
                                            <div class="flex items-center gap-2 border-b border-t bg-muted/30 px-4 py-1.5">
                                                <AppIcon name="eye" class="size-3.5 text-muted-foreground" />
                                                <p class="text-xs font-medium text-muted-foreground">Imaging</p>
                                                <div v-if="detailsEncounterRadiologyOrdersLoading" class="ml-auto"><Skeleton class="h-3 w-12" /></div>
                                                <p v-else-if="detailsEncounterRadiologyOrders.length" class="ml-auto text-xs text-muted-foreground">{{ detailsEncounterRadiologyOrders.length }}</p>
                                            </div>
                                            <div v-if="detailsEncounterRadiologyOrdersLoading" class="px-4 py-2"><Skeleton class="h-8 w-full" /></div>
                                            <p v-else-if="detailsEncounterRadiologyOrdersError" class="px-4 py-2.5 text-sm text-destructive">{{ detailsEncounterRadiologyOrdersError }}</p>
                                            <p v-else-if="detailsEncounterRadiologyOrders.length === 0" class="px-4 py-2.5 text-xs text-muted-foreground">None linked yet.</p>
                                            <div v-else class="divide-y">
                                                <div v-for="order in detailsEncounterRadiologyOrders" :key="`mr-details-radiology-order-${order.id}`" class="px-4 py-2.5">
                                                    <div class="flex items-center gap-3">
                                                        <div class="min-w-0 flex-1">
                                                            <p class="truncate text-sm font-medium">{{ order.studyDescription || 'Imaging order' }}</p>
                                                            <p class="text-xs text-muted-foreground">{{ order.orderNumber || '—' }} · {{ formatDateTime(order.orderedAt) }}</p>
                                                        </div>
                                                        <Badge :variant="radiologyOrderStatusVariant(order.status)" class="shrink-0 text-[11px]">{{ formatEnumLabel(order.status || 'ordered') }}</Badge>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger as-child>
                                                                <Button variant="ghost" size="icon" class="size-7 shrink-0"><AppIcon name="ellipsis" class="size-3.5" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem v-if="canOpenRadiologyWorkflow" as-child><Link :href="recordContextHref('/radiology-orders', detailsSheetRecord, { includeTabNew: true, reorderOfId: order.id })">Reorder</Link></DropdownMenuItem>
                                                                <DropdownMenuItem v-if="canOpenRadiologyWorkflow" as-child><Link :href="recordContextHref('/radiology-orders', detailsSheetRecord, { includeTabNew: true, addOnToOrderId: order.id })">Add linked study</Link></DropdownMenuItem>
                                                                <DropdownMenuSeparator v-if="canApplyRadiologyEncounterLifecycleAction(order, 'cancel') || canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error')" />
                                                                <DropdownMenuItem v-if="canApplyRadiologyEncounterLifecycleAction(order, 'cancel')" @click="openEncounterLifecycleDialog('radiology', order.id, 'cancel', order.statusReason)">Cancel</DropdownMenuItem>
                                                                <DropdownMenuItem v-if="canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error')" @click="openEncounterLifecycleDialog('radiology', order.id, 'entered_in_error')">Entered in error</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    <p class="mt-1 text-xs text-muted-foreground">{{ radiologyOrderSummaryText(order) }}</p>
                                                    <p v-if="lifecycleLinkageText(order, 'imaging order')" class="mt-0.5 text-[11px] text-muted-foreground">{{ lifecycleLinkageText(order, 'imaging order') }}</p>
                                                </div>
                                            </div>
                                        </template>

                                        <!-- Theatre procedures -->
                                        <template v-if="canReadTheatreProcedures">
                                            <div class="flex items-center gap-2 border-b border-t bg-muted/30 px-4 py-1.5">
                                                <AppIcon name="scissors" class="size-3.5 text-muted-foreground" />
                                                <p class="text-xs font-medium text-muted-foreground">Theatre</p>
                                                <div v-if="detailsEncounterTheatreProceduresLoading" class="ml-auto"><Skeleton class="h-3 w-12" /></div>
                                                <p v-else-if="detailsEncounterTheatreProcedures.length" class="ml-auto text-xs text-muted-foreground">{{ detailsEncounterTheatreProcedures.length }}</p>
                                            </div>
                                            <div v-if="detailsEncounterTheatreProceduresLoading" class="px-4 py-2"><Skeleton class="h-8 w-full" /></div>
                                            <p v-else-if="detailsEncounterTheatreProceduresError" class="px-4 py-2.5 text-sm text-destructive">{{ detailsEncounterTheatreProceduresError }}</p>
                                            <p v-else-if="detailsEncounterTheatreProcedures.length === 0" class="px-4 py-2.5 text-xs text-muted-foreground">None linked yet.</p>
                                            <div v-else class="divide-y">
                                                <div v-for="procedure in detailsEncounterTheatreProcedures" :key="`mr-details-theatre-procedure-${procedure.id}`" class="px-4 py-2.5">
                                                    <div class="flex items-center gap-3">
                                                        <div class="min-w-0 flex-1">
                                                            <p class="truncate text-sm font-medium">{{ procedure.procedureName || procedure.procedureType || 'Theatre procedure' }}</p>
                                                            <p class="text-xs text-muted-foreground">{{ procedure.procedureNumber || '—' }} · Scheduled {{ formatDateTime(procedure.scheduledAt) }}</p>
                                                        </div>
                                                        <Badge
                                                            v-if="detailsSheetRecord.theatreProcedureId === procedure.id"
                                                            variant="outline"
                                                            class="shrink-0 text-[11px]"
                                                        >
                                                            Linked to note
                                                        </Badge>
                                                        <Badge :variant="theatreProcedureStatusVariant(procedure.status)" class="shrink-0 text-[11px]">{{ formatEnumLabel(procedure.status || 'planned') }}</Badge>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger as-child>
                                                                <Button variant="ghost" size="icon" class="size-7 shrink-0"><AppIcon name="ellipsis" class="size-3.5" /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    v-if="canReadTheatreProcedures"
                                                                    as-child
                                                                >
                                                                    <Link
                                                                        :href="theatreProcedureFocusHref(procedure.id, {
                                                                            patientId: detailsSheetRecord.patientId,
                                                                            appointmentId: detailsSheetRecord.appointmentId,
                                                                            admissionId: detailsSheetRecord.admissionId,
                                                                            recordId: detailsSheetRecord.id,
                                                                            focusWorkflowActionKey: 'procedure-note-continuity',
                                                                        })"
                                                                    >
                                                                        Open theatre case
                                                                    </Link>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem v-if="canOpenTheatreWorkflow" as-child><Link :href="recordContextHref('/theatre-procedures', detailsSheetRecord, { includeTabNew: true, reorderOfId: procedure.id })">Reorder</Link></DropdownMenuItem>
                                                                <DropdownMenuItem v-if="canOpenTheatreWorkflow" as-child><Link :href="recordContextHref('/theatre-procedures', detailsSheetRecord, { includeTabNew: true, addOnToOrderId: procedure.id })">Add linked procedure</Link></DropdownMenuItem>
                                                                <DropdownMenuSeparator v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'cancel') || canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error')" />
                                                                <DropdownMenuItem v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'cancel')" @click="openEncounterLifecycleDialog('theatre', procedure.id, 'cancel', procedure.statusReason)">Cancel</DropdownMenuItem>
                                                                <DropdownMenuItem v-if="canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error')" @click="openEncounterLifecycleDialog('theatre', procedure.id, 'entered_in_error')">Entered in error</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                    <p class="mt-1 text-xs text-muted-foreground">{{ theatreProcedureSummaryText(procedure) }}</p>
                                                    <p v-if="lifecycleLinkageText(procedure, 'procedure booking')" class="mt-0.5 text-[11px] text-muted-foreground">{{ lifecycleLinkageText(procedure, 'procedure booking') }}</p>
                                                </div>
                                            </div>
                                        </template>
                                    </div>

                                    <!-- Documentation signoff -->
                                    <div class="rounded-lg border">
                                        <div class="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
                                            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Documentation signoff</p>
                                            <Badge :variant="statusVariant(detailsSheetRecord.status)" class="h-5 text-[11px]">{{ formatEnumLabel(detailsSheetRecord.status) }}</Badge>
                                            <Badge variant="outline" class="h-5 text-[11px]">{{ detailsAttestationCount }} attestation{{ detailsAttestationCount === 1 ? '' : 's' }}</Badge>
                                        </div>
                                        <div class="space-y-3 px-4 py-3">
                                            <p class="text-sm text-muted-foreground">{{ detailsFinalizeSummaryMeta }}</p>
                                            <p v-if="detailsLatestAttestation" class="text-xs text-muted-foreground">Latest attestation by {{ attestationActorLabel(detailsLatestAttestation) }} on {{ formatDateTime(detailsLatestAttestation.attestedAt) }}.</p>
                                            <div class="flex flex-wrap gap-2">
                                                <Button v-if="canApplyMedicalRecordStatusAction('finalized', detailsSheetRecord)" size="sm" :disabled="actionLoadingId === detailsSheetRecord.id" @click="finalizeRecord(detailsSheetRecord)">{{ actionLoadingId === detailsSheetRecord.id ? 'Updating...' : 'Finalize note' }}</Button>
                                                <Button v-else-if="canApplyMedicalRecordStatusAction('amended', detailsSheetRecord)" size="sm" variant="outline" :disabled="actionLoadingId === detailsSheetRecord.id" @click="openRecordStatusDialog(detailsSheetRecord, 'amended')">{{ actionLoadingId === detailsSheetRecord.id ? 'Updating...' : 'Amend note' }}</Button>
                                                <Button v-if="canCreateSignerAttestation(detailsSheetRecord)" size="sm" variant="outline" @click="focusDetailsAttestationComposer">Add attestation</Button>
                                                <Button v-if="canViewMedicalRecordAudit" size="sm" variant="outline" @click="applyDetailsAuditPreset('status')">Status audit</Button>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Signer attestation (compact) -->
                                    <div class="rounded-lg border">
                                        <div class="flex items-center gap-2 border-b px-4 py-2.5">
                                            <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Signer attestation</p>
                                            <Badge variant="outline" class="h-5 text-[11px]">{{ detailsAttestationCount }}</Badge>
                                        </div>
                                        <div class="space-y-3 px-4 py-3">
                                            <div v-if="detailsLatestAttestation" class="rounded-md border bg-muted/20 p-3">
                                                <div class="flex items-baseline justify-between gap-2">
                                                    <p class="text-sm font-medium">{{ attestationActorLabel(detailsLatestAttestation) }}</p>
                                                    <p class="text-xs text-muted-foreground">{{ formatDateTime(detailsLatestAttestation.attestedAt) }}</p>
                                                </div>
                                                <p class="mt-1 text-sm text-muted-foreground">{{ detailsLatestAttestation.attestationNote || 'No note provided.' }}</p>
                                            </div>
                                            <div class="flex items-end gap-2">
                                                <div class="min-w-0 flex-1 grid gap-1.5">
                                                    <Label for="medical-record-attestation-note">Attestation note</Label>
                                                    <Input id="medical-record-attestation-note" v-model="detailsAttestationNote" placeholder="Clinician attestation note" :disabled="detailsAttestationSubmitting || !canCreateSignerAttestation(detailsSheetRecord)" />
                                                </div>
                                                <Button size="sm" :disabled="detailsAttestationSubmitting || !canCreateSignerAttestation(detailsSheetRecord)" @click="submitDetailsSignerAttestation">{{ detailsAttestationSubmitting ? 'Saving...' : 'Add' }}</Button>
                                            </div>
                                            <Alert v-if="detailsAttestationsError" variant="destructive"><AlertTitle>Attestation Issue</AlertTitle><AlertDescription>{{ detailsAttestationsError }}</AlertDescription></Alert>
                                            <div v-else-if="detailsAttestationsLoading" class="space-y-2"><Skeleton class="h-8 w-full" /><Skeleton class="h-8 w-full" /></div>
                                            <div v-else-if="detailsAttestations.length > 0" class="divide-y rounded-md border">
                                                <div v-for="attestation in detailsAttestations" :key="attestation.id" class="flex items-baseline justify-between gap-3 px-3 py-2">
                                                    <div class="min-w-0">
                                                        <p class="text-sm font-medium">{{ attestationActorLabel(attestation) }}</p>
                                                        <p class="text-xs text-muted-foreground">{{ attestation.attestationNote || 'No note provided.' }}</p>
                                                    </div>
                                                    <p class="shrink-0 text-xs text-muted-foreground">{{ formatDateTime(attestation.attestedAt) }}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Version history (compact) -->
                                    <div class="rounded-lg border">
                                        <div class="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                                            <div class="flex items-center gap-2">
                                                <p class="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Version history</p>
                                                <Badge variant="outline" class="h-5 text-[11px]">{{ detailsVersionsMeta?.total ?? detailsVersions.length }}</Badge>
                                            </div>
                                            <Button size="sm" variant="ghost" class="h-7 gap-1.5 px-2 text-xs" :disabled="detailsVersionsLoading" @click="detailsSheetRecord && loadDetailsVersions(detailsSheetRecord.id)">{{ detailsVersionsLoading ? 'Loading...' : 'Refresh' }}</Button>
                                        </div>
                                        <div class="px-4 py-3">
                                            <Alert v-if="detailsVersionsError" variant="destructive"><AlertTitle>Version Load Issue</AlertTitle><AlertDescription>{{ detailsVersionsError }}</AlertDescription></Alert>
                                            <div v-else-if="detailsVersionsLoading" class="space-y-2"><Skeleton class="h-8 w-full" /><Skeleton class="h-8 w-full" /></div>
                                            <p v-else-if="detailsVersions.length === 0" class="text-sm text-muted-foreground">No version snapshots yet.</p>
                                            <div v-else class="space-y-3">
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="grid gap-1.5"><Label for="medical-record-diff-target-version" class="text-xs">Target version</Label><Select v-model="detailsSelectedVersionId"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="version in detailsVersions" :key="'version-target-' + version.id" :value="version.id">{{ versionLabel(version) }}</SelectItem></SelectContent></Select></div>
                                                    <div class="grid gap-1.5"><Label for="medical-record-diff-base-version" class="text-xs">Base version</Label><Select v-model="detailsAgainstVersionId"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="">Previous (default)</SelectItem><SelectItem v-for="version in detailsVersions" :key="'version-base-' + version.id" :value="version.id">{{ versionLabel(version) }}</SelectItem></SelectContent></Select></div>
                                                </div>
                                                <div class="flex items-center gap-3">
                                                    <Button size="sm" variant="outline" :disabled="detailsVersionDiffLoading || !detailsSelectedVersionId" @click="applyDetailsVersionDiff">{{ detailsVersionDiffLoading ? 'Comparing...' : 'Compare' }}</Button>
                                                    <p v-if="detailsVersionDiff" class="text-xs text-muted-foreground">v{{ detailsVersionDiff.targetVersion?.versionNumber ?? '?' }} vs {{ detailsVersionDiff.baseVersion ? 'v' + (detailsVersionDiff.baseVersion.versionNumber ?? '?') : 'baseline' }} — {{ detailsVersionDiff.summary.changedFieldCount }} field change{{ detailsVersionDiff.summary.changedFieldCount === 1 ? '' : 's' }}</p>
                                                </div>
                                                <Alert v-if="detailsVersionDiffError" variant="destructive"><AlertTitle>Version Diff Issue</AlertTitle><AlertDescription>{{ detailsVersionDiffError }}</AlertDescription></Alert>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Continue workflow -->
                                    <div>
                                        <p class="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Continue workflow</p>
                                        <div class="flex flex-wrap gap-2">
                                            <Button v-if="openedFromAppointments || detailsSheetRecord.appointmentId" size="sm" variant="outline" as-child class="gap-1.5">
                                                <Link :href="appointmentReturnHref(detailsSheetRecord.appointmentId)"><AppIcon name="calendar-clock" class="size-3.5" />{{ tW2('return.backToAppointments') }}</Link>
                                            </Button>
                                            <Button v-if="detailsSheetRecord.patientId && canOpenLaboratoryWorkflow" size="sm" variant="secondary" as-child class="gap-1.5">
                                                <Link :href="recordContextHref('/laboratory-orders', detailsSheetRecord)"><AppIcon name="flask-conical" class="size-3.5" />New Lab Order</Link>
                                            </Button>
                                            <Button v-if="detailsSheetRecord.patientId && canOpenPharmacyWorkflow" size="sm" variant="secondary" as-child class="gap-1.5">
                                                <Link :href="recordContextHref('/pharmacy-orders', detailsSheetRecord, { includeTabNew: true })"><AppIcon name="pill" class="size-3.5" />New Pharmacy Order</Link>
                                            </Button>
                                            <Button v-if="detailsSheetRecord.patientId && canOpenRadiologyWorkflow" size="sm" variant="secondary" as-child class="gap-1.5">
                                                <Link :href="recordContextHref('/radiology-orders', detailsSheetRecord)"><AppIcon name="eye" class="size-3.5" />New Imaging Order</Link>
                                            </Button>
                                            <Button v-if="detailsSheetRecord.patientId && canOpenTheatreWorkflow" size="sm" variant="secondary" as-child class="gap-1.5">
                                                <Link :href="recordContextHref('/theatre-procedures', detailsSheetRecord, { includeTabNew: true })"><AppIcon name="scissors" class="size-3.5" />Schedule Procedure</Link>
                                            </Button>
                                            <Button v-if="detailsSheetRecord.patientId && canCreateBillingWorkflow" size="sm" variant="secondary" as-child class="gap-1.5">
                                                <Link :href="recordContextHref('/billing-invoices', detailsSheetRecord)"><AppIcon name="file-text" class="size-3.5" />New Billing Invoice</Link>
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent
                                    value="timeline"
                                    class="mt-3 space-y-4"
                                >
                                    <div class="rounded-lg border p-4">
                                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div class="space-y-1">
                                                <p class="text-sm font-medium">Encounter timeline</p>
                                                <p class="text-xs text-muted-foreground">Follow the patient's note history, jump between encounter days, and open any entry as the current record.</p>
                                            </div>
                                            <div class="flex flex-wrap gap-2">
                                                <Button size="sm" variant="outline" @click="jumpToDetailsTimelineCurrentRecord">Current record</Button>
                                                <Button size="sm" variant="outline" :disabled="detailsTimelineLoading" @click="loadDetailsTimeline()">{{ detailsTimelineLoading ? 'Refreshing...' : 'Refresh timeline' }}</Button>
                                            </div>
                                        </div>
                                        <div v-if="detailsTimelineJumpTargets.length" class="mt-3 flex flex-wrap gap-2">
                                            <Button v-for="target in detailsTimelineJumpTargets" :key="'details-timeline-target-' + target.key" size="sm" :variant="target.isCurrent ? 'default' : 'outline'" class="gap-1.5" @click="jumpToDetailsTimelineGroup(target.key)">
                                                {{ target.label }}
                                                <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ target.count }}</Badge>
                                            </Button>
                                        </div>
                                    </div>
                                    <Alert v-if="detailsTimelineError" variant="destructive"><AlertTitle>Timeline Issue</AlertTitle><AlertDescription>{{ detailsTimelineError }}</AlertDescription></Alert>
                                    <div v-else-if="detailsTimelineLoading" class="space-y-3"><Skeleton class="h-20 w-full rounded-lg" /><Skeleton class="h-20 w-full rounded-lg" /></div>
                                    <div v-else-if="detailsTimelineGroups.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No encounter timeline records are available for this patient yet.</div>
                                    <div v-else class="space-y-4">
                                        <div v-for="group in detailsTimelineGroups" :key="group.key" :id="timelineGroupDomId(group.key)" class="rounded-lg border p-4">
                                            <div class="flex items-center justify-between gap-2">
                                                <div><p class="text-sm font-medium">{{ group.label }}</p><p class="text-xs text-muted-foreground">{{ group.items.length }} entr{{ group.items.length === 1 ? 'y' : 'ies' }}</p></div>
                                                <Badge variant="outline">{{ group.key }}</Badge>
                                            </div>
                                            <div class="mt-3 space-y-3">
                                                <div v-for="record in group.items" :id="recordTimelineEntryDomId(record.id)" :key="record.id" :class="['rounded-lg border p-3 transition-colors', isDetailsTimelineRecordHighlighted(record.id) ? 'border-primary bg-primary/5' : 'border-border bg-background']">
                                                    <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div class="min-w-0 space-y-2">
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <p class="text-sm font-medium">{{ record.recordNumber || 'Medical Record' }}</p>
                                                                <Badge :variant="statusVariant(record.status)">{{ formatEnumLabel(record.status) }}</Badge>
                                                                <Badge variant="outline">{{ recordTypeLabel(record.recordType) }}</Badge>
                                                            </div>
                                                            <p class="text-xs text-muted-foreground">{{ formatDateTime(recordOccurredAt(record)) }}</p>
                                                            <p class="text-sm text-muted-foreground">{{ plainTextFromHtml(record.assessment) || plainTextFromHtml(record.subjective) || plainTextFromHtml(record.plan) || 'No preview available for this entry.' }}</p>
                                                        </div>
                                                        <div class="flex flex-wrap gap-2">
                                                            <Button size="sm" variant="outline" class="gap-1.5" @click="toggleDetailsTimelineRecord(record.id)">{{ isDetailsTimelineRecordExpanded(record.id) ? 'Hide detail' : 'Show detail' }}</Button>
                                                            <Button v-if="record.id !== detailsSheetRecord.id" size="sm" variant="outline" class="gap-1.5" @click="openRecordDetailsSheet(record, { initialTab: 'timeline', timelineRecordId: record.id })">Open current</Button>
                                                        </div>
                                                    </div>
                                                    <div v-if="isDetailsTimelineRecordExpanded(record.id)" class="mt-3 grid gap-3 md:grid-cols-2">
                                                        <div v-if="plainTextFromHtml(record.subjective)" class="rounded-md border bg-muted/20 p-3"><p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ medicalRecordNoteTypeSectionLabel(record.recordType, 'subjective') }}</p><p class="mt-2 text-sm text-muted-foreground">{{ plainTextFromHtml(record.subjective) }}</p></div>
                                                        <div v-if="plainTextFromHtml(record.objective)" class="rounded-md border bg-muted/20 p-3"><p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ medicalRecordNoteTypeSectionLabel(record.recordType, 'objective') }}</p><p class="mt-2 text-sm text-muted-foreground">{{ plainTextFromHtml(record.objective) }}</p></div>
                                                        <div v-if="plainTextFromHtml(record.assessment)" class="rounded-md border bg-muted/20 p-3"><p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ medicalRecordNoteTypeSectionLabel(record.recordType, 'assessment') }}</p><p class="mt-2 text-sm text-muted-foreground">{{ plainTextFromHtml(record.assessment) }}</p></div>
                                                        <div v-if="plainTextFromHtml(record.plan)" class="rounded-md border bg-muted/20 p-3"><p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">{{ medicalRecordNoteTypeSectionLabel(record.recordType, 'plan') }}</p><p class="mt-2 text-sm text-muted-foreground">{{ plainTextFromHtml(record.plan) }}</p></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="detailsTimelineHasMore" class="flex justify-center"><Button variant="outline" :disabled="detailsTimelineLoadingMore" @click="loadMoreDetailsTimeline">{{ detailsTimelineLoadingMore ? 'Loading...' : 'Load more' }}</Button></div>
                                    </div>
                                </TabsContent>

                                <TabsContent v-if="canViewMedicalRecordAudit" value="audit" class="mt-3">
                                    <div class="rounded-lg border p-4">
                                        <p class="text-sm font-medium">
                                            Audit Trail
                                        </p>
                                        <p
                                            v-if="canViewMedicalRecordAudit"
                                            class="mt-1 text-xs text-muted-foreground"
                                        >
                                            {{ detailsAuditMeta?.total ?? 0 }}
                                            entries
                                        </p>
                                        <p
                                            v-else
                                            class="mt-1 text-xs text-muted-foreground"
                                        >
                                            Audit access is permission
                                            restricted.
                                        </p>
                                        <Alert
                                            v-if="!canViewMedicalRecordAudit"
                                            variant="destructive"
                                            class="mt-3"
                                        >
                                            <AlertTitle
                                                >Audit Access
                                                Restricted</AlertTitle
                                            >
                                            <AlertDescription>
                                                Request
                                                <code
                                                    >medical-records.view-audit-logs</code
                                                >
                                                permission.
                                            </AlertDescription>
                                        </Alert>
                                        <div v-else class="mt-3 space-y-3">
                                            <div class="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    :variant="
                                                        activeDetailsAuditPreset ===
                                                        'all'
                                                            ? 'default'
                                                            : 'outline'
                                                    "
                                                    @click="
                                                        applyDetailsAuditPreset(
                                                            'all',
                                                        )
                                                    "
                                                >
                                                    All Activity
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    :variant="
                                                        activeDetailsAuditPreset ===
                                                        'status'
                                                            ? 'default'
                                                            : 'outline'
                                                    "
                                                    @click="
                                                        applyDetailsAuditPreset(
                                                            'status',
                                                        )
                                                    "
                                                >
                                                    Status Changes
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    :variant="
                                                        activeDetailsAuditPreset ===
                                                        'attestation'
                                                            ? 'default'
                                                            : 'outline'
                                                    "
                                                    @click="
                                                        applyDetailsAuditPreset(
                                                            'attestation',
                                                        )
                                                    "
                                                >
                                                    Attestations
                                                </Button>
                                            </div>
                                            <div
                                                class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                                            >
                                                <Card
                                                    class="!gap-3 rounded-lg !py-3"
                                                >
                                                    <CardContent
                                                        class="px-4 pt-0"
                                                    >
                                                        <p
                                                            class="text-xs font-medium tracking-wider text-muted-foreground uppercase"
                                                        >
                                                            Total entries
                                                        </p>
                                                        <p
                                                            class="mt-2 text-2xl font-semibold"
                                                        >
                                                            {{
                                                                detailsAuditSummary.total
                                                            }}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                                <Card
                                                    class="!gap-3 rounded-lg !py-3"
                                                >
                                                    <CardContent
                                                        class="px-4 pt-0"
                                                    >
                                                        <p
                                                            class="text-xs font-medium tracking-wider text-muted-foreground uppercase"
                                                        >
                                                            Changed events
                                                        </p>
                                                        <p
                                                            class="mt-2 text-2xl font-semibold"
                                                        >
                                                            {{
                                                                detailsAuditSummary.changedEntries
                                                            }}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                                <Card
                                                    class="!gap-3 rounded-lg !py-3"
                                                >
                                                    <CardContent
                                                        class="px-4 pt-0"
                                                    >
                                                        <p
                                                            class="text-xs font-medium tracking-wider text-muted-foreground uppercase"
                                                        >
                                                            User actions
                                                        </p>
                                                        <p
                                                            class="mt-2 text-2xl font-semibold"
                                                        >
                                                            {{
                                                                detailsAuditSummary.userEntries
                                                            }}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                                <Card
                                                    class="!gap-3 rounded-lg !py-3"
                                                >
                                                    <CardContent
                                                        class="px-4 pt-0"
                                                    >
                                                        <p
                                                            class="text-xs font-medium tracking-wider text-muted-foreground uppercase"
                                                        >
                                                            Current view
                                                        </p>
                                                        <p
                                                            class="mt-2 text-sm font-medium"
                                                        >
                                                            {{
                                                                detailsAuditHasActiveFilters
                                                                    ? 'Filtered'
                                                                    : 'All audit events'
                                                            }}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                            <div
                                                class="grid gap-3 rounded-md border p-3 md:grid-cols-2"
                                            >
                                                <div class="grid gap-2">
                                                    <Label
                                                        for="medical-record-audit-q"
                                                        >Action Text
                                                        Search</Label
                                                    >
                                                    <Input
                                                        id="medical-record-audit-q"
                                                        v-model="
                                                            detailsAuditFilters.q
                                                        "
                                                        placeholder="status.updated, created, archived..."
                                                    />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label
                                                        for="medical-record-audit-action"
                                                        >Action</Label
                                                    >
                                                    <Select v-model=" detailsAuditFilters.action "><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                                                        <SelectItem
                                                            value=""
                                                        >
                                                            All actions
                                                        </SelectItem>
                                                        <SelectItem
                                                            v-for="option in medicalRecordAuditActionOptions"
                                                            :key="`medical-record-audit-action-${option.value}`"
                                                            :value="option.value"
                                                        >
                                                            {{ option.label }}
                                                        </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label
                                                        for="medical-record-audit-actor-type"
                                                        >Actor Type</Label
                                                    >
                                                    <Select v-model=" detailsAuditFilters.actorType "><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                                                        <SelectItem
                                                            v-for="option in auditActorTypeOptions"
                                                            :key="`medical-record-audit-actor-type-${option.value || 'all'}`"
                                                            :value="
                                                                option.value
                                                            "
                                                        >
                                                            {{ option.label }}
                                                        </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label
                                                        for="medical-record-audit-actor-id"
                                                        >Actor ID</Label
                                                    >
                                                    <Input
                                                        id="medical-record-audit-actor-id"
                                                        v-model="
                                                            detailsAuditFilters.actorId
                                                        "
                                                        inputmode="numeric"
                                                        placeholder="Optional user id"
                                                    />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label
                                                        for="medical-record-audit-from"
                                                        >From</Label
                                                    >
                                                    <Input
                                                        id="medical-record-audit-from"
                                                        v-model="
                                                            detailsAuditFilters.from
                                                        "
                                                        type="datetime-local"
                                                    />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label
                                                        for="medical-record-audit-to"
                                                        >To</Label
                                                    >
                                                    <Input
                                                        id="medical-record-audit-to"
                                                        v-model="
                                                            detailsAuditFilters.to
                                                        "
                                                        type="datetime-local"
                                                    />
                                                </div>
                                                <div class="grid gap-2">
                                                    <Label
                                                        for="medical-record-audit-per-page"
                                                        >Rows Per Page</Label
                                                    >
                                                    <Select :model-value="String( detailsAuditFilters.perPage )" @update:model-value=" detailsAuditFilters.perPage  = Number($event)"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                                                        <SelectItem value="10">10</SelectItem>
                                                        <SelectItem value="20">20</SelectItem>
                                                        <SelectItem value="50">50</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div
                                                    class="flex flex-wrap items-end gap-2"
                                                >
                                                    <Button
                                                        size="sm"
                                                        :disabled="
                                                            detailsAuditLoading
                                                        "
                                                        @click="
                                                            applyDetailsAuditFilters
                                                        "
                                                    >
                                                        {{
                                                            detailsAuditLoading
                                                                ? 'Applying...'
                                                                : 'Apply Filters'
                                                        }}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        :disabled="
                                                            detailsAuditLoading
                                                        "
                                                        @click="
                                                            resetDetailsAuditFilters
                                                        "
                                                    >
                                                        Reset
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        :disabled="
                                                            detailsAuditLoading ||
                                                            detailsAuditExporting
                                                        "
                                                        @click="
                                                            exportDetailsAuditLogsCsv
                                                        "
                                                    >
                                                        {{
                                                            detailsAuditExporting
                                                                ? 'Preparing...'
                                                                : 'Export CSV'
                                                        }}
                                                    </Button>
                                                </div>
                                            </div>
                                            <Alert
                                                v-if="detailsAuditError"
                                                variant="destructive"
                                            >
                                                <AlertTitle
                                                    >Audit Load
                                                    Issue</AlertTitle
                                                >
                                                <AlertDescription>{{
                                                    detailsAuditError
                                                }}</AlertDescription>
                                            </Alert>
                                            <div
                                                v-else-if="detailsAuditLoading"
                                                class="space-y-2"
                                            >
                                                <Skeleton class="h-12 w-full" />
                                                <Skeleton class="h-12 w-full" />
                                            </div>
                                            <div
                                                v-else-if="
                                                    detailsAuditLogs.length ===
                                                    0
                                                "
                                                class="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
                                            >
                                                No audit logs found for current
                                                filters.
                                            </div>
                                            <AuditTimelineList
                                                v-else
                                                :logs="detailsAuditLogs"
                                                :format-date-time="formatDateTime"
                                                :change-key-label="auditFieldLabel"
                                            />
                                            <div
                                                class="flex items-center justify-between border-t pt-2"
                                            >
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    class="gap-1.5"
                                                    :disabled="
                                                        detailsAuditLoading ||
                                                        !detailsAuditMeta ||
                                                        detailsAuditMeta.currentPage <=
                                                            1
                                                    "
                                                    @click="
                                                        goToDetailsAuditPage(
                                                            (detailsAuditMeta?.currentPage ??
                                                                2) - 1,
                                                        )
                                                    "
                                                >
                                                    <AppIcon
                                                        name="chevron-left"
                                                        class="size-3.5"
                                                    />
                                                    Previous
                                                </Button>
                                                <p
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    Page
                                                    {{
                                                        detailsAuditMeta?.currentPage ??
                                                        1
                                                    }}
                                                    of
                                                    {{
                                                        detailsAuditMeta?.lastPage ??
                                                        1
                                                    }}
                                                    |
                                                    {{
                                                        detailsAuditMeta?.total ??
                                                        detailsAuditLogs.length
                                                    }}
                                                    logs
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    class="gap-1.5"
                                                    :disabled="
                                                        detailsAuditLoading ||
                                                        !detailsAuditMeta ||
                                                        detailsAuditMeta.currentPage >=
                                                            detailsAuditMeta.lastPage
                                                    "
                                                    @click="
                                                        goToDetailsAuditPage(
                                                            (detailsAuditMeta?.currentPage ??
                                                                0) + 1,
                                                        )
                                                    "
                                                >
                                                    Next
                                                    <AppIcon
                                                        name="chevron-right"
                                                        class="size-3.5"
                                                    />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                    <SheetFooter
                        class="shrink-0 flex-row border-t bg-muted/20 px-4 py-3 sm:justify-end"
                    >
                        <Button
                            v-if="detailsSheetRecord"
                            variant="outline"
                            class="gap-1.5"
                            @click="openMedicalRecordPrintPreview(detailsSheetRecord)"
                        >
                            <AppIcon name="printer" class="size-3.5" />
                            Print note
                        </Button>
                        <Button
                            variant="outline"
                            class="gap-1.5"
                            @click="closeRecordDetailsSheet"
                        >
                            <AppIcon name="circle-x" class="size-3.5" />
                            Close
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog
                :open="createConsultationTakeoverDialogOpen"
                @update:open="(open) => (open ? (createConsultationTakeoverDialogOpen = true) : closeCreateConsultationTakeoverDialog())"
            >
                <DialogContent variant="action">
                    <DialogHeader>
                        <DialogTitle>Take over active consultation?</DialogTitle>
                        <DialogDescription>
                            This visit is currently owned by
                            <span class="font-medium text-foreground">
                                {{
                                    createConsultationTakeoverOwnerUserId !==
                                    null
                                        ? `clinician #${createConsultationTakeoverOwnerUserId}`
                                        : 'another clinician'
                                }}
                            </span>.
                            Confirm takeover and capture a short handoff reason.
                        </DialogDescription>
                    </DialogHeader>

                    <div class="space-y-2">
                        <Label for="medical-record-consultation-takeover-reason">
                            Handoff reason
                        </Label>
                        <Textarea
                            id="medical-record-consultation-takeover-reason"
                            v-model="createConsultationTakeoverReason"
                            rows="3"
                            placeholder="Example: Clinician handoff accepted to continue encounter continuity."
                        />
                        <p
                            v-if="createConsultationTakeoverError"
                            class="text-sm text-destructive"
                        >
                            {{ createConsultationTakeoverError }}
                        </p>
                    </div>

                    <DialogFooter class="gap-2">
                        <Button
                            variant="outline"
                            :disabled="createConsultationTakeoverSubmitting"
                            @click="closeCreateConsultationTakeoverDialog"
                        >
                            Cancel
                        </Button>
                        <Button
                            :disabled="createConsultationTakeoverSubmitting"
                            @click="submitCreateConsultationTakeover"
                        >
                            {{
                                createConsultationTakeoverSubmitting
                                    ? 'Taking over...'
                                    : 'Confirm takeover'
                            }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="createLeaveConfirmOpen"
                @update:open="(open) => (open ? (createLeaveConfirmOpen = true) : cancelMedicalRecordsNavigationLeave())"
            >
                <DialogContent variant="action">
                    <DialogHeader>
                        <DialogTitle>Leave consultation composer?</DialogTitle>
                        <DialogDescription>
                            Your draft is already saved locally on this device. If you leave this page now, you can restore it later from the consultation composer.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                        The note is not submitted yet. Stay here if you want to keep charting now, or leave the page and come back to restore the local draft.
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" @click="cancelMedicalRecordsNavigationLeave">
                            Stay on note
                        </Button>
                        <Button class="gap-1.5" @click="confirmMedicalRecordsNavigationLeave">
                            <AppIcon name="arrow-right" class="size-3.5" />
                            Leave page
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="encounterLifecycleDialogOpen"
                @update:open="(open) => (open ? (encounterLifecycleDialogOpen = true) : closeEncounterLifecycleDialog())"
            >
                <DialogContent variant="action">
                    <DialogHeader>
                        <DialogTitle>{{ encounterLifecycleActionLabel(encounterLifecycleAction) }}</DialogTitle>
                        <DialogDescription>
                            Apply this lifecycle action to <span class="font-medium text-foreground">{{ encounterLifecycleTargetName() }}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="grid gap-2">
                        <Label for="medical-record-encounter-lifecycle-reason">
                            Clinical reason
                        </Label>
                        <Input
                            id="medical-record-encounter-lifecycle-reason"
                            v-model="encounterLifecycleReason"
                            placeholder="Document the clinical reason for this lifecycle action."
                        />
                        <p v-if="encounterLifecycleError" class="text-sm text-destructive">
                            {{ encounterLifecycleError }}
                        </p>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button variant="outline" @click="closeEncounterLifecycleDialog">
                            Keep current order
                        </Button>
                        <Button :disabled="encounterLifecycleSubmitting" @click="submitEncounterLifecycleDialog">
                            {{
                                encounterLifecycleSubmitting
                                    ? 'Applying...'
                                    : encounterLifecycleActionLabel(encounterLifecycleAction)
                            }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="statusDialogOpen"
                @update:open="statusDialogOpen = $event"
            >
                <DialogContent variant="action">
                    <DialogHeader>
                        <DialogTitle>{{ statusDialogTitle }}</DialogTitle>
                        <DialogDescription>
                            {{ statusDialogDescription }}
                        </DialogDescription>
                    </DialogHeader>

                    <div class="space-y-4">
                        <div
                            v-if="statusDialogRecord"
                            class="rounded-lg border p-3 text-sm"
                        >
                            <div class="grid gap-1 sm:grid-cols-2">
                                <p>
                                    <span class="text-muted-foreground"
                                        >Record:</span
                                    >
                                    {{
                                        statusDialogRecord.recordNumber ||
                                        'Medical Record'
                                    }}
                                </p>
                                <p>
                                    <span class="text-muted-foreground"
                                        >Patient:</span
                                    >
                                    {{ recordPatientLabel(statusDialogRecord) }}
                                </p>
                                <p>
                                    <span class="text-muted-foreground"
                                        >Encounter:</span
                                    >
                                    {{
                                        formatDateTime(
                                            statusDialogRecord.encounterAt,
                                        )
                                    }}
                                </p>
                                <p>
                                    <span class="text-muted-foreground"
                                        >Status:</span
                                    >
                                    {{
                                        formatEnumLabel(
                                            statusDialogRecord.status,
                                        )
                                    }}
                                </p>
                            </div>
                        </div>

                        <div v-if="statusDialogNeedsReason" class="grid gap-2">
                            <Label for="medical-record-status-reason">
                                {{
                                    statusDialogAction === 'amended'
                                        ? 'Amendment Reason'
                                        : 'Archive Reason'
                                }}
                            </Label>
                            <Input
                                id="medical-record-status-reason"
                                v-model="statusDialogReason"
                                :placeholder="
                                    statusDialogAction === 'amended'
                                        ? 'Reason for amendment'
                                        : 'Reason for archive'
                                "
                            />
                        </div>

                        <Alert v-if="statusDialogError" variant="destructive">
                            <AlertTitle>Action blocked</AlertTitle>
                            <AlertDescription>{{
                                statusDialogError
                            }}</AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter class="gap-2">
                        <Button
                            variant="outline"
                            :disabled="Boolean(actionLoadingId)"
                            @click="closeRecordStatusDialog"
                        >
                            Close
                        </Button>
                        <Button
                            :variant="
                                statusDialogAction === 'archived'
                                    ? 'destructive'
                                    : 'default'
                            "
                            :disabled="Boolean(actionLoadingId)"
                            @click="submitRecordStatusDialog"
                        >
                            {{
                                actionLoadingId
                                    ? 'Updating...'
                                    : statusDialogAction === 'finalized'
                                      ? 'Finalize'
                                      : statusDialogAction === 'amended'
                                        ? 'Save Amendment'
                                        : statusDialogAction === 'archived'
                                          ? 'Archive'
                                          : 'Confirm'
                            }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    </AppLayout>
</template>
