<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import LinkedContextLookupField from '@/components/context/LinkedContextLookupField.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import ClinicalLifecycleActionDialog from '@/components/orders/ClinicalLifecycleActionDialog.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import WalkInServiceRequestsPanel from '@/components/service-requests/WalkInServiceRequestsPanel.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Input, SearchInput } from '@/components/ui/input';
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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { usePendingWorkflowLeaveGuard } from '@/composables/usePendingWorkflowLeaveGuard';
import { useWorkflowDraftPersistence } from '@/composables/useWorkflowDraftPersistence';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { patientChartHref } from '@/lib/patientChart';
import { mergeSearchableOptions, type SearchableSelectOption } from '@/lib/patientLocations';
import {
    clinicalStockPrecheckTitle,
    formatClinicalStockQuantity,
    type ClinicalStockPrecheck,
} from '@/types/clinicalStockPrecheck';
import { type BreadcrumbItem } from '@/types';

type ApiError = Error & { status?: number; payload?: { errors?: Record<string, string[]>; message?: string } };
type TheatreWorkspaceView = 'queue' | 'board' | 'create';
type CreateContextLinkSource = 'none' | 'route' | 'auto' | 'manual';
type CreateContextEditorTab = 'patient' | 'appointment' | 'admission';
type TheatreDetailsTab = 'overview' | 'workflows' | 'audit';
type PatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
};
type PatientResponse = { data: PatientSummary };
type AppointmentSummary = {
    id: string;
    appointmentNumber: string | null;
    patientId: string | null;
    department: string | null;
    scheduledAt: string | null;
    durationMinutes: number | null;
    reason: string | null;
    status: string | null;
    statusReason: string | null;
};
type AdmissionSummary = {
    id: string;
    admissionNumber: string | null;
    patientId: string | null;
    ward: string | null;
    bed: string | null;
    admittedAt: string | null;
    status: string | null;
    statusReason: string | null;
};
type AppointmentResponse = { data: AppointmentSummary };
type AdmissionResponse = { data: AdmissionSummary };
type LinkedContextListResponse<T> = {
    data: T[];
    meta?: {
        currentPage?: number;
        perPage?: number;
        total?: number;
        lastPage?: number;
    };
};
type ClinicalCatalogItem = {
    id: string;
    code: string | null;
    name: string | null;
    category: string | null;
    unit: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    status: string | null;
};
type ClinicalCatalogItemListResponse = LinkedContextListResponse<ClinicalCatalogItem>;
type ServicePointResource = {
    id: string | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    servicePointType: string | null;
    location: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
};
type ServicePointRegistryListResponse = LinkedContextListResponse<ServicePointResource>;
type StaffProfile = {
    id: string;
    userId: number | null;
    userName: string | null;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    status: string | null;
    statusReason: string | null;
};
type StaffListResponse = LinkedContextListResponse<StaffProfile>;
type TheatreProcedure = {
    id: string;
    procedureNumber: string | null;
    patientId: string | null;
    patientNumber: string | null;
    patientLabel: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    orderSessionId: string | null;
    entryState: 'draft' | 'active' | string | null;
    signedAt: string | null;
    signedByUserId: number | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    theatreProcedureCatalogItemId: string | null;
    procedureType: string | null;
    procedureName: string | null;
    operatingClinicianUserId: number | null;
    anesthetistUserId: number | null;
    theatreRoomServicePointId: string | null;
    theatreRoomName: string | null;
    theatreRoomCode: string | null;
    theatreRoomServicePointType: string | null;
    theatreRoomLocation: string | null;
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    enteredInErrorByUserId: number | null;
    lifecycleLockedAt: string | null;
    stockPrecheck: ClinicalStockPrecheck | null;
    notes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};
