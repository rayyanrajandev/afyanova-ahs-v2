<script setup lang="ts">
import { Head, Link, router, usePage } from '@inertiajs/vue3';

const props = withDefaults(
    defineProps<{
        encounterId?: string;
        legacyAppointmentId?: string;
    }>(),
    {
        encounterId: '',
        legacyAppointmentId: '',
    },
);
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
import EncounterBillingPanel from '@/components/domain/clinical/EncounterBillingPanel.vue';
import EncounterCloseChecklistDialog from '@/components/domain/clinical/EncounterCloseChecklistDialog.vue';
import EncounterDocumentsPanel from '@/components/domain/clinical/EncounterDocumentsPanel.vue';
import EncounterGovernancePanel from '@/components/domain/clinical/EncounterGovernancePanel.vue';
import EncounterLifecycleDialog from '@/components/domain/clinical/EncounterLifecycleDialog.vue';
import EncounterNoteComposerShell from '@/components/domain/clinical/EncounterNoteComposerShell.vue';
import EncounterOrdersCommandCenter from '@/components/domain/clinical/EncounterOrdersCommandCenter.vue';
import EncounterOrdersFocusSkeleton from '@/components/domain/clinical/EncounterOrdersFocusSkeleton.vue';
import EncounterWorkspaceHeader from '@/components/domain/clinical/EncounterWorkspaceHeader.vue';
import EncounterWorkspaceNavBar from '@/components/domain/clinical/EncounterWorkspaceNavBar.vue';
import EncounterWorkspacePaneHeader from '@/components/domain/clinical/EncounterWorkspacePaneHeader.vue';
import EncounterWorkflowCareStreams from '@/components/domain/clinical/EncounterWorkflowCareStreams.vue';
import EncounterTriageVitalsPanel from '@/components/domain/clinical/EncounterTriageVitalsPanel.vue';
import RichTextEditorField from '@/components/editor/RichTextEditorField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetFooter,
} from '@/components/ui/sheet';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import AppLayout from '@/layouts/AppLayout.vue';
import {
    auditActionDisplayLabel,
    type AuditActorSummary,
} from '@/lib/audit';
import { clearSensitiveLocalStorageKey } from '@/lib/browserStoragePolicy';
import { formatEnumLabel } from '@/lib/labels';
import { createLocaleTranslator } from '@/lib/locale';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import {
    encounterWorkspaceHref,
    encounterWorkspaceHrefForRecord,
    encounterWorkspaceLegacyAppointmentHref,
} from '@/lib/encounterWorkspace';
import type { EncounterInlineOrderType } from '@/lib/encounterInlineOrders';
import type { EncounterCloseReadiness } from '@/lib/encounterCloseReadiness';
import {
    encounterCareState,
    theatreProcedureStatusVariant,
    theatreProcedureSummaryText as formatTheatreProcedureSummary,
    type CreateEncounterCareSectionId,
    type CreateEncounterCareSummary,
    type EncounterCareState,
} from '@/lib/encounterWorkspaceCare';
import {
encounterLifecycleActionLabel,
    encounterLifecycleActionPath,
    encounterLifecycleActionSuccessMessage,
    isEncounterOrderEnteredInError,
    type EncounterLifecycleAction,
    type EncounterLifecycleTargetKind,
} from '@/lib/encounterWorkspaceLifecycle';
import { patientChartHref } from '@/lib/patientChart';
import { type BreadcrumbItem } from '@/types';
import type { EncounterWorkspacePaneFocus } from '@/types/encounterWorkspace';
import {
    MEDICAL_RECORD_NOTE_TYPE_OPTIONS,
    medicalRecordNoteTypeHelperText,
    medicalRecordNoteTypeLabel,
    medicalRecordNoteTypeNarrativeHeading,
    medicalRecordNoteTypeSectionLabel,
    medicalRecordNoteTypeSectionUi,
    sanitizeMedicalRecordNoteType,
} from '@/pages/medical-records/noteTypes';
type ScopeData = {
    resolvedFrom: string;
    tenant: { code: string; name: string } | null;
    facility: { code: string; name: string } | null;
};