type MedicalRecordSummary = {
    id: string;
    patientId: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    theatreProcedureId: string | null;
    recordNumber: string | null;
    recordType: string | null;
    status: string | null;
    encounterAt: string | null;
};
type MedicalRecordListResponse = {
    data: MedicalRecordSummary[];
    meta?: {
        currentPage?: number | null;
        perPage?: number | null;
        total?: number | null;
        lastPage?: number | null;
    };
};
type ProcedureNoteContinuitySummary = {
    state: 'available' | 'missing' | 'draft' | 'documented';
    badgeLabel: string;
    badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
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
type DuplicateCheckResponse<T> = {
    data: {
        severity: 'none' | 'warning' | 'critical' | string;
        messages: string[];
        sameEncounterDuplicates: T[];
        recentPatientDuplicates: T[];
    };
};
type TheatreCreateDraft = {
    patientId: string;
    admissionId: string;
    appointmentId: string;
    serverDraftId: string;
    theatreProcedureCatalogItemId: string;
    procedureType: string;
    procedureName: string;
    operatingClinicianUserId: string;
    anesthetistUserId: string;
    theatreRoomServicePointId: string;
    theatreRoomName: string;
    scheduledAt: string;
    notes: string;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Theatre & Procedures', href: '/theatre-procedures' }];
const statusOptions = ['planned', 'in_preop', 'in_progress', 'completed', 'cancelled'];
const theatreStatusTransitionMap: Record<string, string[]> = {
    planned: ['in_preop', 'cancelled'],
    in_preop: ['in_progress', 'cancelled'],
    in_progress: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
};
const resourceTypeOptions = ['room', 'staff', 'equipment'];
const resourceStatusOptions = ['scheduled', 'in_use', 'released', 'cancelled'];
const resourceStatusActionOptions = ['in_use', 'released', 'cancelled', 'scheduled'];
const auditActorTypeOptions = [
    { value: '', label: 'All actors' },
    { value: 'user', label: 'User only' },
    { value: 'system', label: 'System only' },
];

const canRead = ref(false);
const canCreate = ref(false);
const canUpdate = ref(false);
const canUpdateStatus = ref(false);
const canViewAudit = ref(false);
const canReadMedicalRecords = ref(false);
const canCreateMedicalRecords = ref(false);
const canUpdateMedicalRecords = ref(false);
const canReadAppointments = ref(false);
const canReadAdmissions = ref(false);
const canCreateLaboratoryOrders = ref(false);
const canCreatePharmacyOrders = ref(false);
const canCreateRadiologyOrders = ref(false);
const canReadBillingInvoices = ref(false);
const canManageResources = ref(false);
const canViewResourceAudit = ref(false);
const canReadTheatreProcedureCatalog = ref(false);
const canReadTheatreRoomRegistry = ref(false);
const canReadTheatreClinicianDirectory = ref(false);
const canUpdateServiceRequestStatus = ref(false);
const pageLoading = ref(true);
const theatreWorkspaceView = ref<TheatreWorkspaceView>('queue');
const theatreWalkInPanelRef = ref<InstanceType<typeof WalkInServiceRequestsPanel> | null>(null);

const queueLoading = ref(false);
const queueError = ref<string | null>(null);
const procedures = ref<TheatreProcedure[]>([]);
const counts = ref({ planned: 0, in_preop: 0, in_progress: 0, completed: 0, cancelled: 0, other: 0, total: 0 });
const pagination = ref<{ currentPage: number; lastPage: number } | null>(null);
const patientDirectory = ref<Record<string, PatientSummary>>({});
const pendingPatientLookupIds = new Set<string>();

const searchForm = reactive({
    q: '',
    status: '',
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
    page: 1,
    perPage: 25,
});
const createForm = reactive({
    patientId: queryParam('patientId'),
    admissionId: queryParam('admissionId'),
    appointmentId: queryParam('appointmentId'),
    serviceRequestId: queryParam('serviceRequestId'),
    theatreProcedureCatalogItemId: '',
    procedureType: '',
    procedureName: '',
    operatingClinicianUserId: '',
    anesthetistUserId: '',
    theatreRoomServicePointId: '',
    theatreRoomName: '',
    scheduledAt: defaultDateTimeLocal(),
    notes: '',
});
const createSubmitting = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createDraftNotice = ref<string | null>(null);
const createServerDraftId = ref('');
const createScheduledAtBaseline = ref(createForm.scheduledAt);
const openedFromClinicalContext = computed(
    () =>
        createForm.patientId.trim() !== '' &&
        (createForm.appointmentId.trim() !== '' || createForm.admissionId.trim() !== ''),
);
const createPatientContextLocked = ref(openedFromClinicalContext.value);
const createContextEditorTab = ref<CreateContextEditorTab>(
    !createForm.patientId.trim()
        ? 'patient'
        : createForm.admissionId.trim()
          ? 'admission'
          : createForm.appointmentId.trim()
            ? 'appointment'
            : 'patient',
);
const createContextEditorOpen = ref(
    !openedFromClinicalContext.value || !createForm.patientId.trim(),
);
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
const createAppointmentLinkSource = ref<CreateContextLinkSource>(
    createForm.appointmentId.trim() ? 'route' : 'none',
);
const createAdmissionLinkSource = ref<CreateContextLinkSource>(
    createForm.admissionId.trim() ? 'route' : 'none',
);
const createContextAutoLinkSuppressed = reactive({
    appointment: false,
    admission: false,
});
let createAppointmentSummaryRequestId = 0;
let createAdmissionSummaryRequestId = 0;
let createContextSuggestionsRequestId = 0;
let pendingCreateAppointmentLinkSource: CreateContextLinkSource | null = null;
let pendingCreateAdmissionLinkSource: CreateContextLinkSource | null = null;
const theatreProcedureCatalogItems = ref<ClinicalCatalogItem[]>([]);
const theatreProcedureCatalogLoading = ref(false);
const theatreProcedureCatalogError = ref<string | null>(null);
const theatreRoomServicePoints = ref<ServicePointResource[]>([]);
const theatreRoomRegistryLoading = ref(false);
const theatreRoomRegistryError = ref<string | null>(null);
const theatreClinicians = ref<StaffProfile[]>([]);
const theatreCliniciansLoading = ref(false);
const theatreCliniciansError = ref<string | null>(null);

const statusDialogOpen = ref(false);
const statusProcedure = ref<TheatreProcedure | null>(null);
const statusAction = ref<string>('in_preop');
const statusReason = ref('');
const statusStartedAt = ref(defaultDateTimeLocal());
const statusCompletedAt = ref(defaultDateTimeLocal());
const statusSubmitting = ref(false);
const statusError = ref<string | null>(null);
const statusDialogStockCheckLoading = ref(false);
const statusDialogStockCheckError = ref<string | null>(null);
const statusDialogStockCheckRequestKey = ref(0);
const lifecycleSubmitting = ref(false);
const lifecycleDialogOpen = ref(false);
const lifecycleDialogProcedure = ref<TheatreProcedure | null>(null);
const lifecycleDialogAction = ref<'cancel' | 'entered_in_error' | null>(null);
const lifecycleDialogReason = ref('');
const lifecycleDialogError = ref<string | null>(null);
const statusDialogActionOptions = computed(() => allowedStatusActionsForProcedure(statusProcedure.value));
const statusReasonRequired = computed(() => statusAction.value === 'cancelled');
const statusReasonLabel = computed(() => (statusReasonRequired.value ? 'Cancellation reason' : 'Status note'));
const statusReasonPlaceholder = computed(() => {
    if (statusReasonRequired.value) {
        return 'Required for cancelled status';
    }

    if (statusAction.value === 'in_preop') {
        return 'Optional pre-op handoff note';
    }

    if (statusAction.value === 'in_progress') {
        return 'Optional theatre start note';
    }

    if (statusAction.value === 'completed') {
        return 'Optional completion note';
    }

    return 'Optional workflow note';
});
const statusReasonHelpText = computed(() =>
    statusReasonRequired.value
        ? 'Required when cancelling so the team can understand why the case stopped.'
        : 'Optional. Use this for a short handoff or workflow note when needed.',
);
const statusDialogStockPrecheck = computed<ClinicalStockPrecheck | null>(
    () =>
        statusAction.value === 'completed'
            ? (statusProcedure.value?.stockPrecheck ?? null)
            : null,
);
const statusDialogStockPrecheckTitle = computed(() =>
    clinicalStockPrecheckTitle(statusDialogStockPrecheck.value),
);
const statusDialogStockPrecheckLines = computed(() => {
    const precheck = statusDialogStockPrecheck.value;
    if (!precheck?.blocking) return [];

    return precheck.lines.filter((line) => !line.enoughStock).slice(0, 3);
});

const detailsOpen = ref(false);
const detailsProcedure = ref<TheatreProcedure | null>(null);
const detailsTab = ref<TheatreDetailsTab>('overview');
const detailsOverviewTab = ref<'summary' | 'context' | 'resources'>('summary');
const detailsProcedureNotesLoading = ref(false);
const detailsProcedureNotesError = ref<string | null>(null);
const detailsProcedureNotes = ref<MedicalRecordSummary[]>([]);
const detailsAuditLoading = ref(false);
const detailsAuditError = ref<string | null>(null);
const detailsAuditLogs = ref<any[]>([]);
const detailsAuditExporting = ref(false);
const detailsAuditMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
const detailsAuditFiltersOpen = ref(false);
const detailsAuditExpandedRows = ref<Record<string, boolean>>({});
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

const detailsResourceLoading = ref(false);
const detailsResourceError = ref<string | null>(null);
const detailsResourceItems = ref<any[]>([]);
const detailsResourceMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
const detailsResourceCounts = ref({ scheduled: 0, in_use: 0, released: 0, cancelled: 0, other: 0, total: 0 });
const detailsResourceFilters = reactive({
    q: '',
    resourceType: '',
    status: '',
    page: 1,
    perPage: 10,
});
const resourceCreateForm = reactive({
    resourceType: 'room',
    resourceReference: '',
    roleLabel: '',
    plannedStartAt: defaultDateTimeLocal(),
    plannedEndAt: defaultDateTimeLocal(),
    notes: '',
});
const resourceCreateErrors = ref<Record<string, string[]>>({});
const resourceCreateSubmitting = ref(false);
const resourceStatusDialogOpen = ref(false);
const resourceStatusSubmitting = ref(false);
const resourceStatusError = ref<string | null>(null);
const resourceStatusTarget = ref<any | null>(null);
const resourceStatusAction = ref<string>('in_use');
const resourceStatusReason = ref('');
const resourceStatusActualStartAt = ref(defaultDateTimeLocal());
const resourceStatusActualEndAt = ref(defaultDateTimeLocal());
const resourceAuditDialogOpen = ref(false);
const resourceAuditDialogTab = ref<'filters' | 'logs'>('logs');
const resourceAuditTarget = ref<any | null>(null);
const resourceAuditLoading = ref(false);
const resourceAuditError = ref<string | null>(null);
const resourceAuditLogs = ref<any[]>([]);
const resourceAuditMeta = ref<{ currentPage: number; lastPage: number; total: number; perPage: number } | null>(null);
const resourceAuditExporting = ref(false);
const resourceAuditFilters = reactive({
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

function queryParam(name: string): string {
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

const initialCreateRouteContext = {
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
};
const createLifecycleReplaceOrderId = ref(queryParam('reorderOfId'));
const createLifecycleAddOnOrderId = ref(queryParam('addOnToOrderId'));
const createLifecycleSourceProcedure = ref<TheatreProcedure | null>(null);
const createLifecycleSourceLoading = ref(false);
const createLifecycleSourceError = ref<string | null>(null);

const THEATRE_CREATE_DRAFT_STORAGE_KEY = 'ahs.theatre-procedures.create-draft.v1';

function theatreCreateDraftMatchesInitialContext(draft: TheatreCreateDraft): boolean {
    if (
        initialCreateRouteContext.patientId &&
        draft.patientId.trim() !== initialCreateRouteContext.patientId
    ) {
        return false;
    }

    if (
        initialCreateRouteContext.appointmentId &&
        draft.appointmentId.trim() !== initialCreateRouteContext.appointmentId
    ) {
        return false;
    }

    if (
        initialCreateRouteContext.admissionId &&
        draft.admissionId.trim() !== initialCreateRouteContext.admissionId
    ) {
        return false;
    }

    return true;
}

const THEATRE_CREATE_LEAVE_TITLE = 'Leave procedure scheduling?';
const THEATRE_CREATE_LEAVE_DESCRIPTION = 'Procedure scheduling is still in progress. Stay here to finish the case setup, or leave this page and restore the draft later on this device.';

function normalizeLookupValue(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function isForbiddenError(error: unknown): boolean {
    return Boolean((error as { status?: number } | null)?.status === 403);
}

function isLikelyTheatreServicePoint(item: ServicePointResource): boolean {
    const haystack = [
        item.code,
        item.name,
        item.servicePointType,
        item.location,
    ]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(' ')
        .toLowerCase();

    return ['theatre', 'operating', 'surgery', 'surgical', 'procedure', 'dressing'].some(
        (token) => haystack.includes(token),
    );
}

function queueCountLabel(value: number): string {
    return value > 99 ? '99+' : String(value);
}

function generateClinicalOrderSessionId(prefix: string): string {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function confirmTheatreProcedureDuplicateOrdering(): Promise<boolean> {
    const patientId = createForm.patientId.trim();
    const theatreProcedureCatalogItemId =
        createForm.theatreProcedureCatalogItemId.trim();
    const procedureType = createForm.procedureType.trim();

    if (!patientId || (!theatreProcedureCatalogItemId && !procedureType)) {
        return true;
    }

    const response = await apiRequest<DuplicateCheckResponse<TheatreProcedure>>(
        'GET',
        '/theatre-procedures/duplicate-check',
        {
            query: {
                patientId,
                appointmentId: createForm.appointmentId.trim() || null,
                admissionId: createForm.admissionId.trim() || null,
                theatreProcedureCatalogItemId:
                    theatreProcedureCatalogItemId || null,
                procedureType: procedureType || null,
            },
        },
    );

    if (!response.data.messages.length) {
        return true;
    }

    const title =
        createForm.procedureName.trim()
        || procedureType
        || 'this theatre procedure';

    return requestDuplicateConfirmation({
        title: `Duplicate advisory for ${title}`,
        description:
            'An active theatre procedure booking for this encounter already exists.',
        details: response.data.messages,
        cancelLabel: 'Review existing procedures',
        confirmLabel: 'Continue scheduling',
    });
}

const statusSelectValue = computed({
    get: () => searchForm.status || 'all',
    set: (v: string) => {
        searchForm.status = v === 'all' ? '' : v;
        searchForm.page = 1;
        loadQueue();
    },
});

const theatreWorkspaceDescription = computed(() => {
    if (theatreWorkspaceView.value === 'board') {
        return 'Monitor the theatre slate, pre-op bottlenecks, and room turnover from one board.';
    }
    if (theatreWorkspaceView.value === 'create') {
        return 'Schedule a theatre procedure while keeping the same patient and encounter context in view.';
    }

    return 'Review theatre procedures, pre-op readiness, and status transitions from one queue.';
});

const theatreToolbarStateLabel = computed(() => {
    if (searchForm.status) return formatEnumLabel(searchForm.status);
    return 'All procedures';
});

const hasCreateAppointmentContext = computed(() => createForm.appointmentId.trim() !== '');
const hasCreateAdmissionContext = computed(() => createForm.admissionId.trim() !== '');
const showClinicalHandoffBanner = computed(
    () =>
        openedFromClinicalContext.value ||
        createPatientContextLocked.value ||
        hasCreateAppointmentContext.value ||
        hasCreateAdmissionContext.value,
);
const createPatientSummary = computed<PatientSummary | null>(() => {
    const patientId = createForm.patientId.trim();
    return patientId ? patientDirectory.value[patientId] ?? null : null;
});
const activeQueuePatientSummary = computed<PatientSummary | null>(() => {
    const patientId = searchForm.patientId.trim();
    return patientId ? patientDirectory.value[patientId] ?? null : null;
});
const createContextModeLabel = computed(() => {
    if (!createForm.patientId.trim()) return 'Context required';
    if (createPatientContextLocked.value) return 'Locked handoff';
    if (hasCreateAppointmentContext.value || hasCreateAdmissionContext.value) {
        return 'Encounter linked';
    }

    return 'Standalone scheduling';
});
const createContextModeVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    if (!createForm.patientId.trim()) return 'outline';
    if (createPatientContextLocked.value) return 'default';
    if (hasCreateAppointmentContext.value || hasCreateAdmissionContext.value) {
        return 'secondary';
    }

    return 'outline';
});
const createContextSummary = computed(() => {
    if (!createForm.patientId.trim()) {
        return 'Select the patient first, then confirm the appointment or admission link when theatre work comes from an active encounter.';
    }

    const linkedContexts: string[] = [];
    if (hasCreateAppointmentContext.value) linkedContexts.push('Appointment linked');
    if (hasCreateAdmissionContext.value) linkedContexts.push('Admission linked');

    return linkedContexts.length > 0
        ? `Schedule theatre work for the selected patient. ${linkedContexts.join(' · ')}.`
        : 'Schedule theatre work for the selected patient. Add the appointment or admission link when this case is tied to an active encounter.';
});
const createContextActionLabel = computed(() => {
    if (createContextEditorOpen.value) return 'Hide context';
    if (!createForm.patientId.trim()) return 'Set context';
    if (
        createPatientContextLocked.value ||
        hasCreateAppointmentContext.value ||
        hasCreateAdmissionContext.value
    ) {
        return 'Review context';
    }

    return 'Update context';
});

const createPatientContextLabel = computed(() => {
    const patientId = createForm.patientId.trim();
    if (!patientId) return 'No patient selected';

    const patient = patientDirectory.value[patientId];
    if (!patient) return `Patient ${patientId}`;

    return (
        [patient.firstName, patient.middleName, patient.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        patient.patientNumber ||
        `Patient ${patient.id}`
    );
});

function patientName(summary: PatientSummary): string {
    return (
        [summary.firstName, summary.middleName, summary.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        summary.patientNumber ||
        `Patient ${summary.id}`
    );
}

const createPatientContextMeta = computed(() => {
    const patientId = createForm.patientId.trim();
    if (!patientId) return 'Search by patient number, name, phone, or national ID.';

    const patient = patientDirectory.value[patientId];
    return patient?.patientNumber?.trim()
        ? `Patient No. ${patient.patientNumber}`
        : `Patient ID ${patientId}`;
});

const createAppointmentContextLabel = computed(() => {
    if (createAppointmentSummaryLoading.value) return 'Loading appointment...';
    if (createAppointmentSummaryError.value) return 'Appointment unavailable';
    if (createAppointmentSummary.value?.appointmentNumber?.trim()) {
        return createAppointmentSummary.value.appointmentNumber.trim();
    }
    if (createForm.appointmentId.trim()) return `Appointment ${createForm.appointmentId.trim()}`;
    return 'No appointment linked';
});

const createAppointmentContextMeta = computed(() => {
    if (createAppointmentSummaryLoading.value) return 'Loading appointment handoff.';
    if (createAppointmentSummaryError.value) return createAppointmentSummaryError.value;
    if (!createAppointmentSummary.value) return 'Link a checked-in appointment when theatre scheduling starts from OPD.';

    const parts = [
        createAppointmentSummary.value.scheduledAt
            ? formatDateTime(createAppointmentSummary.value.scheduledAt)
            : null,
        createAppointmentSummary.value.department?.trim() || null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Appointment linked';
});

const createAppointmentContextReason = computed(
    () => createAppointmentSummary.value?.reason?.trim() || '',
);

const createAppointmentContextStatusLabel = computed(() => {
    const status = createAppointmentSummary.value?.status?.trim();
    return status ? formatEnumLabel(status) : '';
});

const createAdmissionContextLabel = computed(() => {
    if (createAdmissionSummaryLoading.value) return 'Loading admission...';
    if (createAdmissionSummaryError.value) return 'Admission unavailable';
    if (createAdmissionSummary.value?.admissionNumber?.trim()) {
        return createAdmissionSummary.value.admissionNumber.trim();
    }
    if (createForm.admissionId.trim()) return `Admission ${createForm.admissionId.trim()}`;
    return 'No admission linked';
});

const createAdmissionContextMeta = computed(() => {
    if (createAdmissionSummaryLoading.value) return 'Loading admission handoff.';
    if (createAdmissionSummaryError.value) return createAdmissionSummaryError.value;
    if (!createAdmissionSummary.value) return 'Link an active admission for inpatient theatre cases.';

    const location = [
        createAdmissionSummary.value.ward?.trim() || null,
        createAdmissionSummary.value.bed?.trim()
            ? `Bed ${createAdmissionSummary.value.bed?.trim()}`
            : null,
    ]
        .filter(Boolean)
        .join(' · ');

    const parts = [
        location || null,
        createAdmissionSummary.value.admittedAt
            ? formatDateTime(createAdmissionSummary.value.admittedAt)
            : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Admission linked';
});

const createAdmissionContextReason = computed(
    () => createAdmissionSummary.value?.statusReason?.trim() || '',
);

const createAdmissionContextStatusLabel = computed(() => {
    const status = createAdmissionSummary.value?.status?.trim();
    return status ? formatEnumLabel(status) : '';
});

const createAppointmentContextSourceLabel = computed(() => {
    if (createAppointmentLinkSource.value === 'route') return 'Route context';
    if (createAppointmentLinkSource.value === 'auto') return 'Auto-linked';
    if (createAppointmentLinkSource.value === 'manual') return 'Selected';
    return '';
});

const createAdmissionContextSourceLabel = computed(() => {
    if (createAdmissionLinkSource.value === 'route') return 'Route context';
    if (createAdmissionLinkSource.value === 'auto') return 'Auto-linked';
    if (createAdmissionLinkSource.value === 'manual') return 'Selected';
    return '';
});

const createContextEditorDescription = computed(() => {
    switch (createContextEditorTab.value) {
        case 'appointment':
            return 'Search checked-in appointments for the selected patient.';
        case 'admission':
            return 'Search active admissions for the selected patient.';
        case 'patient':
        default:
            return createPatientContextLocked.value
                ? 'Patient is locked from the carried-forward clinical handoff. Use Change Patient to unlock.'
                : 'Search by patient number, name, phone, or national ID.';
    }
});

const openedFromPatientChart = queryParam('from') === 'patient-chart';
const patientChartQueueRouteContext = Object.freeze({
    patientId: initialCreateRouteContext.patientId.trim(),
    appointmentId: initialCreateRouteContext.appointmentId.trim(),
    admissionId: initialCreateRouteContext.admissionId.trim(),
});
const patientChartQueueFocusLocked = ref(
    openedFromPatientChart && patientChartQueueRouteContext.patientId !== '',
);
const createPatientChartHref = computed(() =>
    patientChartHref(createForm.patientId.trim(), {
        tab: 'orders',
        appointmentId: createForm.appointmentId.trim() || null,
        admissionId: createForm.admissionId.trim() || null,
    }),
);
const patientChartQueueReturnHref = computed(() => {
    if (!openedFromPatientChart || !patientChartQueueRouteContext.patientId) {
        return null;
    }

    return patientChartHref(patientChartQueueRouteContext.patientId, {
        tab: 'orders',
        appointmentId: patientChartQueueRouteContext.appointmentId || null,
        admissionId: patientChartQueueRouteContext.admissionId || null,
    });
});
const isPatientChartQueueFocusApplied = computed(() =>
    patientChartQueueFocusLocked.value &&
    patientChartQueueRouteContext.patientId !== '' &&
    searchForm.patientId.trim() === patientChartQueueRouteContext.patientId,
);

function contextCreateHref(path: string, options?: { includeTabNew?: boolean }) {
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
    if (openedFromPatientChart) params.set('from', 'patient-chart');

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

const hasCreateMedicalRecordContext = computed(() => queryParam('recordId') !== '');

const consultationContextHref = computed(() =>
    contextCreateHref('/medical-records', {
        includeTabNew: true,
    }),
);

const consultationReturnLabel = computed(() =>
    hasCreateMedicalRecordContext.value
        ? 'Back to Current Consultation'
        : 'Back to Consultation',
);
const showTheatreRelatedWorkflowFooter = computed(
    () => theatreWorkspaceView.value === 'queue' && createForm.patientId.trim() !== '',
);

function appointmentContextHref(appointmentId: string | null | undefined) {
    const params = new URLSearchParams();
    const resolvedAppointmentId = String(appointmentId ?? '').trim();
    const patientId = createForm.patientId.trim();

    if (resolvedAppointmentId) {
        params.set('focusAppointmentId', resolvedAppointmentId);
    } else if (patientId) {
        params.set('patientId', patientId);
    }

    if (openedFromPatientChart) params.set('from', 'patient-chart');

    const queryString = params.toString();
    return queryString ? `/appointments?${queryString}` : '/appointments';
}

function procedureWorkflowHref(
    path: string,
    procedure: TheatreProcedure,
    options?: {
        includeTabNew?: boolean;
        focusAppointmentOnReturn?: boolean;
        reorderOfId?: string | null;
        addOnToOrderId?: string | null;
    },
) {
    const params = new URLSearchParams();
    const recordId = queryParam('recordId');

    if (path === '/medical-records' && options?.includeTabNew) {
        params.set('tab', 'new');
    } else if (path === '/medical-records' && recordId) {
        params.set('recordId', recordId);
    } else if (options?.includeTabNew) {
        params.set('tab', 'new');
    }

    const patientId = String(procedure?.patientId ?? '').trim();
    const appointmentId = String(procedure?.appointmentId ?? '').trim();
    const admissionId = String(procedure?.admissionId ?? '').trim();

    if (patientId) params.set('patientId', patientId);
    if (admissionId) params.set('admissionId', admissionId);
    if (path === '/medical-records') {
        params.set('createRecordType', 'procedure_note');
        params.set('theatreProcedureId', procedure.id);
        params.set('from', 'theatre-procedures');
    }

    if (options?.focusAppointmentOnReturn) {
        if (appointmentId) params.set('focusAppointmentId', appointmentId);
    } else if (appointmentId) {
        params.set('appointmentId', appointmentId);
    }

    if (options?.reorderOfId?.trim()) {
        params.set('reorderOfId', options.reorderOfId.trim());
    }
    if (options?.addOnToOrderId?.trim()) {
        params.set('addOnToOrderId', options.addOnToOrderId.trim());
    }
    if (path === '/billing-invoices') {
        params.set('sourceWorkflowKind', 'theatre_procedure');
        params.set('sourceWorkflowId', procedure.id);
        const label =
            procedure.procedureNumber?.trim()
            || procedure.procedureName?.trim()
            || procedure.procedureType?.trim()
            || 'Theatre procedure';
        params.set('sourceWorkflowLabel', label);
    }

    if (recordId && path !== '/medical-records') params.set('recordId', recordId);
    if (openedFromPatientChart) params.set('from', 'patient-chart');

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

function procedureMedicalRecordHref(
    procedure: TheatreProcedure,
    options?: {
        tab?: 'new' | 'list';
        recordId?: string | null;
        editRecordId?: string | null;
    },
) {
    const params = new URLSearchParams();
    const patientId = String(procedure?.patientId ?? '').trim();
    const appointmentId = String(procedure?.appointmentId ?? '').trim();
    const admissionId = String(procedure?.admissionId ?? '').trim();

    params.set('tab', options?.tab ?? (options?.editRecordId ? 'new' : 'list'));
    if (patientId) params.set('patientId', patientId);
    if (appointmentId) params.set('appointmentId', appointmentId);
    if (admissionId) params.set('admissionId', admissionId);
    params.set('theatreProcedureId', procedure.id);
    params.set('recordType', 'procedure_note');
    params.set('from', 'theatre-procedures');

    if ((options?.tab ?? (options?.editRecordId ? 'new' : 'list')) === 'new') {
        params.set('createRecordType', 'procedure_note');
    }

    if (options?.recordId?.trim()) {
        params.set('recordId', options.recordId.trim());
    }

    if (options?.editRecordId?.trim()) {
        params.set('editRecordId', options.editRecordId.trim());
    }

    return `/medical-records?${params.toString()}`;
}

function procedureMedicalRecordCreateHref(procedure: TheatreProcedure): string {
    return procedureMedicalRecordHref(procedure, { tab: 'new' });
}

function procedureMedicalRecordEditHref(
    procedure: TheatreProcedure,
    record: MedicalRecordSummary,
): string {
    return procedureMedicalRecordHref(procedure, {
        tab: 'new',
        editRecordId: record.id,
    });
}

function procedureMedicalRecordDetailsHref(
    procedure: TheatreProcedure,
    record: MedicalRecordSummary,
): string {
    return procedureMedicalRecordHref(procedure, {
        tab: 'list',
        recordId: record.id,
    });
}

function procedureMedicalRecordHistoryHref(procedure: TheatreProcedure): string {
    return procedureMedicalRecordHref(procedure, { tab: 'list' });
}

function normalizeMedicalRecordSummaryStatus(
    value: string | null | undefined,
): string {
    return String(value ?? '').trim().toLowerCase();
}

function isDocumentedMedicalRecordSummary(record: MedicalRecordSummary): boolean {
    const status = normalizeMedicalRecordSummaryStatus(record.status);

    return status === 'finalized' || status === 'amended';
}

function medicalRecordSummaryEncounterTimestamp(
    record: MedicalRecordSummary,
): number {
    const timestamp = Date.parse(String(record.encounterAt ?? '').trim());

    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortMedicalRecordSummariesByEncounterDesc(
    records: MedicalRecordSummary[],
): MedicalRecordSummary[] {
    return [...records].sort(
        (left, right) =>
            medicalRecordSummaryEncounterTimestamp(right)
            - medicalRecordSummaryEncounterTimestamp(left),
    );
}

function theatreStaffPrimaryLabel(profile: StaffProfile): string {
    const userName = String(profile.userName ?? '').trim();
    if (userName) return userName;

    const employeeNumber = String(profile.employeeNumber ?? '').trim();
    if (employeeNumber) return employeeNumber;

    return profile.userId !== null ? `User #${profile.userId}` : 'Unassigned';
}

function theatreStaffDisplayLabel(userId: string | number | null | undefined): string {
    const resolvedId =
        typeof userId === 'number'
            ? userId
            : Number.parseInt(String(userId ?? '').trim(), 10);
    if (!Number.isFinite(resolvedId)) return 'Unassigned';

    const profile =
        theatreClinicians.value.find((item) => item.userId === resolvedId) ?? null;
    if (!profile) return `User #${resolvedId}`;

    const primaryLabel = theatreStaffPrimaryLabel(profile);
    const jobTitle = (profile.jobTitle ?? '').trim();
    const label = [primaryLabel, jobTitle]
        .filter(Boolean)
        .join(' - ');

    return label || primaryLabel;
}

const selectedCreateTheatreProcedureCatalogItem = computed<ClinicalCatalogItem | null>(
    () => {
        const catalogItemId = createForm.theatreProcedureCatalogItemId.trim();
        if (!catalogItemId) return null;

        return (
            theatreProcedureCatalogItems.value.find(
                (item) => item.id === catalogItemId,
            ) ?? null
        );
    },
);

const createTheatreProcedureCatalogOptions = computed<SearchableSelectOption[]>(() =>
    theatreProcedureCatalogItems.value.map((item) => {
        const code = item.code?.trim() ?? '';
        const name = item.name?.trim() || code || 'Procedure';
        const categoryLabel = item.category?.trim()
            ? formatEnumLabel(item.category)
            : 'Governed procedure';

        return {
            value: item.id,
            label: name,
            description: [code, categoryLabel].filter(Boolean).join(' | ') || null,
            keywords: [
                code,
                name,
                item.category?.trim() ?? '',
                categoryLabel,
                item.description?.trim() ?? '',
            ].filter(Boolean),
            group: categoryLabel,
        };
    }),
);

const theatreProcedureCatalogAvailable = computed(
    () => createTheatreProcedureCatalogOptions.value.length > 0,
);

const usesCatalogBackedProcedurePicker = computed(
    () =>
        canReadTheatreProcedureCatalog.value &&
        !theatreProcedureCatalogLoading.value &&
        !theatreProcedureCatalogError.value &&
        theatreProcedureCatalogAvailable.value,
);

const createTheatreProcedureCatalogHelperText = computed(() => {
    if (theatreProcedureCatalogLoading.value) {
        return 'Loading active governed procedures...';
    }
    if (!canReadTheatreProcedureCatalog.value) {
        return 'Theatre procedure selection is catalog-governed. Enter the procedure code manually if catalog access is unavailable.';
    }
    if (theatreProcedureCatalogError.value) {
        return theatreProcedureCatalogError.value;
    }
    if (theatreProcedureCatalogAvailable.value) {
        return 'Select the governed procedure to fill the code and name automatically.';
    }

    return 'No active governed procedures are available yet. Enter the procedure code manually.';
});

const createTheatreProcedurePickerError = computed(
    () =>
        createFieldError('theatreProcedureCatalogItemId') ??
        createFieldError('procedureType'),
);

const createTheatreRoomOptions = computed<SearchableSelectOption[]>(() => {
    return theatreRoomServicePoints.value
        .filter((item) => isLikelyTheatreServicePoint(item))
        .map((item) => {
            const label =
                (item.name ?? '').trim() ||
                (item.code ?? '').trim() ||
                'Theatre room';
            const value = String(item.id ?? '').trim();
            const typeLabel = (item.servicePointType ?? '').trim();
            const location = (item.location ?? '').trim();
            const code = (item.code ?? '').trim();

            return {
                value,
                label,
                description: [code || null, typeLabel ? formatEnumLabel(typeLabel) : null, location || null]
                    .filter(Boolean)
                    .join(' | '),
                keywords: [
                    item.code ?? '',
                    item.name ?? '',
                    item.servicePointType ?? '',
                    item.location ?? '',
                ].filter(Boolean),
                group: typeLabel ? formatEnumLabel(typeLabel) : 'Registry',
            };
        });
});

const theatreRoomRegistryAvailable = computed(
    () => createTheatreRoomOptions.value.length > 0,
);
const createManualTheatreRoomOptions = computed<SearchableSelectOption[]>(() => {
    const registryLabelOptions = theatreRoomServicePoints.value
        .filter((item) => isLikelyTheatreServicePoint(item))
        .map((item) => {
            const label =
                (item.name ?? '').trim() ||
                (item.code ?? '').trim() ||
                'Theatre room';
            const typeLabel = (item.servicePointType ?? '').trim();
            const location = (item.location ?? '').trim();

            return {
                value: label,
                label,
                description: [
                    typeLabel ? formatEnumLabel(typeLabel) : null,
                    location || null,
                ].filter(Boolean).join(' | '),
                keywords: [
                    item.code ?? '',
                    item.name ?? '',
                    item.servicePointType ?? '',
                    item.location ?? '',
                ].filter(Boolean),
                group: typeLabel ? formatEnumLabel(typeLabel) : 'Registry',
            };
        });

    const currentRoomOptions = Array.from(
        new Set(
            procedures.value
                .map((item) => String(item?.theatreRoomName ?? '').trim())
                .filter(Boolean),
        ),
    ).map((room) => ({
        value: room,
        label: room,
        description: 'Current theatre slate room',
        keywords: [room],
        group: 'Current slate',
    }));

    return mergeSearchableOptions(registryLabelOptions, currentRoomOptions);
});
const createTheatreRoomFieldError = computed(
    () => createFieldError('theatreRoomServicePointId') ?? createFieldError('theatreRoomName'),
);
watch(
    () => [createForm.theatreRoomServicePointId, theatreRoomServicePoints.value] as const,
    ([value]) => {
        const servicePointId = value.trim();
        if (!servicePointId) {
            return;
        }

        const matchedRoom = theatreRoomServicePoints.value.find(
            (item) => String(item.id ?? '').trim() === servicePointId,
        );
        if (!matchedRoom) {
            return;
        }

        createForm.theatreRoomName =
            String(matchedRoom.name ?? '').trim() ||
            String(matchedRoom.code ?? '').trim() ||
            createForm.theatreRoomName;
    },
);

const createTheatreRoomHelperText = computed(() => {
    if (theatreRoomRegistryLoading.value) {
        return 'Loading theatre room options.';
    }
    if (!canReadTheatreRoomRegistry.value) {
        return 'Select from known theatre rooms when available, or type the room manually.';
    }
    if (theatreRoomRegistryError.value) {
        return `${theatreRoomRegistryError.value} You can still type the room manually.`;
    }
    if (theatreRoomRegistryAvailable.value) {
        return 'Choose an active theatre room from the registry.';
    }

    return 'No theatre rooms were found in the active registry yet. Type the room manually.';
});

const createTheatreClinicianBaseOptions = computed<SearchableSelectOption[]>(() =>
    mergeSearchableOptions(
        theatreClinicians.value
            .filter(
                (profile) =>
                    profile.userId !== null &&
                    (profile.status ?? '').trim().toLowerCase() !== 'inactive',
            )
            .map((profile) => {
                const primaryLabel = theatreStaffPrimaryLabel(profile);
                const employeeNumber = (profile.employeeNumber ?? '').trim();
                const jobTitle = (profile.jobTitle ?? '').trim();
                const department = (profile.department ?? '').trim();
                const description = [employeeNumber || null, jobTitle || null, department || null]
                    .filter(Boolean)
                    .join(' | ');

                return {
                    value: String(profile.userId),
                    label: primaryLabel,
                    description: description || null,
                    keywords: [
                        primaryLabel,
                        employeeNumber,
                        jobTitle,
                        department,
                        String(profile.userId),
                    ].filter(Boolean),
                    group: department || 'Staff',
                };
            }),
    ),
);

const createTheatreClinicianOptions = computed<SearchableSelectOption[]>(
    () => createTheatreClinicianBaseOptions.value,
);

const createTheatreAnesthetistOptions = computed<SearchableSelectOption[]>(() => {
    const filtered = createTheatreClinicianBaseOptions.value.filter((option) => {
        const haystack = [
            option.label,
            option.description ?? '',
            ...(option.keywords ?? []),
        ]
            .join(' ')
            .toLowerCase();

        return haystack.includes('anesth') || haystack.includes('anaesth');
    });

    return filtered.length > 0
        ? mergeSearchableOptions(filtered)
        : createTheatreClinicianBaseOptions.value;
});

const hasPendingCreateWorkflow = computed(() => Boolean(
    createForm.theatreProcedureCatalogItemId.trim()
    || createForm.procedureType.trim()
    || createForm.procedureName.trim()
    || createForm.operatingClinicianUserId.trim()
    || createForm.anesthetistUserId.trim()
    || createForm.theatreRoomServicePointId.trim()
    || createForm.theatreRoomName.trim()
    || createForm.notes.trim()
    || (
        createForm.scheduledAt.trim() !== '' &&
        createForm.scheduledAt !== createScheduledAtBaseline.value
    ),
));
const {
    confirmOpen: createLeaveConfirmOpen,
    confirmLeave: confirmPendingCreateWorkflowLeave,
    cancelLeave: cancelPendingCreateWorkflowLeave,
} = usePendingWorkflowLeaveGuard({
    shouldBlock: hasPendingCreateWorkflow,
    isSubmitting: createSubmitting,
    blockBrowserUnload: false,
});
const {
    confirmationDialogState: duplicateConfirmDialogState,
    requestConfirmation: requestDuplicateConfirmation,
    updateConfirmationDialogOpen: updateDuplicateConfirmationDialogOpen,
    confirmDialogAction: confirmDuplicateDialogAction,
} = useConfirmationDialog();
const {
    clearPersistedDraft: clearPersistedTheatreCreateDraft,
} = useWorkflowDraftPersistence<TheatreCreateDraft>({
    key: THEATRE_CREATE_DRAFT_STORAGE_KEY,
    shouldPersist: hasPendingCreateWorkflow,
    capture: () => ({
        patientId: createForm.patientId,
        admissionId: createForm.admissionId,
        appointmentId: createForm.appointmentId,
        serviceRequestId: createForm.serviceRequestId,
        serverDraftId: createServerDraftId.value,
        theatreProcedureCatalogItemId: createForm.theatreProcedureCatalogItemId,
        procedureType: createForm.procedureType,
        procedureName: createForm.procedureName,
        operatingClinicianUserId: createForm.operatingClinicianUserId,
        anesthetistUserId: createForm.anesthetistUserId,
        theatreRoomServicePointId: createForm.theatreRoomServicePointId,
        theatreRoomName: createForm.theatreRoomName,
        scheduledAt: createForm.scheduledAt,
        notes: createForm.notes,
    }),
    restore: (draft) => {
        createForm.patientId = draft.patientId;
        createForm.admissionId = draft.admissionId;
        createForm.appointmentId = draft.appointmentId;
        createForm.serviceRequestId = draft.serviceRequestId ?? '';
        createServerDraftId.value = draft.serverDraftId?.trim?.() ?? '';
        createForm.theatreProcedureCatalogItemId = draft.theatreProcedureCatalogItemId;
        createForm.procedureType = draft.procedureType;
        createForm.procedureName = draft.procedureName;
        createForm.operatingClinicianUserId = draft.operatingClinicianUserId;
        createForm.anesthetistUserId = draft.anesthetistUserId;
        createForm.theatreRoomServicePointId = draft.theatreRoomServicePointId;
        createForm.theatreRoomName = draft.theatreRoomName;
        createForm.scheduledAt = draft.scheduledAt;
        createForm.notes = draft.notes;
    },
    canRestore: theatreCreateDraftMatchesInitialContext,
    onRestored: () => {
        createDraftNotice.value = createServerDraftId.value
            ? 'Restored your saved procedure draft on this device.'
            : 'Restored your in-progress procedure draft on this device.';
        theatreWorkspaceView.value = 'create';
    },
});

const theatreClinicianDirectoryAvailable = computed(
    () => createTheatreClinicianOptions.value.length > 0,
);
const createLifecycleSourceProcedureId = computed(() =>
    createLifecycleReplaceOrderId.value.trim() ||
    createLifecycleAddOnOrderId.value.trim(),
);
const createLifecycleMode = computed<'reorder' | 'add_on' | null>(() => {
    if (createLifecycleReplaceOrderId.value.trim()) {
        return 'reorder';
    }

    if (createLifecycleAddOnOrderId.value.trim()) {
        return 'add_on';
    }

    return null;
});
const hasCreateLifecycleMode = computed(
    () => createLifecycleMode.value !== null,
);
const hasSavedCreateDraft = computed(
    () => createServerDraftId.value.trim() !== '',
);
const showSaveCreateDraftAction = computed(
    () => hasSavedCreateDraft.value || hasPendingCreateWorkflow.value,
);

function formatCreateLifecycleSourceProcedureLabel(
    procedure: TheatreProcedure | null,
): string {
    if (!procedure) return 'the selected procedure';

    const procedureNumber = procedure.procedureNumber?.trim();
    const procedureLabel =
        procedure.procedureName?.trim() || procedure.procedureType?.trim();

    if (procedureNumber && procedureLabel) {
        return `${procedureNumber} (${procedureLabel})`;
    }

    return procedureNumber || procedureLabel || 'the selected procedure';
}

const createLifecycleSourceProcedureLabel = computed(() =>
    formatCreateLifecycleSourceProcedureLabel(createLifecycleSourceProcedure.value),
);
const createLifecycleAlertTitle = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return 'Replacement procedure scheduling in progress';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Linked procedure follow-up in progress';
    }

    return 'Procedure follow-up in progress';
});
const createLifecycleAlertDescription = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return `This new procedure booking will replace ${createLifecycleSourceProcedureLabel.value}. The original procedure remains in the chart history for audit.`;
    }

    if (createLifecycleMode.value === 'add_on') {
        return `This new procedure booking will be recorded as a linked follow-up to ${createLifecycleSourceProcedureLabel.value}.`;
    }

    return '';
});
const createLifecycleClearActionLabel = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return 'Start a new procedure booking';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Start a new independent procedure';
    }

    return 'Clear follow-up mode';
});
const createSubmitLabel = computed(() => {
    if (createSubmitting.value) {
        return hasSavedCreateDraft.value
            ? 'Signing...'
            : 'Preparing signature...';
    }

    if (createLifecycleMode.value === 'reorder') {
        return 'Sign and schedule replacement procedure';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Sign and schedule linked follow-up procedure';
    }

    return 'Sign and schedule procedure';
});

const saveCreateDraftLabel = computed(() =>
    createSubmitting.value
        ? 'Saving draft...'
        : hasSavedCreateDraft.value
          ? 'Update saved draft'
          : 'Save draft',
);

const createOperatingClinicianHelperText = computed(() => {
    if (theatreCliniciansLoading.value) {
        return 'Loading clinician directory.';
    }
    if (!canReadTheatreClinicianDirectory.value) {
        return 'Enter the operating clinician user ID manually.';
    }
    if (theatreCliniciansError.value) {
        return theatreCliniciansError.value;
    }
    if (theatreClinicianDirectoryAvailable.value) {
        return 'Select the operating clinician.';
    }

    return 'No clinician profiles found. Enter the user ID manually.';
});

const createAnesthetistHelperText = computed(() => {
    if (theatreCliniciansLoading.value) {
        return 'Loading anaesthesia staff.';
    }
    if (!canReadTheatreClinicianDirectory.value) {
        return 'Enter the anesthetist user ID manually if needed.';
    }
    if (theatreCliniciansError.value) {
        return theatreCliniciansError.value;
    }
    if (createTheatreAnesthetistOptions.value.length > 0) {
        return 'Select the anesthetist when assigned.';
    }

    return 'No anaesthesia staff found. Enter the user ID manually if needed.';
});
const createScheduledAtHelperText = computed(
    () => 'Choose the planned theatre start time.',
);

const theatreBoardSummary = computed(() => {
    const activeRooms = new Set(
        procedures.value
            .map((item) => String(item?.theatreRoomName ?? '').trim())
            .filter(Boolean),
    ).size;

    const preopCount = procedures.value.filter((item) => item?.status === 'in_preop').length;
    const inProgressCount = procedures.value.filter((item) => item?.status === 'in_progress').length;
    const bottleneckCount = procedures.value.filter((item) => {
        const status = String(item?.status ?? '').trim();
        const room = String(item?.theatreRoomName ?? '').trim();
        const operatingClinician = String(item?.operatingClinicianUserId ?? '').trim();
        const anesthetist = String(item?.anesthetistUserId ?? '').trim();
        const scheduledAt = parseDateValue(item?.scheduledAt);
        const isOverdue =
            !!scheduledAt &&
            scheduledAt.getTime() < Date.now() &&
            ['planned', 'in_preop'].includes(status);

        return (
            (!room && ['planned', 'in_preop'].includes(status)) ||
            (!operatingClinician && ['planned', 'in_preop', 'in_progress'].includes(status)) ||
            (status === 'in_preop' && !anesthetist) ||
            isOverdue
        );
    }).length;

    return {
        activeRooms,
        preopCount,
        inProgressCount,
        bottleneckCount,
    };
});

const theatreSlateRooms = computed(() => {
    const grouped = new Map<
        string,
        {
            room: string;
            items: any[];
        }
    >();

    procedures.value
        .slice()
        .sort((left, right) => {
            const leftTime = parseDateValue(left?.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            const rightTime = parseDateValue(right?.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            return leftTime - rightTime;
        })
        .forEach((item) => {
            const room = String(item?.theatreRoomName ?? '').trim() || 'Unassigned room';
            if (!grouped.has(room)) {
                grouped.set(room, { room, items: [] });
            }
            grouped.get(room)?.items.push(item);
        });

    return Array.from(grouped.values()).sort((left, right) => {
        if (left.room === 'Unassigned room') return 1;
        if (right.room === 'Unassigned room') return -1;
        return left.room.localeCompare(right.room);
    });
});

const theatreBottlenecks = computed(() => {
    return procedures.value
        .flatMap((item) => {
            const issues: Array<{
                id: string;
                procedureId: string;
                procedureNumber: string;
                title: string;
                detail: string;
                severity: number;
            }> = [];

            const procedureId = String(item?.id ?? '');
            const procedureNumber = String(
                item?.procedureNumber ?? procedureId ?? 'Procedure',
            );
            const status = String(item?.status ?? '').trim();
            const room = String(item?.theatreRoomName ?? '').trim();
            const operatingClinician = String(item?.operatingClinicianUserId ?? '').trim();
            const anesthetist = String(item?.anesthetistUserId ?? '').trim();
            const scheduledAt = parseDateValue(item?.scheduledAt);
            const scheduledLabel = item?.scheduledAt ? formatDateTime(item.scheduledAt) : 'No scheduled time';

            if (!room && ['planned', 'in_preop'].includes(status)) {
                issues.push({
                    id: `${procedureId}-room`,
                    procedureId,
                    procedureNumber,
                    title: 'Room assignment missing',
                    detail: `${procedureNumber} cannot move cleanly through pre-op without a theatre room.`,
                    severity: 3,
                });
            }

            if (!operatingClinician && ['planned', 'in_preop', 'in_progress'].includes(status)) {
                issues.push({
                    id: `${procedureId}-clinician`,
                    procedureId,
                    procedureNumber,
                    title: 'Operating clinician missing',
                    detail: `${procedureNumber} has no operating clinician assigned yet.`,
                    severity: 3,
                });
            }

            if (status === 'in_preop' && !anesthetist) {
                issues.push({
                    id: `${procedureId}-anesthetist`,
                    procedureId,
                    procedureNumber,
                    title: 'Anesthetist still unassigned',
                    detail: `${procedureNumber} is in pre-op without an anesthetist handoff.`,
                    severity: 2,
                });
            }

            if (scheduledAt && scheduledAt.getTime() < Date.now() && ['planned', 'in_preop'].includes(status)) {
                issues.push({
                    id: `${procedureId}-overdue`,
                    procedureId,
                    procedureNumber,
                    title: 'Scheduled start is overdue',
                    detail: `${procedureNumber} was scheduled for ${scheduledLabel} but is still ${formatEnumLabel(status)}.`,
                    severity: 2,
                });
            }

            return issues;
        })
        .sort((left, right) => right.severity - left.severity)
        .slice(0, 8);
});

const detailsPreopReadinessChecks = computed(() => {
    if (!detailsProcedure.value) return [];

    const procedure = detailsProcedure.value;
    const hasProcedureIdentity = Boolean(
        String(procedure?.theatreProcedureCatalogItemId ?? '').trim() ||
            String(procedure?.procedureType ?? '').trim() ||
            String(procedure?.procedureName ?? '').trim(),
    );
    const hasSchedule = Boolean(String(procedure?.scheduledAt ?? '').trim());
    const hasRoom = Boolean(String(procedure?.theatreRoomName ?? '').trim());
    const hasOperatingClinician = Boolean(String(procedure?.operatingClinicianUserId ?? '').trim());
    const hasEncounterLink = Boolean(
        String(procedure?.appointmentId ?? '').trim() || String(procedure?.admissionId ?? '').trim(),
    );
    const hasResourcePlan = (detailsResourceCounts.value.total ?? 0) > 0;

    return [
        {
            id: 'patient',
            label: 'Patient linked',
            state: String(procedure?.patientId ?? '').trim() ? 'ready' : 'blocked',
            detail: String(procedure?.patientId ?? '').trim()
                ? theatrePatientDisplayLabel(procedure)
                : 'Procedure cannot proceed without a patient record.',
        },
        {
            id: 'procedure',
            label: 'Procedure captured',
            state: hasProcedureIdentity ? 'ready' : 'blocked',
            detail: hasProcedureIdentity
                ? String(procedure?.procedureName ?? '').trim() ||
                  String(procedure?.procedureType ?? '').trim() ||
                  'Governed procedure selected'
                : 'Add a catalog item, procedure type, or procedure name.',
        },
        {
            id: 'schedule',
            label: 'Schedule locked',
            state: hasSchedule ? 'ready' : 'blocked',
            detail: hasSchedule ? formatDateTime(procedure.scheduledAt) : 'Add a scheduled theatre time.',
        },
        {
            id: 'room',
            label: 'Room assigned',
            state: hasRoom ? 'ready' : 'warn',
            detail: hasRoom ? procedure.theatreRoomName : 'Assign a theatre room before pre-op completes.',
        },
        {
            id: 'clinician',
            label: 'Operating clinician',
            state: hasOperatingClinician ? 'ready' : 'blocked',
            detail: hasOperatingClinician
                ? theatreStaffDisplayLabel(procedure.operatingClinicianUserId)
                : 'Assign the operating clinician.',
        },
        {
            id: 'encounter',
            label: 'Clinical context',
            state: hasEncounterLink ? 'ready' : 'warn',
            detail: hasEncounterLink
                ? String(procedure?.admissionId ?? '').trim()
                    ? `Admission ${procedure.admissionId}`
                    : `Appointment ${procedure.appointmentId}`
                : 'Link the originating appointment or admission when available.',
        },
        {
            id: 'resources',
            label: 'Resource plan',
            state: hasResourcePlan ? 'ready' : 'warn',
            detail: hasResourcePlan
                ? `${detailsResourceCounts.value.total} theatre allocations planned`
                : 'Add room, staff, or equipment allocations.',
        },
    ];
});

const detailsPreopReadinessSummary = computed(() => {
    const blocked = detailsPreopReadinessChecks.value.filter((item) => item.state === 'blocked').length;
    const warnings = detailsPreopReadinessChecks.value.filter((item) => item.state === 'warn').length;
    if (blocked > 0) return `${blocked} blocker${blocked === 1 ? '' : 's'} to clear`;
    if (warnings > 0) return `${warnings} item${warnings === 1 ? '' : 's'} to confirm`;
    return 'Ready to move through pre-op';
});

const detailsWorkflowTimeline = computed(() => {
    if (!detailsProcedure.value) return [];

    const procedure = detailsProcedure.value;
    const status = String(procedure?.status ?? '').trim();
    const inPreopReached = ['in_preop', 'in_progress', 'completed'].includes(status);
    const startedAt = procedure?.startedAt ? formatDateTime(procedure.startedAt) : '';
    const completedAt = procedure?.completedAt ? formatDateTime(procedure.completedAt) : '';

    return [
        {
            id: 'scheduled',
            label: 'Scheduled',
            detail: procedure?.scheduledAt
                ? `Case scheduled for ${formatDateTime(procedure.scheduledAt)}`
                : 'Schedule time still missing.',
            timestamp: procedure?.scheduledAt ? formatDateTime(procedure.scheduledAt) : '',
            state: procedure?.scheduledAt ? 'complete' : 'blocked',
        },
        {
            id: 'preop',
            label: 'Pre-op',
            detail: inPreopReached
                ? 'Case is in pre-op flow or already progressed to theatre.'
                : 'Pre-op handoff is still pending.',
            timestamp: inPreopReached ? 'Ready for theatre handoff' : '',
            state: inPreopReached ? 'complete' : status === 'planned' ? 'current' : 'pending',
        },
        {
            id: 'in-progress',
            label: 'In theatre',
            detail: startedAt
                ? `Procedure started at ${startedAt}.`
                : 'Procedure has not started yet.',
            timestamp: startedAt,
            state: startedAt ? 'complete' : status === 'in_progress' ? 'current' : 'pending',
        },
        {
            id: 'completed',
            label: status === 'cancelled' ? 'Cancelled' : 'Completed',
            detail:
                status === 'cancelled'
                    ? String(procedure?.statusReason ?? '').trim() || 'Procedure cancelled before completion.'
                    : completedAt
                      ? `Procedure completed at ${completedAt}.`
                      : 'Procedure completion is still pending.',
            timestamp: status === 'cancelled' ? '' : completedAt,
            state:
                status === 'cancelled'
                    ? 'blocked'
                    : completedAt
                      ? 'complete'
                      : 'pending',
        },
    ];
});

const detailsProcedureNoteContinuityVisible = computed(
    () =>
        Boolean(detailsProcedure.value?.patientId)
        && (
            canReadMedicalRecords.value
            || canCreateMedicalRecords.value
        ),
);

const detailsProcedureNoteSummary = computed<ProcedureNoteContinuitySummary | null>(() => {
    const procedure = detailsProcedure.value;
    if (!procedure?.patientId || !detailsProcedureNoteContinuityVisible.value) {
        return null;
    }

    const historyHref = canReadMedicalRecords.value
        ? procedureMedicalRecordHistoryHref(procedure)
        : null;

    if (!canReadMedicalRecords.value) {
        return canCreateMedicalRecords.value
            ? {
                state: 'available',
                badgeLabel: 'Available',
                badgeVariant: 'outline',
                title: 'Procedure note can be started from this case',
                description: 'Open the procedure-linked note workspace directly from theatre when operative documentation is ready.',
                guidance: 'Keep one primary procedure note linked to the theatre case, then use review and amendment controls only when a correction is clinically necessary.',
                noteCount: 0,
                latestRecord: null,
                latestRecordedAtLabel: null,
                primaryActionLabel: 'Start procedure note',
                primaryActionHref: procedureMedicalRecordCreateHref(procedure),
                secondaryActionLabel: null,
                secondaryActionHref: null,
            }
            : null;
    }

    const noteHistory = sortMedicalRecordSummariesByEncounterDesc(
        detailsProcedureNotes.value.filter(
            (record) => String(record.theatreProcedureId ?? '').trim() === procedure.id,
        ),
    );
    const latestRecord = noteHistory[0] ?? null;
    const latestDraftRecord = noteHistory.find(
        (record) => normalizeMedicalRecordSummaryStatus(record.status) === 'draft',
    ) ?? null;
    const latestDocumentedRecord = noteHistory.find((record) =>
        isDocumentedMedicalRecordSummary(record),
    ) ?? null;

    if (!latestRecord) {
        return {
            state: 'missing',
            badgeLabel: 'Missing',
            badgeVariant: 'destructive',
            title: 'Procedure note is still needed',
            description: 'This theatre case does not yet have a linked procedure note. Capture the operative or procedural narrative here so the case stays clinically traceable.',
            guidance: 'Use one theatre-linked procedure note as the main operative narrative for the case, then rely on review, amendments, and related orders instead of starting parallel notes.',
            noteCount: 0,
            latestRecord: null,
            latestRecordedAtLabel: null,
            primaryActionLabel: canCreateMedicalRecords.value ? 'Start procedure note' : historyHref ? 'Open medical records' : null,
            primaryActionHref: canCreateMedicalRecords.value
                ? procedureMedicalRecordCreateHref(procedure)
                : historyHref,
            secondaryActionLabel: historyHref && canCreateMedicalRecords.value ? 'Open note history' : null,
            secondaryActionHref: historyHref && canCreateMedicalRecords.value ? historyHref : null,
        };
    }

    const latestDraftTimestamp = latestDraftRecord
        ? medicalRecordSummaryEncounterTimestamp(latestDraftRecord)
        : -1;
    const latestDocumentedTimestamp = latestDocumentedRecord
        ? medicalRecordSummaryEncounterTimestamp(latestDocumentedRecord)
        : -1;

    if (
        latestDraftRecord
        && (
            latestDocumentedRecord === null
            || latestDraftTimestamp >= latestDocumentedTimestamp
        )
    ) {
        const draftHref = canUpdateMedicalRecords.value
            ? procedureMedicalRecordEditHref(procedure, latestDraftRecord)
            : procedureMedicalRecordDetailsHref(procedure, latestDraftRecord);

        return {
            state: 'draft',
            badgeLabel: 'Draft in progress',
            badgeVariant: 'secondary',
            title: 'Procedure note is in progress',
            description: `${latestDraftRecord.recordNumber || 'Procedure note draft'} is already linked to this case. Continue it from theatre and finalize when the operative narrative is complete.`,
            guidance: 'Keep the linked case note focused on the operative summary, immediate findings, and post-procedure plan. Use related workflow orders for downstream actions.',
            noteCount: noteHistory.length,
            latestRecord: latestDraftRecord,
            latestRecordedAtLabel: latestDraftRecord.encounterAt
                ? formatDateTime(latestDraftRecord.encounterAt)
                : null,
            primaryActionLabel: draftHref
                ? canUpdateMedicalRecords.value
                    ? 'Continue procedure note'
                    : 'Open draft note'
                : null,
            primaryActionHref: draftHref,
            secondaryActionLabel: historyHref && draftHref !== historyHref ? 'Open note history' : null,
            secondaryActionHref: historyHref && draftHref !== historyHref ? historyHref : null,
        };
    }

    const documentedRecord = latestDocumentedRecord ?? latestRecord;
    const documentedStatus = normalizeMedicalRecordSummaryStatus(documentedRecord.status);
    const documentedHref = procedureMedicalRecordDetailsHref(procedure, documentedRecord);

    return {
        state: 'documented',
        badgeLabel:
            documentedStatus === 'amended'
                ? 'Amended'
                : documentedStatus === 'archived'
                    ? 'Archived'
                    : 'Documented',
        badgeVariant:
            documentedStatus === 'amended'
                ? 'secondary'
                : documentedStatus === 'archived'
                    ? 'outline'
                    : 'default',
        title:
            documentedStatus === 'archived'
                ? 'Latest procedure note is archived'
                : 'Procedure note is documented',
        description:
            documentedStatus === 'archived'
                ? `${documentedRecord.recordNumber || 'Procedure note'} is archived in this case history. Review it before deciding whether a corrective note is clinically necessary.`
                : `${documentedRecord.recordNumber || 'Procedure note'} is already linked to this theatre case. Open it for review from the theatre workflow whenever the team needs the operative summary.`,
        guidance:
            documentedStatus === 'archived'
                ? 'Use the note history to review the archived record trail. Only create another procedure note when the prior document can no longer represent the case accurately.'
                : 'Keep later clarification in amendments or linked workflows so one clear procedure narrative remains attached to the case.',
        noteCount: noteHistory.length,
        latestRecord: documentedRecord,
        latestRecordedAtLabel: documentedRecord.encounterAt
            ? formatDateTime(documentedRecord.encounterAt)
            : null,
        primaryActionLabel: canReadMedicalRecords.value ? 'Open procedure note' : null,
        primaryActionHref: canReadMedicalRecords.value ? documentedHref : null,
        secondaryActionLabel: historyHref && documentedHref !== historyHref ? 'Open note history' : null,
        secondaryActionHref: historyHref && documentedHref !== historyHref ? historyHref : null,
    };
});

const detailsTurnoverSignal = computed(() => {
    if (!detailsProcedure.value) return null;

    const roomName = String(detailsProcedure.value?.theatreRoomName ?? '').trim();
    if (!roomName) {
        return {
            tone: 'warn',
            title: 'Room turnover unavailable',
            detail: 'Assign a theatre room to estimate turnover and the next case handoff.',
        };
    }

    const sameRoomCases = procedures.value
        .filter(
            (item) =>
                String(item?.theatreRoomName ?? '').trim() === roomName &&
                String(item?.id ?? '') !== String(detailsProcedure.value?.id ?? ''),
        )
        .sort((left, right) => {
            const leftTime = parseDateValue(left?.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            const rightTime = parseDateValue(right?.scheduledAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
            return leftTime - rightTime;
        });

    const nextCase = sameRoomCases.find((item) => {
        const nextScheduled = parseDateValue(item?.scheduledAt);
        const currentScheduled = parseDateValue(detailsProcedure.value?.scheduledAt);
        if (!nextScheduled) return false;
        if (!currentScheduled) return true;
        return nextScheduled.getTime() >= currentScheduled.getTime();
    });

    if (!nextCase) {
        return {
            tone: 'ready',
            title: 'No next case in current room scope',
            detail: `${roomName} does not have another queued procedure in the current board scope.`,
        };
    }

    const currentCompleted = parseDateValue(detailsProcedure.value?.completedAt);
    const nextScheduled = parseDateValue(nextCase?.scheduledAt);
    if (currentCompleted && nextScheduled) {
        const gapMinutes = Math.round((nextScheduled.getTime() - currentCompleted.getTime()) / 60000);
        if (gapMinutes < 0) {
            return {
                tone: 'blocked',
                title: 'Turnover window already breached',
                detail: `${nextCase.procedureNumber} was scheduled ${Math.abs(gapMinutes)} min before this case completed in ${roomName}.`,
            };
        }

        return {
            tone: gapMinutes <= 20 ? 'warn' : 'ready',
            title: `Next room case: ${nextCase.procedureNumber}`,
            detail: `${roomName} has ${gapMinutes} min before the next scheduled start at ${formatDateTime(nextCase.scheduledAt)}.`,
        };
    }

    return {
        tone: 'current',
        title: `Next room case: ${nextCase.procedureNumber}`,
        detail: `${roomName} is still active. Next case is scheduled for ${formatDateTime(nextCase.scheduledAt)}.`,
    };
});

const detailsAuditSummary = computed(() => {
    const total = detailsAuditMeta.value?.total ?? detailsAuditLogs.value.length;
    const currentView = detailsAuditLogs.value.length;
    const statusChanges = detailsAuditLogs.value.filter((log) =>
        String(log?.action ?? '').toLowerCase().includes('status'),
    ).length;
    const activeFilters = [
        detailsAuditFilters.q.trim(),
        detailsAuditFilters.action.trim(),
        detailsAuditFilters.actorType,
        detailsAuditFilters.actorId.trim(),
        detailsAuditFilters.from,
        detailsAuditFilters.to,
    ].filter(Boolean).length;

    return { total, currentView, statusChanges, activeFilters };
});

const detailsCurrentFocus = computed(() => {
    if (!detailsProcedure.value) {
        return {
            title: 'No procedure selected',
            detail: 'Open a theatre procedure to review readiness and workflow status.',
        };
    }

    const status = String(detailsProcedure.value?.status ?? '').trim();
    if (status === 'planned') {
        return {
            title: 'Complete pre-op readiness',
            detail: detailsPreopReadinessSummary.value,
        };
    }
    if (status === 'in_preop') {
        return {
            title: 'Prepare room and move to theatre',
            detail: detailsTurnoverSignal.value?.detail ?? 'Confirm pre-op handoff, room, and allocations.',
        };
    }
    if (status === 'in_progress') {
        return {
            title: 'Track active procedure and release room cleanly',
            detail: detailsTurnoverSignal.value?.detail ?? 'Monitor theatre progression and release resources on time.',
        };
    }
    if (status === 'completed') {
        return {
            title: 'Case complete',
            detail: 'Confirm turnover timing, resource release, and audit trail before closing out the case.',
        };
    }
    if (status === 'cancelled') {
        return {
            title: 'Procedure cancelled',
            detail: String(detailsProcedure.value?.statusReason ?? '').trim() || 'Cancellation reason captured.',
        };
    }

    return {
        title: 'Review theatre workflow',
        detail: 'Check readiness, workflow transitions, and allocations.',
    };
});

const detailsPrimaryStatusAction = computed(() => {
    if (!detailsProcedure.value) {
        return null;
    }

    return primaryStatusActionForProcedure(detailsProcedure.value);
});

const detailsPrimaryStatusActionLabel = computed(() => {
    if (!detailsPrimaryStatusAction.value) {
        return 'Review workflow';
    }

    return theatreStatusActionLabel(detailsPrimaryStatusAction.value);
});

function submitSearch() {
    searchForm.page = 1;
    void loadQueue();
}

function resetFilters() {
    searchForm.q = '';
    searchForm.status = '';
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : searchForm.patientId.trim();
    searchForm.page = 1;
    void loadQueue();
}

function openFullTheatreQueue() {
    patientChartQueueFocusLocked.value = false;
    searchForm.patientId = '';
    searchForm.page = 1;
    void loadQueue();
}

function refocusTheatrePatientQueue() {
    if (!patientChartQueueRouteContext.patientId) return;

    patientChartQueueFocusLocked.value = true;
    searchForm.patientId = patientChartQueueRouteContext.patientId;
    searchForm.page = 1;
    void loadQueue();
}

function prevPage() {
    if ((pagination.value?.currentPage ?? 1) <= 1) return;
    searchForm.page = (pagination.value?.currentPage ?? 2) - 1;
    void loadQueue();
}

function nextPage() {
    if (!pagination.value || pagination.value.currentPage >= pagination.value.lastPage) return;
    searchForm.page = (pagination.value?.currentPage ?? 0) + 1;
    void loadQueue();
}

function openTheatreCreateWorkspace() {
    theatreWorkspaceView.value = 'create';
    if (canReadTheatreRoomRegistry.value) {
        void loadTheatreRoomRegistry();
    }
    if (canReadTheatreClinicianDirectory.value) {
        void loadTheatreClinicians();
    }
}

function setTheatreWorkspaceView(view: TheatreWorkspaceView) {
    theatreWorkspaceView.value = view;
    if (view === 'board' && canRead.value && procedures.value.length === 0 && !queueLoading.value) {
        void loadQueue();
    }
}

function syncCreateLifecycleRouteState(): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const replaceOrderId = createLifecycleReplaceOrderId.value.trim();
    const addOnOrderId = createLifecycleAddOnOrderId.value.trim();

    if (replaceOrderId) {
        url.searchParams.set('reorderOfId', replaceOrderId);
    } else {
        url.searchParams.delete('reorderOfId');
    }

    if (addOnOrderId) {
        url.searchParams.set('addOnToOrderId', addOnOrderId);
    } else {
        url.searchParams.delete('addOnToOrderId');
    }

    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

function clearCreateLifecycleMode(): void {
    createLifecycleReplaceOrderId.value = '';
    createLifecycleAddOnOrderId.value = '';
    createLifecycleSourceProcedure.value = null;
    createLifecycleSourceError.value = null;
    createLifecycleSourceLoading.value = false;
    syncCreateLifecycleRouteState();
}

function applyCreateLifecycleSourceProcedure(
    procedure: TheatreProcedure,
): void {
    clearPersistedTheatreCreateDraft();
    createServerDraftId.value = '';
    createDraftNotice.value = null;
    createErrors.value = {};

    createForm.patientId = procedure.patientId?.trim() ?? '';
    createForm.admissionId = procedure.admissionId?.trim() ?? '';
    createForm.appointmentId = procedure.appointmentId?.trim() ?? '';
    createForm.theatreProcedureCatalogItemId =
        procedure.theatreProcedureCatalogItemId?.trim() ?? '';
    createForm.procedureType = procedure.procedureType?.trim() ?? '';
    createForm.procedureName = procedure.procedureName?.trim() ?? '';
    createForm.operatingClinicianUserId = procedure.operatingClinicianUserId
        ? String(procedure.operatingClinicianUserId)
        : '';
    createForm.anesthetistUserId = procedure.anesthetistUserId
        ? String(procedure.anesthetistUserId)
        : '';
    createForm.theatreRoomServicePointId =
        procedure.theatreRoomServicePointId?.trim() ?? '';
    createForm.theatreRoomName = procedure.theatreRoomName?.trim() ?? '';
    createForm.scheduledAt = defaultDateTimeLocal();
    createScheduledAtBaseline.value = createForm.scheduledAt;
    createForm.notes = procedure.notes?.trim() ?? '';
    createPatientContextLocked.value = Boolean(
        createForm.patientId.trim() &&
        (
            createForm.appointmentId.trim() ||
            createForm.admissionId.trim()
        ),
    );

    syncCreateTheatreProcedureCatalogSelection();
    openTheatreCreateWorkspace();
}

async function loadCreateLifecycleSourceProcedure(): Promise<void> {
    const sourceProcedureId = createLifecycleSourceProcedureId.value.trim();

    if (!sourceProcedureId) {
        createLifecycleSourceProcedure.value = null;
        createLifecycleSourceError.value = null;
        createLifecycleSourceLoading.value = false;
        return;
    }

    createLifecycleSourceLoading.value = true;
    createLifecycleSourceError.value = null;
    openTheatreCreateWorkspace();

    try {
        await Promise.all([
            loadTheatreProcedureCatalog(),
            loadTheatreRoomRegistry(),
            loadTheatreClinicians(),
        ]);

        const response = await apiRequest<{ data: TheatreProcedure }>(
            'GET',
            `/theatre-procedures/${sourceProcedureId}`,
        );
        createLifecycleSourceProcedure.value = response.data;
        applyCreateLifecycleSourceProcedure(response.data);
    } catch (error) {
        createLifecycleSourceProcedure.value = null;
        createLifecycleSourceError.value = messageFromUnknown(
            error,
            'Unable to load the source procedure for this follow-up action.',
        );
    } finally {
        createLifecycleSourceLoading.value = false;
    }
}

function defaultDateTimeLocal(): string {
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function toSqlDateTime(value: string | null | undefined): string | null {
    if (!value) return null;
    return `${value.replace('T', ' ')}:00`;
}

function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function parseDateValue(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function theatreTimelineDotClass(state: string): string {
    switch (state) {
        case 'complete':
            return 'border-primary bg-primary';
        case 'current':
            return 'border-primary bg-background ring-4 ring-primary/15';
        case 'blocked':
            return 'border-destructive bg-destructive';
        case 'warn':
            return 'border-amber-500 bg-amber-500';
        default:
            return 'border-border bg-background';
    }
}

function readinessBadgeVariant(state: string): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (state === 'blocked') return 'destructive';
    if (state === 'warn') return 'secondary';
    if (state === 'ready') return 'default';
    return 'outline';
}

function turnoverToneClasses(tone: string): string {
    switch (tone) {
        case 'blocked':
            return 'border-destructive/40 bg-destructive/5';
        case 'warn':
            return 'border-amber-500/40 bg-amber-500/5';
        case 'current':
            return 'border-primary/30 bg-primary/5';
        default:
            return 'border-emerald-500/30 bg-emerald-500/5';
    }
}

function toggleDetailsAuditRow(logId: string | number) {
    const key = String(logId);
    detailsAuditExpandedRows.value = {
        ...detailsAuditExpandedRows.value,
        [key]: !detailsAuditExpandedRows.value[key],
    };
}

function detailsAuditRowExpanded(logId: string | number): boolean {
    return Boolean(detailsAuditExpandedRows.value[String(logId)]);
}

function detailsAuditHasPayload(log: any): boolean {
    return [log?.before, log?.after, log?.metadata, log?.changes].some(
        (value) => value !== null && value !== undefined && value !== '',
    );
}

function formatAuditPayload(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'No data';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

async function hydratePatientSummary(patientId: string) {
    const normalizedId = patientId.trim();
    if (
        !normalizedId ||
        patientDirectory.value[normalizedId] ||
        pendingPatientLookupIds.has(normalizedId)
    ) {
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
        // Keep the UI resilient if patient hydration is unavailable.
    } finally {
        pendingPatientLookupIds.delete(normalizedId);
    }
}

function setCreateAppointmentLink(value: string, source: CreateContextLinkSource) {
    pendingCreateAppointmentLinkSource = source;
    createForm.appointmentId = value;
}

function setCreateAdmissionLink(value: string, source: CreateContextLinkSource) {
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

function clearCreateAppointmentLink(options?: { suppressAuto?: boolean; focusEditor?: boolean }) {
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
        createContextEditorTab.value = 'appointment';
    }
}

function clearCreateAdmissionLink(options?: { suppressAuto?: boolean; focusEditor?: boolean }) {
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
        createContextEditorTab.value = 'admission';
    }
}

function clearCreateClinicalLinks() {
    clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
    clearCreateAdmissionLink({ suppressAuto: false, focusEditor: false });
}

function unlockCreatePatientContext() {
    createPatientContextLocked.value = false;
    clearCreateClinicalLinks();
    createContextEditorTab.value = 'patient';
}

function selectSuggestedAppointment(
    appointment: AppointmentSummary,
    options?: { source?: Extract<CreateContextLinkSource, 'auto' | 'manual'>; focusEditor?: boolean },
) {
    createAppointmentSummary.value = appointment;
    createAppointmentSummaryError.value = null;
    createAppointmentSummaryLoading.value = false;
    setCreateAppointmentLink(appointment.id, options?.source ?? 'manual');

    if (options?.source === 'auto') {
        createContextAutoLinkSuppressed.appointment = false;
    }

    if (options?.focusEditor) {
        createContextEditorTab.value = 'appointment';
    }
}

function selectSuggestedAdmission(
    admission: AdmissionSummary,
    options?: { source?: Extract<CreateContextLinkSource, 'auto' | 'manual'>; focusEditor?: boolean },
) {
    createAdmissionSummary.value = admission;
    createAdmissionSummaryError.value = null;
    createAdmissionSummaryLoading.value = false;
    setCreateAdmissionLink(admission.id, options?.source ?? 'manual');

    if (options?.source === 'auto') {
        createContextAutoLinkSuppressed.admission = false;
    }

    if (options?.focusEditor) {
        createContextEditorTab.value = 'admission';
    }
}

function maybeAutoLinkCreateContextSuggestions() {
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

    createAppointmentSummaryLoading.value = true;
    createAppointmentSummaryError.value = null;
    try {
        const response = await apiRequest<AppointmentResponse>('GET', `/appointments/${normalizedId}`);
        if (requestId !== createAppointmentSummaryRequestId) return;

        createAppointmentSummary.value = response.data;
        const linkedPatientId = response.data.patientId?.trim() ?? '';
        if (linkedPatientId && !createForm.patientId.trim()) {
            createForm.patientId = linkedPatientId;
        }
        if (linkedPatientId) {
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

    createAdmissionSummaryLoading.value = true;
    createAdmissionSummaryError.value = null;
    try {
        const response = await apiRequest<AdmissionResponse>('GET', `/admissions/${normalizedId}`);
        if (requestId !== createAdmissionSummaryRequestId) return;

        createAdmissionSummary.value = response.data;
        const linkedPatientId = response.data.patientId?.trim() ?? '';
        if (linkedPatientId && !createForm.patientId.trim()) {
            createForm.patientId = linkedPatientId;
        }
        if (linkedPatientId) {
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
        apiRequest<LinkedContextListResponse<AppointmentSummary>>('GET', '/appointments', {
            query: {
                patientId: normalizedId,
                status: 'checked_in',
                perPage: 3,
                page: 1,
                sortBy: 'scheduledAt',
                sortDir: 'desc',
            },
        }),
        apiRequest<LinkedContextListResponse<AdmissionSummary>>('GET', '/admissions', {
            query: {
                patientId: normalizedId,
                status: 'admitted',
                perPage: 3,
                page: 1,
                sortBy: 'admittedAt',
                sortDir: 'desc',
            },
        }),
    ]);

    if (requestId !== createContextSuggestionsRequestId) return;

    if (appointmentsResult.status === 'fulfilled') {
        createAppointmentSuggestions.value = (appointmentsResult.value.data ?? []).filter(
            (appointment) =>
                (appointment.patientId?.trim() ?? '') === normalizedId &&
                (appointment.status?.trim().toLowerCase() ?? '') === 'checked_in',
        );
        createAppointmentSuggestionsError.value = null;
    } else {
        createAppointmentSuggestions.value = [];
        createAppointmentSuggestionsError.value = messageFromUnknown(
            appointmentsResult.reason,
            'Unable to load appointment suggestions.',
        );
    }

    if (admissionsResult.status === 'fulfilled') {
        createAdmissionSuggestions.value = (admissionsResult.value.data ?? []).filter(
            (admission) =>
                (admission.patientId?.trim() ?? '') === normalizedId &&
                (admission.status?.trim().toLowerCase() ?? '') === 'admitted',
        );
        createAdmissionSuggestionsError.value = null;
    } else {
        createAdmissionSuggestions.value = [];
        createAdmissionSuggestionsError.value = messageFromUnknown(
            admissionsResult.reason,
            'Unable to load admission suggestions.',
        );
    }

    createAppointmentSuggestionsLoading.value = false;
    createAdmissionSuggestionsLoading.value = false;
    maybeAutoLinkCreateContextSuggestions();
}

function xsrfCookieToken(): string | null {
    const cookieValue = document.cookie
        .split(';')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith('XSRF-TOKEN='))
        ?.slice('XSRF-TOKEN='.length);

    if (cookieValue) {
        return decodeURIComponent(cookieValue);
    }

    return null;
}

function csrfMetaToken(): string | null {
    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return element?.content ?? null;
}

function csrfRequestHeaders(): Record<string, string> {
    const cookieToken = xsrfCookieToken();
    if (cookieToken) {
        return { 'X-XSRF-TOKEN': cookieToken };
    }

    const metaToken = csrfMetaToken();
    if (metaToken) {
        return { 'X-CSRF-TOKEN': metaToken };
    }

    return {};
}

function setCsrfToken(token: string | null | undefined): void {
    const normalized = token?.trim() ?? '';
    if (!normalized) return;

    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    if (element) {
        element.content = normalized;
    }
}

async function refreshCsrfToken(): Promise<void> {
    const response = await fetch('/api/v1/auth/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Cache-Control': 'no-cache',
        },
    });

    const payload = (await response.json().catch(() => ({}))) as {
        token?: string | null;
    };

    if (!response.ok) {
        throw new Error(
            typeof payload.token === 'string' && payload.token.trim() !== ''
                ? payload.token
                : `Unable to refresh CSRF token (${response.status}).`,
        );
    }

    setCsrfToken(payload.token);
}

function createFieldError(name: string): string | null {
    return createErrors.value[name]?.[0] ?? null;
}

function resourceCreateFieldError(name: string): string | null {
    return resourceCreateErrors.value[name]?.[0] ?? null;
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    opts?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> },
    retryOnCsrfMismatch = true,
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);
    Object.entries(opts?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        Object.assign(headers, csrfRequestHeaders());
        body = JSON.stringify(opts?.body ?? {});
    }

    const response = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
    if (response.status === 419 && method !== 'GET' && retryOnCsrfMismatch) {
        await refreshCsrfToken();
        return apiRequest<T>(method, path, opts, false);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiError;
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

async function loadPermissions() {
    try {
        const response = await apiRequest<{ data?: Array<{ name?: string }> }>('GET', '/auth/me/permissions');
        const names = new Set((response.data ?? []).map((item) => (item.name ?? '').trim()));
        canRead.value = names.has('theatre.procedures.read');
        canCreate.value = names.has('theatre.procedures.create');
        canUpdate.value = names.has('theatre.procedures.update');
        canUpdateStatus.value = names.has('theatre.procedures.update-status');
        canViewAudit.value = names.has('theatre.procedures.view-audit-logs');
        canReadMedicalRecords.value = names.has('medical.records.read');
        canCreateMedicalRecords.value = names.has('medical.records.create');
        canUpdateMedicalRecords.value = names.has('medical.records.update');
        canReadAppointments.value = names.has('appointments.read');
        canReadAdmissions.value = names.has('admissions.read');
        canCreateLaboratoryOrders.value = names.has('laboratory.orders.create');
        canCreatePharmacyOrders.value = names.has('pharmacy.orders.create');
        canCreateRadiologyOrders.value = names.has('radiology.orders.create');
        canReadBillingInvoices.value = names.has('billing.invoices.read');
        canManageResources.value = names.has('theatre.procedures.manage-resources');
        canViewResourceAudit.value = names.has('theatre.procedures.view-resource-audit-logs');
        canReadTheatreProcedureCatalog.value = names.has('platform.clinical-catalog.read');
        canReadTheatreRoomRegistry.value = canRead.value || canCreate.value || canUpdate.value;
        canUpdateServiceRequestStatus.value = names.has('service.requests.update-status');
        canReadTheatreClinicianDirectory.value =
            canRead.value ||
            canCreate.value ||
            canUpdate.value ||
            names.has('staff.clinical-directory.read');
    } catch {
        canRead.value = false;
        canCreate.value = false;
        canUpdate.value = false;
        canUpdateStatus.value = false;
        canViewAudit.value = false;
        canReadMedicalRecords.value = false;
        canCreateMedicalRecords.value = false;
        canUpdateMedicalRecords.value = false;
        canReadAppointments.value = false;
        canReadAdmissions.value = false;
        canCreateLaboratoryOrders.value = false;
        canCreatePharmacyOrders.value = false;
        canCreateRadiologyOrders.value = false;
        canReadBillingInvoices.value = false;
        canManageResources.value = false;
        canViewResourceAudit.value = false;
        canReadTheatreProcedureCatalog.value = false;
        canReadTheatreRoomRegistry.value = false;
        canReadTheatreClinicianDirectory.value = false;
        canUpdateServiceRequestStatus.value = false;
    }
}

function syncCreateTheatreProcedureCatalogSelection() {
    const catalogItem = selectedCreateTheatreProcedureCatalogItem.value;
    if (!catalogItem) return;

    createForm.procedureType = catalogItem.code?.trim() ?? createForm.procedureType;
    createForm.procedureName = catalogItem.name?.trim() ?? createForm.procedureName;
}

async function loadTheatreProcedureCatalog(force = false) {
    if (!canReadTheatreProcedureCatalog.value) {
        theatreProcedureCatalogItems.value = [];
        theatreProcedureCatalogError.value = null;
        theatreProcedureCatalogLoading.value = false;
        return;
    }

    if (theatreProcedureCatalogLoading.value) return;
    if (!force && theatreProcedureCatalogItems.value.length > 0) return;

    theatreProcedureCatalogLoading.value = true;
    theatreProcedureCatalogError.value = null;

    try {
        const response = await apiRequest<ClinicalCatalogItemListResponse>(
            'GET',
            '/platform/admin/clinical-catalogs/theatre-procedures',
            {
                query: {
                    status: 'active',
                    sortBy: 'name',
                    sortDir: 'asc',
                    page: 1,
                    perPage: 200,
                },
            },
        );
        theatreProcedureCatalogItems.value = response.data ?? [];
    } catch (error) {
        theatreProcedureCatalogItems.value = [];
        theatreProcedureCatalogError.value = isForbiddenError(error)
            ? 'Active theatre procedures are catalog-governed. Request `platform.clinical-catalog.read` to use the picker.'
            : messageFromUnknown(
                  error,
                  'Unable to load active governed procedures.',
              );
    } finally {
        theatreProcedureCatalogLoading.value = false;
        syncCreateTheatreProcedureCatalogSelection();
    }
}

async function loadTheatreRoomRegistry(force = false) {
    if (!canReadTheatreRoomRegistry.value) {
        theatreRoomServicePoints.value = [];
        theatreRoomRegistryError.value = null;
        theatreRoomRegistryLoading.value = false;
        return;
    }

    if (theatreRoomRegistryLoading.value) return;
    if (!force && theatreRoomServicePoints.value.length > 0) return;

    theatreRoomRegistryLoading.value = true;
    theatreRoomRegistryError.value = null;

    try {
        const response = await apiRequest<ServicePointRegistryListResponse>(
            'GET',
            '/theatre-procedures/room-registry',
            {
                query: {
                    page: 1,
                    perPage: 100,
                },
            },
        );
        theatreRoomServicePoints.value = response.data ?? [];
    } catch (error) {
        theatreRoomServicePoints.value = [];
        theatreRoomRegistryError.value = messageFromUnknown(
            error,
            'Unable to load theatre room suggestions from the service-point registry.',
        );
    } finally {
        theatreRoomRegistryLoading.value = false;
    }
}

async function loadTheatreClinicians(force = false) {
    if (!canReadTheatreClinicianDirectory.value) {
        theatreClinicians.value = [];
        theatreCliniciansError.value = null;
        theatreCliniciansLoading.value = false;
        return;
    }

    if (theatreCliniciansLoading.value) return;
    if (!force && theatreClinicians.value.length > 0) return;

    theatreCliniciansLoading.value = true;
    theatreCliniciansError.value = null;

    try {
        const response = await apiRequest<StaffListResponse>('GET', '/theatre-procedures/clinician-directory', {
            query: {
                status: 'active',
                page: 1,
                perPage: 200,
            },
        });
        theatreClinicians.value = response.data ?? [];
    } catch (error) {
        theatreClinicians.value = [];
        theatreCliniciansError.value = messageFromUnknown(
            error,
            'Unable to load active staff profiles for theatre assignment.',
        );
    } finally {
        theatreCliniciansLoading.value = false;
    }
}

async function loadQueue() {
    if (!canRead.value) return;
    queueLoading.value = true;
    queueError.value = null;
    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<{ data: TheatreProcedure[]; meta: { currentPage: number; lastPage: number } }>('GET', '/theatre-procedures', {
                query: {
                    q: searchForm.q.trim() || null,
                    status: searchForm.status || null,
                    patientId: searchForm.patientId.trim() || null,
                    appointmentId: searchForm.appointmentId.trim() || null,
                    admissionId: searchForm.admissionId.trim() || null,
                    page: searchForm.page,
                    perPage: searchForm.perPage,
                },
            }),
            apiRequest<{ data: typeof counts.value }>('GET', '/theatre-procedures/status-counts', {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    appointmentId: searchForm.appointmentId.trim() || null,
                    admissionId: searchForm.admissionId.trim() || null,
                },
            }),
        ]);
        procedures.value = listResponse.data;
        pagination.value = listResponse.meta;
        counts.value = countsResponse.data;
    } catch (error) {
        queueError.value = messageFromUnknown(error, 'Unable to load theatre procedures queue.');
        procedures.value = [];
        pagination.value = null;
    } finally {
        queueLoading.value = false;
    }
}

function onTheatreWalkInAcknowledged(payload: { patientId: string; requestId: string }): void {
    if (payload.patientId) {
        createForm.patientId = payload.patientId;
        createForm.serviceRequestId = payload.requestId;
        createPatientContextLocked.value = false;
        void hydratePatientSummary(payload.patientId);
        void loadCreateContextSuggestions(payload.patientId);
    }

    theatreWorkspaceView.value = 'create';
}

async function submitCreate() {
    if (
        !canCreate.value ||
        createSubmitting.value ||
        (
            hasCreateLifecycleMode.value &&
            (
                createLifecycleSourceLoading.value ||
                createLifecycleSourceProcedure.value === null
            )
        )
    ) {
        return;
    }
    createSubmitting.value = true;
    createErrors.value = {};
    try {
        if (!(await confirmTheatreProcedureDuplicateOrdering())) {
            return;
        }

        const draft = await saveCreateDraftRequest({ silent: true });
        if (!draft?.id) {
            return;
        }

        const response = await apiRequest<{ data?: TheatreProcedure }>(
            'POST',
            `/theatre-procedures/${draft.id}/sign`,
        );

        const patientId = createForm.patientId.trim();
        const appointmentId = createForm.appointmentId.trim();
        const admissionId = createForm.admissionId.trim();

        notifySuccess('Theatre procedure signed and scheduled.');
        searchForm.patientId = patientId;
        searchForm.appointmentId = appointmentId;
        searchForm.admissionId = admissionId;
        resetCreateProcedureDraftFields();
        createServerDraftId.value = '';
        createDraftNotice.value = null;
        clearPersistedTheatreCreateDraft();
        clearCreateLifecycleMode();
        await loadQueue();
        theatreWorkspaceView.value = 'queue';
        if (response.data) {
            detailsProcedure.value = response.data;
        }
    } catch (error) {
        createErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to sign and schedule theatre procedure.'));
    } finally {
        createSubmitting.value = false;
    }
}

function buildCreateTheatreProcedurePayload(options?: {
    entryMode?: 'draft' | 'active';
}): Record<string, unknown> {
    const patientId = createForm.patientId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();
    const theatreRoomServicePointId = createForm.theatreRoomServicePointId.trim();
    const theatreRoomName = createForm.theatreRoomName.trim();

    return {
        patientId,
        admissionId: admissionId || null,
        appointmentId: appointmentId || null,
        serviceRequestId: createForm.serviceRequestId.trim() || null,
        orderSessionId: generateClinicalOrderSessionId('theatre-session'),
        replacesOrderId: createLifecycleReplaceOrderId.value || null,
        addOnToOrderId: createLifecycleAddOnOrderId.value || null,
        entryMode: options?.entryMode ?? 'active',
        theatreProcedureCatalogItemId: createForm.theatreProcedureCatalogItemId.trim() || null,
        procedureType: createForm.procedureType.trim() || null,
        procedureName: createForm.procedureName.trim() || null,
        operatingClinicianUserId: Number(createForm.operatingClinicianUserId),
        anesthetistUserId: createForm.anesthetistUserId.trim() === '' ? null : Number(createForm.anesthetistUserId),
        theatreRoomServicePointId: theatreRoomServicePointId || null,
        theatreRoomName: theatreRoomServicePointId ? null : (theatreRoomName || null),
        scheduledAt: toSqlDateTime(createForm.scheduledAt),
        notes: createForm.notes.trim() || null,
    };
}

function resetCreateProcedureDraftFields(): void {
    createForm.serviceRequestId = '';
    createForm.theatreProcedureCatalogItemId = '';
    createForm.procedureType = '';
    createForm.procedureName = '';
    createForm.operatingClinicianUserId = '';
    createForm.anesthetistUserId = '';
    createForm.theatreRoomServicePointId = '';
    createForm.theatreRoomName = '';
    createForm.notes = '';
    createForm.scheduledAt = defaultDateTimeLocal();
    createScheduledAtBaseline.value = createForm.scheduledAt;
}

async function saveCreateDraftRequest(options?: {
    silent?: boolean;
}): Promise<TheatreProcedure | null> {
    const wasSavedDraft = hasSavedCreateDraft.value;
    const response = wasSavedDraft
        ? await apiRequest<{ data?: TheatreProcedure }>(
            'PATCH',
            `/theatre-procedures/${createServerDraftId.value.trim()}`,
            {
                body: {
                    theatreProcedureCatalogItemId:
                        createForm.theatreProcedureCatalogItemId.trim() || null,
                    procedureType: createForm.procedureType.trim() || null,
                    operatingClinicianUserId: Number(createForm.operatingClinicianUserId),
                    anesthetistUserId:
                        createForm.anesthetistUserId.trim() === ''
                            ? null
                            : Number(createForm.anesthetistUserId),
                    theatreRoomServicePointId:
                        createForm.theatreRoomServicePointId.trim() || null,
                    theatreRoomName:
                        createForm.theatreRoomServicePointId.trim() !== ''
                            ? null
                            : (createForm.theatreRoomName.trim() || null),
                    scheduledAt: toSqlDateTime(createForm.scheduledAt),
                    notes: createForm.notes.trim() || null,
                },
            },
        )
        : await apiRequest<{ data?: TheatreProcedure }>('POST', '/theatre-procedures', {
            body: buildCreateTheatreProcedurePayload({ entryMode: 'draft' }),
        });

    const draft = response.data ?? null;
    createServerDraftId.value = draft?.id?.trim?.() ?? '';

    if (!options?.silent) {
        createDraftNotice.value = wasSavedDraft
            ? 'Saved your procedure draft on this device. Sign it when the booking is ready.'
            : 'Procedure draft saved on this device. Sign it when the booking is ready.';
        notifySuccess('Procedure draft saved.');
    }

    return draft;
}

async function saveCreateDraft(): Promise<void> {
    if (
        !canCreate.value ||
        createSubmitting.value ||
        (
            hasCreateLifecycleMode.value &&
            (
                createLifecycleSourceLoading.value ||
                createLifecycleSourceProcedure.value === null
            )
        )
    ) {
        return;
    }

    createSubmitting.value = true;
    createErrors.value = {};

    try {
        await saveCreateDraftRequest();
    } catch (error) {
        createErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to save theatre procedure draft.'));
    } finally {
        createSubmitting.value = false;
    }
}

async function discardSavedCreateDraft(): Promise<void> {
    if (!hasSavedCreateDraft.value || createSubmitting.value) {
        return;
    }

    createSubmitting.value = true;
    createErrors.value = {};

    try {
        await apiRequest(
            'DELETE',
            `/theatre-procedures/${createServerDraftId.value.trim()}/draft`,
        );
        createServerDraftId.value = '';
        resetCreateProcedureDraftFields();
        createDraftNotice.value = 'Discarded the saved procedure draft from this device.';
        clearPersistedTheatreCreateDraft();
        clearCreateLifecycleMode();
        notifySuccess('Procedure draft discarded.');
    } catch (error) {
        createErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to discard theatre procedure draft.'));
    } finally {
        createSubmitting.value = false;
    }
}

function allowedStatusActionsForProcedure(item: any): string[] {
    const currentStatus = String(item?.status ?? '');

    return theatreStatusTransitionMap[currentStatus] ?? [];
}

function primaryStatusActionForProcedure(item: any): string | null {
    return allowedStatusActionsForProcedure(item).find((action) => action !== 'cancelled') ?? null;
}

function secondaryStatusActionsForProcedure(item: any): string[] {
    const primaryAction = primaryStatusActionForProcedure(item);

    return allowedStatusActionsForProcedure(item).filter((action) => action !== primaryAction);
}

function theatreStatusActionLabel(status: string): string {
    if (status === 'in_preop') return 'Move to Pre-op';
    if (status === 'in_progress') return 'Start Procedure';
    if (status === 'completed') return 'Complete Procedure';
    if (status === 'cancelled') return 'Cancel Procedure';

    return formatEnumLabel(status);
}

function theatrePatientDisplayLabel(procedure: any): string {
    const patientLabel = String(procedure?.patientLabel ?? '').trim();
    if (patientLabel) {
        return patientLabel;
    }

    const patientNumber = String(procedure?.patientNumber ?? '').trim();
    if (patientNumber) {
        return patientNumber;
    }

    const patientId = String(procedure?.patientId ?? '').trim();
    return patientId || 'Patient missing';
}

function theatreProcedureEncounterLabel(procedure: any): string {
    const hasAdmission = String(procedure?.admissionId ?? '').trim() !== '';
    const hasAppointment = String(procedure?.appointmentId ?? '').trim() !== '';

    if (hasAdmission && hasAppointment) {
        return 'Admission and appointment linked';
    }
    if (hasAdmission) {
        return 'Admission-linked procedure';
    }
    if (hasAppointment) {
        return 'Appointment-linked procedure';
    }

    return 'No encounter handoff linked';
}

function isTheatreProcedureEnteredInError(
    procedure: TheatreProcedure | null,
): boolean {
    if (!procedure) return false;

    return Boolean(
        procedure.enteredInErrorAt
        || procedure.lifecycleReasonCode === 'entered_in_error',
    );
}

function canApplyTheatreLifecycleAction(
    procedure: TheatreProcedure | null,
    action: 'cancel' | 'entered_in_error',
): boolean {
    if (!procedure || !canCreate.value || isTheatreProcedureEnteredInError(procedure)) {
        return false;
    }

    if (action === 'cancel') {
        return procedure.status !== 'cancelled' && procedure.status !== 'completed';
    }

    return true;
}

function canCreateTheatreFollowOnOrder(procedure: TheatreProcedure | null): boolean {
    return Boolean(
        procedure
        && canCreate.value
        && procedure.patientId?.trim()
        && !isTheatreProcedureEnteredInError(procedure),
    );
}

function openTheatreLifecycleDialog(
    procedure: TheatreProcedure,
    action: 'cancel' | 'entered_in_error',
): void {
    lifecycleDialogProcedure.value = procedure;
    lifecycleDialogAction.value = action;
    lifecycleDialogReason.value =
        action === 'cancel' ? (procedure.statusReason ?? '') : '';
    lifecycleDialogError.value = null;
    lifecycleDialogOpen.value = true;
}

function closeTheatreLifecycleDialog(): void {
    lifecycleDialogOpen.value = false;
    lifecycleDialogProcedure.value = null;
    lifecycleDialogAction.value = null;
    lifecycleDialogReason.value = '';
    lifecycleDialogError.value = null;
}

async function submitTheatreLifecycleDialog(): Promise<void> {
    if (!lifecycleDialogProcedure.value || !lifecycleDialogAction.value) return;

    const reason = lifecycleDialogReason.value.trim();
    if (!reason) {
        lifecycleDialogError.value = 'Clinical reason is required.';
        return;
    }

    lifecycleDialogError.value = null;
    lifecycleSubmitting.value = true;

    try {
        const response = await apiRequest<{ data: TheatreProcedure }>(
            'POST',
            `/theatre-procedures/${lifecycleDialogProcedure.value.id}/lifecycle`,
            {
                body: {
                    action: lifecycleDialogAction.value,
                    reason,
                },
            },
        );

        detailsProcedure.value = response.data;
        statusProcedure.value =
            statusProcedure.value?.id === response.data.id
                ? response.data
                : statusProcedure.value;
        procedures.value = procedures.value.map((item) =>
            item.id === response.data.id ? response.data : item,
        );

        notifySuccess(
            lifecycleDialogAction.value === 'cancel'
                ? 'Theatre procedure cancelled.'
                : 'Theatre procedure marked entered in error.',
        );
        closeTheatreLifecycleDialog();
    } catch (error) {
        lifecycleDialogError.value = messageFromUnknown(
            error,
            'Unable to apply the lifecycle action.',
        );
        notifyError(lifecycleDialogError.value);
    } finally {
        lifecycleSubmitting.value = false;
    }
}

function theatreProcedureRoomDisplayLabel(procedure: any): string {
    const roomName = String(procedure?.theatreRoomName ?? '').trim();
    const roomCode = String(procedure?.theatreRoomCode ?? '').trim();

    if (roomName && roomCode) {
        return `${roomName} (${roomCode})`;
    }

    return roomName || roomCode || 'No room assigned';
}

function theatreProcedureRoomSupportLabel(procedure: any): string {
    const roomType = String(procedure?.theatreRoomServicePointType ?? '').trim();
    const location = String(procedure?.theatreRoomLocation ?? '').trim();
    const parts = [
        roomType ? formatEnumLabel(roomType) : '',
        location,
    ].filter((value) => value.trim() !== '');

    return parts.join(' | ') || 'Theatre room metadata not available';
}

function theatreProcedureScheduledSummary(procedure: any): string {
    const scheduledAt = String(procedure?.scheduledAt ?? '').trim();

    return scheduledAt ? formatDateTime(scheduledAt) : 'No schedule captured';
}

function openStatusDialog(item: any, action: string) {
    if (!allowedStatusActionsForProcedure(item).includes(action)) {
        notifyError('This case can only move forward in the normal theatre workflow.');

        return;
    }

    statusProcedure.value = item;
    statusAction.value = action;
    statusReason.value = '';
    statusStartedAt.value = defaultDateTimeLocal();
    statusCompletedAt.value = defaultDateTimeLocal();
    statusError.value = null;
    statusDialogStockCheckRequestKey.value += 1;
    statusDialogStockCheckLoading.value = false;
    statusDialogStockCheckError.value = null;
    statusDialogOpen.value = true;

    if (action === 'completed') {
        void refreshStatusProcedureForCompletion(String(item?.id ?? ''));
    }
}

function openDetailsPrimaryStatusDialog() {
    if (!detailsProcedure.value || !detailsPrimaryStatusAction.value || !canUpdateStatus.value) {
        return;
    }

    openStatusDialog(detailsProcedure.value, detailsPrimaryStatusAction.value);
}

function statusNeedsStartedAt(): boolean {
    return statusAction.value === 'in_progress' || statusAction.value === 'completed';
}

function statusNeedsCompletedAt(): boolean {
    return statusAction.value === 'completed';
}

async function submitStatusDialog() {
    if (!statusProcedure.value || !canUpdateStatus.value || statusSubmitting.value) return;
    statusSubmitting.value = true;
    statusError.value = null;
    try {
        await apiRequest('PATCH', `/theatre-procedures/${statusProcedure.value.id}/status`, {
            body: {
                status: statusAction.value,
                reason: statusReason.value.trim() || null,
                startedAt: statusNeedsStartedAt() ? toSqlDateTime(statusStartedAt.value) : null,
                completedAt: statusNeedsCompletedAt() ? toSqlDateTime(statusCompletedAt.value) : null,
            },
        });
        notifySuccess('Procedure status updated.');
        statusDialogOpen.value = false;
        await loadQueue();
        const updatedProcedure = procedures.value.find(
            (item) => String(item?.id ?? '') === String(statusProcedure.value?.id ?? ''),
        );
        if (updatedProcedure && String(detailsProcedure.value?.id ?? '') === String(updatedProcedure.id)) {
            detailsProcedure.value = updatedProcedure;
        }
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update procedure status.');
        notifyError(statusError.value);
    } finally {
        statusSubmitting.value = false;
    }
}

async function refreshStatusProcedureForCompletion(
    procedureId: string,
): Promise<void> {
    const normalizedProcedureId = String(procedureId ?? '').trim();
    if (!normalizedProcedureId) return;

    const requestKey = statusDialogStockCheckRequestKey.value + 1;
    statusDialogStockCheckRequestKey.value = requestKey;
    statusDialogStockCheckLoading.value = true;
    statusDialogStockCheckError.value = null;

    const freshProcedure = await fetchProcedureById(normalizedProcedureId);
    if (statusDialogStockCheckRequestKey.value !== requestKey) {
        return;
    }

    if (freshProcedure === null) {
        statusDialogStockCheckError.value =
            'Live stock readiness could not be refreshed. Saving still runs backend stock validation.';
        statusDialogStockCheckLoading.value = false;

        return;
    }

    if (
        statusDialogOpen.value
        && statusAction.value === 'completed'
        && String(statusProcedure.value?.id ?? '') === normalizedProcedureId
    ) {
        statusProcedure.value = freshProcedure;

        if (String(detailsProcedure.value?.id ?? '') === normalizedProcedureId) {
            detailsProcedure.value = freshProcedure;
        }
    }

    statusDialogStockCheckLoading.value = false;
}

watch(statusAction, (next, previous) => {
    if (!statusDialogOpen.value || !statusProcedure.value) return;

    if (next === 'completed' && previous !== 'completed') {
        void refreshStatusProcedureForCompletion(statusProcedure.value.id);
        return;
    }

    if (next !== 'completed') {
        statusDialogStockCheckRequestKey.value += 1;
        statusDialogStockCheckLoading.value = false;
        statusDialogStockCheckError.value = null;
    }
});

watch(statusDialogOpen, (open) => {
    if (open) return;

    statusDialogStockCheckRequestKey.value += 1;
    statusDialogStockCheckLoading.value = false;
    statusDialogStockCheckError.value = null;
});

function theatreDetailsFocusForWorkflowAction(
    actionKey: string | null | undefined,
): {
    tab: TheatreDetailsTab;
    overviewTab: 'summary' | 'context' | 'resources';
} {
    const normalizedAction = String(actionKey ?? '').trim();

    if (normalizedAction === 'review_case') {
        return { tab: 'workflows', overviewTab: 'summary' };
    }

    return { tab: 'overview', overviewTab: 'summary' };
}

async function openDetails(
    item: any,
    options?: { focusWorkflowActionKey?: string | null },
) {
    const focus = theatreDetailsFocusForWorkflowAction(
        options?.focusWorkflowActionKey,
    );

    detailsProcedure.value = item;
    detailsOpen.value = true;
    detailsTab.value = focus.tab;
    detailsOverviewTab.value = focus.overviewTab;
    detailsAuditFiltersOpen.value = false;
    detailsAuditExpandedRows.value = {};
    detailsAuditLogs.value = [];
    detailsAuditError.value = null;
    detailsAuditMeta.value = null;
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    detailsResourceItems.value = [];
    detailsResourceMeta.value = null;
    detailsResourceCounts.value = { scheduled: 0, in_use: 0, released: 0, cancelled: 0, other: 0, total: 0 };
    detailsResourceError.value = null;
    detailsProcedureNotesLoading.value = false;
    detailsProcedureNotes.value = [];
    detailsProcedureNotesError.value = null;
    detailsResourceFilters.q = '';
    detailsResourceFilters.resourceType = '';
    detailsResourceFilters.status = '';
    detailsResourceFilters.page = 1;
    detailsResourceFilters.perPage = 10;
    resourceCreateErrors.value = {};
    resourceCreateForm.resourceType = 'room';
    resourceCreateForm.resourceReference = '';
    resourceCreateForm.roleLabel = '';
    resourceCreateForm.plannedStartAt = defaultDateTimeLocal();
    resourceCreateForm.plannedEndAt = defaultDateTimeLocal();
    resourceCreateForm.notes = '';
    const loaders: Promise<unknown>[] = [loadResourceAllocations()];
    if (canReadMedicalRecords.value) {
        loaders.push(loadDetailsProcedureMedicalRecords());
    }
    if (canViewAudit.value) {
        loaders.push(loadDetailsAuditLogs());
    }
    await Promise.all(loaders);
}

function openProcedureById(procedureId: string) {
    const target =
        procedures.value.find(
            (item) => String(item?.id ?? '') === String(procedureId ?? ''),
        ) ?? null;
    if (target) {
        void openDetails(target);
    }
}

async function fetchProcedureById(
    procedureId: string,
): Promise<TheatreProcedure | null> {
    try {
        const response = await apiRequest<{ data: TheatreProcedure }>(
            'GET',
            `/theatre-procedures/${procedureId}`,
        );
        return response.data ?? null;
    } catch {
        return null;
    }
}

function clearQueryParamFromUrl(name: string) {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(name)) return;
    url.searchParams.delete(name);
    window.history.replaceState(window.history.state, '', url.toString());
}

async function applyFocusedProcedureFromQuery() {
    const procedureId = queryParam('focusProcedureId').trim();
    const workflowActionKey = queryParam('focusWorkflowActionKey').trim();
    if (!procedureId) return;

    let target =
        procedures.value.find(
            (item) => String(item?.id ?? '') === procedureId,
        ) ?? null;
    if (!target) {
        target = await fetchProcedureById(procedureId);
    }

    if (target) {
        await openDetails(target, {
            focusWorkflowActionKey: workflowActionKey,
        });
    } else {
        notifyError('Unable to open the requested procedure from the patient chart.');
    }

    clearQueryParamFromUrl('focusProcedureId');
    clearQueryParamFromUrl('focusWorkflowActionKey');
}

async function loadDetailsProcedureMedicalRecords() {
    if (!detailsProcedure.value?.patientId || !canReadMedicalRecords.value) {
        detailsProcedureNotes.value = [];
        detailsProcedureNotesError.value = null;
        detailsProcedureNotesLoading.value = false;
        return;
    }

    detailsProcedureNotesLoading.value = true;
    detailsProcedureNotesError.value = null;

    try {
        const response = await apiRequest<MedicalRecordListResponse>(
            'GET',
            '/medical-records',
            {
                query: {
                    patientId: detailsProcedure.value.patientId,
                    theatreProcedureId: detailsProcedure.value.id,
                    recordType: 'procedure_note',
                    page: 1,
                    perPage: 25,
                    sortBy: 'encounterAt',
                    sortDir: 'desc',
                },
            },
        );

        detailsProcedureNotes.value = response.data ?? [];
    } catch (error) {
        detailsProcedureNotes.value = [];
        detailsProcedureNotesError.value = messageFromUnknown(
            error,
            'Unable to load linked procedure notes.',
        );
    } finally {
        detailsProcedureNotesLoading.value = false;
    }
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

function auditActorLabel(log: any): string {
    return log?.actorId === null || log?.actorId === undefined
        ? 'System'
        : `User #${log.actorId}`;
}

async function loadDetailsAuditLogs() {
    if (!canViewAudit.value || !detailsProcedure.value) return;
    detailsAuditLoading.value = true;
    detailsAuditError.value = null;
    try {
        const response = await apiRequest<{
            data: any[];
            meta?: { currentPage?: number; lastPage?: number; total?: number; perPage?: number };
        }>('GET', `/theatre-procedures/${detailsProcedure.value.id}/audit-logs`, {
            query: detailsAuditQuery(),
        });
        detailsAuditLogs.value = response.data ?? [];
        detailsAuditMeta.value = {
            currentPage: response.meta?.currentPage ?? detailsAuditFilters.page,
            lastPage: response.meta?.lastPage ?? 1,
            total: response.meta?.total ?? detailsAuditLogs.value.length,
            perPage: response.meta?.perPage ?? detailsAuditFilters.perPage,
        };
    } catch (error) {
        detailsAuditError.value = messageFromUnknown(error, 'Unable to load audit logs.');
        detailsAuditLogs.value = [];
        detailsAuditMeta.value = null;
    } finally {
        detailsAuditLoading.value = false;
    }
}

function applyDetailsAuditFilters() {
    detailsAuditFilters.page = 1;
    void loadDetailsAuditLogs();
}

function resetDetailsAuditFilters() {
    detailsAuditFilters.q = '';
    detailsAuditFilters.action = '';
    detailsAuditFilters.actorType = '';
    detailsAuditFilters.actorId = '';
    detailsAuditFilters.from = '';
    detailsAuditFilters.to = '';
    detailsAuditFilters.page = 1;
    detailsAuditFilters.perPage = 20;
    void loadDetailsAuditLogs();
}

function goToDetailsAuditPage(page: number) {
    detailsAuditFilters.page = Math.max(page, 1);
    void loadDetailsAuditLogs();
}

async function exportDetailsAuditLogsCsv() {
    if (!detailsProcedure.value || !canViewAudit.value || detailsAuditExporting.value) {
        return;
    }

    detailsAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/theatre-procedures/${detailsProcedure.value.id}/audit-logs/export`,
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

function detailsResourceQuery() {
    return {
        q: detailsResourceFilters.q.trim() || null,
        resourceType: detailsResourceFilters.resourceType || null,
        status: detailsResourceFilters.status || null,
        page: detailsResourceFilters.page,
        perPage: detailsResourceFilters.perPage,
    };
}

async function loadResourceAllocations() {
    if (!detailsProcedure.value || !canRead.value) return;
    detailsResourceLoading.value = true;
    detailsResourceError.value = null;
    try {
        const [listResponse, countsResponse] = await Promise.all([
            apiRequest<{
                data: any[];
                meta?: { currentPage?: number; lastPage?: number; total?: number; perPage?: number };
            }>('GET', `/theatre-procedures/${detailsProcedure.value.id}/resource-allocations`, {
                query: detailsResourceQuery(),
            }),
            apiRequest<{ data: typeof detailsResourceCounts.value }>(
                'GET',
                `/theatre-procedures/${detailsProcedure.value.id}/resource-allocation-status-counts`,
                {
                    query: {
                        q: detailsResourceFilters.q.trim() || null,
                        resourceType: detailsResourceFilters.resourceType || null,
                    },
                },
            ),
        ]);

        detailsResourceItems.value = listResponse.data ?? [];
        detailsResourceMeta.value = {
            currentPage: listResponse.meta?.currentPage ?? detailsResourceFilters.page,
            lastPage: listResponse.meta?.lastPage ?? 1,
            total: listResponse.meta?.total ?? detailsResourceItems.value.length,
            perPage: listResponse.meta?.perPage ?? detailsResourceFilters.perPage,
        };
        detailsResourceCounts.value = countsResponse.data ?? {
            scheduled: 0,
            in_use: 0,
            released: 0,
            cancelled: 0,
            other: 0,
            total: 0,
        };
    } catch (error) {
        detailsResourceError.value = messageFromUnknown(error, 'Unable to load resource allocations.');
        detailsResourceItems.value = [];
        detailsResourceMeta.value = null;
        detailsResourceCounts.value = { scheduled: 0, in_use: 0, released: 0, cancelled: 0, other: 0, total: 0 };
    } finally {
        detailsResourceLoading.value = false;
    }
}

function applyResourceFilters() {
    detailsResourceFilters.page = 1;
    void loadResourceAllocations();
}

function resetResourceFilters() {
    detailsResourceFilters.q = '';
    detailsResourceFilters.resourceType = '';
    detailsResourceFilters.status = '';
    detailsResourceFilters.page = 1;
    detailsResourceFilters.perPage = 10;
    void loadResourceAllocations();
}

function goToResourcePage(page: number) {
    detailsResourceFilters.page = Math.max(page, 1);
    void loadResourceAllocations();
}

async function submitResourceCreate() {
    if (!detailsProcedure.value || !canManageResources.value || resourceCreateSubmitting.value) return;

    resourceCreateSubmitting.value = true;
    resourceCreateErrors.value = {};
    try {
        await apiRequest('POST', `/theatre-procedures/${detailsProcedure.value.id}/resource-allocations`, {
            body: {
                resourceType: resourceCreateForm.resourceType,
                resourceReference: resourceCreateForm.resourceReference.trim(),
                roleLabel: resourceCreateForm.roleLabel.trim() || null,
                plannedStartAt: toSqlDateTime(resourceCreateForm.plannedStartAt),
                plannedEndAt: toSqlDateTime(resourceCreateForm.plannedEndAt),
                notes: resourceCreateForm.notes.trim() || null,
            },
        });
        notifySuccess('Resource allocation created.');
        resourceCreateForm.resourceType = 'room';
        resourceCreateForm.resourceReference = '';
        resourceCreateForm.roleLabel = '';
        resourceCreateForm.notes = '';
        resourceCreateForm.plannedStartAt = defaultDateTimeLocal();
        resourceCreateForm.plannedEndAt = defaultDateTimeLocal();
        await loadResourceAllocations();
    } catch (error) {
        resourceCreateErrors.value = (error as ApiError).payload?.errors ?? {};
        notifyError(messageFromUnknown(error, 'Unable to create resource allocation.'));
    } finally {
        resourceCreateSubmitting.value = false;
    }
}

function openResourceStatusDialog(item: any, status: string) {
    resourceStatusTarget.value = item;
    resourceStatusAction.value = status;
    resourceStatusReason.value = '';
    resourceStatusActualStartAt.value = defaultDateTimeLocal();
    resourceStatusActualEndAt.value = defaultDateTimeLocal();
    resourceStatusError.value = null;
    resourceStatusDialogOpen.value = true;
}

function resourceStatusNeedsActualStartAt(): boolean {
    return resourceStatusAction.value === 'in_use' || resourceStatusAction.value === 'released';
}

function resourceStatusNeedsActualEndAt(): boolean {
    return resourceStatusAction.value === 'released';
}

async function submitResourceStatusDialog() {
    if (!detailsProcedure.value || !resourceStatusTarget.value || !canManageResources.value || resourceStatusSubmitting.value) return;

    resourceStatusSubmitting.value = true;
    resourceStatusError.value = null;
    try {
        await apiRequest(
            'PATCH',
            `/theatre-procedures/${detailsProcedure.value.id}/resource-allocations/${resourceStatusTarget.value.id}/status`,
            {
                body: {
                    status: resourceStatusAction.value,
                    reason: resourceStatusReason.value.trim() || null,
                    actualStartAt: resourceStatusNeedsActualStartAt() ? toSqlDateTime(resourceStatusActualStartAt.value) : null,
                    actualEndAt: resourceStatusNeedsActualEndAt() ? toSqlDateTime(resourceStatusActualEndAt.value) : null,
                },
            },
        );
        notifySuccess('Resource allocation status updated.');
        resourceStatusDialogOpen.value = false;
        await loadResourceAllocations();
    } catch (error) {
        resourceStatusError.value = messageFromUnknown(error, 'Unable to update resource allocation status.');
        notifyError(resourceStatusError.value);
    } finally {
        resourceStatusSubmitting.value = false;
    }
}

function resourceAuditQuery() {
    return {
        q: resourceAuditFilters.q.trim() || null,
        action: resourceAuditFilters.action.trim() || null,
        actorType: resourceAuditFilters.actorType || null,
        actorId: resourceAuditFilters.actorId.trim() || null,
        from: resourceAuditFilters.from || null,
        to: resourceAuditFilters.to || null,
        page: resourceAuditFilters.page,
        perPage: resourceAuditFilters.perPage,
    };
}

async function loadResourceAuditLogs() {
    if (!detailsProcedure.value || !resourceAuditTarget.value || !canViewResourceAudit.value) return;

    resourceAuditLoading.value = true;
    resourceAuditError.value = null;
    try {
        const response = await apiRequest<{
            data: any[];
            meta?: { currentPage?: number; lastPage?: number; total?: number; perPage?: number };
        }>(
            'GET',
            `/theatre-procedures/${detailsProcedure.value.id}/resource-allocations/${resourceAuditTarget.value.id}/audit-logs`,
            { query: resourceAuditQuery() },
        );
        resourceAuditLogs.value = response.data ?? [];
        resourceAuditMeta.value = {
            currentPage: response.meta?.currentPage ?? resourceAuditFilters.page,
            lastPage: response.meta?.lastPage ?? 1,
            total: response.meta?.total ?? resourceAuditLogs.value.length,
            perPage: response.meta?.perPage ?? resourceAuditFilters.perPage,
        };
    } catch (error) {
        resourceAuditError.value = messageFromUnknown(error, 'Unable to load resource allocation audit logs.');
        resourceAuditLogs.value = [];
        resourceAuditMeta.value = null;
    } finally {
        resourceAuditLoading.value = false;
    }
}

async function openResourceAuditDialog(item: any) {
    resourceAuditTarget.value = item;
    resourceAuditDialogOpen.value = true;
    resourceAuditDialogTab.value = 'logs';
    resourceAuditFilters.q = '';
    resourceAuditFilters.action = '';
    resourceAuditFilters.actorType = '';
    resourceAuditFilters.actorId = '';
    resourceAuditFilters.from = '';
    resourceAuditFilters.to = '';
    resourceAuditFilters.page = 1;
    resourceAuditFilters.perPage = 20;
    resourceAuditError.value = null;
    resourceAuditLogs.value = [];
    resourceAuditMeta.value = null;
    if (!canViewResourceAudit.value) return;
    await loadResourceAuditLogs();
}

function applyResourceAuditFilters() {
    resourceAuditFilters.page = 1;
    void loadResourceAuditLogs();
}

function resetResourceAuditFilters() {
    resourceAuditFilters.q = '';
    resourceAuditFilters.action = '';
    resourceAuditFilters.actorType = '';
    resourceAuditFilters.actorId = '';
    resourceAuditFilters.from = '';
    resourceAuditFilters.to = '';
    resourceAuditFilters.page = 1;
    resourceAuditFilters.perPage = 20;
    void loadResourceAuditLogs();
}

function goToResourceAuditPage(page: number) {
    resourceAuditFilters.page = Math.max(page, 1);
    void loadResourceAuditLogs();
}

async function exportResourceAuditLogsCsv() {
    if (!detailsProcedure.value || !resourceAuditTarget.value || !canViewResourceAudit.value || resourceAuditExporting.value) {
        return;
    }

    resourceAuditExporting.value = true;
    try {
        const url = new URL(
            `/api/v1/theatre-procedures/${detailsProcedure.value.id}/resource-allocations/${resourceAuditTarget.value.id}/audit-logs/export`,
            window.location.origin,
        );
        Object.entries(resourceAuditQuery()).forEach(([key, value]) => {
            if (value === null || value === '') return;
            if (key === 'page' || key === 'perPage') return;
            url.searchParams.set(key, String(value));
        });
        window.open(url.toString(), '_blank', 'noopener');
    } finally {
        resourceAuditExporting.value = false;
    }
}

watch(
    () => createForm.patientId,
    (value, previousValue) => {
        const patientId = value.trim();
        const previousPatientId = (previousValue ?? '').trim();
        if (patientId === previousPatientId) return;

        if (!patientId) {
            createPatientContextLocked.value = false;
            clearCreateClinicalLinks();
            resetCreateContextSuggestions();
            createContextEditorTab.value = 'patient';
            createContextEditorOpen.value = true;
            return;
        }

        if (previousPatientId && patientId !== previousPatientId) {
            createContextAutoLinkSuppressed.appointment = false;
            createContextAutoLinkSuppressed.admission = false;
            clearCreateClinicalLinks();
            createContextEditorTab.value = 'patient';
        }

        void hydratePatientSummary(patientId);
        void loadCreateContextSuggestions(patientId);
    },
    { immediate: true },
);

watch(
    () => createForm.appointmentId,
    (value) => {
        const appointmentId = value.trim();

        if (pendingCreateAppointmentLinkSource !== null) {
            createAppointmentLinkSource.value = pendingCreateAppointmentLinkSource;
            pendingCreateAppointmentLinkSource = null;
        } else {
            createAppointmentLinkSource.value = appointmentId ? 'manual' : 'none';
        }

        void loadCreateAppointmentSummary(appointmentId);
    },
    { immediate: true },
);

watch(
    () => createForm.admissionId,
    (value) => {
        const admissionId = value.trim();

        if (pendingCreateAdmissionLinkSource !== null) {
            createAdmissionLinkSource.value = pendingCreateAdmissionLinkSource;
            pendingCreateAdmissionLinkSource = null;
        } else {
            createAdmissionLinkSource.value = admissionId ? 'manual' : 'none';
        }

        void loadCreateAdmissionSummary(admissionId);
    },
    { immediate: true },
);

watch(
    () => createForm.theatreProcedureCatalogItemId,
    () => {
        syncCreateTheatreProcedureCatalogSelection();
    },
    { immediate: true },
);

onMounted(async () => {
    try {
        await loadPermissions();
        await loadQueue();
        if (queryParam('tab') === 'new' && canCreate.value) {
            theatreWorkspaceView.value = 'create';
        }
        if (canCreate.value) {
            await Promise.all([
                loadTheatreProcedureCatalog(),
                loadTheatreRoomRegistry(),
            ]);
            await loadCreateLifecycleSourceProcedure();
        }
        if (canReadTheatreClinicianDirectory.value) {
            void loadTheatreClinicians();
        }
        await applyFocusedProcedureFromQuery();
    } finally {
        pageLoading.value = false;
    }
});
</script>

<template>
    <Head title="Theatre & Procedures" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
            <!-- Page header -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="scissors" class="size-7 text-primary" />
                        Theatre & Procedures
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        {{ theatreWorkspaceDescription }}
                    </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Button
                        v-if="(theatreWorkspaceView === 'queue' || theatreWorkspaceView === 'board') && canRead"
                        variant="outline"
                        size="sm"
                        :disabled="queueLoading"
                        class="gap-1.5"
                        @click="loadQueue"
                    >
                        <AppIcon name="activity" class="size-3.5" />
                        {{ queueLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Button
                        v-if="canRead && theatreWorkspaceView === 'queue'"
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="setTheatreWorkspaceView('board')"
                    >
                        <AppIcon name="layout-grid" class="size-3.5" />
                        Theatre Board
                    </Button>
                    <Button
                        v-else-if="canRead && theatreWorkspaceView === 'board'"
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="setTheatreWorkspaceView('queue')"
                    >
                        <AppIcon name="layout-list" class="size-3.5" />
                        Theatre Queue
                    </Button>
                    <Button
                        v-if="theatreWorkspaceView !== 'create' && canCreate"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="openTheatreCreateWorkspace"
                    >
                        <AppIcon name="plus" class="size-3.5" />
                        Schedule Procedure
                    </Button>
                    <Button
                        v-else-if="theatreWorkspaceView === 'create' && canRead"
                        variant="outline"
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="setTheatreWorkspaceView('queue')"
                    >
                        <AppIcon name="layout-list" class="size-3.5" />
                        Theatre Queue
                    </Button>
                </div>
            </div>

            <Alert v-if="theatreWorkspaceView !== 'create' && queueError" variant="destructive">
                <AlertTitle class="flex items-center gap-2">
                    <AppIcon name="circle-x" class="size-4" />
                    Theatre load failed
                </AlertTitle>
                <AlertDescription>{{ queueError }}</AlertDescription>
            </Alert>

            <WalkInServiceRequestsPanel
                v-if="theatreWorkspaceView !== 'create'"
                ref="theatreWalkInPanelRef"
                service-type="theatre_procedure"
                :enabled="canUpdateServiceRequestStatus"
                panel-title="Walk-in patients awaiting procedures"
                acknowledge-button-label="Acknowledge & schedule procedure"
                success-message="Walk-in acknowledged. Patient is ready for procedure scheduling."
                @acknowledged="onTheatreWalkInAcknowledged"
            />

            <!-- Queue bar -->
            <div
                v-if="canRead && theatreWorkspaceView === 'queue'"
                class="flex min-h-9 flex-col gap-2 rounded-lg border bg-muted/30 px-4 py-2 lg:flex-row lg:items-center lg:justify-between"
            >
                <div class="flex flex-wrap items-center gap-2">
                    <Button size="sm" class="h-8 gap-1.5" :variant="searchForm.status === 'planned' ? 'default' : 'outline'" @click="searchForm.status = 'planned'; submitSearch()"><span class="font-medium">{{ queueCountLabel(counts.planned) }}</span>Planned</Button>
                    <Button size="sm" class="h-8 gap-1.5" :variant="searchForm.status === 'in_preop' ? 'default' : 'outline'" @click="searchForm.status = 'in_preop'; submitSearch()"><span class="font-medium">{{ queueCountLabel(counts.in_preop) }}</span>Pre-op</Button>
                    <Button size="sm" class="h-8 gap-1.5" :variant="searchForm.status === 'in_progress' ? 'default' : 'outline'" @click="searchForm.status = 'in_progress'; submitSearch()"><span class="font-medium">{{ queueCountLabel(counts.in_progress) }}</span>In progress</Button>
                    <Button size="sm" class="h-8 gap-1.5" :variant="!searchForm.status ? 'default' : 'outline'" @click="searchForm.status = ''; submitSearch()"><span class="font-medium">{{ queueCountLabel(counts.total) }}</span>All procedures</Button>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <Select v-model="statusSelectValue">
                        <SelectTrigger class="h-8 w-36 shrink-0 bg-background" size="sm">
                            <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Any status</SelectItem>
                            <SelectItem v-for="opt in statusOptions" :key="opt" :value="opt">{{ formatEnumLabel(opt) }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <!-- Single column: queue card then create form -->
            <div class="flex min-w-0 flex-col gap-4">
                <!-- Theatre queue card -->
                <Card
                    v-if="canRead && theatreWorkspaceView === 'queue'"
                    class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col"
                >
                    <CardHeader class="shrink-0 gap-3 pb-3">
                        <div class="space-y-3">
                            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div class="min-w-0 flex-1 space-y-1">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                                    Theatre queue
                                </CardTitle>
                                <CardDescription>
                                    {{ procedures.length }} procedures on this page · Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                </CardDescription>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" class="w-fit">{{ theatreToolbarStateLabel }}</Badge>
                                        <Badge
                                            v-if="isPatientChartQueueFocusApplied"
                                            variant="outline"
                                        >
                                            Patient chart handoff
                                        </Badge>
                                    </div>
                                    <p
                                        v-if="activeQueuePatientSummary"
                                        class="text-xs text-muted-foreground"
                                    >
                                        Patient in focus:
                                        {{ patientName(activeQueuePatientSummary) }} |
                                        No.
                                        {{
                                            activeQueuePatientSummary.patientNumber ||
                                            activeQueuePatientSummary.id
                                        }}
                                    </p>
                                </div>
                                <div
                                    v-if="patientChartQueueReturnHref || patientChartQueueRouteContext.patientId"
                                    class="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end"
                                >
                                    <Button
                                        v-if="patientChartQueueReturnHref"
                                        variant="outline"
                                        size="sm"
                                        as-child
                                    >
                                        <Link :href="patientChartQueueReturnHref">
                                            Back to Patient Chart
                                        </Link>
                                    </Button>
                                    <Button
                                        v-if="isPatientChartQueueFocusApplied"
                                        variant="outline"
                                        size="sm"
                                        @click="openFullTheatreQueue"
                                    >
                                        Open Full Queue
                                    </Button>
                                    <Button
                                        v-else-if="openedFromPatientChart && patientChartQueueRouteContext.patientId"
                                        variant="outline"
                                        size="sm"
                                        @click="refocusTheatrePatientQueue"
                                    >
                                        Refocus This Patient
                                    </Button>
                                </div>
                            </div>
                            <div class="flex w-full flex-wrap items-center gap-2 lg:max-w-2xl">
                                <SearchInput
                                    id="theatre-q"
                                    v-model="searchForm.q"
                                    placeholder="Procedure number, type, room..."
                                    class="min-w-0 flex-1"
                                    @keyup.enter="submitSearch"
                                />
                                <Popover>
                                    <PopoverTrigger as-child>
                                        <Button variant="outline" size="sm" class="hidden gap-1.5 md:inline-flex">
                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                            Filters
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" class="flex max-h-[28rem] w-[20rem] flex-col overflow-hidden rounded-md border bg-popover p-0 shadow-md">
                                        <div class="space-y-3 border-b px-4 py-3">
                                            <p class="flex items-center gap-2 text-sm font-medium"><AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />Filters</p>
                                            <div class="grid gap-2">
                                                <Label for="theatre-status-popover">Status</Label>
                                                <Select v-model="searchForm.status">
                                                    <SelectTrigger class="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                    <SelectItem value="">All</SelectItem>
                                                    <SelectItem v-for="o in statusOptions" :key="o" :value="o">{{ formatEnumLabel(o) }}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
                                            <Button variant="outline" size="sm" class="gap-1.5" @click="resetFilters">Reset</Button>
                                            <Button size="sm" class="gap-1.5" :disabled="queueLoading" @click="submitSearch"><AppIcon name="search" class="size-3.5" />Search</Button>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Button variant="outline" size="sm" class="w-full gap-1.5 md:hidden" @click="mobileFiltersDrawerOpen = true">
                                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                                    Filters
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                        <ScrollArea class="min-h-0 flex-1">
                            <div class="min-h-[12rem] space-y-2 p-4">
                                <div v-if="queueLoading" class="space-y-2">
                                    <div class="h-16 animate-pulse rounded-lg bg-muted" />
                                    <div class="h-16 animate-pulse rounded-lg bg-muted" />
                                </div>
                                <div v-else-if="procedures.length === 0" class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No theatre procedures found.</div>
                                <div v-else class="space-y-2">
                                    <div v-for="item in procedures" :key="item.id" class="rounded-lg border p-3">
                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p class="font-medium">{{ item.procedureNumber }}</p>
                                                <p class="text-xs text-muted-foreground">{{ item.procedureType }} | {{ item.theatreRoomName || 'No room' }}</p>
                                                <p v-if="item.theatreProcedureCatalogItemId" class="text-[11px] text-muted-foreground">Catalog: {{ item.theatreProcedureCatalogItemId }}</p>
                                            </div>
                                            <Badge variant="outline">{{ formatEnumLabel(item.status) }}</Badge>
                                        </div>
                                        <div class="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                                            <p>Patient: {{ theatrePatientDisplayLabel(item) }}</p>
                                            <p>Scheduled: {{ formatDateTime(item.scheduledAt) }}</p>
                                            <p>Started: {{ formatDateTime(item.startedAt) }}</p>
                                            <p>Completed: {{ formatDateTime(item.completedAt) }}</p>
                                        </div>
                                        <div class="mt-3 flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" class="gap-1.5" @click="openDetails(item)"><AppIcon name="eye" class="size-3.5" />Details</Button>
                                            <Button
                                                v-if="canUpdateStatus && primaryStatusActionForProcedure(item)"
                                                size="sm"
                                                variant="secondary"
                                                @click="openStatusDialog(item, primaryStatusActionForProcedure(item)!)"
                                            >
                                                {{ theatreStatusActionLabel(primaryStatusActionForProcedure(item)!) }}
                                            </Button>
                                            <Select :model-value="''" @update:model-value="(value) => { if (value) openStatusDialog(item, String(value)); }">
                                                <SelectTrigger class="w-[220px]">
                                                    <SelectValue placeholder="More Status Actions..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem
                                                        v-for="status in secondaryStatusActionsForProcedure(item)"
                                                        :key="status"
                                                        :value="status"
                                                    >
                                                        {{ theatreStatusActionLabel(status) }}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                        <footer class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                            <p class="text-xs text-muted-foreground">Showing {{ procedures.length }} procedures · Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}</p>
                            <div class="flex items-center gap-2">
                                <Button variant="outline" size="sm" class="gap-1.5" :disabled="!pagination || pagination.currentPage <= 1 || queueLoading" @click="prevPage"><AppIcon name="chevron-left" class="size-3.5" />Previous</Button>
                                <Button variant="outline" size="sm" class="gap-1.5" :disabled="!pagination || pagination.currentPage >= pagination.lastPage || queueLoading" @click="nextPage"><AppIcon name="chevron-right" class="size-3.5" />Next</Button>
                            </div>
                        </footer>
                    </CardContent>
                </Card>
                <Card
                    v-else-if="!pageLoading && theatreWorkspaceView === 'queue'"
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2"><AppIcon name="shield-check" class="size-4 text-muted-foreground" />Theatre queue</CardTitle>
                        <CardDescription>You do not have read permission.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle class="flex items-center gap-2"><AppIcon name="shield-check" class="size-4" />Read access restricted</AlertTitle>
                            <AlertDescription>Request <code>theatre.procedures.read</code> permission.</AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <Card
                    v-if="canRead && theatreWorkspaceView === 'board'"
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader class="gap-3">
                        <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="layout-grid" class="size-5 text-muted-foreground" />
                                    Theatre board
                                </CardTitle>
                                <CardDescription>
                                    Monitor today&apos;s room slate, active cases, and theatre bottlenecks in one place.
                                </CardDescription>
                            </div>
                            <Badge variant="outline" class="w-fit">Current queue scope</Badge>
                        </div>
                    </CardHeader>
                    <CardContent class="space-y-4">
                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div class="rounded-lg border bg-muted/10 p-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Active rooms
                                </p>
                                <p class="mt-2 text-2xl font-semibold">{{ theatreBoardSummary.activeRooms }}</p>
                                <p class="text-xs text-muted-foreground">
                                    Rooms currently represented in the loaded theatre slate.
                                </p>
                            </div>
                            <div class="rounded-lg border bg-muted/10 p-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Waiting in pre-op
                                </p>
                                <p class="mt-2 text-2xl font-semibold">{{ theatreBoardSummary.preopCount }}</p>
                                <p class="text-xs text-muted-foreground">
                                    Cases staged and waiting to move into theatre.
                                </p>
                            </div>
                            <div class="rounded-lg border bg-muted/10 p-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    In progress
                                </p>
                                <p class="mt-2 text-2xl font-semibold">{{ theatreBoardSummary.inProgressCount }}</p>
                                <p class="text-xs text-muted-foreground">
                                    Cases currently occupying theatre resources.
                                </p>
                            </div>
                            <div class="rounded-lg border bg-muted/10 p-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Bottlenecks
                                </p>
                                <p class="mt-2 text-2xl font-semibold">{{ theatreBoardSummary.bottleneckCount }}</p>
                                <p class="text-xs text-muted-foreground">
                                    High-signal blockers detected from the current slate.
                                </p>
                            </div>
                        </div>

                        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
                            <div class="rounded-lg border bg-background p-4">
                                <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p class="text-sm font-medium">Theatre slate</p>
                                        <p class="text-xs text-muted-foreground">
                                            Room-based view of the current theatre queue, sorted by scheduled time.
                                        </p>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        {{ procedures.length }} procedures in current scope
                                    </p>
                                </div>

                                <div class="mt-4 space-y-3">
                                    <div v-if="queueLoading && procedures.length === 0" class="space-y-2">
                                        <div class="h-24 animate-pulse rounded-lg bg-muted" />
                                        <div class="h-24 animate-pulse rounded-lg bg-muted" />
                                    </div>
                                    <div
                                        v-else-if="theatreSlateRooms.length === 0"
                                        class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                                    >
                                        No theatre cases are available for the current board scope.
                                    </div>
                                    <div v-else class="grid gap-3 xl:grid-cols-2">
                                        <div
                                            v-for="room in theatreSlateRooms"
                                            :key="`theatre-board-room-${room.room}`"
                                            class="rounded-lg border bg-muted/10 p-3"
                                        >
                                            <div class="flex items-center justify-between gap-2">
                                                <div>
                                                    <p class="font-medium">{{ room.room }}</p>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{ room.items.length }} case{{ room.items.length === 1 ? '' : 's' }}
                                                    </p>
                                                </div>
                                                <Badge variant="outline">
                                                    {{
                                                        room.items.filter((item) => item.status === 'in_progress').length
                                                    }}
                                                    active
                                                </Badge>
                                            </div>

                                            <div class="mt-3 space-y-2">
                                                <div
                                                    v-for="item in room.items"
                                                    :key="`theatre-board-item-${item.id}`"
                                                    class="rounded-lg border bg-background p-3"
                                                >
                                                    <div class="flex flex-wrap items-start justify-between gap-2">
                                                        <div class="min-w-0">
                                                            <p class="font-medium">{{ item.procedureNumber }}</p>
                                                            <p class="text-xs text-muted-foreground">
                                                                {{
                                                                    item.procedureName ||
                                                                    item.procedureType ||
                                                                    'Procedure details pending'
                                                                }}
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline">
                                                            {{ formatEnumLabel(item.status) }}
                                                        </Badge>
                                                    </div>
                                                    <div class="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                                        <p>Scheduled: {{ formatDateTime(item.scheduledAt) }}</p>
                                                        <p>Patient: {{ theatrePatientDisplayLabel(item) }}</p>
                                                    </div>
                                                    <div class="mt-3 flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            class="gap-1.5"
                                                            @click="openDetails(item)"
                                                        >
                                                            <AppIcon name="eye" class="size-3.5" />
                                                            Details
                                                        </Button>
                                                        <Button
                                                            v-if="canUpdateStatus && primaryStatusActionForProcedure(item)"
                                                            type="button"
                                                            size="sm"
                                                            variant="secondary"
                                                            @click="openStatusDialog(item, primaryStatusActionForProcedure(item)!)"
                                                        >
                                                            {{ theatreStatusActionLabel(primaryStatusActionForProcedure(item)!) }}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="rounded-lg border bg-background p-4">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Bottleneck monitor</p>
                                    <p class="text-xs text-muted-foreground">
                                        Highest-signal blockers from the currently loaded theatre slate.
                                    </p>
                                </div>

                                <div class="mt-4 space-y-2">
                                    <div
                                        v-if="theatreBottlenecks.length === 0"
                                        class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                                    >
                                        No major bottlenecks detected in the current theatre scope.
                                    </div>
                                    <div
                                        v-for="issue in theatreBottlenecks"
                                        :key="issue.id"
                                        class="rounded-lg border p-3"
                                    >
                                        <div class="flex items-start justify-between gap-2">
                                            <div>
                                                <p class="font-medium">{{ issue.title }}</p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ issue.procedureNumber }}
                                                </p>
                                            </div>
                                            <Badge
                                                :variant="issue.severity >= 3 ? 'destructive' : 'secondary'"
                                            >
                                                {{ issue.severity >= 3 ? 'High' : 'Watch' }}
                                            </Badge>
                                        </div>
                                        <p class="mt-2 text-sm text-muted-foreground">
                                            {{ issue.detail }}
                                        </p>
                                        <div class="mt-3">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                class="gap-1.5"
                                                @click="openProcedureById(issue.procedureId)"
                                            >
                                                <AppIcon name="eye" class="size-3.5" />
                                                Review case
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card
                    v-else-if="!pageLoading && theatreWorkspaceView === 'board'"
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <AppIcon name="shield-check" class="size-4 text-muted-foreground" />
                            Theatre board
                        </CardTitle>
                        <CardDescription>You do not have read permission.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Alert variant="destructive">
                            <AlertTitle class="flex items-center gap-2">
                                <AppIcon name="shield-check" class="size-4" />
                                Read access restricted
                            </AlertTitle>
                            <AlertDescription>
                                Request <code>theatre.procedures.read</code> permission.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                <!-- Register Procedure card -->
                <Card
                    v-if="canCreate && theatreWorkspaceView === 'create'"
                    id="create-procedure"
                    class="rounded-lg border-sidebar-border/70"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2"><AppIcon name="plus" class="size-5 text-muted-foreground" />Schedule Procedure</CardTitle>
                        <CardDescription v-if="!canCreate">Request permission: <code>theatre.procedures.create</code></CardDescription>
                        <CardDescription v-else>Use the carried-forward patient and encounter context when available, then schedule the case.</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-6">
                        <Alert
                            v-if="hasCreateLifecycleMode && createLifecycleSourceError"
                            variant="destructive"
                            class="border-destructive/40 bg-destructive/5"
                        >
                            <AlertTitle>{{ createLifecycleAlertTitle }}</AlertTitle>
                            <AlertDescription class="space-y-3">
                                <p>{{ createLifecycleSourceError }}</p>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    class="gap-1.5"
                                    @click="clearCreateLifecycleMode"
                                >
                                    <AppIcon name="circle-x" class="size-3.5" />
                                    {{ createLifecycleClearActionLabel }}
                                </Button>
                            </AlertDescription>
                        </Alert>
                        <Alert
                            v-else-if="hasCreateLifecycleMode"
                            class="border-primary/30 bg-primary/5"
                        >
                            <AlertTitle>{{
                                createLifecycleSourceLoading
                                    ? 'Loading lifecycle source'
                                    : createLifecycleAlertTitle
                            }}</AlertTitle>
                            <AlertDescription class="space-y-3">
                                <p>
                                    {{
                                        createLifecycleSourceLoading
                                            ? 'Loading the original procedure so we can prefill this follow-up booking safely.'
                                            : createLifecycleAlertDescription
                                    }}
                                </p>
                                <Button
                                    v-if="!createLifecycleSourceLoading"
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    class="gap-1.5"
                                    @click="clearCreateLifecycleMode"
                                >
                                    <AppIcon name="circle-x" class="size-3.5" />
                                    {{ createLifecycleClearActionLabel }}
                                </Button>
                            </AlertDescription>
                        </Alert>
                        <Alert
                            v-if="Object.keys(createErrors).length > 0"
                            variant="destructive"
                            class="border-destructive/40 bg-destructive/5"
                        >
                            <AlertTitle>Check this procedure draft</AlertTitle>
                            <AlertDescription>
                                {{
                                    Object.values(createErrors).flat()[0] ||
                                    'Review the highlighted fields and try again.'
                                }}
                            </AlertDescription>
                        </Alert>
                        <Alert v-else-if="createDraftNotice" class="border-primary/30 bg-primary/5">
                            <AlertTitle>Draft restored</AlertTitle>
                            <AlertDescription>{{ createDraftNotice }}</AlertDescription>
                        </Alert>
                        <Collapsible
                            v-model:open="createContextEditorOpen"
                            class="rounded-lg border bg-muted/20 p-3"
                        >
                            <div class="flex flex-col gap-3">
                                <div
                                    class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between"
                                >
                                    <div class="min-w-0 space-y-2">
                                        <div class="flex flex-wrap items-center gap-1.5">
                                            <Badge :variant="createContextModeVariant">
                                                {{ createContextModeLabel }}
                                            </Badge>
                                            <Badge
                                                v-if="createPatientContextLocked"
                                                variant="secondary"
                                                class="text-[10px]"
                                            >
                                                Locked patient
                                            </Badge>
                                            <Badge
                                                v-if="hasCreateAppointmentContext && createAppointmentContextStatusLabel"
                                                variant="secondary"
                                                class="text-[10px]"
                                            >
                                                {{ createAppointmentContextStatusLabel }}
                                            </Badge>
                                            <Badge
                                                v-if="hasCreateAdmissionContext && createAdmissionContextStatusLabel"
                                                variant="secondary"
                                                class="text-[10px]"
                                            >
                                                {{ createAdmissionContextStatusLabel }}
                                            </Badge>
                                        </div>
                                        <div class="flex min-w-0 flex-wrap items-center gap-2">
                                            <div class="flex min-w-0 items-center gap-2">
                                                <AppIcon
                                                    name="user"
                                                    class="size-3.5 shrink-0 text-muted-foreground"
                                                />
                                                <span
                                                    class="truncate text-sm font-medium"
                                                    :title="createPatientContextMeta"
                                                >
                                                    {{ createPatientContextLabel }}
                                                </span>
                                            </div>
                                            <Badge
                                                v-if="createPatientSummary?.patientNumber"
                                                variant="outline"
                                                class="text-[10px]"
                                            >
                                                Patient No. {{ createPatientSummary?.patientNumber }}
                                            </Badge>
                                        </div>
                                        <p class="text-xs text-muted-foreground">
                                            {{ createContextSummary }}
                                        </p>
                                    </div>
                                    <div class="flex flex-wrap gap-2 xl:justify-end">
                                        <Button
                                            v-if="openedFromPatientChart && createForm.patientId"
                                            variant="outline"
                                            size="sm"
                                            as-child
                                        >
                                            <Link :href="createPatientChartHref">
                                                Back to Patient Chart
                                            </Link>
                                        </Button>
                                        <Button
                                            v-if="
                                                canReadMedicalRecords &&
                                                createForm.patientId &&
                                                (
                                                    createForm.appointmentId ||
                                                    createForm.admissionId ||
                                                    hasCreateMedicalRecordContext
                                                )
                                            "
                                            variant="outline"
                                            size="sm"
                                            as-child
                                        >
                                            <Link :href="consultationContextHref">
                                                {{ consultationReturnLabel }}
                                            </Link>
                                        </Button>
                                        <Button
                                            v-if="canReadAppointments && createForm.appointmentId"
                                            variant="outline"
                                            size="sm"
                                            as-child
                                        >
                                            <Link :href="appointmentContextHref(createForm.appointmentId)">
                                                Back to Appointments
                                            </Link>
                                        </Button>
                                        <Button
                                            v-if="canReadAdmissions && createForm.admissionId"
                                            variant="outline"
                                            size="sm"
                                            as-child
                                        >
                                            <Link :href="contextCreateHref('/admissions')">
                                                Back to Admissions
                                            </Link>
                                        </Button>
                                        <CollapsibleTrigger as-child>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                class="gap-1.5"
                                                @click="
                                                    createContextEditorTab =
                                                        createPatientContextLocked
                                                            ? 'patient'
                                                            : hasCreateAppointmentContext
                                                              ? 'appointment'
                                                              : hasCreateAdmissionContext
                                                                ? 'admission'
                                                                : 'patient'
                                                "
                                            >
                                                <AppIcon
                                                    :name="
                                                        createContextEditorOpen
                                                            ? 'chevron-up'
                                                            : 'sliders-horizontal'
                                                    "
                                                    class="size-3.5"
                                                />
                                                {{ createContextActionLabel }}
                                            </Button>
                                        </CollapsibleTrigger>
                                    </div>
                                </div>
                                <div
                                    v-if="hasCreateAppointmentContext || hasCreateAdmissionContext"
                                    class="flex flex-wrap gap-2"
                                >
                                    <div
                                        v-if="hasCreateAppointmentContext"
                                        class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                                        :title="
                                            [
                                                createAppointmentContextLabel,
                                                createAppointmentContextMeta,
                                                createAppointmentContextReason,
                                            ]
                                                .filter(Boolean)
                                                .join(' | ')
                                        "
                                    >
                                        <AppIcon
                                            name="calendar-clock"
                                            class="size-3.5 text-muted-foreground"
                                        />
                                        <span class="font-medium">
                                            {{ createAppointmentContextLabel }}
                                        </span>
                                        <span
                                            v-if="createAppointmentContextSourceLabel"
                                            class="text-muted-foreground"
                                        >
                                            | {{ createAppointmentContextSourceLabel }}
                                        </span>
                                    </div>
                                    <div
                                        v-if="hasCreateAdmissionContext"
                                        class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                                        :title="
                                            [
                                                createAdmissionContextLabel,
                                                createAdmissionContextMeta,
                                                createAdmissionContextReason,
                                            ]
                                                .filter(Boolean)
                                                .join(' | ')
                                        "
                                    >
                                        <AppIcon
                                            name="bed-double"
                                            class="size-3.5 text-muted-foreground"
                                        />
                                        <span class="font-medium">
                                            {{ createAdmissionContextLabel }}
                                        </span>
                                        <span
                                            v-if="createAdmissionContextSourceLabel"
                                            class="text-muted-foreground"
                                        >
                                            | {{ createAdmissionContextSourceLabel }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <CollapsibleContent class="pt-3">
                                <div class="rounded-lg border bg-background p-4">
                            <div
                                v-if="showClinicalHandoffBanner"
                                class="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3"
                            >
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Clinical handoff</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            createPatientContextLocked
                                                ? 'This procedure opened from a carried-forward clinical workflow. Patient stays locked until you choose a different patient.'
                                                : 'Review or remove the carried-forward appointment or admission context before scheduling theatre work.'
                                        }}
                                    </p>
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    <Button
                                        v-if="createPatientContextLocked"
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        @click="unlockCreatePatientContext"
                                    >
                                        Change Patient
                                    </Button>
                                    <Button
                                        v-else-if="createForm.appointmentId || createForm.admissionId"
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        @click="clearCreateClinicalLinks"
                                    >
                                        Unlink Clinical Context
                                    </Button>
                                </div>
                            </div>

                            <div class="space-y-1">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Patient & context
                                </p>
                                <p class="text-xs text-muted-foreground">
                                    Confirm the patient, outpatient handoff, and inpatient stay before entering procedure details.
                                </p>
                            </div>

                            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                <div
                                    class="rounded-lg border p-3"
                                    :class="createForm.patientId ? 'border-primary/30 bg-primary/5' : 'bg-background'"
                                >
                                    <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        <AppIcon name="user" class="size-3.5" />
                                        Patient
                                    </div>
                                    <p class="mt-2 text-sm font-medium">{{ createPatientContextLabel }}</p>
                                    <p class="text-xs text-muted-foreground">{{ createPatientContextMeta }}</p>
                                </div>

                                <div
                                    class="rounded-lg border p-3"
                                    :class="hasCreateAppointmentContext ? 'border-primary/30 bg-primary/5' : 'bg-background'"
                                >
                                    <div class="flex items-start justify-between gap-2">
                                        <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            <AppIcon name="calendar-clock" class="size-3.5" />
                                            Appointment
                                        </div>
                                        <div class="flex flex-wrap justify-end gap-1.5">
                                            <Badge
                                                v-if="createAppointmentContextStatusLabel"
                                                variant="secondary"
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
                                    <p class="mt-2 text-sm font-medium">{{ createAppointmentContextLabel }}</p>
                                    <p class="text-xs text-muted-foreground">{{ createAppointmentContextMeta }}</p>
                                    <p
                                        v-if="createAppointmentContextReason"
                                        class="mt-1 text-xs text-muted-foreground"
                                    >
                                        {{ createAppointmentContextReason }}
                                    </p>
                                    <div v-if="hasCreateAppointmentContext" class="mt-3 flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            class="gap-1.5"
                                            @click="createContextEditorTab = 'appointment'"
                                        >
                                            Review
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            class="gap-1.5"
                                            @click="clearCreateAppointmentLink()"
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                    <div
                                        v-else-if="createForm.patientId.trim()"
                                        class="mt-3 flex flex-wrap gap-2"
                                    >
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            class="gap-1.5"
                                            @click="createContextEditorTab = 'appointment'"
                                        >
                                            Relink
                                        </Button>
                                    </div>
                                </div>

                                <div
                                    class="rounded-lg border p-3"
                                    :class="hasCreateAdmissionContext ? 'border-primary/30 bg-primary/5' : 'bg-background'"
                                >
                                    <div class="flex items-start justify-between gap-2">
                                        <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            <AppIcon name="bed-double" class="size-3.5" />
                                            Admission
                                        </div>
                                        <div class="flex flex-wrap justify-end gap-1.5">
                                            <Badge
                                                v-if="createAdmissionContextStatusLabel"
                                                variant="secondary"
                                                class="text-[10px]"
                                            >
                                                {{ createAdmissionContextStatusLabel }}
                                            </Badge>
                                            <Badge
                                                v-if="createAdmissionContextSourceLabel"
                                                variant="outline"
                                                class="text-[10px]"
                                            >
                                                {{ createAdmissionContextSourceLabel }}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p class="mt-2 text-sm font-medium">{{ createAdmissionContextLabel }}</p>
                                    <p class="text-xs text-muted-foreground">{{ createAdmissionContextMeta }}</p>
                                    <p
                                        v-if="createAdmissionContextReason"
                                        class="mt-1 text-xs text-muted-foreground"
                                    >
                                        {{ createAdmissionContextReason }}
                                    </p>
                                    <div v-if="hasCreateAdmissionContext" class="mt-3 flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            class="gap-1.5"
                                            @click="createContextEditorTab = 'admission'"
                                        >
                                            Review
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            class="gap-1.5"
                                            @click="clearCreateAdmissionLink()"
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                    <div
                                        v-else-if="createForm.patientId.trim()"
                                        class="mt-3 flex flex-wrap gap-2"
                                    >
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            class="gap-1.5"
                                            @click="createContextEditorTab = 'admission'"
                                        >
                                            Relink
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div class="space-y-3">
                                <div class="space-y-1">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Context editor
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ createContextEditorDescription }}
                                    </p>
                                </div>
                                <Tabs v-model="createContextEditorTab" class="w-full">
                                    <TabsList class="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
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
                                        <TabsTrigger
                                            value="admission"
                                            :disabled="!createForm.patientId.trim()"
                                            class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"
                                        >
                                            <AppIcon name="bed-double" class="size-3.5" />
                                            Admission
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <div class="rounded-lg border bg-muted/20 p-4">
                                    <div v-show="createContextEditorTab === 'patient'" class="grid gap-3">
                                        <PatientLookupField
                                            input-id="theatre-create-patient"
                                            v-model="createForm.patientId"
                                            label="Patient"
                                            patient-status="active"
                                            :helper-text="
                                                createPatientContextLocked
                                                    ? 'Patient is locked from the clinical handoff. Use Change Patient to unlock.'
                                                    : 'Search by patient number, name, phone, email, or national ID.'
                                            "
                                            :disabled="createPatientContextLocked"
                                            :error-message="createFieldError('patientId')"
                                        />
                                    </div>

                                    <div v-show="createContextEditorTab === 'appointment'" class="grid gap-3">
                                        <LinkedContextLookupField
                                            input-id="theatre-create-appointment"
                                            v-model="createForm.appointmentId"
                                            :patient-id="createForm.patientId"
                                            label="Appointment link"
                                            resource="appointments"
                                            status="checked_in"
                                            :helper-text="
                                                createForm.patientId.trim()
                                                    ? 'Search checked-in appointments for the selected patient.'
                                                    : 'Select a patient first to search appointments.'
                                            "
                                            :disabled="!createForm.patientId.trim()"
                                            :error-message="createFieldError('appointmentId')"
                                        />
                                        <div v-if="createForm.appointmentId.trim()" class="flex justify-end">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                class="gap-1.5"
                                                @click="clearCreateAppointmentLink()"
                                            >
                                                Remove appointment link
                                            </Button>
                                        </div>
                                    </div>

                                    <div v-show="createContextEditorTab === 'admission'" class="grid gap-3">
                                        <LinkedContextLookupField
                                            input-id="theatre-create-admission"
                                            v-model="createForm.admissionId"
                                            :patient-id="createForm.patientId"
                                            label="Admission link"
                                            resource="admissions"
                                            status="admitted"
                                            :helper-text="
                                                createForm.patientId.trim()
                                                    ? 'Search active admissions for the selected patient.'
                                                    : 'Select a patient first to search admissions.'
                                            "
                                            :disabled="!createForm.patientId.trim()"
                                            :error-message="createFieldError('admissionId')"
                                        />
                                        <div v-if="createForm.admissionId.trim()" class="flex justify-end">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                class="gap-1.5"
                                                @click="clearCreateAdmissionLink()"
                                            >
                                                Remove admission link
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                        <div class="space-y-3">
                            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Procedure details</p>
                            <div class="space-y-4 rounded-lg border bg-muted/10 p-4">
                                <template v-if="usesCatalogBackedProcedurePicker">
                                    <SearchableSelectField
                                        input-id="create-procedure-catalog-item-id"
                                        v-model="createForm.theatreProcedureCatalogItemId"
                                        label="Governed procedure"
                                        :options="createTheatreProcedureCatalogOptions"
                                        placeholder="Select a governed theatre procedure"
                                        search-placeholder="Search by procedure name, code, or category"
                                        :helper-text="createTheatreProcedureCatalogHelperText"
                                        :error-message="createTheatreProcedurePickerError"
                                        empty-text="No governed procedure matched that search."
                                        :disabled="!canCreate || createSubmitting"
                                    />
                                </template>

                                <div
                                    v-if="theatreProcedureCatalogLoading"
                                    class="rounded-lg border bg-background/70 p-3 text-sm text-muted-foreground"
                                >
                                    Loading governed procedure catalog...
                                </div>

                                <Alert
                                    v-else-if="theatreProcedureCatalogError && !usesCatalogBackedProcedurePicker"
                                    variant="destructive"
                                    class="border-destructive/40 bg-destructive/5"
                                >
                                    <AppIcon name="triangle-alert" class="size-4" />
                                    <AlertTitle>Governed procedure catalog unavailable</AlertTitle>
                                    <AlertDescription class="space-y-3">
                                        <p>{{ theatreProcedureCatalogError }}</p>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                @click="void loadTheatreProcedureCatalog(true)"
                                            >
                                                Retry
                                            </Button>
                                            <Link
                                                href="/platform/admin/clinical-catalogs"
                                                class="text-xs font-medium text-foreground underline underline-offset-4"
                                            >
                                                Open Clinical Catalogs
                                            </Link>
                                        </div>
                                    </AlertDescription>
                                </Alert>

                                <div class="grid gap-3 lg:grid-cols-3">
                                    <FormFieldShell
                                        input-id="create-procedure-type-sync"
                                        label="Procedure code"
                                        :helper-text="
                                            !usesCatalogBackedProcedurePicker
                                                ? createTheatreProcedureCatalogHelperText
                                                : ''
                                        "
                                        :error-message="createFieldError('procedureType')"
                                    >
                                        <Input
                                            id="create-procedure-type-sync"
                                            v-model="createForm.procedureType"
                                            :disabled="!canCreate || createSubmitting"
                                            :readonly="Boolean(selectedCreateTheatreProcedureCatalogItem)"
                                            placeholder="Governed procedure code"
                                        />
                                    </FormFieldShell>
                                    <FormFieldShell
                                        input-id="create-procedure-name"
                                        label="Procedure name"
                                    >
                                        <Input
                                            id="create-procedure-name"
                                            v-model="createForm.procedureName"
                                            :disabled="!canCreate || createSubmitting"
                                            :readonly="Boolean(selectedCreateTheatreProcedureCatalogItem)"
                                            placeholder="Procedure name"
                                        />
                                    </FormFieldShell>
                                    <div class="space-y-1">
                                        <template v-if="canReadTheatreRoomRegistry">
                                            <SearchableSelectField
                                                input-id="create-theatre-room"
                                                v-model="createForm.theatreRoomServicePointId"
                                                label="Theatre room"
                                                :options="createTheatreRoomOptions"
                                                placeholder="Select theatre room"
                                                search-placeholder="Search room name, code, or location"
                                                :helper-text="createTheatreRoomHelperText"
                                                :error-message="createTheatreRoomFieldError"
                                                empty-text="No theatre room matched that search."
                                                :disabled="!canCreate || createSubmitting"
                                            />
                                        </template>
                                        <template v-else>
                                            <SearchableSelectField
                                                input-id="create-theatre-room"
                                                v-model="createForm.theatreRoomName"
                                                label="Theatre room"
                                                :options="createManualTheatreRoomOptions"
                                                placeholder="Select or type theatre room"
                                                search-placeholder="Search room name, code, or location"
                                                :helper-text="createTheatreRoomHelperText"
                                                :error-message="createTheatreRoomFieldError"
                                                empty-text="No theatre room matched that search."
                                                :disabled="!canCreate || createSubmitting"
                                                :allow-custom-value="true"
                                            />
                                        </template>
                                    </div>
                                </div>

                                <div class="grid gap-3 lg:grid-cols-3">
                                    <div class="space-y-1">
                                        <template
                                            v-if="canReadTheatreClinicianDirectory"
                                        >
                                            <SearchableSelectField
                                                input-id="create-operating"
                                                v-model="createForm.operatingClinicianUserId"
                                                label="Operating clinician"
                                                :options="createTheatreClinicianOptions"
                                                placeholder="Select operating clinician"
                                                search-placeholder="Search by employee number, job title, department, or user ID"
                                                :helper-text="createOperatingClinicianHelperText"
                                                :error-message="createFieldError('operatingClinicianUserId')"
                                                message-class="min-h-8"
                                                empty-text="No active clinician matched that search."
                                                :disabled="!canCreate || createSubmitting"
                                            />
                                        </template>
                                        <template v-else>
                                            <Label for="create-operating">Operating clinician user ID</Label>
                                            <Input
                                                id="create-operating"
                                                v-model="createForm.operatingClinicianUserId"
                                                :disabled="!canCreate || createSubmitting"
                                                type="number"
                                                min="1"
                                                placeholder="Required"
                                            />
                                            <p class="text-xs text-muted-foreground">{{ createOperatingClinicianHelperText }}</p>
                                            <p v-if="createFieldError('operatingClinicianUserId')" class="text-xs text-red-600">{{ createFieldError('operatingClinicianUserId') }}</p>
                                        </template>
                                    </div>

                                    <div class="space-y-1">
                                        <template
                                            v-if="canReadTheatreClinicianDirectory"
                                        >
                                            <SearchableSelectField
                                                input-id="create-anesthetist"
                                                v-model="createForm.anesthetistUserId"
                                                label="Anesthetist"
                                                :options="createTheatreAnesthetistOptions"
                                                placeholder="Select anesthetist"
                                                search-placeholder="Search by employee number, job title, department, or user ID"
                                                :helper-text="createAnesthetistHelperText"
                                                :error-message="createFieldError('anesthetistUserId')"
                                                message-class="min-h-8"
                                                empty-text="No active anesthetist matched that search."
                                                :disabled="!canCreate || createSubmitting"
                                            />
                                        </template>
                                        <template v-else>
                                            <Label for="create-anesthetist">Anesthetist user ID</Label>
                                            <Input
                                                id="create-anesthetist"
                                                v-model="createForm.anesthetistUserId"
                                                :disabled="!canCreate || createSubmitting"
                                                type="number"
                                                min="1"
                                                placeholder="Optional"
                                            />
                                            <p class="text-xs text-muted-foreground">{{ createAnesthetistHelperText }}</p>
                                        </template>
                                    </div>
                                    <FormFieldShell
                                        input-id="create-scheduled"
                                        label="Scheduled at"
                                        :helper-text="createScheduledAtHelperText"
                                        :error-message="createFieldError('scheduledAt')"
                                        message-class="min-h-8"
                                    >
                                        <Input
                                            id="create-scheduled"
                                            v-model="createForm.scheduledAt"
                                            :disabled="!canCreate || createSubmitting"
                                            type="datetime-local"
                                        />
                                    </FormFieldShell>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <Label for="create-notes">Notes</Label>
                            <Textarea id="create-notes" v-model="createForm.notes" :disabled="!canCreate || createSubmitting" rows="3" placeholder="Optional" />
                        </div>
                        <Separator />
                        <div class="flex flex-wrap items-center justify-end gap-2">
                            <Button
                                v-if="showSaveCreateDraftAction"
                                variant="outline"
                                :disabled="
                                    !canCreate ||
                                    createSubmitting ||
                                    (
                                        hasCreateLifecycleMode &&
                                        (
                                            createLifecycleSourceLoading ||
                                            createLifecycleSourceProcedure === null
                                        )
                                    )
                                "
                                class="gap-1.5"
                                @click="saveCreateDraft"
                            >
                                <AppIcon name="save" class="size-3.5" />
                                {{ saveCreateDraftLabel }}
                            </Button>
                            <Button
                                v-if="hasSavedCreateDraft"
                                variant="outline"
                                :disabled="createSubmitting"
                                class="gap-1.5"
                                @click="discardSavedCreateDraft"
                            >
                                <AppIcon name="trash" class="size-3.5" />
                                Discard saved draft
                            </Button>
                            <Button
                                :disabled="
                                    !canCreate ||
                                    createSubmitting ||
                                    (
                                        hasCreateLifecycleMode &&
                                        (
                                            createLifecycleSourceLoading ||
                                            createLifecycleSourceProcedure === null
                                        )
                                    )
                                "
                                class="gap-1.5"
                                @click="submitCreate"
                            >
                                <AppIcon name="check" class="size-3.5" />
                                {{ createSubmitLabel }}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <!-- Related workflows -->
                <div
                    v-if="showTheatreRelatedWorkflowFooter"
                    class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-2.5"
                >
                    <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><AppIcon name="activity" class="size-3.5" />Related workflows</span>
                    <Button
                        v-if="
                            canReadMedicalRecords &&
                            (
                                createForm.appointmentId ||
                                createForm.admissionId ||
                                hasCreateMedicalRecordContext
                            )
                        "
                        size="sm"
                        variant="outline"
                        as-child
                        class="gap-1.5"
                    >
                        <Link :href="consultationContextHref">
                            <AppIcon name="stethoscope" class="size-3.5" />
                            {{ consultationReturnLabel }}
                        </Link>
                    </Button>
                    <Button
                        v-if="canReadAppointments && createForm.appointmentId"
                        size="sm"
                        variant="outline"
                        as-child
                        class="gap-1.5"
                    >
                        <Link :href="appointmentContextHref(createForm.appointmentId)">
                            <AppIcon name="calendar-clock" class="size-3.5" />
                            Back to Appointments
                        </Link>
                    </Button>
                    <Button
                        v-if="canReadAdmissions && createForm.admissionId"
                        size="sm"
                        variant="outline"
                        as-child
                        class="gap-1.5"
                    >
                        <Link :href="contextCreateHref('/admissions')">
                            <AppIcon name="bed-double" class="size-3.5" />
                            Back to Admissions
                        </Link>
                    </Button>
                    <Button
                        v-if="openedFromPatientChart && createForm.patientId"
                        size="sm"
                        variant="outline"
                        as-child
                        class="gap-1.5"
                    >
                        <Link :href="createPatientChartHref"><AppIcon name="clipboard-list" class="size-3.5" />Back to Patient Chart</Link>
                    </Button>
                    <Button
                        v-if="canCreateLaboratoryOrders"
                        size="sm"
                        variant="outline"
                        as-child
                        class="gap-1.5"
                    >
                        <Link :href="contextCreateHref('/laboratory-orders', { includeTabNew: true })"><AppIcon name="flask-conical" class="size-3.5" />Order Lab</Link>
                    </Button>
                    <Button
                        v-if="canCreatePharmacyOrders"
                        size="sm"
                        variant="outline"
                        as-child
                        class="gap-1.5"
                    >
                        <Link :href="contextCreateHref('/pharmacy-orders', { includeTabNew: true })"><AppIcon name="pill" class="size-3.5" />Order Pharmacy</Link>
                    </Button>
                    <Button
                        v-if="canCreateRadiologyOrders"
                        size="sm"
                        variant="outline"
                        as-child
                        class="gap-1.5"
                    >
                        <Link :href="contextCreateHref('/radiology-orders', { includeTabNew: true })"><AppIcon name="scan-line" class="size-3.5" />Order Imaging</Link>
                    </Button>
                    <Button
                        v-if="canReadBillingInvoices"
                        size="sm"
                        variant="outline"
                        as-child
                        class="gap-1.5"
                    >
                        <Link :href="contextCreateHref('/billing-invoices', { includeTabNew: true })"><AppIcon name="receipt" class="size-3.5" />New Billing Invoice</Link>
                    </Button>
                </div>
            </div>
        </div>
    </AppLayout>

    <ClinicalLifecycleActionDialog
        :open="lifecycleDialogOpen"
        :action="lifecycleDialogAction"
        :order-label="lifecycleDialogProcedure?.procedureNumber || lifecycleDialogProcedure?.procedureName || 'Theatre procedure'"
        subject-label="theatre procedure"
        :reason="lifecycleDialogReason"
        :loading="lifecycleSubmitting"
        :error="lifecycleDialogError"
        @update:open="(open) => (open ? (lifecycleDialogOpen = true) : closeTheatreLifecycleDialog())"
        @update:reason="lifecycleDialogReason = $event"
        @submit="submitTheatreLifecycleDialog"
    />

    <!-- Mobile filters drawer -->
    <Drawer :open="mobileFiltersDrawerOpen" @update:open="mobileFiltersDrawerOpen = $event">
        <DrawerContent class="max-h-[90vh]">
            <DrawerHeader>
                <DrawerTitle class="flex items-center gap-2"><AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />Theatre Queue Search & Filters</DrawerTitle>
                <DrawerDescription>Search the queue and apply status filters.</DrawerDescription>
            </DrawerHeader>
            <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
                <div class="grid gap-2"><Label for="theatre-q-drawer">Search</Label><Input id="theatre-q-drawer" v-model="searchForm.q" placeholder="Procedure number, type, room..." @keyup.enter="submitSearch" /></div>
                <div class="grid gap-2"><Label for="theatre-status-drawer">Status</Label><Select v-model="searchForm.status"><SelectTrigger class="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="">All</SelectItem><SelectItem v-for="o in statusOptions" :key="o" :value="o">{{ formatEnumLabel(o) }}</SelectItem></SelectContent></Select></div>
            </div>
            <DrawerFooter class="gap-2">
                <Button class="gap-1.5" :disabled="queueLoading" @click="submitSearch(); mobileFiltersDrawerOpen = false"><AppIcon name="search" class="size-3.5" />Search</Button>
                <Button variant="outline" @click="resetFilters(); mobileFiltersDrawerOpen = false">Reset</Button>
            </DrawerFooter>
        </DrawerContent>
    </Drawer>

    <Dialog v-model:open="statusDialogOpen">
        <DialogContent variant="action">
            <DialogHeader>
                <DialogTitle>Update Procedure Status</DialogTitle>
                <DialogDescription>{{ statusProcedure?.procedureNumber ?? 'Procedure' }}</DialogDescription>
            </DialogHeader>
            <div class="space-y-3">
                <div class="space-y-1">
                    <Label>Next status</Label>
                    <Select v-model="statusAction">
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem
                            v-for="item in statusDialogActionOptions"
                            :key="item"
                            :value="item"
                        >
                            {{ theatreStatusActionLabel(item) }}
                        </SelectItem>
                        </SelectContent>
                    </Select>
                    <p class="text-xs text-muted-foreground">Normal workflow moves forward only. Cancel remains available as the exception path.</p>
                </div>
                <div class="space-y-1">
                    <Label>{{ statusReasonLabel }}</Label>
                    <Input v-model="statusReason" :placeholder="statusReasonPlaceholder" />
                    <p class="text-xs text-muted-foreground">{{ statusReasonHelpText }}</p>
                </div>
                <div v-if="statusNeedsStartedAt()" class="space-y-1">
                    <Label>Started At</Label>
                    <Input v-model="statusStartedAt" type="datetime-local" />
                </div>
                <div v-if="statusNeedsCompletedAt()" class="space-y-1">
                    <Label>Completed At</Label>
                    <Input v-model="statusCompletedAt" type="datetime-local" />
                </div>
                <Alert
                    v-if="statusAction === 'completed' && statusDialogStockCheckLoading"
                    class="border-primary/20 bg-primary/5"
                >
                    <AlertTitle class="flex items-center gap-2">
                        <AppIcon name="package-search" class="size-4" />
                        Checking live stock readiness
                    </AlertTitle>
                    <AlertDescription>
                        Refreshing the latest recipe stock position before completion.
                    </AlertDescription>
                </Alert>
                <Alert
                    v-else-if="statusAction === 'completed' && statusDialogStockCheckError"
                    variant="destructive"
                >
                    <AlertTitle class="flex items-center gap-2">
                        <AppIcon name="alert-triangle" class="size-4" />
                        Live stock refresh unavailable
                    </AlertTitle>
                    <AlertDescription>{{ statusDialogStockCheckError }}</AlertDescription>
                </Alert>
                <Alert
                    v-else-if="statusDialogStockPrecheck"
                    :variant="statusDialogStockPrecheck.blocking ? 'destructive' : 'default'"
                    :class="statusDialogStockPrecheck.blocking ? '' : 'border-primary/20 bg-primary/5'"
                >
                    <AlertTitle class="flex items-center gap-2">
                        <AppIcon
                            :name="statusDialogStockPrecheck.blocking ? 'alert-triangle' : statusDialogStockPrecheck.status === 'ready' ? 'circle-check' : 'package-search'"
                            class="size-4"
                        />
                        {{ statusDialogStockPrecheckTitle }}
                    </AlertTitle>
                    <AlertDescription class="space-y-2">
                        <p>{{ statusDialogStockPrecheck.summary }}</p>
                        <div
                            v-if="statusDialogStockPrecheck.blocking && statusDialogStockPrecheckLines.length"
                            class="space-y-2"
                        >
                            <div
                                v-for="line in statusDialogStockPrecheckLines"
                                :key="line.recipeItemId"
                                class="rounded-md border bg-background/80 px-3 py-2 text-xs"
                            >
                                <p class="font-medium text-foreground">
                                    {{ line.itemName || line.itemCode || 'Inventory item' }}
                                </p>
                                <p class="mt-1 text-muted-foreground">
                                    Need {{ formatClinicalStockQuantity(line.requiredQuantity) }}
                                    {{ line.unit || 'unit' }}
                                    | Available {{ formatClinicalStockQuantity(line.currentStock) }}
                                    <template v-if="line.blockingReason">
                                        | {{ line.blockingReason }}
                                    </template>
                                </p>
                            </div>
                        </div>
                    </AlertDescription>
                </Alert>
                <p v-if="statusError" class="text-xs text-red-600">{{ statusError }}</p>
            </div>
            <DialogFooter>
                <Button variant="outline" @click="statusDialogOpen = false">Close</Button>
                <Button
                    :disabled="statusSubmitting || statusDialogStockCheckLoading"
                    @click="submitStatusDialog"
                >
                    {{
                        statusSubmitting
                            ? 'Saving...'
                            : statusDialogStockCheckLoading
                              ? 'Checking stock...'
                              : 'Save'
                    }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog v-model:open="resourceStatusDialogOpen">
        <DialogContent variant="action">
            <DialogHeader>
                <DialogTitle>Update Resource Allocation Status</DialogTitle>
                <DialogDescription>{{ resourceStatusTarget?.resourceReference ?? 'Resource Allocation' }}</DialogDescription>
            </DialogHeader>
            <div class="space-y-3">
                <div class="space-y-1">
                    <Label>Status</Label>
                    <Select v-model="resourceStatusAction">
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem v-for="item in resourceStatusActionOptions" :key="`resource-status-action-${item}`" :value="item">{{ formatEnumLabel(item) }}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="space-y-1">
                    <Label>Reason</Label>
                    <Input v-model="resourceStatusReason" placeholder="Required for cancelled status" />
                </div>
                <div v-if="resourceStatusNeedsActualStartAt()" class="space-y-1">
                    <Label>Actual Start At</Label>
                    <Input v-model="resourceStatusActualStartAt" type="datetime-local" />
                </div>
                <div v-if="resourceStatusNeedsActualEndAt()" class="space-y-1">
                    <Label>Actual End At</Label>
                    <Input v-model="resourceStatusActualEndAt" type="datetime-local" />
                </div>
                <p v-if="resourceStatusError" class="text-xs text-red-600">{{ resourceStatusError }}</p>
            </div>
            <DialogFooter>
                <Button variant="outline" @click="resourceStatusDialogOpen = false">Close</Button>
                <Button :disabled="resourceStatusSubmitting" @click="submitResourceStatusDialog">{{ resourceStatusSubmitting ? 'Saving...' : 'Save' }}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <Sheet
        :open="detailsOpen"
        @update:open="
            (open) => {
                detailsOpen = open;
                if (!open) {
                    detailsTab = 'overview';
                    detailsOverviewTab = 'summary';
                }
            }
        "
    >
        <SheetContent side="right" variant="workspace">
            <div class="flex h-full flex-col overflow-hidden">
                <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                    <template v-if="detailsProcedure">
                        <div class="space-y-4 text-left">
                            <div class="flex flex-wrap items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <SheetTitle class="text-left">
                                        {{ detailsProcedure?.procedureNumber || 'Theatre Procedure' }}
                                    </SheetTitle>
                                    <SheetDescription class="mt-1 text-left">
                                        {{
                                            detailsProcedure?.procedureName ||
                                            detailsProcedure?.procedureType ||
                                            'Procedure workflow review'
                                        }}
                                    </SheetDescription>
                                </div>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Badge v-if="detailsProcedure?.status" variant="secondary">
                                        {{ formatEnumLabel(detailsProcedure?.status) }}
                                    </Badge>
                                    <Badge v-if="detailsProcedure?.theatreRoomName" variant="outline">
                                        {{ theatreProcedureRoomDisplayLabel(detailsProcedure) }}
                                    </Badge>
                                </div>
                            </div>
                            <div class="grid gap-3 sm:grid-cols-3">
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Patient</p>
                                    <p class="mt-2 text-sm font-medium text-foreground">
                                        {{ theatrePatientDisplayLabel(detailsProcedure) }}
                                    </p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled</p>
                                    <p class="mt-2 text-sm font-medium text-foreground">
                                        {{ theatreProcedureScheduledSummary(detailsProcedure) }}
                                    </p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Encounter handoff</p>
                                    <p class="mt-2 text-sm font-medium text-foreground">
                                        {{ theatreProcedureEncounterLabel(detailsProcedure) }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <SheetTitle>Theatre Procedure Details</SheetTitle>
                        <SheetDescription>Procedure details and workflow audit.</SheetDescription>
                    </template>
                </SheetHeader>
                <ScrollArea class="min-h-0 flex-1">
                    <div class="space-y-4 p-6">
                <Tabs v-model="detailsTab" class="w-full space-y-4">
                    <TabsList class="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
                        <TabsTrigger value="overview" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                            <AppIcon name="layout-dashboard" class="size-3.5" />
                            Overview
                        </TabsTrigger>
                        <TabsTrigger value="workflows" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                            <AppIcon name="workflow" class="size-3.5" />
                            Workflows
                        </TabsTrigger>
                        <TabsTrigger value="audit" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                            <AppIcon name="shield-check" class="size-3.5" />
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
                <TabsContent value="overview" class="mt-0">
                    <Tabs v-model="detailsOverviewTab" class="space-y-4">
                        <TabsList class="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
                            <TabsTrigger value="summary" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                                <AppIcon name="layout-grid" class="size-3.5" />
                                Summary
                            </TabsTrigger>
                            <TabsTrigger value="context" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                                <AppIcon name="file-stack" class="size-3.5" />
                                Case Context
                            </TabsTrigger>
                            <TabsTrigger value="resources" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm">
                                <AppIcon name="workflow" class="size-3.5" />
                                Resource View
                            </TabsTrigger>
                        </TabsList>

                    <div v-if="detailsOverviewTab === 'summary' || detailsOverviewTab === 'resources'" class="space-y-4">
                        <div v-if="detailsOverviewTab === 'summary'" class="rounded-lg border bg-background p-4">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Procedure handoff</p>
                                <p class="text-xs text-muted-foreground">
                                    Core theatre scheduling identity, timing, and ownership.
                                </p>
                            </div>
                            <div class="mt-4 grid gap-3 sm:grid-cols-2">
                                <div class="rounded-lg border bg-muted/10 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procedure</p>
                                    <p class="mt-2 text-sm font-medium">
                                        {{
                                            detailsProcedure?.procedureName ||
                                            detailsProcedure?.procedureType ||
                                            'Procedure details pending'
                                        }}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        {{
                                            detailsProcedure?.procedureType ||
                                            'No governed theatre procedure type recorded'
                                        }}
                                    </p>
                                </div>
                                <div class="rounded-lg border bg-muted/10 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Patient</p>
                                    <p class="mt-2 text-sm font-medium">{{ theatrePatientDisplayLabel(detailsProcedure) }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ theatreProcedureEncounterLabel(detailsProcedure) }}
                                    </p>
                                </div>
                                <div class="rounded-lg border bg-muted/10 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Schedule</p>
                                    <p class="mt-2 text-sm font-medium">{{ theatreProcedureScheduledSummary(detailsProcedure) }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        Started: {{ detailsProcedure?.startedAt ? formatDateTime(detailsProcedure?.startedAt) : 'Not started' }}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Completed: {{ detailsProcedure?.completedAt ? formatDateTime(detailsProcedure?.completedAt) : 'Not completed' }}
                                    </p>
                                </div>
                                <div class="rounded-lg border bg-muted/10 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Theatre ownership</p>
                                    <p class="mt-2 text-sm font-medium">{{ theatreProcedureRoomDisplayLabel(detailsProcedure) }}</p>
                                    <p class="text-xs text-muted-foreground">
                                        {{ theatreProcedureRoomSupportLabel(detailsProcedure) }}
                                    </p>
                                    <p class="text-xs text-muted-foreground">Operating clinician: {{ theatreStaffDisplayLabel(detailsProcedure?.operatingClinicianUserId) }}</p>
                                    <p class="text-xs text-muted-foreground">Anesthetist: {{ theatreStaffDisplayLabel(detailsProcedure?.anesthetistUserId) }}</p>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <div v-if="detailsOverviewTab === 'summary'" class="rounded-lg border bg-background p-4">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Current focus</p>
                                    <p class="text-xs text-muted-foreground">
                                        What the theatre team should resolve next for this case.
                                    </p>
                                </div>
                                <p class="mt-4 text-base font-semibold">{{ detailsCurrentFocus.title }}</p>
                                <p class="mt-2 text-sm text-muted-foreground">{{ detailsCurrentFocus.detail }}</p>
                            </div>

                            <div v-if="detailsOverviewTab === 'resources'" class="rounded-lg border bg-background p-4">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Resource pulse</p>
                                    <p class="text-xs text-muted-foreground">
                                        Current room, staff, and equipment allocation status.
                                    </p>
                                </div>
                                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                                    <div class="rounded-lg border bg-muted/10 p-3">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheduled</p>
                                        <p class="mt-2 text-xl font-semibold">{{ detailsResourceCounts.scheduled ?? 0 }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/10 p-3">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">In use</p>
                                        <p class="mt-2 text-xl font-semibold">{{ detailsResourceCounts.in_use ?? 0 }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/10 p-3">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Released</p>
                                        <p class="mt-2 text-xl font-semibold">{{ detailsResourceCounts.released ?? 0 }}</p>
                                    </div>
                                    <div class="rounded-lg border bg-muted/10 p-3">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cancelled</p>
                                        <p class="mt-2 text-xl font-semibold">{{ detailsResourceCounts.cancelled ?? 0 }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div v-if="detailsOverviewTab === 'context'" class="space-y-4">
                        <div class="rounded-lg border bg-background p-4">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Case context</p>
                                <p class="text-xs text-muted-foreground">
                                    Encounter linkage, room registry, and case identifiers for this procedure.
                                </p>
                            </div>
                            <div class="mt-4 grid gap-3 sm:grid-cols-2">
                                <div class="rounded-lg border bg-muted/10 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procedure number</p>
                                    <p class="mt-2 text-sm font-medium">{{ detailsProcedure?.procedureNumber || 'N/A' }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/10 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Encounter handoff</p>
                                    <p class="mt-2 text-sm font-medium">{{ theatreProcedureEncounterLabel(detailsProcedure) }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/10 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Room registry</p>
                                    <p class="mt-2 text-sm font-medium">{{ theatreProcedureRoomDisplayLabel(detailsProcedure) }}</p>
                                    <p class="text-xs text-muted-foreground">{{ theatreProcedureRoomSupportLabel(detailsProcedure) }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/10 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last updated</p>
                                    <p class="mt-2 text-sm font-medium">{{ formatDateTime(detailsProcedure?.updatedAt) }}</p>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-lg border bg-background p-4">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Status & notes</p>
                                <p class="text-xs text-muted-foreground">
                                    Theatre reasons, cancellation context, and documentation handoff.
                                </p>
                            </div>
                            <div class="mt-4 space-y-3">
                                <div class="rounded-lg border bg-muted/10 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status note</p>
                                    <p class="mt-2 text-sm text-muted-foreground">{{ detailsProcedure?.statusReason || 'No status-specific note recorded.' }}</p>
                                </div>
                                <div class="rounded-lg border bg-muted/10 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Procedure notes</p>
                                    <p class="mt-2 text-sm text-muted-foreground">{{ detailsProcedure?.notes || 'No theatre notes captured yet.' }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    </Tabs>
                </TabsContent>

                <TabsContent value="workflows" class="mt-0 space-y-4">
                    <div class="rounded-lg border bg-background p-4">
                        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div class="min-w-0 space-y-2">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-sm font-medium">Workflow focus</p>
                                    <Badge v-if="detailsProcedure?.status" variant="outline">
                                        {{ formatEnumLabel(detailsProcedure.status) }}
                                    </Badge>
                                </div>
                                <div class="space-y-1">
                                    <p class="text-base font-semibold text-foreground">
                                        {{ detailsCurrentFocus.title }}
                                    </p>
                                    <p class="max-w-3xl text-sm leading-5 text-muted-foreground">
                                        {{ detailsCurrentFocus.detail }}
                                    </p>
                                </div>
                            </div>
                            <Button
                                v-if="detailsPrimaryStatusAction && canUpdateStatus"
                                size="sm"
                                class="gap-1.5 sm:shrink-0"
                                @click="openDetailsPrimaryStatusDialog"
                            >
                                <AppIcon name="arrow-right" class="size-3.5" />
                                {{ detailsPrimaryStatusActionLabel }}
                            </Button>
                        </div>
                    </div>

                    <div
                        v-if="
                            canCreateTheatreFollowOnOrder(detailsProcedure)
                            || canApplyTheatreLifecycleAction(detailsProcedure, 'cancel')
                            || canApplyTheatreLifecycleAction(detailsProcedure, 'entered_in_error')
                        "
                        class="rounded-lg border bg-background p-4"
                    >
                        <div class="space-y-1">
                            <p class="text-sm font-medium">Clinical lifecycle</p>
                            <p class="text-xs text-muted-foreground">
                                Reorder the case, add a linked follow-up procedure, or stop this booking without overwriting the original record.
                            </p>
                        </div>
                        <div class="mt-4 flex flex-wrap gap-2">
                            <Button
                                v-if="canCreateTheatreFollowOnOrder(detailsProcedure)"
                                size="sm"
                                variant="outline"
                                as-child
                                class="gap-1.5"
                            >
                                <Link
                                    :href="
                                        procedureWorkflowHref('/theatre-procedures', detailsProcedure, {
                                            includeTabNew: true,
                                            reorderOfId: detailsProcedure.id,
                                        })
                                    "
                                >
                                    <AppIcon name="rotate-cw" class="size-3.5" />
                                    Reorder
                                </Link>
                            </Button>
                            <Button
                                v-if="canCreateTheatreFollowOnOrder(detailsProcedure)"
                                size="sm"
                                variant="outline"
                                as-child
                                class="gap-1.5"
                            >
                                <Link
                                    :href="
                                        procedureWorkflowHref('/theatre-procedures', detailsProcedure, {
                                            includeTabNew: true,
                                            addOnToOrderId: detailsProcedure.id,
                                        })
                                    "
                                >
                                    <AppIcon name="plus" class="size-3.5" />
                                    Add Linked Procedure
                                </Link>
                            </Button>
                            <Button
                                v-if="canApplyTheatreLifecycleAction(detailsProcedure, 'cancel')"
                                size="sm"
                                variant="outline"
                                class="gap-1.5"
                                :disabled="lifecycleSubmitting"
                                @click="openTheatreLifecycleDialog(detailsProcedure, 'cancel')"
                            >
                                <AppIcon name="circle-slash-2" class="size-3.5" />
                                Cancel Procedure
                            </Button>
                            <Button
                                v-if="canApplyTheatreLifecycleAction(detailsProcedure, 'entered_in_error')"
                                size="sm"
                                variant="destructive"
                                class="gap-1.5"
                                :disabled="lifecycleSubmitting"
                                @click="openTheatreLifecycleDialog(detailsProcedure, 'entered_in_error')"
                            >
                                <AppIcon name="triangle-alert" class="size-3.5" />
                                Entered in Error
                            </Button>
                        </div>
                    </div>
                    <div
                        v-if="detailsProcedureNoteContinuityVisible && detailsProcedure"
                        class="rounded-lg border bg-background p-4"
                    >
                        <div class="flex flex-wrap items-start justify-between gap-2">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Procedure note continuity</p>
                                <p class="text-xs text-muted-foreground">
                                    Keep one theatre-linked procedure note for the case, then use review and amendment controls instead of parallel documentation.
                                </p>
                            </div>
                            <Badge
                                v-if="detailsProcedureNoteSummary"
                                :variant="detailsProcedureNoteSummary.badgeVariant"
                            >
                                {{ detailsProcedureNoteSummary.badgeLabel }}
                            </Badge>
                        </div>

                        <div
                            v-if="detailsProcedureNotesLoading"
                            class="mt-4 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
                        >
                            Loading linked procedure notes...
                        </div>

                        <div v-else-if="detailsProcedureNotesError" class="mt-4 space-y-3">
                            <Alert variant="destructive">
                                <AlertTitle>Unable to load procedure note continuity</AlertTitle>
                                <AlertDescription>
                                    {{ detailsProcedureNotesError }}
                                </AlertDescription>
                            </Alert>
                            <Button
                                v-if="canReadMedicalRecords"
                                size="sm"
                                variant="outline"
                                as-child
                                class="gap-1.5"
                            >
                                <Link :href="procedureMedicalRecordHistoryHref(detailsProcedure)">
                                    <AppIcon name="layout-list" class="size-3.5" />
                                    Open note history
                                </Link>
                            </Button>
                        </div>

                        <div
                            v-else-if="detailsProcedureNoteSummary"
                            class="mt-4 space-y-3 text-sm"
                        >
                            <div class="space-y-1">
                                <p class="font-medium text-foreground">
                                    {{ detailsProcedureNoteSummary.title }}
                                </p>
                                <p class="leading-6 text-muted-foreground">
                                    {{ detailsProcedureNoteSummary.description }}
                                </p>
                            </div>

                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Latest note
                                    </p>
                                    <p class="mt-2 text-sm font-medium text-foreground">
                                        {{
                                            detailsProcedureNoteSummary.latestRecord
                                                ? (detailsProcedureNoteSummary.latestRecord.recordNumber || 'Procedure note')
                                                : 'No procedure note linked yet'
                                        }}
                                    </p>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        <template v-if="detailsProcedureNoteSummary.latestRecord">
                                            {{ formatEnumLabel(detailsProcedureNoteSummary.latestRecord.status || 'draft') }}
                                            <template v-if="detailsProcedureNoteSummary.latestRecordedAtLabel">
                                                | {{ detailsProcedureNoteSummary.latestRecordedAtLabel }}
                                            </template>
                                        </template>
                                        <template v-else>
                                            Start the note from theatre when the procedural narrative is ready.
                                        </template>
                                    </p>
                                </div>
                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Workflow guidance
                                    </p>
                                    <p class="mt-2 text-sm leading-6 text-muted-foreground">
                                        {{ detailsProcedureNoteSummary.guidance }}
                                    </p>
                                </div>
                            </div>

                            <p
                                v-if="detailsProcedureNoteSummary.noteCount > 1"
                                class="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground"
                            >
                                {{ detailsProcedureNoteSummary.noteCount }} procedure notes are linked to this case. Keep one clear primary procedure narrative unless a corrected or amended note is clinically necessary.
                            </p>

                            <div class="flex flex-wrap gap-2">
                                <Button
                                    v-if="detailsProcedureNoteSummary.primaryActionLabel && detailsProcedureNoteSummary.primaryActionHref"
                                    size="sm"
                                    variant="outline"
                                    as-child
                                    class="gap-1.5"
                                >
                                    <Link :href="detailsProcedureNoteSummary.primaryActionHref">
                                        <AppIcon name="file-text" class="size-3.5" />
                                        {{ detailsProcedureNoteSummary.primaryActionLabel }}
                                    </Link>
                                </Button>
                                <Button
                                    v-if="detailsProcedureNoteSummary.secondaryActionLabel && detailsProcedureNoteSummary.secondaryActionHref"
                                    size="sm"
                                    variant="outline"
                                    as-child
                                    class="gap-1.5"
                                >
                                    <Link :href="detailsProcedureNoteSummary.secondaryActionHref">
                                        <AppIcon name="layout-list" class="size-3.5" />
                                        {{ detailsProcedureNoteSummary.secondaryActionLabel }}
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div v-if="detailsProcedure?.patientId" class="rounded-lg border bg-background p-4">
                        <div class="space-y-1">
                            <p class="text-sm font-medium">Related workflows</p>
                            <p class="text-xs text-muted-foreground">
                                Open related workflows with patient and encounter context carried forward.
                            </p>
                        </div>
                        <div class="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            <Button
                                v-if="canReadAppointments && detailsProcedure?.appointmentId"
                                size="sm"
                                variant="outline"
                                as-child
                                class="justify-start gap-1.5"
                            >
                                <Link
                                    :href="
                                        procedureWorkflowHref('/appointments', detailsProcedure, {
                                            focusAppointmentOnReturn: true,
                                        })
                                    "
                                >
                                    <AppIcon name="calendar-clock" class="size-3.5" />
                                    Back to Appointment
                                </Link>
                            </Button>
                            <Button
                                v-if="canReadAdmissions && detailsProcedure?.admissionId"
                                size="sm"
                                variant="outline"
                                as-child
                                class="justify-start gap-1.5"
                            >
                                <Link :href="procedureWorkflowHref('/admissions', detailsProcedure)">
                                    <AppIcon name="bed-double" class="size-3.5" />
                                    Back to Admission
                                </Link>
                            </Button>
                            <Button
                                v-if="detailsProcedure?.patientId"
                                size="sm"
                                variant="outline"
                                as-child
                                class="justify-start gap-1.5"
                            >
                                <Link :href="patientChartHref(detailsProcedure.patientId)">
                                    <AppIcon name="user-round" class="size-3.5" />
                                    Open Patient Chart
                                </Link>
                            </Button>
                            <Button
                                v-if="canCreateLaboratoryOrders"
                                size="sm"
                                variant="outline"
                                as-child
                                class="justify-start gap-1.5"
                            >
                                <Link :href="procedureWorkflowHref('/laboratory-orders', detailsProcedure, { includeTabNew: true })">
                                    <AppIcon name="flask-conical" class="size-3.5" />
                                    Order Lab
                                </Link>
                            </Button>
                            <Button
                                v-if="canCreatePharmacyOrders"
                                size="sm"
                                variant="outline"
                                as-child
                                class="justify-start gap-1.5"
                            >
                                <Link :href="procedureWorkflowHref('/pharmacy-orders', detailsProcedure, { includeTabNew: true })">
                                    <AppIcon name="pill" class="size-3.5" />
                                    Order Pharmacy
                                </Link>
                            </Button>
                            <Button
                                v-if="canCreateRadiologyOrders"
                                size="sm"
                                variant="outline"
                                as-child
                                class="justify-start gap-1.5"
                            >
                                <Link :href="procedureWorkflowHref('/radiology-orders', detailsProcedure, { includeTabNew: true })">
                                    <AppIcon name="scan-heart" class="size-3.5" />
                                    Order Imaging
                                </Link>
                            </Button>
                            <Button
                                v-if="canReadBillingInvoices"
                                size="sm"
                                variant="outline"
                                as-child
                                class="justify-start gap-1.5"
                            >
                                <Link :href="procedureWorkflowHref('/billing-invoices', detailsProcedure, { includeTabNew: true })">
                                    <AppIcon name="receipt-text" class="size-3.5" />
                                    New Billing Invoice
                                </Link>
                            </Button>
                        </div>
                    </div>
                    <div class="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                        <div class="rounded-lg border bg-background p-4">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Theatre workflow timeline</p>
                                <p class="text-xs text-muted-foreground">
                                    Follow the case from scheduling through pre-op, theatre, and completion.
                                </p>
                            </div>
                            <div class="mt-4 space-y-4">
                                <div v-for="(step, index) in detailsWorkflowTimeline" :key="step.id" class="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                                    <div class="flex flex-col items-center">
                                        <span class="mt-1 size-3 rounded-full border-2" :class="theatreTimelineDotClass(step.state)" />
                                        <span v-if="index < detailsWorkflowTimeline.length - 1" class="mt-1 h-full min-h-8 w-px bg-border" />
                                    </div>
                                    <div class="pb-2">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-medium">{{ step.label }}</p>
                                            <Badge :variant="step.state === 'blocked' ? 'destructive' : step.state === 'current' ? 'secondary' : 'outline'" class="text-[10px]">
                                                {{ step.state === 'complete' ? 'Done' : step.state === 'current' ? 'Current' : step.state === 'blocked' ? 'Blocked' : 'Pending' }}
                                            </Badge>
                                        </div>
                                        <p class="mt-1 text-sm text-muted-foreground">{{ step.detail }}</p>
                                        <p v-if="step.timestamp" class="mt-1 text-xs text-muted-foreground">{{ step.timestamp }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <div class="rounded-lg border bg-background p-4">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Pre-op readiness</p>
                                    <p class="text-xs text-muted-foreground">
                                        Minimum operational checks before the case should move cleanly into theatre.
                                    </p>
                                </div>
                                <div class="mt-3 flex items-center gap-2">
                                    <Badge :variant="detailsPreopReadinessSummary.includes('blocker') ? 'destructive' : detailsPreopReadinessSummary.includes('confirm') ? 'secondary' : 'default'">
                                        {{ detailsPreopReadinessSummary }}
                                    </Badge>
                                </div>
                                <div class="mt-4 space-y-2">
                                    <div v-for="check in detailsPreopReadinessChecks" :key="check.id" class="flex items-start justify-between gap-3 rounded-lg border bg-muted/10 p-3">
                                        <div class="min-w-0">
                                            <p class="text-sm font-medium">{{ check.label }}</p>
                                            <p class="text-xs text-muted-foreground">{{ check.detail }}</p>
                                        </div>
                                        <Badge :variant="readinessBadgeVariant(check.state)" class="shrink-0">
                                            {{ check.state === 'ready' ? 'Ready' : check.state === 'warn' ? 'Check' : 'Blocked' }}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div class="rounded-lg border p-4" :class="turnoverToneClasses(detailsTurnoverSignal?.tone || 'ready')">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Turnover signal</p>
                                    <p class="text-xs text-muted-foreground">
                                        Theatre room handoff signal based on the current loaded slate.
                                    </p>
                                </div>
                                <p class="mt-4 text-base font-semibold">{{ detailsTurnoverSignal?.title || 'No turnover signal available' }}</p>
                                <p class="mt-2 text-sm text-muted-foreground">{{ detailsTurnoverSignal?.detail || 'Open a procedure with a scheduled theatre room to inspect turnover timing.' }}</p>
                            </div>
                        </div>
                    </div>

                    <div class="rounded-lg border bg-background p-4">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Resource allocations</p>
                                <p class="text-xs text-muted-foreground">
                                    Theatre room, staff, and equipment allocations attached to this case.
                                </p>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Badge variant="outline">Scheduled {{ detailsResourceCounts.scheduled ?? 0 }}</Badge>
                                <Badge variant="outline">In use {{ detailsResourceCounts.in_use ?? 0 }}</Badge>
                                <Badge variant="outline">Released {{ detailsResourceCounts.released ?? 0 }}</Badge>
                                <Badge variant="outline">Cancelled {{ detailsResourceCounts.cancelled ?? 0 }}</Badge>
                            </div>
                        </div>

                        <div class="mt-4 grid gap-3 rounded-lg border bg-muted/10 p-4 md:grid-cols-2 xl:grid-cols-4">
                            <div class="grid gap-2 xl:col-span-2">
                                <Label for="resource-filter-q">Search</Label>
                                <Input id="resource-filter-q" v-model="detailsResourceFilters.q" placeholder="Reference, role, notes..." @keyup.enter="applyResourceFilters" />
                            </div>
                            <div class="grid gap-2">
                                <Label for="resource-filter-type">Type</Label>
                                <Select v-model="detailsResourceFilters.resourceType">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">All</SelectItem>
                                    <SelectItem v-for="option in resourceTypeOptions" :key="`resource-type-${option}`" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-2">
                                <Label for="resource-filter-status">Status</Label>
                                <Select v-model="detailsResourceFilters.status">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">All</SelectItem>
                                    <SelectItem v-for="option in resourceStatusOptions" :key="`resource-status-${option}`" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div class="grid gap-2">
                                <Label for="resource-filter-per-page">Rows Per Page</Label>
                                <Select :model-value="String(detailsResourceFilters.perPage)" @update:model-value="detailsResourceFilters.perPage = Number($event)">
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
                            <div class="flex flex-wrap items-end gap-2 xl:col-span-3">
                                <Button type="button" size="sm" :disabled="detailsResourceLoading" @click="applyResourceFilters">{{ detailsResourceLoading ? 'Applying...' : 'Apply Filters' }}</Button>
                                <Button type="button" size="sm" variant="outline" :disabled="detailsResourceLoading" @click="resetResourceFilters">Reset</Button>
                            </div>
                        </div>

                        <div class="mt-4 space-y-3">
                            <Alert v-if="detailsResourceError" variant="destructive">
                                <AlertTitle>Resource Allocation Load Issue</AlertTitle>
                                <AlertDescription>{{ detailsResourceError }}</AlertDescription>
                            </Alert>
                            <div v-else-if="detailsResourceLoading" class="space-y-2">
                                <div class="h-14 animate-pulse rounded-md bg-muted" />
                                <div class="h-14 animate-pulse rounded-md bg-muted" />
                            </div>
                            <div v-else class="space-y-3">
                                <p v-if="detailsResourceItems.length === 0" class="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No resource allocations found for current filters.</p>
                                <div v-else class="grid gap-3 xl:grid-cols-2">
                                    <div v-for="allocation in detailsResourceItems" :key="allocation.id" class="rounded-lg border bg-muted/10 p-3">
                                        <div class="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p class="font-medium">{{ allocation.resourceReference }}</p>
                                                <p class="text-xs text-muted-foreground">{{ formatEnumLabel(allocation.resourceType) }} · {{ allocation.roleLabel || 'No role label' }}</p>
                                            </div>
                                            <Badge variant="outline">{{ formatEnumLabel(allocation.status) }}</Badge>
                                        </div>
                                        <div class="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                            <p>Planned start: {{ formatDateTime(allocation.plannedStartAt) }}</p>
                                            <p>Planned end: {{ formatDateTime(allocation.plannedEndAt) }}</p>
                                            <p>Actual start: {{ formatDateTime(allocation.actualStartAt) }}</p>
                                            <p>Actual end: {{ formatDateTime(allocation.actualEndAt) }}</p>
                                        </div>
                                        <p v-if="allocation.notes" class="mt-2 text-xs text-muted-foreground">Notes: {{ allocation.notes }}</p>
                                        <div class="mt-3 flex flex-wrap gap-2">
                                            <Button v-if="canManageResources" type="button" size="sm" variant="secondary" @click="openResourceStatusDialog(allocation, 'in_use')">In use</Button>
                                            <Button v-if="canManageResources" type="button" size="sm" variant="secondary" @click="openResourceStatusDialog(allocation, 'released')">Release</Button>
                                            <Button v-if="canViewResourceAudit" type="button" size="sm" variant="outline" class="gap-1.5" @click="openResourceAuditDialog(allocation)"><AppIcon name="shield-check" class="size-3.5" />Audit</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center justify-between border-t pt-2">
                                <Button variant="outline" size="sm" :disabled="detailsResourceLoading || !detailsResourceMeta || detailsResourceMeta.currentPage <= 1" @click="goToResourcePage((detailsResourceMeta?.currentPage ?? 2) - 1)">Previous</Button>
                                <p class="text-xs text-muted-foreground">Page {{ detailsResourceMeta?.currentPage ?? 1 }} of {{ detailsResourceMeta?.lastPage ?? 1 }} · {{ detailsResourceMeta?.total ?? detailsResourceItems.length }} allocations</p>
                                <Button variant="outline" size="sm" :disabled="detailsResourceLoading || !detailsResourceMeta || detailsResourceMeta.currentPage >= detailsResourceMeta.lastPage" @click="goToResourcePage((detailsResourceMeta?.currentPage ?? 0) + 1)">Next</Button>
                            </div>
                            <Alert v-if="!canManageResources" variant="destructive">
                                <AlertTitle class="flex items-center gap-2"><AppIcon name="alert-triangle" class="size-4" />Allocation Management Restricted</AlertTitle>
                                <AlertDescription>Request <code>theatre.procedures.manage-resources</code> permission.</AlertDescription>
                            </Alert>
                            <div v-else class="grid gap-3 rounded-lg border bg-muted/10 p-4 md:grid-cols-2">
                                <div class="grid gap-1">
                                    <Label for="resource-create-type">Resource Type</Label>
                                    <Select v-model="resourceCreateForm.resourceType">
                                        <SelectTrigger :disabled="resourceCreateSubmitting">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem v-for="option in resourceTypeOptions" :key="`resource-create-type-${option}`" :value="option">{{ formatEnumLabel(option) }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p v-if="resourceCreateFieldError('resourceType')" class="text-xs text-red-600">{{ resourceCreateFieldError('resourceType') }}</p>
                                </div>
                                <div class="grid gap-1">
                                    <Label for="resource-create-reference">Resource Reference</Label>
                                    <Input id="resource-create-reference" v-model="resourceCreateForm.resourceReference" :disabled="resourceCreateSubmitting" placeholder="e.g. Theatre Room A / user:12 / ventilator-02" />
                                    <p v-if="resourceCreateFieldError('resourceReference')" class="text-xs text-red-600">{{ resourceCreateFieldError('resourceReference') }}</p>
                                </div>
                                <div class="grid gap-1">
                                    <Label for="resource-create-role-label">Role Label</Label>
                                    <Input id="resource-create-role-label" v-model="resourceCreateForm.roleLabel" :disabled="resourceCreateSubmitting" placeholder="e.g. scrub nurse" />
                                </div>
                                <div class="grid gap-1">
                                    <Label for="resource-create-planned-start">Planned Start</Label>
                                    <Input id="resource-create-planned-start" v-model="resourceCreateForm.plannedStartAt" :disabled="resourceCreateSubmitting" type="datetime-local" />
                                    <p v-if="resourceCreateFieldError('plannedStartAt')" class="text-xs text-red-600">{{ resourceCreateFieldError('plannedStartAt') }}</p>
                                </div>
                                <div class="grid gap-1">
                                    <Label for="resource-create-planned-end">Planned End</Label>
                                    <Input id="resource-create-planned-end" v-model="resourceCreateForm.plannedEndAt" :disabled="resourceCreateSubmitting" type="datetime-local" />
                                    <p v-if="resourceCreateFieldError('plannedEndAt')" class="text-xs text-red-600">{{ resourceCreateFieldError('plannedEndAt') }}</p>
                                </div>
                                <div class="grid gap-1 md:col-span-2">
                                    <Label for="resource-create-notes">Notes</Label>
                                    <Textarea id="resource-create-notes" v-model="resourceCreateForm.notes" :disabled="resourceCreateSubmitting" rows="2" placeholder="Optional notes" />
                                </div>
                                <div class="flex justify-end md:col-span-2">
                                    <Button type="button" size="sm" class="gap-1.5" :disabled="resourceCreateSubmitting" @click="submitResourceCreate">
                                        <AppIcon name="plus" class="size-3.5" />
                                        {{ resourceCreateSubmitting ? 'Creating...' : 'Add Allocation' }}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="audit" class="mt-0 space-y-4">
                    <Alert v-if="!canViewAudit" variant="destructive">
                        <AlertTitle class="flex items-center gap-2"><AppIcon name="alert-triangle" class="size-4" />Audit Access Restricted</AlertTitle>
                        <AlertDescription>Request <code>theatre.procedures.view-audit-logs</code> permission.</AlertDescription>
                    </Alert>
                    <template v-else>
                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div class="rounded-lg border bg-muted/10 p-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total logs</p>
                                <p class="mt-2 text-2xl font-semibold">{{ detailsAuditSummary.total }}</p>
                            </div>
                            <div class="rounded-lg border bg-muted/10 p-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current view</p>
                                <p class="mt-2 text-2xl font-semibold">{{ detailsAuditSummary.currentView }}</p>
                            </div>
                            <div class="rounded-lg border bg-muted/10 p-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status changes</p>
                                <p class="mt-2 text-2xl font-semibold">{{ detailsAuditSummary.statusChanges }}</p>
                            </div>
                            <div class="rounded-lg border bg-muted/10 p-4">
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active filters</p>
                                <p class="mt-2 text-2xl font-semibold">{{ detailsAuditSummary.activeFilters }}</p>
                            </div>
                        </div>

                        <div class="rounded-lg border bg-background p-4">
                            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">Audit activity</p>
                                    <p class="text-xs text-muted-foreground">
                                        Review case changes, actor context, and raw payload details without leaving the sheet.
                                    </p>
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    <Button type="button" size="sm" variant="outline" class="gap-1.5" @click="detailsAuditFiltersOpen = !detailsAuditFiltersOpen">
                                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                                        {{ detailsAuditFiltersOpen ? 'Hide Filters' : 'Audit Filters' }}
                                    </Button>
                                    <Button type="button" size="sm" variant="outline" :disabled="detailsAuditLoading || detailsAuditExporting" @click="exportDetailsAuditLogsCsv">
                                        {{ detailsAuditExporting ? 'Preparing...' : 'Export CSV' }}
                                    </Button>
                                </div>
                            </div>

                            <div v-if="detailsAuditFiltersOpen" class="mt-4 grid gap-3 rounded-lg border bg-muted/10 p-4 md:grid-cols-2 xl:grid-cols-4">
                                <div class="grid gap-2 xl:col-span-2">
                                    <Label for="theatre-details-audit-q">Action Text Search</Label>
                                    <Input id="theatre-details-audit-q" v-model="detailsAuditFilters.q" placeholder="status.updated, created, cancelled..." />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="theatre-details-audit-action">Action (exact)</Label>
                                    <Input id="theatre-details-audit-action" v-model="detailsAuditFilters.action" placeholder="Optional exact action key" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="theatre-details-audit-actor-type">Actor Type</Label>
                                    <Select v-model="detailsAuditFilters.actorType">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem v-for="option in auditActorTypeOptions" :key="`theatre-audit-actor-type-${option.value || 'all'}`" :value="option.value">{{ option.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="theatre-details-audit-actor-id">Actor ID</Label>
                                    <Input id="theatre-details-audit-actor-id" v-model="detailsAuditFilters.actorId" inputmode="numeric" placeholder="Optional user id" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="theatre-details-audit-from">From</Label>
                                    <Input id="theatre-details-audit-from" v-model="detailsAuditFilters.from" type="datetime-local" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="theatre-details-audit-to">To</Label>
                                    <Input id="theatre-details-audit-to" v-model="detailsAuditFilters.to" type="datetime-local" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="theatre-details-audit-per-page">Rows Per Page</Label>
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
                                <div class="flex flex-wrap items-end gap-2 xl:col-span-4">
                                    <Button type="button" size="sm" :disabled="detailsAuditLoading" @click="applyDetailsAuditFilters">{{ detailsAuditLoading ? 'Applying...' : 'Apply Filters' }}</Button>
                                    <Button type="button" size="sm" variant="outline" :disabled="detailsAuditLoading" @click="resetDetailsAuditFilters">Reset</Button>
                                </div>
                            </div>

                            <div class="mt-4 space-y-3">
                                <Alert v-if="detailsAuditError" variant="destructive">
                                    <AlertTitle>Audit Load Issue</AlertTitle>
                                    <AlertDescription>{{ detailsAuditError }}</AlertDescription>
                                </Alert>
                                <div v-else-if="detailsAuditLoading" class="text-sm text-muted-foreground">Loading audit logs...</div>
                                <div v-else-if="detailsAuditLogs.length === 0" class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No audit logs found for current filters.</div>
                                <div v-else class="space-y-3">
                                    <div v-for="log in detailsAuditLogs" :key="log.id" class="rounded-lg border bg-muted/10 p-3">
                                        <div class="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <p class="font-medium">{{ log.action || 'event' }}</p>
                                                <p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }} · {{ auditActorLabel(log) }}</p>
                                            </div>
                                            <div class="flex flex-wrap gap-2">
                                                <Badge variant="outline">{{ log.actorType ? formatEnumLabel(log.actorType) : 'Actor' }}</Badge>
                                                <Button v-if="detailsAuditHasPayload(log)" type="button" size="sm" variant="outline" class="gap-1.5" @click="toggleDetailsAuditRow(log.id)">
                                                    {{ detailsAuditRowExpanded(log.id) ? 'Hide details' : 'Show details' }}
                                                </Button>
                                            </div>
                                        </div>

                                        <div v-if="detailsAuditRowExpanded(log.id) && detailsAuditHasPayload(log)" class="mt-3 grid gap-3 lg:grid-cols-2">
                                            <div v-if="log.before !== undefined && log.before !== null" class="rounded-lg border bg-background p-3">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Before</p>
                                                <pre class="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{{ formatAuditPayload(log.before) }}</pre>
                                            </div>
                                            <div v-if="log.after !== undefined && log.after !== null" class="rounded-lg border bg-background p-3">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">After</p>
                                                <pre class="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{{ formatAuditPayload(log.after) }}</pre>
                                            </div>
                                            <div v-if="log.metadata !== undefined && log.metadata !== null" class="rounded-lg border bg-background p-3 lg:col-span-2">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Metadata</p>
                                                <pre class="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{{ formatAuditPayload(log.metadata) }}</pre>
                                            </div>
                                            <div v-else-if="log.changes !== undefined && log.changes !== null" class="rounded-lg border bg-background p-3 lg:col-span-2">
                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Changes</p>
                                                <pre class="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{{ formatAuditPayload(log.changes) }}</pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center justify-between border-t pt-2">
                                    <Button variant="outline" size="sm" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage <= 1" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 2) - 1)">Previous</Button>
                                    <p class="text-xs text-muted-foreground">Page {{ detailsAuditMeta?.currentPage ?? 1 }} of {{ detailsAuditMeta?.lastPage ?? 1 }} · {{ detailsAuditMeta?.total ?? detailsAuditLogs.length }} logs</p>
                                    <Button variant="outline" size="sm" :disabled="detailsAuditLoading || !detailsAuditMeta || detailsAuditMeta.currentPage >= detailsAuditMeta.lastPage" @click="goToDetailsAuditPage((detailsAuditMeta?.currentPage ?? 0) + 1)">Next</Button>
                                </div>
                            </div>
                        </div>
                    </template>
                </TabsContent>
                </Tabs>
                    </div>
                </ScrollArea>
                <SheetFooter class="shrink-0 border-t px-6 py-4">
                    <Button variant="outline" @click="detailsOpen = false">Close</Button>
                </SheetFooter>
            </div>
        </SheetContent>
    </Sheet>

    <Dialog v-model:open="resourceAuditDialogOpen">
        <DialogContent variant="workspace" size="4xl" class="max-h-[88vh]">
            <DialogHeader class="shrink-0 border-b px-6 py-4">
                <DialogTitle>Resource Allocation Audit Logs</DialogTitle>
                <DialogDescription>{{ resourceAuditTarget?.resourceReference ?? 'Resource Allocation' }}</DialogDescription>
            </DialogHeader>
            <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div class="space-y-4">
                <Alert v-if="!canViewResourceAudit" variant="destructive">
                    <AlertTitle class="flex items-center gap-2"><AppIcon name="alert-triangle" class="size-4" />Audit Access Restricted</AlertTitle>
                    <AlertDescription>Request <code>theatre.procedures.view-resource-audit-logs</code> permission.</AlertDescription>
                </Alert>
                <div v-else class="space-y-3">
                    <Tabs v-model="resourceAuditDialogTab" class="space-y-4">
                        <TabsList class="grid h-auto w-full grid-cols-2 gap-1 rounded-lg bg-muted/20 p-1">
                            <TabsTrigger value="logs">Logs</TabsTrigger>
                            <TabsTrigger value="filters">Filters</TabsTrigger>
                        </TabsList>
                        <TabsContent value="logs" class="mt-0 space-y-3">
                            <Alert v-if="resourceAuditError" variant="destructive">
                                <AlertTitle>Audit Load Issue</AlertTitle>
                                <AlertDescription>{{ resourceAuditError }}</AlertDescription>
                            </Alert>
                            <div v-else-if="resourceAuditLoading" class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">Loading audit logs...</div>
                            <div v-else class="space-y-2 rounded-md border p-2 text-sm">
                                <p v-if="resourceAuditLogs.length === 0" class="text-muted-foreground">No audit logs found for current filters.</p>
                                <div v-for="log in resourceAuditLogs" :key="log.id" class="rounded border p-2">
                                    <p class="font-medium">{{ log.action || 'event' }}</p>
                                    <p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }} | {{ auditActorLabel(log) }}</p>
                                </div>
                            </div>
                            <div class="flex items-center justify-between border-t pt-2">
                                <Button variant="outline" size="sm" :disabled="resourceAuditLoading || !resourceAuditMeta || resourceAuditMeta.currentPage <= 1" @click="goToResourceAuditPage((resourceAuditMeta?.currentPage ?? 2) - 1)">Previous</Button>
                                <p class="text-xs text-muted-foreground">Page {{ resourceAuditMeta?.currentPage ?? 1 }} of {{ resourceAuditMeta?.lastPage ?? 1 }} | {{ resourceAuditMeta?.total ?? resourceAuditLogs.length }} logs</p>
                                <Button variant="outline" size="sm" :disabled="resourceAuditLoading || !resourceAuditMeta || resourceAuditMeta.currentPage >= resourceAuditMeta.lastPage" @click="goToResourceAuditPage((resourceAuditMeta?.currentPage ?? 0) + 1)">Next</Button>
                            </div>
                        </TabsContent>
                        <TabsContent value="filters" class="mt-0 space-y-3">
                            <div class="grid gap-3 rounded-md border p-3 md:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="resource-audit-q">Action Text Search</Label>
                                    <Input id="resource-audit-q" v-model="resourceAuditFilters.q" placeholder="status.updated, created, released..." />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="resource-audit-action">Action (exact)</Label>
                                    <Input id="resource-audit-action" v-model="resourceAuditFilters.action" placeholder="Optional exact action key" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="resource-audit-actor-type">Actor Type</Label>
                                    <Select v-model="resourceAuditFilters.actorType">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem v-for="option in auditActorTypeOptions" :key="`resource-audit-actor-type-${option.value || 'all'}`" :value="option.value">{{ option.label }}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label for="resource-audit-actor-id">Actor ID</Label>
                                    <Input id="resource-audit-actor-id" v-model="resourceAuditFilters.actorId" inputmode="numeric" placeholder="Optional user id" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="resource-audit-from">From</Label>
                                    <Input id="resource-audit-from" v-model="resourceAuditFilters.from" type="datetime-local" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="resource-audit-to">To</Label>
                                    <Input id="resource-audit-to" v-model="resourceAuditFilters.to" type="datetime-local" />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="resource-audit-per-page">Rows Per Page</Label>
                                    <Select :model-value="String(resourceAuditFilters.perPage)" @update:model-value="resourceAuditFilters.perPage = Number($event)">
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
                                <div class="flex flex-wrap items-end gap-2">
                                    <Button size="sm" :disabled="resourceAuditLoading" @click="applyResourceAuditFilters">{{ resourceAuditLoading ? 'Applying...' : 'Apply Filters' }}</Button>
                                    <Button size="sm" variant="outline" :disabled="resourceAuditLoading" @click="resetResourceAuditFilters">Reset</Button>
                                    <Button size="sm" variant="outline" :disabled="resourceAuditLoading || resourceAuditExporting" @click="exportResourceAuditLogsCsv">{{ resourceAuditExporting ? 'Preparing...' : 'Export CSV' }}</Button>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            </div>
            <DialogFooter class="shrink-0 border-t bg-background px-6 py-4">
                <Button variant="outline" @click="resourceAuditDialogOpen = false">Close</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <LeaveWorkflowDialog
        :open="createLeaveConfirmOpen"
        :title="THEATRE_CREATE_LEAVE_TITLE"
        :description="THEATRE_CREATE_LEAVE_DESCRIPTION"
        stay-label="Stay on procedure"
        leave-label="Leave page"
        @update:open="(open) => (open ? (createLeaveConfirmOpen = true) : cancelPendingCreateWorkflowLeave())"
        @confirm="confirmPendingCreateWorkflowLeave"
    />
    <ConfirmationDialog
        :open="duplicateConfirmDialogState.open"
        :title="duplicateConfirmDialogState.title"
        :description="duplicateConfirmDialogState.description"
        :details="duplicateConfirmDialogState.details"
        :cancel-label="duplicateConfirmDialogState.cancelLabel"
        :confirm-label="duplicateConfirmDialogState.confirmLabel"
        :confirm-variant="duplicateConfirmDialogState.confirmVariant"
        :content-class="duplicateConfirmDialogState.contentClass"
        @update:open="updateDuplicateConfirmationDialogOpen"
        @confirm="confirmDuplicateDialogAction"
    />
</template>