type MedicalRecord = {
    id: string;
    recordNumber: string | null;
    patientId: string | null;
    encounterId: string | null;
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

type EncounterSummary = {
    id: string;
    encounterNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    primaryClinicianUserId: number | null;
    status: string | null;
    statusReason: string | null;
    openedAt: string | null;
    closedAt: string | null;
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
    triageVitalsSummary?: string | null;
    triageNotes?: string | null;
    triageCategory?: string | null;
    triagedAt?: string | null;
    triagedByUserId?: number | null;
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
    startedAt: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    notes: string | null;
};

type EncounterWorkspaceBundle = {
    encounter: EncounterSummary;
    appointment: AppointmentSummary | null;
    primaryMedicalRecord: MedicalRecord | null;
    laboratoryOrders: LaboratoryOrder[];
    pharmacyOrders: PharmacyOrder[];
    radiologyOrders: RadiologyOrder[];
    theatreProcedures: TheatreProcedure[];
    closeReadiness: EncounterCloseReadiness | null;
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
    encounterId: string;
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
type CreateSubmitIntent = 'save' | 'return' | 'finalize' | 'finalize_complete';
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

const breadcrumbs = computed<BreadcrumbItem[]>(() =>
    openedFromAppointments
        ? [
              { title: 'Appointments', href: '/appointments' },
              { title: 'Encounter workspace', href: '#' },
          ]
        : [
              { title: 'Medical Records', href: '/medical-records' },
              { title: 'Encounter workspace', href: '#' },
          ],
);

const ALL_RECORD_FILTER_VALUE = '__all_records__';
const PREVIOUS_VERSION_DIFF_VALUE = '__previous_version__';

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
const encounterWorkspaceBootstrapping = ref(true);
let encounterWorkspaceBootstrapInFlight: Promise<void> | null = null;
const createSubmitIntent = ref<CreateSubmitIntent>('save');
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
const recordsLoaded = ref(false);
const listErrors = ref<string[]>([]);
const actionMessage = ref<string | null>(null);
const createErrors = ref<Record<string, string[]>>({});

type CreateSuccessFeedbackTone =
    | 'saved'
    | 'finalized'
    | 'completed'
    | 'resumed'
    | 'checklist'
    | 'partial';

type CreateSuccessFeedback = {
    tone: CreateSuccessFeedbackTone;
    title: string;
    detail: string | null;
    recordNumber: string | null;
};

const createSuccessFeedback = ref<CreateSuccessFeedback | null>(null);
let createSuccessFeedbackTimer: number | null = null;

const createDraftRecoveryAvailable = ref(false);
const createDraftRecovered = ref(false);
const createDraftRecoverySavedAt = ref<string | null>(null);
const createDraftLastSavedAt = ref<string | null>(null);
const createDraftRecord = ref<MedicalRecord | null>(null);
const createDraftSyncState = ref<
    'idle' | 'saving' | 'saved' | 'error' | 'conflict'
>('idle');
const createDraftSyncError = ref<string | null>(null);
const createDraftSavedSignature = ref<string | null>(null);
const createDraftExpectedUpdatedAt = ref<string | null>(null);
const createDraftConflictRecord = ref<MedicalRecord | null>(null);
const createDraftHydratingExisting = ref(false);
const createDraftOnline = ref(
    typeof navigator === 'undefined' ? true : navigator.onLine,
);
const MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY =
    'afya.medical-records.create-draft.v1';
const MEDICAL_RECORD_DRAFT_SYNC_CHANNEL =
    'afya.medical-record-draft-sync.v1';
let createDraftBroadcastChannel: BroadcastChannel | null = null;
let createDraftAutosaveTimer: number | null = null;
let createDraftAutosaveMaxTimer: number | null = null;
let createDraftLoadRequestId = 0;
let removeMedicalRecordsNavigationGuard: VoidFunction | null = null;
const createLeaveConfirmOpen = ref(false);
const pendingMedicalRecordsVisit = ref<any | null>(null);
const pendingMedicalRecordsWorkspaceClose = ref<{ focusSearch?: boolean } | null>(null);
let bypassMedicalRecordsNavigationGuard = false;
const createFinalizeConfirmOpen = ref(false);
const createFinalizeConfirmIntent = ref<'finalize' | 'finalize_complete'>(
    'finalize_complete',
);
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
const createEncounterSummary = ref<EncounterSummary | null>(null);
const createEncounterSummaryLoading = ref(false);
const createEncounterCloseReadiness = ref<EncounterCloseReadiness | null>(null);
const createEncounterCloseDialogOpen = ref(false);
const createEncounterCloseReason = ref('');
const createEncounterCloseError = ref<string | null>(null);
const createEncounterCloseSubmitting = ref(false);
const createEncounterReopenDialogOpen = ref(false);
const createEncounterReopenReason = ref('');
const createEncounterReopenError = ref<string | null>(null);
const createEncounterReopenSubmitting = ref(false);
const createComposerWorkspaceTab = ref<'note' | 'workflow'>('note');
const createEncounterCareTab = ref<CreateEncounterCareSectionId | ''>('');
const encounterInlineOrderType = ref<EncounterInlineOrderType | null>(null);
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
const canUpdateMedicalRecords = ref(false);
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
        || (queryParam('tab') === 'new' ? queryParam('recordType') : '')
        || 'consultation_note',
    ),
    from: queryParam('from') || 'appointments',
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

const selectedRecordStatusFilter = computed({
    get: () => searchForm.status || ALL_RECORD_FILTER_VALUE,
    set: (value: string) => {
        searchForm.status = value === ALL_RECORD_FILTER_VALUE ? '' : value;
    },
});

const selectedRecordTypeFilter = computed({
    get: () => searchForm.recordType || ALL_RECORD_FILTER_VALUE,
    set: (value: string) => {
        searchForm.recordType = value === ALL_RECORD_FILTER_VALUE ? '' : value;
    },
});

const selectedDetailsAgainstVersionId = computed({
    get: () => detailsAgainstVersionId.value || PREVIOUS_VERSION_DIFF_VALUE,
    set: (value: string) => {
        detailsAgainstVersionId.value =
            value === PREVIOUS_VERSION_DIFF_VALUE ? '' : value;
    },
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

function formatDateTimeForInput(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return defaultEncounterAtLocal();
    }

    const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

const createForm = reactive<CreateForm>({
    patientId: initialCreateRouteContext.patientId,
    encounterId: '',
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

const isEncounterWorkspaceMode = computed(() => true);
const encounterWorkspaceSource = queryParam('from').trim();
const openedFromAppointments = encounterWorkspaceSource === 'appointments';
const openedFromDashboard = encounterWorkspaceSource === 'dashboard';
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

function encounterWorkspaceReturnSource(): 'appointments' | 'dashboard' | 'medical-records' {
    if (openedFromAppointments) return 'appointments';
    if (openedFromDashboard) return 'dashboard';

    return 'medical-records';
}

function encounterWorkspaceBackHref(): string {
    if (openedFromAppointments) return appointmentReturnHref();
    if (openedFromDashboard) return '/dashboard';

    return '/medical-records';
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
    const encounterId = createForm.encounterId.trim();

    if (patientId) params.set('patientId', patientId);
    if (encounterId) params.set('encounterId', encounterId);
    if (appointmentId) params.set('appointmentId', appointmentId);
    if (admissionId) params.set('admissionId', admissionId);
    if (recordId && path !== '/medical-records') params.set('recordId', recordId);
    if (options?.reorderOfId?.trim()) params.set('reorderOfId', options.reorderOfId.trim());
    if (options?.addOnToOrderId?.trim()) params.set('addOnToOrderId', options.addOnToOrderId.trim());
    if (shouldKeepAppointmentReturnContext(appointmentId)) {
        params.set('from', 'appointments');
    }
    if (
        isEncounterWorkspaceMode.value &&
        createForm.encounterId.trim()
    ) {
        params.set(
            'returnTo',
            encounterWorkspaceHref(createForm.encounterId.trim(), {
                from: encounterWorkspaceReturnSource(),
            }),
        );
    } else if (
        isEncounterWorkspaceMode.value &&
        createForm.appointmentId.trim()
    ) {
        params.set(
            'returnTo',
            encounterWorkspaceLegacyAppointmentHref(createForm.appointmentId.trim(), {
                from: encounterWorkspaceReturnSource(),
            }),
        );
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
const medicalRecordTab = ref<'new' | 'list'>('new');

if (createForm.patientId) {
    searchForm.patientId = createForm.patientId;
}


function cloneCreateForm(): CreateForm {
    return {
        patientId: createForm.patientId,
        encounterId: createForm.encounterId,
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

function buildMedicalRecordPersistenceBody(
    form: CreateForm = createForm,
    options?: { forceDraftSave?: boolean },
) {
    const body: Record<string, unknown> = {
        patientId: form.patientId.trim(),
        encounterId: form.encounterId.trim() || null,
        appointmentId: form.appointmentId.trim() || null,
        admissionId: form.admissionId.trim() || null,
        appointmentReferralId: form.appointmentReferralId.trim() || null,
        theatreProcedureId: form.theatreProcedureId.trim() || null,
        encounterAt: normalizeLocalDateTimeForApi(form.encounterAt),
        recordType: form.recordType.trim(),
        diagnosisCode: form.diagnosisCode.trim() || null,
        subjective: form.subjective.trim() || null,
        objective: form.objective.trim() || null,
        assessment: form.assessment.trim() || null,
        plan: form.plan.trim() || null,
    };

    if (createDraftExpectedUpdatedAt.value && !options?.forceDraftSave) {
        body.expectedUpdatedAt = createDraftExpectedUpdatedAt.value;
    }

    if (options?.forceDraftSave) {
        body.forceDraftSave = true;
    }

    return body;
}

function buildCreateDraftServerSignature(form: CreateForm = createForm): string {
    return JSON.stringify(buildMedicalRecordPersistenceBody(form));
}

function applyCreateDraftRecordToComposer(record: MedicalRecord) {
    createForm.patientId = record.patientId ?? '';
    createForm.encounterId = record.encounterId ?? '';
    createForm.appointmentId = record.appointmentId ?? '';
    createForm.admissionId = record.admissionId ?? '';
    createForm.appointmentReferralId = record.appointmentReferralId ?? '';
    createForm.theatreProcedureId = record.theatreProcedureId ?? '';
    createForm.encounterAt = record.encounterAt
        ? formatDateTimeForInput(record.encounterAt)
        : defaultEncounterAtLocal();
    createForm.recordType = sanitizeMedicalRecordNoteType(record.recordType);
    createForm.diagnosisCode = record.diagnosisCode ?? '';
    createForm.subjective = record.subjective ?? '';
    createForm.objective = record.objective ?? '';
    createForm.assessment = record.assessment ?? '';
    createForm.plan = record.plan ?? '';
    createDraftRecord.value = record;
    createDraftLastSavedAt.value =
        record.updatedAt ?? record.createdAt ?? new Date().toISOString();
    createDraftExpectedUpdatedAt.value =
        record.updatedAt ?? record.createdAt ?? null;
    createDraftSavedSignature.value = buildCreateDraftServerSignature();
    createDraftSyncState.value = 'saved';
    createDraftSyncError.value = null;
    createDraftConflictRecord.value = null;
    createDraftRecoveryAvailable.value = false;
    createDraftRecovered.value = false;
    createComposerWorkspaceTab.value = 'note';
    createEncounterCareTab.value = '';
    createContextEditorOpen.value = createForm.patientId.trim() === '';
    createContextEditorTab.value = defaultCreateContextEditorTab();
    syncCreatePatientContextLock();
    resetCreateMessages();
}

function rememberCreateDraftRecordSaved(record: MedicalRecord) {
    createForm.encounterId = record.encounterId ?? createForm.encounterId;
    createDraftRecord.value = record;
    createDraftLastSavedAt.value =
        record.updatedAt ?? record.createdAt ?? new Date().toISOString();
    createDraftExpectedUpdatedAt.value =
        record.updatedAt ?? record.createdAt ?? null;
    createDraftSavedSignature.value = buildCreateDraftServerSignature();
    createDraftSyncState.value = 'saved';
    createDraftSyncError.value = null;
    createDraftConflictRecord.value = null;
    createDraftRecoveryAvailable.value = false;
    createDraftRecovered.value = false;
    publishCreateDraftSaved(record);
}

function medicalRecordFromDraftConflictPayload(
    payload?: ValidationErrorResponse,
): MedicalRecord | null {
    const currentRecord = payload?.context?.currentRecord;
    if (!currentRecord || typeof currentRecord !== 'object') {
        return null;
    }

    return currentRecord as MedicalRecord;
}

function publishCreateDraftSaved(record: MedicalRecord): void {
    if (typeof window === 'undefined') {
        return;
    }

    const channel = createDraftBroadcastChannel;
    if (!channel || !record.id) {
        return;
    }

    channel.postMessage({
        type: 'draft-saved',
        recordId: record.id,
        updatedAt: record.updatedAt ?? record.createdAt ?? null,
    });
}

function initializeCreateDraftBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') {
        return;
    }

    if (createDraftBroadcastChannel) {
        return;
    }

    createDraftBroadcastChannel = new BroadcastChannel(
        MEDICAL_RECORD_DRAFT_SYNC_CHANNEL,
    );
    createDraftBroadcastChannel.addEventListener(
        'message',
        handleCreateDraftBroadcastMessage,
    );
}

function teardownCreateDraftBroadcastChannel(): void {
    if (!createDraftBroadcastChannel) {
        return;
    }

    createDraftBroadcastChannel.removeEventListener(
        'message',
        handleCreateDraftBroadcastMessage,
    );
    createDraftBroadcastChannel.close();
    createDraftBroadcastChannel = null;
}

async function handleCreateDraftBroadcastMessage(event: MessageEvent): Promise<void> {
    const data = event.data as {
        type?: string;
        recordId?: string;
        updatedAt?: string | null;
    };

    if (data?.type !== 'draft-saved') {
        return;
    }

    if (!createDraftRecord.value || data.recordId !== createDraftRecord.value.id) {
        return;
    }

    if ((data.updatedAt ?? null) === createDraftExpectedUpdatedAt.value) {
        return;
    }

    if (createDraftSyncState.value === 'saving') {
        return;
    }

    const hasLocalEdits =
        buildCreateDraftServerSignature() !== createDraftSavedSignature.value;

    try {
        const response = await apiRequest<{ data: MedicalRecord }>(
            'GET',
            `/medical-records/${createDraftRecord.value.id}`,
        );

        if (hasLocalEdits) {
            createDraftConflictRecord.value = response.data;
            createDraftSyncState.value = 'conflict';
            createDraftSyncError.value =
                'This note was updated in another browser tab or window. Choose which version to keep.';
            return;
        }

        applyCreateDraftRecordToComposer(response.data);
    } catch {
        // Ignore background sync failures from other tabs.
    }
}

function clearCreateDraftConflictState(): void {
    createDraftConflictRecord.value = null;

    if (createDraftSyncState.value === 'conflict') {
        createDraftSyncState.value = createDraftRecord.value ? 'saved' : 'idle';
        createDraftSyncError.value = null;
    }
}

async function applyCreateDraftConflictServerVersion(): Promise<void> {
    const serverRecord =
        createDraftConflictRecord.value ?? createDraftRecord.value;
    if (!serverRecord) {
        return;
    }

    applyCreateDraftRecordToComposer(serverRecord);
    clearCreateDraftConflictState();
    notifySuccess('Loaded the latest chart copy of this draft.');
}

async function overwriteCreateDraftConflictWithLocalChanges(): Promise<void> {
    if (!createDraftRecord.value || createLoading.value) {
        return;
    }

    createDraftSyncState.value = 'saving';
    createDraftSyncError.value = null;

    const savedRecord = await syncCreateDraftToServer({
        intent: 'save',
        allowCreate: false,
        silent: false,
        forceDraftSave: true,
    });

    if (savedRecord) {
        clearCreateDraftConflictState();
        notifySuccess('Your version is now saved to the chart.');
    }
}

function dismissCreateDraftRecoveryBanner(): void {
    createDraftRecovered.value = false;
    createDraftRecoverySavedAt.value = null;
}

function clearCreateDraftServerState() {
    createDraftRecord.value = null;
    createDraftLastSavedAt.value = null;
    createDraftExpectedUpdatedAt.value = null;
    createDraftSavedSignature.value = null;
    createDraftSyncState.value = 'idle';
    createDraftSyncError.value = null;
    createDraftConflictRecord.value = null;
    createDraftHydratingExisting.value = false;
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
            form.encounterId.trim() ||
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

function shouldAutosaveCreateDraft(): boolean {
    if (isCreateComposerReadOnly.value) {
        return false;
    }

    if (!createForm.patientId.trim()) {
        return false;
    }

    if (
        createForm.appointmentId.trim() &&
        createIsConsultationNote.value
    ) {
        return true;
    }

    return hasClinicalCreateDraftPayload(
        buildMedicalRecordCreateDraftPayload(),
    );
}

async function ensureEncounterDraftOnServer(): Promise<void> {
    if (medicalRecordTab.value !== 'new') return;
    if (createLoading.value || createDraftHydratingExisting.value) return;
    if (createDraftRecord.value) return;
    if (!createForm.patientId.trim() || !createForm.appointmentId.trim()) {
        return;
    }
    if (!createIsConsultationNote.value || !canCreateMedicalRecords.value) {
        return;
    }

    await syncCreateDraftToServer({
        intent: 'autosave',
        allowCreate: true,
        silent: true,
    });
}

function clearMedicalRecordCreateDraftAutosaveTimer() {
    if (createDraftAutosaveTimer !== null) {
        window.clearTimeout(createDraftAutosaveTimer);
        createDraftAutosaveTimer = null;
    }
}

function clearMedicalRecordCreateDraftAutosaveMaxTimer() {
    if (createDraftAutosaveMaxTimer !== null) {
        window.clearTimeout(createDraftAutosaveMaxTimer);
        createDraftAutosaveMaxTimer = null;
    }
}

function clearMedicalRecordCreateDraftAutosaveTimers() {
    clearMedicalRecordCreateDraftAutosaveTimer();
    clearMedicalRecordCreateDraftAutosaveMaxTimer();
}

async function findExistingCreateEncounterDraft(): Promise<MedicalRecord | null> {
    const patientId = createForm.patientId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const authorUserId = currentUserId.value;

    if (!patientId || !appointmentId || !createIsConsultationNote.value) {
        return null;
    }

    const loadDrafts = (requestedAuthorUserId?: number) =>
        apiRequest<MedicalRecordListResponse>('GET', '/medical-records', {
            query: {
                patientId,
                appointmentId,
                authorUserId: requestedAuthorUserId,
                status: 'draft',
                recordType: createForm.recordType.trim(),
                page: 1,
                perPage: requestedAuthorUserId ? 1 : 10,
                sortBy: 'updatedAt',
                sortDir: 'desc',
            },
        });

    if (authorUserId !== null) {
        const authoredResponse = await loadDrafts(authorUserId);
        const authoredDraft = authoredResponse.data[0] ?? null;
        if (authoredDraft) return authoredDraft;
    }

    const legacyResponse = await loadDrafts();
    return (
        legacyResponse.data.find((record) => {
            if (record.authorUserId === null) return true;
            return authorUserId !== null && record.authorUserId === authorUserId;
        }) ?? null
    );
}

async function syncCreateDraftToServer(options?: {
    intent?: CreateSubmitIntent | 'autosave';
    allowCreate?: boolean;
    silent?: boolean;
    keepalive?: boolean;
    forceDraftSave?: boolean;
}): Promise<MedicalRecord | null> {
    const allowCreate = options?.allowCreate !== false;
    const body = buildMedicalRecordPersistenceBody(createForm, {
        forceDraftSave: options?.forceDraftSave === true,
    });

    if (!body.patientId) {
        return null;
    }

    createDraftSyncState.value = 'saving';
    createDraftSyncError.value = null;
    clearSensitiveLocalStorageKey(MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY);

    try {
        let response: { data: MedicalRecord };

        if (createDraftRecord.value) {
            response = await apiRequest<{ data: MedicalRecord }>(
                'PATCH',
                `/medical-records/${createDraftRecord.value.id}`,
                {
                    body,
                    keepalive: options?.keepalive === true,
                },
            );
        } else {
            if (!allowCreate) {
                return null;
            }

            try {
                response = await apiRequest<{ data: MedicalRecord }>(
                    'POST',
                    '/medical-records',
                    {
                        body,
                        keepalive: options?.keepalive === true,
                    },
                );
            } catch (error) {
                const apiError = error as ApiRequestError;

                if (
                    apiError.status === 422 &&
                    createForm.appointmentId.trim() &&
                    createIsConsultationNote.value
                ) {
                    const existingDraft = await findExistingCreateEncounterDraft();
                    if (existingDraft) {
                        createDraftRecord.value = existingDraft;

                        return await syncCreateDraftToServer({
                            ...options,
                            allowCreate: false,
                        });
                    }
                }

                throw error;
            }
        }

        rememberCreateDraftRecordSaved(response.data);
        clearMedicalRecordCreateDraftAutosaveMaxTimer();
        upsertRecordIntoList(response.data);
        if (response.data.encounterId) {
            createForm.encounterId = response.data.encounterId;
            void loadCreateEncounterSummary(response.data.encounterId);
        }
        return response.data;
    } catch (error) {
        const apiError = error as ApiRequestError;

        if (
            apiError.status === 409 &&
            apiError.payload?.code === 'MEDICAL_RECORD_DRAFT_CONFLICT'
        ) {
            const serverRecord = medicalRecordFromDraftConflictPayload(
                apiError.payload,
            );
            if (serverRecord) {
                createDraftConflictRecord.value = serverRecord;
            }

            createDraftSyncState.value = 'conflict';
            createDraftSyncError.value = messageFromUnknown(
                error,
                'This draft was updated elsewhere. Reload the chart copy or overwrite with your changes.',
            );

            if (!options?.silent) {
                throw error;
            }

            return null;
        }

        createDraftSyncState.value = 'error';
        createDraftSyncError.value = messageFromUnknown(
            error,
            'Unable to save this note to the chart right now.',
        );

        if (!options?.silent) {
            throw error;
        }

        return null;
    }
}

function scheduleMedicalRecordCreateDraftAutosave() {
    if (typeof window === 'undefined') return;

    clearMedicalRecordCreateDraftAutosaveTimer();
    clearSensitiveLocalStorageKey(MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY);

    if (
        medicalRecordTab.value !== 'new' ||
        createLoading.value ||
        createDraftHydratingExisting.value ||
        createDraftSyncState.value === 'conflict' ||
        !createForm.patientId.trim() ||
        !shouldAutosaveCreateDraft()
    ) {
        clearMedicalRecordCreateDraftAutosaveMaxTimer();
        return;
    }

    createDraftAutosaveTimer = window.setTimeout(() => {
        void syncCreateDraftToServer({
            intent: 'autosave',
            allowCreate: true,
            silent: true,
        });
        createDraftAutosaveTimer = null;
    }, 1500);

    if (createDraftAutosaveMaxTimer === null) {
        createDraftAutosaveMaxTimer = window.setTimeout(() => {
            createDraftAutosaveMaxTimer = null;
            clearMedicalRecordCreateDraftAutosaveTimer();
            void syncCreateDraftToServer({
                intent: 'autosave',
                allowCreate: true,
                silent: true,
            });
        }, 15000);
    }
}

async function flushCreateDraftAutosave(options?: {
    keepalive?: boolean;
}): Promise<void> {
    clearMedicalRecordCreateDraftAutosaveTimers();

    if (
        medicalRecordTab.value !== 'new' ||
        createLoading.value ||
        createDraftHydratingExisting.value ||
        createDraftSyncState.value === 'conflict' ||
        createDraftSyncState.value === 'saving' ||
        !createDraftHasPendingChanges.value ||
        !shouldAutosaveCreateDraft()
    ) {
        return;
    }

    await syncCreateDraftToServer({
        intent: 'autosave',
        allowCreate: true,
        silent: true,
        keepalive: options?.keepalive === true,
    });
}

function handleCreateDraftVisibilityChange() {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        return;
    }

    void flushCreateDraftAutosave({ keepalive: true });
}

function handleCreateDraftPageHide() {
    void flushCreateDraftAutosave({ keepalive: true });
}

function handleCreateDraftWindowBlur() {
    void flushCreateDraftAutosave();
}

function handleCreateDraftOnline() {
    createDraftOnline.value = true;

    if (createDraftHasPendingChanges.value) {
        void flushCreateDraftAutosave();
    }
}

function handleCreateDraftOffline() {
    createDraftOnline.value = false;
}

function resetMedicalRecordCreateComposerToInitialState() {
    createContextAutoLinkSuppressed.appointment = false;
    createContextAutoLinkSuppressed.admission = false;
    clearMedicalRecordCreateDraftAutosaveTimers();
    clearCreateDraftServerState();

    createForm.patientId = createContextEditorInitialSelection.patientId;
    createForm.encounterId = '';
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
        clearSensitiveLocalStorageKey(MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY);
    }
    clearMedicalRecordCreateDraftAutosaveTimers();
    createDraftRecoveryAvailable.value = false;
    createDraftRecovered.value = false;
    createDraftRecoverySavedAt.value = null;

    if (options?.resetComposer) {
        resetMedicalRecordCreateComposerToInitialState();
    }
}

function restoreStoredMedicalRecordCreateDraft() {
    if (createDraftRecord.value) {
        applyCreateDraftRecordToComposer(createDraftRecord.value);
    }
}

async function retryCreateDraftSave() {
    if (createLoading.value || createDraftHydratingExisting.value) {
        return;
    }

    if (!createForm.patientId.trim()) {
        notifyError('Select the patient context before retrying chart save.');
        return;
    }

    const savedRecord = await syncCreateDraftToServer({
        intent: 'save',
        allowCreate: true,
        silent: false,
    });

    if (savedRecord) {
        notifySuccess(
            `Saved ${savedRecord.recordNumber ?? 'medical record'} back to the chart.`,
        );
    }
}

async function initializeMedicalRecordCreateDraftRecovery() {
    clearSensitiveLocalStorageKey(MEDICAL_RECORD_CREATE_DRAFT_STORAGE_KEY);

    if (
        medicalRecordTab.value !== 'new' ||
        hasPersistableCreateDraft.value ||
        createDraftRecord.value ||
        !createForm.patientId.trim() ||
        !createForm.appointmentId.trim() ||
        !createIsConsultationNote.value
    ) {
        return;
    }

    const requestId = ++createDraftLoadRequestId;
    createDraftHydratingExisting.value = true;

    try {
        const existingDraft = await findExistingCreateEncounterDraft();
        if (
            requestId !== createDraftLoadRequestId ||
            !existingDraft
        ) {
            return;
        }

        applyCreateDraftRecordToComposer(existingDraft);
        createDraftRecovered.value = true;
        createDraftRecoverySavedAt.value =
            existingDraft.updatedAt ?? existingDraft.createdAt ?? null;
        showCreateSuccessFeedback(
            {
                tone: 'resumed',
                recordNumber: existingDraft.recordNumber ?? null,
                title: 'Draft restored',
                detail: `Continuing ${recordNumberLabel(existingDraft.recordNumber)} from the patient chart.`,
            },
            { autoDismissMs: 8000 },
        );
        if (existingDraft.encounterId) {
            await loadCreateEncounterSummary(existingDraft.encounterId);
        }
    } catch {
        createDraftHydratingExisting.value = false;
    } finally {
        if (requestId === createDraftLoadRequestId) {
            createDraftHydratingExisting.value = false;
        }

        if (requestId === createDraftLoadRequestId) {
            void ensureEncounterDraftOnServer();
        }
    }
}

async function loadCreateEncounterSummary(encounterId?: string): Promise<void> {
    const normalizedEncounterId = (encounterId ?? createForm.encounterId).trim();
    if (!normalizedEncounterId) {
        createEncounterSummary.value = null;
        return;
    }

    createEncounterSummaryLoading.value = true;

    try {
        const response = await apiRequest<{ data: EncounterSummary }>(
            'GET',
            `/encounters/${normalizedEncounterId}`,
        );
        createEncounterSummary.value = response.data;
    } catch {
        createEncounterSummary.value = null;
    } finally {
        createEncounterSummaryLoading.value = false;
    }
}

function applyEncounterWorkspaceBundle(bundle: EncounterWorkspaceBundle): void {
    createEncounterSummary.value = bundle.encounter;
    createForm.encounterId = bundle.encounter.id;

    if (bundle.appointment) {
        createForm.appointmentId = bundle.appointment.id;
        createAppointmentSummary.value = bundle.appointment;
        createAppointmentLinkSource.value = 'route';

        const linkedPatientId = bundle.appointment.patientId?.trim() ?? '';
        if (linkedPatientId !== '') {
            if (!createForm.patientId.trim()) {
                createForm.patientId = linkedPatientId;
            }
            void hydratePatientSummary(linkedPatientId);
        }
    } else if (bundle.encounter.patientId?.trim()) {
        if (!createForm.patientId.trim()) {
            createForm.patientId = bundle.encounter.patientId.trim();
        }
        void hydratePatientSummary(bundle.encounter.patientId.trim());
    }

    if (bundle.encounter.admissionId?.trim()) {
        createForm.admissionId = bundle.encounter.admissionId.trim();
    }

    syncCreatePatientContextLock();

    if (bundle.primaryMedicalRecord) {
        createDraftRecord.value = bundle.primaryMedicalRecord;
        applyCreateDraftRecordToComposer(bundle.primaryMedicalRecord);
    } else {
        createDraftRecord.value = null;
    }

    createEncounterLaboratoryOrders.value = bundle.laboratoryOrders ?? [];
    createEncounterPharmacyOrders.value = bundle.pharmacyOrders ?? [];
    createEncounterRadiologyOrders.value = bundle.radiologyOrders ?? [];
    createEncounterTheatreProcedures.value = bundle.theatreProcedures ?? [];
    createEncounterCloseReadiness.value = bundle.closeReadiness ?? null;
    createEncounterLaboratoryOrdersError.value = null;
    createEncounterPharmacyOrdersError.value = null;
    createEncounterRadiologyOrdersError.value = null;
    createEncounterTheatreProceduresError.value = null;
}

async function loadEncounterWorkspaceBundle(encounterId: string): Promise<void> {
    const normalizedEncounterId = encounterId.trim();
    if (!normalizedEncounterId) {
        return;
    }

    createEncounterSummaryLoading.value = true;
    createAppointmentSummaryLoading.value = true;

    try {
        const response = await apiRequest<{ data: EncounterWorkspaceBundle }>(
            'GET',
            `/encounters/${normalizedEncounterId}`,
            {
                query: {
                    view: 'workspace',
                },
            },
        );

        applyEncounterWorkspaceBundle(response.data);

        if (!response.data.primaryMedicalRecord) {
            await ensureEncounterDraftOnServer();
        }
    } catch (error) {
        createEncounterSummary.value = null;
        createAppointmentSummary.value = null;
        notifyError(
            messageFromUnknown(error, 'Unable to load this encounter workspace.'),
        );
    } finally {
        createEncounterSummaryLoading.value = false;
        createAppointmentSummaryLoading.value = false;
    }
}

async function refreshEncounterWorkspaceCareArtifacts(): Promise<void> {
    const encounterId = createForm.encounterId.trim();
    if (!encounterId || !isEncounterWorkspaceMode.value) {
        await refreshCreateEncounterCare();
        return;
    }

    try {
        const response = await apiRequest<{ data: EncounterWorkspaceBundle }>(
            'GET',
            `/encounters/${encounterId}`,
            {
                query: {
                    view: 'workspace',
                },
            },
        );

        createEncounterLaboratoryOrders.value = response.data.laboratoryOrders ?? [];
        createEncounterPharmacyOrders.value = response.data.pharmacyOrders ?? [];
        createEncounterRadiologyOrders.value = response.data.radiologyOrders ?? [];
        createEncounterTheatreProcedures.value = response.data.theatreProcedures ?? [];
        createEncounterCloseReadiness.value = response.data.closeReadiness ?? null;
    } catch (error) {
        createEncounterLaboratoryOrdersError.value = messageFromUnknown(
            error,
            'Unable to refresh linked encounter care artifacts.',
        );
    }
}

async function closeEncounterFromWorkspace(
    reason: string | null = null,
    acknowledgeCloseGaps = false,
): Promise<void> {
    const encounterId = createForm.encounterId.trim();
    if (!encounterId) {
        return;
    }

    const response = await apiRequest<{ data: EncounterSummary }>(
        'PATCH',
        `/encounters/${encounterId}/status`,
        {
            body: {
                status: 'closed',
                reason,
                acknowledgeCloseGaps,
            },
        },
    );
    createEncounterSummary.value = response.data;
    createEncounterCloseDialogOpen.value = false;
    createEncounterCloseReason.value = '';
    createEncounterCloseError.value = null;
}

function openEncounterCloseDialog(): void {
    createEncounterCloseReason.value = '';
    createEncounterCloseError.value = null;
    createEncounterCloseDialogOpen.value = true;
}

async function submitEncounterCloseDialog(): Promise<void> {
    if (createEncounterCloseSubmitting.value) {
        return;
    }

    createEncounterCloseSubmitting.value = true;
    createEncounterCloseError.value = null;

    try {
        const readiness = createEncounterCloseReadiness.value;
        const reason = readiness?.requiresAcknowledgement
            ? createEncounterCloseReason.value.trim()
            : null;

        await closeEncounterFromWorkspace(
            reason,
            Boolean(readiness?.requiresAcknowledgement),
        );

        if (
            createForm.appointmentId.trim() &&
            canManageAppointmentProviderSession.value
        ) {
            await completeAppointmentVisitFromMedicalRecord(
                createForm.appointmentId.trim(),
            );
        }

        notifySuccess('Encounter closed.');
        await refreshEncounterWorkspaceCareArtifacts();
    } catch (error) {
        createEncounterCloseError.value = messageFromUnknown(
            error,
            'Unable to close this encounter right now.',
        );
    } finally {
        createEncounterCloseSubmitting.value = false;
    }
}

function openCreateEncounterReopenDialog(): void {
    createEncounterReopenReason.value = '';
    createEncounterReopenError.value = null;
    createEncounterReopenDialogOpen.value = true;
}

function closeCreateEncounterReopenDialog(): void {
    createEncounterReopenDialogOpen.value = false;
    createEncounterReopenReason.value = '';
    createEncounterReopenError.value = null;
    createEncounterReopenSubmitting.value = false;
}

async function submitCreateEncounterReopen(): Promise<void> {
    const encounterId = createForm.encounterId.trim();
    const reason = createEncounterReopenReason.value.trim();

    if (!encounterId || createEncounterReopenSubmitting.value) {
        return;
    }

    if (!reason) {
        createEncounterReopenError.value = 'Reopen reason is required.';
        return;
    }

    createEncounterReopenSubmitting.value = true;
    createEncounterReopenError.value = null;

    try {
        const response = await apiRequest<{ data: EncounterSummary }>(
            'PATCH',
            `/encounters/${encounterId}/status`,
            {
                body: {
                    status: 'reopened',
                    reason,
                },
            },
        );
        createEncounterSummary.value = response.data;
        closeCreateEncounterReopenDialog();
        notifySuccess('Encounter reopened for correction.');
    } catch (error) {
        createEncounterReopenError.value = messageFromUnknown(
            error,
            'Unable to reopen this encounter.',
        );
    } finally {
        createEncounterReopenSubmitting.value = false;
    }
}

async function closeEncounterWorkspaceAction(): Promise<void> {
    if (!canCloseEncounter.value || createLoading.value) {
        return;
    }

    if (
        createEncounterCloseReadiness.value?.requiresAcknowledgement ||
        (createEncounterCloseReadiness.value?.blockingCount ?? 0) > 0
    ) {
        openEncounterCloseDialog();
        return;
    }

    createLoading.value = true;

    try {
        await closeEncounterFromWorkspace(null, false);

        if (
            createForm.appointmentId.trim() &&
            canManageAppointmentProviderSession.value
        ) {
            await completeAppointmentVisitFromMedicalRecord(
                createForm.appointmentId.trim(),
            );
        }

        notifySuccess('Encounter closed.');
        await refreshEncounterWorkspaceCareArtifacts();
    } catch (error) {
        notifyError(
            messageFromUnknown(error, 'Unable to close this encounter right now.'),
        );
    } finally {
        createLoading.value = false;
    }
}

function openCreateAmendDialog(): void {
    if (!createDraftRecord.value) {
        return;
    }

    openRecordStatusDialog(createDraftRecord.value, 'amended');
}

async function bootstrapEncounterWorkspace(): Promise<void> {
    if (encounterWorkspaceBootstrapInFlight) {
        await encounterWorkspaceBootstrapInFlight;
        return;
    }

    encounterWorkspaceBootstrapInFlight = bootstrapEncounterWorkspaceOnce();

    try {
        await encounterWorkspaceBootstrapInFlight;
    } finally {
        encounterWorkspaceBootstrapInFlight = null;
    }
}

async function bootstrapEncounterWorkspaceOnce(): Promise<void> {
    if (!isEncounterWorkspaceMode.value) {
        encounterWorkspaceBootstrapping.value = false;
        return;
    }

    encounterWorkspaceBootstrapping.value = true;

    const encounterId = props.encounterId.trim();
    const legacyAppointmentId =
        props.legacyAppointmentId.trim() ||
        initialCreateRouteContext.appointmentId.trim();
    const routePatientId = createForm.patientId.trim();
    const routeAppointmentId = createForm.appointmentId.trim();

    createForm.recordType = sanitizeMedicalRecordNoteType(
        createForm.recordType || 'consultation_note',
    );

    if (routePatientId) {
        void hydratePatientSummary(routePatientId);
    }

    if (routeAppointmentId && !createAppointmentSummary.value) {
        createAppointmentLinkSource.value = 'route';
        void loadCreateAppointmentSummary(routeAppointmentId);
    }

    if (encounterId) {
        try {
            await loadEncounterWorkspaceBundle(encounterId);
        } finally {
            encounterWorkspaceBootstrapping.value = false;
        }
        return;
    }

    if (!legacyAppointmentId) {
        encounterWorkspaceBootstrapping.value = false;
        return;
    }

    createForm.appointmentId = legacyAppointmentId;
    createAppointmentLinkSource.value = 'route';
    setCreateComposerBaseline({
        patientId: createForm.patientId.trim(),
        appointmentId: legacyAppointmentId,
        recordType: createForm.recordType,
    });

    createEncounterSummaryLoading.value = true;
    createAppointmentSummaryLoading.value = true;

    try {
        const response = await apiRequest<{ data: EncounterWorkspaceBundle }>(
            'GET',
            `/appointments/${legacyAppointmentId}/encounter`,
            {
                query: {
                    view: 'workspace',
                },
            },
        );

        applyEncounterWorkspaceBundle(response.data);

        if (!response.data.primaryMedicalRecord) {
            await ensureEncounterDraftOnServer();
        }

        replaceEncounterWorkspaceUrlWithoutVisit(
            encounterWorkspaceHref(response.data.encounter.id, {
                from: encounterWorkspaceReturnSource(),
                patientId: createForm.patientId.trim() || response.data.encounter.patientId,
                appointmentId: legacyAppointmentId,
            }),
        );
    } catch (error) {
        notifyError(
            messageFromUnknown(error, 'Unable to open this appointment encounter.'),
        );
    } finally {
        createEncounterSummaryLoading.value = false;
        createAppointmentSummaryLoading.value = false;
        encounterWorkspaceBootstrapping.value = false;
    }
}

async function encounterWorkspaceBack() {
    const targetUrl = encounterWorkspaceBackHref();

    if (
        !bypassMedicalRecordsNavigationGuard &&
        createDraftHasPendingChanges.value
    ) {
        try {
            await flushCreateDraftAutosave();
        } catch {
            // The confirmation dialog below explains the failed save state.
        }

        if (createDraftHasPendingChanges.value) {
            pendingMedicalRecordsVisit.value = { url: targetUrl };
            pendingMedicalRecordsWorkspaceClose.value = null;
            createLeaveConfirmOpen.value = true;
            return;
        }
    }

    visitWithoutMedicalRecordsLeaveGuard(targetUrl);
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

async function confirmMedicalRecordsNavigationLeave() {
    const visit = pendingMedicalRecordsVisit.value;
    const workspaceClose = pendingMedicalRecordsWorkspaceClose.value;
    createLeaveConfirmOpen.value = false;
    pendingMedicalRecordsVisit.value = null;
    pendingMedicalRecordsWorkspaceClose.value = null;

    if (
        shouldAutosaveCreateDraft() &&
        createDraftHasPendingChanges.value
    ) {
        try {
            await flushCreateDraftAutosave({ keepalive: true });
        } catch {
            // User chose to leave; proceed with navigation.
        }
    }

    if (visit) {
        visitWithoutMedicalRecordsLeaveGuard(visit.url, visit);
        return;
    }

    if (workspaceClose) {
        void encounterWorkspaceBack();
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

async function openMedicalRecordWorkspace(
    view: 'list' | 'new',
    options?: { focusSearch?: boolean },
) {
    if (
        view === 'list' &&
        medicalRecordTab.value === 'new' &&
        !bypassMedicalRecordsNavigationGuard &&
        createDraftHasPendingChanges.value
    ) {
        try {
            await flushCreateDraftAutosave();
        } catch {
            // The confirmation dialog below explains the failed save state.
        }

        if (createDraftHasPendingChanges.value) {
            pendingMedicalRecordsVisit.value = null;
            pendingMedicalRecordsWorkspaceClose.value = options ?? {};
            createLeaveConfirmOpen.value = true;
            return;
        }
    }

    finishMedicalRecordWorkspaceView(view, options);
}

function shouldUseEncounterWorkspaceForRecord(record: MedicalRecord): boolean {
    return Boolean(
        ((record.encounterId ?? '').trim() ||
            (record.appointmentId ?? '').trim()) &&
            sanitizeMedicalRecordNoteType(record.recordType) === 'consultation_note',
    );
}

function recordEncounterWorkspaceHref(record: MedicalRecord): string {
    return encounterWorkspaceHrefForRecord(record, {
        from: 'medical-records',
    });
}

function continueDraftMedicalRecord(record: MedicalRecord) {
    if (!canCreateMedicalRecords.value) {
        notifyError(
            'Consultation authoring requires medical record create access.',
        );
        return;
    }

    if (!isDraftRecord(record)) {
        notifyError('Only draft notes can be continued.');
        return;
    }

    if (shouldUseEncounterWorkspaceForRecord(record)) {
        router.visit(recordEncounterWorkspaceHref(record));
        return;
    }

    setCreateComposerBaseline({
        patientId: record.patientId ?? '',
        appointmentId: record.appointmentId ?? '',
        admissionId: record.admissionId ?? '',
        appointmentReferralId: record.appointmentReferralId ?? '',
        theatreProcedureId: record.theatreProcedureId ?? '',
        recordType: record.recordType ?? 'consultation_note',
    });
    applyCreateDraftRecordToComposer(record);
    openMedicalRecordWorkspace('new');
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

async function beginNewConsultationWorkspace(options?: {
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
        await nextTick();
        void initializeMedicalRecordCreateDraftRecovery();
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
        keepalive?: boolean;
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
        keepalive: options?.keepalive === true,
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
    encounterId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
}): Promise<LaboratoryOrder[]> {
    const patientId = filters.patientId?.trim() ?? '';
    const encounterId = filters.encounterId?.trim() ?? '';
    const appointmentId = filters.appointmentId?.trim() ?? '';
    const admissionId = filters.admissionId?.trim() ?? '';

    if (!patientId || (!encounterId && !appointmentId && !admissionId)) {
        return [];
    }

    const response = await apiRequest<LinkedContextListResponse<LaboratoryOrder>>(
        'GET',
        '/laboratory-orders',
        {
            query: {
                patientId,
                encounterId: encounterId || null,
                appointmentId: encounterId ? null : appointmentId || null,
                admissionId: encounterId ? null : admissionId || null,
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
    encounterId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
}): Promise<PharmacyOrder[]> {
    const patientId = filters.patientId?.trim() ?? '';
    const encounterId = filters.encounterId?.trim() ?? '';
    const appointmentId = filters.appointmentId?.trim() ?? '';
    const admissionId = filters.admissionId?.trim() ?? '';

    if (!patientId || (!encounterId && !appointmentId && !admissionId)) {
        return [];
    }

    const response = await apiRequest<LinkedContextListResponse<PharmacyOrder>>(
        'GET',
        '/pharmacy-orders',
        {
            query: {
                patientId,
                encounterId: encounterId || null,
                appointmentId: encounterId ? null : appointmentId || null,
                admissionId: encounterId ? null : admissionId || null,
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
    encounterId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
}): Promise<RadiologyOrder[]> {
    const patientId = filters.patientId?.trim() ?? '';
    const encounterId = filters.encounterId?.trim() ?? '';
    const appointmentId = filters.appointmentId?.trim() ?? '';
    const admissionId = filters.admissionId?.trim() ?? '';

    if (!patientId || (!encounterId && !appointmentId && !admissionId)) {
        return [];
    }

    const response = await apiRequest<LinkedContextListResponse<RadiologyOrder>>(
        'GET',
        '/radiology-orders',
        {
            query: {
                patientId,
                encounterId: encounterId || null,
                appointmentId: encounterId ? null : appointmentId || null,
                admissionId: encounterId ? null : admissionId || null,
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
    encounterId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
}): Promise<TheatreProcedure[]> {
    const patientId = filters.patientId?.trim() ?? '';
    const encounterId = filters.encounterId?.trim() ?? '';
    const appointmentId = filters.appointmentId?.trim() ?? '';
    const admissionId = filters.admissionId?.trim() ?? '';

    if (!patientId || (!encounterId && !appointmentId && !admissionId)) {
        return [];
    }

    const response = await apiRequest<LinkedContextListResponse<TheatreProcedure>>(
        'GET',
        '/theatre-procedures',
        {
            query: {
                patientId,
                encounterId: encounterId || null,
                appointmentId: encounterId ? null : appointmentId || null,
                admissionId: encounterId ? null : admissionId || null,
                sortBy: 'scheduledAt',
                sortDir: 'desc',
                perPage: 6,
            },
        },
    );

    return response.data ?? [];
}

function clearCreateSuccessFeedbackTimer(): void {
    if (createSuccessFeedbackTimer !== null) {
        window.clearTimeout(createSuccessFeedbackTimer);
        createSuccessFeedbackTimer = null;
    }
}

function dismissCreateSuccessFeedback(): void {
    clearCreateSuccessFeedbackTimer();
    createSuccessFeedback.value = null;
}

function showCreateSuccessFeedback(
    feedback: CreateSuccessFeedback,
    options?: { autoDismissMs?: number; toastMessage?: string | null },
): void {
    clearCreateSuccessFeedbackTimer();
    createSuccessFeedback.value = feedback;

    const toastMessage = options?.toastMessage;
    if (toastMessage) {
        notifySuccess(toastMessage);
    }

    const autoDismissMs = options?.autoDismissMs ?? 0;
    if (autoDismissMs > 0) {
        createSuccessFeedbackTimer = window.setTimeout(() => {
            createSuccessFeedback.value = null;
            createSuccessFeedbackTimer = null;
        }, autoDismissMs);
    }
}

function recordNumberLabel(recordNumber: string | null | undefined): string {
    const normalized = recordNumber?.trim() ?? '';
    return normalized !== '' ? normalized : 'Consultation note';
}

function resetCreateMessages() {
    dismissCreateSuccessFeedback();
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

async function refreshCreateEncounterCare(): Promise<void> {
    if (isEncounterWorkspaceMode.value && createForm.encounterId.trim()) {
        await refreshEncounterWorkspaceCareArtifacts();
        return;
    }

    await Promise.all([
        loadCreateEncounterLaboratoryOrders(),
        loadCreateEncounterPharmacyOrders(),
        loadCreateEncounterRadiologyOrders(),
        loadCreateEncounterTheatreProcedures(),
    ]);
}

function canUseEncounterInlineOrders(): boolean {
    return Boolean(
        createForm.patientId.trim() &&
            (createForm.encounterId.trim() ||
                createForm.appointmentId.trim() ||
                createForm.admissionId.trim()),
    );
}

function openEncounterInlineOrder(type: EncounterInlineOrderType): void {
    encounterInlineOrderType.value = type;

    if (isEncounterWorkspaceMode.value || createComposerWorkspaceTab.value !== 'workflow') {
        createComposerWorkspaceTab.value = 'workflow';
    }

    if (type === 'laboratory') {
        createEncounterCareTab.value = 'laboratory-orders';
    } else if (type === 'pharmacy') {
        createEncounterCareTab.value = 'pharmacy-orders';
    } else {
        createEncounterCareTab.value = 'radiology-orders';
    }
}

function closeEncounterInlineOrder(): void {
    encounterInlineOrderType.value = null;
}

async function handleEncounterInlineOrderCreated(
    type: EncounterInlineOrderType,
): Promise<void> {
    encounterInlineOrderType.value = null;
    await refreshCreateEncounterCare();

    if (type === 'laboratory') {
        createEncounterCareTab.value = 'laboratory-orders';
    } else if (type === 'pharmacy') {
        createEncounterCareTab.value = 'pharmacy-orders';
    } else {
        createEncounterCareTab.value = 'radiology-orders';
    }
}

const encounterInlineOrderContext = computed(() => ({
    patientId: createForm.patientId.trim(),
    encounterId: createForm.encounterId.trim() || undefined,
    appointmentId: createForm.appointmentId.trim() || undefined,
    admissionId: createForm.admissionId.trim() || undefined,
}));

let createEncounterLaboratoryOrdersRequestId = 0;
let createEncounterPharmacyOrdersRequestId = 0;
let createEncounterRadiologyOrdersRequestId = 0;
let createEncounterTheatreProceduresRequestId = 0;

async function loadCreateEncounterLaboratoryOrders() {
    if (isEncounterWorkspaceMode.value && createForm.encounterId.trim()) {
        return;
    }

    const patientId = createForm.patientId.trim();
    const encounterId = createForm.encounterId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (
        !canReadLaboratoryOrders.value
        || !patientId
        || (!encounterId && !appointmentId && !admissionId)
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
            encounterId,
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
    if (isEncounterWorkspaceMode.value && createForm.encounterId.trim()) {
        return;
    }

    const patientId = createForm.patientId.trim();
    const encounterId = createForm.encounterId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (
        !canReadPharmacyOrders.value
        || !patientId
        || (!encounterId && !appointmentId && !admissionId)
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
            encounterId,
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
    if (isEncounterWorkspaceMode.value && createForm.encounterId.trim()) {
        return;
    }

    const patientId = createForm.patientId.trim();
    const encounterId = createForm.encounterId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (
        !canReadRadiologyOrders.value
        || !patientId
        || (!encounterId && !appointmentId && !admissionId)
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
            encounterId,
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
    if (isEncounterWorkspaceMode.value && createForm.encounterId.trim()) {
        return;
    }

    const patientId = createForm.patientId.trim();
    const encounterId = createForm.encounterId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (
        !canReadTheatreProcedures.value
        || !patientId
        || (!encounterId && !appointmentId && !admissionId)
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
            encounterId,
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
        canUpdateMedicalRecords.value = names.has('medical.records.update');
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

    } catch {
        canReadMedicalRecords.value = false;
        canCreateMedicalRecords.value = false;
        canUpdateMedicalRecords.value = false;
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
        recordsLoaded.value = true;
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
        recordsLoaded.value = true;
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
    pageLoading.value = false;

    if (isEncounterWorkspaceMode.value) {
        recordsLoaded.value = true;

        if (!createForm.patientId.trim()) {
            await bootstrapEncounterWorkspace();
        }

        if (createForm.patientId.trim() && createForm.appointmentId.trim()) {
            await initializeMedicalRecordCreateDraftRecovery();
            await ensureEncounterDraftOnServer();

            if (createDraftHasPendingChanges.value) {
                await flushCreateDraftAutosave();
            }
        }

        return;
    }

    if (!canReadMedicalRecords.value) {
        records.value = [];
        pagination.value = null;
        medicalRecordStatusCounts.value = null;
        recordsLoaded.value = true;
        return;
    }

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

function openCreateFinalizeConfirmDialog() {
    if (createLoading.value) return;

    if (!canFinalizeCreateNote.value) {
        notifyError('Finalization is not available for this user.');
        return;
    }

    createFinalizeConfirmIntent.value = 'finalize';
    createFinalizeConfirmOpen.value = true;
}

function openCreateFinalizeAndCompleteConfirmDialog() {
    if (createLoading.value) return;

    if (!canFinalizeAndCompleteVisit.value) {
        notifyError(
            'Finalize and close visit is only available for an active outpatient consultation note.',
        );
        return;
    }

    createFinalizeConfirmIntent.value = 'finalize_complete';
    createFinalizeConfirmOpen.value = true;
}

function closeCreateFinalizeConfirmDialog() {
    if (
        createLoading.value &&
        (createSubmitIntent.value === 'finalize' ||
            createSubmitIntent.value === 'finalize_complete')
    ) {
        return;
    }

    createFinalizeConfirmOpen.value = false;
}

async function confirmCreateFinalizeAction() {
    const intent = createFinalizeConfirmIntent.value;
    createFinalizeConfirmOpen.value = false;
    await createRecord(intent);
}

async function createRecord(intent: CreateSubmitIntent = 'save') {
    if (createLoading.value) return;
    if (!canCreateMedicalRecords.value) {
        notifyError(
            'Consultation authoring requires medical record create access.',
        );
        return;
    }

    createSubmitIntent.value = intent;
    createLoading.value = true;
    if (intent === 'finalize' || intent === 'finalize_complete') {
        createFinalizeConfirmOpen.value = false;
    }
    resetCreateMessages();
    listErrors.value = [];
    clearMedicalRecordCreateDraftAutosaveTimers();

    try {
        const savedDraft = await syncCreateDraftToServer({
            intent,
            allowCreate: true,
            silent: false,
        });
        if (!savedDraft) {
            return;
        }

        const createdFromAppointmentHandoff =
            shouldKeepAppointmentReturnContext(savedDraft.appointmentId) ||
            createConsultationFromAppointments.value;
        let latestRecord = savedDraft;
        let noteFinalized = false;
        let visitCompleted = false;

        if (intent === 'save') {
            const recordLabel = recordNumberLabel(latestRecord.recordNumber);
            actionMessage.value = `${recordLabel} saved to chart.`;
            showCreateSuccessFeedback(
                {
                    tone: 'saved',
                    recordNumber: latestRecord.recordNumber ?? null,
                    title: 'Note saved',
                    detail: 'You can keep charting or finalize when ready.',
                },
                { autoDismissMs: 6000 },
            );

            if (canReadMedicalRecords.value) {
                upsertRecordIntoList(latestRecord);
                void loadRecordStatusCounts();
            }

            return;
        }

        if (intent === 'finalize' || intent === 'finalize_complete') {
            const finalizedRecord = await updateRecordStatus(
                latestRecord,
                'finalized',
                null,
                { silentSuccess: true },
            );

            if (!finalizedRecord) {
                const recordLabel = recordNumberLabel(latestRecord.recordNumber);
                const detail =
                    intent === 'finalize_complete'
                        ? `${recordLabel} was saved, but the note still needs to be finalized before the visit can close.`
                        : `${recordLabel} was saved. Review the note and try finalizing again.`;
                actionMessage.value = detail;
                showCreateSuccessFeedback(
                    {
                        tone: 'partial',
                        recordNumber: latestRecord.recordNumber ?? null,
                        title: 'Draft saved — finalize still needed',
                        detail,
                    },
                    {
                        toastMessage: detail,
                    },
                );
                return;
            }

            latestRecord = finalizedRecord;
            noteFinalized = true;
        }

        if (intent === 'finalize_complete') {
            if (createForm.encounterId.trim()) {
                await refreshEncounterWorkspaceCareArtifacts();

                const readiness = createEncounterCloseReadiness.value;
                if (
                    readiness &&
                    ((readiness.blockingCount ?? 0) > 0 ||
                        readiness.requiresAcknowledgement)
                ) {
                    openEncounterCloseDialog();
                    const checklistMessage =
                        'Review the close checklist to finish the visit.';
                    actionMessage.value = checklistMessage;
                    showCreateSuccessFeedback(
                        {
                            tone: 'checklist',
                            recordNumber: latestRecord.recordNumber ?? null,
                            title: 'Note finalized',
                            detail: checklistMessage,
                        },
                        {
                            toastMessage: `Note finalized. ${checklistMessage}`,
                        },
                    );
                    return;
                }

                try {
                    await closeEncounterFromWorkspace(null, false);
                    visitCompleted = true;
                } catch (error) {
                    notifyError(
                        messageFromUnknown(
                            error,
                            'Consultation note was finalized, but the encounter could not be closed.',
                        ),
                    );
                }
            }

            if (
                latestRecord.appointmentId &&
                canManageAppointmentProviderSession.value
            ) {
                try {
                    await completeAppointmentVisitFromMedicalRecord(
                        latestRecord.appointmentId,
                    );
                    visitCompleted = true;
                } catch (error) {
                    notifyError(
                        messageFromUnknown(
                            error,
                            'Consultation note was finalized, but the visit could not be completed. Return to Appointments to finish close-out.',
                        ),
                    );
                }
            }
        }

        const recordLabel = recordNumberLabel(latestRecord.recordNumber);
        const successFeedback: CreateSuccessFeedback = visitCompleted
            ? {
                  tone: 'completed',
                  recordNumber: latestRecord.recordNumber ?? null,
                  title: 'Visit completed',
                  detail: `${recordLabel} is finalized and the encounter is closed.`,
              }
            : noteFinalized
              ? {
                    tone: 'finalized',
                    recordNumber: latestRecord.recordNumber ?? null,
                    title: 'Note finalized',
                    detail: `${recordLabel} is signed and locked for editing.`,
                }
              : {
                    tone: 'saved',
                    recordNumber: latestRecord.recordNumber ?? null,
                    title: 'Note saved',
                    detail: 'You can keep charting or finalize when ready.',
                };
        actionMessage.value = successFeedback.detail;
        showCreateSuccessFeedback(successFeedback, {
            autoDismissMs: successFeedback.tone === 'saved' ? 6000 : 0,
            toastMessage:
                successFeedback.tone === 'saved'
                    ? null
                    : `${successFeedback.title}. ${successFeedback.detail ?? ''}`.trim(),
        });

        const savedPatientId =
            latestRecord.patientId ?? createForm.patientId.trim();

        const shouldReturnToAppointmentsAfterSave =
            intent === 'return' &&
            canReturnToAppointments.value &&
            Boolean(latestRecord.appointmentId);

        if (shouldReturnToAppointmentsAfterSave && latestRecord.appointmentId) {
            createLeaveConfirmOpen.value = false;
            pendingMedicalRecordsVisit.value = null;
            pendingMedicalRecordsWorkspaceClose.value = null;
            visitWithoutMedicalRecordsLeaveGuard(
                appointmentReturnHref(
                    latestRecord.appointmentId,
                    createAppointmentSummary.value?.status ?? null,
                ),
            );
            return;
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
    options: { silentSuccess?: boolean } = {},
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

        if (!options.silentSuccess) {
            actionMessage.value = `Updated ${response.data.recordNumber ?? 'medical record'} to ${status}.`;
            if (actionMessage.value) notifySuccess(actionMessage.value);
        }

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

        if (createDraftRecord.value?.id === latestRecord.id) {
            applyCreateDraftRecordToComposer(latestRecord);
            if (latestRecord.encounterId) {
                void loadCreateEncounterSummary(latestRecord.encounterId);
            }
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
        return `Provide an amendment reason for ${label}. The note will reopen as a draft so you can correct it, then finalize the amendment when ready.`;
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

function patientInitials(summary: PatientSummary): string {
    const first = summary.firstName?.trim()?.[0] ?? '';
    const last = summary.lastName?.trim()?.[0] ?? '';
    const initials = `${first}${last}`.trim();

    if (initials) {
        return initials.toUpperCase();
    }

    const patientNumber = summary.patientNumber?.trim();
    if (patientNumber) {
        return patientNumber.slice(0, 2).toUpperCase();
    }

    return 'PT';
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
    const encounterId = record?.encounterId?.trim() ?? '';
    const appointmentId = record?.appointmentId?.trim() ?? '';
    const admissionId = record?.admissionId?.trim() ?? '';

    if (
        !canReadLaboratoryOrders.value
        || !patientId
        || (!encounterId && !appointmentId && !admissionId)
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
            encounterId,
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
    const encounterId = record?.encounterId?.trim() ?? '';
    const appointmentId = record?.appointmentId?.trim() ?? '';
    const admissionId = record?.admissionId?.trim() ?? '';

    if (
        !canReadPharmacyOrders.value
        || !patientId
        || (!encounterId && !appointmentId && !admissionId)
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
            encounterId,
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
    const encounterId = record?.encounterId?.trim() ?? '';
    const appointmentId = record?.appointmentId?.trim() ?? '';
    const admissionId = record?.admissionId?.trim() ?? '';

    if (
        !canReadRadiologyOrders.value
        || !patientId
        || (!encounterId && !appointmentId && !admissionId)
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
            encounterId,
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
    const encounterId = record?.encounterId?.trim() ?? '';
    const appointmentId = record?.appointmentId?.trim() ?? '';
    const admissionId = record?.admissionId?.trim() ?? '';

    if (
        !canReadTheatreProcedures.value
        || !patientId
        || (!encounterId && !appointmentId && !admissionId)
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
            encounterId,
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

const isInitialRecordsLoading = computed(
    () => listLoading.value && !recordsLoaded.value,
);

const recordsStreamStateLabel = computed(() => {
    if (pageLoading.value) return 'Checking access';
    if (isInitialRecordsLoading.value) return 'Loading records';
    if (listLoading.value) return 'Refreshing';
    if (!recordsLoaded.value) return 'Ready';
    if (records.value.length === 0) return '0 records';
    return `${pagination.value?.total ?? records.value.length} records`;
});

const emptyRecordsTitle = computed(() =>
    hasActiveRecordFilters.value ? 'No records match this view' : 'No clinical records yet',
);

const emptyRecordsDescription = computed(() => {
    if (searchForm.patientId.trim()) {
        return 'This patient does not have clinical notes for the current filters.';
    }

    if (hasActiveRecordFilters.value) {
        return 'Try adjusting the search, status, record type, patient, or encounter date filters.';
    }

    return 'Clinical notes created from consultations will appear here as the records stream.';
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
    if (createPatientSummary.value) {
        return patientName(createPatientSummary.value);
    }

    const patientId = createForm.patientId.trim();
    if (!patientId) {
        return 'Patient not selected';
    }

    if (createEncounterSummaryLoading.value || createAppointmentSummaryLoading.value) {
        return 'Loading patient…';
    }

    return 'Selected patient';
});

const createPatientContextMeta = computed(() => {
    const summary = createPatientSummary.value;
    if (summary) {
        const patientNumber = summary.patientNumber?.trim();
        return patientNumber
            ? `Patient No. ${patientNumber}`
            : 'Patient record selected';
    }

    const contextParts = [
        createAppointmentSummary.value?.appointmentNumber?.trim()
            ? `Appointment ${createAppointmentSummary.value.appointmentNumber.trim()}`
            : null,
        createEncounterSummary.value?.encounterNumber?.trim()
            ? `Encounter ${createEncounterSummary.value.encounterNumber.trim()}`
            : null,
    ].filter(Boolean);

    if (contextParts.length > 0) {
        return contextParts.join(' · ');
    }

    const patientId = createForm.patientId.trim();
    if (patientId) {
        return createEncounterSummaryLoading.value || createAppointmentSummaryLoading.value
            ? 'Resolving visit context…'
            : 'Patient context pending';
    }

    return 'Search and select the patient for this clinical note.';
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
const createIsConsultationNote = computed(
    () => normalizeRecordType(createForm.recordType) === 'consultation_note',
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
const canFinalizeCreateNote = computed(
    () =>
        canCreateMedicalRecords.value &&
        canFinalizeMedicalRecords.value &&
        isDraftRecord(createDraftRecord.value),
);
const canFinalizeAndCompleteVisit = computed(
    () =>
        canCreateMedicalRecords.value &&
        canFinalizeMedicalRecords.value &&
        canManageAppointmentProviderSession.value &&
        hasCreateAppointmentContext.value &&
        createAppointmentIsInConsultation.value &&
        createIsConsultationNote.value &&
        createEncounterSummary.value?.status !== 'closed',
);
const canCloseEncounter = computed(
    () =>
        canFinalizeMedicalRecords.value &&
        Boolean(createForm.encounterId.trim()) &&
        createEncounterSummary.value?.status !== 'closed' &&
        (createDraftRecord.value?.status === 'finalized' ||
            createDraftRecord.value?.status === 'amended'),
);
const canReopenEncounter = computed(
    () =>
        canAmendMedicalRecords.value &&
        createEncounterSummary.value?.status === 'closed',
);
const encounterWorkspaceBillingHref = computed(() =>
    contextCreateHref('/billing-invoices', { includeTabNew: true }),
);
const encounterWorkspacePrintHref = computed(() => {
    const encounterId = createForm.encounterId.trim();
    return encounterId ? `/encounters/${encounterId}/print` : '#';
});
const encounterWorkspacePdfHref = computed(() => {
    const encounterId = createForm.encounterId.trim();
    return encounterId ? `/encounters/${encounterId}/pdf` : '#';
});
const encounterWorkspaceChartPacketReady = computed(() => {
    const status = (createDraftRecord.value?.status ?? '').toLowerCase();
    return status === 'finalized' || status === 'amended';
});
const canAmendEncounterNote = computed(
    () =>
        canAmendMedicalRecords.value &&
        createDraftRecord.value?.status === 'finalized',
);
const isCreateAmendmentDraft = computed(
    () =>
        isDraftRecord(createDraftRecord.value) &&
        Boolean(createDraftRecord.value?.signedAt),
);
const isCreateComposerReadOnly = computed(() => {
    const status = (createDraftRecord.value?.status ?? '').toLowerCase();

    return status === 'finalized' || status === 'amended';
});
const createEncounterStatusLabel = computed(() => {
    const status = (createEncounterSummary.value?.status ?? '').toLowerCase();

    switch (status) {
        case 'opened':
            return 'Encounter opened';
        case 'in_progress':
            return 'Encounter in progress';
        case 'ready_for_sign':
            return 'Ready for sign';
        case 'signed':
            return 'Encounter signed';
        case 'amended':
            return 'Encounter amended';
        case 'closed':
            return 'Encounter closed';
        case 'cancelled':
            return 'Encounter cancelled';
        default:
            return null;
    }
});
const encounterWorkspaceVisitStatusLabel = computed(() => {
    const labels = [
        createAppointmentContextStatusLabel.value,
        createEncounterStatusLabel.value,
    ].filter(Boolean);

    return labels.length > 0 ? labels.join(' · ') : null;
});
const showCreateProviderSessionCard = computed(
    () =>
        canUseMedicalRecordComposer.value &&
        hasCreateAppointmentContext.value &&
        (canReturnToAppointments.value ||
            canStartCreateConsultationSession.value ||
            canTakeOverCreateConsultationSession.value ||
            canFinalizeAndCompleteVisit.value),
);
const createProviderSessionSummary = computed(() => {
    if (createAppointmentIsProviderReady.value) {
        return 'Nursing handoff is complete. Start the consultation session when the provider begins the encounter so charting and visit state stay aligned.';
    }

    if (createAppointmentConsultationOwnedByAnotherClinician.value) {
        return `This visit is currently owned by ${createConsultationOwnerDisplay()}. Confirm takeover before continuing documentation.`;
    }

    if (createAppointmentIsInConsultation.value) {
        return 'This visit is already in an active provider session. Save the note while documentation is still in progress, then finalize it when the encounter is ready for close-out.';
    }

    return 'Return to the appointment workflow whenever you need queue visibility or operational controls for this visit.';
});
const createFooterWorkflowHint = computed(() => {
    const completed = createComposerCompletedSectionCount.value;
    const total = createComposerSectionItems.value.length;

    if (completed >= total) {
        return null;
    }

    return `${completed}/${total} sections ready`;
});

function createConsultationOwnerDisplay(): string {
    const ownerUserId = createAppointmentConsultationOwnerUserId.value;
    if (ownerUserId === null) {
        return 'another clinician';
    }

    return `clinician #${ownerUserId}`;
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
const createEncounterCareCountLabel = computed(() => {
    const total = createEncounterCareTotalCount.value;
    return `${total} ${total === 1 ? 'linked item' : 'linked items'}`;
});
const createEncounterCareHeaderContext = computed(() =>
    [
        createEncounterSourceLabel.value,
        createAppointmentContextStatusLabel.value,
        createAdmissionContextStatusLabel.value,
    ]
        .filter(Boolean)
        .join(' · '),
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

const createMedicalRecordWorkflowContextLabel = computed(() => {
    if (createForm.appointmentReferralId.trim() || createForm.theatreProcedureId.trim()) {
        return createEncounterSourceLabel.value;
    }

    if (hasCreateAppointmentContext.value) return createAppointmentContextLabel.value;
    if (hasCreateAdmissionContext.value) return createAdmissionContextLabel.value;

    return createEncounterSourceLabel.value;
});

const createMedicalRecordWorkflowContextMeta = computed(() => {
    if (hasCreateAppointmentContext.value) {
        return [createAppointmentContextMeta.value, createAppointmentContextReason.value]
            .filter(Boolean)
            .join(' | ');
    }

    if (hasCreateAdmissionContext.value) {
        return [createAdmissionContextMeta.value, createAdmissionContextReason.value]
            .filter(Boolean)
            .join(' | ');
    }

    return createEncounterSourceSummary.value;
});

const createMedicalRecordContextStatusLabel = computed(() => {
    if (createAppointmentContextStatusLabel.value) return createAppointmentContextStatusLabel.value;
    if (createAdmissionContextStatusLabel.value) return createAdmissionContextStatusLabel.value;
    if (createPatientContextLocked.value) return 'Locked';
    return createForm.patientId.trim() ? 'Patient selected' : 'Context needed';
});

const createMedicalRecordContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    if (createAppointmentContextStatusLabel.value) return createAppointmentContextStatusVariant.value;
    if (createAdmissionContextStatusLabel.value) return createAdmissionContextStatusVariant.value;
    return createForm.patientId.trim() ? 'outline' : 'secondary';
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
        id: 'mr-create-diagnosis-section',
        label: 'Diagnosis / ICD-10',
        complete:
            Boolean(createForm.diagnosisCode.trim()) ||
            Boolean(createForm.assessment.trim()),
    },
    {
        id: 'mr-create-plan-section',
        label: createPlanLabel.value,
        complete: Boolean(createForm.plan.trim()),
    },
]);
const createComposerCompletedSectionCount = computed(
    () =>
        createComposerSectionItems.value.filter((section) => section.complete)
            .length,
);
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

const createSuccessFeedbackIcon = computed(() => {
    switch (createSuccessFeedback.value?.tone) {
        case 'finalized':
        case 'completed':
            return 'shield-check';
        case 'resumed':
            return 'history';
        case 'checklist':
            return 'clipboard-list';
        case 'partial':
            return 'alert-circle';
        case 'saved':
        default:
            return 'check-circle';
    }
});

const createSuccessFeedbackToneClass = computed(() => {
    switch (createSuccessFeedback.value?.tone) {
        case 'partial':
            return 'border-amber-500/25 bg-amber-50/90 text-amber-950 ring-amber-500/15 dark:border-amber-800/50 dark:bg-amber-950/25 dark:text-amber-100 dark:ring-amber-900/40';
        case 'finalized':
        case 'completed':
            return 'border-primary/20 bg-primary/5 text-foreground ring-primary/10 dark:border-primary/30 dark:bg-primary/10';
        case 'resumed':
        case 'checklist':
            return 'border-sky-500/25 bg-sky-50/90 text-sky-950 ring-sky-500/15 dark:border-sky-800/50 dark:bg-sky-950/25 dark:text-sky-100 dark:ring-sky-900/40';
        case 'saved':
        default:
            return 'border-emerald-500/25 bg-emerald-50/90 text-emerald-950 ring-emerald-500/15 dark:border-emerald-800/50 dark:bg-emerald-950/25 dark:text-emerald-100 dark:ring-emerald-900/40';
    }
});

const createSuccessFeedbackIconClass = computed(() => {
    switch (createSuccessFeedback.value?.tone) {
        case 'partial':
            return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
        case 'finalized':
        case 'completed':
            return 'bg-primary/15 text-primary';
        case 'resumed':
        case 'checklist':
            return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
        case 'saved':
        default:
            return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    }
});


const hasUnsavedCreateClinicalContent = computed(() =>
    hasClinicalCreateDraftPayload(buildMedicalRecordCreateDraftPayload()),
);

const hasPersistableCreateDraft = computed(() =>
    hasPersistableCreateDraftPayload(buildMedicalRecordCreateDraftPayload()),
);
const createDraftNoteTypeLabel = computed(() =>
    createRecordTypeLabel.value.toLowerCase(),
);
const createDraftHasPendingChanges = computed(() => {
    if (createDraftSyncState.value === 'conflict') {
        return true;
    }

    if (createDraftSyncState.value === 'saving' || createDraftSyncState.value === 'error') {
        return hasPersistableCreateDraft.value || Boolean(createDraftRecord.value);
    }

    if (!hasPersistableCreateDraft.value && !createDraftRecord.value) {
        return false;
    }

    return buildCreateDraftServerSignature() !== createDraftSavedSignature.value;
});
const createDraftBannerVisible = computed(() =>
    createDraftHydratingExisting.value ||
    hasPersistableCreateDraft.value ||
    Boolean(createDraftRecord.value) ||
    createDraftSyncState.value === 'error' ||
    createDraftSyncState.value === 'conflict',
);
const createDraftFailureAlertVisible = computed(() =>
    createDraftSyncState.value === 'error' && Boolean(createDraftSyncError.value),
);
const createDraftConflictAlertVisible = computed(() =>
    createDraftSyncState.value === 'conflict' && Boolean(createDraftSyncError.value),
);
const createDraftRecoveryBannerVisible = computed(
    () => createDraftRecovered.value && Boolean(createDraftRecoverySavedAt.value),
);
const createDraftRecoveryBannerLabel = computed(() =>
    createDraftRecoverySavedAt.value
        ? `Recovered draft saved at ${formatDateTime(createDraftRecoverySavedAt.value)}`
        : 'Recovered draft from chart',
);
const createDraftLastSavedLabel = computed(() =>
    createDraftLastSavedAt.value
        ? formatDateTime(createDraftLastSavedAt.value)
        : null,
);
const createDraftIndicatorDetail = computed(() => {
    if (createDraftHydratingExisting.value) {
        return 'Opening saved encounter draft';
    }

    if (!createDraftOnline.value) {
        return createDraftHasPendingChanges.value
            ? 'Changes will retry when connection returns'
            : 'Connection unavailable';
    }

    if (createDraftSyncState.value === 'saving') {
        return createDraftLastSavedLabel.value
            ? `Last saved ${createDraftLastSavedLabel.value}`
            : 'Saving latest chart changes';
    }

    if (createDraftSyncState.value === 'error') {
        return 'Retry with Save note';
    }

    if (createDraftSyncState.value === 'conflict') {
        return 'Choose chart copy or your changes';
    }

    if (createDraftRecord.value && createDraftLastSavedLabel.value) {
        return `Last saved ${createDraftLastSavedLabel.value}`;
    }

    if (createDraftHasPendingChanges.value) {
        return createDraftLastSavedLabel.value
            ? `Pending since ${createDraftLastSavedLabel.value}`
            : 'Autosave queued';
    }

    if (!createDraftRecord.value && hasPersistableCreateDraft.value) {
        return 'First chart save pending';
    }

    return null;
});
const createDraftFailureDetail = computed(() => {
    if (!createDraftFailureAlertVisible.value) {
        return null;
    }

    if (createDraftRecord.value && createDraftLastSavedLabel.value) {
        return `You can keep charting. The last chart copy was saved at ${createDraftLastSavedLabel.value}. Retry save when ready.`;
    }

    if (createDraftRecord.value) {
        return 'You can keep charting. Retry save to push the latest note changes back to the chart.';
    }

    return 'You can keep charting, but this note is not safely in the chart yet. Retry save before leaving the page.';
});
const createLeaveConfirmDescription = computed(() => {
    if (createDraftRecord.value) {
        return createDraftLastSavedLabel.value
            ? `This note has changes that are newer than the chart copy saved at ${createDraftLastSavedLabel.value}.`
            : 'This note has changes that are newer than the last chart save.';
    }

    return 'This note has not been saved to the chart yet.';
});
const createLeaveConfirmBody = computed(() => {
    if (createDraftRecord.value) {
        return createDraftLastSavedLabel.value
            ? `Stay here to keep charting, or leave now and keep only the chart copy saved at ${createDraftLastSavedLabel.value}. The latest unsaved changes on this screen will be discarded.`
            : 'Stay here to keep charting, or leave now and keep only the last chart copy. The latest unsaved changes on this screen will be discarded.';
    }

    return 'Stay here to keep charting, or leave now and discard this unsaved note.';
});

const createDraftIndicatorLabel = computed(() => {
    if (createDraftHydratingExisting.value) {
        return 'Loading draft';
    }

    if (!createDraftOnline.value) {
        return createDraftHasPendingChanges.value
            ? 'Offline changes pending'
            : 'Offline';
    }

    if (createDraftSyncState.value === 'saving') {
        return 'Saving to chart';
    }

    if (createDraftSyncState.value === 'error') {
        return 'Save needs attention';
    }

    if (createDraftSyncState.value === 'conflict') {
        return 'Draft conflict';
    }

    if (createDraftRecord.value && !createDraftHasPendingChanges.value) {
        return 'Saved to chart';
    }

    if (!hasPersistableCreateDraft.value && !createDraftRecord.value) {
        return null;
    }

    return createDraftHasPendingChanges.value
        ? 'Unsaved changes'
        : 'Not saved to chart';
});
const encounterWorkspaceNoteStatusLabel = computed(() => {
    if (createDraftRecord.value?.status === 'finalized') {
        return 'Finalized';
    }

    if (createDraftRecord.value?.status === 'amended') {
        return 'Amended';
    }

    if (isCreateAmendmentDraft.value) {
        return 'Amendment draft';
    }

    if (createDraftRecord.value) {
        return 'Draft';
    }

    return 'Not started';
});
const encounterWorkspaceNoteStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    if (
        createDraftRecord.value?.status === 'finalized' ||
        createDraftRecord.value?.status === 'amended'
    ) {
        return 'default';
    }

    if (isCreateAmendmentDraft.value) {
        return 'secondary';
    }

    if (createDraftRecord.value) {
        return 'secondary';
    }

    return 'outline';
});

const encounterWorkspaceHeaderLoading = computed(
    () => {
        if (encounterWorkspaceBootstrapping.value) {
            return true;
        }

        if (createPatientSummary.value) {
            return false;
        }

        return (
            createAppointmentSummaryLoading.value ||
            createEncounterSummaryLoading.value
        );
    },
);

const encounterWorkspaceBootstrapSkeleton = computed(
    () => encounterWorkspaceBootstrapping.value,
);

function replaceEncounterWorkspaceUrlWithoutVisit(url: string): void {
    if (typeof window === 'undefined') return;

    const nextUrl = url.trim();
    if (!nextUrl || nextUrl === window.location.href || nextUrl === window.location.pathname) {
        return;
    }

    const historyState = window.history.state;
    const nextState =
        historyState && typeof historyState === 'object'
            ? {
                  ...historyState,
                  page:
                      historyState.page && typeof historyState.page === 'object'
                          ? {
                                ...historyState.page,
                                url: nextUrl,
                            }
                          : historyState.page,
              }
            : historyState;

    window.history.replaceState(nextState, '', nextUrl);
}

const encounterWorkspaceHasPatient = computed(
    () => createForm.patientId.trim() !== '',
);

const encounterWorkspacePageTitle = computed(() => {
    if (createPatientSummary.value) {
        return patientName(createPatientSummary.value);
    }

    return 'Encounter workspace';
});

const encounterWorkspaceMetaSeparator = ' \u00B7 ';
const encounterWorkspacePaneFocusStorageKey = 'encounterWorkspace.paneFocus.v3';
const workspacePaneFocus = ref<EncounterWorkspacePaneFocus>('note');
const encounterAttachmentsOpen = ref(true);
const encounterGovernanceOpen = ref(false);

function sanitizeEncounterWorkspacePaneFocus(
    value: string | null,
): EncounterWorkspacePaneFocus {
    if (value === 'both' || value === 'note' || value === 'care') return value;
    return 'note';
}

function isEditableEventTarget(target: EventTarget | null): boolean {
    const element = target instanceof HTMLElement ? target : null;
    if (!element) return false;
    if (element.isContentEditable) return true;
    const tag = element.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    return Boolean(element.closest('[contenteditable="true"]'));
}

function handleEncounterWorkspaceGlobalKeydown(event: KeyboardEvent): void {
    if (!isEncounterWorkspaceMode.value) return;
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.defaultPrevented) return;
    if (isEditableEventTarget(event.target)) return;

    if (event.key === '1') {
        workspacePaneFocus.value = 'note';
        event.preventDefault();
        return;
    }

    if (event.key === '2') {
        if (!canShowCreateWorkflowWorkspace.value) return;
        workspacePaneFocus.value = 'care';
        event.preventDefault();
        return;
    }

    if (event.key === '3') {
        workspacePaneFocus.value = 'both';
        event.preventDefault();
    }
}

const encounterWorkspaceIntroText = computed(() => {
    if (!encounterWorkspaceHasPatient.value) {
        return 'Open from Appointments or Medical records to chart this encounter with orders and billing in one place.';
    }

    return 'Chart, orders, and billing for this encounter\u2014visit status and draft sync stay visible while you work.';
});

const encounterWorkspaceOwnerLabel = computed(() => {
    if (!hasCreateAppointmentContext.value) {
        return null;
    }

    return createAppointmentConsultationOwnerUserId.value
        ? `Owner: ${createConsultationOwnerDisplay()}`
        : 'Owner: Not assigned';
});

const encounterWorkspaceContextMeta = computed(() => {
    if (hasCreateAppointmentContext.value) {
        return [createAppointmentContextMeta.value, encounterWorkspaceOwnerLabel.value]
            .filter(Boolean)
            .join(encounterWorkspaceMetaSeparator);
    }

    if (createEncounterStatusLabel.value) {
        return createEncounterStatusLabel.value;
    }

    return 'Link a visit or encounter to keep downstream actions aligned.';
});

const encounterWorkspaceBackLabel = computed(() =>
    openedFromAppointments ? 'Appointments' : 'Medical records',
);

const encounterWorkspaceBackIcon = computed(() =>
    openedFromAppointments ? 'calendar-clock' : 'file-text',
);

const createPatientChartHref = computed(() => {
    const id = createForm.patientId.trim();
    if (!id) {
        return '';
    }

    return patientChartHref(id, {
        tab: 'records',
        appointmentId: createForm.appointmentId.trim() || null,
        from: openedFromAppointments ? 'appointments' : 'medical-records',
    });
});

const encounterWorkspaceHeaderContextLine = computed(() => {
    const parts = [
        createAppointmentSummary.value?.appointmentNumber?.trim()
            ? `Appointment ${createAppointmentSummary.value.appointmentNumber.trim()}`
            : null,
        createEncounterSummary.value?.encounterNumber?.trim()
            ? `Encounter ${createEncounterSummary.value.encounterNumber.trim()}`
            : null,
        createAppointmentSummary.value?.scheduledAt
            ? formatDateTime(createAppointmentSummary.value.scheduledAt)
            : null,
        createAppointmentSummary.value?.department?.trim() || null,
        [createAdmissionSummary.value?.ward?.trim(), createAdmissionSummary.value?.bed?.trim()]
            .filter(Boolean)
            .join(' · ') || null,
        encounterWorkspaceOwnerLabel.value,
    ].filter(Boolean);

    if (parts.length > 0) {
        return parts.join(' · ');
    }

    const workflowMeta = createMedicalRecordWorkflowContextMeta.value.trim();
    return workflowMeta || null;
});

const encounterWorkspaceDraftHeaderAlert = computed(() => {
    return null;
});

const encounterWorkspaceStatusPrimaryLabel = computed(() => {
    return encounterWorkspaceNoteStatusLabel.value;
});

const encounterWorkspaceStatusPrimaryVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    return encounterWorkspaceNoteStatusVariant.value;
});

const encounterWorkspaceNoteSyncTone = computed<
    'info' | 'success' | 'warning' | 'destructive'
>(() => {
    const syncLabel = createDraftIndicatorLabel.value;
    if (
        createDraftSyncState.value === 'error' ||
        createDraftSyncState.value === 'conflict' ||
        syncLabel === 'Save needs attention' ||
        syncLabel === 'Draft conflict'
    ) {
        return 'destructive';
    }

    if (syncLabel === 'Saved to chart') {
        return 'success';
    }

    if (
        syncLabel === 'Offline changes pending' ||
        syncLabel === 'Offline' ||
        syncLabel === 'Unsaved changes' ||
        syncLabel === 'Not saved to chart'
    ) {
        return 'warning';
    }

    return 'info';
});

const encounterWorkspaceNoteSyncBusy = computed(
    () =>
        createDraftSyncState.value === 'saving' ||
        createDraftHydratingExisting.value,
);

const encounterWorkspaceNoteSyncLabel = computed(() => {
    if (encounterWorkspaceBootstrapping.value) {
        return null;
    }

    return createDraftIndicatorLabel.value;
});

const encounterWorkspaceGridClass = computed(() => {
    if (!isEncounterWorkspaceMode.value) {
        return 'contents';
    }

    return [
        'min-h-0 flex-1 overflow-hidden',
        canShowCreateWorkflowWorkspace.value &&
            'lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-4',
    ]
        .filter(Boolean)
        .join(' ');
});

const encounterWorkspaceTabsClass = computed(() => [
    'flex min-h-0 flex-1 flex-col overflow-hidden',
    isEncounterWorkspaceMode.value && 'encounter-workspace-tabs',
    isEncounterWorkspaceMode.value &&
        workspacePaneFocus.value === 'note' &&
        'encounter-workspace-tabs--focus-note',
    isEncounterWorkspaceMode.value &&
        workspacePaneFocus.value === 'care' &&
        'encounter-workspace-tabs--focus-care',
]);

const encounterWorkspaceCarePaneClass = computed(() => [
    'order-2 mt-0 flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:order-2',
    isEncounterWorkspaceMode.value &&
        'encounter-workspace-pane encounter-workspace-pane--care',
    isEncounterWorkspaceMode.value &&
        workspacePaneFocus.value === 'note' &&
        'lg:hidden',
    isEncounterWorkspaceMode.value &&
        workspacePaneFocus.value === 'care' &&
        'lg:col-span-2',
]);

const encounterWorkspaceNotePaneClass = computed(() => [
    'order-1 mt-0 flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:order-1',
    isEncounterWorkspaceMode.value &&
        'encounter-workspace-pane encounter-workspace-pane--note',
    isEncounterWorkspaceMode.value &&
        workspacePaneFocus.value === 'care' &&
        'lg:hidden',
    isEncounterWorkspaceMode.value &&
        workspacePaneFocus.value === 'note' &&
        'lg:col-span-2',
]);

watch(
    () => workspacePaneFocus.value,
    (value) => {
        if (!isEncounterWorkspaceMode.value) return;

        if (value === 'care' && !canShowCreateWorkflowWorkspace.value) {
            workspacePaneFocus.value = 'note';
            return;
        }

        if (value === 'note') {
            createComposerWorkspaceTab.value = 'note';
        } else if (value === 'care') {
            createComposerWorkspaceTab.value = 'workflow';
        }

        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(
                encounterWorkspacePaneFocusStorageKey,
                value,
            );
        } catch {
            // Ignore storage failures (private mode / quotas).
        }
    },
);

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
        createForm.encounterId,
        createForm.appointmentId,
        createForm.admissionId,
        canReadLaboratoryOrders.value,
        canReadPharmacyOrders.value,
        canReadRadiologyOrders.value,
        canReadTheatreProcedures.value,
    ],
    () => {
        if (isEncounterWorkspaceMode.value && createForm.encounterId.trim()) {
            void refreshEncounterWorkspaceCareArtifacts();
            return;
        }

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

watch(
    () => createComposerWorkspaceTab.value,
    (value, previousValue) => {
        if (
            previousValue === 'note' &&
            value !== 'note'
        ) {
            void flushCreateDraftAutosave();
        }

        if (!isEncounterWorkspaceMode.value) return;

        if (value === 'note' && workspacePaneFocus.value !== 'note') {
            workspacePaneFocus.value = 'note';
        } else if (
            value === 'workflow' &&
            workspacePaneFocus.value !== 'care'
        ) {
            workspacePaneFocus.value = 'care';
        }
    },
);

watch(
    () => [
        medicalRecordTab.value,
        createForm.patientId,
        createForm.appointmentId,
        createForm.recordType,
        canCreateMedicalRecords.value,
    ],
    () => {
        if (medicalRecordTab.value !== 'new') return;
        if (!createForm.patientId.trim() || !createForm.appointmentId.trim()) {
            return;
        }
        if (!createIsConsultationNote.value) return;
        if (!canCreateMedicalRecords.value) return;
        if (createDraftRecord.value || createDraftHydratingExisting.value) {
            return;
        }

        void ensureEncounterDraftOnServer();
    },
    { immediate: true },
);

watch(
    () => [
        medicalRecordTab.value,
        createForm.patientId,
        createForm.appointmentId,
        createForm.recordType,
        canReadMedicalRecords.value,
    ],
    () => {
        if (medicalRecordTab.value !== 'new') return;
        if (!canReadMedicalRecords.value) return;
        if (hasPersistableCreateDraft.value) return;
        if (createDraftRecord.value) return;

        void initializeMedicalRecordCreateDraftRecovery();
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    void flushCreateDraftAutosave({ keepalive: true });
    clearCreateSuccessFeedbackTimer();
    clearSearchDebounce();
    clearMedicalRecordCreateDraftAutosaveTimers();
    teardownCreateDraftBroadcastChannel();
    if (typeof document !== 'undefined') {
        document.removeEventListener(
            'visibilitychange',
            handleCreateDraftVisibilityChange,
        );
    }
    if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handleCreateDraftPageHide);
        window.removeEventListener('blur', handleCreateDraftWindowBlur);
        window.removeEventListener('online', handleCreateDraftOnline);
        window.removeEventListener('offline', handleCreateDraftOffline);
        window.removeEventListener('keydown', handleEncounterWorkspaceGlobalKeydown);
    }
    removeMedicalRecordsNavigationGuard?.();
    removeMedicalRecordsNavigationGuard = null;
});
onMounted(() => {
    void bootstrapEncounterWorkspace();
    if (typeof document !== 'undefined') {
        document.addEventListener(
            'visibilitychange',
            handleCreateDraftVisibilityChange,
        );
    }
    if (typeof window !== 'undefined') {
        createDraftOnline.value = navigator.onLine;
        initializeCreateDraftBroadcastChannel();
        try {
            workspacePaneFocus.value = sanitizeEncounterWorkspacePaneFocus(
                window.localStorage.getItem(encounterWorkspacePaneFocusStorageKey),
            );
        } catch {
            // Ignore storage failures (private mode / quotas).
        }
        window.addEventListener('pagehide', handleCreateDraftPageHide);
        window.addEventListener('blur', handleCreateDraftWindowBlur);
        window.addEventListener('online', handleCreateDraftOnline);
        window.addEventListener('offline', handleCreateDraftOffline);
        window.addEventListener('keydown', handleEncounterWorkspaceGlobalKeydown);
    }
    removeMedicalRecordsNavigationGuard = router.on('before', (event) => {
        if (shouldBypassMedicalRecordsLeaveGuardForVisit(event.detail.visit)) {
            return;
        }

        if (
            bypassMedicalRecordsNavigationGuard ||
            medicalRecordTab.value !== 'new' ||
            !createDraftHasPendingChanges.value
        ) {
            return;
        }

        pendingMedicalRecordsWorkspaceClose.value = null;
        pendingMedicalRecordsVisit.value = event.detail.visit;
        createLeaveConfirmOpen.value = true;
        event.preventDefault();
        return false;
    });

    void refreshPage();
});
</script>

<template>
    <Head :title="encounterWorkspacePageTitle" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="shrink-0 bg-background px-4 pb-4 pt-3 md:px-6 md:pt-5">
            <EncounterWorkspaceHeader
                :loading="encounterWorkspaceHeaderLoading"
                :has-patient="encounterWorkspaceHasPatient"
                :patient-summary="createPatientSummary"
                :patient-name="createPatientSummary ? patientName(createPatientSummary) : ''"
                :patient-initials="createPatientSummary ? patientInitials(createPatientSummary) : ''"
                :header-context-line="encounterWorkspaceHeaderContextLine"
                :patient-context-meta="createPatientContextMeta"
                :patient-chart-href="createPatientChartHref"
                :back-label="encounterWorkspaceBackLabel"
                :back-icon="encounterWorkspaceBackIcon"
                intro-title="Encounter workspace"
                :intro-text="encounterWorkspaceIntroText"
                :note-type-label="createRecordTypeLabel"
                :workflow-label="createMedicalRecordWorkflowContextLabel"
                :workflow-status-label="createMedicalRecordContextStatusLabel"
                :workflow-status-variant="createMedicalRecordContextStatusVariant"
                :status-primary-label="encounterWorkspaceStatusPrimaryLabel"
                :status-primary-variant="encounterWorkspaceStatusPrimaryVariant"
                :draft-header-alert="encounterWorkspaceDraftHeaderAlert"
                @back="encounterWorkspaceBack()"
            />
        </div>

        <div
            class="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 md:px-6 md:pb-5"
        >
            <div
                class="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
        <!-- Consultation composer -->
        <Sheet
            :open="canUseMedicalRecordComposer"
            :modal="false"
        >
            <SheetContent
                side="right"
                variant="workspace"
                :size="null"
                :embedded="true"
                class="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background pb-3 md:pb-5"
            >
                        <div
                            v-if="canTakeOverCreateConsultationSession || canStartCreateConsultationSession"
                            class="shrink-0 px-4 pt-4 md:px-6"
                        >
                            <div
                                class="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 shadow-sm ring-1 ring-amber-200/70 dark:bg-amber-950/30 dark:ring-amber-800/70"
                            >
                                <AppIcon name="shield-alert" class="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                <p class="mr-auto text-xs text-amber-800 dark:text-amber-300">
                                    {{ canTakeOverCreateConsultationSession ? 'Another provider owns this session.' : 'Session not started yet.' }}
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
                            </div>
                        </div>
                        <div
                            v-if="encounterWorkspaceBootstrapSkeleton"
                            class="flex min-h-0 flex-1 flex-col overflow-hidden"
                            role="status"
                            aria-live="polite"
                            aria-label="Loading encounter workspace"
                        >
                            <EncounterWorkspaceNavBar
                                v-model="workspacePaneFocus"
                                :show-workflow-workspace="true"
                                :show-mobile-tabs="false"
                                :completed-sections="createComposerCompletedSectionCount"
                                :total-sections="createComposerSectionItems.length"
                                :care-total-count="createEncounterCareTotalCount"
                            />

                            <div :class="encounterWorkspaceGridClass">
                                <section
                                    v-if="workspacePaneFocus !== 'care'"
                                    :class="encounterWorkspaceNotePaneClass"
                                    aria-label="Loading clinical note"
                                >
                                    <EncounterWorkspacePaneHeader
                                        title="Clinical note"
                                        :description="createWorkflowNextStepDescription"
                                        :badge-label="encounterWorkspaceNoteStatusLabel"
                                        :badge-variant="encounterWorkspaceNoteStatusVariant"
                                    />
                                    <div class="min-h-0 flex-1 space-y-5 overflow-hidden px-4 py-4 md:px-6">
                                        <div class="rounded-lg border bg-card p-4 shadow-sm">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Visit context
                                            </p>
                                            <div class="mt-4 grid gap-3 lg:grid-cols-2">
                                                <div class="space-y-2">
                                                    <p class="text-xs text-muted-foreground">Patient</p>
                                                    <Skeleton class="h-9 rounded-lg" />
                                                </div>
                                                <div class="space-y-2">
                                                    <p class="text-xs text-muted-foreground">Appointment</p>
                                                    <Skeleton class="h-9 rounded-lg" />
                                                </div>
                                            </div>
                                        </div>
                                        <div class="rounded-lg border bg-card p-4 shadow-sm">
                                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                Charting sections
                                            </p>
                                            <div class="mt-5 space-y-5">
                                                <div class="space-y-2">
                                                    <p class="text-sm font-medium text-foreground">Triage and vitals</p>
                                                    <Skeleton class="h-16 rounded-lg" />
                                                </div>
                                                <div class="space-y-2">
                                                    <p class="text-sm font-medium text-foreground">Subjective</p>
                                                    <Skeleton class="h-24 rounded-lg" />
                                                </div>
                                                <div class="space-y-2">
                                                    <p class="text-sm font-medium text-foreground">Objective</p>
                                                    <Skeleton class="h-24 rounded-lg" />
                                                </div>
                                                <div class="space-y-2">
                                                    <p class="text-sm font-medium text-foreground">Assessment and plan</p>
                                                    <Skeleton class="h-24 rounded-lg" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section
                                    v-if="workspacePaneFocus !== 'note'"
                                    :class="encounterWorkspaceCarePaneClass"
                                    aria-label="Loading orders and results"
                                >
                                    <EncounterWorkspacePaneHeader
                                        title="Orders &amp; results"
                                        :description="createWorkflowNextStepDescription"
                                        :badge-label="createEncounterCareCountLabel"
                                    />
                                    <ScrollArea class="min-h-0 flex-1">
                                        <EncounterOrdersFocusSkeleton :compact="workspacePaneFocus === 'both'" />
                                    </ScrollArea>
                                </section>
                            </div>
                        </div>

                        <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <Tabs
                                v-model="createComposerWorkspaceTab"
                                :class="encounterWorkspaceTabsClass"
                            >
                                <div id="mr-create-composer-top" class="shrink-0">
                                <div
                                    v-if="
                                        createSuccessFeedback ||
                                        createErrorSummary.length ||
                                        createDraftRecoveryBannerVisible ||
                                        isCreateComposerReadOnly ||
                                        createDraftFailureAlertVisible
                                    "
                                    class="space-y-3 border-b border-border/40 px-4 py-3 md:px-6"
                                >
                                <Alert
                                    v-if="createSuccessFeedback"
                                    :class="[
                                        'border-0 shadow-sm ring-1',
                                        createSuccessFeedbackToneClass,
                                    ]"
                                    role="status"
                                    data-test="encounter-workspace-success-feedback"
                                >
                                    <div class="flex items-start gap-3">
                                        <div
                                            :class="[
                                                'flex size-8 shrink-0 items-center justify-center rounded-full',
                                                createSuccessFeedbackIconClass,
                                            ]"
                                            aria-hidden="true"
                                        >
                                            <AppIcon
                                                :name="createSuccessFeedbackIcon"
                                                class="size-4"
                                            />
                                        </div>
                                        <div class="min-w-0 flex-1 space-y-1">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <AlertTitle class="text-sm font-semibold leading-5">
                                                    {{ createSuccessFeedback.title }}
                                                </AlertTitle>
                                                <Badge
                                                    v-if="createSuccessFeedback.recordNumber"
                                                    variant="secondary"
                                                    class="h-5 font-mono text-[11px]"
                                                >
                                                    {{ createSuccessFeedback.recordNumber }}
                                                </Badge>
                                            </div>
                                            <AlertDescription
                                                v-if="createSuccessFeedback.detail"
                                                class="text-xs leading-5 opacity-90"
                                            >
                                                {{ createSuccessFeedback.detail }}
                                            </AlertDescription>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            class="size-7 shrink-0 text-current/70 hover:text-current"
                                            aria-label="Dismiss success message"
                                            @click="dismissCreateSuccessFeedback()"
                                        >
                                            <AppIcon name="x" class="size-3.5" />
                                        </Button>
                                    </div>
                                </Alert>

                                <Alert
                                    v-if="createErrorSummary.length"
                                    variant="destructive"
                                    class="border-0 bg-destructive/5 shadow-sm ring-1 ring-destructive/20"
                                >
                                    <div class="flex items-start gap-3">
                                        <div
                                            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                                            aria-hidden="true"
                                        >
                                            <AppIcon name="circle-x" class="size-4" />
                                        </div>
                                        <div class="min-w-0 flex-1 space-y-1">
                                            <AlertTitle class="text-sm font-semibold leading-5">
                                                Could not save the note
                                            </AlertTitle>
                                            <AlertDescription>
                                                <ul class="space-y-1 text-xs leading-5">
                                                    <li
                                                        v-for="errorItem in createErrorSummary"
                                                        :key="errorItem.key"
                                                    >
                                                        {{ errorItem.message }}
                                                    </li>
                                                </ul>
                                            </AlertDescription>
                                        </div>
                                    </div>
                                </Alert>

                                <Alert
                                    v-if="createDraftRecoveryBannerVisible"
                                    class="border-0 bg-card text-sky-950 shadow-sm ring-1 ring-sky-200/70 dark:bg-card dark:text-sky-100 dark:ring-sky-900/60"
                                >
                                    <AlertTitle class="flex items-center gap-2 text-sky-900 dark:text-sky-100">
                                        <AppIcon name="history" class="size-4" />
                                        Draft recovered from chart
                                    </AlertTitle>
                                    <AlertDescription class="mt-2 flex flex-wrap items-center justify-between gap-3 text-sky-900/90 dark:text-sky-100/90">
                                        <p class="text-xs leading-5">
                                            {{ createDraftRecoveryBannerLabel }}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            class="h-7 px-2.5 text-xs border-sky-300 bg-transparent text-sky-950 hover:bg-sky-100 dark:border-sky-800 dark:text-sky-100 dark:hover:bg-sky-900/30"
                                            @click="dismissCreateDraftRecoveryBanner"
                                        >
                                            Dismiss
                                        </Button>
                                    </AlertDescription>
                                </Alert>

                                <Alert
                                    v-if="isCreateComposerReadOnly"
                                    class="border-0 bg-card shadow-sm ring-1 ring-border/40"
                                >
                                    <AlertTitle class="flex items-center gap-2">
                                        <AppIcon name="shield-check" class="size-4" />
                                        Signed note is read-only
                                    </AlertTitle>
                                    <AlertDescription class="mt-2 text-sm leading-6">
                                        Signed notes are read-only. Amend or close the encounter when ready.
                                    </AlertDescription>
                                </Alert>

                                <Alert
                                    v-if="createDraftFailureAlertVisible"
                                    class="border-0 bg-card text-amber-950 shadow-sm ring-1 ring-amber-200/70 dark:bg-card dark:text-amber-100 dark:ring-amber-900/60"
                                >
                                    <AlertTitle class="flex items-center gap-2 text-amber-900 dark:text-amber-100">
                                        <AppIcon name="triangle-alert" class="size-4" />
                                        Chart save needs attention
                                    </AlertTitle>
                                    <AlertDescription class="mt-2 space-y-3 text-amber-900/90 dark:text-amber-100/90">
                                        <p>{{ createDraftSyncError }}</p>
                                        <p v-if="createDraftFailureDetail" class="text-xs leading-5">
                                            {{ createDraftFailureDetail }}
                                        </p>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Button
                                                size="sm"
                                                class="h-7 gap-1 px-2.5 text-xs"
                                                :disabled="createLoading || createDraftHydratingExisting"
                                                @click="void retryCreateDraftSave()"
                                            >
                                                <AppIcon name="refresh-cw" class="size-3.5" />
                                                Retry save
                                            </Button>
                                            <Button
                                                v-if="createDraftRecord && createDraftHasPendingChanges"
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                class="h-7 gap-1 px-2.5 text-xs border-amber-300 bg-transparent text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-900/30"
                                                @click="restoreStoredMedicalRecordCreateDraft"
                                            >
                                                Revert to last saved
                                            </Button>
                                        </div>
                                    </AlertDescription>
                                </Alert>
                                </div>

                                <EncounterWorkspaceNavBar
                                    v-model="workspacePaneFocus"
                                    :show-workflow-workspace="canShowCreateWorkflowWorkspace"
                                    :completed-sections="createComposerCompletedSectionCount"
                                    :total-sections="createComposerSectionItems.length"
                                    :care-total-count="createEncounterCareTotalCount"
                                />

                                <div :class="encounterWorkspaceGridClass">
                                <TabsContent
                                    v-if="canShowCreateWorkflowWorkspace"
                                    value="workflow"
                                    :force-mount="isEncounterWorkspaceMode"
                                    :class="encounterWorkspaceCarePaneClass"
                                    data-test="encounter-workspace-pane-care-panel"
                                >
                                    <EncounterWorkspacePaneHeader
                                        title="Orders &amp; results"
                                        :description="createWorkflowNextStepDescription"
                                        :badge-label="createEncounterCareCountLabel"
                                    />
                                    <ScrollArea class="min-h-0 flex-1">
                                    <div
                                        :class="[
                                            'space-y-4',
                                            workspacePaneFocus === 'both'
                                                ? 'px-3 pb-4 pt-3'
                                                : 'px-4 pb-5 pt-4 md:px-6 md:pb-6',
                                        ]"
                                    >
                                    <EncounterOrdersCommandCenter
                                        :patient-id="createForm.patientId"
                                        :has-workflow-actions="hasCreateContextWorkflowActions"
                                        :can-show-care="canShowCreateEncounterCare"
                                        :has-care-context="hasCreateEncounterCareContext"
                                        :care-count-label="createEncounterCareCountLabel"
                                        :active-stream-count="createEncounterCareActiveCount"
                                        :summaries="createEncounterCareSummaries"
                                        :inline-order-type="encounterInlineOrderType"
                                        :inline-order-context="encounterInlineOrderContext"
                                        :can-use-inline-orders="canUseEncounterInlineOrders()"
                                        :can-open-laboratory-workflow="canOpenLaboratoryWorkflow"
                                        :can-open-pharmacy-workflow="canOpenPharmacyWorkflow"
                                        :can-open-radiology-workflow="canOpenRadiologyWorkflow"
                                        :can-open-theatre-workflow="canOpenTheatreWorkflow"
                                        :can-open-billing-workflow="canOpenBillingWorkflow"
                                        :context-create-href="contextCreateHref"
                                        :compact="workspacePaneFocus === 'both'"
                                        @close-inline-order="closeEncounterInlineOrder()"
                                        @created-inline-order="void handleEncounterInlineOrderCreated($event)"
                                        @open-inline-order="openEncounterInlineOrder($event)"
                                    />

                                    <section
                                        v-if="canShowCreateEncounterCare"
                                        class="space-y-3 rounded-lg border bg-card p-4 shadow-sm"
                                    >
                                        <div
                                            :class="[
                                                'flex flex-col gap-2',
                                                workspacePaneFocus === 'both'
                                                    ? ''
                                                    : 'md:flex-row md:items-start md:justify-between',
                                            ]"
                                        >
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                    Active orders &amp; results
                                                </p>
                                                <p class="text-xs leading-5 text-muted-foreground">
                                                    {{
                                                        hasCreateEncounterCareContext
                                                            ? 'Track linked order status, results, reorders, add-ons, and safe cancellation in one stream.'
                                                            : 'Link an appointment or admission to see active orders and results here.'
                                                    }}
                                                </p>
                                            </div>
                                            <p
                                                v-if="createEncounterCareHeaderContext"
                                                class="rounded-full bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground"
                                            >
                                                {{ createEncounterCareHeaderContext }}
                                            </p>
                                        </div>
                                        <div
                                            v-if="!hasCreateEncounterCareContext"
                                            class="rounded-lg bg-muted/25 px-4 py-3 text-sm text-muted-foreground ring-1 ring-border/30"
                                        >
                                            Link an appointment or admission to see orders here.
                                        </div>
                                        <div
                                            v-else-if="!hasVisibleCreateEncounterCare"
                                            class="rounded-lg bg-muted/25 px-4 py-3 text-sm text-muted-foreground ring-1 ring-border/30"
                                        >
                                            No orders linked yet. Use the command center above to place the first order.
                                        </div>
                                        <EncounterWorkflowCareStreams
                                            v-else
                                            v-model="createEncounterCareTab"
                                            :visible-summaries="createEncounterCareVisibleSummaries"
                                            :laboratory-orders="createEncounterLaboratoryOrders"
                                            :pharmacy-orders="createEncounterPharmacyOrders"
                                            :radiology-orders="createEncounterRadiologyOrders"
                                            :theatre-procedures="createEncounterTheatreProcedures"
                                            :laboratory-loading="createEncounterLaboratoryOrdersLoading"
                                            :pharmacy-loading="createEncounterPharmacyOrdersLoading"
                                            :radiology-loading="createEncounterRadiologyOrdersLoading"
                                            :theatre-loading="createEncounterTheatreProceduresLoading"
                                            :laboratory-error="createEncounterLaboratoryOrdersError"
                                            :pharmacy-error="createEncounterPharmacyOrdersError"
                                            :radiology-error="createEncounterRadiologyOrdersError"
                                            :theatre-error="createEncounterTheatreProceduresError"
                                            :can-open-laboratory-workflow="canOpenLaboratoryWorkflow"
                                            :can-open-pharmacy-workflow="canOpenPharmacyWorkflow"
                                            :can-open-radiology-workflow="canOpenRadiologyWorkflow"
                                            :can-open-theatre-workflow="canOpenTheatreWorkflow"
                                            :can-create-laboratory-orders="canCreateLaboratoryOrders"
                                            :can-create-pharmacy-orders="canCreatePharmacyOrders"
                                            :can-create-radiology-orders="canCreateRadiologyOrders"
                                            :can-create-theatre-procedures="canCreateTheatreProcedures"
                                            :context-create-href="contextCreateHref"
                                            :format-date-time="formatDateTime"
                                            :compact="workspacePaneFocus === 'both'"
                                            @lifecycle="openEncounterLifecycleDialog($event.kind, $event.id, $event.action, $event.defaultReason)"
                                        />
                                    </section>

                                    <section
                                        v-if="isEncounterWorkspaceMode && canOpenBillingWorkflow"
                                        id="encounter-workspace-close-readiness"
                                        class="space-y-3 rounded-lg border bg-card p-4 shadow-sm"
                                    >
                                        <EncounterBillingPanel
                                            :readiness="createEncounterCloseReadiness"
                                            :billing-href="encounterWorkspaceBillingHref"
                                            :can-create-billing="canCreateBillingInvoices"
                                        />
                                    </section>

                                    <section
                                        v-if="isEncounterWorkspaceMode"
                                        class="space-y-3"
                                    >
                                    <Collapsible
                                        v-if="canReadMedicalRecords"
                                        v-model:open="encounterAttachmentsOpen"
                                        class="rounded-lg bg-card shadow-sm ring-1 ring-border/40"
                                    >
                                        <CollapsibleTrigger as-child>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                class="flex h-auto w-full justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                                            >
                                                <span class="min-w-0 space-y-0.5">
                                                    <span class="block text-sm font-semibold text-foreground">
                                                        Attachments
                                                    </span>
                                                    <span class="block text-xs font-normal text-muted-foreground">
                                                        Clinical documents and uploaded encounter files.
                                                    </span>
                                                </span>
                                                <AppIcon
                                                    :name="encounterAttachmentsOpen ? 'chevron-up' : 'chevron-down'"
                                                    class="mt-1 size-4 shrink-0 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent class="px-4 pb-4">
                                            <EncounterDocumentsPanel
                                                :encounter-id="createForm.encounterId"
                                                :can-read="canReadMedicalRecords"
                                                :can-create="canCreateMedicalRecords"
                                                :can-update="canUpdateMedicalRecords"
                                            />
                                        </CollapsibleContent>
                                    </Collapsible>

                                    <Collapsible
                                        v-model:open="encounterGovernanceOpen"
                                        class="rounded-lg bg-card shadow-sm ring-1 ring-border/40"
                                    >
                                        <CollapsibleTrigger as-child>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                class="flex h-auto w-full justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                                            >
                                                <span class="min-w-0 space-y-0.5">
                                                    <span class="block text-sm font-semibold text-foreground">
                                                        Governance
                                                    </span>
                                                    <span class="block text-xs font-normal text-muted-foreground">
                                                        Audit trail, printable chart packet, and encounter controls.
                                                    </span>
                                                </span>
                                                <AppIcon
                                                    :name="encounterGovernanceOpen ? 'chevron-up' : 'chevron-down'"
                                                    class="mt-1 size-4 shrink-0 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent class="px-4 pb-4">
                                            <EncounterGovernancePanel
                                                :encounter-id="createForm.encounterId"
                                                :encounter-number="createEncounterSummary?.encounterNumber ?? null"
                                                :can-view-audit="canViewMedicalRecordAudit"
                                                :can-open-chart-packet="encounterWorkspaceChartPacketReady"
                                                :print-href="encounterWorkspacePrintHref"
                                                :pdf-href="encounterWorkspacePdfHref"
                                            />
                                        </CollapsibleContent>
                                    </Collapsible>
                                    </section>

                                    </div>
                                    </ScrollArea>
                                </TabsContent>

                                <TabsContent
                                    value="note"
                                    :force-mount="isEncounterWorkspaceMode"
                                    :class="encounterWorkspaceNotePaneClass"
                                >
                                    <EncounterWorkspacePaneHeader
                                        title="Clinical note"
                                        :description="createWorkflowNextStepDescription"
                                        :badge-label="encounterWorkspaceNoteStatusLabel"
                                        :badge-variant="encounterWorkspaceNoteStatusVariant"
                                        :sync-label="encounterWorkspaceNoteSyncLabel"
                                        :sync-detail="createDraftIndicatorDetail"
                                        :sync-tone="encounterWorkspaceNoteSyncTone"
                                        :sync-busy="encounterWorkspaceNoteSyncBusy"
                                    />
                                    <div
                                        v-if="createDraftConflictAlertVisible"
                                        class="shrink-0 border-b border-border/40 px-4 py-3 md:px-6"
                                    >
                                        <Alert
                                            class="border-0 bg-card text-amber-950 shadow-sm ring-1 ring-amber-200/70 dark:bg-card dark:text-amber-100 dark:ring-amber-900/60"
                                        >
                                            <AlertDescription class="flex flex-col gap-2 text-amber-900/90 dark:text-amber-100/90 md:flex-row md:items-center md:justify-between">
                                                <div class="flex min-w-0 items-start gap-2">
                                                    <AppIcon name="history" class="mt-0.5 size-3.5 shrink-0" />
                                                    <div class="min-w-0 space-y-0.5">
                                                        <p class="text-xs font-medium text-amber-950 dark:text-amber-100">
                                                            Newer chart copy available
                                                        </p>
                                                        <p class="text-xs leading-5">
                                                            {{ createDraftSyncError }}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div class="flex shrink-0 flex-wrap items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        class="h-7 gap-1 px-2.5 text-xs"
                                                        :disabled="createLoading || createDraftHydratingExisting"
                                                        @click="void applyCreateDraftConflictServerVersion()"
                                                    >
                                                        <AppIcon name="download" class="size-3.5" />
                                                        Load chart copy
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        class="h-7 gap-1 px-2.5 text-xs border-amber-300 bg-transparent text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-900/30"
                                                        :disabled="createLoading || createDraftHydratingExisting"
                                                        @click="void overwriteCreateDraftConflictWithLocalChanges()"
                                                    >
                                                        <AppIcon name="upload" class="size-3.5" />
                                                        Keep my changes
                                                    </Button>
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                    <EncounterNoteComposerShell>
                                    <div
                                        id="mr-create-note-setup"
                                        class="scroll-mt-32 space-y-3 rounded-lg border bg-card p-4 shadow-sm"
                                    >
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Note setup
                                        </p>
                                        <p class="text-xs text-muted-foreground">
                                            {{ createRecordTypeLabel }}
                                        </p>
                                        <div class="grid gap-3 lg:grid-cols-2">
                                            <div class="grid min-w-0 gap-2">
                                                <Label
                                                    for="mr-create-record-type-trigger"
                                                    class="text-xs font-medium text-muted-foreground"
                                                >
                                                    Record type
                                                </Label>
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
                                                <p
                                                    v-if="createFieldError('recordType')"
                                                    class="text-xs text-destructive"
                                                >
                                                    {{ createFieldError('recordType') }}
                                                </p>
                                            </div>
                                            <div id="mr-create-diagnosis-section" class="grid min-w-0 gap-2">
                                                <Label
                                                    for="mr-create-diagnosis-code"
                                                    class="text-xs font-medium text-muted-foreground"
                                                >
                                                    Diagnosis / ICD-10
                                                </Label>
                                                <Input
                                                    id="mr-create-diagnosis-code"
                                                    v-model="createForm.diagnosisCode"
                                                    placeholder="Optional, for example R52 or J11.1"
                                                    class="w-full min-w-0 bg-background"
                                                />
                                                <p
                                                    v-if="createFieldError('diagnosisCode')"
                                                    class="text-xs text-destructive"
                                                >
                                                    {{ createFieldError('diagnosisCode') }}
                                                </p>
                                            </div>
                                        </div>
                                        <details
                                            v-if="
                                                (createIsProgressNote && hasCreateAdmissionContext) ||
                                                (createIsDischargeNote && hasCreateAdmissionContext) ||
                                                createForm.appointmentReferralId.trim() ||
                                                createForm.theatreProcedureId.trim()
                                            "
                                            class="rounded-lg bg-muted/10 shadow-sm ring-1 ring-border/35"
                                        >
                                            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                                                <div class="space-y-1">
                                                    <p class="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                                        Linked workflow context
                                                    </p>
                                                    <p class="text-xs leading-5 text-muted-foreground">
                                                        Open admission, referral, or theatre continuity only when you need it.
                                                    </p>
                                                </div>
                                                <Badge variant="outline" class="text-[10px]">
                                                    Optional
                                                </Badge>
                                            </summary>
                                            <div class="space-y-3 px-4 py-3 shadow-[0_-1px_0_0_hsl(var(--border)/0.45)]">
                                        <div
                                            v-if="createIsProgressNote && hasCreateAdmissionContext"
                                            class="rounded-lg bg-muted/20 p-4 ring-1 ring-border/30"
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
                                            class="rounded-lg bg-muted/20 p-4 ring-1 ring-border/30"
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
                                            class="rounded-lg bg-muted/20 p-4 ring-1 ring-border/30"
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
                                            class="rounded-lg bg-muted/20 p-4 ring-1 ring-border/30"
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
                                                                ? formatTheatreProcedureSummary(createLinkedTheatreProcedure, formatDateTime)
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
                                        </div>
                                        </details>
                                    </div>
                                    <div
                                        id="mr-create-clinical-note"
                                        class="scroll-mt-32 space-y-3 rounded-lg border bg-card p-4 shadow-sm"
                                    >
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Documentation
                                        </p>
                                        <div class="space-y-5">
                                            <div
                                                id="mr-create-subjective-section"
                                                class="scroll-mt-32 space-y-3"
                                            >
                                                <RichTextEditorField
                                                    input-id="mr-create-subjective"
                                                    v-model="createForm.subjective"
                                                    :label="createSubjectiveLabel"
                                                    :placeholder="createSubjectiveUi.placeholder"
                                                    helper-text=""
                                                    :error-message="createFieldError('subjective')"
                                                    min-height-class="min-h-[160px]"
                                                />
                                            </div>
                                            <EncounterTriageVitalsPanel
                                                v-if="hasCreateAppointmentContext"
                                                variant="compact"
                                                :loading="createAppointmentSummaryLoading"
                                                :error="createAppointmentSummaryError"
                                                :triage-vitals-summary="createAppointmentSummary?.triageVitalsSummary"
                                                :triage-notes="createAppointmentSummary?.triageNotes"
                                                :triage-category="createAppointmentSummary?.triageCategory"
                                                :triaged-at="createAppointmentSummary?.triagedAt"
                                                :format-date-time="formatDateTime"
                                            />
                                            <div
                                                id="mr-create-objective-section"
                                                class="scroll-mt-32 space-y-3"
                                            >
                                                <RichTextEditorField
                                                    input-id="mr-create-objective"
                                                    v-model="createForm.objective"
                                                    :label="createObjectiveLabel"
                                                    :placeholder="createObjectiveUi.placeholder"
                                                    helper-text=""
                                                    :error-message="createFieldError('objective')"
                                                    min-height-class="min-h-[160px]"
                                                />
                                            </div>
                                            <div
                                                id="mr-create-assessment-section"
                                                class="scroll-mt-32 space-y-3"
                                            >
                                                <RichTextEditorField
                                                    input-id="mr-create-assessment"
                                                    v-model="createForm.assessment"
                                                    :label="createAssessmentLabel"
                                                    :placeholder="createAssessmentUi.placeholder"
                                                    helper-text=""
                                                    :error-message="createFieldError('assessment')"
                                                    min-height-class="min-h-[160px]"
                                                />
                                            </div>
                                            <div
                                                id="mr-create-plan-section"
                                                class="scroll-mt-32 space-y-3"
                                            >
                                                <RichTextEditorField
                                                    input-id="mr-create-plan"
                                                    v-model="createForm.plan"
                                                    :label="createPlanLabel"
                                                    :placeholder="createPlanUi.placeholder"
                                                    helper-text=""
                                                    :error-message="createFieldError('plan')"
                                                    min-height-class="min-h-[160px]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    </EncounterNoteComposerShell>
                                </TabsContent>
                                </div>
                            </div>
                            </Tabs>
                        </div>
                        <SheetFooter
                            v-if="!encounterWorkspaceBootstrapSkeleton"
                            class="sticky bottom-0 z-20 shrink-0 w-full bg-background/95 px-4 py-4 shadow-[0_-1px_0_0_hsl(var(--border)/0.45),0_-8px_24px_-18px_hsl(var(--foreground)/0.35)] backdrop-blur supports-[backdrop-filter]:bg-background/90 md:px-6"
                        >
                            <div class="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <p
                                    v-if="createFooterWorkflowHint"
                                    class="min-w-0 flex-1 text-xs text-muted-foreground"
                                >
                                    {{ createFooterWorkflowHint }}
                                </p>
                                <div
                                    :class="[
                                        'flex shrink-0 flex-wrap items-center gap-2 lg:ml-auto lg:justify-end',
                                        !createFooterWorkflowHint && 'w-full',
                                    ]"
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        class="gap-1.5 text-muted-foreground"
                                        data-test="encounter-workspace-close-panel"
                                        @click="encounterWorkspaceBack()"
                                    >
                                        Close
                                    </Button>
                                    <Button
                                        :variant="canFinalizeAndCompleteVisit || canSaveAndReturnToAppointments ? 'outline' : 'default'"
                                        size="sm"
                                        class="gap-1.5"
                                        data-test="encounter-workspace-save-note"
                                        :disabled="createLoading || !createForm.patientId.trim() || isCreateComposerReadOnly"
                                        @click="createRecord('save')"
                                    >
                                        <AppIcon name="save" class="size-3.5" />
                                        {{
                                            createLoading && createSubmitIntent === 'save'
                                                ? 'Saving...'
                                                : 'Save note'
                                        }}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="createLoading || !createForm.patientId.trim() || !canSaveAndReturnToAppointments"
                                        @click="createRecord('return')"
                                    >
                                        <AppIcon name="save" class="size-3.5" />
                                        {{
                                            createLoading &&
                                            createSubmitIntent === 'return'
                                                ? 'Saving...'
                                            : 'Save & return'
                                        }}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        data-test="encounter-workspace-finalize-note"
                                        :disabled="createLoading || !createForm.patientId.trim() || !canFinalizeCreateNote"
                                        @click="openCreateFinalizeConfirmDialog()"
                                    >
                                        <AppIcon name="shield-check" class="size-3.5" />
                                        {{
                                            createLoading &&
                                            createSubmitIntent === 'finalize'
                                                ? 'Finalizing...'
                                                : 'Finalize note'
                                        }}
                                    </Button>
                                    <Button
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="createLoading || !createForm.patientId.trim() || !canFinalizeAndCompleteVisit"
                                        @click="openCreateFinalizeAndCompleteConfirmDialog()"
                                    >
                                        <AppIcon name="circle-check-big" class="size-3.5" />
                                        {{
                                            createLoading &&
                                            createSubmitIntent === 'finalize_complete'
                                                ? 'Finalizing...'
                                                : 'Finalize & close visit'
                                        }}
                                    </Button>
                                </div>
                            </div>
                        </SheetFooter>
            </SheetContent>
        </Sheet>
            </div>
        </div>

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
                :open="createEncounterReopenDialogOpen"
                @update:open="(open) => (open ? (createEncounterReopenDialogOpen = true) : closeCreateEncounterReopenDialog())"
            >
                <DialogContent variant="action">
                    <DialogHeader>
                        <DialogTitle>Reopen encounter?</DialogTitle>
                        <DialogDescription>
                            Reopening returns this encounter to an active correction state. Use this only for controlled exceptions after close-out.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="space-y-2">
                        <Label for="encounter-reopen-reason">Reopen reason</Label>
                        <Textarea
                            id="encounter-reopen-reason"
                            v-model="createEncounterReopenReason"
                            rows="3"
                            placeholder="Example: Additional findings require reopening the visit for correction."
                        />
                        <p
                            v-if="createEncounterReopenError"
                            class="text-sm text-destructive"
                        >
                            {{ createEncounterReopenError }}
                        </p>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button
                            variant="outline"
                            :disabled="createEncounterReopenSubmitting"
                            @click="closeCreateEncounterReopenDialog"
                        >
                            Cancel
                        </Button>
                        <Button
                            :disabled="createEncounterReopenSubmitting"
                            @click="void submitCreateEncounterReopen()"
                        >
                            {{
                                createEncounterReopenSubmitting
                                    ? 'Reopening...'
                                    : 'Reopen encounter'
                            }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="createFinalizeConfirmOpen"
                @update:open="(open) => (open ? (createFinalizeConfirmOpen = true) : closeCreateFinalizeConfirmDialog())"
            >
                <DialogContent variant="action">
                    <DialogHeader>
                        <DialogTitle>
                            {{
                                createFinalizeConfirmIntent === 'finalize_complete'
                                    ? 'Finalize note and close visit?'
                                    : 'Finalize note?'
                            }}
                        </DialogTitle>
                        <DialogDescription>
                            {{
                                createFinalizeConfirmIntent === 'finalize_complete'
                                    ? `This will sign the ${createRecordTypeLabel.toLowerCase()} and then complete the linked outpatient visit.`
                                    : `This will sign the ${createRecordTypeLabel.toLowerCase()} and keep the visit open.`
                            }}
                        </DialogDescription>
                    </DialogHeader>
                    <div class="space-y-3">
                        <div class="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                            <p class="font-medium text-foreground">
                                {{ createPatientContextLabel }}
                            </p>
                            <p class="mt-1">
                                {{ createPatientContextMeta }}
                            </p>
                            <p v-if="hasCreateAppointmentContext" class="mt-1">
                                {{ createAppointmentContextLabel }} | {{ createAppointmentContextMeta }}
                            </p>
                        </div>
                        <div class="grid gap-2 text-sm text-muted-foreground">
                            <p>Finalize locks the note for normal editing.</p>
                            <p>
                                {{
                                    createFinalizeConfirmIntent === 'finalize_complete'
                                        ? 'Visit close-out will only continue after the note is successfully finalized.'
                                        : 'The outpatient encounter will stay active until it is closed separately.'
                                }}
                            </p>
                        </div>
                    </div>
                    <DialogFooter class="gap-2">
                        <Button
                            variant="outline"
                            :disabled="createLoading && (createSubmitIntent === 'finalize' || createSubmitIntent === 'finalize_complete')"
                            @click="closeCreateFinalizeConfirmDialog"
                        >
                            Keep charting
                        </Button>
                        <Button
                            :disabled="createLoading && (createSubmitIntent === 'finalize' || createSubmitIntent === 'finalize_complete')"
                            data-test="encounter-workspace-finalize-confirm"
                            @click="confirmCreateFinalizeAction"
                        >
                            {{
                                createLoading &&
                                (createSubmitIntent === 'finalize' ||
                                    createSubmitIntent === 'finalize_complete')
                                    ? 'Finalizing...'
                                    : createFinalizeConfirmIntent === 'finalize_complete'
                                      ? 'Finalize & close visit'
                                      : 'Finalize note'
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
                            {{ createLeaveConfirmDescription }}
                        </DialogDescription>
                    </DialogHeader>
                    <div class="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                        {{ createLeaveConfirmBody }}
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

            <EncounterLifecycleDialog
                v-model:open="encounterLifecycleDialogOpen"
                v-model:reason="encounterLifecycleReason"
                :action="encounterLifecycleAction"
                :target-name="encounterLifecycleTargetName()"
                :error="encounterLifecycleError"
                :submitting="encounterLifecycleSubmitting"
                @close="closeEncounterLifecycleDialog()"
                @submit="void submitEncounterLifecycleDialog()"
            />

        <EncounterCloseChecklistDialog
            :open="createEncounterCloseDialogOpen"
            :readiness="createEncounterCloseReadiness"
            :reason="createEncounterCloseReason"
            :submitting="createEncounterCloseSubmitting"
            :error="createEncounterCloseError"
            @update:open="createEncounterCloseDialogOpen = $event"
            @update:reason="createEncounterCloseReason = $event"
            @confirm="void submitEncounterCloseDialog()"
        />

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
    </AppLayout>
</template>
